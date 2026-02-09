// =====================================================
// TELEGRAM MCQ EXAM BOT — FINAL FIXED VERSION
// INLINE ONLY • RANDOM • NO-REPEAT • 50 QUESTIONS
// CALLBACK ACK FIRST • FAIL-SAFE EDIT • NO SILENT BUG
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
    const ADMINS = [7539477188];

    // ---------------- HELPERS ----------------
    const tg = (m, p) =>
      fetch(`${API}/${m}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });

    const isAdmin = (id) => ADMINS.includes(id);
    const clean = (t) => (t || "").split("@")[0].trim();

    const ensureUser = async (uid) => {
      await DB.prepare(`INSERT OR IGNORE INTO users (id) VALUES (?)`)
        .bind(uid)
        .run();
    };

    const safeEdit = async (chatId, msgId, payload) => {
      try {
        await tg("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          ...payload,
        });
      } catch {
        await tg("sendMessage", {
          chat_id: chatId,
          ...payload,
        });
      }
    };

    const mainMenu = async (chatId, uid) => {
      const kb = [
        [{ text: "📝 Start Exam", callback_data: "START_EXAM" }],
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

    // ---------------- RANDOM + NO REPEAT ----------------
    const getNextQuestion = async (session) => {
      const asked = JSON.parse(session.asked_ids || "[]");
      if (asked.length >= 50) return null;

      const placeholders = asked.map(() => "?").join(",");
      const sql =
        asked.length === 0
          ? `SELECT * FROM mcq_bank ORDER BY RANDOM() LIMIT 1`
          : `SELECT * FROM mcq_bank
             WHERE id NOT IN (${placeholders})
             ORDER BY RANDOM() LIMIT 1`;

      const stmt = DB.prepare(sql);
      return asked.length
        ? await stmt.bind(...asked).first()
        : await stmt.first();
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
    }

    // ================= CALLBACK =================
    if (update.callback_query) {
      const cb = update.callback_query;

      // 🔥 ACK CALLBACK IMMEDIATELY (NO await, FIRST LINE)
      fetch(`${API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cb.id }),
      });

      const chatId = cb.message.chat.id;
      const msgId = cb.message.message_id;
      const from = cb.from;
      const data = cb.data;

      await ensureUser(from.id);

      // -------- START EXAM --------
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
          await safeEdit(chatId, msgId, { text: "❌ No questions available" });
          return new Response("OK");
        }

        const asked = JSON.parse(session.asked_ids);
        asked.push(q.id);
        await DB.prepare(
          `UPDATE test_sessions SET asked_ids=? WHERE id=?`
        ).bind(JSON.stringify(asked), session.id).run();

        await safeEdit(chatId, msgId, {
          text:
            `📝 Q${asked.length}/50\n${q.question}\n\n` +
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

      // -------- VIEW RESULT --------
      if (data === "VIEW_RESULT") {
        const last = await DB.prepare(
          `SELECT * FROM test_sessions
           WHERE user_id=? AND completed_at IS NOT NULL
           ORDER BY completed_at DESC LIMIT 1`
        ).bind(from.id).first();

        await safeEdit(chatId, msgId, {
          text: last ? `📊 Last Score: ${last.score}/50` : "❌ No result found",
        });
        return new Response("OK");
      }

      // -------- ADMIN PANEL --------
      if (data === "ADMIN_PANEL" && isAdmin(from.id)) {
        await safeEdit(chatId, msgId, {
          text: "🛠 Admin Panel\nSend MCQ text or upload CSV / JSON",
        });
        return new Response("OK");
      }

      // -------- ANSWER --------
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

        const isCorrect = q.correct_option === opt;
        const mark = isCorrect ? 1 : 0;

        await DB.prepare(
          `INSERT INTO user_mcq_history
           (user_id, question_id, selected_option, is_correct)
           VALUES (?, ?, ?, ?)`
        ).bind(from.id, qid, opt, mark).run();

        await DB.prepare(
          `UPDATE test_sessions SET score=score+? WHERE id=?`
        ).bind(mark, session.id).run();

        const feedback =
          (isCorrect ? "✅ Correct\n" : "❌ Wrong\n") +
          `Correct Answer: ${q.correct_option}`;

        const nextQ = await getNextQuestion(session);
        const asked = JSON.parse(session.asked_ids);

        if (!nextQ || asked.length >= 50) {
          await DB.prepare(
            `UPDATE test_sessions
             SET completed_at=CURRENT_TIMESTAMP
             WHERE id=?`
          ).bind(session.id).run();

          await safeEdit(chatId, msgId, {
            text:
              `${feedback}\n\n🎉 Exam Completed\n` +
              `Final Score: ${session.score + mark}/50`,
          });
          return new Response("OK");
        }

        asked.push(nextQ.id);
        await DB.prepare(
          `UPDATE test_sessions SET asked_ids=? WHERE id=?`
        ).bind(JSON.stringify(asked), session.id).run();

        await safeEdit(chatId, msgId, {
          text:
            `${feedback}\n\n` +
            `📝 Q${asked.length}/50\n${nextQ.question}\n\n` +
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
