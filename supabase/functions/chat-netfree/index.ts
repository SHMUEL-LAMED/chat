// גשר בין אתר הצאט (https://shmuel-lamed.github.io/chat/) ל-Worker של הקו, כי נטפרי חוסם workers.dev.
// הדפדפן שולח את האסימון בפרמטר token ואת הגוף כ-text/plain (בלי preflight),
// והגשר מעביר ל-Worker: /chatsite/<פעולה> עם הכותרת x-chat-token. לא נשמר כאן כלום.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TARGET = "https://yemot-mail.smwlyqswkwt232.workers.dev/chatsite/";
const GH_ORIGIN = "https://shmuel-lamed.github.io";
const FN = "/chat-netfree";
const OPS = /^\/(login|logout|spaces|messages|thread|file|read|send|summary|mute|react|edit|delete|people|dm|members|reactors|group|addmember|removemember|leave|rename|unread|pin|claude_send|claude_history|claude_upload)$/;

const cors = () => ({
  "access-control-allow-origin": GH_ORIGIN,
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-expose-headers": "content-disposition",
  "access-control-max-age": "86400",
  "vary": "Origin",
});
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...cors(), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "שיטה לא מורשית" }, 405);
  const u = new URL(req.url);
  const i = u.pathname.indexOf(FN);
  let rest = i >= 0 ? u.pathname.slice(i + FN.length) : u.pathname;
  if (!rest.startsWith("/")) rest = "/" + rest;
  if (!OPS.test(rest)) return json({ error: "לא נמצא" }, 404);
  const token = u.searchParams.get("token") || "";
  u.searchParams.delete("token");
  const up = new URL(TARGET + rest.slice(1));
  for (const [k, v] of u.searchParams) up.searchParams.append(k, v);
  const headers = new Headers({ origin: GH_ORIGIN });
  if (token) headers.set("x-chat-token", token);
  let body: Uint8Array | undefined;
  if (req.method === "POST") { headers.set("content-type", "application/json"); body = new Uint8Array(await req.arrayBuffer()); }
  try {
    const r = await fetch(up, { method: req.method, headers, body, redirect: "manual" });
    const out = new Headers(cors());
    out.set("content-type", r.headers.get("content-type") || "application/json; charset=utf-8");
    const cd = r.headers.get("content-disposition");
    if (cd) out.set("content-disposition", cd);
    const cl = r.headers.get("content-length");
    if (cl) out.set("content-length", cl);
    out.set("cache-control", "no-store");
    return new Response(r.body, { status: r.status, headers: out });
  } catch (e) {
    console.error(e);
    return json({ error: "שגיאת חיבור לשרת" }, 502);
  }
});
