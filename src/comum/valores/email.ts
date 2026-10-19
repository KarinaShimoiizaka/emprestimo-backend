/** E-mail já validado. Existir uma instância significa que o formato passou. */
export class Email {
  private static readonly FORMATO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private constructor(private readonly valor: string) {}

  static criar(bruto: string): Email {
    const limpo = bruto.trim().toLowerCase();
    if (!Email.FORMATO.test(limpo)) {
      throw new Error(`E-mail inválido: ${bruto}`);
    }
    return new Email(limpo);
  }

  /** A parte antes do arroba. Serve de nome quando o Supabase não tem um. */
  get parteLocal(): string {
    return this.valor.slice(0, this.valor.indexOf("@"));
  }

  toString(): string {
    return this.valor;
  }
}
