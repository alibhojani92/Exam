import { sendMessage } from "../services/telegram"
import { startExam, getQuestionWithOptions } from "../services/exam.service"
import { examKeyboard } from "../keyboards/exam.keyboard"

export async function handleCommand(ctx, env) {
  const { chatId, text, from } = ctx

  if (!text) return

  // /exam command
  if (text === "/exam") {
    const exam = await startExam(env, from)

    if (exam.error) {
      await sendMessage(chatId, exam.error)
      return
    }

    // First question
    const firstQuestion = exam.questions[0]
    const q = await getQuestionWithOptions(env, firstQuestion)

    const questionText =
      `📝 Q1: ${q.text}\n\n` +
      q.options.map(o => `${o.option_key}) ${o.option_text}`).join("\n")

    await sendMessage(
      chatId,
      questionText,
      examKeyboard(q.options)
    )
  }
}
