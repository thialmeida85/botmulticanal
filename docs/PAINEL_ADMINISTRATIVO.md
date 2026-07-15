# Painel administrativo e instalações por cliente

## Arquitetura

O produto usa dois níveis:

1. **Controle central**: clientes, planos, assinaturas, instalações, credenciais criptografadas, deploys e auditoria.
2. **Instalação do cliente**: serviço Render, banco Neon, Evolution e provedores de IA pertencentes ao cliente.

O painel não edita arquivos `.env`. Ele armazena os valores com AES-256-GCM, envia as variáveis pela API da Render e solicita um novo deploy.

## Preparação do controle central

1. Gere `JWT_SECRET` com pelo menos 32 caracteres.
2. Gere `SECRETS_ENCRYPTION_KEY` com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
3. Configure `ADMIN_EMAIL` e `ADMIN_INITIAL_PASSWORD` somente para criar o primeiro administrador em um banco vazio.
4. Execute `pnpm db:push` para aplicar as migrations.
5. Remova `ADMIN_INITIAL_PASSWORD` do ambiente depois do primeiro login.

Nunca troque `SECRETS_ENCRYPTION_KEY` sem antes recriptografar os segredos existentes.

## Onboarding de um cliente

1. Acesse `/admin` com uma conta de função `admin`.
2. Cadastre um plano.
3. Cadastre o cliente e escolha o período de teste.
4. Crie a instalação informando repositório, Render Service ID, URL pública e Neon Project ID.
5. Na configuração da instalação, salve as chaves da Render, Neon, banco, Evolution e IA.
6. Use os testes individuais de Render, Neon, banco, IA e health check.
7. Clique em **Publicar na Render**. O painel sincronizará as variáveis, iniciará o deploy e registrará a operação.

## Segurança

- Segredos não são retornados ao frontend; somente uma dica mascarada é exibida.
- Ações administrativas usam autorização por função e geram auditoria.
- Rotas de QR Code, status, sincronização e desconexão do WhatsApp exigem JWT.
- O webhook do WhatsApp permanece público para receber eventos externos.
- Chaves de IA não podem usar prefixo `VITE_`, pois variáveis Vite podem ser incorporadas ao bundle do navegador.
- Cada cliente deve possuir banco e serviço separados.

## Cobrança

As tabelas `plans` e `subscriptions` deixam o domínio comercial pronto. IDs externos aceitam Stripe, Mercado Pago ou Asaas. A confirmação financeira deverá chegar por webhook assinado do provedor escolhido; nunca confie em confirmação enviada pelo navegador.

## Operação e recuperação

- Use `/health` para disponibilidade e latência do banco.
- Falhas de deploy ficam registradas em `deployment_jobs` e na instalação.
- Logs administrativos ficam em `audit_logs`.
- Backups, retenção e restauração são configurados na conta Neon do cliente.
