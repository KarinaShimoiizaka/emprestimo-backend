// Datas do empréstimo (BE-04 §4). Funções puras: "agora" e "hoje" sempre
// chegam por parâmetro, nunca do relógio (tests.md, regra 5).

export const FUSO = "America/Sao_Paulo";
export const PRAZO_EM_DIAS_UTEIS = 14;
export const LIMITE_POR_PESSOA = 5;

/** O dia de `agora` em São Paulo, como `AAAA-MM-DD`. */
export function hojeEm(agora: Date, fuso: string = FUSO): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/**
 * Soma dias úteis (segunda a sexta) a uma data `AAAA-MM-DD`. Conta a partir
 * do dia seguinte; o último dia contado é o resultado. Feriados não contam
 * na v1 (BE-04, decisão em aberto 1).
 */
export function somarDiasUteis(iso: string, dias: number): string {
  const data = new Date(`${iso}T12:00:00Z`);
  let contados = 0;
  while (contados < dias) {
    data.setUTCDate(data.getUTCDate() + 1);
    const diaDaSemana = data.getUTCDay();
    if (diaDaSemana !== 0 && diaDaSemana !== 6) contados++;
  }
  return data.toISOString().slice(0, 10);
}

/** Em atraso: o prazo já passou (devolver até ontem ou antes). */
export function emAtraso(devolverAte: string, hoje: string): boolean {
  return devolverAte < hoje;
}

/** `AAAA-MM-DD` → `Date` à meia-noite UTC, que é como o Prisma grava `@db.Date`. */
export function paraData(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** `Date` vinda de uma coluna `@db.Date` → `AAAA-MM-DD`. */
export function deData(data: Date): string {
  return data.toISOString().slice(0, 10);
}
