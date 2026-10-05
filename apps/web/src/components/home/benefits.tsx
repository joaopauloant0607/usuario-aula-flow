import { Users, CalendarDays, Wallet, LayoutDashboard, Repeat, ShieldCheck, ArrowUpRight } from 'lucide-react';
import type { ProductListItem } from '@/api/ecommerce-api';
import { PlanList } from '@/components/plan-list';

const features=[
{Icon:Users,title:'Cada aluno, bem acompanhado.',text:'Telefone, e-mail, matéria e observações de cada aluno em uma ficha. Marque quem está ativo ou pausado.'},
{Icon:Repeat,title:'Aulas que se repetem sozinhas.',text:'Cadastre a aula uma vez, escolha os dias da semana e ela aparece toda semana na sua agenda.'},
{Icon:CalendarDays,title:'Sua semana em uma tela.',text:'Horário, duração e local de cada aula: presencial, online, academia ou na casa do aluno.'},
{Icon:Wallet,title:'Quem pagou e quem falta pagar.',text:'Registre mensalidades e aulas avulsas com vencimento e marque como pago com um clique.'},
{Icon:LayoutDashboard,title:'O resumo do seu dia.',text:'Ao entrar, veja suas próximas aulas, quanto recebeu no mês e o que está pendente.'},
{Icon:ShieldCheck,title:'Seu espaço, só seu.',text:'Conta própria com acesso seguro. Seus alunos e valores ficam visíveis apenas para você.'},
];

const steps=[
{title:'Escolha seu plano',text:'Crie sua conta e assine em poucos minutos.'},
{title:'Cadastre alunos e aulas',text:'Adicione seus alunos e monte sua semana de aulas.'},
{title:'Acompanhe tudo em um lugar',text:'Agenda e recebimentos sempre em dia, no celular ou no computador.'},
];

const faq=[
{q:'Preciso instalar alguma coisa?',a:'Não. O Aulaflow funciona direto no navegador, no celular ou no computador. É só entrar com seu e-mail e senha.'},
{q:'Para quem o Aulaflow foi feito?',a:'Para quem dá aulas por conta própria: professores particulares, tutores, instrutores e personal trainers, presencial ou online.'},
{q:'Outras pessoas conseguem ver meus alunos?',a:'Não. Cada conta enxerga apenas os próprios alunos, aulas e recebimentos.'},
{q:'Posso mudar de plano ou cancelar?',a:'Sim. Na Área do assinante você altera o plano, atualiza o pagamento ou cancela pelo portal de cobrança.'},
];

export function Benefits({plans,plansError}:{plans:ProductListItem[];plansError:boolean}){return <>
<section className="benefits" id="recursos"><div className="section-heading"><span className="eyebrow">02 / TUDO CONECTADO</span><h2>Seu talento é ensinar.<br/><span>O resto, a gente organiza.</span></h2><p>Troque as abas abertas e as anotações soltas<br/> por uma rotina mais leve, clara e profissional.</p></div><div className="benefit-list">{features.map(({Icon,title,text},i)=><article key={title}><span className="index">0{i+1}</span><Icon size={25}/><h3>{title}</h3><p>{text}</p></article>)}</div></section>
<section className="steps" id="como-funciona"><span className="eyebrow">03 / COMO FUNCIONA</span><h2>Do cadastro à primeira aula<br/>em três passos.</h2><ol>{steps.map(({title,text},i)=><li key={title}><span className="step-number">{i+1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol></section>
<section className="pricing" id="planos"><span className="eyebrow">04 / PLANOS</span><h2>Um preço simples<br/>para uma rotina organizada.</h2><p className="pricing-lead">Escolha o período que faz mais sentido para você. Tudo incluso em todos os planos.</p>{plansError?<p className="notice">Não foi possível carregar os planos. Atualize a página para tentar novamente.</p>:<PlanList plans={plans}/>}</section>
<section className="faq" id="perguntas"><span className="eyebrow">05 / PERGUNTAS FREQUENTES</span><h2>Ficou alguma dúvida?</h2><div className="faq-list">{faq.map(({q,a})=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>
<section className="closing"><span className="eyebrow">COMECE HOJE</span><h2>Uma rotina mais leve<br/>começa com um passo.</h2><p>Crie sua conta, escolha sua assinatura e reúna sua rotina de ensino em um só espaço.</p><a className="button" href="#planos">Começar agora <ArrowUpRight size={18}/></a></section>
</>;}
