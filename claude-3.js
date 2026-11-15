"use strict";
// ---- Markdown קל לתשובות. בונה DOM בלבד (createElement / textContent), בלי innerHTML מהתוכן
function md(src) {
  const frag = document.createDocumentFragment();
  const L = String(src).replace(/\r/g, "").split("\n");
  let i = 0, list = null, para = null, quote = null;
  const flush = () => { list = para = quote = null; };
  const cells = (s) => s.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((x) => x.trim());
  while (i < L.length) {
    const l = L[i]; let m;
    if ((m = l.match(/^\s*(```|~~~)\s*([\w+#.-]*)/))) {
      const fence = m[1], buf = []; i++;
      while (i < L.length && !L[i].trim().startsWith(fence)) buf.push(L[i++]);
      i++; flush(); frag.appendChild(codeBlock(buf.join("\n"), m[2])); continue;
    }
    if (!l.trim()) { flush(); i++; continue; }
    if ((m = l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) { flush(); const h = el("h" + Math.min(m[1].length, 4)); h.dir = "auto"; inline(h, m[2]); frag.appendChild(h); i++; continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { flush(); frag.appendChild(el("hr")); i++; continue; }
    if (l.includes("|") && i + 1 < L.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(L[i + 1])) {
      flush();
      const tw = el("div", "tw"), tb = el("table"); tw.dir = "auto"; const th = el("thead"), tr = el("tr");
      for (const c of cells(l)) { const x = el("th"); inline(x, c); tr.appendChild(x); }
      th.appendChild(tr); tb.appendChild(th);
      const bd = el("tbody"); i += 2;
      while (i < L.length && L[i].includes("|") && L[i].trim()) {
        const r = el("tr"); for (const c of cells(L[i])) { const x = el("td"); inline(x, c); r.appendChild(x); }
        bd.appendChild(r); i++;
      }
      tb.appendChild(bd); tw.appendChild(tb); frag.appendChild(tw); continue;
    }
    if ((m = l.match(/^\s*>\s?(.*)$/))) {
      list = para = null;
      if (!quote) { quote = el("blockquote"); quote.dir = "auto"; frag.appendChild(quote); } else quote.appendChild(el("br"));
      inline(quote, m[1]); i++; continue;
    }
    if ((m = l.match(/^(\s*)([-*+•]|\d{1,3}[.)])\s+(.*)$/))) {
      const ord = /\d/.test(m[2]), tag = ord ? "OL" : "UL";
      para = quote = null;
      const li = el("li"); inline(li, m[3]);
      if (m[1].length >= 2 && list && list.lastElementChild) {
        const host = list.lastElementChild; let sub = host.lastElementChild;
        if (!sub || sub.tagName !== tag) { sub = el(tag.toLowerCase()); host.appendChild(sub); }
        sub.appendChild(li);
      } else {
        if (!list || list.tagName !== tag) { list = el(tag.toLowerCase()); list.dir = "auto"; if (ord && parseInt(m[2], 10) > 1) list.start = parseInt(m[2], 10); frag.appendChild(list); }
        list.appendChild(li);
      }
      i++; continue;
    }
    if (list && /^\s{2,}\S/.test(l)) { const li = list.lastElementChild; if (li) { li.appendChild(el("br")); inline(li, l.trim()); } i++; continue; }
    list = quote = null;
    if (!para) { para = el("p"); para.dir = "auto"; frag.appendChild(para); } else para.appendChild(el("br"));
    inline(para, l); i++;
  }
  return frag;
}
function codeBlock(code, lang) {
  const w = el("div", "cb");
  const b = el("button"); b.type = "button"; b.title = "העתקה"; b.setAttribute("aria-label", "העתקת הקוד"); b.append(icon(IC.copy));
  b.onclick = (e) => copy(code, e.currentTarget);
  const pre = el("pre"); pre.appendChild(el("code", "", code)); if (lang) pre.dataset.lang = lang;
  w.append(pre, b); return w;
}
const IRE = /`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|\[([^\]]+)\]\(\s*(https?:\/\/[^\s)]+)\s*\)|(https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]])|\*([^*\s](?:[^*]*[^*\s])?)\*/g;
function inline(node, s) {
  const re = new RegExp(IRE.source, "g");
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) node.appendChild(document.createTextNode(s.slice(last, m.index)));
    if (m[1] != null) node.appendChild(el("code", "", m[1]));
    else if (m[2] != null || m[3] != null) { const b = el("strong"); inline(b, m[2] != null ? m[2] : m[3]); node.appendChild(b); }
    else if (m[4] != null) { const b = el("del"); inline(b, m[4]); node.appendChild(b); }
    else if (m[5] != null) node.appendChild(link(m[6], m[5]));
    else if (m[7] != null) node.appendChild(link(m[7], m[7]));
    else { const b = el("em"); inline(b, m[8]); node.appendChild(b); }
    last = re.lastIndex;
  }
  if (last < s.length) node.appendChild(document.createTextNode(s.slice(last)));
}
function link(href, text) {
  const a = el("a", "", text);
  try { const u = new URL(href); if (u.protocol === "https:" || u.protocol === "http:") { a.href = u.href; a.target = "_blank"; a.rel = "noopener noreferrer"; } } catch (e) {}
  return a;
}

// ---- קבצים מצורפים: קובץ טקסט קטן נשלח בתוך ההודעה; כל קובץ אחר עולה לשרת בחלקים (claude_upload), ובהודעה נשלח רק המזהה שלו
function fileChip(name, onRemove) {
  const c = el("span", "chip"); c.appendChild(icon(IC.file)); const fn = el("span", "", name); fn.dir = "auto"; c.appendChild(fn);
  if (onRemove) { const x = el("button"); x.type = "button"; x.setAttribute("aria-label", "הסרת " + name); x.appendChild(icon(IC.x)); x.onclick = onRemove; c.appendChild(x); }
  return c;
}
const sizeLabel = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " מגה" : Math.max(1, Math.round(n / 1024)) + " ק״ב");
function renderAtts() {
  const box = $("atts"); box.textContent = "";
  atts.forEach((a, i) => box.appendChild(fileChip(a.name + (a.busy ? " – עולה " + a.pct + "%" : a.up ? " (" + sizeLabel(a.up.size) + ")" : ""), () => { a.gone = true; atts.splice(i, 1); renderAtts(); updSend(); })));
  const used = atts.reduce((n, a) => n + a.text.length, 0);
  $("hint").textContent = uploading ? "קובץ עולה, רגע..." : used ? Math.round(used / 1000) + " מתוך " + MAX_ATT / 1000 + " אלף תווים" : "";
}
async function upPart(a, i, f) {
  const q = "&id=" + a.up.id + "&part=" + i + "&parts=" + a.up.parts + "&size=" + f.size + "&name=" + encodeURIComponent(a.name) + "&type=" + encodeURIComponent(f.type || "");
  let err;
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(API + "claude_upload?token=" + encodeURIComponent(token) + q, { method: "POST", headers: { "content-type": "text/plain;charset=UTF-8" }, body: f.slice(i * UP_CHUNK, (i + 1) * UP_CHUNK) });
      const j = await r.json().catch(() => ({ error: "תקלה בחיבור" }));
      if (r.status === 401) { try { localStorage.removeItem("chat_token"); } catch (e) {} location.replace("./"); }
      if (r.ok && !j.error) return;
      err = new Error(j.error || "תקלה");
      if (r.status < 500) break;
    } catch (e) { err = new Error("אין חיבור לשרת"); }
  }
  throw err;
}
async function uploadFile(f) {
  if (!f.size) { toast("הקובץ " + f.name + " ריק"); return; }
  if (f.size > UP_MAX) { toast("הקובץ " + f.name + " גדול מדי – אפשר עד 100 מגה"); return; }
  const a = { name: f.name.replace(/[\]\n|]/g, " "), text: "", busy: true, pct: 0, up: { id: newId("f").replace(/[^a-z0-9]/gi, ""), parts: Math.ceil(f.size / UP_CHUNK), size: f.size } };
  atts.push(a); uploading++; renderAtts(); updSend();
  try {
    for (let i = 0; i < a.up.parts && !a.gone; i++) { await upPart(a, i, f); a.pct = Math.round(((i + 1) / a.up.parts) * 100); renderAtts(); }
    a.busy = false;
  } catch (e) {
    const k = atts.indexOf(a); if (k >= 0) atts.splice(k, 1);
    toast("העלאת " + f.name + " נכשלה: " + e.message);
  } finally { uploading--; renderAtts(); updSend(); }
}
async function addFiles(list) {
  for (const f of list) {
    let text = null;
    if (!/^(image|video|audio)\//.test(f.type) && f.size <= 400000) {
      try { text = await f.text(); } catch (e) { text = null; }
      if (text != null && /[\x00-\x08\x0e-\x1a]/.test(text.slice(0, 2000))) text = null;
      // קובץ טקסט שאין לו מקום בהודעה עולה כקובץ רגיל, במקום להיחתך
      if (text != null && atts.reduce((n, a) => n + a.text.length, 0) + text.length > MAX_ATT) text = null;
    }
    if (text != null) atts.push({ name: f.name.replace(/[\]\n]/g, " "), text });
    else await uploadFile(f);
  }
  renderAtts(); updSend();
}
$("attbtn").onclick = (e) => {
  e.stopPropagation();
  const rows = [["העלאת קבצים", IC.file, () => $("file").click(), "", "Ctrl+U"], ["שיוך לפרויקט", IC.folder, () => projMenu(cur, $("attbtn"))]];
  if (convMode(cur) === "code") rows.push(["בחירת מאגר", IC.repo, () => repoMenu($("attbtn"), 0)]);
  showMenu($("attbtn"), rows);
};
$("modeBtn").onclick = (e) => {
  e.stopPropagation();
  showMenu($("modeBtn"), [["Claude · שיחה", IC.chat, () => setMode("chat"), mode === "chat" ? "cur" : ""], ["Code · עבודה על מאגרים", IC.code, () => setMode("code"), mode === "code" ? "cur" : ""]]);
};
// הכתבה: זיהוי הדיבור של הדפדפן, אם קיים. הטקסט נכנס לתיבה ולא נשלח לבד
const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null;
function stopDict() {
  if (!rec) return; const r = rec; rec = null; r.onresult = r.onerror = r.onend = null;
  try { r.abort(); } catch (e) {}
  const b = $("dictBtn"); b.classList.remove("on"); b.title = "הכתבה"; b.setAttribute("aria-pressed", "false");
}
$("dictBtn").onclick = () => {
  const btn = $("dictBtn");
  if (!SR) { toast("הדפדפן הזה לא תומך בהכתבה"); return; }
  if (rec) { stopDict(); return; }
  const t = $("text"); let fin = "", shown = "";
  try {
    const r0 = rec = new SR(); rec.lang = "he-IL"; rec.interimResults = true; rec.continuous = true;
    rec.onresult = (ev) => {
      if (rec !== r0) return;
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) { const x = ev.results[i]; if (x.isFinal) fin += x[0].transcript; else interim += x[0].transcript; }
      // מחליפים רק את מה שההכתבה עצמה הוסיפה; אם הטקסט נערך ביד בינתיים, ממשיכים אחריו
      let v = t.value;
      if (shown && v.endsWith(shown)) v = v.slice(0, v.length - shown.length); else if (shown) { fin = ""; for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) fin += ev.results[i][0].transcript; }
      const add = (fin + interim).trim(); shown = add ? (v && !/\s$/.test(v) ? " " : "") + add : "";
      t.value = v + shown; grow(); updSend(); store.set("claude_draft_" + cur, t.value);
    };
    rec.onerror = (ev) => { toast(ev.error === "not-allowed" || ev.error === "service-not-allowed" ? "אין הרשאה למיקרופון" : ev.error === "no-speech" ? "לא נשמע דיבור" : "ההכתבה לא זמינה כרגע"); };
    rec.onend = () => { if (rec === r0) stopDict(); };
    rec.start(); btn.classList.add("on"); btn.title = "עצירת ההכתבה"; btn.setAttribute("aria-pressed", "true"); t.focus();
  } catch (x) { rec = null; btn.classList.remove("on"); toast("ההכתבה לא זמינה כרגע"); }
};
$("file").onchange = (e) => { addFiles([...e.target.files]); e.target.value = ""; };
const cmp = $("compose");
cmp.addEventListener("dragover", (e) => { e.preventDefault(); cmp.classList.add("drag"); });
cmp.addEventListener("dragleave", () => cmp.classList.remove("drag"));
cmp.addEventListener("drop", (e) => { e.preventDefault(); cmp.classList.remove("drag"); addFiles([...e.dataTransfer.files]); });
$("text").addEventListener("paste", (e) => { const f = [...((e.clipboardData && e.clipboardData.files) || [])]; if (f.length) { e.preventDefault(); addFiles(f); } });


// ---- שליחה
function grow() { const t = $("text"); t.style.height = "auto"; t.style.height = Math.min(260, t.scrollHeight) + "px"; updJump(); }
function updSend() { $("sendbtn").disabled = sending || uploading > 0 || (!$("text").value.trim() && !atts.length); }
$("text").addEventListener("input", () => { grow(); updSend(); store.set("claude_draft_" + cur, $("text").value); });
$("text").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  if (e.ctrlKey || e.metaKey || (prefs.enter && !coarse)) { e.preventDefault(); cmp.requestSubmit(); }
});
cmp.onsubmit = (e) => {
  e.preventDefault();
  if (sending) return;
  if (uploading) { toast("רגע, קובץ עדיין עולה"); return; }
  const t = $("text"); let body = t.value.trim();
  if (atts.length) body = (body || "מצורף קובץ") + atts.map((a) => a.up ? "\n\n[קובץ שהועלה: " + a.name + " | " + sizeLabel(a.up.size) + " | מזהה: " + a.up.id + " | חלקים: " + a.up.parts + "]" : "\n\n[קובץ מצורף: " + a.name + "]\n```\n" + a.text + "\n```").join("");
  if (!body) return;
  stopDict(); t.value = ""; atts = []; renderAtts(); grow(); store.set("claude_draft_" + cur, "");
  send(body);
};
// ההנחיות של הפרויקט נשלחות פעם אחת בכל שיחה (ושוב אם השתנו), בתוך סימון ברור
function instrFor(id) {
  const p = projOf(id); if (!p || !String(p.instr || "").trim()) return null;
  const key = p.id + ":" + hash(p.instr);
  return (meta[id] || {}).isent === key ? null : { p, key };
}
function outgoing(id, body) {
  let t = body, key = "";
  const ins = instrFor(id);
  if (ins) { t = "[הנחיות הפרויקט: " + clean(ins.p.name) + "]\n" + ins.p.instr.trim() + "\n[סוף ההנחיות]\n\n" + t; key = ins.key; }
  if (convMode(id) === "code") {
    const r = getRepo(id);
    t = "[קלוד קוד" + (r.repo ? " · מאגר: " + r.repo : "") + (r.branch ? " · ענף: " + r.branch : "") + "]\n" + t;
  }
  return { text: t, key };
}
async function send(body, o) {
  o = o || {};
  if (sending) { toast("רגע, הודעה קודמת עדיין נשלחת"); return; }
  const cid = cur, conv = cid === OLD ? "" : cid;
  let text = body, key = o.key || "";
  if (!o.plain) ({ text, key } = outgoing(cid, body));
  if (!String(text).trim()) return;
  sending = true; updSend();
  const tmp = { id: "tmp" + Date.now(), from: "me", conv, text, at: Date.now(), status: "new" };
  items.push(tmp); sig = ""; render();
  const sc = $("scroll"); sc.scrollTop = sc.scrollHeight;
  try {
    await api("claude_send", { text, conv });
    const x = (meta[cid] = meta[cid] || {});
    if (key) x.isent = key;
    if (!x.mode) x.mode = convMode(cid);
    delete x.made; saveMeta();
    sending = false;
    await load();
    // שרת ישן בלי שיחות נפרדות: כל ההודעות בשיחה אחת
    if (items.length && !items.some((m) => "conv" in m) && cur !== OLD) openConv(OLD);
  } catch (err) {
    items = items.filter((m) => m !== tmp);
    failed.push({ id: "f" + Date.now(), conv: cid, text, key, at: tmp.at, err: err.message });
    sig = ""; render(); toast(err.message);
  } finally { sending = false; updSend(); }
}

// ---- טעינה
async function load() {
  let j;
  try { j = await api("claude_history"); } catch (e) { const st = $("status"); st.textContent = e.message; st.className = "err"; $("me").title = e.message; return; }
  items = (j.items || []).map((m) => ({ ...m, text: String(m.text == null ? "" : m.text), at: typeof m.at === "number" ? m.at : new Date(m.at).getTime() }));
  live = !!j.live;
  if (!loaded) {
    const list = convList();
    if (!cur || (!list.some((c) => c.id === cur) && !(meta[cur] && meta[cur].made))) {
      if (list.length && Date.now() - list[0].last < 6 * 3600e3) cur = list[0].id;
      else { cur = newId(); meta[cur] = { made: Date.now(), mode }; if (mode === "code") Object.assign(meta[cur], lastRepo()); saveMeta(); }
      store.set("claude_cur", cur);
    }
    mode = convMode(cur);
    loadDraft();
  }
  render();
  loaded = true;
}
// כפתור "מעבר לסוף השיחה": מופיע כשגוללים למעלה
function fmtDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m " + String(s % 60).padStart(2, "0") + "s";
  return Math.floor(m / 60) + "h " + String(m % 60).padStart(2, "0") + "m";
}
function tickThink() { const t = $("thinkT"); if (t) t.textContent = fmtDur(Date.now() - (+t.dataset.at || Date.now())); }
setInterval(tickThink, 1000);

// ---- חלונית פרטי השיחה ושיתוף
let panelOn = store.get("claude_panel", innerWidth >= 1200);
function setPanel(on) {
  panelOn = !!on; if (innerWidth > 820) store.set("claude_panel", panelOn);
  document.body.classList.toggle("panel", panelOn);
  $("panelBtn").classList.toggle("on", panelOn); $("panelBtn").setAttribute("aria-pressed", String(panelOn));
  if (panelOn) renderPanel(); updJump();
}
function codeBlocks(id) {
  const out = [];
  for (const m of convItems(id)) {
    if (m.from === "me") continue;
    const re = /(?:^|\n)\s*(```|~~~)\s*([\w+#.-]*)\n([\s\S]*?)\n\s*\1/g; let x;
    while ((x = re.exec(m.text))) out.push({ lang: x[2] || "code", code: x[3] });
  }
  return out;
}
function renderPanel() {
  const P = $("panel"); if (!panelOn) return; P.textContent = "";
  const sec = (title) => { const s = el("section"); s.appendChild(el("h4", "", title)); P.appendChild(s); return s; };
  const row = (ic, text, fn, extra) => {
    const r = el(fn ? "button" : "div", "pr"); if (fn) { r.type = "button"; r.onclick = fn; }
    if (ic) r.appendChild(icon(ic)); const sp = el("span", extra && extra.ltr ? "ltr" : "", text); if (!(extra && extra.ltr)) sp.dir = "auto"; r.appendChild(sp);
    if (extra && extra.small) r.appendChild(el("small", "", extra.small));
    return r;
  };
  const x = ibtn(IC.x, "סגירת החלונית", () => setPanel(false)); x.id = "panelX";
  const code = convMode(cur) === "code", mine = convItems(cur), p = projOf(cur);
  const env = sec("סביבה"); env.firstChild.style.display = "flex"; env.firstChild.appendChild(x);
  env.appendChild(row(IC.cloud, code ? "Code · עבודה על מאגרים" : "Claude · שיחה"));
  if (code) {
    const r = getRepo(cur);
    const rl = repoList(cur);
    if (!rl.length) env.appendChild(row(IC.repo, "בחירת מאגר", (e) => { e.stopPropagation(); repoMenu(e.currentTarget, 0); }));
    rl.forEach((full, i) => {
      const rr = row(IC.repo, full, (e) => { e.stopPropagation(); repoMenu(e.currentTarget, i); }, { ltr: true });
      if (i === 0) { const add = el("span", "", ""); add.className = "addr"; add.title = "הוספת מאגר נוסף"; add.setAttribute("role", "button"); add.tabIndex = 0; add.appendChild(icon(IC.plus)); const go = (e) => { e.stopPropagation(); e.preventDefault(); repoMenu(add, -1); }; add.onclick = go; add.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") go(e); }; rr.appendChild(add); }
      env.appendChild(rr);
    });
    if (r.repo) env.appendChild(row(IC.branch, r.branch || "main", (e) => { e.stopPropagation(); branchMenu(e.currentTarget); }, { ltr: true, small: r.branch ? "" : "ברירת מחדל" }));
  }
  env.appendChild(row(IC.folder, p ? p.name : "ללא פרויקט", (e) => { e.stopPropagation(); projMenu(cur, e.currentTarget); }));
  const con = sec("חיבור");
  const cr = el("div", "pr"); const dot = el("i", "dot" + (live ? " on" : "")); cr.append(dot, el("span", "", live ? "Claude מחובר" : "Claude לא מחובר כרגע")); con.appendChild(cr);
  const mineN = mine.filter((m) => m.from === "me").length, ansN = mine.length - mineN;
  con.appendChild(row(IC.chat, "הודעות בשיחה", null, { small: mineN + " שלך · " + ansN + " תשובות" }));
  const files = []; for (const m of mine) if (m.from === "me") for (const f of parse(m.text).files) if (!files.includes(f)) files.push(f);
  if (files.length) { const fs = sec("קבצים ששלחת"); for (const f of files.slice(0, 12)) fs.appendChild(row(IC.file, f)); if (files.length > 12) fs.appendChild(el("div", "more", "ועוד " + (files.length - 12))); }
  const blocks = codeBlocks(cur);
  if (blocks.length) {
    const cs = sec("קוד מהתשובות");
    blocks.slice(0, 12).forEach((b, i) => {
      const n = b.code.split("\n").length;
      cs.appendChild(row(IC.code, b.lang + " · " + (i + 1), (e) => copy(b.code, e.currentTarget), { ltr: true, small: n === 1 ? "שורה אחת" : n + " שורות" }));
    });
    if (blocks.length > 12) cs.appendChild(el("div", "more", "ועוד " + (blocks.length - 12)));
  }
}
function convAsText(id) {
  const c = convList().find((z) => z.id === id), L = ["# " + (c ? c.title : "שיחה"), ""];
  for (const m of convItems(id)) {
    if (m.from === "me") { const P = parse(m.text); L.push("**אני** (" + fmtStamp(m.at) + "):", "", P.text + (P.files.length ? "\n\n[קבצים מצורפים: " + P.files.join(", ") + "]" : ""), ""); }
    else L.push("**Claude** (" + fmtStamp(m.at) + "):", "", m.text, "");
  }
  return L.join("\n");
}
$("panelBtn").onclick = () => setPanel(!panelOn);
$("shareBtn").onclick = (e) => {
  e.stopPropagation();
  showMenu($("shareBtn"), [
    ["העתקת כל השיחה", IC.copy, () => copy(convAsText(cur), null)],
    ["הורדה כקובץ טקסט", IC.dl, () => {
      const c = convList().find((z) => z.id === cur), a = el("a");
      a.href = "data:text/markdown;charset=utf-8," + encodeURIComponent(convAsText(cur));
      a.download = ((c ? c.title : "שיחה").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60) || "שיחה") + ".md";
      document.body.appendChild(a); a.click(); a.remove(); toast("ההורדה התחילה");
    }],
  ]);
};
function updJump() {
  const sc = $("scroll"), far = !sc.classList.contains("hide") && sc.scrollHeight - sc.scrollTop - sc.clientHeight > 160;
  $("jump").classList.toggle("hide", !far);
  $("jump").style.bottom = ($("composeWrap").offsetHeight + 16) + "px";
}
$("scroll").addEventListener("scroll", updJump, { passive: true });
try { new ResizeObserver(() => updJump()).observe($("composeWrap")); } catch (e) {}
$("jump").onclick = () => { const sc = $("scroll"); sc.scrollTo({ top: sc.scrollHeight, behavior: "smooth" }); };
function sideA11y(focus) {
  const open = !document.body.classList.contains("closed"), phone = innerWidth <= 820;
  $("main").inert = phone && open;
  if (phone && focus) (open ? $("closeSide") : $("openSide")).focus();
}
function closeSide() { document.body.classList.add("closed"); if (innerWidth > 820) store.set("claude_side", false); sideA11y(false); }
function toggleSide() { document.body.classList.toggle("closed"); if (innerWidth > 820) store.set("claude_side", !document.body.classList.contains("closed")); sideA11y(true); }
addEventListener("resize", () => { sideA11y(false); updJump(); });
for (const b of $("modes").children) b.onclick = () => { setMode(b.dataset.mode); if (innerWidth <= 820) closeSide(); };
$("newbtn").onclick = () => { startNew(); if (innerWidth <= 820) closeSide(); };
$("newTop").onclick = () => startNew();
$("projNav").onclick = () => { view = "projects"; render(); if (innerWidth <= 820) closeSide(); };
$("searchNav").onclick = () => openChats(true);
$("me").onclick = (e) => {
  e.stopPropagation();
  showMenu($("me"), [
    ["הגדרות", IC.gear, () => { if (innerWidth <= 820) closeSide(); openSettings(); }],
    ["חזרה לצ'אטים", IC.back, () => { location.href = "./"; }],
    null,
    ["יציאה מהחשבון", IC.out, () => {
      if (!confirm("לצאת מהחשבון באתר?")) return;
      api("logout", {}).catch(() => {}).finally(() => { try { localStorage.removeItem("chat_token"); } catch (x) {} location.replace("./"); });
    }],
  ]);
};
for (const b of document.querySelectorAll(".nav.soon")) b.onclick = () => toast(b.dataset.soon + " – עדיין לא מחובר באתר הזה");
$("custNav").onclick = () => { if (innerWidth <= 820) closeSide(); openSettings(); };
$("setBtn").onclick = () => { if (innerWidth <= 820) closeSide(); openSettings(); };
$("openSide").onclick = toggleSide;
$("closeSide").onclick = toggleSide;
$("scrim").onclick = closeSide;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hideMenu(true);
    // בטלפון הסרגל הוא שכבה: Escape סוגר אותו ומחזיר את המיקוד לכפתור שפתח אותו
    if (innerWidth <= 820 && panelOn && !$("dlg").open) { setPanel(false); $("panelBtn").focus(); }
    else if (innerWidth <= 820 && !document.body.classList.contains("closed") && !$("dlg").open) { closeSide(); $("openSide").focus(); }
  }
  if (!(e.ctrlKey || e.metaKey) || e.altKey || $("dlg").open) return;
  if (e.shiftKey && e.code === "KeyO") { e.preventDefault(); startNew(); }
  else if (!e.shiftKey && e.code === "KeyU" && view === "chat") { e.preventDefault(); $("file").click(); }
  else if (!e.shiftKey && e.code === "KeyK") { e.preventDefault(); openChats(true); }
  else if (!e.shiftKey && e.code === "Period") { e.preventDefault(); toggleSide(); }
});
// הדפדפן שומר את הדף כמה דקות. בודקים מול השרת, ואם עלתה גרסה חדשה – טוענים אותה, אבל רק כשלא באמצע כתיבה
async function checkVersion() {
  try {
    const r = await fetch(location.pathname + "?nocache=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return;
    const m = (await r.text()).match(/const VER = "([^"]+)"/);
    if (!m || m[1] === VER) return;
    const busy = sending || $("dlg").open || $("text").value.trim() || atts.length || renaming || editing || rec;
    if (busy) { toast("יש גרסה חדשה של הדף", "רענון", () => location.replace(location.pathname + "?v=" + encodeURIComponent(m[1]))); return; }
    location.replace(location.pathname + "?v=" + encodeURIComponent(m[1]));
  } catch (e) {}
}
setTimeout(checkVersion, 1500); setInterval(() => { if (!document.hidden) checkVersion(); }, 5 * 60e3);
applyPrefs();
setPanel(innerWidth > 820 ? panelOn : false);
if (innerWidth > 820 && store.get("claude_side", true)) document.body.classList.remove("closed");
renderHello();
if (token) { load(); setInterval(() => { if (!document.hidden && !sending) load(); }, 6000); }
