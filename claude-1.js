"use strict";
// השיחה עם Claude בסגנון האתר הרשמי: שני מצבים (שיחה / קוד), דף שיחות עם חיפוש, פרויקטים עם הנחיות, Markdown, הגדרות.
// הכול עובר דרך הגשר ב-Supabase (claude_send / claude_history) עם האסימון של אתר הצאט. התשובות נכתבות מאוחר יותר.
const API = "https://ydcfafijktzasrkkxyux.supabase.co/functions/v1/chat-netfree/";
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
let token = "";
try { token = localStorage.getItem("chat_token") || ""; } catch (e) {}
if (!token) location.replace("./");

const OLD = "old", OWNER = "SHMUEL-LAMED";
const REPOS = ["rosh-berosh-2", "1", "SongToNotes", "Email-management-line", "shmuel-lamed.github.io"];
const MAX_ATT = 12000, UP_CHUNK = 3 * 1024 * 1024, UP_MAX = 100 * 1024 * 1024;
let uploading = 0;
let items = [], live = false, sig = "", sending = false, loaded = false, failed = [], editing = "", editDraft = null;
let meta = store.get("claude_convs", {}); if (!meta || typeof meta !== "object" || Array.isArray(meta)) meta = {};
let projects = store.get("claude_projects", []); if (!Array.isArray(projects)) projects = [];
let cur = store.get("claude_cur", "") || "";
let mode = store.get("claude_mode", "chat") === "code" ? "code" : "chat";
let view = "chat"; // chat | chats | projects | p:<id>
let chatQ = "", chatsSig = "";
let atts = [];
const prefs = Object.assign({ side: "left", theme: (store.get("chat_prefs", {}) || {}).theme || "auto", fs: "m", enter: true, serif: false }, store.get("claude_prefs", {}) || {});
let fb = store.get("claude_fb", {}); if (!fb || typeof fb !== "object") fb = {};
let chatTab = "active", projQ = "", projSearch = false, projSort = store.get("claude_psort", "updated");
let shut = store.get("claude_shut", {}); if (!shut || typeof shut !== "object") shut = {};
const coarse = matchMedia("(pointer: coarse)").matches;

function el(tag, cls, text) { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }
// הסמלים הם מחרוזות קבועות בקוד (לא תוכן מהשרת)
function icon(d, cls) { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); if (cls) s.setAttribute("class", cls); s.innerHTML = d; return s; }
const IC = {
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  ok: '<path d="m5 12 5 5 9-10"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  gear: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  back: '<path d="m14 6 6 6-6 6M20 12H4"/>',
  out: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 8l-4 4 4 4M11 12h10"/>',
  dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  edit: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  up: '<path d="M7 10v10H4V10zM7 10l4-7a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.300l-1.200 6A2 2 0 0 1 16.800 19H7"/>',
  down2: '<path d="M17 14V4h3v10zM17 14l-4 7a2 2 0 0 1-2-2v-4H6a2 2 0 0 1-2-2.300l1.200-6A2 2 0 0 1 7.200 5H17"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8 5.500 5.500 0 0 1 10.700-1.300A4.500 4.500 0 0 1 17 18z"/>',
  repo: '<path d="M5 4h13a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2zM5 17a2 2 0 0 1 2-2h12"/>',
  dl: '<path d="M12 4v11M8 11l4 4 4-4M5 19h14"/>',
  box: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
  sort: '<path d="M4 7h12M4 12h9M4 17h6M18 8v10m0 0-3-3m3 3 3-3"/>',
  pin: '<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3z"/><path d="M12 14v6"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  retry: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  quote: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0-6 6v4"/>',
  idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>',
  code: '<path d="m8 6-6 6 6 6M16 6l6 6-6 6"/>',
  bug: '<rect x="7" y="8" width="10" height="12" rx="5"/><path d="M12 8V5M9 5l1.5 2M15 5l-1.5 2M3 13h4M17 13h4M4 19l3-2M20 19l-3-2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 4-3 6-6 6H6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  spark: '<path d="M11.50 11.80 L10.75 2.28 Q10.75 1.15 12.00 1.09 Q13.25 1.15 13.25 2.28 L12.50 11.80 ZM11.67 11.57 L15.40 4.21 Q15.91 3.36 16.88 3.88 Q17.79 4.49 17.28 5.34 L12.53 12.09 ZM11.90 11.47 L19.78 5.60 Q20.78 4.98 21.52 6.05 Q22.15 7.19 21.16 7.81 L12.43 12.32 ZM12.20 11.50 L20.80 10.85 Q21.83 10.85 21.89 12.00 Q21.83 13.15 20.80 13.15 L12.20 12.50 ZM12.43 11.67 L21.15 16.04 Q22.12 16.62 21.53 17.72 Q20.83 18.76 19.86 18.18 L11.91 12.53 ZM12.53 11.91 L17.18 18.49 Q17.69 19.34 16.78 19.95 Q15.81 20.47 15.30 19.62 L11.67 12.43 ZM12.50 12.20 L13.30 21.79 Q13.30 22.96 12.00 23.02 Q10.70 22.96 10.70 21.79 L11.50 12.20 ZM12.33 12.43 L8.50 19.96 Q7.99 20.81 7.02 20.29 Q6.10 19.68 6.61 18.83 L11.47 11.91 ZM12.09 12.53 L4.05 18.23 Q3.09 18.81 2.39 17.77 Q1.80 16.67 2.76 16.09 L11.57 11.67 ZM11.80 12.50 L3.14 13.20 Q2.06 13.20 2.00 12.00 Q2.06 10.80 3.14 10.80 L11.80 11.50 ZM11.57 12.33 L3.02 8.06 Q2.06 7.48 2.65 6.38 Q3.34 5.34 4.31 5.92 L12.09 11.47 ZM11.47 12.09 L6.77 5.43 Q6.26 4.58 7.17 3.96 Q8.14 3.44 8.65 4.29 L12.33 11.57 ZM12 12m-1.9 0a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0Z"/>',
};
function spark() { const s = el("span", "spark"); s.setAttribute("aria-hidden", "true"); s.appendChild(icon(IC.spark)); return s; }
function ibtn(ic, label, fn) { const b = el("button", "ib"); b.type = "button"; b.title = label; b.setAttribute("aria-label", label); b.appendChild(icon(ic)); b.onclick = fn; return b; }

async function api(op, body) {
  let r;
  try {
    r = await fetch(API + op + "?token=" + encodeURIComponent(token), {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "text/plain;charset=UTF-8" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) { throw new Error("אין חיבור לשרת"); }
  const j = await r.json().catch(() => ({ error: "תקלה בחיבור" }));
  if (r.status === 401) { try { localStorage.removeItem("chat_token"); } catch (e) {} location.replace("./"); }
  if (!r.ok || j.error) throw new Error(j.error || "תקלה");
  return j;
}
function toast(t, act, fn) {
  const x = $("toast"); x.textContent = ""; x.appendChild(el("span", "", t));
  if (act) { const b = el("button", "", act); b.onclick = () => { x.classList.add("hide"); fn(); }; x.appendChild(b); }
  x.classList.remove("hide"); clearTimeout(toast.t); toast.t = setTimeout(() => x.classList.add("hide"), act ? 6000 : 2400);
}
const saveMeta = () => store.set("claude_convs", meta);
const saveProj = () => store.set("claude_projects", projects);
const newId = (p) => (p || "c") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clean = (s) => String(s || "").replace(/[\[\]·\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
const fmtTime = (t) => new Date(t).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
function fmtStamp(t) { const d = fmtDay(t); return (d === "היום" ? "" : d + ", ") + fmtTime(t); }
function ago(t) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60e3));
  if (m < 1) return "הרגע"; if (m < 60) return "לפני " + m + " דקות";
  const h = Math.round(m / 60); if (h < 24) return "לפני " + (h === 1 ? "שעה" : h === 2 ? "שעתיים" : h + " שעות");
  const d = Math.round(h / 24); if (d < 31) return "לפני " + (d === 1 ? "יום" : d === 2 ? "יומיים" : d + " ימים");
  return fmtDay(t);
}
function fmtDay(t) {
  const d = new Date(t), n = new Date();
  if (d.toDateString() === n.toDateString()) return "היום";
  if (d.toDateString() === new Date(n - 864e5).toDateString()) return "אתמול";
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
}
function greeting() { const h = new Date().getHours(); return h < 5 ? "לילה טוב" : h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 21 ? "ערב טוב" : "לילה טוב"; }
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

// ---- הגדרות
function applyPrefs() {
  let dark = prefs.theme === "dark";
  if (prefs.theme !== "dark" && prefs.theme !== "light") dark = matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.setProperty("--fs", ({ s: 14, m: 15, l: 17, xl: 19 }[prefs.fs] || 15) + "px");
  document.body.classList.toggle("sans", !prefs.serif);
  document.body.classList.toggle("lside", prefs.side !== "right");
  document.documentElement.dir = prefs.side !== "right" ? "ltr" : "rtl";
  $("tc").content = dark ? "#191919" : "#ffffff";
}
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyPrefs); } catch (e) {}
function openSettings() {
  const keys = el("div", "keys");
  for (const [k, t] of [["Ctrl+Shift+O", "שיחה חדשה"], ["Ctrl+K", "חיפוש בשיחות"], ["Ctrl+.", "הצגת / הסתרת הסרגל"], ["Ctrl+Enter", "שליחה תמיד"], ["Esc", "סגירת תפריט"]]) {
    const r = el("div"); r.append(el("span", "", t), el("kbd", "", k)); keys.appendChild(r);
  }
  openForm({
    title: "הגדרות",
    fields: [
      { k: "theme", label: "ערכת צבעים", type: "select", value: prefs.theme, options: [["auto", "לפי המכשיר"], ["light", "בהירה"], ["dark", "כהה"]] },
      { k: "side", label: "כיוון הממשק", type: "select", value: prefs.side, options: [["left", "משמאל לימין (כמו באתר הרשמי)"], ["right", "מימין לשמאל"]] },
      { k: "fs", label: "גודל הכתב", type: "select", value: prefs.fs, options: [["s", "קטן"], ["m", "רגיל"], ["l", "גדול"], ["xl", "גדול מאוד"]] },
      { k: "enter", label: "Enter שולח (Shift+Enter לשורה חדשה; בטלפון Enter תמיד שורה חדשה)", type: "check", value: prefs.enter },
      { k: "serif", label: "גופן סריף בתשובות של Claude (ברירת המחדל: כמו הממשק)", type: "check", value: prefs.serif },
    ],
    extra: keys,
    onOk(v) { Object.assign(prefs, v); store.set("claude_prefs", prefs); applyPrefs(); sig = ""; render(); },
  });
}

// ---- פענוח ההודעות: כותרת קלוד קוד, הנחיות פרויקט, קבצים מצורפים
const HEAD_RE = /^\[קלוד קוד(?: · מאגר: ([^\]·\n]+?))?(?: · ענף: ([^\]·\n]+?))?\]\n?/;
const PROJ_RE = /^\[הנחיות הפרויקט: ([^\]\n]+)\]\n([\s\S]*?)\n\[סוף ההנחיות\]\n*/;
const ATT_RE = /\n*\[קובץ מצורף: ([^\]\n]+)\]\n```\n[\s\S]*?(\n```|$)/g;
const UP_RE = /\n*\[קובץ שהועלה: ([^\]\n|]+?) \| [^\]\n]*\]/g;
function parse(t) {
  let s = String(t), code = null, proj = null, m;
  if ((m = s.match(HEAD_RE))) { code = { repo: (m[1] || "").trim(), branch: (m[2] || "").trim() }; s = s.slice(m[0].length); }
  if ((m = s.match(PROJ_RE))) { proj = { name: m[1], instr: m[2] }; s = s.slice(m[0].length); }
  const files = []; let attPart = "";
  s = s.replace(ATT_RE, (all, n) => { files.push(n); attPart += all; return ""; });
  s = s.replace(UP_RE, (all, n) => { files.push(n); attPart += all; return ""; }).trim();
  return { code, proj, text: s, files, attPart };
}
const short = (r) => String(r || "").replace(new RegExp("^" + OWNER + "/", "i"), "");
function repoFull(r) {
  r = clean(r).replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "").replace(/\s+/g, "");
  return !r ? "" : r.includes("/") ? r : OWNER + "/" + r;
}
const convItems = (id) => items.filter((m) => (m.conv || OLD) === id);
function convMode(id) {
  if (meta[id] && meta[id].mode) return meta[id].mode;
  const f = items.find((m) => (m.conv || OLD) === id && m.from === "me");
  return f && HEAD_RE.test(f.text) ? "code" : "chat";
}
function getRepo(id) {
  const x = meta[id] || {};
  if (x.repo != null) return { repo: x.repo, branch: x.branch || "" };
  for (let i = items.length - 1; i >= 0; i--) {
    const m = items[i];
    if ((m.conv || OLD) === id && m.from === "me") { const c = parse(m.text).code; if (c) return c; }
  }
  return { repo: "", branch: "" };
}
const projOf = (id) => projects.find((p) => p.id === (meta[id] || {}).project) || null;

// ---- רשימת השיחות
function convList() {
  const map = new Map();
  for (const m of items) {
    const id = m.conv || OLD;
    let c = map.get(id);
    if (!c) map.set(id, (c = { id, first: null, last: 0, waiting: false, hay: "" }));
    if (m.from === "me" && !c.first) c.first = parse(m.text);
    c.last = Math.max(c.last, m.at); c.waiting = m.from === "me"; c.needs = m.from !== "me" && !!m.confirm;
    c.hay += "\n" + String(m.text).toLowerCase();
  }
  for (const [id, x] of Object.entries(meta)) if (!map.has(id) && x.made && id === cur) map.set(id, { id, first: null, last: x.made, waiting: false, hay: "" });
  return [...map.values()].filter((c) => !(meta[c.id] || {}).hidden).map((c) => {
    const x = meta[c.id] || {};
    const auto = c.id === OLD ? "השיחה הקודמת" : c.first ? (c.first.text || c.first.files.join(", ") || "שיחה").replace(/\s+/g, " ").slice(0, 60) : "שיחה חדשה";
    return { ...c, title: x.title || auto, archived: !!x.archived, pinned: !!x.pinned, mode: x.mode || (c.first && c.first.code ? "code" : "chat"), project: x.project || "" };
  }).sort((a, b) => (b.pinned - a.pinned) || (b.last - a.last));
}
function renderSide() {
  for (const b of $("modes").children) b.setAttribute("aria-selected", String(b.dataset.mode === mode));
  $("projNav").classList.toggle("on", view === "projects" || view.startsWith("p:"));
  $("searchNav").classList.toggle("on", view === "chats");
  $("newbtn").classList.toggle("on", view === "chat" && !convItems(cur).length);
  const ms = $("meSub"); ms.className = live ? "on" : ""; ms.title = live ? "Claude מחובר" : "Claude לא מחובר כרגע"; $("me").title = "שמואל · " + ms.title;
  $("meTxt").textContent = "· " + (live ? "מחובר" : "לא מחובר"); $("sname").textContent = mode === "code" ? "Code" : "Claude";
  const box = $("convs");
  const list = convList().filter((c) => c.mode === mode && c.hay && !c.archived);
  // הרשימה נבנית מחדש רק כשמשהו השתנה, כדי שהמיקוד והתפריט הפתוח לא ייעלמו ברענון התקופתי
  const anyConv = list.length || convList().some((c) => c.hay);
  const ss = JSON.stringify([mode, view, cur, shut, anyConv, list.map((c) => [c.id, c.title, c.pinned, c.waiting, c.needs, c.mode === "code" ? getRepo(c.id).repo : ""])]);
  if (ss === renderSide.sig && box.firstChild) return;
  renderSide.sig = ss; box.textContent = "";
  if (!list.length) { const e0 = el("div", "grp"); e0.appendChild(el("span", "", anyConv ? "אין כאן שיחות פעילות" : "אין עדיין שיחות")); box.appendChild(e0); if (!anyConv) return; }
  let g = "";
  for (const c of list) {
    const ng = c.pinned ? "מוצמדות" : "אחרונות";
    if (ng !== g) {
      g = ng; const key = c.pinned ? "pin" : "rec";
      const h = el("button", "grp" + (shut[key] ? " shut" : "")); h.type = "button"; h.append(el("span", "", ng), icon(IC.down));
      h.onclick = () => { shut[key] = !shut[key]; store.set("claude_shut", shut); renderSide(); };
      box.appendChild(h);
    }
    if (shut[c.pinned ? "pin" : "rec"]) continue;
    const row = el("div", "ci" + (c.id === cur && view === "chat" ? " on" : ""));
    const t = el("button", "t"); t.title = c.title;
    if (c.mode === "code") t.appendChild(icon(IC.code));
    const tt = el("span", "tt", c.title); tt.dir = "auto"; t.appendChild(tt);
    if (c.mode === "code") { const r = String(getRepo(c.id).repo || "").split(",").map((x) => short(x.trim())).filter(Boolean).join(", "); if (r) t.appendChild(el("span", "sub", r)); }
    t.onclick = () => { openConv(c.id); if (innerWidth <= 820) closeSide(); };
    row.append(t);
    if (c.needs) { const d = el("span", "dot need"); d.title = "ממתין לאישור שלך"; row.append(d); }
    else if (c.waiting && c.id !== cur) { const d = el("span", "dot"); d.title = "ממתין לתשובה"; row.append(d); }
    const more = ibtn(IC.dots, "אפשרויות נוספות", (e) => { e.stopPropagation(); convMenu(c, more); });
    more.classList.add("more");
    row.append(more);
    box.appendChild(row);
  }
  const va = el("button", "", "הצגת הכול"); va.id = "viewAll"; va.type = "button"; va.onclick = () => openChats(false);
  box.appendChild(va);
}
// דף "שיחות": כל השיחות (בשני המצבים) עם חיפוש בכותרות ובתוכן
function renderChats(focus) {
  const box = $("projView"); box.textContent = "";
  const w = el("div", "pw"); box.appendChild(w);
  const top = el("div", "ptop"); top.appendChild(el("h1", "", "אחרונות"));
  const nb = el("button", "btn pri"); nb.type = "button"; nb.append(icon(IC.plus), document.createTextNode("שיחה חדשה")); nb.onclick = () => startNew();
  top.appendChild(nb); w.appendChild(top);
  const sb = el("div", "sbox"), inp = el("input"); inp.type = "search"; inp.id = "q"; inp.dir = "auto"; inp.placeholder = "חיפוש בפעילות שלך"; inp.setAttribute("aria-label", "חיפוש בשיחות"); inp.value = chatQ;
  sb.append(icon(IC.search), inp); w.appendChild(sb);
  const tabs = el("div", "tabs"); tabs.setAttribute("role", "tablist");
  for (const [k, t] of [["active", "פעילות"], ["archived", "בארכיון"]]) {
    const b = el("button", "", t); b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(chatTab === k));
    b.onclick = () => { chatTab = k; render(); const nb = document.querySelector(".tabs [aria-selected=true]"); if (nb) nb.focus(); };
    tabs.appendChild(b);
  }
  w.insertBefore(tabs, sb);
  const count = el("p", "note"), pl = el("div", "plist"); w.append(count, pl);
  const fill = () => {
    const q = chatQ.trim().toLowerCase();
    let list = convList().filter((c) => c.hay && c.archived === (chatTab === "archived"));
    if (q) list = list.filter((c) => c.title.toLowerCase().includes(q) || c.hay.includes(q));
    count.textContent = !list.length ? (q ? "לא נמצאו שיחות" : chatTab === "archived" ? "אין שיחות בארכיון" : "אין עדיין שיחות") : list.length === 1 ? "שיחה אחת" : list.length + " שיחות";
    pl.textContent = ""; pl.classList.toggle("hide", !list.length);
    for (const c of list) {
      const row = el("div", "prow"), b = el("button"); b.type = "button";
      const tt = el("span", "tt", c.title); tt.dir = "auto";
      const two = el("span", "two"); two.append(tt, el("small", "", "ההודעה האחרונה " + ago(c.last) + (c.mode === "code" ? " · קלוד קוד" : "")));
      b.append(icon(c.pinned ? IC.pin : c.mode === "code" ? IC.code : IC.chat), two);
      b.onclick = () => openConv(c.id);
      const more = ibtn(IC.dots, "אפשרויות נוספות", (e) => { e.stopPropagation(); convMenu(c, more); });
      row.append(b, more); pl.appendChild(row);
    }
  };
  inp.oninput = () => { chatQ = inp.value; fill(); };
  fill();
  if (focus) { inp.focus(); const n = inp.value.length; try { inp.setSelectionRange(n, n); } catch (e) {} }
}
function openChats(focus) {
  const was = view === "chats"; view = "chats";
  if (innerWidth <= 820) closeSide();
  if (was) { const q = $("q"); if (q && focus) { q.focus(); q.select(); } return; }
  render(); if (focus) { const q = $("q"); if (q) { q.focus(); q.select(); } }
}
function convMenu(c, anchor) {
  showMenu(anchor, [
    [c.pinned ? "ביטול הצמדה" : "הצמדה", IC.pin, () => { meta[c.id] = { ...meta[c.id], pinned: !c.pinned }; saveMeta(); render(); }],
    ["שינוי שם", IC.edit, () => rename(c.id, c.title)],
    ["שיוך לפרויקט", IC.folder, () => projMenu(c.id, anchor)],
    [c.archived ? "הוצאה מהארכיון" : "העברה לארכיון", IC.box, () => { meta[c.id] = { ...meta[c.id], archived: !c.archived }; saveMeta(); chatsSig = ""; if (!c.archived && cur === c.id && view === "chat") startNew(); else render(); toast(c.archived ? "השיחה חזרה לרשימה" : "השיחה עברה לארכיון"); }],
    null,
    ["מחיקה", IC.trash, () => delConv(c.id, c.title), "bad"],
  ]);
}
function delConv(id, title) {
  if (!confirm("למחוק את השיחה \"" + (title || "") + "\" מהרשימה במכשיר הזה?")) return;
  meta[id] = { ...meta[id], hidden: true }; saveMeta(); chatsSig = "";
  if (cur === id) { const v = view; startNew(); if (v !== "chat") { view = v; render(); } } else render();
  toast("השיחה נמחקה מהרשימה (במכשיר הזה)", "ביטול", () => { meta[id].hidden = false; saveMeta(); openConv(id); });
}
let menuAnchor = null, menuRect = null;
function showMenu(anchor, rows, before) {
  const m = $("menu");
  if (!m.classList.contains("hide") && menuAnchor === anchor) { hideMenu(true); return; }
  m.textContent = ""; menuAnchor = anchor;
  for (const r of rows) {
    if (!r) { m.appendChild(el("hr")); continue; }
    const [label, ic, fn, cls, key] = r;
    const b = el("button", cls || ""); b.type = "button"; b.setAttribute("role", "menuitem");
    if (ic) b.append(icon(ic));
    const lb = el("span", "", label); lb.dir = "auto"; b.append(lb);
    if (key) b.append(el("span", "k", key));
    if (cls === "cur") b.setAttribute("aria-checked", "true");
    b.onclick = (e) => { e.stopPropagation(); hideMenu(); fn(); };
    m.appendChild(b);
  }
  // תפריט החשבון: ברוחב הסרגל, עם שורת כותרת, ומיושר לשוליים של הסרגל
  const acct = anchor.id === "me";
  m.classList.toggle("acct", acct);
  if (acct) m.prepend(el("div", "mh", "שמואל · " + (live ? "Claude מחובר" : "Claude לא מחובר כרגע")));
  m.classList.toggle("pick", !!before);
  let first = null; if (before) first = before(m);
  m.classList.remove("hide");
  const r = anchor.isConnected ? (menuRect = anchor.getBoundingClientRect()) : menuRect || anchor.getBoundingClientRect();
  const below = r.bottom + 4 + m.offsetHeight < innerHeight - 8;
  m.style.top = Math.max(8, below ? r.bottom + 4 : r.top - 4 - m.offsetHeight) + "px";
  m.style.left = (acct ? Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, $("side").getBoundingClientRect().left + 8)) : Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, document.documentElement.dir === "ltr" ? r.left : r.right - m.offsetWidth))) + "px";
  (first || m.querySelector("button"))?.focus();
}
function hideMenu(back) { const m = $("menu"); if (m.classList.contains("hide")) return; m.classList.add("hide"); if (back && menuAnchor && menuAnchor.isConnected) menuAnchor.focus(); }
$("menu").addEventListener("keydown", (e) => {
  const bs = [...$("menu").querySelectorAll("button")], i = bs.indexOf(document.activeElement);
  if (e.key === "ArrowDown") { e.preventDefault(); (bs[i + 1] || bs[0]).focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); (bs[i - 1] || bs[bs.length - 1]).focus(); }
  else if (e.key === "Home") { e.preventDefault(); bs[0].focus(); }
  else if (e.key === "End") { e.preventDefault(); bs[bs.length - 1].focus(); }
  else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); hideMenu(true); }
  else if (e.key === "Tab") hideMenu();
});
document.addEventListener("click", (e) => { if (!$("menu").contains(e.target)) hideMenu(); });

// ---- טופס כללי בתוך חלון
function openForm(o) {
  const d = $("dlg"); d.textContent = "";
  const f = el("form"); f.method = "dialog";
  f.appendChild(el("h3", "", o.title));
  if (o.note) f.appendChild(el("p", "note", o.note));
  const inputs = {};
  for (const fd of o.fields) {
    const lab = el("label", "fld" + (fd.type === "check" ? " chk" : ""));
    let inp;
    if (fd.type === "area") { inp = el("textarea"); inp.rows = 7; inp.maxLength = 6000; }
    else if (fd.type === "select") { inp = el("select"); for (const [v, t] of fd.options) { const op = el("option", "", t); op.value = v; inp.appendChild(op); } }
    else { inp = el("input"); inp.type = fd.type === "check" ? "checkbox" : "text"; if (fd.type !== "check") inp.maxLength = fd.max || 100; }
    if (fd.type === "check") inp.checked = !!fd.value; else inp.value = fd.value || "";
    if (fd.ph) inp.placeholder = fd.ltr ? fd.ph : "\\u202B" + fd.ph + "\\u202C";
    if (fd.type !== "check" && fd.type !== "select") inp.dir = fd.ltr ? "ltr" : "auto";
    if (fd.type === "check") lab.append(inp, el("span", "", fd.label)); else lab.append(el("span", "", fd.label), inp);
    if (fd.list) {
      const dl = el("datalist"); dl.id = "dl_" + fd.k;
      for (const v of fd.list) { const op = el("option"); op.value = v; dl.appendChild(op); }
      lab.appendChild(dl); inp.setAttribute("list", dl.id);
      const ch = el("div", "chips");
      for (const v of fd.list) { const b = el("button", "", v); b.type = "button"; b.onclick = (e) => { e.preventDefault(); inp.value = v; inp.focus(); }; ch.appendChild(b); }
      lab.appendChild(ch);
    }
    if (fd.hint) lab.appendChild(el("small", "", fd.hint));
    f.appendChild(lab); inputs[fd.k] = inp;
  }
  if (o.extra) f.appendChild(o.extra);
  const row = el("div", "row");
  const no = el("button", "btn", "ביטול"); no.type = "button"; no.onclick = () => d.close("no");
  const ok = el("button", "btn pri", o.ok || "שמירה"); ok.value = "ok";
  row.append(no, ok); f.appendChild(row); d.appendChild(f);
  f.onsubmit = (e) => {
    const v = {}; for (const k in inputs) v[k] = inputs[k].type === "checkbox" ? inputs[k].checked : inputs[k].value;
    if (o.valid && !o.valid(v)) { e.preventDefault(); return; }
    d.onclose = null; setTimeout(() => o.onOk(v));
  };
  d.onclose = null; d.returnValue = ""; d.showModal();
  const first = f.querySelector("input[type=text],textarea"); if (first) { first.focus(); if (first.select) first.select(); }
}
// שינוי שם בתוך כותרת השיחה (שדה במקום הכותרת), כמו באתר הרשמי – בלי חלון
let renaming = false;
function rename(id) {
  if (id !== cur || view !== "chat") openConv(id);
  const c = convList().find((x) => x.id === id), ht = $("htitle");
  if (!c || !convItems(id).length) return;
  renaming = true; if (innerWidth <= 820) closeSide();
  const inp = el("input"); inp.id = "hname"; inp.type = "text"; inp.dir = "auto"; inp.maxLength = 80; inp.value = c.title; inp.setAttribute("aria-label", "שם השיחה");
  ht.classList.add("hide"); $("hmore").classList.add("hide"); ht.after(inp);
  let done = false;
  const end = (save, viaBlur) => {
    if (done) return; done = true; renaming = false;
    if (save) { meta[id] = { ...meta[id], title: clean(inp.value) || undefined }; saveMeta(); }
    inp.remove(); render();
    if (!viaBlur && view === "chat" && cur === id) $("htitle").focus();
  };
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); end(true); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); end(false); } };
  // השהיה קצרה ביציאה מהשדה, כדי שלחיצה על שורה בסרגל לא תיבלע בבנייה מחדש של הרשימה
  inp.onblur = () => setTimeout(() => end(true, true), 180);
  inp.focus(); inp.select();
}

