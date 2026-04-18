---
name: Despesas Recorrentes Automáticas
description: Regras de repetição mensal que geram despesas automaticamente no dia 1 de cada mês via Edge Function + Cron
type: feature
---

# Despesas Recorrentes Automáticas

## Visão geral
Sistema que permite cadastrar contas fixas (aluguel, Netflix, academia, internet) como **regras de repetição mensal**. No dia 1 de cada mês, todas as despesas do mês são criadas de uma vez na tabela `transactions`, cada uma já com a data correta do vencimento.

## Decisões de produto (1b + 2a + 3a)
- **Quando criar:** dia 1 de cada mês, todas as recorrentes do mês de uma vez (com data certa do vencimento).
- **Status:** já entram como `pago` (igual às despesas normais).
- **Migração de dados antigos:** ignorada — o checkbox `recorrente` antigo continua existindo apenas como rótulo informativo. Usuário recadastra suas fixas.

## Estrutura de dados

### Tabela `recurring_expenses`
Campos: `nome`, `valor`, `dia_vencimento` (1-31), `tipo_despesa`, `motivo`, `category_id`, `profile_id`, `ativo`, `ultima_geracao_ano_mes` (formato 'YYYY-MM' — controle anti-duplicação).

### Coluna nova em `transactions`: `recurring_id`
Liga a despesa à regra que a gerou (FK com `ON DELETE SET NULL` — apagar a regra preserva as despesas históricas).

## Fluxo automático (Edge Function + Cron)
1. **Cron job** `generate-recurring-expenses-daily` roda todo dia às 03:05 UTC (= 00:05 horário de Brasília).
2. Chama a edge function `generate-recurring-expenses` (sem auth).
3. A função verifica o dia atual no fuso `America/Sao_Paulo`. Se NÃO for dia 1, retorna `skipped`.
4. Se for dia 1, busca todas as regras `ativo = true` cujo `ultima_geracao_ano_mes != 'YYYY-MM' atual`.
5. Para cada regra, insere uma linha em `transactions` com a data `YYYY-MM-DD` correta. Se o dia for maior que o último dia do mês (ex: 31 em fevereiro), usa o último dia disponível.
6. Marca a regra com `ultima_geracao_ano_mes = yearMonth` para nunca duplicar mesmo se o cron rodar 2x.
7. **Notificação push automática:** ao final, agrupa por usuário (qtd + soma) e envia 1 push por usuário com título "🔄 Despesas fixas criadas" e corpo "X despesas recorrentes foram criadas — total R$ Y". Também grava em `notification_logs` (sino) mesmo se o push falhar. Reusa o mesmo VAPID hardcoded da função `send-push-notifications`.

## Geração manual (botão "Gerar agora")
Na página `/recorrentes`, o botão "Gerar agora (mês atual)" chama a edge function com `{ force: true, user_id }`. Útil para:
- Estrear o sistema sem esperar o dia 1.
- Recuperar caso uma regra tenha sido cadastrada DEPOIS do dia 1.

## Arquivos-chave
- `src/services/recurringExpensesService.ts` — camada de queries (segue padrão services-layer)
- `src/hooks/useRecurringExpenses.ts` — hook React Query (usa `qk.recurringExpenses`)
- `src/pages/RecorrentesPage.tsx` — UI de gerenciamento (rota `/recorrentes`)
- `supabase/functions/generate-recurring-expenses/index.ts` — função de geração
- Item "Recorrentes" no menu lateral (ícone `Repeat`)

## Segurança
- RLS ativo: cada usuário só vê/edita suas próprias regras (`auth.uid() = user_id`).
- Edge function usa SERVICE_ROLE_KEY para bypass de RLS na geração em massa.
