import { describe, expect, it } from "vitest";
import { normalizeCsvHeader, parseCsv } from "./csv";

describe("CSV de leads", () => {
  it("mantém vírgulas dentro de campos entre aspas", () => {
    const rows = parseCsv('Nome,Segmento,Mensagem\nEmpresa,"Lanchonetes, casas de chá","Olá, tudo bem?"');
    expect(rows[1]).toEqual(["Empresa", "Lanchonetes, casas de chá", "Olá, tudo bem?"]);
  });

  it("normaliza cabeçalhos com acentos, hífen e BOM", () => {
    expect(normalizeCsvHeader("\uFEFFE-mail")).toBe("email");
    expect(normalizeCsvHeader("Mensagem personalizada")).toBe("mensagempersonalizada");
  });
});
