import { carregarDadosIniciais, EquipamentoInicial } from "./dados-iniciais";
import { repositorioPrisma } from "./repositorio-prisma";
import { RepositorioDeEquipamentos, semearEquipamentos } from "./semear-equipamentos";

// A lista da prática, como a BE-03 §3 fixa. O teste compara o arquivo de
// dados com ela, valor por valor.
const LISTA_DA_PRATICA: Array<[string, string, string, string]> = [
  ["TI-0001", "Notebook 14 polegadas", "notebook", "disponivel"],
  ["TI-0002", "Notebook 15 polegadas", "notebook", "disponivel"],
  ["TI-0003", "Notebook 13 polegadas", "notebook", "disponivel"],
  ["TI-0004", "Notebook 15 polegadas", "notebook", "manutencao"],
  ["TI-0005", "Monitor 24 polegadas", "monitor", "disponivel"],
  ["TI-0006", "Monitor 27 polegadas", "monitor", "disponivel"],
  ["TI-0007", "Monitor 22 polegadas", "monitor", "manutencao"],
  ["TI-0008", "Cabo HDMI 2 m", "cabo", "disponivel"],
  ["TI-0009", "Cabo USB-C 1 m", "cabo", "disponivel"],
  ["TI-0010", "Cabo de rede 3 m", "cabo", "manutencao"],
  ["TI-0011", "Webcam Full HD", "camera", "disponivel"],
  ["TI-0012", "Câmera compacta", "camera", "disponivel"],
];

// Repositório em memória: registra cada escrita para o teste conferir.
function repositorioEmMemoria() {
  const tabela = new Map<string, EquipamentoInicial>();
  const escritas: string[] = [];
  const repositorio: RepositorioDeEquipamentos = {
    async existe(patrimonio) {
      return tabela.has(patrimonio);
    },
    async criar(e) {
      escritas.push(`criar ${e.patrimonio}`);
      tabela.set(e.patrimonio, structuredClone(e));
    },
    async atualizar(e) {
      escritas.push(`atualizar ${e.patrimonio}`);
      tabela.set(e.patrimonio, structuredClone(e));
    },
  };
  return { repositorio, tabela, escritas };
}

describe("BE-03 dados iniciais: o arquivo de dados", () => {
  const dados = carregarDadosIniciais();

  it("BE-03 CA-1: tem exatamente os 12 equipamentos da lista da prática, com patrimônio sem repetição", () => {
    expect(dados.map((e) => [e.patrimonio, e.nome, e.categoria])).toEqual(
      LISTA_DA_PRATICA.map(([p, n, c]) => [p, n, c]),
    );
    expect(new Set(dados.map((e) => e.patrimonio)).size).toBe(12);
  });

  it("BE-03 CA-2: TI-0004, TI-0007 e TI-0010 em manutenção; os outros 9 disponíveis", () => {
    const emManutencao = dados.filter((e) => e.situacao === "manutencao").map((e) => e.patrimonio);
    const disponiveis = dados.filter((e) => e.situacao === "disponivel").map((e) => e.patrimonio);
    expect(emManutencao).toEqual(["TI-0004", "TI-0007", "TI-0010"]);
    expect(disponiveis).toHaveLength(9);
    expect(dados.map((e) => e.situacao)).toEqual(LISTA_DA_PRATICA.map(([, , , s]) => s));
  });

  it("BE-03 CA-3: cada equipamento tem a foto em equipamentos/<patrimônio>.jpg, com autor, origem e licença", () => {
    for (const e of dados) {
      expect(e.imagem.caminho).toBe(`equipamentos/${e.patrimonio}.jpg`);
      expect(e.imagem.autor.trim()).not.toBe("");
      expect(e.imagem.origem).toMatch(/^https:\/\/pixabay\.com\//);
      expect(e.imagem.licenca).toBe("Pixabay Content License");
    }
  });
});

describe("BE-03 dados iniciais: o seed", () => {
  const dados = carregarDadosIniciais();

  it("BE-03 CA-4: sobre uma base vazia, cria os 12", async () => {
    const { repositorio, tabela } = repositorioEmMemoria();
    const r = await semearEquipamentos(dados, repositorio);
    expect(r.criados).toHaveLength(12);
    expect(r.atualizados).toHaveLength(0);
    expect([...tabela.keys()]).toEqual(LISTA_DA_PRATICA.map(([p]) => p));
  });

  it("BE-03 CA-5: rodar de novo não cria nada e atualiza os 12 para o que está no arquivo", async () => {
    const { repositorio, tabela } = repositorioEmMemoria();
    await semearEquipamentos(dados, repositorio);

    // Alguém mudou um item no banco; o arquivo é a fonte e volta a valer.
    tabela.set("TI-0004", { ...tabela.get("TI-0004")!, situacao: "disponivel", nome: "outro" });

    const segunda = await semearEquipamentos(dados, repositorio);
    expect(segunda.criados).toHaveLength(0);
    expect(segunda.atualizados).toHaveLength(12);
    expect(tabela.size).toBe(12);
    expect(tabela.get("TI-0004")).toMatchObject({ situacao: "manutencao", nome: "Notebook 15 polegadas" });
  });

  it("recusa dados com patrimônio repetido, sem escrever nada", async () => {
    const { repositorio, escritas } = repositorioEmMemoria();
    const repetido = [...dados, { ...dados[0] }];
    await expect(semearEquipamentos(repetido, repositorio)).rejects.toThrow(/TI-0001: patrimônio repetido/);
    expect(escritas).toHaveLength(0);
  });

  it("BE-03 CA-3, CA-4 e CA-5: pelo Prisma, cria e atualiza cada campo da foto na coluna certa", async () => {
    const existentes = new Set<string>();
    const criados: Array<{ data: Record<string, unknown> }> = [];
    const atualizados: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
    const prismaFalso = {
      equipamento: {
        findUnique: async ({ where }: { where: { patrimonio: string } }) =>
          existentes.has(where.patrimonio) ? { id: where.patrimonio } : null,
        create: async (args: { data: Record<string, unknown> }) => {
          criados.push(args);
          existentes.add(args.data.patrimonio as string);
        },
        update: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          atualizados.push(args);
        },
      },
    };
    const repositorio = repositorioPrisma(prismaFalso as never);

    await semearEquipamentos(dados, repositorio);
    await semearEquipamentos(dados, repositorio);

    const esperado = (e: EquipamentoInicial) => ({
      nome: e.nome,
      categoria: e.categoria,
      situacao: e.situacao,
      imagemCaminho: e.imagem.caminho,
      imagemAutor: e.imagem.autor,
      imagemOrigem: e.imagem.origem,
      imagemLicenca: e.imagem.licenca,
    });
    expect(criados).toEqual(dados.map((e) => ({ data: { patrimonio: e.patrimonio, ...esperado(e) } })));
    expect(atualizados).toEqual(dados.map((e) => ({ where: { patrimonio: e.patrimonio }, data: esperado(e) })));
  });

  it("BE-03 CA-6: o seed, pelo Prisma, só escreve em equipamento", async () => {
    const tocados = new Set<string>();
    const operacoes: string[] = [];
    const registrador = (tabela: string) =>
      new Proxy(
        {},
        {
          get: (_alvo, metodo: string) => async () => {
            operacoes.push(`${tabela}.${metodo}`);
            return null; // findUnique sem resultado: tudo é criado
          },
        },
      );
    const prismaFalso = new Proxy(
      {},
      {
        get: (_alvo, tabela: string) => {
          tocados.add(tabela);
          return registrador(tabela);
        },
      },
    );

    await semearEquipamentos(dados, repositorioPrisma(prismaFalso as never));

    expect([...tocados]).toEqual(["equipamento"]);
    expect(operacoes.filter((o) => !o.startsWith("equipamento."))).toEqual([]);
    expect(operacoes.filter((o) => o === "equipamento.create")).toHaveLength(12);
  });
});
