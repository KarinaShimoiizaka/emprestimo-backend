import { Email } from "../comum/valores/email";
import { IdentificadorDePerfil } from "../comum/valores/identificador-de-perfil";
import { Papel, papelDeClaim } from "../comum/valores/papel";

/** O que o Supabase põe dentro do access token (BE-02 §5). */
export type ClaimsDoToken = {
  sub?: unknown;
  email?: unknown;
  user_metadata?: { nome?: unknown } | null;
  app_metadata?: { papel?: unknown } | null;
};

/**
 * A pessoa por trás de um request, já com as claims traduzidas para o
 * domínio. Montar esta classe é onde as regras da BE-02 §5 acontecem:
 * papel ausente vale `colaborador`, e nome ausente vira a parte local do
 * e-mail.
 */
export class UsuarioAutenticado {
  private constructor(
    readonly id: IdentificadorDePerfil,
    readonly email: Email,
    readonly nome: string,
    readonly papel: Papel,
  ) {}

  static deClaims(claims: ClaimsDoToken): UsuarioAutenticado {
    if (typeof claims.sub !== "string" || typeof claims.email !== "string") {
      throw new Error("Token sem sub ou email");
    }

    const email = Email.criar(claims.email);

    return new UsuarioAutenticado(
      IdentificadorDePerfil.criar(claims.sub),
      email,
      nomeDeClaims(claims, email),
      papelDeClaim(claims.app_metadata?.papel),
    );
  }

  ehOperacoes(): boolean {
    return this.papel === Papel.Operacoes;
  }
}

function nomeDeClaims(claims: ClaimsDoToken, email: Email): string {
  const bruto = claims.user_metadata?.nome;
  if (typeof bruto !== "string") return email.parteLocal;

  const limpo = bruto.trim();
  return limpo.length > 0 ? limpo : email.parteLocal;
}
