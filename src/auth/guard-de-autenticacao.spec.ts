import type { ExecutionContext } from "@nestjs/common";

import { NaoAutenticado } from "../comum/erros";
import { Papel } from "../comum/valores/papel";
import {
  GuardDeAutenticacao,
  USUARIO_NO_REQUEST,
} from "./guard-de-autenticacao";
import type { ClaimsDoToken } from "./usuario-autenticado";
import { VerificadorDeToken } from "./verificador-de-token";

const SUB = "3f1b9c4e-5a21-4d7b-9c88-0e2a6b7d1f40";

type Request = { headers: { authorization?: string } };

function contextoCom(authorization?: string): {
  contexto: ExecutionContext;
  request: Request;
} {
  const request: Request = { headers: { authorization } };
  const contexto = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { contexto, request };
}

class VerificadorQueAceita extends VerificadorDeToken {
  constructor(private readonly claims: ClaimsDoToken) {
    super();
  }
  async verificar(): Promise<ClaimsDoToken> {
    return this.claims;
  }
}

class VerificadorQueRecusa extends VerificadorDeToken {
  async verificar(): Promise<ClaimsDoToken> {
    throw new Error("assinatura inválida");
  }
}

describe("GuardDeAutenticacao (BE-02 §8)", () => {
  it("deixa passar e guarda o usuário quando o token é válido", async () => {
    const guard = new GuardDeAutenticacao(
      new VerificadorQueAceita({
        sub: SUB,
        email: "ana@empresa.com.br",
        app_metadata: { papel: "operacoes" },
      }),
    );
    const { contexto, request } = contextoCom("Bearer token-bom");

    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(Reflect.get(request, USUARIO_NO_REQUEST).papel).toBe(Papel.Operacoes);
  });

  it("aceita o esquema Bearer em qualquer caixa", async () => {
    const guard = new GuardDeAutenticacao(
      new VerificadorQueAceita({ sub: SUB, email: "ana@empresa.com.br" }),
    );
    const { contexto } = contextoCom("bearer token-bom");

    await expect(guard.canActivate(contexto)).resolves.toBe(true);
  });

  it.each([
    ["sem header Authorization", undefined],
    ["com header vazio", ""],
    ["com esquema errado", "Basic dXNlcjpzZW5oYQ=="],
    ["com Bearer sem token", "Bearer"],
  ])("recusa %s", async (_caso, header) => {
    const guard = new GuardDeAutenticacao(
      new VerificadorQueAceita({ sub: SUB, email: "ana@empresa.com.br" }),
    );
    const { contexto } = contextoCom(header);

    await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(NaoAutenticado);
  });

  it("recusa quando o verificador rejeita o token", async () => {
    const guard = new GuardDeAutenticacao(new VerificadorQueRecusa());
    const { contexto } = contextoCom("Bearer token-ruim");

    await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(NaoAutenticado);
  });

  it("devolve a mesma resposta para token ausente e para token inválido", async () => {
    const guard = new GuardDeAutenticacao(new VerificadorQueRecusa());

    const semHeader = await capturar(() => guard.canActivate(contextoCom().contexto));
    const tokenRuim = await capturar(() =>
      guard.canActivate(contextoCom("Bearer ruim").contexto),
    );

    expect(semHeader.mensagem).toBe(tokenRuim.mensagem);
    expect(semHeader.codigo).toBe(tokenRuim.codigo);
  });
});

/** Roda a ação esperando que ela falhe, e devolve o erro já tipado. */
async function capturar(acao: () => Promise<unknown>): Promise<NaoAutenticado> {
  try {
    await acao();
  } catch (erro) {
    if (erro instanceof NaoAutenticado) return erro;
    throw erro;
  }
  throw new Error("esperava NaoAutenticado, mas a ação passou");
}
