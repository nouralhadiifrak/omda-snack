/*
 * AL-OMDA order relay (Cloudflare Worker).
 *
 * The website POSTs an order here as JSON; the Worker forwards it to the
 * restaurant's Telegram chat. The bot token never reaches the browser.
 *
 * Secrets / variables (set in the Cloudflare dashboard or with wrangler):
 *   TELEGRAM_BOT_TOKEN   token from @BotFather            (secret)
 *   TELEGRAM_CHAT_ID     chat or group that receives orders (secret)
 *   ALLOWED_ORIGINS      comma-separated site origins, e.g.
 *                        "https://nouralhadiifrak.github.io,http://localhost:8000"
 */

const LIMITS = { items: 60, text: 300, notes: 600 };

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    const originOk = allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": originOk ? origin : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (request.method === "OPTIONS") return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    if (request.method !== "POST") return reply(405, { ok: false, error: "method" });
    if (!originOk) return reply(403, { ok: false, error: "origin" });
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return reply(500, { ok: false, error: "config" });

    let order;
    try {
      const raw = await request.text();
      if (raw.length > 20000) return reply(413, { ok: false, error: "size" });
      order = JSON.parse(raw);
    } catch {
      return reply(400, { ok: false, error: "json" });
    }

    // Bots tend to fill every field; people never see this one.
    if (order.website) return reply(200, { ok: true });

    const problem = validate(order);
    if (problem) return reply(400, { ok: false, error: problem });

    const api = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
    const sent = await fetch(`${api}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: formatOrder(order),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!sent.ok) return reply(502, { ok: false, error: "telegram" });

    // A map pin for deliveries, as a reply to the order message.
    if (order.type === "delivery" && order.location) {
      const { message_id } = (await sent.json()).result || {};
      await fetch(`${api}/sendLocation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          latitude: order.location.lat,
          longitude: order.location.lng,
          reply_to_message_id: message_id,
        }),
      }).catch(() => {});
    }

    return reply(200, { ok: true });
  },
};

const isText = (v, max = LIMITS.text) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isNum = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 100000;

function validate(o) {
  if (!o || typeof o !== "object") return "body";
  if (!["pickup", "delivery"].includes(o.type)) return "type";
  if (!isText(o.name, 80) || !isText(o.phone, 30)) return "customer";
  if (!Array.isArray(o.items) || !o.items.length || o.items.length > LIMITS.items) return "items";
  for (const it of o.items) {
    if (!isText(it.name) || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 50 || !isNum(it.total)) return "item";
    if (it.details != null && typeof it.details !== "string") return "item";
  }
  if (![o.subtotal, o.fee, o.total].every(isNum)) return "totals";
  if (o.type === "delivery") {
    if (!isText(o.address)) return "address";
    const l = o.location;
    if (!l || !isNum(Math.abs(l.lat)) || !isNum(Math.abs(l.lng)) || Math.abs(l.lat) > 90 || Math.abs(l.lng) > 180)
      return "location";
  }
  if (o.notes != null && (typeof o.notes !== "string" || o.notes.length > LIMITS.notes)) return "notes";
  return null;
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const dh = (n) => `${n} DH`;

function formatOrder(o) {
  const delivery = o.type === "delivery";
  const phoneDigits = o.phone.replace(/[^\d+]/g, "");
  const lines = [
    `🛎 <b>Nouvelle commande</b> · ${delivery ? "🛵 Livraison" : "🛍 À emporter"}`,
    "",
    ...o.items.map(
      (it) => `• ${it.qty} × ${esc(it.name)}${it.details ? ` <i>(${esc(it.details)})</i>` : ""} — ${dh(it.total)}`
    ),
    "",
  ];
  if (delivery) {
    lines.push(`Sous-total : ${dh(o.subtotal)}`, `Livraison : ${dh(o.fee)}`);
  }
  lines.push(`<b>Total : ${dh(o.total)}</b>`, "");
  lines.push(`👤 ${esc(o.name.trim())}`);
  lines.push(`📞 <a href="tel:${esc(phoneDigits)}">${esc(o.phone.trim())}</a>`);
  if (delivery) {
    const { lat, lng, km } = o.location;
    lines.push(`📍 ${esc(o.address.trim())}`);
    lines.push(
      `🗺 <a href="https://maps.google.com/?q=${lat},${lng}">Ouvrir dans Maps</a>${isNum(km) ? ` · ${km.toFixed(1)} km` : ""}`
    );
  }
  if (o.notes && o.notes.trim()) lines.push(`📝 ${esc(o.notes.trim())}`);
  if (o.lang === "ar") lines.push("", "<i>Client sur la version arabe du site</i>");
  return lines.join("\n");
}
