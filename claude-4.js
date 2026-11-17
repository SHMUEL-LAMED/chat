"use strict";
// קבצים ש-Claude שולח בתוך השיחה. השרת מוסיף לסוף התשובה שורה לכל קובץ:
// [קובץ מ-Claude: <שם> | <גודל> | מזהה: <מזהה> | חלקים: <כמה>]
// כאן השורה הופכת לכפתור הורדה: הקובץ יורד בחלקים דרך הגשר (file?cf=<מזהה>&part=<מספר>) ונשמר בשם המקורי.
const OUT_RE = /\n*\[קובץ מ-Claude: ([^\]\n|]+?) \| ([^\]\n|]*?) \| מזהה: ([a-z0-9]+) \| חלקים: (\d+)\]/gi;
function splitOut(t) {
  const outs = [];
  const text = String(t).replace(OUT_RE, (all, name, size, id, parts) => { outs.push({ name: name.trim(), size: size.trim(), id, parts: +parts }); return ""; }).trim();
  return { text, outs };
}
const outBusy = {};
function outChip(f) {
  const b = el("button", "out"); b.type = "button"; b.appendChild(icon(IC.file));
  const nm = el("span", "nm", f.name); nm.dir = "auto";
  const st = el("small", "", outBusy[f.id] != null ? "יורד " + outBusy[f.id] + "%" : f.size + " · הורדה"); st.dir = "rtl";
  b.append(nm, st); b.setAttribute("aria-label", "הורדת הקובץ " + f.name);
  b.onclick = () => outDownload(f, st);
  return b;
}
async function outDownload(f, st) {
  if (outBusy[f.id] != null) return;
  outBusy[f.id] = 0; st.textContent = "יורד 0%";
  try {
    const bufs = [];
    for (let i = 0; i < f.parts; i++) {
      let r;
      try { r = await fetch(API + "file?token=" + encodeURIComponent(token) + "&cf=" + encodeURIComponent(f.id) + "&part=" + i); } catch (e) { throw new Error("אין חיבור לשרת"); }
      if (r.status === 401) { try { localStorage.removeItem("chat_token"); } catch (e) {} location.replace("./"); return; }
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "תקלה בהורדה"); }
      bufs.push(await r.arrayBuffer());
      outBusy[f.id] = Math.round(((i + 1) / f.parts) * 100); st.textContent = "יורד " + outBusy[f.id] + "%";
    }
    const url = URL.createObjectURL(new Blob(bufs, { type: "application/octet-stream" })), a = el("a");
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    st.textContent = f.size + " · ירד, להורדה נוספת";
  } catch (e) {
    st.textContent = f.size + " · הורדה"; toast("הורדת " + f.name + " נכשלה: " + e.message);
  }
  delete outBusy[f.id];
}
// תשובה של Claude: הטקסט מוצג בלי שורות הקבצים, והקבצים מוצגים מתחתיו ככפתורים
const botMsgBase = botMsg;
botMsg = function (m, isLast) {
  const O = splitOut(m.text);
  if (!O.outs.length) return botMsgBase(m, isLast);
  const a = botMsgBase({ ...m, text: O.text || "מצורף קובץ" }, isLast), body = a.querySelector(".body");
  const fl = el("div", "outs"); O.outs.forEach((f) => fl.appendChild(outChip(f)));
  if (body) body.after(fl); else a.appendChild(fl);
  return a;
};
{
  const css = el("style");
  css.textContent = ".outs{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 2px}"
    + ".out{display:inline-flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:8px 12px;font-size:14px;max-width:100%;text-align:start;cursor:pointer}"
    + ".out:hover{background:var(--hover)}"
    + ".out svg{width:18px;height:18px;color:var(--acc);flex:none}"
    + ".out .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}"
    + ".out small{color:var(--mute);white-space:nowrap;flex:none}";
  document.head.appendChild(css);
}
// קישור בסרגל לדף "שיחות מהקו" (line.html): דף נפרד, לא חלק מרשימת השיחות
{
  const g = document.querySelector('a.nav[href="gpt.html"]');
  if (g) {
    const a = g.cloneNode(true);
    a.href = "line.html";
    const lb = a.querySelector(".lb"); if (lb) lb.textContent = "שיחות מהקו";
    const p = a.querySelector("svg path"); if (p) p.setAttribute("d", "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2");
    g.after(a);
  }
}
