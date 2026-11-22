import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v + 'T12:00:00'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === v; }, 'Data inválida');
const amount = z.number().int().positive().max(999999999999);
const kind = z.enum(['income', 'expense']);
export const entrySchema = z.object({ id: z.string().min(1), description: z.string().trim().min(1).max(120), amount, date, category: z.string().min(1).max(80), type: kind, source: z.string().optional() });
export const recurringSchema = z.object({ id: z.string().min(1), description: z.string().trim().min(1).max(120), amount, day: z.number().int().min(1).max(31), type: kind, category: z.string().min(1), start: date, automatic: z.boolean() });
export const chargeSchema = z.object({ id: z.string().min(1), person: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(120), amount, date, received: z.boolean(), receivedDate: date.optional() });
export const vaultSchema = z.object({ schemaVersion: z.literal(1), entries: z.array(entrySchema).max(50000), recurring: z.array(recurringSchema).max(5000), charges: z.array(chargeSchema).max(50000), categories: z.object({ income: z.array(z.string().min(1).max(80)), expense: z.array(z.string().min(1).max(80)) }), settings: z.object({ currency: z.literal('BRL'), locale: z.literal('pt-BR') }) });
export type Vault = z.infer<typeof vaultSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Recurring = z.infer<typeof recurringSchema>;
export type Charge = z.infer<typeof chargeSchema>;
export const emptyVault = (): Vault => ({ schemaVersion: 1, entries: [], recurring: [], charges: [], categories: { expense: ['Moradia','Alimentação','Transporte','Lazer','Saúde','Compras','Educação','Contas','Assinaturas','Outros'], income: ['Salário','Pagamentos','Serviços','Vendas','Transferências','Outros'] }, settings: { currency: 'BRL', locale: 'pt-BR' } });
export const money = (cents: number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents / 100);
export const displayDate = (value: string) => value.split('-').reverse().join('/');
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export function parseAmount(value: string) { const clean = value.trim().replace(/R\$\s*/g,''); const normalized = clean.includes(',') ? clean.replace(/\./g,'').replace(',','.') : clean; if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Informe um valor válido, como 150,00.'); const cents = Math.round(Number(normalized)*100); amount.parse(cents); return cents; }
export function dueDate(month: string, day: number) { const [y,m] = month.split('-').map(Number); if (!y || !m) throw new Error('Mês inválido'); const last = new Date(y,m,0).getDate(); return `${month}-${String(Math.min(day,last)).padStart(2,'0')}`; }
export const recurringSource = (id: string, month: string) => `recurring:${id}:${month}`;
export function monthEntries(vault: Vault, month: string): Entry[] {
  const entries = vault.entries.filter(e => e.date.startsWith(month));
  const auto = vault.recurring.filter(r => r.automatic && r.start.slice(0,7) <= month).filter(r => !entries.some(e => e.source === recurringSource(r.id,month))).map(r => ({ id: recurringSource(r.id,month), description:r.description, amount:r.amount, date:dueDate(month,r.day), category:r.category, type:r.type, source:recurringSource(r.id,month) }));
  return [...entries,...auto].sort((a,b) => b.date.localeCompare(a.date));
}
export function totals(entries: Entry[]) { const income = entries.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0); const expense = entries.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0); return {income,expense,balance:income-expense}; }
export function settleRecurring(v: Vault, r: Recurring, month: string, paidDate: string): Vault { const source = recurringSource(r.id,month); if(v.entries.some(e=>e.source===source)) return v; return {...v,entries:[...v.entries,{id:crypto.randomUUID(),description:r.description,amount:r.amount,date:paidDate,type:r.type,category:r.category,source}]}; }
export function receiveCharge(v: Vault, id: string, register: boolean, paidDate: string): Vault { const c = v.charges.find(c=>c.id===id); if(!c || c.received) return v; const source = `charge:${id}`; return {...v,charges:v.charges.map(c=>c.id===id?{...c,received:true,receivedDate:paidDate}:c),entries:register && !v.entries.some(e=>e.source===source)?[...v.entries,{id:crypto.randomUUID(),description:`${c.person} · ${c.description}`,amount:c.amount,date:paidDate,type:'income',category:'Pagamentos',source}]:v.entries}; }
export function parseBackup(text: string): Vault { const value: unknown = JSON.parse(text); const parsed = vaultSchema.parse(value); for(const list of [parsed.entries,parsed.recurring,parsed.charges]) { const ids=list.map(x=>x.id); if(new Set(ids).size!==ids.length) throw new Error('Backup contém registros duplicados.'); } const sources=parsed.entries.flatMap(e=>e.source?[e.source]:[]); if(new Set(sources).size!==sources.length) throw new Error('Backup contém recebimentos duplicados.'); return parsed; }