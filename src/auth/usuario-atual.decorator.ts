import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { USUARIO_NO_REQUEST } from "./guard-de-autenticacao";
import { UsuarioAutenticado } from "./usuario-autenticado";

/** `@UsuarioAtual() usuario: UsuarioAutenticado` no controller. */
export const UsuarioAtual = createParamDecorator(
  (_dado: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const request = contexto.switchToHttp().getRequest<Request>();
    return Reflect.get(request, USUARIO_NO_REQUEST) as UsuarioAutenticado;
  },
);
