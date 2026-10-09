# Aula Flow

Gestão para profissionais de aulas particulares: alunos, agenda, presença e reposição, mensalidades e financeiro.

## Estrutura

- `apps/web`: site, app e API (React Router + Vite + Tailwind, TypeScript)
- Banco de dados: MySQL/MariaDB em produção (o banco do plano da Hostinger) e um arquivo SQLite local no `npm run dev`. As tabelas são criadas sozinhas na primeira vez que o site usa o banco (`apps/web/src/lib/db.server.ts`).
- Login: contas e sessões no próprio banco (`apps/web/src/lib/auth.server.ts`), com a sessão num cookie seguro.

## Rodar localmente

Precisa do [Node.js](https://nodejs.org) 22.13 ou mais novo (a versão LTS serve).

```bash
npm install
npm run dev
```

- O app abre em http://localhost:3000. Crie uma conta em "Ainda não tenho uma conta".
- Os dados ficam em `apps/web/.data/aulaflow.db`, só no seu computador. Para começar do zero, apague essa pasta.
- "Esqueci minha senha" não envia e-mail localmente: o link aparece no terminal.
- Para abrir no celular (no mesmo Wi-Fi), use `npm run dev:celular` e abra no celular o endereço que aparece em "Network".
- Planos e assinaturas não funcionam localmente, porque dependem da loja da Hostinger.

## Comandos

- `npm run build`: gera a versão de produção em `dist/`
- `npm start`: roda a versão de produção (`server.mjs`), depois do build
- `npm run typecheck`: confere os tipos
- `npm run lint`: confere o estilo do código

## Publicar na Hostinger (implantação pelo GitHub)

Configurações de compilação na Hostinger:

- Framework: Express
- Diretório raiz: `./`
- Comando de build: `build`
- Arquivo de entrada: `server.mjs`
- Node.js: 22

Variáveis de ambiente:

- `DB_HOST` (`127.0.0.1`; o site também troca `localhost` por esse valor), `DB_PORT` (`3306`), `DB_NAME`, `DB_USER`, `DB_PASSWORD`: o banco MySQL criado em Bancos de dados > Gerenciamento.
- `SMTP_HOST` (`smtp.hostinger.com`), `SMTP_PORT` (`465`), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: a caixa de e-mail que envia o link de "Esqueci minha senha".
- `APP_URL`: endereço do site, por exemplo `https://aulaflow.live`, usado no link do e-mail.

Sem as variáveis do banco a página inicial abre, mas o login não funciona. Nunca coloque senhas no código ou no Git: só nas variáveis de ambiente.
