/**
 * Builds inline keyboard for MCQ options
 * options = [{ option_key: "A", option_text: "..." }, ...]
 */
export function examKeyboard(options) {
  return {
    inline_keyboard: options.map(opt => [
      {
        text: `${opt.option_key}) ${opt.option_text}`,
        callback_data: `ANSWER_${opt.option_key}`
      }
    ])
  }
}
