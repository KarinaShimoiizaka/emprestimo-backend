import { Controller, Get, UseGuards } from "@nestjs/common";

import { GuardDeAutenticacao } from "../auth/guard-de-autenticacao";
import { GuardDePapel } from "../auth/guard-de-papel";
import { UsuarioAtual } from "../auth/usuario-atual.decorator";
import { UsuarioAutenticado } from "../auth/usuario-autenticado";
import { PerfilDaPessoa, PerfilService } from "./perfil.service";

@Controller("perfil")
@UseGuards(GuardDeAutenticacao, GuardDePapel)
export class PerfilController {
  constructor(private readonly perfis: PerfilService) {}

  /** GET /api/perfil/eu — quem sou eu, e cria o perfil no primeiro acesso. */
  @Get("eu")
  eu(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<PerfilDaPessoa> {
    return this.perfis.provisionar(usuario);
  }
}
