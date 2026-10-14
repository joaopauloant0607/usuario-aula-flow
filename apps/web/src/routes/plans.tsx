import type { Route } from './+types/plans';
import { seo } from '@/lib/seo';
import { PlanList } from '@/components/plan-list';
export function meta({matches,location}:Route.MetaArgs){return seo({matches,location},{title:'Assinatura — Aulaflow',description:'Escolha sua assinatura e simplifique a gestão de aulas particulares.'});}
export default function Plans(){return <main className="page-shell"><span className="eyebrow">INVISTA EM UMA ROTINA MAIS LEVE</span><h1>Mais organização.<br/>Menos complicação.</h1><p>Escolha seu plano e comece com uma conta própria. Comece com 7 dias grátis, sem cartão de crédito. Depois, escolha o plano que preferir.</p><PlanList/></main>;}
