---
name: Camada de Services Supabase
description: Todas as queries Supabase de transactions, categories, goals e extra_income passam pelos arquivos em src/services/
type: preference
---
Toda query Supabase para as entidades transactions, categories, goals e extra_income deve passar pela camada `src/services/`. **Nunca chamar `supabase.from(...)` direto dentro de páginas/componentes** dessas entidades.

**Arquivos:**
- `src/services/transactionsService.ts` — fetchTransactionsByPeriod, fetchAllTransactionsByPeriod, fetchTransactionValuesByPeriod, createTransaction, createTransactionsBatch, updateTransaction, deleteTransaction
- `src/services/extraIncomeService.ts` — fetchExtraIncomeByPeriod, fetchAllExtraIncomeByPeriod, createExtraIncome, updateExtraIncome, deleteExtraIncome
- `src/services/categoriesService.ts` — fetchCategories, createCategory, createCategoryReturnId, updateCategory, deleteCategory
- `src/services/goalsService.ts` — fetchGoals, createGoal, updateGoal, deleteGoal

**Convenções:**
- Functions retornam `data ?? []` ou lançam o erro do Supabase via `throw error`.
- Tipos de Insert/Update vêm de `TablesInsert<...>` / `TablesUpdate<...>` do `types.ts` gerado.
- Páginas chamam services e tratam `try/catch` com `toast.error`.

**Por quê:** Evita duplicação de queries entre Dashboard, Transações, Metas, Renda Extra e Categorias; centraliza filtros (profile_id, intervalos), facilita migração futura para mutations do React Query.
