/** O `sub` do token, que também é a chave de `perfil`. */
export class IdentificadorDePerfil {
  private static readonly UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  private constructor(private readonly valor: string) {}

  static criar(bruto: string): IdentificadorDePerfil {
    if (!IdentificadorDePerfil.UUID.test(bruto)) {
      throw new Error("Identificador de perfil inválido");
    }
    return new IdentificadorDePerfil(bruto.toLowerCase());
  }

  toString(): string {
    return this.valor;
  }
}
