import type { ConfigService } from "@nestjs/config";

import { UsuarioAutenticado } from "../auth/usuario-autenticado";
import {
  BloqueadoPorAtraso,
  EmManutencao,
  EquipamentoIndisponivel,
  EquipamentoNaoEncontrado,
  LimiteAtingido,
} from "../comum/erros";
import type { PerfilService } from "../perfil/perfil.service";
import { EmprestimosService } from "./emprestimos.service";
import { FotosPublicas } from "./fotos-publicas";
import { Relogio } from "./relogio";
import {
  EmprestimoAberto,
  EquipamentoComEmprestimo,
  NovoEmprestimo,
  RepositorioDeEmprestimos,
} from "./repositorio-de-emprestimos";

const ANA = "3f1b9c4e-5a21-4d7b-9c88-0e2a6b7d1f40";
const BRUNO = "8c2d1e0f-1111-4a2b-9c3d-4e5f60718293";

// Segunda, 09/11/2026, 12:00 em São Paulo.
const AGORA = new Date("2026-11-09T15:00:00Z");

function usuario(sub: string, nome: string): UsuarioAutenticado {
  return UsuarioAutenticado.deClaims({ sub, email: `${nome.toLowerCase()}@empresa.com.br`, user_metadata: { nome } });
}

function equipamento(id: string, extra: Partial<EquipamentoComEmprestimo> = {}): EquipamentoComEmprestimo {
  return {
    id,
    patrimonio: `TI-${id}`,
    nome: `Item ${id}`,
    categoria: "notebook",
    situacao: "disponivel",
    observacao: null,
    imagemCaminho: `equipamentos/TI-${id}.jpg`,
    emprestimoAberto: null,
    ...extra,
  };
}

/** Repositório em memória: cada empréstimo criado aparece nas consultas seguintes. */
class RepositorioEmMemoria extends RepositorioDeEmprestimos {
  readonly criados: NovoEmprestimo[] = [];
  private readonly nomes = new Map([[ANA, "Ana"], [BRUNO, "Bruno"]]);

  constructor(
    private readonly itens: EquipamentoComEmprestimo[],
    private readonly abertos: Array<NovoEmprestimo & { id: string }> = [],
  ) {
    super();
  }

  private comEmprestimo(e: EquipamentoComEmprestimo): EquipamentoComEmprestimo {
    const aberto = this.abertos.find((a) => a.equipamentoId === e.id);
    return {
      ...e,
      emprestimoAberto: aberto
        ? { perfilId: aberto.perfilId, pessoa: this.nomes.get(aberto.perfilId) ?? "?", devolverAte: aberto.devolverAte }
        : e.emprestimoAberto,
    };
  }

  async equipamentos() {
    return this.itens.map((e) => this.comEmprestimo(e));
  }

  async equipamento(id: string) {
    const e = this.itens.find((x) => x.id === id);
    return e ? this.comEmprestimo(e) : null;
  }

  async abertosDe(perfilId: string): Promise<EmprestimoAberto[]> {
    return this.abertos
      .filter((a) => a.perfilId === perfilId)
      .map((a) => {
        const e = this.itens.find((x) => x.id === a.equipamentoId)!;
        return {
          id: a.id,
          retiradaEm: a.retiradaEm,
          devolverAte: a.devolverAte,
          equipamento: { id: e.id, patrimonio: e.patrimonio, nome: e.nome, categoria: e.categoria, imagemCaminho: e.imagemCaminho },
        };
      });
  }

  async criar(novo: NovoEmprestimo) {
    this.criados.push(novo);
    const id = `emp-${this.abertos.length + 1}`;
    this.abertos.push({ ...novo, id });
    return { id };
  }
}

function montar(repositorio: RepositorioEmMemoria) {
  const perfis = { provisionar: jest.fn(async () => undefined) };
  const config = {
    get: (chave: string) =>
      ({ SUPABASE_URL: "https://projeto.supabase.co", STORAGE_NAME: "emprestimo bucket" })[chave],
  } as unknown as ConfigService;
  const relogio: Relogio = { agora: () => AGORA };
  const service = new EmprestimosService(
    repositorio,
    perfis as unknown as PerfilService,
    new FotosPublicas(config),
    relogio,
  );
  return { service, perfis };
}

/** `n` empréstimos abertos da pessoa, todos ainda no prazo. */
function abertosEmDia(perfilId: string, n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `ja-${i}`,
    equipamentoId: `x${i}`,
    perfilId,
    retiradaEm: "2026-11-02",
    devolverAte: "2026-11-20",
  }));
}

function itensComOcupados(n: number) {
  return [equipamento("livre"), ...Array.from({ length: n }, (_, i) => equipamento(`x${i}`))];
}

describe("BE-04 solicitar empréstimo (EmprestimosService)", () => {
  it("BE-04 CA-2: solicitar um disponível cria o empréstimo da pessoa do token e o item passa a emprestado", async () => {
    const repositorio = new RepositorioEmMemoria([equipamento("0001")]);
    const { service, perfis } = montar(repositorio);

    const criado = await service.solicitar(usuario(ANA, "Ana"), "0001");

    expect(perfis.provisionar).toHaveBeenCalledTimes(1);
    expect(repositorio.criados).toEqual([
      { equipamentoId: "0001", perfilId: ANA, retiradaEm: "2026-11-09", devolverAte: "2026-11-27" },
    ]);
    expect(criado).toEqual({ id: "emp-1", equipamentoId: "0001", retiradaEm: "2026-11-09", devolverAte: "2026-11-27" });

    const [item] = await service.catalogo(usuario(ANA, "Ana"));
    expect(item.situacao).toBe("emprestado");
    expect(item.emprestimo).toEqual({ pessoa: "Ana", devolverAte: "2026-11-27", comVoce: true });
  });

  it("BE-04 CA-3: equipamento em manutenção é recusado com EM_MANUTENCAO e nada é criado", async () => {
    const repositorio = new RepositorioEmMemoria([equipamento("0004", { situacao: "manutencao" })]);
    const { service } = montar(repositorio);

    const recusa = service.solicitar(usuario(ANA, "Ana"), "0004");
    await expect(recusa).rejects.toBeInstanceOf(EmManutencao);
    await expect(recusa).rejects.toMatchObject({ codigo: "EM_MANUTENCAO", status: 422 });
    expect(repositorio.criados).toHaveLength(0);
  });

  it("BE-04 CA-4: equipamento já emprestado é recusado com 409 EQUIPAMENTO_INDISPONIVEL", async () => {
    const repositorio = new RepositorioEmMemoria(
      [equipamento("0001")],
      [{ id: "e1", equipamentoId: "0001", perfilId: BRUNO, retiradaEm: "2026-11-09", devolverAte: "2026-11-27" }],
    );
    const { service } = montar(repositorio);

    const recusa = service.solicitar(usuario(ANA, "Ana"), "0001");
    await expect(recusa).rejects.toBeInstanceOf(EquipamentoIndisponivel);
    await expect(recusa).rejects.toMatchObject({ codigo: "EQUIPAMENTO_INDISPONIVEL", status: 409 });
    expect(repositorio.criados).toHaveLength(0);
  });

  it("BE-04 CA-5: com 5 em aberto a pessoa é recusada com LIMITE_ATINGIDO e a mensagem do limite", async () => {
    const repositorio = new RepositorioEmMemoria(itensComOcupados(5), abertosEmDia(ANA, 5));
    const { service } = montar(repositorio);

    const recusa = service.solicitar(usuario(ANA, "Ana"), "livre");
    await expect(recusa).rejects.toBeInstanceOf(LimiteAtingido);
    await expect(recusa).rejects.toMatchObject({
      codigo: "LIMITE_ATINGIDO",
      status: 422,
      mensagem: "Você já está com 5 itens.",
    });
    expect(repositorio.criados).toHaveLength(0);
  });

  it("BE-04 CA-5: com 4 em aberto a solicitação passa", async () => {
    const repositorio = new RepositorioEmMemoria(itensComOcupados(4), abertosEmDia(ANA, 4));
    const { service } = montar(repositorio);

    await service.solicitar(usuario(ANA, "Ana"), "livre");
    expect(repositorio.criados).toHaveLength(1);
  });

  it("BE-04 CA-6: com um empréstimo em atraso a pessoa é recusada com BLOQUEADO_POR_ATRASO", async () => {
    const atrasado = { ...abertosEmDia(ANA, 1)[0], devolverAte: "2026-11-06" }; // venceu na sexta
    const repositorio = new RepositorioEmMemoria(itensComOcupados(1), [atrasado]);
    const { service } = montar(repositorio);

    const recusa = service.solicitar(usuario(ANA, "Ana"), "livre");
    await expect(recusa).rejects.toBeInstanceOf(BloqueadoPorAtraso);
    await expect(recusa).rejects.toMatchObject({ codigo: "BLOQUEADO_POR_ATRASO", status: 422 });
    expect(repositorio.criados).toHaveLength(0);
  });

  it("equipamento inexistente é recusado com 404 NAO_ENCONTRADO", async () => {
    const { service } = montar(new RepositorioEmMemoria([]));
    await expect(service.solicitar(usuario(ANA, "Ana"), "nao-existe")).rejects.toBeInstanceOf(
      EquipamentoNaoEncontrado,
    );
  });

  it("BE-04 CA-8: meus devolve só os abertos da pessoa do token, com o devolverAte", async () => {
    const repositorio = new RepositorioEmMemoria(
      [equipamento("0001"), equipamento("0002")],
      [
        { id: "da-ana", equipamentoId: "0001", perfilId: ANA, retiradaEm: "2026-11-09", devolverAte: "2026-11-27" },
        { id: "do-bruno", equipamentoId: "0002", perfilId: BRUNO, retiradaEm: "2026-11-09", devolverAte: "2026-11-27" },
      ],
    );
    const { service } = montar(repositorio);

    const meus = await service.meus(usuario(ANA, "Ana"));
    expect(meus.map((m) => [m.id, m.devolverAte])).toEqual([["da-ana", "2026-11-27"]]);
  });

  it("BE-04 CA-9: o catálogo monta a imagemUrl a partir do caminho e deriva a situação", async () => {
    const repositorio = new RepositorioEmMemoria(
      [
        equipamento("0001"),
        equipamento("0002"),
        equipamento("0003", { situacao: "manutencao" }),
        equipamento("0004", { imagemCaminho: null }),
      ],
      [{ id: "e1", equipamentoId: "0002", perfilId: BRUNO, retiradaEm: "2026-11-09", devolverAte: "2026-11-27" }],
    );
    const { service } = montar(repositorio);

    const itens = await service.catalogo(usuario(ANA, "Ana"));

    expect(itens.map((i) => i.situacao)).toEqual(["disponivel", "emprestado", "manutencao", "disponivel"]);
    expect(itens[0].imagemUrl).toBe(
      "https://projeto.supabase.co/storage/v1/object/public/emprestimo%20bucket/equipamentos/TI-0001.jpg",
    );
    expect(itens[3].imagemUrl).toBeNull();
    expect(itens[1].emprestimo).toEqual({ pessoa: "Bruno", devolverAte: "2026-11-27", comVoce: false });
    expect(itens[0].emprestimo).toBeNull();
  });
});
