// Repositório de equipamentos sobre o Prisma, usado pelo prisma/seed.ts.
// Só toca em `equipamento` (BE-03 CA-6).

import type { PrismaClient } from "@prisma/client";
import { EquipamentoInicial } from "./dados-iniciais";
import { RepositorioDeEquipamentos } from "./semear-equipamentos";

type PrismaComEquipamento = Pick<PrismaClient, "equipamento">;

function campos(e: EquipamentoInicial) {
  return {
    nome: e.nome,
    categoria: e.categoria,
    situacao: e.situacao,
    imagemCaminho: e.imagem.caminho,
    imagemAutor: e.imagem.autor,
    imagemOrigem: e.imagem.origem,
    imagemLicenca: e.imagem.licenca,
  };
}

export function repositorioPrisma(prisma: PrismaComEquipamento): RepositorioDeEquipamentos {
  return {
    async existe(patrimonio) {
      return (await prisma.equipamento.findUnique({ where: { patrimonio }, select: { id: true } })) !== null;
    },
    async criar(e) {
      await prisma.equipamento.create({ data: { patrimonio: e.patrimonio, ...campos(e) } });
    },
    async atualizar(e) {
      await prisma.equipamento.update({ where: { patrimonio: e.patrimonio }, data: campos(e) });
    },
  };
}
