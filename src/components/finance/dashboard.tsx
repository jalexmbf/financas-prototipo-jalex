import { useEffect, useState, useRef, type ReactNode, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  LayoutDashboard,
  Users,
  ShieldCheck,
  Download,
  Upload,
  Copy,
  Check,
  X,
  Pencil,
  Trash2,
  CalendarDays,
  TrendingUp,
  Repeat2,
  ReceiptText,
  ListFilter,
  Cloud,
  LogOut,
  RefreshCw,
  CircleDollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { loadVault, saveVault } from "@/lib/finance.functions";
import {
  emptyVault,
  money,
  today,
  displayDate,
  parseAmount,
  monthEntries,
  totals,
  dueDate,
  recurringSource,
  settleRecurring,
  receiveCharge,
  parseBackup,
  entrySchema,
  recurringSchema,
  chargeSchema,
  type Vault,
  type Entry,
  type Recurring,
  type Charge,
} from "@/lib/finance";
import { Toaster, toast } from "sonner";
import { DateInput } from "./date-input";

type ModalState =
  | { kind: "entry"; entry: Entry }
  | { kind: "recurring"; type: "income" | "expense"; item?: Recurring }
  | { kind: "charge"; charge: Charge }
  | { kind: "receive"; charge: Charge }
  | { kind: "category"; type: "income" | "expense" }
  | { kind: "delete"; label: string; action: () => Promise<boolean> }
  | { kind: "restore"; vault: Vault }
  | null;
function IconButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}
const monthTitle = (month: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(`${month}-15T12:00:00`),
  );
function Stat({
  label,
  value,
  kind,
  caption,
}: {
  label: string;
  value: number;
  kind: "balance" | "income" | "expense";
  caption: string;
}) {
  return (
    <article className={`stat-card ${kind === "balance" ? "balance" : ""}`}>
      <div className="stat-label">
        <span>{label}</span>
        {kind === "balance" ? (
          <Wallet className="positive" />
        ) : kind === "income" ? (
          <ArrowUpRight className="positive" />
        ) : (
          <ArrowDownLeft className="negative" />
        )}
      </div>
      <div
        className={`stat-value ${kind === "expense" || value < 0 ? "negative" : kind === "income" ? "positive" : ""}`}
      >
        {money(value)}
      </div>
      <div className="stat-caption">
        {kind === "balance" ? (
          <ShieldCheck size={12} />
        ) : (
          <span className={`legend-dot ${kind === "expense" ? "expense" : ""}`} />
        )}{" "}
        {caption}
      </div>
    </article>
  );
}
function PanelTitle({
  icon,
  title,
  action,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-head">
      <h2 className="panel-title">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function FinanceDashboard({ tab }: { tab: "summary" | "receivables" }) {
  const [vault, setVault] = useState<Vault>(emptyVault);
  const [version, setVersion] = useState(-1);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [month, setMonth] = useState("2026-11");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [modal, setModal] = useState<ModalState>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [registerIncome, setRegisterIncome] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const owner = useRef<string | null>(null);
  const getVault = useServerFn(loadVault);
  const putVault = useServerFn(saveVault);
  async function reload() {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await getVault();
      setVault(result.vault);
      setVersion(result.version);
      setUpdatedAt(result.updatedAt);
    } catch {
      setLoadError(true);
      toast.error("Não foi possível carregar os dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setMonth(today().slice(0, 7));
    let active = true;
    const apply = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const nextUser = data.session?.user;
      owner.current = nextUser?.id ?? null;
      setUser(nextUser?.id ?? null);
      setEmail(nextUser?.email ?? "");
      if (nextUser) await reload();
      else {
        setVault(emptyVault());
        setVersion(-1);
        setLoading(false);
      }
    };
    void apply();
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT")
        setTimeout(() => {
          if (active) void apply();
        }, 0);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);
  async function change(next: Vault): Promise<boolean> {
    if (!user) {
      toast.error("Entre com sua conta Google para salvar seus dados.");
      return false;
    }
    if (loading || loadError || lock.current) return false;
    lock.current = true;
    setSaving(true);
    const id = user;
    try {
      const result = await putVault({ data: { vault: next, version } });
      if (owner.current === id) {
        setVault(next);
        setVersion(result.version);
        setUpdatedAt(result.updatedAt);
        toast.success("Salvo com segurança");
      }
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
      setLoadError(true);
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  const disabled = !user || loading || saving || loadError;
  const entries = monthEntries(vault, month);
  const total = totals(entries);
  const filtered = entries.filter(
    (e) =>
      (filterType === "all" || e.type === filterType) &&
      (filterCategory === "all" || e.category === filterCategory) &&
      (!filterDate || e.date === filterDate),
  );
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${month}-15T12:00:00`);
    d.setMonth(d.getMonth() - 5 + i);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const t = totals(monthEntries(vault, m));
    return {
      month: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(d).replace(".", ""),
      income: t.income / 100,
      expense: t.expense / 100,
    };
  });
  function moveMonth(delta: number) {
    const d = new Date(`${month}-15T12:00:00`);
    d.setMonth(d.getMonth() + delta);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setFilterDate("");
  }
  async function signIn() {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) toast.error("Não foi possível entrar com Google. Tente novamente.");
    } catch {
      toast.error("Não foi possível entrar. Tente novamente.");
    }
  }
  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    try {
      const entry = entrySchema.parse({
        id: crypto.randomUUID(),
        description: fd.get("description"),
        amount: parseAmount(String(fd.get("amount"))),
        date: fd.get("date"),
        category: fd.get("category"),
        type,
      });
      let next = { ...vault, entries: [...vault.entries, entry] };
      if (fd.get("repeat")) {
        const r = recurringSchema.parse({
          id: crypto.randomUUID(),
          description: entry.description,
          amount: entry.amount,
          day: Number(entry.date.slice(8)),
          type,
          category: entry.category,
          start: entry.date,
          automatic: true,
        });
        entry.source = recurringSource(r.id, entry.date.slice(0, 7));
        next = { ...next, recurring: [...vault.recurring, r] };
      }
      if (await change(next)) {
        form.reset();
        setMonth(entry.date.slice(0, 7));
      }
    } catch {
      toast.error("Preencha a descrição, um valor positivo e uma data válida.");
    }
  }
  async function addCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    try {
      const c = chargeSchema.parse({
        id: crypto.randomUUID(),
        person: fd.get("person"),
        description: fd.get("description"),
        amount: parseAmount(String(fd.get("amount"))),
        date: fd.get("date"),
        received: false,
      });
      if (await change({ ...vault, charges: [...vault.charges, c] })) form.reset();
    } catch {
      toast.error("Preencha todos os campos com um valor positivo e uma data válida.");
    }
  }
  const backup = () => JSON.stringify(vault, null, 2);
  function exportBackup() {
    if (disabled) return;
    const url = URL.createObjectURL(new Blob([backup()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `minhas-financas-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Backup exportado. Guarde-o em Arquivos ou iCloud.");
  }
  async function copyBackup() {
    try {
      await navigator.clipboard.writeText(backup());
      toast.success("Backup completo copiado");
    } catch {
      toast.error("Não foi possível copiar. Use Exportar backup.");
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Arquivo grande");
      setModal({ kind: "restore", vault: parseBackup(await file.text()) });
    } catch {
      toast.error("Backup inválido. Seus dados atuais foram preservados.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  function deleteEntry(e: Entry) {
    setModal({
      kind: "delete",
      label: e.description,
      action: async () => {
        const r = vault.recurring.find(
          (r) => r.automatic && e.source === recurringSource(r.id, month),
        );
        const historical = r
          ? Array.from(new Set(vault.entries.map((x) => x.date.slice(0, 7))))
              .filter((m) => m < month)
              .flatMap((m) =>
                monthEntries(vault, m).filter(
                  (x) =>
                    x.source === recurringSource(r.id, m) &&
                    !vault.entries.some((stored) => stored.source === x.source),
                ),
              )
          : [];
        return change({
          ...vault,
          entries: [...vault.entries.filter((x) => x.id !== e.id), ...historical],
          recurring: r ? vault.recurring.filter((x) => x.id !== r.id) : vault.recurring,
        });
      },
    });
  }
  function recurringSection(kind: "income" | "expense") {
    const items = vault.recurring.filter(
      (r) => r.type === kind && !r.automatic && r.start.slice(0, 7) <= month,
    );
    return (
      <section className="panel">
        <PanelTitle
          icon={kind === "income" ? <Repeat2 /> : <ReceiptText />}
          title={kind === "income" ? "Receitas fixas do mês" : "Contas fixas do mês"}
          action={
            <IconButton
              label={kind === "income" ? "Adicionar receita fixa" : "Adicionar conta fixa"}
              onClick={() => setModal({ kind: "recurring", type: kind })}
              disabled={disabled}
            >
              <Plus />
            </IconButton>
          }
        />
        {items.length === 0 ? (
          <div className="small-empty">
            {kind === "income" ? <CircleDollarSign size={23} /> : <CalendarDays size={23} />}
            <span>{kind === "income" ? "Nenhuma receita fixa" : "Nenhuma conta fixa"}</span>
          </div>
        ) : (
          items.map((r) => {
            const settled = vault.entries.some((e) => e.source === recurringSource(r.id, month));
            const date = dueDate(month, r.day);
            const overdue = !settled && date < today();
            return (
              <div className="recurring-item" key={r.id}>
                <div className="recurring-line">
                  <strong>{r.description}</strong>
                  <span className={kind === "income" ? "positive" : "negative"}>
                    {money(r.amount)}
                  </span>
                </div>
                <div className="recurring-meta">
                  <span>{displayDate(date)}</span>
                  <span className={`status ${settled ? "received" : overdue ? "overdue" : ""}`}>
                    {settled
                      ? kind === "income"
                        ? "Recebida"
                        : "Paga"
                      : overdue
                        ? "Vencida"
                        : "Pendente"}
                  </span>
                </div>
                <div className="recurring-meta">
                  {!settled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => {
                        void change(
                          settleRecurring(
                            vault,
                            r,
                            month,
                            dueDate(month, Number(today().slice(8))),
                          ),
                        );
                      }}
                    >
                      <Check />
                      {kind === "income" ? "Receber" : "Pagar"}
                    </Button>
                  )}
                  <div className="row-actions">
                    <IconButton
                      label={`Editar ${r.description}`}
                      onClick={() => setModal({ kind: "recurring", type: kind, item: r })}
                      disabled={disabled}
                    >
                      <Pencil size={12} />
                    </IconButton>
                    <IconButton
                      label={`Excluir ${r.description}`}
                      onClick={() =>
                        setModal({
                          kind: "delete",
                          label: r.description,
                          action: () =>
                            change({
                              ...vault,
                              recurring: vault.recurring.filter((x) => x.id !== r.id),
                            }),
                        })
                      }
                      disabled={disabled}
                    >
                      <Trash2 size={12} />
                    </IconButton>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    );
  }
  const backupButtons = (
    <div className="backup-actions">
      <Button variant="outline" onClick={copyBackup} disabled={disabled}>
        <Copy />
        Copiar dados
      </Button>
      <Button variant="outline" onClick={exportBackup} disabled={disabled}>
        <Download />
        Exportar backup
      </Button>
      <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={disabled}>
        <Upload />
        Restaurar
      </Button>
    </div>
  );
  async function modalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    if (!modal) return;
    try {
      let next: Vault = vault;
      if (modal.kind === "category") {
        const name = String(fd.get("name")).trim();
        if (!name || name.length > 80) throw new Error();
        if (vault.categories[modal.type].some((c) => c.toLowerCase() === name.toLowerCase())) {
          toast.error("Essa categoria já existe.");
          return;
        }
        next = {
          ...vault,
          categories: {
            ...vault.categories,
            [modal.type]: [...vault.categories[modal.type], name],
          },
        };
      }
      if (modal.kind === "recurring") {
        const r = recurringSchema.parse({
          id: modal.item?.id ?? crypto.randomUUID(),
          description: fd.get("description"),
          amount: parseAmount(String(fd.get("amount"))),
          day: Number(fd.get("day")),
          type: modal.type,
          category: modal.type === "income" ? "Salário" : "Contas",
          start: modal.item?.start ?? `${month}-01`,
          automatic: false,
        });
        next = {
          ...vault,
          recurring: modal.item
            ? vault.recurring.map((x) => (x.id === r.id ? r : x))
            : [...vault.recurring, r],
        };
      }
      if (modal.kind === "entry") {
        const e = entrySchema.parse({
          ...modal.entry,
          description: fd.get("description"),
          amount: parseAmount(String(fd.get("amount"))),
          date: fd.get("date"),
          type: fd.get("type"),
          category: fd.get("category"),
        });
        next = {
          ...vault,
          entries: vault.entries.some((x) => x.id === e.id)
            ? vault.entries.map((x) => (x.id === e.id ? e : x))
            : [...vault.entries, e],
        };
      }
      if (modal.kind === "charge") {
        const c = chargeSchema.parse({
          ...modal.charge,
          person: fd.get("person"),
          description: fd.get("description"),
          amount: parseAmount(String(fd.get("amount"))),
          date: fd.get("date"),
        });
        next = {
          ...vault,
          charges: vault.charges.map((x) => (x.id === c.id ? c : x)),
          entries: vault.entries.map((e) =>
            e.source === `charge:${c.id}`
              ? { ...e, description: `${c.person} · ${c.description}`, amount: c.amount }
              : e,
          ),
        };
      }
      if (modal.kind === "receive") {
        next = receiveCharge(vault, modal.charge.id, registerIncome, today());
      }
      if (await change(next)) setModal(null);
    } catch {
      toast.error("Confira os campos: valor positivo, descrição e data válidos; dia de 1 a 31.");
    }
  }
  const charges = vault.charges.filter(
    (c) =>
      statusFilter === "all" ||
      (statusFilter === "received"
        ? c.received
        : statusFilter === "overdue"
          ? !c.received && c.date < today()
          : !c.received && c.date >= today()),
  );
  const receivable = vault.charges.filter((c) => !c.received).reduce((s, c) => s + c.amount, 0);
  const received = vault.charges.filter((c) => c.received).reduce((s, c) => s + c.amount, 0);
  return (
    <div className="app-shell">
      <Toaster theme="dark" position="top-center" richColors />
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="brand-title">
              Minhas Finanças<span className="positive">.</span>
            </div>
            <div className="brand-caption">Seu dinheiro, com mais clareza.</div>
          </div>
        </div>
        <div className="header-actions">
          <span className="secure-note">
            <ShieldCheck size={14} />
            Seu espaço pessoal
          </span>
          {user ? (
            <>
              <IconButton
                label="Atualizar dados"
                onClick={() => {
                  void reload();
                }}
                disabled={saving}
              >
                <RefreshCw />
              </IconButton>
              <span className="avatar" title={email}>
                {email.charAt(0).toUpperCase() || <Wallet size={16} />}
              </span>
              <IconButton
                label="Sair da conta"
                disabled={saving}
                onClick={() => {
                  void supabase.auth.signOut();
                }}
              >
                <LogOut />
              </IconButton>
            </>
          ) : (
            <div className="avatar">
              <Wallet size={16} />
            </div>
          )}
        </div>
      </header>
      <nav className="page-nav" aria-label="Abas principais">
        <Link to="/" className={tab === "summary" ? "active" : ""}>
          <LayoutDashboard size={17} />
          Resumo
        </Link>
        <Link to="/a-receber" className={tab === "receivables" ? "active" : ""}>
          <Users size={17} />A receber
        </Link>
      </nav>
      {!loading && !user && (
        <div className="auth-banner">
          <div>
            <strong>Suas finanças em um espaço só seu.</strong>
            <p>Acesso pessoal com Google. Dados privados e salvos no Lovable Cloud.</p>
          </div>
          <Button variant="google" onClick={signIn}>
            <GoogleMark />
            Continuar com Google
          </Button>
        </div>
      )}
      {loadError && (
        <div className="auth-banner">
          <div>
            <strong>Seus dados não foram alterados.</strong>
            <p>Recarregue para continuar com a versão salva.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void reload();
            }}
          >
            <RefreshCw />
            Recarregar dados
          </Button>
        </div>
      )}
      <div className="page-heading">
        <div>
          <h1>{tab === "summary" ? "Resumo financeiro" : "A receber"}</h1>
          <p>
            {tab === "summary"
              ? "Um olhar tranquilo sobre o seu mês."
              : "Acompanhe seus pagamentos, sem deixar nada para trás."}
          </p>
        </div>
        {tab === "summary" && (
          <div className="month-select">
            <IconButton label="Mês anterior" onClick={() => moveMonth(-1)}>
              <ChevronLeft />
            </IconButton>
            <input
              aria-label="Mês e ano"
              type="month"
              lang="pt-BR"
              value={month}
              onChange={(e) => {
                if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value);
              }}
            />
            <IconButton label="Próximo mês" onClick={() => moveMonth(1)}>
              <ChevronRight />
            </IconButton>
          </div>
        )}
      </div>
      {tab === "summary" ? (
        <>
          <div className="overview-grid">
            <Stat
              label="Saldo do mês"
              value={total.balance}
              kind="balance"
              caption={
                total.income > 0
                  ? `${Math.round((total.expense / total.income) * 100)}% das receitas em despesas`
                  : total.expense > 0
                    ? "Sem receitas registradas"
                    : "Seu saldo começa aqui"
              }
            />
            <Stat
              label="Receitas"
              value={total.income}
              kind="income"
              caption={`${entries.filter((e) => e.type === "income").length} lançamentos neste mês`}
            />
            <Stat
              label="Despesas"
              value={total.expense}
              kind="expense"
              caption={`${entries.filter((e) => e.type === "expense").length} lançamentos neste mês`}
            />
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <PanelTitle icon={<Plus />} title="Novo lançamento" />
              <form className="entry-form" onSubmit={addEntry}>
                <div className="kind-toggle">
                  <Button
                    type="button"
                    variant="ghost"
                    className={type === "expense" ? "expense-selected" : ""}
                    onClick={() => setType("expense")}
                  >
                    <ArrowDownLeft />
                    Despesa
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={type === "income" ? "income-selected" : ""}
                    onClick={() => setType("income")}
                  >
                    <ArrowUpRight />
                    Receita
                  </Button>
                </div>
                <Field label="Descrição">
                  <input
                    name="description"
                    required
                    maxLength={120}
                    placeholder={
                      type === "expense" ? "Ex.: compras do mercado" : "Ex.: pagamento recebido"
                    }
                  />
                </Field>
                <div className="field-row">
                  <Field label="Valor (R$)">
                    <input name="amount" required inputMode="decimal" placeholder="0,00" />
                  </Field>
                  <Field label="Data">
                    <DateInput name="date" required defaultValue={today()} />
                  </Field>
                </div>
                <div>
                  <div className="field-heading">
                    <label className="field" htmlFor="entry-category">
                      Categoria
                    </label>
                    <Button
                      variant="ghost"
                      type="button"
                      size="sm"
                      disabled={disabled}
                      onClick={() => setModal({ kind: "category", type })}
                    >
                      <Plus />
                      Nova categoria
                    </Button>
                  </div>
                  <label className="field">
                    <select id="entry-category" name="category" key={type} required defaultValue="">
                      <option value="" disabled>
                        Selecionar categoria
                      </option>
                      {vault.categories[type].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="repeat">
                  <input name="repeat" type="checkbox" />
                  <Repeat2 size={14} />
                  Repetir mensalmente
                </label>
                <Button className="submit-button" disabled={disabled} type="submit">
                  <Plus />
                  {saving ? "Salvando…" : "Adicionar lançamento"}
                </Button>
              </form>
            </section>
            <div className="right-column">
              <section className="panel chart-panel">
                <PanelTitle
                  icon={<TrendingUp />}
                  title="Seu histórico mensal"
                  action={
                    <div className="chart-legend">
                      <span>
                        <i className="legend-dot" />
                        Receitas
                      </span>
                      <span>
                        <i className="legend-dot expense" />
                        Despesas
                      </span>
                    </div>
                  }
                />
                <p className="panel-subtitle">Receitas e despesas nos últimos 6 meses</p>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--border)"
                        strokeDasharray="3 5"
                      />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        dy={8}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                        tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000} mil` : `${v}`)}
                        width={50}
                        domain={[0, "auto"]}
                      />
                      <Tooltip
                        formatter={(v: number) => money(Math.round(v * 100))}
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "var(--foreground)" }}
                      />
                      <Area
                        name="Receitas"
                        type="monotone"
                        dataKey="income"
                        stroke="var(--primary)"
                        fill="var(--income-soft)"
                        strokeWidth={2}
                        fillOpacity={0.5}
                      />
                      <Area
                        name="Despesas"
                        type="monotone"
                        dataKey="expense"
                        stroke="var(--destructive)"
                        fill="var(--expense-soft)"
                        strokeWidth={2}
                        fillOpacity={0.4}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <div className="recurring-grid">
                {recurringSection("income")}
                {recurringSection("expense")}
              </div>
            </div>
          </div>
          <section className="history-section">
            <div className="section-heading">
              <div>
                <h2>
                  <ListFilter />
                  Lançamentos <span className="transaction-category">{entries.length}</span>
                </h2>
                <p>Suas movimentações de {monthTitle(month)}.</p>
              </div>
              {backupButtons}
            </div>
            <div className="filters">
              <select
                className="filter-input"
                aria-label="Filtrar por tipo"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">Todos os tipos</option>
                <option value="income">Receitas</option>
                <option value="expense">Despesas</option>
              </select>
              <select
                className="filter-input"
                aria-label="Filtrar por categoria"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">Todas as categorias</option>
                {Array.from(new Set([...vault.categories.income, ...vault.categories.expense])).map(
                  (c) => (
                    <option key={c}>{c}</option>
                  ),
                )}
              </select>
              <DateInput ariaLabel="Filtrar por data" value={filterDate} onChange={setFilterDate} />
              {(filterDate || filterType !== "all" || filterCategory !== "all") && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFilterType("all");
                    setFilterCategory("all");
                    setFilterDate("");
                  }}
                >
                  <X />
                  Limpar
                </Button>
              )}
            </div>
            <div className="history-table">
              <div className="table-header">
                <span>DESCRIÇÃO</span>
                <span>CATEGORIA</span>
                <span>DATA</span>
                <span className="text-right">VALOR</span>
                <span />
              </div>
              {filtered.length === 0 ? (
                <div className="empty-history">
                  <ReceiptText size={29} />
                  <strong>
                    {loading
                      ? "Carregando suas finanças…"
                      : entries.length
                        ? "Nenhum lançamento com esses filtros"
                        : "Seu mês está pronto para começar"}
                  </strong>
                  <p>{entries.length ? "" : "Nenhum lançamento neste mês."}</p>
                </div>
              ) : (
                filtered.map((e) => (
                  <div className="transaction" key={e.id}>
                    <div className="transaction-name">
                      <div className={`transaction-icon ${e.type === "expense" ? "expense" : ""}`}>
                        {e.type === "income" ? <ArrowUpRight /> : <ArrowDownLeft />}
                      </div>
                      <div>
                        <strong>{e.description}</strong>
                        <small>
                          {e.type === "income" ? "Receita" : "Despesa"} · {displayDate(e.date)}
                          {e.source?.startsWith("recurring:") ? " · Mensal" : ""}
                        </small>
                      </div>
                    </div>
                    <span className="transaction-category">{e.category}</span>
                    <span className="transaction-date text-muted-foreground">
                      {displayDate(e.date)}
                    </span>
                    <span
                      className={`transaction-amount ${e.type === "income" ? "positive" : "negative"}`}
                    >
                      {e.type === "income" ? "+" : "−"} {money(e.amount)}
                    </span>
                    <div className="row-actions">
                      <IconButton
                        label={`Editar ${e.description}`}
                        disabled={disabled}
                        onClick={() => setModal({ kind: "entry", entry: e })}
                      >
                        <Pencil />
                      </IconButton>
                      <IconButton
                        label={`Excluir ${e.description}`}
                        disabled={disabled}
                        onClick={() => deleteEntry(e)}
                      >
                        <Trash2 />
                      </IconButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="overview-grid">
            <Stat
              label="Total a receber"
              value={receivable}
              kind="balance"
              caption={`${vault.charges.filter((c) => !c.received).length} cobranças em aberto`}
            />
            <Stat
              label="Total já recebido"
              value={received}
              kind="income"
              caption={`${vault.charges.filter((c) => c.received).length} pagamentos recebidos`}
            />
            <Stat
              label="Pagamentos atrasados"
              value={vault.charges
                .filter((c) => !c.received && c.date < today())
                .reduce((s, c) => s + c.amount, 0)}
              kind="expense"
              caption="Cobranças com data vencida"
            />
          </div>
          <div className="charge-grid">
            <section className="panel">
              <PanelTitle icon={<Plus />} title="Nova cobrança" />
              <form className="entry-form" onSubmit={addCharge}>
                <Field label="Nome de quem deve">
                  <input name="person" required maxLength={120} placeholder="Ex.: Ana Oliveira" />
                </Field>
                <Field label="Referência ou descrição">
                  <input
                    name="description"
                    required
                    maxLength={120}
                    placeholder="Ex.: serviço de novembro"
                  />
                </Field>
                <Field label="Valor (R$)">
                  <input name="amount" required inputMode="decimal" placeholder="0,00" />
                </Field>
                <Field label="Data prevista de pagamento">
                  <DateInput name="date" required defaultValue={today()} />
                </Field>
                <Button className="submit-button" disabled={disabled} type="submit">
                  <Plus />
                  Adicionar cobrança
                </Button>
              </form>
            </section>
            <section>
              <div className="section-heading">
                <h2>
                  <Users />
                  Cobranças
                </h2>
                <select
                  className="filter-input max-w-44"
                  aria-label="Filtrar cobranças por status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Todos os status</option>
                  <option value="pending">Pendentes</option>
                  <option value="received">Recebidas</option>
                  <option value="overdue">Atrasadas</option>
                </select>
              </div>
              <div className="charge-list">
                {charges.length === 0 ? (
                  <div className="empty-history">
                    <Users size={30} />
                    <strong>Nenhuma cobrança por aqui</strong>
                    <p>
                      {vault.charges.length
                        ? "Nenhum resultado para este filtro."
                        : "Seus pagamentos a receber aparecerão aqui."}
                    </p>
                  </div>
                ) : (
                  charges.map((c) => (
                    <article className="charge-item" key={c.id}>
                      <div className="charge-top">
                        <div>
                          <h3>{c.person}</h3>
                          <p>{c.description}</p>
                          <p>
                            <CalendarDays size={12} className="inline" /> {displayDate(c.date)}
                          </p>
                        </div>
                        <span
                          className={`status ${c.received ? "received" : c.date < today() ? "overdue" : ""}`}
                        >
                          {c.received ? "Recebido" : c.date < today() ? "Atrasado" : "Pendente"}
                        </span>
                      </div>
                      <div className="charge-bottom">
                        <strong className="amount-large positive">{money(c.amount)}</strong>
                        <div className="row-actions">
                          {!c.received && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={disabled}
                              onClick={() => {
                                setRegisterIncome(true);
                                setModal({ kind: "receive", charge: c });
                              }}
                            >
                              <Check />
                              Receber
                            </Button>
                          )}
                          <IconButton
                            label={`Editar cobrança de ${c.person}`}
                            disabled={disabled}
                            onClick={() => setModal({ kind: "charge", charge: c })}
                          >
                            <Pencil />
                          </IconButton>
                          <IconButton
                            label={`Excluir cobrança de ${c.person}`}
                            disabled={disabled}
                            onClick={() =>
                              setModal({
                                kind: "delete",
                                label: `Cobrança de ${c.person}`,
                                action: () =>
                                  change({
                                    ...vault,
                                    charges: vault.charges.filter((x) => x.id !== c.id),
                                  }),
                              })
                            }
                          >
                            <Trash2 />
                          </IconButton>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
          <section className="history-section">{backupButtons}</section>
        </>
      )}
      <footer className="app-footer">
        <span>
          <Cloud size={12} />
          {saving
            ? "Salvando no Lovable Cloud…"
            : loading
              ? "Carregando dados…"
              : user
                ? updatedAt
                  ? `Salvo no Lovable Cloud · ${displayDate(updatedAt.slice(0, 10))}`
                  : "Armazenamento privado no Lovable Cloud"
                : "Dados privados no Lovable Cloud após entrar"}
        </span>
        <span>
          <ShieldCheck size={12} />
          Minhas Finanças · Seu controle pessoal
        </span>
      </footer>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label="Importar backup"
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
        }}
      />
      <Dialog.Root
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setModal(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content
            className="modal fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2"
            aria-describedby={undefined}
          >
            <div className="modal-header">
              <Dialog.Title asChild>
                <h2>
                  {modal?.kind === "entry"
                    ? "Editar lançamento"
                    : modal?.kind === "charge"
                      ? "Editar cobrança"
                      : modal?.kind === "category"
                        ? "Nova categoria"
                        : modal?.kind === "recurring"
                          ? modal.item
                            ? "Editar recorrência"
                            : modal.type === "income"
                              ? "Nova receita fixa"
                              : "Nova conta fixa"
                          : modal?.kind === "receive"
                            ? "Confirmar recebimento"
                            : modal?.kind === "restore"
                              ? "Restaurar backup"
                              : "Excluir registro"}
                </h2>
              </Dialog.Title>
              <IconButton label="Fechar" disabled={saving} onClick={() => setModal(null)}>
                <X />
              </IconButton>
            </div>
            {modal?.kind === "delete" ? (
              <div className="modal-body">
                <p>
                  Excluir <strong>{modal.label}</strong>? Esta ação não pode ser desfeita.
                  Recebimentos já registrados serão mantidos. Lançamentos mensais automáticos terão
                  sua repetição encerrada ao excluir.
                </p>
                <div className="modal-actions">
                  <Button variant="outline" disabled={saving} onClick={() => setModal(null)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={saving}
                    onClick={async () => {
                      if (await modal.action()) setModal(null);
                    }}
                  >
                    <Trash2 />
                    Excluir
                  </Button>
                </div>
              </div>
            ) : modal?.kind === "restore" ? (
              <div className="modal-body">
                <p>
                  Este backup contém {modal.vault.entries.length} lançamentos,{" "}
                  {modal.vault.recurring.length} recorrências e {modal.vault.charges.length}{" "}
                  cobranças. Ele substituirá seus dados atuais, incluindo categorias e
                  configurações. Exporte um backup antes de continuar.
                </p>
                <div className="modal-actions">
                  <Button variant="outline" onClick={exportBackup}>
                    <Download />
                    Exportar atual
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={async () => {
                      if (await change(modal.vault)) setModal(null);
                    }}
                  >
                    <Upload />
                    Restaurar
                  </Button>
                </div>
              </div>
            ) : (
              <form className="modal-body" onSubmit={modalSubmit} key={modal?.kind}>
                {modal?.kind === "category" && (
                  <Field label="Nome da categoria">
                    <input name="name" required maxLength={80} autoFocus placeholder="Ex.: Pets" />
                  </Field>
                )}
                {modal?.kind === "receive" && (
                  <>
                    <p>
                      Confirmar o recebimento de <strong>{money(modal.charge.amount)}</strong> de{" "}
                      {modal.charge.person}, em {displayDate(today())}?
                    </p>
                    <label className="repeat">
                      <input
                        type="checkbox"
                        checked={registerIncome}
                        onChange={(e) => setRegisterIncome(e.target.checked)}
                      />
                      Registrar também como receita no Resumo
                    </label>
                  </>
                )}
                {modal?.kind === "charge" && (
                  <Field label="Nome de quem deve">
                    <input
                      name="person"
                      required
                      maxLength={120}
                      defaultValue={modal.charge.person}
                    />
                  </Field>
                )}
                {(modal?.kind === "entry" ||
                  modal?.kind === "charge" ||
                  modal?.kind === "recurring") && (
                  <>
                    <Field label="Descrição">
                      <input
                        name="description"
                        required
                        maxLength={120}
                        defaultValue={
                          modal.kind === "entry"
                            ? modal.entry.description
                            : modal.kind === "charge"
                              ? modal.charge.description
                              : modal.item?.description
                        }
                      />
                    </Field>
                    <Field label="Valor (R$)">
                      <input
                        name="amount"
                        required
                        inputMode="decimal"
                        defaultValue={
                          modal.kind === "entry"
                            ? (modal.entry.amount / 100).toFixed(2).replace(".", ",")
                            : modal.kind === "charge"
                              ? (modal.charge.amount / 100).toFixed(2).replace(".", ",")
                              : modal.item
                                ? (modal.item.amount / 100).toFixed(2).replace(".", ",")
                                : ""
                        }
                        placeholder="0,00"
                      />
                    </Field>
                    {modal.kind === "recurring" ? (
                      <Field
                        label={
                          modal.type === "income"
                            ? "Dia previsto para recebimento"
                            : "Dia do vencimento"
                        }
                      >
                        <input
                          name="day"
                          type="number"
                          inputMode="numeric"
                          required
                          min={1}
                          max={31}
                          defaultValue={modal.item?.day ?? 5}
                        />
                      </Field>
                    ) : (
                      <Field label="Data">
                        <DateInput
                          name="date"
                          required
                          defaultValue={
                            modal.kind === "entry" ? modal.entry.date : modal.charge.date
                          }
                        />
                      </Field>
                    )}
                    {modal.kind === "entry" && (
                      <div className="field-row">
                        <Field label="Tipo">
                          <select name="type" defaultValue={modal.entry.type}>
                            <option value="income">Receita</option>
                            <option value="expense">Despesa</option>
                          </select>
                        </Field>
                        <Field label="Categoria">
                          <select name="category" defaultValue={modal.entry.category}>
                            {Array.from(
                              new Set([...vault.categories.income, ...vault.categories.expense]),
                            ).map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    )}
                  </>
                )}
                <div className="modal-actions">
                  <Button
                    variant="outline"
                    type="button"
                    disabled={saving}
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={disabled}>
                    <Check />
                    {saving
                      ? "Salvando…"
                      : modal?.kind === "receive"
                        ? "Confirmar recebimento"
                        : "Salvar"}
                  </Button>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
