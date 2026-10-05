import { Link } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { Layers, ArrowUpRight } from 'lucide-react';
export function SiteHeader() { const {isAuthed,isLoading}=useAuth(); return <header className="site-header"><Link className="brand" to="/"><Layers size={25}/> aula<span>flow</span><i/></Link><nav><a href="/#recursos">Recursos</a><a href="/#como-funciona">Como funciona</a><a href="/#planos">Planos</a></nav><div className="header-actions"><Link to={isAuthed?'/app':'/login'}>{isLoading?'Minha conta':isAuthed?'Meu espaço':'Entrar'}</Link><a className="button small" href="/#planos">Começar agora <ArrowUpRight size={16}/></a></div></header>; }
