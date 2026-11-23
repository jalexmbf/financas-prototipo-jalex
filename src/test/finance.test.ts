import { describe, it, expect } from "vitest";
import {
  emptyVault,
  monthEntries,
  totals,
  settleRecurring,
  receiveCharge,
  parseBackup,
  parseAmount,
  dueDate,
  money,
  displayDate,
} from "@/lib/finance";
describe("Regras financeiras pessoais", () => {
  it("editar a data de uma repetição não gera duplicidade no mês original", () => {
    const v = emptyVault();
    v.recurring = [
      {
        id: "x",
        description: "Salário",
        amount: 250000,
        day: 5,
        type: "income",
        category: "Salário",
        start: "2026-11-05",
        automatic: true,
      },
    ];
    v.entries = [
      {
        id: "editado",
        description: "Salário",
        amount: 250000,
        date: "2026-12-01",
        category: "Salário",
        type: "income",
        source: "recurring:x:2026-11",
      },
    ];
    expect(monthEntries(v, "2026-11")).toHaveLength(0);
    expect(
      monthEntries(v, "2026-12").filter((e) => e.source === "recurring:x:2026-11"),
    ).toHaveLength(1);
  });
  it("calcula saldo apenas com receitas e despesas do mês", () => {
    const v = emptyVault();
    v.entries = [
      {
        id: "1",
        description: "Receita",
        amount: 500000,
        date: "2026-11-01",
        category: "Salário",
        type: "income",
      },
      {
        id: "2",
        description: "Despesa",
        amount: 120000,
        date: "2026-11-02",
        category: "Moradia",
        type: "expense",
      },
      {
        id: "3",
        description: "Outro mês",
        amount: 99900,
        date: "2026-10-02",
        category: "Outros",
        type: "expense",
      },
    ];
    expect(totals(monthEntries(v, "2026-11"))).toEqual({
      income: 500000,
      expense: 120000,
      balance: 380000,
    });
  });
  it("contas fixas só afetam o saldo quando pagas, sem duplicar", () => {
    const v = emptyVault();
    const r = {
      id: "rent",
      description: "Aluguel",
      amount: 150000,
      day: 31,
      type: "expense" as const,
      category: "Moradia",
      start: "2026-11-01",
      automatic: false,
    };
    v.recurring = [r];
    expect(totals(monthEntries(v, "2026-11")).expense).toBe(0);
    const paid = settleRecurring(v, r, "2026-11", "2026-11-22");
    expect(totals(monthEntries(paid, "2026-11")).expense).toBe(150000);
    expect(settleRecurring(paid, r, "2026-11", "2026-11-22").entries).toHaveLength(1);
  });
  it("repete lançamento mensalmente a partir da data inicial", () => {
    const v = emptyVault();
    v.recurring = [
      {
        id: "x",
        description: "Salário",
        amount: 250000,
        day: 5,
        type: "income",
        category: "Salário",
        start: "2026-11-05",
        automatic: true,
      },
    ];
    expect(monthEntries(v, "2026-10")).toHaveLength(0);
    expect(totals(monthEntries(v, "2026-12")).income).toBe(250000);
  });
  it("registra cobrança recebida como receita uma única vez", () => {
    const v = emptyVault();
    v.charges = [
      {
        id: "x",
        person: "Ana",
        description: "Serviço",
        amount: 45000,
        date: "2026-11-20",
        received: false,
      },
    ];
    const paid = receiveCharge(v, "x", true, "2026-11-22");
    expect(paid.charges[0]?.received).toBe(true);
    expect(totals(paid.entries).income).toBe(45000);
    expect(receiveCharge(paid, "x", true, "2026-11-22").entries).toHaveLength(1);
  });
  it("permite receber cobrança sem gerar receita", () => {
    const v = emptyVault();
    v.charges = [
      {
        id: "x",
        person: "Ana",
        description: "Serviço",
        amount: 45000,
        date: "2026-11-20",
        received: false,
      },
    ];
    expect(receiveCharge(v, "x", false, "2026-11-22").entries).toHaveLength(0);
  });
  it("backup inclui todas as entidades e configurações e rejeita inválidos", () => {
    const v = emptyVault();
    v.categories.income.push("Personalizada");
    expect(parseBackup(JSON.stringify(v))).toEqual(v);
    expect(() => parseBackup('{"entries":[]}')).toThrow();
  });
  it("formata reais e datas brasileiros e valida valores", () => {
    expect(money(123456)).toContain("1.234,56");
    expect(displayDate("2026-11-22")).toBe("22/11/2026");
    expect(parseAmount("1.234,56")).toBe(123456);
    expect(() => parseAmount("-10")).toThrow();
    expect(() => parseAmount("0")).toThrow();
  });
  it("ajusta vencimento ao último dia de meses curtos", () => {
    expect(dueDate("2027-02", 31)).toBe("2027-02-28");
    expect(dueDate("2028-02", 31)).toBe("2028-02-29");
  });
});
