import { createFileRoute } from "@tanstack/react-router";
import { FinanceDashboard } from "@/components/finance/dashboard";

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Resumo financeiro | Minhas Finanças" },
      {
        name: "description",
        content:
          "Controle suas receitas, despesas, contas fixas e saldo mensal com segurança no Minhas Finanças.",
      },
      { property: "og:title", content: "Resumo financeiro | Minhas Finanças" },
      {
        property: "og:description",
        content: "Seu saldo, lançamentos e contas em um controle financeiro pessoal seguro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return <FinanceDashboard tab="summary" />;
}
