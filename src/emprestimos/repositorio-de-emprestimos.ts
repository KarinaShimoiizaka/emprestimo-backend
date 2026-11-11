// O que o service precisa do banco, sem saber que é Prisma. A implementação
// real é RepositorioPrismaDeEmprestimos; os testes usam uma em memória.

export type SituacaoFisica = "disponivel" | "manutencao";

export type EquipamentoComEmprestimo = {
  id: string;
  patrimonio: string;
  nome: string;
  categoria: string;
  situacao: SituacaoFisica;
  observacao: string | null;
  imagemCaminho: string | null;
  /** O empréstimo aberto do item, se houver. */
  emprestimoAberto: { perfilId: string; pessoa: string; devolverAte: string } | null;
};

export type EmprestimoAberto = {
  id: string;
  retiradaEm: string;
  devolverAte: string;
  equipamento: {
    id: string;
    patrimonio: string;
    nome: string;
    categoria: string;
    imagemCaminho: string | null;
  };
};

export type NovoEmprestimo = {
  equipamentoId: string;
  perfilId: string;
  retiradaEm: string;
  devolverAte: string;
};

/**
 * Classe abstrata em vez de interface para servir de token de injeção do
 * Nest, como o VerificadorDeToken da BE-02.
 */
export abstract class RepositorioDeEmprestimos {
  /** Todos os equipamentos, por patrimônio, com o empréstimo aberto de cada um. */
  abstract equipamentos(): Promise<EquipamentoComEmprestimo[]>;

  abstract equipamento(id: string): Promise<EquipamentoComEmprestimo | null>;

  /** Os abertos de UMA pessoa. O `perfilId` é obrigatório (ADR-003). */
  abstract abertosDe(perfilId: string): Promise<EmprestimoAberto[]>;

  /**
   * Grava o empréstimo. Se o banco recusar por corrida, lança o erro de
   * domínio correspondente (EquipamentoIndisponivel, LimiteAtingido,
   * EmManutencao).
   */
  abstract criar(novo: NovoEmprestimo): Promise<{ id: string }>;
}
