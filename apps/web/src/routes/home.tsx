import type { Route } from './+types/home';
import { seo } from '@/lib/seo';
import { getProducts } from '@/api/ecommerce-api';
import { Hero } from '@/components/home/hero';
import { Benefits } from '@/components/home/benefits';
export async function loader(){try{return {plans:(await getProducts({type:'subscription'})).products,error:false};}catch{return {plans:[],error:true};}}
export function meta({matches,location}:Route.MetaArgs){return seo({matches,location},{title:'Aulaflow — Sua rotina de aulas, organizada',description:'Organize alunos, agenda e recebimentos de aulas particulares em um só lugar. Mais tempo para o que importa: ensinar.'});}
export default function Home({loaderData}:Route.ComponentProps){return <main><Hero/><Benefits plans={loaderData.plans} plansError={loaderData.error}/></main>;}
