-- Add chat-specific exam support
ALTER TABLE attempts ADD COLUMN chat_id INTEGER;

-- Track exam progress
ALTER TABLE attempts ADD COLUMN total_questions INTEGER DEFAULT 0;
ALTER TABLE attempts ADD COLUMN current_index INTEGER DEFAULT 0;

-- Ensure score column exists
ALTER TABLE attempts ADD COLUMN score INTEGER DEFAULT 0;
