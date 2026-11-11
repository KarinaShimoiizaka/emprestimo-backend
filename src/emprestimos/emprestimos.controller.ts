import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { IsUUID } from "class-validator";

import { GuardDeAutenticacao } from "../auth/guard-de-autenticacao";
import { GuardDePapel } from "../auth/guard-de-papel";
import { UsuarioAtual } from "../auth/usuario-atual.decorator";
import { UsuarioAutenticado } from "../auth/usuario-autenticado";
import {
  EmprestimoCriado,
  EmprestimosService,
  EquipamentoNoCatalogo,
  MeuEmprestimo,
} from "./emprestimos.service";

export class SolicitarEmprestimoDto {
  @IsUUID()
  equipamentoId!: string;
}

/** Rotas da BE-04 §3. Qualquer papel autenticado. */
@Controller()
@UseGuards(GuardDeAutenticacao, GuardDePapel)
export class EmprestimosController {
  constructor(private readonly emprestimos: EmprestimosService) {}

  /** GET /api/equipamentos */
  @Get("equipamentos")
  catalogo(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<EquipamentoNoCatalogo[]> {
    return this.emprestimos.catalogo(usuario);
  }

  /** POST /api/emprestimos */
  @Post("emprestimos")
  solicitar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() corpo: SolicitarEmprestimoDto,
  ): Promise<EmprestimoCriado> {
    return this.emprestimos.solicitar(usuario, corpo.equipamentoId);
  }

  /** GET /api/emprestimos/meus */
  @Get("emprestimos/meus")
  meus(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<MeuEmprestimo[]> {
    return this.emprestimos.meus(usuario);
  }
}
