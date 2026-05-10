import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VAPID_PUBLIC_KEY = "BFgXjTf8wlHBEE_kHZ2pjnoH_c5ejwYbxfq6Thwgt99m4_dJjqXEjcUR94Ju9P2j42kSI4B3JQpTwK7m18_ScBs";
const VAPID_PRIVATE_KEY = "svvw9UKjU3GQwOlHfD7Ym_qv7iupJtW46JcRlVCxJVA";
const VAPID_SUBJECT = "mailto:noreply@mmfluxo.lovable.app";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if this is a test notification request
    let isTest = false;
    let testUserId: string | null = null;
    let testPayload: { title: string; body: string; tag: string } | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.test && body.user_id && body.payload) {
          isTest = true;
          testUserId = body.user_id;
          testPayload = body.payload;
        }
      } catch {
        // not JSON
      }
    }

    if (isTest && testUserId && testPayload) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", testUserId);

      if (!subs || subs.length === 0) {
        return new Response(
          JSON.stringify({ error: "Assinatura não encontrada." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let sent = 0;
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(testPayload)
          );
          sent++;
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }

      if (sent > 0) {
        await supabase.from("notification_logs").insert({
          user_id: testUserId,
          title: testPayload.title,
          body: testPayload.body,
          type: "test",
        });
      }

      return new Response(JSON.stringify({ sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === SCHEDULED MODE ===
    console.log("[Push] Iniciando processamento agendado...");
    const now = new Date();

    // Fetch all active reminders
    const { data: allReminders } = await supabase
      .from("bill_reminders")
      .select("*")
      .eq("ativo", true);

    if (!allReminders || allReminders.length === 0) {
      return new Response(JSON.stringify({ message: "Sem lembretes ativos" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userIds = [...new Set(allReminders.map((r: any) => r.user_id))];

    // Fetch profiles for interval and timezone
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, notif_interval_hours, last_push_sent_at, notifications_enabled, fuso_horario")
      .in("user_id", userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    let totalSent = 0;
    const usersToUpdate: string[] = [];

    for (const userId of userIds) {
      const profile = profileMap.get(userId);
      if (!profile || profile.notifications_enabled === false) continue;

      const tz = profile.fuso_horario || "America/Sao_Paulo";
      const intervalHours = Number(profile.notif_interval_hours) || 9;
      const lastSentAt = profile.last_push_sent_at ? new Date(profile.last_push_sent_at) : null;

      // Check interval
      if (lastSentAt) {
        const hoursPassed = (now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60);
        if (hoursPassed < intervalHours) continue;
      }

      // Calculate local today and tomorrow for this user
      const localDate = new Date(now.toLocaleString("en-US", { timeZone: tz }));
      const today = localDate.getDate();
      const tomorrow = new Date(localDate.getTime() + 86400000).getDate();

      const userReminders = allReminders.filter((r: any) => 
        r.user_id === userId && (r.dia_vencimento === today || r.dia_vencimento === tomorrow)
      );

      if (userReminders.length === 0) continue;

      // Fetch subscriptions
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId);

      if (!subs || subs.length === 0) continue;

      console.log(`[Push] Enviando para user ${userId} (${userReminders.length} lembretes)`);

      for (const r of userReminders) {
        const isToday = r.dia_vencimento === today;
        const label = isToday ? "Conta vencendo hoje" : "Conta vencendo amanhã";
        const valorStr = r.valor ? ` - R$ ${Number(r.valor).toFixed(2)}` : "";

        const payload = JSON.stringify({
          title: `💰 ${label}`,
          body: `${r.nome}${valorStr} (dia ${r.dia_vencimento})`,
          tag: `bill-${r.id}-${Date.now()}`,
        });

        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
            totalSent++;
          } catch (err: any) {
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            }
          }
        }

        await supabase.from("notification_logs").insert({
          user_id: userId,
          title: `💰 ${label}`,
          body: `${r.nome}${valorStr} (dia ${r.dia_vencimento})`,
          type: "auto",
        });
      }

      usersToUpdate.push(userId);
    }

    // Update last_push_sent_at
    if (usersToUpdate.length > 0) {
      for (const userId of usersToUpdate) {
        await supabase
          .from("profiles")
          .update({ last_push_sent_at: now.toISOString() })
          .eq("user_id", userId);
      }
    }

    return new Response(JSON.stringify({ sent: totalSent, users: usersToUpdate.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});