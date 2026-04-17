/**
 * Lista mestre de chaves de cache (queryKeys) usadas no React Query.
 *
 * 📚 Por que isso existe:
 * Cada chave de cache funciona como uma "etiqueta" que identifica um pedaço de
 * dado guardado em memória. Se cada tela inventar sua própria etiqueta solta,
 * vira bagunça e fica fácil errar (ex.: "transactions" em uma tela e
 * "transaction" em outra → cache não é compartilhado, atualização não propaga).
 *
 * Centralizando tudo aqui:
 * - Evita typos
 * - Facilita invalidar caches relacionados (ex.: criou despesa → invalida tudo
 *   que começa com `qk.transactions.*`)
 * - Documenta o "mapa" de dados que o app guarda em memória
 */
export const qk = {
  // 🧑 Perfis financeiros do usuário
  financialProfiles: ['financial_profiles'] as const,

  // 👤 Dados da conta (nome, email, fuso, intervalo de notificação, etc.)
  profile: ['profile'] as const,

  // 💸 Despesas (transactions) — variam por perfil e período
  transactions: {
    all: ['transactions'] as const,
    byPeriod: (profileId: string | null | undefined, start: string, end: string) =>
      ['transactions', start, end, profileId ?? null] as const,
    allProfiles: (start: string, end: string) =>
      ['all_transactions', start, end] as const,
  },

  // 💰 Renda extra — variam por perfil e período
  extraIncome: {
    all: ['extra_income'] as const,
    byPeriod: (profileId: string | null | undefined, start: string, end: string) =>
      ['extra_income', start, end, profileId ?? null] as const,
    allProfiles: (start: string, end: string) =>
      ['all_extra_income', start, end] as const,
  },

  // 🏷️ Categorias — variam por perfil
  categories: {
    all: ['categories'] as const,
    byProfile: (profileId: string | null | undefined) =>
      ['categories', profileId ?? null] as const,
  },

  // 🎯 Metas — variam por perfil
  goals: {
    all: ['goals'] as const,
    byProfile: (profileId: string | null | undefined) =>
      ['goals', profileId ?? null] as const,
  },

  // 🔔 Lembretes de contas (Alertas)
  billReminders: ['bill_reminders'] as const,

  // 🏆 Ranking mensal (despesas + renda de todos os perfis)
  ranking: (userId: string | undefined, monthStart: string) =>
    ['ranking', userId, monthStart] as const,
} as const;
