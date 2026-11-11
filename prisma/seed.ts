// Seed dos dados iniciais (BE-03). Quem roda em produção é a pessoa:
//   npm run seed
// Cria os 12 equipamentos que faltarem e atualiza os que existem para o que
// está em prisma/dados/equipamentos.json. Não cria usuário nem empréstimo: a
// conta do professor é criada no painel do Supabase (BE-03 §5).

import { PrismaClient } from "@prisma/client";
import { carregarDadosIniciais } from "../src/dados-iniciais/dados-iniciais";
import { repositorioPrisma } from "../src/dados-iniciais/repositorio-prisma";
import { semearEquipamentos } from "../src/dados-iniciais/semear-equipamentos";

async function principal() {
  const prisma = new PrismaClient();
  try {
    const r = await semearEquipamentos(carregarDadosIniciais(), repositorioPrisma(prisma));
    console.log(`criados: ${r.criados.length} ${r.criados.join(" ")}`.trim());
    console.log(`atualizados: ${r.atualizados.length} ${r.atualizados.join(" ")}`.trim());
    console.log(`equipamentos no banco: ${await prisma.equipamento.count()}`);
  } finally {
    await prisma.$disconnect();
  }
}

principal().catch((e) => {
  console.error(`[seed] ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
