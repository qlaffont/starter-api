# STARTER API

## Server requirements

- Node (Please check .nvmrc to get Node.JS version)
- Postgres database ( or Docker for development )

## How to start the project ?

### Local

- Fill environment variables to `.env` file based on `.env.example`
- Start server `pnpm dev`

### Deployed environments

- Fill environment variables to `.env` file based on `.env.example`
- Build app `pnpm build`
- Start server  `pnpm start`

## Package Scripts

- `dev` : Start Dev server (hot reload activated)
- `dev:worker` : Start Dev worker (hot reload activated)
- `build` : Build app + worker
- `start` : Start server in production mode
- `start:worker` : Start worker in production mode
- `lint` : Lint all files
- `generate` : generate prisma client
- `migration:up` : deploy migrations
- `migration:make` : generate migration
- `migration:reset` : reset migrations + data
- `prepare` : Install husky
- `update-template` : Update project with template (/!\ Verify result !)
