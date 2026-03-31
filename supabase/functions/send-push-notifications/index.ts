import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VAPID_PUBLIC_KEY = "BJa-tf75KJ3yKlDmXlG0pKmw1lVMwNa5lXC4Rkmp7nTov72bEHXOryzp9x0KlK_IAB26n5_VK0tRrM3zNhWBhA8";
const VAPID_SUBJECT = "mailto:noreply@mmfluxo.lovable.app";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, vapidPrivateKey);

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
        // not JSON, proceed with scheduled logic
      }
    }

    if (isTest && testUserId && testPayload) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", testUserId);

      if (!subs || subs.length === 0) {
        return new Response(
          JSON.stringify({ error: "Nenhuma assinatura push encontrada. Ative as notificações primeiro." }),
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
          console.error("Push error:", err?.statusCode, err?.body);
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

      return new Response(
        JSON.stringify({ sent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === SCHEDULED MODE ===
    const now = new Date();
    const today = now.getDate();
    const tomorrow = new Date(now.getTime() + 86400000).getDate();

    const { data: reminders } = await supabase
      .from("bill_reminders")
      .select("*")
      .eq("ativo", true)
      .in("dia_vencimento", [today, tomorrow]);

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum lembrete urgente" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = [...new Set(reminders.map((r: any) => r.user_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, notif_interval_hours, last_push_sent_at, notifications_enabled")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.user_id, p])
    );

    let totalSent = 0;
    const usersNotified: string[] = [];

    for (const userId of userIds) {
      const profile = profileMap.get(userId);
      
      // Skip if user disabled notifications
      if (profile?.notifications_enabled === false) continue;

      const intervalHours = profile?.notif_interval_hours ?? 9;
      const lastSent = profile?.last_push_sent_at
        ? new Date(profile.last_push_sent_at)
        : null;

      if (lastSent) {
        const hoursSinceLast = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < intervalHours) continue;
      }

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId);

      if (!subs || subs.length === 0) continue;

      const userReminders = reminders.filter((r: any) => r.user_id === userId);

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
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload
            );
            totalSent++;
          } catch (err: any) {
            console.error("Push error:", err?.statusCode, err?.body);
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            }
          }
        }
      }

      usersNotified.push(userId);
    }

    // Update last_push_sent_at
    for (const userId of usersNotified) {
      await supabase
        .from("profiles")
        .update({ last_push_sent_at: now.toISOString() })
        .eq("user_id", userId);
    }

    return new Response(
      JSON.stringify({ sent: totalSent, users_notified: usersNotified.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
