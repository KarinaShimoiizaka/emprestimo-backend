import { Papel } from "../comum/valores/papel";
import { ClaimsDoToken, UsuarioAutenticado } from "./usuario-autenticado";

const SUB = "3f1b9c4e-5a21-4d7b-9c88-0e2a6b7d1f40";

function claims(extra: Partial<ClaimsDoToken> = {}): ClaimsDoToken {
  return { sub: SUB, email: "ana.ribeiro@empresa.com.br", ...extra };
}

describe("UsuarioAutenticado — tradução das claims (BE-02 §5)", () => {
  describe("papel", () => {
    it("usa operacoes quando app_metadata.papel diz operacoes", () => {
      const usuario = UsuarioAutenticado.deClaims(
        claims({ app_metadata: { papel: "operacoes" } }),
      );

      expect(usuario.papel).toBe(Papel.Operacoes);
      expect(usuario.ehOperacoes()).toBe(true);
    });

    it("cai para colaborador quando app_metadata não traz papel", () => {
      const usuario = UsuarioAutenticado.deClaims(claims());

      expect(usuario.papel).toBe(Papel.Colaborador);
      expect(usuario.ehOperacoes()).toBe(false);
    });

    it("cai para colaborador quando o papel é um valor desconhecido", () => {
      const usuario = UsuarioAutenticado.deClaims(
        claims({ app_metadata: { papel: "administrador" } }),
      );

      expect(usuario.papel).toBe(Papel.Colaborador);
    });

    it("não aceita papel herdado do prototype do objeto de claims", () => {
      const usuario = UsuarioAutenticado.deClaims(
        claims({ app_metadata: { papel: "constructor" } }),
      );

      expect(usuario.papel).toBe(Papel.Colaborador);
    });
  });

  describe("nome", () => {
    it("usa user_metadata.nome quando ele existe", () => {
      const usuario = UsuarioAutenticado.deClaims(
        claims({ user_metadata: { nome: "Ana Ribeiro" } }),
      );

      expect(usuario.nome).toBe("Ana Ribeiro");
    });

    it("usa a parte local do e-mail quando não há nome", () => {
      const usuario = UsuarioAutenticado.deClaims(claims());

      expect(usuario.nome).toBe("ana.ribeiro");
    });

    it("usa a parte local do e-mail quando o nome vem em branco", () => {
      const usuario = UsuarioAutenticado.deClaims(
        claims({ user_metadata: { nome: "   " } }),
      );

      expect(usuario.nome).toBe("ana.ribeiro");
    });
  });

  describe("identificação", () => {
    it("normaliza o e-mail para minúsculas", () => {
      const usuario = UsuarioAutenticado.deClaims(
        claims({ email: "Ana.Ribeiro@Empresa.com.br" }),
      );

      expect(usuario.email.toString()).toBe("ana.ribeiro@empresa.com.br");
    });

    it("recusa token sem sub", () => {
      expect(() => UsuarioAutenticado.deClaims({ email: "a@b.com" })).toThrow();
    });

    it("recusa token cujo sub não é um uuid", () => {
      expect(() =>
        UsuarioAutenticado.deClaims(claims({ sub: "123" })),
      ).toThrow();
    });

    it("recusa token com e-mail malformado", () => {
      expect(() =>
        UsuarioAutenticado.deClaims(claims({ email: "sem-arroba" })),
      ).toThrow();
    });
  });
});
