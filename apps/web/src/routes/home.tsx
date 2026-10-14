import type { Route } from './+types/home';
import { seo } from '@/lib/seo';
import { Hero } from '@/components/home/hero';
import { Benefits } from '@/components/home/benefits';
export function meta({matches,location}:Route.MetaArgs){return seo({matches,location},{title:'Aulaflow — Sua rotina de aulas, organizada',description:'Organize alunos, agenda e recebimentos de aulas particulares em um só lugar. Mais tempo para o que importa: ensinar.'});}
export default function Home(){return <main><Hero/><Benefits/></main>;}
