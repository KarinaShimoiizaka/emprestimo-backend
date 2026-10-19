# BE-01 — Backend

**Status:** proposta. `application/backend/` tem hoje apenas o `DockerFile` e
o `.env`; não há código.

**Contexto:** [ADR-001](../../../docs/adrs/adr-001-stack.md) (NestJS, Prisma, REST/MVC,
RLS), [PRD §7](../../../docs/prd.md) (regras), [BE-02](spec-autenticacao.md) (identidade).

---

## 1. Objetivo

Ser o único lugar onde as regras de empréstimo são aplicadas, e o único que
fala com o banco. O frontend não conhece SQL nem o Supabase Admin.

## 2. Estrutura

```
src/
├── main.ts
├── app.module.ts
├── prisma/            PrismaService + contexto de RLS por requisição
├── auth/              guard de JWT, decorator @Papel, validação via JWKS
├── perfil/            controller · service   (quem sou eu)
├── equipamentos/      controller · service   (acervo)
├── emprestimos/       controller · service   (solicitar, devolver, listar)
└── comum/             filtro de exceção, DTOs base, utilitários de data
```

Um módulo Nest por entidade. O controller só traduz HTTP; a regra mora no
service; o Prisma aparece só no service, nunca no controller.

## 3. Modelo de dados

```prisma
model Perfil {
  id          String       @id @db.Uuid          // = auth.users.id
  nome        String
  papel       Papel        @default(colaborador)
  criadoEm    DateTime     @default(now())
  emprestimos Emprestimo[]
}

model Equipamento {
  id          String            @id @default(uuid()) @db.Uuid
  nome        String
  categoria   Categoria
  patrimonio  String            @unique
  situacao    SituacaoFisica    @default(disponivel)
  observacao  String?
  criadoEm    DateTime          @default(now())
  emprestimos Emprestimo[]
}

model Emprestimo {
  id            String      @id @default(uuid()) @db.Uuid
  equipamento   Equipamento @relation(fields: [equipamentoId], references: [id])
  equipamentoId String      @db.Uuid
  perfil        Perfil      @relation(fields: [perfilId], references: [id])
  perfilId      String      @db.Uuid
  retiradaEm    DateTime    @default(now())
  devolverAte   DateTime
  devolvidoEm   DateTime?
}

enum Papel          { colaborador operacoes }
enum Categoria      { notebook monitor cabo camera acessorio }
enum SituacaoFisica { disponivel manutencao }
```

### A decisão que mais importa aqui

`SituacaoFisica` tem **dois** valores, não três. "Emprestado" não é um estado
guardado no equipamento: é a existência de um `Emprestimo` com
`devolvidoEm = null`.

Guardar `emprestado` na tabela criaria duas fontes de verdade que precisam
concordar. Toda falha parcial — a transação grava o empréstimo e morre antes
de atualizar o equipamento — produz um item que a tela diz estar livre e o
banco diz que não. Derivar custa um `join`, e o acervo é pequeno.

A API continua expondo três situações (`disponivel`, `emprestado`,
`manutencao`); a derivação é detalhe interno.

### Invariantes no banco

Escritas em migration, junto do esquema:

```sql
-- Um equipamento não pode ter dois empréstimos abertos.
create unique index emprestimo_aberto_unico
  on emprestimo (equipamento_id)
  where devolvido_em is null;

-- Prazo nunca é anterior à retirada.
alter table emprestimo
  add constraint prazo_coerente check (devolver_ate > retirada_em);

-- Item em manutenção não pode ser emprestado: trigger que recusa o insert.
-- Limite de 3 por pessoa: trigger que conta os abertos antes do insert.
```

O limite de 3 e a trava de manutenção também são verificados no service, para
devolver um erro legível. A checagem no banco é a rede de segurança contra
corrida entre duas requisições simultâneas; a do service é a que gera a
mensagem.

## 4. Endpoints

Base: `/api`. Todos exigem `Authorization: Bearer <token>`.

| Método | Rota | Papel | O que faz |
|---|---|---|---|
| GET | `/perfil/eu` | qualquer | nome, e-mail e papel do usuário |
| GET | `/equipamentos` | qualquer | acervo, com situação derivada |
| POST | `/equipamentos` | operacoes | cadastra item |
| GET | `/emprestimos/meus` | qualquer | os abertos do próprio usuário |
| GET | `/emprestimos` | operacoes | todos os abertos |
| POST | `/emprestimos` | qualquer | solicita empréstimo |
| POST | `/emprestimos/:id/devolucao` | dono ou operacoes | registra devolução |

### GET /equipamentos

Sem parâmetros: busca e filtro são do cliente (ver [FE-02 §5.3](../../frontend/specs/spec-catalogo.md)).

```json
[
  {
    "id": "...",
    "nome": "MacBook Pro 14 M3",
    "categoria": "notebook",
    "patrimonio": "TI-0088",
    "situacao": "emprestado",
    "observacao": null,
    "emprestimo": { "pessoa": "Marcos Lemos", "devolverAte": "2026-09-07" }
  }
]
```

`emprestimo` é `null` quando o item não está emprestado. Expor o **nome** de
quem está com o item é intencional: o PRD pede isso no card. Nenhum outro
dado da pessoa vai junto.

### POST /emprestimos

```json
// requisição
{ "equipamentoId": "..." }

// 201
{
  "id": "...",
  "equipamentoId": "...",
  "retiradaEm": "2026-08-31",
  "devolverAte": "2026-09-14"
}
```

`devolverAte` é `retiradaEm + 14 dias`, calculado **no servidor**. O cliente
não envia data.

### POST /emprestimos/:id/devolucao

Grava `devolvidoEm = now()`. Idempotente: devolver o que já foi devolvido
responde 200 com o registro, não 409 — dois cliques no balcão não podem virar
erro.

## 5. Onde cada regra do PRD é aplicada

| Regra | Camada |
|---|---|
| 1. Prazo de 14 dias | service, no cálculo de `devolverAte` |
| 4. Limite de 3 itens | service (mensagem) + trigger (corrida) |
| 5. Atraso bloqueia | service, ao solicitar |
| 6. Manutenção nunca disponível | service + trigger |
| 7. Item já emprestado | índice único parcial |
| 8. Busca | cliente |
| 9. Filtros | cliente |
| 10. Nome obrigatório no cadastro | DTO com `class-validator` |
| 11. Escopo por pessoa | RLS + guard |

## 6. Autorização

Duas camadas, e as duas precisam existir.

**Guards do Nest** decidem se a rota pode ser chamada: um decorator
`@Papel("operacoes")` nos endpoints de Operações.

**RLS no Postgres** decide quais linhas a consulta enxerga:

```sql
alter table emprestimo enable row level security;

create policy emprestimo_proprio on emprestimo for select
  using (perfil_id = (auth.jwt() ->> 'sub')::uuid);

create policy emprestimo_operacoes on emprestimo for select
  using (auth.jwt() -> 'app_metadata' ->> 'papel' = 'operacoes');
```

### A armadilha do Prisma com RLS

O Prisma conecta com **um** usuário de banco. Se esse usuário for dono das
tabelas ou tiver `BYPASSRLS`, as políticas nunca são avaliadas e o RLS vira
enfeite. Para valer:

1. A aplicação usa um usuário sem privilégio de bypass e que não é dono das
   tabelas.
2. Cada requisição roda dentro de uma transação que define o contexto antes
   das consultas, com `set_config('request.jwt.claims', <claims>, true)` a
   partir do token já validado pelo Nest.
3. As políticas nascem em migration, não no painel do Supabase.

Isso precisa estar de pé no esqueleto. Se o custo se mostrar maior que o
descrito, a saída prevista pelo ADR-001 é assumir autorização só nos guards e
registrar isso como ADR-003 — não manter políticas que nunca rodam.

## 7. Erros

Formato único, de um `ExceptionFilter` global:

```json
{ "erro": "LIMITE_ATINGIDO", "mensagem": "Você já está com 3 itens.", "status": 422 }
```

| Código | HTTP | Quando |
|---|---|---|
| `NAO_AUTENTICADO` | 401 | token ausente, inválido ou expirado |
| `SEM_PERMISSAO` | 403 | papel insuficiente |
| `NAO_ENCONTRADO` | 404 | id inexistente, ou invisível por RLS |
| `EQUIPAMENTO_INDISPONIVEL` | 409 | outra pessoa pegou primeiro |
| `LIMITE_ATINGIDO` | 422 | já tem 3 abertos |
| `BLOQUEADO_POR_ATRASO` | 422 | tem item vencido |
| `EM_MANUTENCAO` | 422 | item não é emprestável |
| `PATRIMONIO_DUPLICADO` | 409 | patrimônio já existe |
| `DADOS_INVALIDOS` | 422 | falhou na validação do DTO |

Um id que existe mas o RLS esconde responde **404**, não 403: 403 confirmaria
a existência do registro.

## 8. Configuração

Variáveis lidas de `application/backend/.env` (nomes, nunca valores neste
documento): `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_JWKS_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `STORAGE_NAME`, `PORT`.

`DATABASE_URL` aponta para o usuário **sem** bypass de RLS. `DIRECT_URL` é
usada pelo Prisma Migrate e pode ter mais privilégio.

## 9. Testes

Jest, como o ADR-001 fixou. O que precisa de teste, em ordem de valor:

1. **Unitário do service de empréstimos** — as cinco regras, cada uma com o
   caso que passa e o que falha. É aqui que mora o produto.
2. **Integração com banco real** (container de teste) — que o índice único
   barra o segundo empréstimo do mesmo item e que o trigger barra o quarto
   item da mesma pessoa.
3. **Que o RLS está mesmo ligado** — conectar como o usuário da aplicação e
   confirmar que um `select` sem contexto não devolve nada. Este teste é o
   que impede o modo de falha silencioso da §6.

## 10. Fora de escopo

Reserva com data futura · notificação por e-mail · importação de planilha ·
upload de foto · histórico e relatórios · edição e exclusão de equipamento ·
paginação · webhooks · versionamento da API.

## 11. Decisões em aberto

| # | Questão | Efeito |
|---|---|---|
| 1 | O `STORAGE_NAME` no `.env` sugere Supabase Storage. Vai ter foto de equipamento? | entra campo, upload e política de bucket |
| 2 | Quem cria a linha em `Perfil`: trigger no Supabase ou primeiro login? | muda o fluxo da BE-02 §4 |
| 3 | Devolução com atraso registra algo além da data? | hoje o atraso some assim que devolve; talvez interesse guardar |
| 4 | Operações pode cancelar um empréstimo (item sumiu, foi quebrado)? | nasce um estado novo no empréstimo |
