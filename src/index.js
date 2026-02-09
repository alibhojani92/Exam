// =====================================================
// TELEGRAM MCQ EXAM BOT — FINAL A→Z
// INLINE ONLY • RANDOM QUESTIONS • NO REPEAT
// Cloudflare Worker + D1
// =====================================================

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("OK");
    }

    const TOKEN = env.TELEGRAM_BOT_TOKEN;
    const API = `https://api.telegram.org/bot${TOKEN}`;
    const DB = env.DB;

    const ADMINS = [7539477188]; // ← admin IDs

    // ---------------- HELPERS ----------------
    const tg = (method, payload) =>
      fetch(`${API}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

    const isAdmin = (id) => ADMINS.includes(id);
    const clean = (t) => (t || "").split("@")[0].trim();

    const ensureUser = async (uid) => {
      await DB.prepare(`INSERT OR IGNORE INTO users (id) VALUES (?)`)
        .bind(uid)
        .run();
    };

    const mainMenu = async (chatId, uid) => {
      const kb = [
        [{ text: "📝 Start / Resume Exam", callback_data: "START_EXAM" }],
        [{ text: "📊 View Result", callback_data: "VIEW_RESULT" }],
      ];
      if (isAdmin(uid))
        kb.push([{ text: "🛠 Admin Panel", callback_data: "ADMIN_PANEL" }]);

      await tg("sendMessage", {
        chat_id: chatId,
        text: "👋 MCQ Exam Bot",
        reply_markup: { inline_keyboard: kb },
      });
    };

    const parseBulkText = (text) => {
      const blocks = text.split(/\n\s*\n/);
      const out = [];
      for (const b of blocks) {
        const l = b.split("\n");
        const q = l.find(x => x.startsWith("Q:"))?.slice(2).trim();
        const A = l.find(x => x.startsWith("A)"))?.slice(2).trim();
        const B = l.find(x => x.startsWith("B)"))?.slice(2).trim();
        const C = l.find(x => x.startsWith("C)"))?.slice(2).trim();
        const D = l.find(x => x.startsWith("D)"))?.slice(2).trim();
        const ANS = l.find(x => x.startsWith("ANS:"))?.slice(4).trim();
        if (q && A && B && C && D && ANS) out.push({ q, A, B, C, D, ANS });
      }
      return out;
    };

    const parseCSV = (csv) => {
      const lines = csv.split(/\r?\n/).filter(Boolean);
      const out = [];
      for (let i = 1; i < lines.length; i++) {
        const c = lines[i].split(",");
        if (c.length >= 6) {
          out.push({
            q: c[0],
            A: c[1],
            B: c[2],
            C: c[3],
            D: c[4],
            ANS: c[5].trim(),
          });
        }
      }
      return out;
    };

    const insertMCQs = async (arr) => {
      let n = 0;
      for (const m of arr) {
        await DB.prepare(
          `INSERT INTO mcq_bank
           (question, option_a, option_b, option_c, option_d, correct_option)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(m.q, m.A, m.B, m.C, m.D, m.ANS)
          .run();
        n++;
      }
      return n;
    };

    // ----------- RANDOM + NO-REPEAT -----------
    const getNextQuestion = async (session) => {
      const asked = session.asked_ids
        ? JSON.parse(session.asked_ids)
        : [];

      const placeholders = asked.map(() => "?").join(",");
      const sql =
        asked.length === 0
          ? `SELECT * FROM mcq_bank ORDER BY RANDOM() LIMIT 1`
          : `SELECT * FROM mcq_bank
             WHERE id NOT IN (${placeholders})
             ORDER BY RANDOM() LIMIT 1`;

      const stmt = DB.prepare(sql);
      const q = asked.length ? await stmt.bind(...asked).first() : await stmt.first();
      return q;
    };

    // ================= MESSAGE =================
    if (update.message) {
      const chatId = update.message.chat.id;
      const from = update.message.from;
      const text = clean(update.message.text);

      await ensureUser(from.id);

      if (text === "/start") {
        await mainMenu(chatId, from.id);
        return new Response("OK");
      }

      // ADMIN BULK TEXT
      if (isAdmin(from.id) && update.message.text?.startsWith("Q:")) {
        const mcqs = parseBulkText(update.message.text);
        const n = await insertMCQs(mcqs);
        await tg("sendMessage", {
          chat_id: chatId,
          text: `✅ ${n} MCQ added`,
        });
        return new Response("OK");
      }

      // ADMIN FILE UPLOAD CSV / JSON
      if (isAdmin(from.id) && update.message.document) {
        const fid = update.message.document.file_id;
        const info = await fetch(`${API}/getFile?file_id=${fid}`).then(r => r.json());
        const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${info.result.file_path}`;
        const content = await fetch(fileUrl).then(r => r.text());

        let mcqs = [];
        if (info.result.file_path.endsWith(".csv")) mcqs = parseCSV(content);
        if (info.result.file_path.endsWith(".json")) {
          const arr = JSON.parse(content);
          mcqs = arr.map(x => ({
            q: x.question, A: x.A, B: x.B, C: x.C, D: x.D, ANS: x.ANS
          }));
        }

        const n = await insertMCQs(mcqs);
        await tg("sendMessage", {
          chat_id: chatId,
          text: `✅ ${n} MCQ added from file`,
        });
        return new Response("OK");
      }
    }

    // ================= CALLBACK =================
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const msgId = cb.message.message_id;
      const from = cb.from;
      const data = cb.data;

      // ACK CALLBACK (NO SILENT)
      fetch(`${API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cb.id }),
      });

      await ensureUser(from.id);

      // START / RESUME
      if (data === "START_EXAM") {
        let session = await DB.prepare(
          `SELECT * FROM test_sessions
           WHERE user_id=? AND chat_id=? AND completed_at IS NULL
           LIMIT 1`
        ).bind(from.id, chatId).first();

        if (!session) {
          const r = await DB.prepare(
            `INSERT INTO test_sessions
             (user_id, chat_id, score, asked_ids)
             VALUES (?, ?, 0, '[]')`
          ).bind(from.id, chatId).run();

          session = { id: r.meta.last_row_id, asked_ids: "[]" };
        }

        const q = await getNextQuestion(session);
        if (!q) {
          await tg("editMessageText", {
            chat_id: chatId,
            message_id: msgId,
            text: "❌ No more questions",
          });
          return new Response("OK");
        }

        const asked = JSON.parse(session.asked_ids);
        asked.push(q.id);
        await DB.prepare(
          `UPDATE test_sessions SET asked_ids=? WHERE id=?`
        ).bind(JSON.stringify(asked), session.id).run();

        await tg("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text:
            `📝 ${q.question}\n\n` +
            `A) ${q.option_a}\nB) ${q.option_b}\nC) ${q.option_c}\nD) ${q.option_d}`,
          reply_markup: {
            inline_keyboard: [
              [{ text: "A", callback_data: `ANS_${q.id}_A` }],
              [{ text: "B", callback_data: `ANS_${q.id}_B` }],
              [{ text: "C", callback_data: `ANS_${q.id}_C` }],
              [{ text: "D", callback_data: `ANS_${q.id}_D` }],
            ],
          },
        });
        return new Response("OK");
      }

      // VIEW RESULT
      if (data === "VIEW_RESULT") {
        const last = await DB.prepare(
          `SELECT * FROM test_sessions
           WHERE user_id=? AND completed_at IS NOT NULL
           ORDER BY completed_at DESC LIMIT 1`
        ).bind(from.id).first();

        await tg("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text: last ? `📊 Last Score: ${last.score}` : "❌ Result not found",
        });
        return new Response("OK");
      }

      // ADMIN PANEL
      if (data === "ADMIN_PANEL" && isAdmin(from.id)) {
        await tg("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text: "🛠 Admin Panel\nSend MCQ text or upload CSV/JSON",
        });
        return new Response("OK");
      }

      // ANSWER
      if (data.startsWith("ANS_")) {
        const [, qid, opt] = data.split("_");

        const session = await DB.prepare(
          `SELECT * FROM test_sessions
           WHERE user_id=? AND chat_id=? AND completed_at IS NULL
           LIMIT 1`
        ).bind(from.id, chatId).first();

        if (!session) return new Response("OK");

        const q = await DB.prepare(
          `SELECT * FROM mcq_bank WHERE id=?`
        ).bind(qid).first();

        const correct = q.correct_option === opt ? 1 : 0;

        await DB.prepare(
          `UPDATE test_sessions
           SET score=score+?
           WHERE id=?`
        ).bind(correct, session.id).run();

        const nextQ = await getNextQuestion(session);

        if (!nextQ) {
          await DB.prepare(
            `UPDATE test_sessions
             SET completed_at=CURRENT_TIMESTAMP
             WHERE id=?`
          ).bind(session.id).run();

          await tg("editMessageText", {
            chat_id: chatId,
            message_id: msgId,
            text: `✅ Exam Completed\nScore: ${session.score + correct}`,
          });
          return new Response("OK");
        }

        const asked = JSON.parse(session.asked_ids);
        asked.push(nextQ.id);
        await DB.prepare(
          `UPDATE test_sessions SET asked_ids=? WHERE id=?`
        ).bind(JSON.stringify(asked), session.id).run();

        await tg("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text:
            `📝 ${nextQ.question}\n\n` +
            `A) ${nextQ.option_a}\nB) ${nextQ.option_b}\nC) ${nextQ.option_c}\nD) ${nextQ.option_d}`,
          reply_markup: {
            inline_keyboard: [
              [{ text: "A", callback_data: `ANS_${nextQ.id}_A` }],
              [{ text: "B", callback_data: `ANS_${nextQ.id}_B` }],
              [{ text: "C", callback_data: `ANS_${nextQ.id}_C` }],
              [{ text: "D", callback_data: `ANS_${nextQ.id}_D` }],
            ],
          },
        });
        return new Response("OK");
      }
    }

    return new Response("OK");
  },
};
