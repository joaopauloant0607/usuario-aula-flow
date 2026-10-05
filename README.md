# Aula Flow

Gestão para profissionais de aulas particulares: alunos, agenda, presença e reposição, mensalidades e financeiro.

## Estrutura

- `apps/web`: site e app (React Router + Vite + Tailwind, TypeScript)
- `apps/pocketbase`: banco de dados PocketBase (migrações em `pb_migrations`, hooks em `pb_hooks`)

## Rodar localmente

Precisa do [Node.js 22](https://nodejs.org) instalado.

```bash
npm install
npm run dev
```

- Na primeira vez, o `npm run dev` baixa o PocketBase sozinho (Windows, Mac ou Linux).
- O app abre em http://localhost:3000. Crie uma conta em "Ainda não tenho uma conta" e depois clique em "Meu espaço".
- O painel do banco local fica em http://localhost:8090/_/ (login `admin@aulaflow.local`, senha `aulaflow-local-123`, só vale no seu computador).
- Planos e assinaturas não funcionam localmente, porque dependem da loja da Hostinger.

## Comandos

- `npm run build`: gera a versão de produção em `dist/`
- `npm run typecheck`: confere os tipos
- `npm run lint`: confere o estilo do código

## Observações

- O banco local (`pb_data`) e o binário do PocketBase não vão para o Git.
- As migrações `1790880000_add_student_due_day.js` e `1790890000_create_class_sessions.js` não fazem nada se o campo ou a coleção já existir (foram criados à mão no Horizons).
