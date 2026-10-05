import { useState } from 'react';
import { LayoutDashboard, Users, CalendarDays, CalendarCheck, Wallet } from 'lucide-react';
import { Overview } from './overview';
import { Students } from './students';
import { Schedule, Attendance } from './schedule';
import { Finance } from './finance';

type Tab = 'overview' | 'students' | 'schedule' | 'attendance' | 'finance';

const NAV: { id: Tab; label: string; Icon: typeof LayoutDashboard }[] = [
	{ id: 'overview', label: 'Visão geral', Icon: LayoutDashboard },
	{ id: 'students', label: 'Alunos', Icon: Users },
	{ id: 'schedule', label: 'Agenda', Icon: CalendarDays },
	{ id: 'attendance', label: 'Presença', Icon: CalendarCheck },
	{ id: 'finance', label: 'Financeiro', Icon: Wallet },
];

export function Dashboard() {
	const [tab, setTab] = useState<Tab>('overview');

	return (
		<div className="dash">
			<aside className="dash-side">
				<div className="mini-brand">
					aula<span>flow</span>
					<i />
				</div>
				<small>SEU ESPAÇO DE ENSINO</small>
				{NAV.map(({ id, label, Icon }) => (
					<button
						key={id}
						type="button"
						className={'side-item' + (tab === id ? ' active' : '')}
						onClick={() => setTab(id)}
					>
						<Icon size={15} /> {label}
					</button>
				))}
				<div className="sidebar-bottom" style={{ position: 'static', marginTop: 24 }}>
					Tudo no seu ritmo.
					<br />
					<b>Um dia de cada vez.</b>
				</div>
			</aside>
			<main className="dash-main">
				{tab === 'overview' && <Overview onNavigate={setTab} />}
				{tab === 'students' && <Students />}
				{tab === 'schedule' && <Schedule />}
				{tab === 'attendance' && <Attendance />}
				{tab === 'finance' && <Finance />}
			</main>
		</div>
	);
}
