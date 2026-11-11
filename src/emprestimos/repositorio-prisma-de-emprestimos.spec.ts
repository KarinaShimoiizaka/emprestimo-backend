import { EmManutencao, EquipamentoIndisponivel, LimiteAtingido } from "../comum/erros";
import type { PrismaService } from "../prisma/prisma.service";
import { RepositorioPrismaDeEmprestimos, traduzirRecusaDoBanco } from "./repositorio-prisma-de-emprestimos";

const ANA = "3f1b9c4e-5a21-4d7b-9c88-0e2a6b7d1f40";

function prismaFalso(sobrescrever: Record<string, unknown> = {}) {
  const emprestimo = {
    findMany: jest.fn(async () => [
      {
        id: "e1",
        retiradaEm: new Date("2026-11-09T00:00:00Z"),
        devolverAte: new Date("2026-11-27T00:00:00Z"),
        equipamento: { id: "q1", patrimonio: "TI-0001", nome: "Notebook 14 polegadas", categoria: "notebook", imagemCaminho: "equipamentos/TI-0001.jpg" },
      },
    ]),
    create: jest.fn(async () => ({ id: "novo" })),
    ...sobrescrever,
  };
  const equipamento = {
    findMany: jest.fn(async () => [
      {
        id: "q1",
        patrimonio: "TI-0001",
        nome: "Notebook 14 polegadas",
        categoria: "notebook",
        situacao: "disponivel",
        observacao: null,
        imagemCaminho: "equipamentos/TI-0001.jpg",
        emprestimos: [{ perfilId: ANA, devolverAte: new Date("2026-11-27T00:00:00Z"), perfil: { nome: "Ana" } }],
      },
    ]),
  };
  return { prisma: { emprestimo, equipamento } as unknown as PrismaService, emprestimo, equipamento };
}

describe("BE-04 repositório Prisma de empréstimos", () => {
  it("BE-04 CA-8: os abertos de uma pessoa filtram pelo perfilId do token e por devolvidoEm nulo", async () => {
    const { prisma, emprestimo } = prismaFalso();

    const abertos = await new RepositorioPrismaDeEmprestimos(prisma).abertosDe(ANA);

    expect(emprestimo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { perfilId: ANA, devolvidoEm: null }, orderBy: { devolverAte: "asc" } }),
    );
    expect(abertos).toEqual([
      {
        id: "e1",
        retiradaEm: "2026-11-09",
        devolverAte: "2026-11-27",
        equipamento: { id: "q1", patrimonio: "TI-0001", nome: "Notebook 14 polegadas", categoria: "notebook", imagemCaminho: "equipamentos/TI-0001.jpg" },
      },
    ]);
  });

  it("BE-04 CA-9: o acervo vem por patrimônio, só com o empréstimo aberto de cada item", async () => {
    const { prisma, equipamento } = prismaFalso();

    const [item] = await new RepositorioPrismaDeEmprestimos(prisma).equipamentos();

    expect(equipamento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { patrimonio: "asc" },
        include: { emprestimos: expect.objectContaining({ where: { devolvidoEm: null } }) },
      }),
    );
    expect(item.emprestimoAberto).toEqual({ perfilId: ANA, pessoa: "Ana", devolverAte: "2026-11-27" });
  });

  it("grava retirada e prazo como datas sem hora", async () => {
    const { prisma, emprestimo } = prismaFalso();

    await new RepositorioPrismaDeEmprestimos(prisma).criar({
      equipamentoId: "q1",
      perfilId: ANA,
      retiradaEm: "2026-11-09",
      devolverAte: "2026-11-27",
    });

    expect(emprestimo.create).toHaveBeenCalledWith({
      data: {
        equipamentoId: "q1",
        perfilId: ANA,
        retiradaEm: new Date("2026-11-09T00:00:00Z"),
        devolverAte: new Date("2026-11-27T00:00:00Z"),
      },
      select: { id: true },
    });
  });

  describe("BE-04 CA-7: recusa do banco por corrida vira a mesma resposta da regra", () => {
    it("índice único violado (P2002) → 409 EQUIPAMENTO_INDISPONIVEL", async () => {
      const unico = Object.assign(new Error("Unique constraint failed on emprestimo_aberto_unico"), { code: "P2002" });
      const { prisma } = prismaFalso({ create: jest.fn(async () => Promise.reject(unico)) });

      const recusa = new RepositorioPrismaDeEmprestimos(prisma).criar({
        equipamentoId: "q1",
        perfilId: ANA,
        retiradaEm: "2026-11-09",
        devolverAte: "2026-11-27",
      });
      await expect(recusa).rejects.toBeInstanceOf(EquipamentoIndisponivel);
      await expect(recusa).rejects.toMatchObject({ status: 409 });
    });

    it("trigger de limite (LIMITE_ATINGIDO) → 422 LIMITE_ATINGIDO", () => {
      const doTrigger = new Error("Raw query failed. Code: `P0001`. Message: `ERROR: LIMITE_ATINGIDO`");
      expect(() => traduzirRecusaDoBanco(doTrigger)).toThrow(LimiteAtingido);
    });

    it("trigger de manutenção (EM_MANUTENCAO) → 422 EM_MANUTENCAO", () => {
      expect(() => traduzirRecusaDoBanco(new Error("ERROR: EM_MANUTENCAO"))).toThrow(EmManutencao);
    });

    it("qualquer outra falha do banco segue adiante sem disfarce", () => {
      const outra = new Error("connection reset");
      expect(() => traduzirRecusaDoBanco(outra)).toThrow(outra);
    });
  });
});
