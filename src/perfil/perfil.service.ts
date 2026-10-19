import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { UsuarioAutenticado } from "../auth/usuario-autenticado";
import { Papel } from "../comum/valores/papel";

export type PerfilDaPessoa = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
};

@Injectable()
export class PerfilService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Garante que existe uma linha em `perfil` para quem acabou de chegar
   * (BE-02 §4) e devolve o perfil.
   *
   * É `upsert` e não `create` porque a fonte de verdade de nome e papel é o
   * Supabase: a cada entrada, a cópia local é reescrita com o que veio no
   * token. Assim, mudar o nome no painel se reflete no próximo request, sem
   * precisar de sincronização à parte.
   */
  async provisionar(usuario: UsuarioAutenticado): Promise<PerfilDaPessoa> {
    const id = usuario.id.toString();
    const dados = { nome: usuario.nome, papel: usuario.papel };

    const perfil = await this.prisma.perfil.upsert({
      where: { id },
      update: dados,
      create: { id, ...dados },
    });

    return {
      id: perfil.id,
      nome: perfil.nome,
      email: usuario.email.toString(),
      papel: perfil.papel as Papel,
    };
  }
}
