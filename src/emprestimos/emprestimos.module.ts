import { Module } from "@nestjs/common";

import { PerfilModule } from "../perfil/perfil.module";
import { EmprestimosController } from "./emprestimos.controller";
import { EmprestimosService } from "./emprestimos.service";
import { FotosPublicas } from "./fotos-publicas";
import { Relogio, RelogioDoSistema } from "./relogio";
import { RepositorioDeEmprestimos } from "./repositorio-de-emprestimos";
import { RepositorioPrismaDeEmprestimos } from "./repositorio-prisma-de-emprestimos";

@Module({
  imports: [PerfilModule],
  controllers: [EmprestimosController],
  providers: [
    EmprestimosService,
    FotosPublicas,
    { provide: RepositorioDeEmprestimos, useClass: RepositorioPrismaDeEmprestimos },
    { provide: Relogio, useClass: RelogioDoSistema },
  ],
})
export class EmprestimosModule {}
