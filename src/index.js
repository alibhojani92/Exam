// ===============================
// TELEGRAM MCQ EXAM BOT (INLINE ONLY, FIXED)
// Cloudflare Worker + D1
// ===============================

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

    async function tg(method, payload) {
      await fetch(`${API}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const isAdmin = (id) => ADMINS.includes(id);
    const clean = (t) => (t || "").split("@")[0].trim();

    async function ensureUser(uid) {
      await DB.prepare(`INSERT OR IGNORE INTO users (id) VALUES (?)`)
        .bind(uid)
        .run();
    }

    async function mainMenu(chatId, uid) {
      const kb = [
        [{ text: "📝 Start / Resume Exam", callback_data: "START_EXAM" }],
        [{ text: "📊 View Result", callback_data: "VIEW_RESULT" }],
      ];
      if (isAdmin(uid)) kb.push([{ text: "🛠 Admin Panel", callback_data: "ADMIN_PANEL" }]);
      await tg("sendMessage", {
        chat_id: chatId,
        text: "👋 MCQ Exam Bot",
        reply_markup: { inline_keyboard: kb },
      });
    }

    async function loadQuestion(offset) {
      return await DB.prepare(
        `SELECT * FROM mcq_bank ORDER BY id ASC LIMIT 1 OFFSET ?`
      ).bind(offset).first();
    }

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

      // ADMIN ADD MCQ (TEXT)
      if (isAdmin(from.id) && update.message.text && update.message.text.startsWith("Q:")) {
        const raw = update.message.text.split("\n");
        const q = raw.find(l => l.startsWith("Q:"))?.slice(2).trim();
        const A = raw.find(l => l.startsWith("A)"))?.slice(2).trim();
        const B = raw.find(l => l.startsWith("B)"))?.slice(2).trim();
        const C = raw.find(l => l.startsWith("C)"))?.slice(2).trim();
        const D = raw.find(l => l.startsWith("D)"))?.slice(2).trim();
        const ANS = raw.find(l => l.startsWith("ANS:"))?.slice(4).trim();

        if (q && A && B && C && D && ANS) {
          await DB.prepare(
            `INSERT INTO mcq_bank
             (question, option_a, option_b, option_c, option_d, correct_option)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(q, A, B, C, D, ANS).run();

          await tg("sendMessage", { chat_id: chatId, text: "✅ MCQ added" });
        }
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

      // IMPORTANT: ACK CALLBACK
      await tg("answerCallbackQuery", { callback_query_id: cb.id });

      await ensureUser(from.id);

      // START / RESUME
      if (data === "START_EXAM") {
        let session = await DB.prepare(
          `SELECT * FROM test_sessions
           WHERE user_id=? AND chat_id=? AND completed_at IS NULL
           LIMIT 1`
        ).bind(from.id, chatId).first();

        let index = 0;
        if (!session) {
          const r = await DB.prepare(
            `INSERT INTO test_sessions (user_id, chat_id, current_index, score)
             VALUES (?, ?, 0, 0)`
          ).bind(from.id, chatId).run();
          session = { id: r.meta.last_row_id, current_index: 0 };
        } else {
          index = session.current_index;
        }

        const q = await loadQuestion(index);
        if (!q) {
          await tg("editMessageText", {
            chat_id: chatId,
            message_id: msgId,
            text: "❌ MCQ available નથી",
          });
          return new Response("OK");
        }

        await tg("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text:
            `📝 Q${index + 1}: ${q.question}\n\n` +
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
          text: last ? `📊 Last Score: ${last.score}` : "❌ Result મળ્યો નથી",
        });
        return new Response("OK");
      }

      // ADMIN PANEL
      if (data === "ADMIN_PANEL" && isAdmin(from.id)) {
        await tg("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text: "🛠 Admin Panel",
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ Add MCQ (Text)", callback_data: "ADMIN_ADD_INFO" }],
            ],
          },
        });
        return new Response("OK");
      }

      if (data === "ADMIN_ADD_INFO" && isAdmin(from.id)) {
        await tg("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text:
            "Q: Question?\nA) opt1\nB) opt2\nC) opt3\nD) opt4\nANS: A",
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

        const q = await DB.prepare(`SELECT * FROM mcq_bank WHERE id=?`)
          .bind(qid).first();

        const correct = q.correct_option === opt ? 1 : 0;

        await DB.prepare(
          `INSERT INTO user_mcq_history
           (user_id, question_id, selected_option, is_correct)
           VALUES (?, ?, ?, ?)`
        ).bind(from.id, qid, opt, correct).run();

        await DB.prepare(
          `UPDATE test_sessions
           SET current_index=current_index+1, score=score+?
           WHERE id=?`
        ).bind(correct, session.id).run();

        const nextIndex = session.current_index + 1;
        const nextQ = await loadQuestion(nextIndex);

        if (!nextQ) {
          await DB.prepare(
            `UPDATE test_sessions
             SET completed_at=CURRENT_TIMESTAMP WHERE id=?`
          ).bind(session.id).run();

          await tg("editMessageText", {
            chat_id: chatId,
            message_id: msgId,
            text: `✅ Exam Completed\n\nScore: ${session.score + correct}`,
          });
          return new Response("OK");
        }

        await tg("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text:
            `📝 Q${nextIndex + 1}: ${nextQ.question}\n\n` +
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
