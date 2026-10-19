import type { ClaimsDoToken } from "./usuario-autenticado";

/**
 * A abstração de que o guard depende. O guard não sabe que existe Supabase,
 * nem JWKS, nem a biblioteca `jose` — só que alguém sabe transformar um
 * token em claims, ou falhar.
 */
export abstract class VerificadorDeToken {
  abstract verificar(token: string): Promise<ClaimsDoToken>;
}
