export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("OK");
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("OK");
    }

    const TOKEN = env.TELEGRAM_BOT_TOKEN;
    const API = `https://api.telegram.org/bot${TOKEN}`;
    const db = env.DB;

    // ---------- helpers ----------
    async function tg(method, payload) {
      await fetch(`${API}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    function cleanText(t) {
      return (t || "").split("@")[0].trim();
    }

    // ---------- MESSAGE ----------
    if (update.message) {
      const chatId = update.message.chat.id;
      const chatType = update.message.chat.type;
      const from = update.message.from;
      const text = cleanText(update.message.text);

      // ensure user
      await db.prepare(
        `INSERT OR IGNORE INTO users (id, name)
         VALUES (?, ?)`
      ).bind(from.id, from.first_name || "").run();

      // /start
      if (text === "/start") {
        await tg("sendMessage", {
          chat_id: chatId,
          text:
            "👋 MCQ Exam Bot Ready\n\n" +
            "📝 /exam  → Exam start / resume\n" +
            "📊 /result → Last result",
        });
        return new Response("OK");
      }

      // /exam
      if (text === "/exam") {
        // check active session
        const session = await db.prepare(
          `SELECT * FROM test_sessions
           WHERE user_id=? AND chat_id=? AND completed_at IS NULL
           LIMIT 1`
        ).bind(from.id, chatId).first();

        let q;
        let index = 0;
        let sessionId;

        if (session) {
          // resume
          index = session.current_index;
          sessionId = session.id;
        } else {
          // new session
          const res = await db.prepare(
            `INSERT INTO test_sessions
             (user_id, chat_id, current_index, score)
             VALUES (?, ?, 0, 0)`
          ).bind(from.id, chatId).run();
          sessionId = res.meta.last_row_id;
        }

        // get question
        q = await db.prepare(
          `SELECT * FROM mcq_bank
           ORDER BY id ASC
           LIMIT 1 OFFSET ?`
        ).bind(index).first();

        if (!q) {
          await tg("sendMessage", {
            chat_id: chatId,
            text: "❌ MCQ available નથી",
          });
          return new Response("OK");
        }

        await tg("sendMessage", {
          chat_id: chatId,
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

      // /result
      if (text === "/result") {
        const last = await db.prepare(
          `SELECT * FROM test_sessions
           WHERE user_id=? AND completed_at IS NOT NULL
           ORDER BY completed_at DESC
           LIMIT 1`
        ).bind(from.id).first();

        if (!last) {
          await tg("sendMessage", {
            chat_id: chatId,
            text: "❌ Result મળ્યો નથી",
          });
        } else {
          await tg("sendMessage", {
            chat_id: chatId,
            text: `📊 Last Score: ${last.score}`,
          });
        }
        return new Response("OK");
      }
    }

    // ---------- CALLBACK ----------
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const from = cb.from;
      const data = cb.data;

      if (!data.startsWith("ANS_")) return new Response("OK");

      const [, qid, opt] = data.split("_");

      const session = await db.prepare(
        `SELECT * FROM test_sessions
         WHERE user_id=? AND chat_id=? AND completed_at IS NULL
         LIMIT 1`
      ).bind(from.id, chatId).first();

      if (!session) return new Response("OK");

      const q = await db.prepare(
        `SELECT * FROM mcq_bank WHERE id=?`
      ).bind(qid).first();

      const correct = q.correct_option === opt ? 1 : 0;

      // save history
      await db.prepare(
        `INSERT INTO user_mcq_history
         (user_id, question_id, selected_option, is_correct)
         VALUES (?, ?, ?, ?)`
      ).bind(from.id, qid, opt, correct).run();

      // update session
      await db.prepare(
        `UPDATE test_sessions
         SET current_index=current_index+1,
             score=score+?
         WHERE id=?`
      ).bind(correct, session.id).run();

      // next question
      const nextIndex = session.current_index + 1;
      const nextQ = await db.prepare(
        `SELECT * FROM mcq_bank
         ORDER BY id ASC
         LIMIT 1 OFFSET ?`
      ).bind(nextIndex).first();

      if (!nextQ) {
        // finish
        await db.prepare(
          `UPDATE test_sessions
           SET completed_at=CURRENT_TIMESTAMP
           WHERE id=?`
        ).bind(session.id).run();

        await tg("editMessageText", {
          chat_id: chatId,
          message_id: cb.message.message_id,
          text: `✅ Exam Completed\n\nScore: ${session.score + correct}`,
        });
        return new Response("OK");
      }

      await tg("editMessageText", {
        chat_id: chatId,
        message_id: cb.message.message_id,
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

    return new Response("OK");
  },
};
