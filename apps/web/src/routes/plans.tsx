import type { Route } from './+types/plans';
import { seo } from '@/lib/seo';
import { getProducts } from '@/api/ecommerce-api';
import { PlanList } from '@/components/plan-list';
export async function loader(){try{return {plans:(await getProducts({type:'subscription'})).products,error:false};}catch{return {plans:[],error:true};}}
export function meta({matches,location}:Route.MetaArgs){return seo({matches,location},{title:'Assinatura — Aulaflow',description:'Escolha sua assinatura e simplifique a gestão de aulas particulares.'});}
export default function Plans({loaderData}:Route.ComponentProps){return <main className="page-shell"><span className="eyebrow">INVISTA EM UMA ROTINA MAIS LEVE</span><h1>Mais organização.<br/>Menos complicação.</h1><p>Escolha seu plano e comece com uma conta própria. A assinatura é paga desde o início.</p>{loaderData.error?<p className="notice">Não foi possível carregar os planos. Atualize a página para tentar novamente.</p>:<PlanList plans={loaderData.plans}/>}</main>;}
