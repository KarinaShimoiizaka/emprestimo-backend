/** Os dois papéis da BE-02 §2. */
export enum Papel {
  Colaborador = "colaborador",
  Operacoes = "operacoes",
}

const PAPEIS: Record<string, Papel> = {
  colaborador: Papel.Colaborador,
  operacoes: Papel.Operacoes,
};

/**
 * Traduz o que veio no token. Valor ausente ou desconhecido vale
 * `colaborador`: na dúvida, o papel com menos poder (BE-02 §5).
 */
export function papelDeClaim(bruto: unknown): Papel {
  if (typeof bruto !== "string") return Papel.Colaborador;
  return Object.hasOwn(PAPEIS, bruto) ? PAPEIS[bruto] : Papel.Colaborador;
}
