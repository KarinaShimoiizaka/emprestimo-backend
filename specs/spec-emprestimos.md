# BE-04 — Solicitar empréstimo

**Status:** pronta. Aprovada em 11/11/2026; veredito `PRONTA` do
verificador-spec (`docs/verificacoes/`, no repositório da raiz).

**Contexto:** briefing "solicitar empréstimo" da prática; [PRD §7](../../docs/prd.md)
(alterado em 11/11/2026: limite de 5 itens, prazo de 14 dias úteis);
[BE-01](spec-backend.md) §3 a §7 (modelo, invariantes, rotas, erros);
[ADR-003](../../docs/adrs/adr-003-autorizacao-no-backend.md) (autorização no
backend); [BE-03](spec-dados-iniciais.md) (os 12 equipamentos).
**Lado do cliente:** [FE-04](../../frontend/specs/spec-solicitar-emprestimo.md).

---

## 1. Objetivo

Quem está logado vê o acervo com a situação real, solicita um equipamento
disponível e o empréstimo nasce na hora (decisão já tomada para a turma: sem
aprovação de Operações nem fila). A pessoa vê os próprios empréstimos em
aberto, com a data de devolução prevista.

## 2. Modelo

A tabela `emprestimo`, como a BE-01 §3 descreve:

| campo | tipo | observação |
|---|---|---|
| `id` | uuid | gerado |
| `equipamento_id` | uuid → `equipamento` | |
| `perfil_id` | uuid → `perfil` | sempre a pessoa do token |
| `retirada_em` | data | dia da solicitação, no fuso de São Paulo |
| `devolver_ate` | data | `retirada_em` + 14 dias úteis (§4) |
| `devolvido_em` | data, opcional | sempre vazio nesta fase: devolução está fora de escopo |

Invariantes no banco, escritas na migration (BE-01 §3):

- **um empréstimo aberto por equipamento:** índice único parcial em
  `equipamento_id` onde `devolvido_em` é nulo. É o que garante o "dois
  pedidos ao mesmo tempo, só um é criado";
- **prazo coerente:** `devolver_ate > retirada_em`;
- **trava de manutenção:** trigger que recusa empréstimo de equipamento em
  `manutencao`;
- **limite de 5 abertos por pessoa:** trigger que conta os abertos antes do
  insert. Ele trava por pessoa, para dois pedidos simultâneos da mesma pessoa
  não passarem os dois do limite;
- **RLS ligado e sem política** (ADR-003).

"Emprestado" continua não sendo situação guardada: é a existência de um
empréstimo aberto (BE-01 §3).

## 3. Rotas

Base `/api`, todas com `Authorization: Bearer <token>` e qualquer papel.

### GET /api/equipamentos

Os equipamentos em ordem de patrimônio:

```json
[
  {
    "id": "...",
    "patrimonio": "TI-0001",
    "nome": "Notebook 14 polegadas",
    "categoria": "notebook",
    "situacao": "emprestado",
    "observacao": null,
    "imagemUrl": "https://<projeto>.supabase.co/storage/v1/object/public/<bucket>/equipamentos/TI-0001.jpg",
    "emprestimo": { "pessoa": "Marcelo Grilo", "devolverAte": "2026-11-27", "comVoce": true }
  }
]
```

- `situacao`: `manutencao` se o equipamento está em manutenção; senão
  `emprestado` se há empréstimo aberto; senão `disponivel`.
- `imagemUrl` é montada a partir de `SUPABASE_URL`, `STORAGE_NAME` e
  `imagem_caminho` (BE-03 §2). O crédito da foto não vai na resposta: o
  catálogo não o exibe (decisão da pessoa, `ENTREGA.md` §1).
- `emprestimo` é `null` quando o item não está emprestado. O nome de quem está
  com o item vai junto porque o PRD pede no card (BE-01 §4). `comVoce` diz se
  é a própria pessoa.

### POST /api/emprestimos

Requisição `{ "equipamentoId": "..." }`. Antes de tudo, garante a linha em
`perfil` (o mesmo `upsert` da BE-02 §4). Depois confere, nesta ordem:

| # | Situação | Resposta |
|---|---|---|
| 1 | equipamento não existe | 404 `NAO_ENCONTRADO` — "Equipamento não encontrado." |
| 2 | equipamento em manutenção | 422 `EM_MANUTENCAO` — "Este equipamento está em manutenção." |
| 3 | equipamento já emprestado | 409 `EQUIPAMENTO_INDISPONIVEL` — "Este equipamento já está emprestado." |
| 4 | a pessoa tem empréstimo em atraso | 422 `BLOQUEADO_POR_ATRASO` — "Você tem um item em atraso. Devolva antes de solicitar outro." |
| 5 | a pessoa já tem 5 em aberto | 422 `LIMITE_ATINGIDO` — "Você já está com 5 itens." |

Passando por tudo, cria o empréstimo e responde 201:

```json
{ "id": "...", "equipamentoId": "...", "retiradaEm": "2026-11-09", "devolverAte": "2026-11-27" }
```

Se o banco recusar na hora de gravar (corrida entre dois pedidos), a
resposta é a mesma da tabela: índice único violado vira 409
`EQUIPAMENTO_INDISPONIVEL`, e trigger de limite vira 422 `LIMITE_ATINGIDO`.
O formato do erro é o da BE-01 §7.

### GET /api/emprestimos/meus

Os empréstimos **em aberto da pessoa do token**, por `devolverAte`
crescente:

```json
[
  {
    "id": "...",
    "retiradaEm": "2026-11-09",
    "devolverAte": "2026-11-27",
    "equipamento": { "id": "...", "patrimonio": "TI-0001", "nome": "Notebook 14 polegadas", "categoria": "notebook", "imagemUrl": "..." }
  }
]
```

## 4. Datas

- **"Hoje" é o dia em São Paulo** (`America/Sao_Paulo`), não o do servidor.
- **14 dias úteis:** conta-se a partir do dia seguinte à retirada, só de
  segunda a sexta; o 14º dia útil é o `devolverAte`. Feriados não contam na
  v1 (decisão em aberto 1). Exemplos:
  - retirada na segunda 09/11/2026 → devolver até a sexta 27/11/2026;
  - retirada na sexta 13/11/2026 → devolver até a quinta 03/12/2026;
  - retirada no sábado 14/11/2026 → devolver até a quinta 03/12/2026.
- **Em atraso:** empréstimo aberto com `devolverAte` anterior a hoje.
- Datas trafegam como `AAAA-MM-DD`.

## 5. Autorização

Pelo [ADR-003](../../docs/adrs/adr-003-autorizacao-no-backend.md): o
`perfilId` sai **sempre** do token validado pelo guard, nunca do corpo da
requisição. A consulta "meus empréstimos" é um único método do service que
exige o `perfilId`.

## 6. Fora de escopo

Devolução · tela e rotas de Operações · reserva com data futura · notificação
por e-mail · renovação · cadastro de equipamento · feriados.

## 7. Critérios de aceite

1. O `devolverAte` é a retirada mais 14 dias úteis (segunda a sexta), com
   os três exemplos da §4.
2. Solicitar um equipamento disponível cria o empréstimo com a pessoa do
   token, a retirada de hoje e o `devolverAte` do CA-1; depois disso, o item
   aparece como `emprestado` em `GET /equipamentos`.
3. Equipamento em manutenção é recusado com 422 `EM_MANUTENCAO`, e nenhum
   empréstimo é criado.
4. Equipamento já emprestado é recusado com 409 `EQUIPAMENTO_INDISPONIVEL`.
5. Com 5 empréstimos em aberto, a pessoa é recusada com 422
   `LIMITE_ATINGIDO` e a mensagem "Você já está com 5 itens."; com 4, a
   solicitação passa.
6. Com um empréstimo em atraso, a pessoa é recusada com 422
   `BLOQUEADO_POR_ATRASO`.
7. Quando o banco recusa por corrida, a resposta é a mesma da regra: índice
   único violado → 409 `EQUIPAMENTO_INDISPONIVEL`; trigger de limite → 422
   `LIMITE_ATINGIDO`.
8. `GET /emprestimos/meus` devolve só os empréstimos em aberto da pessoa do
   token, com `devolverAte`, e nunca os de outra pessoa.
9. `GET /equipamentos` devolve cada equipamento com `imagemUrl` montada a
   partir do caminho da foto, e a `situacao` derivada como na §3.

**Conferência em produção**, feita pela pessoa com uma conta de teste dela
(a do professor fica com zero empréstimos):

- solicitar um disponível cria o empréstimo e tira o item do disponível;
- item em manutenção não pode ser solicitado;
- ao chegar a 5, a sexta solicitação é recusada com o motivo;
- a conta do professor continua com zero empréstimos.

## 8. Decisões em aberto

| # | Questão | Efeito |
|---|---|---|
| 1 | Feriados contam no prazo de 14 dias úteis? | hoje não; contar exige uma fonte de calendário e manutenção anual |
| 2 | Onde testar as invariantes do banco (índice único, triggers) em Postgres real? | sem banco de teste ([tests.md](../../docs/rules/tests.md), decisão 1), elas só são conferidas em produção; o service tem teste da tradução de cada recusa |
