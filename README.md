# chat

אתר הצ'אט: https://shmuel-lamed.github.io/chat/ (GitHub Pages מהשורש של `main`).
הועבר מהמאגר `shmuel-lamed.github.io` (תיקיית `chat`) עם ההיסטוריה.

- `index.html` – הצ'אט (Google Chat דרך קו המייל), `claude.html` – שיחה עם Claude, `gpt.html` – קישור ל-ChatGPT.
- `supabase/functions/chat-netfree/` – הגשר ב-Supabase (נטפרי חוסם workers.dev). עותק של הגרסה החיה (גרסה 5). פעולה חדשה צריך להוסיף לרשימה `OPS`.
- השרת עצמו (`chatsite.js` והפעולות `claude_send`/`claude_history` ב-`entry.js`) נמצא במאגר [`Email-management-line`](https://github.com/SHMUEL-LAMED/Email-management-line), כי הוא רץ בתוך ה-Worker `yemot-mail`.
