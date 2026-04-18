// 🔄 Edge Function: Geração mensal de despesas recorrentes
//
// Como funciona:
// - Roda todo dia (via cron). Quando o dia atual é 1, varre todas as regras
//   ativas de TODOS os usuários e cria as despesas do mês inteiro de uma vez.
// - Cada despesa é criada com a data correta do vencimento (ex: dia 5).
// - Para evitar duplicação, marca cada regra com "ultima_geracao_ano_mes".
// - Pode ser invocada manualmente via POST com { force: true } para gerar
//   imediatamente (útil para testes ou primeiro uso após cadastrar regras).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mesmas chaves VAPID usadas em send-push-notifications
const VAPID_PUBLIC_KEY = "BFgXjTf8wlHBEE_kHZ2pjnoH_c5ejwYbxfq6Thwgt99m4_dJjqXEjcUR94Ju9P2j42kSI4B3JQpTwK7m18_ScBs";
const VAPID_PRIVATE_KEY = "svvw9UKjU3GQwOlHfD7Ym_qv7iupJtW46JcRlVCxJVA";
const VAPID_SUBJECT = "mailto:noreply@mmfluxo.lovable.app";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface RecurringRule {
  id: string;
  user_id: string;
  profile_id: string | null;
  category_id: string | null;
  nome: string;
  valor: number;
  dia_vencimento: number;
  tipo_despesa: string;
  motivo: string;
  ultima_geracao_ano_mes: string | null;
}

/** Retorna o último dia válido do mês (28, 29, 30 ou 31). */
function lastDayOfMonth(year: number, month: number): number {
  // month aqui é 1-12
  return new Date(year, month, 0).getDate();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Permite forçar geração via POST { force: true, user_id?: string }
    let force = false;
    let onlyUserId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.force === true) force = true;
        if (typeof body.user_id === "string") onlyUserId = body.user_id;
      } catch {
        // sem body ou body inválido — segue como cron normal
      }
    }

    // Usa fuso de São Paulo para decidir o dia "real" no Brasil
    const now = new Date();
    const brNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const day = brNow.getDate();
    const year = brNow.getFullYear();
    const month = brNow.getMonth() + 1; // 1-12
    const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

    // Só processa em dia 1 (a não ser que seja chamada forçada)
    if (!force && day !== 1) {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: `Hoje é dia ${day}. Geração só ocorre no dia 1.`,
          year_month: yearMonth,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Busca regras ativas que ainda NÃO foram geradas neste mês
    let q = supabase
      .from("recurring_expenses")
      .select("*")
      .eq("ativo", true)
      .or(`ultima_geracao_ano_mes.is.null,ultima_geracao_ano_mes.neq.${yearMonth}`);

    if (onlyUserId) q = q.eq("user_id", onlyUserId);

    const { data: rules, error: rulesErr } = await q;
    if (rulesErr) throw rulesErr;

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, generated: 0, year_month: yearMonth }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maxDay = lastDayOfMonth(year, month);
    let generated = 0;
    const errors: string[] = [];
    // Acumula por usuário pra notificar no fim
    const perUser = new Map<string, { count: number; total: number }>();

    for (const r of rules as RecurringRule[]) {
      // Se a regra cair em dia 31 e o mês só tem 30 (ou 28/29 em fev),
      // usa o último dia do mês.
      const dayToUse = Math.min(r.dia_vencimento, maxDay);
      const dataIso = `${year}-${String(month).padStart(2, "0")}-${String(dayToUse).padStart(2, "0")}`;

      const { error: insertErr } = await supabase.from("transactions").insert({
        user_id: r.user_id,
        profile_id: r.profile_id,
        category_id: r.category_id,
        descricao: r.nome,
        valor: r.valor,
        data: dataIso,
        hora: "00:00",
        status: "pago",
        tipo_despesa: r.tipo_despesa,
        motivo: r.motivo,
        recorrente: true,
        recurring_id: r.id,
      });

      if (insertErr) {
        errors.push(`Regra ${r.id} (${r.nome}): ${insertErr.message}`);
        continue;
      }

      // Marca como gerada neste mês — nunca mais duplica em ${yearMonth}
      const { error: updErr } = await supabase
        .from("recurring_expenses")
        .update({ ultima_geracao_ano_mes: yearMonth })
        .eq("id", r.id);

      if (updErr) {
        errors.push(`Falha ao marcar regra ${r.id}: ${updErr.message}`);
      } else {
        generated++;
        const prev = perUser.get(r.user_id) ?? { count: 0, total: 0 };
        perUser.set(r.user_id, {
          count: prev.count + 1,
          total: prev.total + Number(r.valor || 0),
        });
      }
    }

    // === Envio de push por usuário ===
    let pushSent = 0;
    if (perUser.size > 0) {
      try {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      } catch (e) {
        console.warn("[generate-recurring-expenses] setVapidDetails falhou", e);
      }

      for (const [userId, { count, total }] of perUser.entries()) {
        const title = "🔄 Despesas fixas criadas";
        const body = `${count} ${count === 1 ? "despesa recorrente foi criada" : "despesas recorrentes foram criadas"} — total ${formatBRL(total)}`;

        // Busca assinaturas push do usuário
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", userId);

        if (subs && subs.length > 0) {
          const payload = JSON.stringify({
            title,
            body,
            tag: `recurring-${yearMonth}-${userId}`,
          });
          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payload
              );
              pushSent++;
            } catch (err: any) {
              console.error("[generate-recurring-expenses] push error:", err?.statusCode, err?.body);
              if (err?.statusCode === 410 || err?.statusCode === 404) {
                await supabase.from("push_subscriptions").delete().eq("id", sub.id);
              }
            }
          }
        }

        // Sempre registra no histórico (sino), mesmo sem push ativo
        await supabase.from("notification_logs").insert({
          user_id: userId,
          title,
          body,
          type: "auto",
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        generated,
        total_rules: rules.length,
        errors,
        year_month: yearMonth,
        forced: force,
        push_sent: pushSent,
        users_notified: perUser.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[generate-recurring-expenses] error", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
