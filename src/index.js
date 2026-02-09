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
    const db = env.DB;
    const ADMINS = [7539477188];

    async function tg(method, payload) {
      await fetch(`${API}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    function isAdmin(id) {
      return ADMINS.includes(id);
    }

    /* ================= MESSAGE ================= */
    if (update.message) {
      const chatId = update.message.chat.id;
      const chatType = update.message.chat.type;
      const from = update.message.from;
      const text = (update.message.text || "").split("@")[0].trim();

      await db
        .prepare(`INSERT OR IGNORE INTO users (id) VALUES (?)`)
        .bind(from.id)
        .run();

      // START → INLINE MENU
      if (text === "/start") {
        await tg("sendMessage", {
          chat_id: chatId,
          text: "👋 MCQ Exam Bot",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📝 Start / Resume Exam", callback_data: "START_EXAM" }],
              [{ text: "📊 View Result", callback_data: "VIEW_RESULT" }],
              ...(isAdmin(from.id)
                ? [[{ text: "🛠 Admin Panel", callback_data: "ADMIN_PANEL" }]]
                : []),
            ],
          },
        });
        return new Response("OK");
      }
    }

    /* ================= CALLBACK ================= */
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const msgId = cb.message.message_id;
      const from = cb.from;
      const data = cb.data;

      // START / RESUME EXAM
      if (data === "START_EXAM") {
        const session = await db
          .prepare(
            `SELECT * FROM test_sessions
             WHERE user_id=? AND chat_id=? AND completed_at IS NULL
             LIMIT 1`
          )
          .bind(from.id, chatId)
          .first();

        let index = 0;
        let sessionId;

        if (session) {
          index = session.current_index;
          sessionId = session.id;
        } else {
          const res = await db
            .prepare(
              `INSERT INTO test_sessions (user_id, chat_id, current_index, score)
               VALUES (?, ?, 0, 0)`
            )
            .bind(from.id, chatId)
            .run();
          sessionId = res.meta.last_row_id;
        }

        const q = await db
          .prepare(
            `SELECT * FROM mcq_bank
             ORDER BY id ASC
             LIMIT 1 OFFSET ?`
          )
          .bind(index)
          .first();

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
            `A) ${q.option_a}\n` +
            `B) ${q.option_b}\n` +
            `C) ${q.option_c}\n` +
            `D) ${q.option_d}`,
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
        const last = await db
          .prepare(
            `SELECT * FROM test_sessions
             WHERE user_id=? AND completed_at IS NOT NULL
             ORDER BY completed_at DESC
             LIMIT 1`
          )
          .bind(from.id)
          .first();

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

      // ADMIN INFO
      if (data === "ADMIN_ADD_INFO" && isAdmin(from.id)) {
        await tg("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text:
            "Send MCQ in this format:\n\n" +
            "Q: Question?\n" +
            "A) opt1\nB) opt2\nC) opt3\nD) opt4\nANS: A",
        });
        return new Response("OK");
      }

      // ANSWER CLICK
      if (data.startsWith("ANS_")) {
        const [, qid, opt] = data.split("_");

        const session = await db
          .prepare(
            `SELECT * FROM test_sessions
             WHERE user_id=? AND chat_id=? AND completed_at IS NULL
             LIMIT 1`
          )
          .bind(from.id, chatId)
          .first();

        if (!session) return new Response("OK");

        const q = await db
          .prepare(`SELECT * FROM mcq_bank WHERE id=?`)
          .bind(qid)
          .first();

        const correct = q.correct_option === opt ? 1 : 0;

        await db
          .prepare(
            `INSERT INTO user_mcq_history
             (user_id, question_id, selected_option, is_correct)
             VALUES (?, ?, ?, ?)`
          )
          .bind(from.id, qid, opt, correct)
          .run();

        await db
          .prepare(
            `UPDATE test_sessions
             SET current_index=current_index+1, score=score+?
             WHERE id=?`
          )
          .bind(correct, session.id)
          .run();

        const nextIndex = session.current_index + 1;
        const nextQ = await db
          .prepare(
            `SELECT * FROM mcq_bank
             ORDER BY id ASC
             LIMIT 1 OFFSET ?`
          )
          .bind(nextIndex)
          .first();

        if (!nextQ) {
          await db
            .prepare(
              `UPDATE test_sessions
               SET completed_at=CURRENT_TIMESTAMP
               WHERE id=?`
            )
            .bind(session.id)
            .run();

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
            `A) ${nextQ.option_a}\n` +
            `B) ${nextQ.option_b}\n` +
            `C) ${nextQ.option_c}\n` +
            `D) ${nextQ.option_d}`,
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
