CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY DEFAULT 1,
    display_name TEXT DEFAULT 'Learner',
    preferred_voice TEXT DEFAULT 'en_US-lessac-medium',
    playback_speed REAL DEFAULT 1.0,
    theme TEXT DEFAULT 'dark',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lesson_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    last_segment_index INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    time_spent_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(topic_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS quiz_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    user_answer INTEGER NOT NULL,
    correct_answer INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    difficulty INTEGER NOT NULL,
    time_taken_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topic_mastery (
    topic_id TEXT PRIMARY KEY,
    mastery_level REAL DEFAULT 0.0,
    questions_attempted INTEGER DEFAULT 0,
    questions_correct INTEGER DEFAULT 0,
    current_difficulty INTEGER DEFAULT 1,
    badge TEXT DEFAULT 'none',
    last_reviewed_at TIMESTAMP,
    next_review_at TIMESTAMP,
    easiness_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS design_challenge_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id TEXT NOT NULL,
    challenge_id TEXT NOT NULL,
    score REAL,
    feedback TEXT,
    conversation_json TEXT,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO user_profile (id) VALUES (1);
