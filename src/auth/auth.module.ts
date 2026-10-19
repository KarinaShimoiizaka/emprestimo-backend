import { Global, Module } from "@nestjs/common";

import { GuardDeAutenticacao } from "./guard-de-autenticacao";
import { GuardDePapel } from "./guard-de-papel";
import { VerificadorDeToken } from "./verificador-de-token";
import { VerificadorSupabase } from "./verificador-supabase";

@Global()
@Module({
  providers: [
    // A troca de implementação acontece aqui, e só aqui.
    { provide: VerificadorDeToken, useClass: VerificadorSupabase },
    GuardDeAutenticacao,
    GuardDePapel,
  ],
  exports: [VerificadorDeToken, GuardDeAutenticacao, GuardDePapel],
})
export class AuthModule {}
