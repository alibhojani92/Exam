/**
 * Admin inline keyboard
 */
export function adminKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "➕ Add Exam", callback_data: "ADMIN_ADD_EXAM" }],
      [{ text: "➕ Add Question", callback_data: "ADMIN_ADD_QUESTION" }],
      [{ text: "✅ Activate Exam", callback_data: "ADMIN_ACTIVATE_EXAM" }],
      [{ text: "⛔ Deactivate Exam", callback_data: "ADMIN_DEACTIVATE_EXAM" }]
    ]
  }
}
