import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateVapidJwt(
  endpoint: string,
  vapidPrivateKeyBase64Url: string,
  vapidPublicKeyBase64Url: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: expiration,
    sub: "mailto:noreply@mmfluxo.lovable.app",
  };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKeyBase64Url);
  const pubKeyBytes = base64UrlToUint8Array(vapidPublicKeyBase64Url);

  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: uint8ArrayToBase64Url(privateKeyBytes),
      x: uint8ArrayToBase64Url(pubKeyBytes.slice(1, 33)),
      y: uint8ArrayToBase64Url(pubKeyBytes.slice(33, 65)),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const sigArray = new Uint8Array(signature);
  const rawSig = new Uint8Array(64);
  if (sigArray.length === 64) {
    rawSig.set(sigArray);
  } else {
    const r = sigArray.slice(0, 32);
    const s = sigArray.slice(32, 64);
    rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
    rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  }

  const jwt = `${unsignedToken}.${uint8ArrayToBase64Url(rawSig)}`;

  return {
    authorization: `vapid t=${jwt}, k=${vapidPublicKeyBase64Url}`,
    cryptoKey: `p256ecdsa=${vapidPublicKeyBase64Url}`,
  };
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPrivateKey: string,
  vapidPublicKey: string
): Promise<boolean> {
  try {
    const { authorization, cryptoKey } = await generateVapidJwt(
      subscription.endpoint,
      vapidPrivateKey,
      vapidPublicKey
    );

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Crypto-Key": cryptoKey,
        "Content-Type": "application/json",
        TTL: "86400",
      },
      body: payload,
    });

    if (response.status === 410 || response.status === 404) {
      return false;
    }
    return response.ok;
  } catch (e) {
    console.error("Push send error:", e);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidPublicKey = "BIspuEq9I4Fksqz9m6J2ngXgL-MvEIoHB4SHedVm5fgFBzuVVkTRao1cwrjT0GzxYNJJReVWJf8QOLsS5n3DnPg";

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
        // not JSON body, proceed with scheduled logic
      }
    }

    if (isTest && testUserId && testPayload) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", testUserId);

      if (!subs || subs.length === 0) {
        return new Response(
          JSON.stringify({ error: "Nenhuma assinatura push encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let sent = 0;
      for (const sub of subs) {
        const ok = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          JSON.stringify(testPayload),
          vapidPrivateKey,
          vapidPublicKey
        );
        if (ok) sent++;
        else {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
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

    // Get all active reminders for today/tomorrow
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

    // Group reminders by user
    const userIds = [...new Set(reminders.map((r) => r.user_id))];

    // Get user profiles to check interval preferences
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, notif_interval_hours, last_push_sent_at")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.user_id, p])
    );

    let totalSent = 0;
    const usersNotified: string[] = [];

    for (const userId of userIds) {
      const profile = profileMap.get(userId);
      const intervalHours = profile?.notif_interval_hours ?? 9;
      const lastSent = profile?.last_push_sent_at
        ? new Date(profile.last_push_sent_at)
        : null;

      // Check if enough time has passed since last notification
      if (lastSent) {
        const hoursSinceLast = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < intervalHours) {
          continue; // Skip this user, not enough time has passed
        }
      }

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId);

      if (!subs || subs.length === 0) continue;

      const userReminders = reminders.filter((r) => r.user_id === userId);

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
          const ok = await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payload,
            vapidPrivateKey,
            vapidPublicKey
          );
          if (ok) totalSent++;
          else {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }

      usersNotified.push(userId);
    }

    // Update last_push_sent_at for all notified users
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
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
