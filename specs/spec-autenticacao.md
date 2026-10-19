# BE-02 — Autenticação e identidade

**Status:** implementada. O código está em `application/backend/src/auth/`,
`src/perfil/` e `src/comum/`.

**Contexto:** [ADR-001](../../../docs/adrs/adr-001-stack.md) (Supabase Auth + RLS),
[BE-01](spec-backend.md) (backend).
**Lado do cliente:** [FE-03](../../frontend/specs/spec-login.md) — a tela de login.

> **Decisão tomada em 28/09/2026: não há cadastro na v1.** As contas são
> criadas à mão no painel do Supabase. Isso apagou desta spec o fluxo de
> auto-cadastro, a validação de domínio de e-mail e os erros associados.

---

## 1. Objetivo

Saber quem é a pessoa e o que ela pode fazer, para que as duas perguntas do
produto tenham resposta: "quais empréstimos são meus?" e "esta pessoa pode
cadastrar equipamento?".

## 2. Papéis

| Papel | Pode |
|---|---|
| `colaborador` | ver o catálogo, solicitar, devolver os próprios itens |
| `operacoes` | tudo isso, mais: ver todos os empréstimos, registrar devolução de terceiros, cadastrar equipamento |

O papel é **atributo da pessoa**, não algo escolhido na tela de login. Quem é
de Operações entra com o próprio e-mail e recebe as abas a mais.

## 3. Onde a identidade vive

Supabase Auth é dono de e-mail, senha, sessão e recuperação de acesso. O
banco da aplicação guarda o que o Supabase não sabe:

```
auth.users            (Supabase, não mexemos)
  id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data

perfil                (nosso — ver BE-01 §3)
  id        uuid  PK, = auth.users.id
  nome      text  not null
  papel     text  not null  check (papel in ('colaborador','operacoes'))
  criado_em timestamptz default now()
```

O `papel` é espelhado em `app_metadata` do usuário no Supabase, para que ele
**apareça dentro do JWT**. Sem isso, uma política de RLS teria de fazer
`select` em `perfil` a cada linha avaliada; e `app_metadata`, diferente de
`user_metadata`, não é editável pelo próprio usuário.

**Consequência assumida:** trocar o papel de alguém exige atualizar os dois
lugares, e o novo papel só vale no próximo token.

## 4. Provisionamento de contas

Não existe tela nem endpoint de cadastro. Uma conta nasce assim:

1. Alguém com acesso ao painel do Supabase cria o usuário com e-mail e senha.
2. Em **User Metadata**, define `nome`. É o que aparece na barra de navegação
   e na tabela de Operações.
3. Em **App Metadata**, define `papel` como `colaborador` ou `operacoes`.
   Ausente vale como `colaborador`.

### Quem cria a linha em `perfil`

**O backend, no primeiro request autenticado da pessoa** — um `upsert` por
`id`, a partir das claims do token já validado.

A alternativa era um trigger em `auth.users`. Foi descartada porque o trigger
vive no schema do Supabase, fora das nossas migrations, e
[migrations.md](../../../docs/rules/migrations.md) diz que o que não está em
migration não existe para o projeto. O `upsert` fica no nosso código, é
testável, e roda em uma transação que já existe.

**Custo aceito:** o `nome` em `perfil` é uma cópia do que está no Supabase.
Se alguém mudar o nome no painel, a cópia se atualiza no próximo request —
o `upsert` reescreve o campo a cada entrada.

## 5. Validação de token

Todo request traz `Authorization: Bearer <access_token>`.

O guard valida a assinatura contra o JWKS do Supabase (`SUPABASE_JWKS_URL`) e
**nunca** decodifica sem verificar. Do token saem:

| Claim | Uso |
|---|---|
| `sub` | id do perfil, usado no RLS e nas consultas |
| `email` | identificação |
| `user_metadata.nome` | nome exibido; na falta, a parte local do e-mail |
| `app_metadata.papel` | decisão dos guards e das políticas; na falta, `colaborador` |
| `exp` | expiração; vencido responde 401 |

As claims validadas são injetadas no contexto da transação de banco
(`request.jwt.claims`) — o mecanismo está em [BE-01 §6](spec-backend.md).

## 6. Sessão

| Item | Decisão |
|---|---|
| Duração do access token | 1 hora |
| Renovação | refresh token, pelo SDK do Supabase no cliente |
| Logout | encerra a sessão no Supabase |
| Expirada durante o uso | 401 na próxima chamada |

O backend é sem estado: não guarda sessão, não tem lista de revogados.

## 7. Endpoints

| Método | Rota | Papel | O que faz |
|---|---|---|---|
| GET | `/api/perfil/eu` | qualquer | devolve id, nome, e-mail e papel; cria o perfil se for o primeiro acesso |

Login, logout e recuperação de senha **não passam pelo backend** — o
navegador fala direto com o Supabase Auth. O backend só verifica o token que
sai de lá.

## 8. Erros

| Situação | HTTP | Código | Mensagem devolvida |
|---|---|---|---|
| Header `Authorization` ausente ou malformado | 401 | `NAO_AUTENTICADO` | `Sua sessão expirou.` |
| Assinatura inválida, emissor errado ou token vencido | 401 | `NAO_AUTENTICADO` | `Sua sessão expirou.` |
| Papel insuficiente para a rota | 403 | `SEM_PERMISSAO` | `Você não tem acesso a esta área.` |

Todas as falhas de token colapsam em **uma** resposta. Distinguir "assinatura
inválida" de "expirado" não ajuda quem usa e ajuda quem ataca.

Os erros de login (senha errada, e-mail inexistente) são do Supabase e
aparecem no cliente — ver [FE-03 §5](../../frontend/specs/spec-login.md).

## 9. Fora de escopo

Cadastro pela aplicação · login social · SSO · MFA · convite por link ·
endpoint de administração de usuários · troca de papel pela API · bloqueio
por tentativas repetidas (o Supabase já aplica limite próprio).

## 10. Decisões em aberto

| # | Questão | Efeito |
|---|---|---|
| 1 | ~~Auto-cadastro ou conta criada por Operações?~~ | **resolvida:** sem cadastro na v1 |
| 2 | ~~Quem cria a linha em `perfil`?~~ | **resolvida:** o backend, no primeiro request (§4) |
| 3 | **Como alguém vira Operações?** Hoje: à mão, no painel. | se for pela interface, nasce tela e endpoint novos |
| 4 | Recuperação de senha entra na v1? | hoje não há tela; a pessoa pede reset a quem administra o painel |
| 5 | O `nome` deve poder ser editado pela pessoa? | hoje é só leitura, vindo do painel |
