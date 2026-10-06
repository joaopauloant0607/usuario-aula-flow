import { useEffect, useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';

// Real screens of the app, captured with fictional students and values.
const SHOTS = [
	{ src: '/demo/visao-geral.webp', label: 'Visão geral', alt: 'Visão geral com alunos ativos, aulas da semana e valor recebido no mês' },
	{ src: '/demo/alunos.webp', label: 'Alunos', alt: 'Lista de alunos com mensalidade, aulas por semana e vencimento' },
	{ src: '/demo/agenda.webp', label: 'Agenda', alt: 'Agenda com aulas confirmadas e contador de aulas por aluno' },
	{ src: '/demo/presenca.webp', label: 'Presença', alt: 'Aulas da semana com presença confirmada e aula para repor' },
	{ src: '/demo/financeiro.webp', label: 'Financeiro', alt: 'Recebimentos do mês com valores pagos, pendentes e em atraso' },
];
const SLIDE_MS = 4500;

function DemoSlides() {
	const [current, setCurrent] = useState(0);

	useEffect(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const timer = setTimeout(() => setCurrent((current + 1) % SHOTS.length), SLIDE_MS);
		return () => clearTimeout(timer);
	}, [current]);

	return (
		<div className="demo-slides">
			<div className="demo-frame" aria-label="Telas do Aulaflow com dados fictícios">
				{SHOTS.map((s, i) => (
					<img
						key={s.src}
						src={s.src}
						alt={s.alt}
						width={1600}
						height={900}
						loading={i === 0 ? 'eager' : 'lazy'}
						className={i === current ? 'on' : ''}
						aria-hidden={i !== current}
					/>
				))}
				<span className="demo-label">DADOS FICTÍCIOS</span>
			</div>
			<div className="demo-tabs">
				{SHOTS.map((s, i) => (
					<button
						key={s.src}
						type="button"
						className={i === current ? 'on' : ''}
						aria-pressed={i === current}
						onClick={() => setCurrent(i)}
					>
						{s.label}
					</button>
				))}
			</div>
		</div>
	);
}

export function Hero() {
	return (
		<section className="hero">
			<div className="hero-copy">
				<div className="eyebrow">
					<span /> MENOS ADMINISTRAÇÃO. MAIS ENSINO.
				</div>
				<h1>
					Suas aulas em dia.
					<br />
					Sua rotina <span>no controle.</span>
				</h1>
				<p>
					Alunos, agenda e pagamentos em um único lugar.
					<br className="desktop" /> A organização que você precisa para fazer o que faz melhor: ensinar.
				</p>
				<div className="hero-actions">
					<a href="#planos" className="button">
						Começar agora <ArrowUpRight size={19} />
					</a>
					<a href="#como-funciona" className="text-link">
						Ver como funciona <span>↓</span>
					</a>
				</div>
				<div className="assurances">
					<span>
						<Check size={14} /> Feito para professores independentes
					</span>
					<span>
						<Check size={14} /> Funciona no celular e no computador
					</span>
					<span>
						<Check size={14} /> Seus dados visíveis só para você
					</span>
				</div>
			</div>
			<div className="product-stage">
				<span className="stage-index">01 / SUA NOVA ROTINA</span>
				<DemoSlides />
				<div className="floating-note">
					<span className="note-icon">
						<Check size={18} />
					</span>
					<div>
						<b>
							Menos planilhas.
							<br />
							Mais tranquilidade.
						</b>
						<small>Seu trabalho em um só lugar.</small>
					</div>
				</div>
				<div className="stage-caption">
					<span>UM OLHAR SOBRE O SEU DIA.</span>
					<span>SEM PERDER NENHUM DETALHE. ↗</span>
				</div>
			</div>
			<div className="hero-bottom">
				<span>PARA QUEM TRANSFORMA CONHECIMENTO EM CONQUISTAS</span>
				<div>
					Professores particulares <i /> Tutores <i /> Instrutores <i /> Educadores independentes
				</div>
			</div>
		</section>
	);
}
