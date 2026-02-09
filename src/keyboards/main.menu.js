export function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📝 Start Exam", callback_data: "START_EXAM" }
      ],
      [
        { text: "📊 My Result", callback_data: "MY_RESULT" }
      ]
    ]
  }
}
