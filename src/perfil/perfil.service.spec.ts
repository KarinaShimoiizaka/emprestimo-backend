import { UsuarioAutenticado } from "../auth/usuario-autenticado";
import { Papel } from "../comum/valores/papel";
import type { PrismaService } from "../prisma/prisma.service";
import { PerfilService } from "./perfil.service";

const SUB = "3f1b9c4e-5a21-4d7b-9c88-0e2a6b7d1f40";

function usuario(extra: Record<string, unknown> = {}): UsuarioAutenticado {
  return UsuarioAutenticado.deClaims({
    sub: SUB,
    email: "ana.ribeiro@empresa.com.br",
    user_metadata: { nome: "Ana Ribeiro" },
    ...extra,
  });
}

/** Fake do Prisma: guarda a chamada e devolve o que foi gravado. */
function prismaFalso() {
  const upsert = jest.fn(async (argumentos: any) => ({
    id: argumentos.where.id,
    nome: argumentos.create.nome,
    papel: argumentos.create.papel,
    criadoEm: new Date("2026-09-28T00:00:00Z"),
  }));
  return { prisma: { perfil: { upsert } } as unknown as PrismaService, upsert };
}

describe("PerfilService — provisionamento no primeiro acesso (BE-02 §4)", () => {
  it("cria o perfil com nome e papel vindos do token", async () => {
    const { prisma, upsert } = prismaFalso();

    const perfil = await new PerfilService(prisma).provisionar(
      usuario({ app_metadata: { papel: "operacoes" } }),
    );

    expect(upsert).toHaveBeenCalledWith({
      where: { id: SUB },
      update: { nome: "Ana Ribeiro", papel: Papel.Operacoes },
      create: { id: SUB, nome: "Ana Ribeiro", papel: Papel.Operacoes },
    });
    expect(perfil).toEqual({
      id: SUB,
      nome: "Ana Ribeiro",
      email: "ana.ribeiro@empresa.com.br",
      papel: Papel.Operacoes,
    });
  });

  it("reescreve nome e papel a cada entrada, porque a verdade é do Supabase", async () => {
    const { prisma, upsert } = prismaFalso();

    await new PerfilService(prisma).provisionar(
      usuario({ user_metadata: { nome: "Ana R. Ribeiro" } }),
    );

    expect(upsert.mock.calls[0][0].update).toEqual({
      nome: "Ana R. Ribeiro",
      papel: Papel.Colaborador,
    });
  });

  it("grava a parte local do e-mail quando o token não traz nome", async () => {
    const { prisma, upsert } = prismaFalso();

    await new PerfilService(prisma).provisionar(usuario({ user_metadata: null }));

    expect(upsert.mock.calls[0][0].create.nome).toBe("ana.ribeiro");
  });

  it("nunca cria perfil como operacoes quando o token não diz isso", async () => {
    const { prisma, upsert } = prismaFalso();

    await new PerfilService(prisma).provisionar(usuario());

    expect(upsert.mock.calls[0][0].create.papel).toBe(Papel.Colaborador);
  });
});
