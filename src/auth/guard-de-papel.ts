import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { NaoAutenticado, SemPermissao } from "../comum/erros";
import { USUARIO_NO_REQUEST } from "./guard-de-autenticacao";
import { PAPEL_EXIGIDO } from "./papel.decorator";
import { UsuarioAutenticado } from "./usuario-autenticado";
import { Papel } from "../comum/valores/papel";

/**
 * Roda depois do guard de autenticação. Rota sem `@ExigePapel` passa direto;
 * com ele, só passa quem tem exatamente aquele papel.
 */
@Injectable()
export class GuardDePapel implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const exigido = this.reflector.getAllAndOverride<Papel | undefined>(
      PAPEL_EXIGIDO,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (!exigido) return true;

    const request = contexto.switchToHttp().getRequest<Request>();
    const usuario = Reflect.get(request, USUARIO_NO_REQUEST) as
      | UsuarioAutenticado
      | undefined;

    if (!usuario) throw new NaoAutenticado();
    if (usuario.papel !== exigido) throw new SemPermissao();

    return true;
  }
}
