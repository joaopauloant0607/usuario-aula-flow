import type { Route } from './+types/login';
import { seo } from '@/lib/seo';
import { AuthForm } from '@/components/auth-form';
export function meta({matches,location}:Route.MetaArgs){return seo({matches,location},{title:'Entrar — Aulaflow',description:'Acesse seu espaço de ensino ou crie sua conta no Aulaflow.'});}
export default function Login(){return <main className="page-shell"><AuthForm/></main>;}
