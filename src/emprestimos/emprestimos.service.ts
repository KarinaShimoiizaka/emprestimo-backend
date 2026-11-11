import { Injectable } from "@nestjs/common";

import { UsuarioAutenticado } from "../auth/usuario-autenticado";
import {
  BloqueadoPorAtraso,
  EmManutencao,
  EquipamentoIndisponivel,
  EquipamentoNaoEncontrado,
  LimiteAtingido,
} from "../comum/erros";
import { PerfilService } from "../perfil/perfil.service";
import { LIMITE_POR_PESSOA, PRAZO_EM_DIAS_UTEIS, emAtraso, hojeEm, somarDiasUteis } from "./datas";
import { FotosPublicas } from "./fotos-publicas";
import { Relogio } from "./relogio";
import { RepositorioDeEmprestimos } from "./repositorio-de-emprestimos";

export type SituacaoNoCatalogo = "disponivel" | "emprestado" | "manutencao";

export type EquipamentoNoCatalogo = {
  id: string;
  patrimonio: string;
  nome: string;
  categoria: string;
  situacao: SituacaoNoCatalogo;
  observacao: string | null;
  imagemUrl: string | null;
  emprestimo: { pessoa: string; devolverAte: string; comVoce: boolean } | null;
};

export type EmprestimoCriado = {
  id: string;
  equipamentoId: string;
  retiradaEm: string;
  devolverAte: string;
};

export type MeuEmprestimo = {
  id: string;
  retiradaEm: string;
  devolverAte: string;
  equipamento: {
    id: string;
    patrimonio: string;
    nome: string;
    categoria: string;
    imagemUrl: string | null;
  };
};

/**
 * Regras de solicitar empréstimo (BE-04). O `perfilId` sai sempre do usuário
 * autenticado, nunca da requisição (ADR-003).
 */
@Injectable()
export class EmprestimosService {
  constructor(
    private readonly repositorio: RepositorioDeEmprestimos,
    private readonly perfis: PerfilService,
    private readonly fotos: FotosPublicas,
    private readonly relogio: Relogio,
  ) {}

  /** GET /equipamentos: o acervo com a situação derivada (BE-04 §3). */
  async catalogo(usuario: UsuarioAutenticado): Promise<EquipamentoNoCatalogo[]> {
    const perfilId = usuario.id.toString();
    const itens = await this.repositorio.equipamentos();
    return itens.map((e) => ({
      id: e.id,
      patrimonio: e.patrimonio,
      nome: e.nome,
      categoria: e.categoria,
      situacao: e.situacao === "manutencao" ? "manutencao" : e.emprestimoAberto ? "emprestado" : "disponivel",
      observacao: e.observacao,
      imagemUrl: this.fotos.url(e.imagemCaminho),
      emprestimo: e.emprestimoAberto
        ? {
            pessoa: e.emprestimoAberto.pessoa,
            devolverAte: e.emprestimoAberto.devolverAte,
            comVoce: e.emprestimoAberto.perfilId === perfilId,
          }
        : null,
    }));
  }

  /** POST /emprestimos: confere as regras na ordem da BE-04 §3 e cria. */
  async solicitar(usuario: UsuarioAutenticado, equipamentoId: string): Promise<EmprestimoCriado> {
    await this.perfis.provisionar(usuario);
    const perfilId = usuario.id.toString();
    const hoje = hojeEm(this.relogio.agora());

    const equipamento = await this.repositorio.equipamento(equipamentoId);
    if (!equipamento) throw new EquipamentoNaoEncontrado();
    if (equipamento.situacao === "manutencao") throw new EmManutencao();
    if (equipamento.emprestimoAberto) throw new EquipamentoIndisponivel();

    const abertos = await this.repositorio.abertosDe(perfilId);
    if (abertos.some((a) => emAtraso(a.devolverAte, hoje))) throw new BloqueadoPorAtraso();
    if (abertos.length >= LIMITE_POR_PESSOA) throw new LimiteAtingido();

    const devolverAte = somarDiasUteis(hoje, PRAZO_EM_DIAS_UTEIS);
    const { id } = await this.repositorio.criar({ equipamentoId, perfilId, retiradaEm: hoje, devolverAte });
    return { id, equipamentoId, retiradaEm: hoje, devolverAte };
  }

  /** GET /emprestimos/meus: só os abertos da pessoa do token (BE-04 §3). */
  async meus(usuario: UsuarioAutenticado): Promise<MeuEmprestimo[]> {
    const abertos = await this.repositorio.abertosDe(usuario.id.toString());
    return abertos.map((a) => ({
      id: a.id,
      retiradaEm: a.retiradaEm,
      devolverAte: a.devolverAte,
      equipamento: {
        id: a.equipamento.id,
        patrimonio: a.equipamento.patrimonio,
        nome: a.equipamento.nome,
        categoria: a.equipamento.categoria,
        imagemUrl: this.fotos.url(a.equipamento.imagemCaminho),
      },
    }));
  }
}
