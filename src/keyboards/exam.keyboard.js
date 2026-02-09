/**
 * MCQ options inline keyboard
 * options = [{ option_key: "A", option_text: "Text" }, ...]
 */
export function examKeyboard(options) {
  const buttons = options.map(opt => {
    return [
      {
        text: `${opt.option_key}. ${opt.option_text}`,
        callback_data: `ANSWER_${opt.option_key}`
      }
    ]
  })

  return {
    inline_keyboard: buttons
  }
}
