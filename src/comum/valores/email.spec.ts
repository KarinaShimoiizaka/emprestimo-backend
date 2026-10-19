import { Email } from "./email";

describe("Email", () => {
  it("aceita um e-mail bem formado e normaliza para minúsculas", () => {
    expect(Email.criar("  Ana.Ribeiro@Empresa.COM.br ").toString()).toBe(
      "ana.ribeiro@empresa.com.br",
    );
  });

  it("expõe a parte local, que serve de nome quando não há outro", () => {
    expect(Email.criar("marcos.lemos@empresa.com.br").parteLocal).toBe("marcos.lemos");
  });

  it.each([["sem arroba", "ana.empresa.com.br"], ["sem domínio", "ana@"], ["vazio", "   "]])(
    "recusa e-mail %s",
    (_caso, bruto) => {
      expect(() => Email.criar(bruto)).toThrow();
    },
  );
});
