import { createFileRoute } from '@tanstack/react-router';
import { FinanceDashboard } from '@/components/finance/dashboard';
export const Route = createFileRoute('/a-receber')({
 head:()=>({meta:[
  {title:'A receber | Minhas Finanças'},
  {name:'description',content:'Acompanhe cobranças, pagamentos pendentes e recebidos no seu controle financeiro pessoal.'},
  {property:'og:title',content:'A receber | Minhas Finanças'},
  {property:'og:description',content:'Controle quem precisa pagar você e registre os recebimentos sem duplicidade.'},
  {property:'og:type',content:'website'},
  {name:'twitter:card',content:'summary_large_image'},
 ]}),
 component:()=> <FinanceDashboard tab="receivables" />,
});