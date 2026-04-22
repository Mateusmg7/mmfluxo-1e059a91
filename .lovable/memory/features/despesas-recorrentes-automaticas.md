---
name: Despesas Recorrentes Automáticas
description: Regras de repetição mensal que geram despesas automaticamente no dia 1 de cada mês via Edge Function + Cron. Embutidas como aba "Automáticas" dentro de /transacoes.
type: feature
---

# Despesas Recorrentes Automáticas

## Visão geral
Sistema que permite cadastrar contas fixas (aluguel, Netflix, academia, internet) como **regras de repetição mensal**. No dia 1 de cada mês, todas as despesas do mês são criadas de uma vez na tabela `transactions`.

## UI
- **Embutida como aba "Automáticas"** dentro da página de Gastos (`/transacoes`), ao lado da aba "Gastos".
- **Sem item separado no menu lateral** — o antigo `/recorrentes` redireciona para `/transacoes`.
- **Checkbox "recorrente" removido** do formulário de despesas manuais (era redundante).
- Na lista de gastos, despesas geradas automaticamente mostram `🔄 Automática` (baseado em `recurring_id`).

## Decisões de produto
- **Quando criar:** dia 1 de cada mês, todas as recorrentes do mês de uma vez.
- **Status:** já entram como `pago`.

## Estrutura de dados
- Tabela `recurring_expenses` com campos: `nome`, `valor`, `dia_vencimento`, `tipo_despesa`, `motivo`, `category_id`, `profile_id`, `ativo`, `ultima_geracao_ano_mes`.
- Coluna `recurring_id` em `transactions` liga a despesa à regra geradora.

## Fluxo automático (Edge Function + Cron)
- Cron roda todo dia às 03:05 UTC; edge function só gera no dia 1.
- Botão "Gerar agora" permite geração manual forçada.

## Arquivos-chave
- `src/pages/TransacoesPage.tsx` — contém ambas as abas (Gastos + Automáticas)
- `src/hooks/useRecurringExpenses.ts` — hook React Query
- `src/services/recurringExpensesService.ts` — camada de queries
- `supabase/functions/generate-recurring-expenses/index.ts` — função de geração
