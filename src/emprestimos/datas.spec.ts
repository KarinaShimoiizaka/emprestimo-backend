import { emAtraso, hojeEm, somarDiasUteis } from "./datas";

describe("BE-04 §4: datas do empréstimo", () => {
  it("BE-04 CA-1: devolver até = retirada + 14 dias úteis, de segunda a sexta", () => {
    expect(somarDiasUteis("2026-11-09", 14)).toBe("2026-11-27"); // segunda → sexta
    expect(somarDiasUteis("2026-11-13", 14)).toBe("2026-12-03"); // sexta → quinta
    expect(somarDiasUteis("2026-11-14", 14)).toBe("2026-12-03"); // sábado → quinta
  });

  it("hoje é o dia em São Paulo, não o do servidor", () => {
    // 02:00 UTC de 10/11 ainda é 23:00 de 09/11 em São Paulo.
    expect(hojeEm(new Date("2026-11-10T02:00:00Z"))).toBe("2026-11-09");
    expect(hojeEm(new Date("2026-11-10T03:30:00Z"))).toBe("2026-11-10");
  });

  it("em atraso é o prazo que já passou; o próprio dia ainda não é atraso", () => {
    expect(emAtraso("2026-11-09", "2026-11-10")).toBe(true);
    expect(emAtraso("2026-11-10", "2026-11-10")).toBe(false);
  });
});
