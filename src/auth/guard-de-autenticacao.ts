import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { NaoAutenticado } from "../comum/erros";
import { UsuarioAutenticado } from "./usuario-autenticado";
import { VerificadorDeToken } from "./verificador-de-token";

/** Onde o usuário fica no request, para os decorators lerem depois. */
export const USUARIO_NO_REQUEST = "usuarioAutenticado";

/**
 * Exige um Bearer token válido. Qualquer falha — header ausente, formato
 * errado, assinatura inválida, expirado — vira o mesmo `NaoAutenticado`
 * (BE-02 §8).
 */
@Injectable()
export class GuardDeAutenticacao implements CanActivate {
  constructor(private readonly verificador: VerificadorDeToken) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const request = contexto.switchToHttp().getRequest<Request>();
    const token = tokenDoHeader(request.headers.authorization);

    try {
      const claims = await this.verificador.verificar(token);
      Reflect.set(request, USUARIO_NO_REQUEST, UsuarioAutenticado.deClaims(claims));
      return true;
    } catch {
      throw new NaoAutenticado();
    }
  }
}

function tokenDoHeader(header: string | undefined): string {
  if (!header) throw new NaoAutenticado();

  const [esquema, valor] = header.split(" ");
  if (esquema?.toLowerCase() !== "bearer" || !valor) {
    throw new NaoAutenticado();
  }
  return valor;
}
