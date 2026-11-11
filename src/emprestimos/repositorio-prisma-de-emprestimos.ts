import { Injectable } from "@nestjs/common";

import { EmManutencao, EquipamentoIndisponivel, LimiteAtingido } from "../comum/erros";
import { PrismaService } from "../prisma/prisma.service";
import { deData, paraData } from "./datas";
import {
  EmprestimoAberto,
  EquipamentoComEmprestimo,
  NovoEmprestimo,
  RepositorioDeEmprestimos,
  SituacaoFisica,
} from "./repositorio-de-emprestimos";

const SO_ABERTOS = { devolvidoEm: null } as const;

const COM_EMPRESTIMO_ABERTO = {
  emprestimos: {
    where: SO_ABERTOS,
    select: { perfilId: true, devolverAte: true, perfil: { select: { nome: true } } },
  },
} as const;

type LinhaDeEquipamento = {
  id: string;
  patrimonio: string;
  nome: string;
  categoria: string;
  situacao: string;
  observacao: string | null;
  imagemCaminho: string | null;
  emprestimos: Array<{ perfilId: string; devolverAte: Date; perfil: { nome: string } }>;
};

function paraEquipamento(linha: LinhaDeEquipamento): EquipamentoComEmprestimo {
  const aberto = linha.emprestimos[0];
  return {
    id: linha.id,
    patrimonio: linha.patrimonio,
    nome: linha.nome,
    categoria: linha.categoria,
    situacao: linha.situacao as SituacaoFisica,
    observacao: linha.observacao,
    imagemCaminho: linha.imagemCaminho,
    emprestimoAberto: aberto
      ? { perfilId: aberto.perfilId, pessoa: aberto.perfil.nome, devolverAte: deData(aberto.devolverAte) }
      : null,
  };
}

/**
 * Traduz a recusa do banco (corrida entre pedidos) para o mesmo erro que a
 * regra do service daria (BE-04 §3, CA-7). Qualquer outra falha segue adiante.
 */
export function traduzirRecusaDoBanco(erro: unknown): never {
  const codigo = (erro as { code?: unknown })?.code;
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  if (codigo === "P2002") throw new EquipamentoIndisponivel();
  if (mensagem.includes("LIMITE_ATINGIDO")) throw new LimiteAtingido();
  if (mensagem.includes("EM_MANUTENCAO")) throw new EmManutencao();
  throw erro;
}

@Injectable()
export class RepositorioPrismaDeEmprestimos extends RepositorioDeEmprestimos {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async equipamentos(): Promise<EquipamentoComEmprestimo[]> {
    const linhas = await this.prisma.equipamento.findMany({
      orderBy: { patrimonio: "asc" },
      include: COM_EMPRESTIMO_ABERTO,
    });
    return linhas.map(paraEquipamento);
  }

  async equipamento(id: string): Promise<EquipamentoComEmprestimo | null> {
    const linha = await this.prisma.equipamento.findUnique({ where: { id }, include: COM_EMPRESTIMO_ABERTO });
    return linha ? paraEquipamento(linha) : null;
  }

  async abertosDe(perfilId: string): Promise<EmprestimoAberto[]> {
    const linhas = await this.prisma.emprestimo.findMany({
      where: { perfilId, ...SO_ABERTOS },
      orderBy: { devolverAte: "asc" },
      include: {
        equipamento: {
          select: { id: true, patrimonio: true, nome: true, categoria: true, imagemCaminho: true },
        },
      },
    });
    return linhas.map((l) => ({
      id: l.id,
      retiradaEm: deData(l.retiradaEm),
      devolverAte: deData(l.devolverAte),
      equipamento: { ...l.equipamento, categoria: String(l.equipamento.categoria) },
    }));
  }

  async criar(novo: NovoEmprestimo): Promise<{ id: string }> {
    try {
      const criado = await this.prisma.emprestimo.create({
        data: {
          equipamentoId: novo.equipamentoId,
          perfilId: novo.perfilId,
          retiradaEm: paraData(novo.retiradaEm),
          devolverAte: paraData(novo.devolverAte),
        },
        select: { id: true },
      });
      return { id: criado.id };
    } catch (erro) {
      traduzirRecusaDoBanco(erro);
    }
  }
}
