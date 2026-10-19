import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { NaoAutenticado, SemPermissao } from "../comum/erros";
import { Papel } from "../comum/valores/papel";
import { GuardDePapel } from "./guard-de-papel";
import { USUARIO_NO_REQUEST } from "./guard-de-autenticacao";
import { UsuarioAutenticado } from "./usuario-autenticado";

const SUB = "3f1b9c4e-5a21-4d7b-9c88-0e2a6b7d1f40";

function usuarioCom(papel: Papel): UsuarioAutenticado {
  return UsuarioAutenticado.deClaims({
    sub: SUB,
    email: "ana@empresa.com.br",
    app_metadata: { papel },
  });
}

function contextoCom(usuario?: UsuarioAutenticado): ExecutionContext {
  const request: Record<string, unknown> = {};
  if (usuario) request[USUARIO_NO_REQUEST] = usuario;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function reflectorQueExige(papel: Papel | undefined): Reflector {
  return { getAllAndOverride: () => papel } as unknown as Reflector;
}

describe("GuardDePapel (BE-02 §8)", () => {
  it("deixa passar rota sem papel exigido, seja qual for o usuário", () => {
    const guard = new GuardDePapel(reflectorQueExige(undefined));

    expect(guard.canActivate(contextoCom(usuarioCom(Papel.Colaborador)))).toBe(true);
  });

  it("deixa Operações entrar em rota de Operações", () => {
    const guard = new GuardDePapel(reflectorQueExige(Papel.Operacoes));

    expect(guard.canActivate(contextoCom(usuarioCom(Papel.Operacoes)))).toBe(true);
  });

  it("barra Colaborador em rota de Operações", () => {
    const guard = new GuardDePapel(reflectorQueExige(Papel.Operacoes));

    expect(() => guard.canActivate(contextoCom(usuarioCom(Papel.Colaborador)))).toThrow(
      SemPermissao,
    );
  });

  it("recusa quando não há usuário no request", () => {
    const guard = new GuardDePapel(reflectorQueExige(Papel.Operacoes));

    expect(() => guard.canActivate(contextoCom())).toThrow(NaoAutenticado);
  });
});
