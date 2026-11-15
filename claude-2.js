"use strict";
// ---- פרויקטים
function projForm(p, assignTo) {
  openForm({
    title: p ? "עריכת פרויקט" : "פרויקט חדש",
    note: "ההנחיות נשלחות ל-Claude פעם אחת, בהודעה הראשונה של כל שיחה בפרויקט (ושוב אם שינית אותן), בתוך סימון ברור.",
    fields: [
      { k: "name", label: "שם הפרויקט", value: p ? p.name : "", max: 60, ph: "לדוגמה: דברי תורה לשבת" },
      { k: "desc", label: "על מה תרצה לעבוד? (לא חובה)", value: p ? p.desc || "" : "", max: 120 },
      { k: "instr", label: "הקשר והנחיות קבועות (לא חובה)", type: "area", value: p ? p.instr : "", ph: "מה Claude צריך לדעת בכל שיחה בפרויקט הזה" },
    ],
    ok: p ? "שמירה" : "יצירה",
    valid(v) { if (!clean(v.name)) { toast("צריך לתת שם לפרויקט"); return false; } return true; },
    onOk(v) {
      const desc = String(v.desc || "").replace(/[\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
      if (p) { p.name = clean(v.name); p.desc = desc; p.instr = v.instr.trim(); p.upd = Date.now(); }
      else {
        p = { id: newId("p"), name: clean(v.name), desc, instr: v.instr.trim(), at: Date.now() }; projects.unshift(p);
        if (assignTo) { meta[assignTo] = { ...meta[assignTo], project: p.id }; saveMeta(); sig = ""; }
      }
      saveProj(); if (view === "projects" || view.startsWith("p:")) view = "p:" + p.id; render();
    },
  });
}
function projMenu(id, anchor) {
  const curP = (meta[id] || {}).project || "";
  const rows = [["ללא פרויקט", null, () => setProj(id, ""), curP ? "" : "cur"]];
  for (const p of projects) rows.push([p.name, IC.folder, () => setProj(id, p.id), p.id === curP ? "cur" : ""]);
  rows.push(null, ["פרויקט חדש…", IC.plus, () => projForm(null, id)]);
  showMenu(anchor, rows);
}
function setProj(id, pid) { meta[id] = { ...meta[id], project: pid }; saveMeta(); sig = ""; render(); }
// דף הפרויקטים נבנה מחדש רק כשמשהו השתנה, כדי ששדה החיפוש והמיקוד לא ייעלמו ברענון התקופתי
const projSig = () => view + projSort + projSearch + JSON.stringify(projects) + JSON.stringify(convList().map((c) => [c.id, c.title, c.last, c.project, c.mode]));
function renderProjects() { drawProjects(); renderProjects.sig = projSig(); }
function drawProjects() {
  const box = $("projView"); box.textContent = "";
  const w = el("div", "pw"); box.appendChild(w);
  const p = view.startsWith("p:") ? projects.find((x) => x.id === view.slice(2)) : null;
  if (!p) {
    view = "projects";
    const top = el("div", "ptop"); top.appendChild(el("h1", "", "פרויקטים"));
    const hb = el("div", "hb");
    const sbtn = ibtn(IC.search, "חיפוש בפרויקטים", () => { projSearch = !projSearch; if (!projSearch) projQ = ""; renderProjects(); const q = projSearch ? $("pq") : document.querySelector(".ptop .hb .ib"); if (q) q.focus(); });
    const SORTS = [["updated", "עדכון אחרון"], ["created", "תאריך יצירה"], ["alpha", "לפי שם"]];
    const obtn = ibtn(IC.sort, "מיון הפרויקטים", (e) => { e.stopPropagation(); showMenu(obtn, SORTS.map(([k, t]) => [t, null, () => { projSort = k; store.set("claude_psort", k); setTimeout(() => { const o = document.querySelector(".ptop .hb .ib:nth-child(2)"); if (o) o.focus(); }); renderProjects(); }, projSort === k ? "cur" : ""])); });
    const nb = el("button", "btn pri"); nb.type = "button"; nb.append(icon(IC.plus), document.createTextNode("פרויקט חדש")); nb.onclick = () => projForm(null);
    hb.append(sbtn, obtn, nb); top.appendChild(hb); w.appendChild(top);
    if (projSearch) {
      const sb = el("div", "sbox"), inp = el("input"); inp.type = "search"; inp.id = "pq"; inp.dir = "auto"; inp.placeholder = "חיפוש בפרויקטים"; inp.setAttribute("aria-label", "חיפוש בפרויקטים"); inp.value = projQ;
      inp.oninput = () => { projQ = inp.value; fillP(); };
      inp.onkeydown = (e) => { if (e.key === "Escape") { projSearch = false; projQ = ""; renderProjects(); const nb = document.querySelector(".ptop .hb .ib"); if (nb) nb.focus(); } };
      sb.append(icon(IC.search), inp); w.appendChild(sb);
    }
    const info = el("p", "note"), g = el("div", "grid"); w.append(info, g);
    const all = convList();
    const lastOf = (x) => all.filter((k) => k.project === x.id).reduce((n, k) => Math.max(n, k.last), x.upd || x.at || 0);
    const fillP = () => {
      const q = projQ.trim().toLowerCase();
      let list = projects.filter((x) => !q || (x.name + " " + (x.desc || "")).toLowerCase().includes(q));
      list = list.slice().sort((a, b2) => projSort === "alpha" ? a.name.localeCompare(b2.name, "he") : projSort === "created" ? (b2.at || 0) - (a.at || 0) : lastOf(b2) - lastOf(a));
      info.textContent = !projects.length ? "אין עדיין פרויקטים. פרויקט שומר הנחיות קבועות לכמה שיחות, ונשמר במכשיר הזה." : !list.length ? "לא נמצאו פרויקטים" : "";
      info.classList.toggle("hide", !info.textContent); g.textContent = "";
      for (const x of list) {
        const c = el("button", "card"); c.type = "button";
        const tile = el("span", "tile"); tile.appendChild(icon(IC.folder));
        const n = all.filter((k) => k.project === x.id).length;
        const tx = el("span", "tx"); const nm = el("b", "", x.name); nm.dir = "auto"; tx.append(nm, el("small", "", (n === 1 ? "שיחה אחת" : n + " שיחות") + (x.desc ? " · " + x.desc : "")));
        c.append(tile, tx);
        c.onclick = () => { view = "p:" + x.id; render(); };
        g.appendChild(c);
      }
    };
    fillP(); return;
  }
  const back = el("button", "back", (document.documentElement.dir === "ltr" ? "← " : "→ ") + "כל הפרויקטים"); back.type = "button"; back.onclick = () => { view = "projects"; render(); };
  w.appendChild(back);
  const top = el("div", "ptop"); const ph1 = el("h1", "", p.name); ph1.dir = "auto"; top.appendChild(ph1);
  const r = el("div", "row");
  const nb = el("button", "btn pri"); nb.type = "button"; nb.append(icon(IC.plus), document.createTextNode("שיחה חדשה בפרויקט")); nb.onclick = () => startNew(p.id);
  const eb = el("button", "btn"); eb.type = "button"; eb.append(icon(IC.edit), document.createTextNode("עריכה")); eb.onclick = () => projForm(p);
  const db = el("button", "btn bad"); db.type = "button"; db.append(icon(IC.trash), document.createTextNode("מחיקה"));
  db.onclick = () => {
    if (!confirm("למחוק את הפרויקט \"" + p.name + "\"? השיחות עצמן יישארו.")) return;
    projects = projects.filter((x) => x !== p); saveProj();
    for (const k in meta) if (meta[k].project === p.id) meta[k].project = "";
    saveMeta(); view = "projects"; render();
  };
  r.append(nb, eb, db); top.appendChild(r); w.appendChild(top);
  if (p.desc) { const pd = el("p", "note", p.desc); pd.dir = "auto"; w.appendChild(pd); }
  const ins = el("div", "instr", p.instr || "אין הנחיות. אפשר להוסיף בעריכה."); ins.dir = "auto"; w.appendChild(ins);
  const list = convList().filter((c) => c.project === p.id);
  w.appendChild(el("p", "note", list.length ? "שיחות בפרויקט" : "אין עדיין שיחות בפרויקט."));
  const pl = el("div", "plist");
  for (const c of list) {
    const b = el("button"); b.type = "button";
    const ptt = el("span", "tt", c.title); ptt.dir = "auto"; b.append(icon(c.mode === "code" ? IC.code : IC.chat), ptt, el("span", "meta", fmtDay(c.last)));
    b.onclick = () => openConv(c.id);
    pl.appendChild(b);
  }
  if (list.length) w.appendChild(pl);
}

// ---- תצוגה
function setMode(m) {
  if (m === mode && view === "chat") return;
  mode = m; view = "chat"; store.set("claude_mode", mode);
  if (view === "chat" && !convItems(cur).length && meta[cur] && meta[cur].made) {
    meta[cur].mode = mode; if (mode === "code" && meta[cur].repo == null) Object.assign(meta[cur], lastRepo()); saveMeta(); sig = ""; render();
  } else startNew();
}
function lastRepo() { const r = store.get("claude_lastrepo", null); return r && typeof r === "object" ? { repo: r.repo || "", branch: r.branch || "" } : { repo: "", branch: "" }; }
function startNew(pid) {
  cur = newId(); view = "chat";
  meta[cur] = { made: Date.now(), mode, project: typeof pid === "string" ? pid : "" };
  if (mode === "code") Object.assign(meta[cur], lastRepo());
  saveMeta(); store.set("claude_cur", cur);
  sig = ""; editing = ""; loadDraft(); render(); $("text").focus();
}
function openConv(id) {
  cur = id; view = "chat"; mode = convMode(id); store.set("claude_cur", cur); store.set("claude_mode", mode);
  sig = ""; editing = ""; loadDraft(); render();
}
function loadDraft() { stopDict(); $("text").value = store.get("claude_draft_" + cur, "") || ""; atts = []; renderAtts(); grow(); updSend(); }
function tagEl(ic, text, ltr, fn) {
  const t = el(fn ? "button" : "span", "tag" + (ltr ? " ltr" : "")); if (fn) { t.type = "button"; t.onclick = fn; }
  const ts = el("span", "", text); if (!ltr) ts.dir = "auto"; t.append(icon(ic), ts); return t;
}
function renderHead() {
  const b = $("badges"); b.textContent = "";
  const s = $("status"); s.className = live ? "on" : ""; s.textContent = live ? "Claude מחובר" : "Claude לא מחובר כרגע"; s.title = s.textContent;
  const ht = $("htitle"), hm = $("hmore");
  const c = view === "chat" ? convList().find((x) => x.id === cur) : null;
  const has = !!c && convItems(cur).length > 0;
  if (!renaming) {
    ht.textContent = has ? c.title : ""; ht.dir = "auto"; ht.classList.toggle("hide", !has); hm.classList.toggle("hide", !has);
    if (has) { ht.onclick = () => rename(c.id); hm.onclick = (e) => { e.stopPropagation(); convMenu(c, hm); }; }
  }
  if (view !== "chat") return;
  const p = projOf(cur);
  if (p) b.appendChild(tagEl(IC.folder, p.name, false, () => { view = "p:" + p.id; render(); }));
  if (convMode(cur) === "code" && has) { const r = getRepo(cur); b.appendChild(tagEl(IC.branch, r.repo ? repoList(cur).map(short).join(", ") + (r.branch ? " · " + r.branch : "") : "ללא מאגר", true, (e) => { e.stopPropagation(); repoMenu(e.currentTarget, 0); })); }
}
function renderTools() {
  const code = convMode(cur) === "code";
  const p = projOf(cur), pb = $("projBtn");
  pb.textContent = ""; const pbs = el("span", "", p ? p.name : "פרויקט"); pbs.dir = "auto"; pb.append(icon(IC.folder), pbs);
  pb.title = "שיוך השיחה לפרויקט";
  const rb = $("repoBtn"); rb.classList.toggle("hide", !code); document.body.classList.toggle("codemode", code);
  const bb0 = $("branchBtn"); bb0.classList.toggle("hide", !code || !getRepo(cur).repo);
  if (code) {
    const r = getRepo(cur), names = repoList(cur).map(short); rb.textContent = "";
    rb.append(icon(IC.repo), el("span", "", names.length ? names.join(", ") : "Repo"), icon(IC.down));
    rb.classList.toggle("need", !r.repo); rb.title = "המאגר של השיחה";
    bb0.textContent = ""; bb0.append(icon(IC.branch), el("span", "", r.branch || "main"), icon(IC.down)); bb0.title = r.branch ? "הענף של השיחה" : "ענף ברירת המחדל";
  }
  const started = convItems(cur).length > 0;
  $("text").placeholder = "‫" + (started ? "תשובה ל-Claude..." : code ? "תאר משימה או שאל שאלה" : "במה אפשר לעזור היום?") + "‬";
  const mb = $("modeBtn"); mb.textContent = ""; mb.append(el("span", "", code ? "Code" : "Claude"), icon(IC.down));
  const qa = $("qa"), show = code && started;
  qa.classList.toggle("hide", !show);
  if (show && !qa.childElementCount) {
    const a = el("button", "btn pri"); a.type = "button"; a.append(icon(IC.ok), document.createTextNode("אישור ופרסום"));
    a.onclick = () => { if (confirm("לשלוח אישור לפרסום?")) send("(מאושר)", { plain: true }); };
    const n = el("button", "btn"); n.type = "button"; n.append(icon(IC.x), document.createTextNode("ביטול"));
    n.onclick = () => send("(לא מאושר, לבטל)", { plain: true });
    const ch = el("button", "btn"); ch.type = "button"; ch.append(icon(IC.edit), document.createTextNode("בקשת שינוי"));
    ch.onclick = () => { const t = $("text"); t.value = "(בקשת שינוי) "; t.focus(); grow(); updSend(); };
    qa.append(a, n, ch);
  }
}
// המאגרים של השיחה נשמרים כמחרוזת אחת מופרדת בפסיקים, וכך גם נשלחים בכותרת ההודעה
const repoList = (id) => String(getRepo(id).repo || "").split(",").map((x) => x.trim()).filter(Boolean);
function setRepos(id, list, branch) {
  const x = (meta[id] = meta[id] || {});
  x.repo = [...new Set(list.filter(Boolean))].join(", "); if (branch != null) x.branch = branch; if (!x.repo) x.branch = "";
  saveMeta(); store.set("claude_lastrepo", { repo: x.repo, branch: x.branch || "" }); sig = ""; render();
}
// בחירת מאגר: רשימה עם חיפוש. index = איזה מאגר להחליף; -1 = להוסיף מאגר נוסף
function repoMenu(anchor, index) {
  const list = repoList(cur), at = index == null ? 0 : index, curR = at >= 0 ? list[at] || "" : "";
  const pick = (full) => {
    const next = list.slice();
    if (at < 0) { if (full) next.push(full); } else if (full) next[at] = full; else next.splice(at, 1);
    setRepos(cur, next);
  };
  const all = REPOS.map((r) => OWNER + "/" + r).filter((r) => r === curR || !list.includes(r));
  const rows = all.map((r) => [r, IC.repo, () => pick(r), r === curR ? "cur" : ""]);
  if (at >= 0) rows.push(null, [list.length > 1 ? "הסרת המאגר הזה" : "אין מאגר", null, () => pick(""), curR ? "" : "cur"]);
  showMenu(anchor, rows, (m) => {
    const box = el("div", "ms"), inp = el("input"); inp.type = "search"; inp.dir = "ltr"; inp.placeholder = "‫חיפוש מאגרים…‬"; inp.setAttribute("aria-label", "חיפוש מאגרים");
    box.append(icon(IC.search), inp); m.prepend(box);
    const note = el("div", "mf", "מאגר שלא ברשימה? כתוב את שמו (או owner/name) ולחץ Enter."); note.dir = "rtl"; m.appendChild(note);
    inp.oninput = () => { const q = inp.value.trim().toLowerCase(); for (const b of m.querySelectorAll("button")) { const t = b.textContent.toLowerCase(); b.hidden = !!q && t.includes("/") && !t.includes(q); } };
    inp.onkeydown = (e) => {
      if (e.key !== "Enter") return; e.preventDefault(); e.stopPropagation();
      const vis = [...m.querySelectorAll("button")].filter((b) => !b.hidden && b.textContent.includes("/"));
      const typed = repoFull(inp.value);
      hideMenu(true); if (vis.length === 1) pick(vis[0].firstChild ? vis[0].querySelector("span").textContent : typed); else if (typed) pick(typed);
    };
    return inp;
  });
}
function branchMenu(anchor) {
  const r = getRepo(cur), setB = (b) => setRepos(cur, repoList(cur), clean(b).replace(/\s+/g, ""));
  const rows = [["ענף ברירת המחדל", IC.branch, () => setB(""), r.branch ? "" : "cur"]];
  if (r.branch) rows.push([r.branch, IC.branch, () => setB(r.branch), "cur"]);
  showMenu(anchor, rows, (m) => {
    const box = el("div", "ms"), inp = el("input"); inp.type = "text"; inp.dir = "ltr"; inp.maxLength = 80; inp.placeholder = "‫שם ענף אחר…‬"; inp.setAttribute("aria-label", "שם הענף");
    box.append(icon(IC.branch), inp); m.prepend(box);
    inp.onkeydown = (e) => { if (e.key !== "Enter") return; e.preventDefault(); e.stopPropagation(); const v = inp.value.trim(); hideMenu(true); if (v) setB(v); };
    return inp;
  });
}
$("repoBtn").onclick = (e) => { e.stopPropagation(); repoMenu($("repoBtn"), 0); };
$("branchBtn").onclick = (e) => { e.stopPropagation(); branchMenu($("branchBtn")); };
$("ccRepo").onclick = (e) => { e.stopPropagation(); repoMenu($("ccRepo"), 0); };

const SUGG = {
  chat: [[IC.pen, "עזרה בניסוח", "תעזור לי לנסח "], [IC.book, "סידור דברי תורה", "תעזור לי לסדר ולנסח את מה שכתבתי: "], [IC.idea, "רעיונות", "תן לי רעיונות ל"], [IC.code, "שינוי באתר", "אני רוצה לשנות באתר "]],
  code: [[IC.bug, "תיקון תקלה", "יש תקלה: "], [IC.plus, "תכונה חדשה", "אני רוצה להוסיף "], [IC.eye, "סקירת הקוד", "תסקור את הקוד ותגיד מה כדאי לשפר"], [IC.book, "הסבר על המאגר", "תסביר לי בקצרה מה יש במאגר הזה"]],
};
function renderHello() {
  const G = [greeting() + ", שמואל", "על מה נחשוב היום?", "במה נתחיל?", "מה על הפרק?"];
  $("greet").textContent = G[parseInt(hash(cur), 36) % G.length];
  const code = convMode(cur) === "code", p = projOf(cur);
  $("sub").textContent = code ? "קלוד קוד · עבודה על מאגרים ב-GitHub" + (p ? " · " + p.name : "") : p ? "פרויקט: " + p.name : "";
  if (code) {
    // הכרטיס במרכז: מצב החיבור, בחירת מאגר, ושיחות שמחכות לאישור שלך
    const cn = $("ccConn"); cn.textContent = ""; cn.append(icon(IC.cloud), el("span", "", live ? "Claude מחובר" : "Claude לא מחובר כרגע"));
    if (live) cn.appendChild(icon(IC.ok, "ok")); else cn.appendChild(el("small", "", "ההודעה תמתין"));
    const names = repoList(cur).map(short), cr = $("ccRepo"); cr.textContent = "";
    const crs = el("span", "", names.length ? names.join(", ") : "בחר מאגר"); if (names.length) { crs.dir = "ltr"; crs.style.textAlign = "start"; }
    cr.append(icon(IC.repo), crs, icon(IC.down));
    const wait = convList().filter((c) => c.needs && !c.archived).slice(0, 3), cw = $("ccWait"); cw.textContent = ""; cw.classList.toggle("hide", !wait.length);
    for (const c of wait) {
      const b = el("button", "cr"); b.type = "button"; const tt = el("span", "", c.title); tt.dir = "auto";
      const w = el("small", "warn", "צריך אישור"); b.append(tt, w); b.onclick = () => openConv(c.id); cw.appendChild(b);
    }
  }
  const s = $("sugg"); s.textContent = "";
  for (const [ic, label, text] of SUGG[code ? "code" : "chat"]) {
    const b = el("button"); b.type = "button"; b.append(icon(ic), document.createTextNode(label));
    b.onclick = () => { const t = $("text"); t.value = text; t.focus(); grow(); updSend(); };
    s.appendChild(b);
  }
}
function render() {
  renderSide(); renderHead();
  const pv = view !== "chat";
  document.body.classList.toggle("pv", pv);
  $("projView").classList.toggle("hide", !pv);
  $("composeWrap").classList.toggle("hide", pv);
  if (pv) {
    stopDict();
    $("hello").classList.add("hide"); $("scroll").classList.add("hide"); $("jump").classList.add("hide"); $("hright").classList.add("hide"); document.body.classList.remove("codenew", "started");
    if (view !== "chats") { chatsSig = ""; if (projSig() !== renderProjects.sig || !$("projView").firstChild) renderProjects(); return; }
    // דף השיחות נבנה מחדש רק כשמשהו השתנה, כדי לא להקפיץ את הגלילה ואת שדה החיפוש
    const cs = JSON.stringify(convList().map((c) => [c.id, c.title, c.last, c.pinned, c.archived])) + chatTab;
    if (cs !== chatsSig || !$("q")) { chatsSig = cs; const f = document.activeElement === $("q"); renderChats(f); }
    return;
  }
  const mine = convItems(cur), fl = failed.filter((f) => f.conv === cur);
  const empty = !mine.length && !fl.length;
  const codeNew = empty && convMode(cur) === "code";
  $("hello").classList.toggle("hide", !empty);
  document.body.classList.toggle("inchat", !empty || codeNew);
  document.body.classList.toggle("started", !empty);
  document.body.classList.toggle("codenew", codeNew);
  if (empty) { $("jump").classList.add("hide"); $("hright").classList.add("hide"); }
  $("scroll").classList.toggle("hide", empty);
  const wrap = $("composeWrap"), hadFocus = document.activeElement === $("text");
  if (empty && !codeNew && wrap.parentNode !== $("composeSlot")) $("composeSlot").appendChild(wrap);
  if ((!empty || codeNew) && wrap.parentNode !== $("main")) $("main").appendChild(wrap);
  if (hadFocus && document.activeElement !== $("text")) $("text").focus();
  chatsSig = "";
  renderTools();
  if (empty) { renderHello(); return; }
  const s = JSON.stringify(mine.map((m) => [m.id, m.status, m.text.length, m.confirm || ""])) + JSON.stringify(fl.map((f) => f.id)) + live + editing + fmtDay(Date.now());
  $("hright").classList.remove("hide");
  if (s === sig) return;
  sig = s;
  renderPanel();
  const sc = $("scroll"), atEnd = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 120;
  const box = $("msgs"); box.textContent = "";
  const all = mine.concat(fl.map((f) => ({ ...f, from: "me", status: "fail" })));
  const last = mine[mine.length - 1];
  for (const m of all) box.appendChild(m.from === "me" ? userMsg(m) : botMsg(m, m === last && !fl.length));
  // הסמל של Claude בסוף השיחה, כמו באתר הרשמי: נע בזמן המתנה לתשובה
  if (last && !fl.length) {
    const waiting = last.from === "me";
    if (waiting) {
      // כמו באתר הרשמי: שלוש נקודות נעות, הזמן שעבר, ומה קורה כרגע
      const w = el("div", "think"); w.setAttribute("role", "status");
      const d = el("span", "dots"); d.append(el("i"), el("i"), el("i"));
      const t = el("span", "t"); t.id = "thinkT"; t.dataset.at = String(last.at);
      const lab = el("span", "", live ? "· חשיבה" : "· ממתין – Claude לא מחובר כרגע. ההודעה שמורה, והתשובה תופיע כאן כשיתחבר");
      w.append(d, t, lab); box.appendChild(w); tickThink();
    } else { const w = el("div", "mark"); w.appendChild(spark()); box.appendChild(w); }
  }
  if (atEnd || !loaded) sc.scrollTop = sc.scrollHeight;
}
function userMsg(m) {
  const P = parse(m.text), wrap = el("div", "um" + (m.status === "fail" ? " f" : ""));
  const tags = el("div", "tags");
  if (P.proj) tags.appendChild(tagEl(IC.folder, "הנחיות: " + P.proj.name, false));
  if (tags.childElementCount) wrap.appendChild(tags);
  if (editing === m.id) {
    const ed = el("div", "edit"), ta = el("textarea"); ta.dir = "auto"; ta.value = editDraft != null ? editDraft : P.text; ta.oninput = () => { editDraft = ta.value; };
    const row = el("div", "row");
    const no = el("button", "btn", "ביטול"); no.type = "button"; no.onclick = () => { editing = ""; sig = ""; render(); };
    const ok = el("button", "btn pri", "שליחה מחדש"); ok.type = "button";
    ok.onclick = () => { const v = ta.value.trim(); if (!v && !P.attPart) return; editing = ""; send((v || "מצורף קובץ") + P.attPart); };
    ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) ok.click(); if (e.key === "Escape") no.click(); };
    row.append(no, ok); ed.append(ta, row); wrap.appendChild(ed);
    setTimeout(() => { ta.focus(); ta.style.height = Math.min(320, ta.scrollHeight + 4) + "px"; });
    return wrap;
  }
  const u = el("div", "u" + (m.status === "new" ? " pend" : m.status === "fail" ? " fail" : ""));
  if (P.files.length) { const a = el("div", "att"); P.files.forEach((f) => a.appendChild(fileChip(f))); u.appendChild(a); }
  u.appendChild(document.createTextNode(P.text));
  wrap.appendChild(u);
  const acts = el("div", "uacts");
  if (m.status === "fail") {
    acts.append(el("span", "err", "לא נשלח" + (m.err ? " – " + m.err : "")),
      ibtn(IC.retry, "ניסיון חוזר", () => { failed = failed.filter((f) => f.id !== m.id); send(m.text, { plain: true, key: m.key }); }),
      ibtn(IC.edit, "עריכה", () => { failed = failed.filter((f) => f.id !== m.id); const t = $("text"); t.value = P.text; grow(); updSend(); t.focus(); sig = ""; render(); }),
      ibtn(IC.trash, "הסרה", () => { failed = failed.filter((f) => f.id !== m.id); sig = ""; render(); }));
  } else {
    acts.append(ibtn(IC.copy, "העתקה", (e) => copy(P.text, e.currentTarget)));
    if (m.status !== "new" || !String(m.id).startsWith("tmp")) acts.append(ibtn(IC.edit, "עריכה ושליחה מחדש", () => { editing = m.id; editDraft = null; sig = ""; render(); }));
    acts.append(el("span", "meta", fmtStamp(m.at) + (m.status === "new" ? " · ממתין ל-Claude" : "")));
  }
  wrap.appendChild(acts);
  return wrap;
}
function botMsg(m, isLast) {
  const a = el("div", "a" + (isLast ? " last" : ""));
  const col = el("div", "col"), body = el("div", "body"); body.appendChild(md(m.text)); col.appendChild(body);
  if (m.confirm) {
    const cf = el("div", "cf"); cf.appendChild(el("b", "", "ממתין לאישור שלך"));
    const ct = el("div", "", m.confirm); ct.dir = "auto"; cf.appendChild(ct);
    const row = el("div", "row");
    const yes = el("button", "btn pri", "מאשר"), no = el("button", "btn", "לבטל"), chg = el("button", "btn", "בקשת שינוי");
    yes.onclick = () => send("(מאושר)", { plain: true }); no.onclick = () => send("(לא מאושר, לבטל)", { plain: true });
    chg.onclick = () => { $("text").value = "(בקשת שינוי) "; $("text").focus(); grow(); updSend(); };
    row.append(yes, no, chg); cf.appendChild(row); col.appendChild(cf);
  }
  const acts = el("div", "acts");
  acts.append(ibtn(IC.copy, "העתקת התשובה", (e) => copy(m.text, e.currentTarget)),
    ibtn(IC.quote, "ציטוט בתשובה", () => { const t = $("text"); t.value = "> " + m.text.split("\n").slice(0, 3).join("\n> ") + "\n\n" + t.value; t.focus(); grow(); updSend(); }),
    el("span", "meta", fmtStamp(m.at)));
  const vote = (v) => {
    fb[m.id] = fb[m.id] === v ? 0 : v; store.set("claude_fb", fb);
    gb.classList.toggle("on", fb[m.id] === 1); bb.classList.toggle("on", fb[m.id] === -1);
    gb.setAttribute("aria-pressed", String(fb[m.id] === 1)); bb.setAttribute("aria-pressed", String(fb[m.id] === -1));
  };
  const gb = ibtn(IC.up, "תשובה טובה (נשמר במכשיר הזה בלבד)", () => vote(1)), bb = ibtn(IC.down2, "תשובה לא טובה (נשמר במכשיר הזה בלבד)", () => vote(-1));
  if (fb[m.id] === 1) gb.classList.add("on"); if (fb[m.id] === -1) bb.classList.add("on");
  gb.setAttribute("aria-pressed", String(fb[m.id] === 1)); bb.setAttribute("aria-pressed", String(fb[m.id] === -1));
  acts.insertBefore(bb, acts.children[1]); acts.insertBefore(gb, bb);
  const asked = m.re ? items.find((x) => x.id === m.re && x.from === "me") : null;
  if (asked) acts.insertBefore(ibtn(IC.retry, "לשאול שוב (ההודעה שלך תישלח מחדש)", () => send(asked.text, { plain: true })), acts.lastChild);
  col.appendChild(acts); a.appendChild(col);
  return a;
}
async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); } catch (e) {
    const t = el("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (x) {} t.remove();
  }
  if (btn) { const sv = btn.querySelector("svg"); if (sv) { sv.replaceWith(icon(IC.ok)); setTimeout(() => { const s2 = btn.querySelector("svg"); if (s2) s2.replaceWith(icon(IC.copy)); }, 1500); } }
  toast("הועתק");
}
