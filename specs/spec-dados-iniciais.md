# BE-03 — Dados iniciais

**Status:** pronta. Aprovada em 11/11/2026; veredito `PRONTA` do
verificador-spec na rodada 2 (`docs/verificacoes/`, no repositório da raiz).
Aplicação em produção: ver §8, "Conferência em produção".

**Contexto:** briefing "dados iniciais" da prática; [BE-01 §3](spec-backend.md)
(modelo de dados); [BE-02 §4](spec-autenticacao.md) (como uma conta nasce);
[ADR-002](../../docs/adrs/adr-002-imagens-equipamentos.md) (fotos).
**Depende de:** a skill `imagens-equipamentos` (fotos já publicadas no bucket;
manifesto em `imagens/manifesto.json`, no repositório da raiz).

---

## 1. Objetivo

O sistema em produção passa a ter os 12 equipamentos da prática, cada um com
foto, e a conta do professor para entrar e testar. Nenhum empréstimo é criado.

## 2. O que muda no banco

A tabela `equipamento` nasce como a BE-01 §3 descreve, mais os campos da foto:

| campo | tipo | de onde vem |
|---|---|---|
| `id` | uuid | gerado |
| `nome` | texto | lista da prática |
| `categoria` | enum `categoria` (`notebook`, `monitor`, `cabo`, `camera`, `acessorio`) | lista da prática |
| `patrimonio` | texto, **único** | lista da prática |
| `situacao` | enum `situacao_fisica` (`disponivel`, `manutencao`) | lista da prática (§3) |
| `observacao` | texto, opcional | vazio nesta fase |
| `imagem_caminho` | texto | `equipamentos/<patrimônio>.jpg`, o caminho no bucket |
| `imagem_autor` | texto | crédito da foto (manifesto) |
| `imagem_origem` | texto | página da foto no Pixabay (manifesto) |
| `imagem_licenca` | texto | licença da foto (manifesto) |
| `criado_em` | timestamp | gerado |

- **Campos da foto opcionais no banco.** O cadastro pela interface (PRD)
  não tem campo de foto; exigir no banco quebraria esse cadastro quando ele
  existir. Os 12 da §3 sempre têm foto e crédito (CA-3).
- **Caminho, não URL.** O endereço do projeto no Supabase já mudou uma vez;
  o caminho dentro do bucket continua valendo. A URL pública é montada na
  hora de exibir, a partir do `SUPABASE_URL` e do `STORAGE_NAME`.
- **"Emprestado" não é situação guardada** (BE-01 §3): será a existência de
  um empréstimo aberto, na fase 4.
- **RLS ligado e sem política**, como em `perfil`: a API pública do Supabase
  não lê nem escreve `equipamento`; só o backend, pela conexão direta.
- **A tabela `emprestimo` não entra aqui.** Ela nasce na spec de solicitar
  empréstimo (fase 4), junto com o limite por pessoa, que ainda está em
  decisão.

Isso resolve a decisão em aberto 1 da BE-01 ("vai ter foto de
equipamento?"): vai, guardada como caminho no bucket, sem upload pela API.

## 3. Os 12 equipamentos

A lista da prática, sem alteração de patrimônio, nome ou categoria:

| patrimônio | nome | categoria | situação |
|---|---|---|---|
| TI-0001 | Notebook 14 polegadas | notebook | disponivel |
| TI-0002 | Notebook 15 polegadas | notebook | disponivel |
| TI-0003 | Notebook 13 polegadas | notebook | disponivel |
| TI-0004 | Notebook 15 polegadas | notebook | **manutencao** |
| TI-0005 | Monitor 24 polegadas | monitor | disponivel |
| TI-0006 | Monitor 27 polegadas | monitor | disponivel |
| TI-0007 | Monitor 22 polegadas | monitor | **manutencao** |
| TI-0008 | Cabo HDMI 2 m | cabo | disponivel |
| TI-0009 | Cabo USB-C 1 m | cabo | disponivel |
| TI-0010 | Cabo de rede 3 m | cabo | **manutencao** |
| TI-0011 | Webcam Full HD | camera | disponivel |
| TI-0012 | Câmera compacta | camera | disponivel |

**Três em manutenção, não dois.** O briefing diz "TI-0004 e TI-0007 em
manutenção; os outros 10 disponíveis", mas a lista da prática ("use
exatamente esta") também marca o TI-0010. Vale a lista.

Os dados ficam em `backend/prisma/dados/equipamentos.json`: os campos acima
mais a foto e o crédito de cada um, copiados do manifesto da skill. O
backend não lê nada fora do próprio repositório.

## 4. O seed

- Arquivo `backend/prisma/seed.ts`, que só liga o Prisma ao arquivo de
  dados. A regra mora em `backend/src/dados-iniciais/`, testável sem banco.
- **Rodar de novo não duplica:** `upsert` por `patrimonio`. O que falta é
  criado; o que existe é atualizado para o que está no arquivo (nome,
  categoria, situação e foto). Nada é apagado.
- **Só escreve em `equipamento`.** Não cria usuário, perfil nem empréstimo.
- Quem roda em produção é a pessoa (§6).

## 5. A conta do professor

**Criada pela pessoa, no painel do Supabase, como a BE-02 §4 já define, e
não pelo seed.** Assim a senha não passa por código, arquivo nem git. O
briefing pedia a senha escrita no arquivo do seed; isso contraria a regra da
prática ("nenhuma senha em código ou no histórico do git") e o
[secrets.md](../../docs/rules/secrets.md).

| atributo | valor |
|---|---|
| e-mail | `marcelo.grilo@institutojef.org.br` |
| senha | a senha padrão da turma (só no painel) |
| e-mail confirmado | sim (criada com "Auto Confirm User") |
| `user_metadata.nome` | `Marcelo Grilo` |
| `app_metadata.papel` | `colaborador` |

**Uma conta, papel colaborador.** O papel `operacoes` incluiria o que o
colaborador faz, mas as telas de Operações e Equipamentos não existem e
estão fora de escopo na fase 4. Com `operacoes`, a navegação mostraria duas
abas que não levam a lugar nenhum (FE-03, CA-7). Duas contas não são
possíveis com o mesmo e-mail.

A linha em `perfil` é criada pelo backend no primeiro request autenticado
(BE-02 §4). A conta começa com zero empréstimos: a tabela de empréstimo nem
existe nesta fase.

## 6. Quem faz o quê

| passo | quem |
|---|---|
| escrever `schema.prisma`, a migration e o seed | agente |
| aplicar a migration em produção: `npm run prisma -- migrate deploy` | pessoa |
| rodar o seed em produção: `npm run seed` | pessoa |
| criar a conta do professor no painel | pessoa |
| conferir em produção (§8) | pessoa |

## 7. Fora de escopo

Tela de catálogo · cadastro de equipamento pela interface · importação da
planilha · tabela e regras de empréstimo · endpoints novos · criação de
conta por código.

## 8. Critérios de aceite

1. O arquivo de dados tem exatamente os 12 equipamentos da §3, com
   patrimônio, nome e categoria iguais aos da lista da prática e patrimônio
   sem repetição.
2. TI-0004, TI-0007 e TI-0010 estão em `manutencao`; os outros 9, em
   `disponivel`.
3. Cada equipamento tem `imagem_caminho` igual a
   `equipamentos/<patrimônio>.jpg`, e `imagem_autor`, `imagem_origem` e
   `imagem_licenca` preenchidos.
4. Rodar o seed sobre uma base vazia cria os 12.
5. Rodar o seed de novo não cria nenhum registro novo: atualiza os 12
   existentes para o que está no arquivo.
6. O seed só escreve em `equipamento`: não cria usuário, perfil nem
   empréstimo.

**Conferência em produção**, feita pela pessoa e registrada no `ENTREGA.md`
(não é critério do verificador, que não acessa produção):

- `marcelo.grilo@institutojef.org.br` entra no link da Vercel com a senha
  padrão;
- os 12 equipamentos estão no banco do deploy, com a foto e a situação da §3;
- as fotos abrem pela URL pública, sem login, em 800×600;
- rodar o seed de novo não duplicou nada.

## 9. Decisões em aberto

| # | Questão | Efeito |
|---|---|---|
| 1 | Onde testar o `patrimonio` único e o RLS ligado em Postgres real? | o `tests.md` (decisão 1) ainda não definiu o banco de teste; até lá, essas garantias do banco não têm teste automatizado, só a conferência em produção |
| 2 | A tela do catálogo mostra o crédito da foto? | o contrato da skill pede crédito na tela; o briefing da fase 4 pede o catálogo sem crédito. Decide-se na fase 4; os campos já existem |
