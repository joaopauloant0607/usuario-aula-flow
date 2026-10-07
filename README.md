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
- Para abrir no celular (no mesmo Wi-Fi), use `npm run dev:celular` e abra no celular o endereço que aparece em "Network".
- Planos e assinaturas não funcionam localmente, porque dependem da loja da Hostinger.

## Comandos

- `npm run build`: gera a versão de produção em `dist/`
- `npm start`: roda a versão de produção (`server.mjs`), depois do build
- `npm run typecheck`: confere os tipos
- `npm run lint`: confere o estilo do código

## Publicar na Hostinger (implantação pelo GitHub)

A hospedagem de apps Node.js da Hostinger roda só o site. O banco (PocketBase) precisa ficar em outro lugar, por exemplo no PocketHost.

Configurações de compilação na Hostinger:

- Framework: Express
- Diretório raiz: `./`
- Comando de build: `build`
- Arquivo de entrada: `server.mjs`
- Node.js: 22

Variáveis de ambiente (as duas com o endereço do banco, por exemplo `https://seu-banco.pockethost.io`):

- `VITE_POCKETBASE_URL`: endereço que o navegador usa. Vale a partir do próximo build.
- `POCKETBASE_URL`: endereço que o servidor usa.

Sem essas variáveis a página inicial abre, mas o login não funciona.

## Observações

- O banco local (`pb_data`) e o binário do PocketBase não vão para o Git.
- As migrações `1790880000_add_student_due_day.js` e `1790890000_create_class_sessions.js` não fazem nada se o campo ou a coleção já existir (foram criados à mão no Horizons).
