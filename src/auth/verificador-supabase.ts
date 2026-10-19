import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

import type { ClaimsDoToken } from "./usuario-autenticado";
import { VerificadorDeToken } from "./verificador-de-token";

/**
 * Valida a assinatura do access token contra o JWKS do Supabase.
 *
 * `jwtVerify` confere assinatura, emissor e expiração. O token nunca é
 * decodificado sem verificação (BE-02 §5) — não existe caminho neste arquivo
 * que leia claims de um token que não passou por aqui.
 */
@Injectable()
export class VerificadorSupabase extends VerificadorDeToken {
  private readonly log = new Logger(VerificadorSupabase.name);
  private readonly chaves: ReturnType<typeof createRemoteJWKSet>;
  private readonly emissor: string;

  constructor(config: ConfigService) {
    super();
    const jwks = config.getOrThrow<string>("SUPABASE_JWKS_URL");
    const supabase = config.getOrThrow<string>("SUPABASE_URL");

    this.chaves = createRemoteJWKSet(new URL(jwks));
    this.emissor = `${supabase.replace(/\/$/, "")}/auth/v1`;
  }

  async verificar(token: string): Promise<ClaimsDoToken> {
    const { payload } = await jwtVerify(token, this.chaves, {
      issuer: this.emissor,
    });
    return payload as ClaimsDoToken;
  }
}
