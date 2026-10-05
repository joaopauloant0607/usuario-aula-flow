import type { Route } from './+types/subscriptions';
import { seo } from '@/lib/seo';
import { requireAuth } from '@/lib/require-auth';
import { SubscriptionAccount } from '@/components/subscription-account';
export function meta({matches,location}:Route.MetaArgs){return seo({matches,location},{title:'Minha assinatura — Aulaflow',description:'Gerencie sua assinatura e seu acesso ao Aulaflow.',noindex:true});}
export function clientLoader(){requireAuth();return null;}
clientLoader.hydrate=true as const;
export function HydrateFallback(){return <main className="skeleton">Carregando sua conta…</main>;}
export default function Subscriptions(){return <main className="page-shell"><SubscriptionAccount/></main>;}
