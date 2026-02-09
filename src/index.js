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

    const ADMINS = [7539477188];

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

    function isAdmin(id) {
      return ADMINS.includes(id);
    }

    /* ================= MESSAGE ================= */
    if (update.message) {
      const chatId = update.message.chat.id;
      const from = update.message.from;
      const text = cleanText(update.message.text);

      await db
        .prepare(
          `INSERT OR IGNORE INTO users (id, name)
           VALUES (?, ?)`
        )
        .bind(from.id, from.first_name || "")
        .run();

      /* /start */
      if (text === "/start") {
        await tg("sendMessage", {
          chat_id: chatId,
          text:
            "👋 MCQ Exam Bot Ready\n\n" +
            "📝 /exam → Exam start / resume\n" +
            "📊 /result → Last result",
        });
        return new Response("OK");
      }

      /* /exam */
      if (text === "/exam") {
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
              `INSERT INTO test_sessions
               (user_id, chat_id, current_index, score)
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

      /* /result */
      if (text === "/result") {
        const last = await db
          .prepare(
            `SELECT * FROM test_sessions
             WHERE user_id=? AND completed_at IS NOT NULL
             ORDER BY completed_at DESC
             LIMIT 1`
          )
          .bind(from.id)
          .first();

        await tg("sendMessage", {
          chat_id: chatId,
          text: last ? `📊 Last Score: ${last.score}` : "❌ Result મળ્યો નથી",
        });

        return new Response("OK");
      }

      /* /addmcq (ADMIN) */
      if (text.startsWith("/addmcq")) {
        if (!isAdmin(from.id)) {
          await tg("sendMessage", {
            chat_id: chatId,
            text: "❌ Only admin can add MCQ",
          });
          return new Response("OK");
        }

        const payload = update.message.text.replace("/addmcq", "").trim();
        if (!payload) {
          await tg("sendMessage", {
            chat_id: chatId,
            text:
              "Q: Question?\n" +
              "A) opt1\nB) opt2\nC) opt3\nD) opt4\nANS: A",
          });
          return new Response("OK");
        }

        const blocks = payload.split("\n\n");
        let added = 0;

        for (const block of blocks) {
          const lines = block.split("\n");
          const q = lines.find(l => l.startsWith("Q:"))?.slice(2).trim();
          const A = lines.find(l => l.startsWith("A)"))?.slice(2).trim();
          const B = lines.find(l => l.startsWith("B)"))?.slice(2).trim();
          const C = lines.find(l => l.startsWith("C)"))?.slice(2).trim();
          const D = lines.find(l => l.startsWith("D)"))?.slice(2).trim();
          const ans = lines.find(l => l.startsWith("ANS:"))?.slice(4).trim();

          if (!q || !A || !B || !C || !D || !ans) continue;

          await db
            .prepare(
              `INSERT INTO mcq_bank
               (question, option_a, option_b, option_c, option_d, correct_option)
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .bind(q, A, B, C, D, ans)
            .run();

          added++;
        }

        await tg("sendMessage", {
          chat_id: chatId,
          text: `✅ ${added} MCQ added`,
        });

        return new Response("OK");
      }

      /* CSV upload (ADMIN) */
      if (update.message.document && isAdmin(from.id)) {
        const fileId = update.message.document.file_id;
        const fileInfo = await fetch(`${API}/getFile?file_id=${fileId}`).then(r => r.json());
        const csvText = await fetch(
          `https://api.telegram.org/file/bot${TOKEN}/${fileInfo.result.file_path}`
        ).then(r => r.text());

        const lines = csvText.split("\n");
        let added = 0;

        for (let i = 1; i < lines.length; i++) {
          const c = lines[i].split(",");
          if (c.length < 6) continue;

          await db
            .prepare(
              `INSERT INTO mcq_bank
               (question, option_a, option_b, option_c, option_d, correct_option)
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .bind(c[0], c[1], c[2], c[3], c[4], c[5].trim())
            .run();
          added++;
        }

        await tg("sendMessage", {
          chat_id: chatId,
          text: `✅ CSV MCQs added: ${added}`,
        });

        return new Response("OK");
      }

      /* /addjson (ADMIN) */
      if (text.startsWith("/addjson")) {
        if (!isAdmin(from.id)) {
          await tg("sendMessage", {
            chat_id: chatId,
            text: "❌ Only admin can add JSON MCQ",
          });
          return new Response("OK");
        }

        let data;
        try {
          data = JSON.parse(update.message.text.replace("/addjson", "").trim());
        } catch {
          await tg("sendMessage", {
            chat_id: chatId,
            text: "❌ Invalid JSON",
          });
          return new Response("OK");
        }

        let added = 0;
        for (const q of data) {
          await db
            .prepare(
              `INSERT INTO mcq_bank
               (question, option_a, option_b, option_c, option_d, correct_option)
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .bind(q.question, q.A, q.B, q.C, q.D, q.ANS)
            .run();
          added++;
        }

        await tg("sendMessage", {
          chat_id: chatId,
          text: `✅ JSON MCQs added: ${added}`,
        });

        return new Response("OK");
      }
    }

    /* ================= CALLBACK ================= */
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const from = cb.from;
      const [_, qid, opt] = cb.data.split("_");

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
           SET current_index=current_index+1,
               score=score+?
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
