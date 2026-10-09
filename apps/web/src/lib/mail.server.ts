/**
 * Outgoing e-mail through an SMTP mailbox (Hostinger: smtp.hostinger.com, port 465).
 *
 * Needs `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS`; `SMTP_PORT` defaults to 465 and
 * `SMTP_FROM` to the user name. Without `SMTP_HOST`, messages are written to the
 * server log instead, so password resets can be tested locally.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import logger from '@/lib/logger.server';

let transport: Transporter | null = null;

export async function sendMail({ to, subject, text }: { to: string; subject: string; text: string }) {
	if (!process.env.SMTP_HOST) {
		if (process.env.NODE_ENV === 'production') {
			throw new Error('E-mail não configurado: defina SMTP_HOST, SMTP_USER e SMTP_PASS.');
		}
		logger.info(`E-mail (not sent, SMTP_HOST is not set) to ${to}: ${subject}\n${text}`);
		return;
	}

	const port = Number(process.env.SMTP_PORT) || 465;
	transport ??= nodemailer.createTransport({
		host: process.env.SMTP_HOST,
		port,
		secure: port === 465,
		auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
	});

	await transport.sendMail({
		from: `Aula Flow <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
		to,
		subject,
		text,
	});
}
