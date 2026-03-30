import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Web Push helpers using Web Crypto API
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

  const headerB64 = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const payloadB64 = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKeyBase64Url);
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: uint8ArrayToBase64Url(privateKeyBytes),
      x: uint8ArrayToBase64Url(
        base64UrlToUint8Array(vapidPublicKeyBase64Url).slice(1, 33)
      ),
      y: uint8ArrayToBase64Url(
        base64UrlToUint8Array(vapidPublicKeyBase64Url).slice(33, 65)
      ),
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

  // Convert DER signature to raw r||s format
  const sigArray = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;

  if (sigArray.length === 64) {
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32);
  } else {
    // DER format
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32, 64);
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
  rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));

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
      return false; // subscription expired
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
        // not JSON, proceed with scheduled logic
      }
    }

    if (isTest && testUserId && testPayload) {
      // Send test notification to specific user
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
          // Remove expired subscription
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }

      return new Response(
        JSON.stringify({ sent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Scheduled: check all users' bill reminders for today/tomorrow
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

    // Group reminders by user
    const byUser = new Map<string, typeof reminders>();
    for (const r of reminders) {
      const list = byUser.get(r.user_id) || [];
      list.push(r);
      byUser.set(r.user_id, list);
    }

    let totalSent = 0;

    for (const [userId, userReminders] of byUser) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId);

      if (!subs || subs.length === 0) continue;

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
    }

    return new Response(
      JSON.stringify({ sent: totalSent }),
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
