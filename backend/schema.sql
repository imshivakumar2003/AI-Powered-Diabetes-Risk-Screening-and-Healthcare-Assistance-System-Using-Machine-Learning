-- =============================================================================
-- schema.sql
-- Raw SQL schema for the diabetes prediction app.
--
-- This is written in SQLite dialect (matches the default DATABASE_URL) and is
-- provided for reference / manual inspection. In normal use you do NOT need
-- to run this file yourself — `init_db.py` creates these same tables
-- automatically via SQLAlchemy (see models.py), and that approach also works
-- unchanged against MySQL/PostgreSQL.
--
-- If you ever want to hand-run this against SQLite directly:
--   sqlite3 app.db < schema.sql
-- =============================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        VARCHAR(80)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(150),
    role            VARCHAR(20)  NOT NULL DEFAULT 'user'
                        CHECK (role IN ('user','admin','doctor')),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_users_username ON users(username);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    full_name       VARCHAR(150) NOT NULL,
    age             INTEGER CHECK (age IS NULL OR (age >= 0 AND age <= 120)),
    gender          VARCHAR(10) CHECK (gender IN ('Male','Female','Other') OR gender IS NULL),
    contact_number  VARCHAR(30),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_patients_user_id ON patients(user_id);

-- ---------------------------------------------------------------------------
-- prediction_history  (core table — backs /api/predict, /api/history)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prediction_history (
    id                    VARCHAR(36) PRIMARY KEY,          -- UUID string
    user_id               INTEGER REFERENCES users(id) ON DELETE SET NULL,
    patient_id            INTEGER REFERENCES patients(id) ON DELETE SET NULL,

    age                   INTEGER NOT NULL,
    gender                VARCHAR(10) NOT NULL CHECK (gender IN ('Male','Female')),
    hypertension          BOOLEAN NOT NULL DEFAULT 0,
    heart_disease         BOOLEAN NOT NULL DEFAULT 0,
    bmi                   FLOAT NOT NULL CHECK (bmi >= 0 AND bmi <= 100),
    hba1c_level           FLOAT NOT NULL CHECK (hba1c_level >= 0 AND hba1c_level <= 20),
    blood_glucose_level   FLOAT NOT NULL CHECK (blood_glucose_level >= 0 AND blood_glucose_level <= 600),
    smoking_history       VARCHAR(20) NOT NULL
                              CHECK (smoking_history IN ('never','former','current','not current','ever')),

    result                VARCHAR(10) NOT NULL CHECK (result IN ('Positive','Negative')),
    probability           FLOAT,

    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_prediction_user_id ON prediction_history(user_id);
CREATE INDEX IF NOT EXISTS ix_prediction_patient_id ON prediction_history(patient_id);
CREATE INDEX IF NOT EXISTS ix_prediction_created_at ON prediction_history(created_at);
CREATE INDEX IF NOT EXISTS ix_prediction_result_created ON prediction_history(result, created_at);

-- ---------------------------------------------------------------------------
-- chat_history  (AI assistant conversation log — for future use)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id      VARCHAR(64) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant','system')),
    message         TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_chat_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS ix_chat_session_created ON chat_history(session_id, created_at);

-- ---------------------------------------------------------------------------
-- reports  (generated report files linked to a prediction)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_id   VARCHAR(36) NOT NULL REFERENCES prediction_history(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    report_type     VARCHAR(20) NOT NULL DEFAULT 'pdf' CHECK (report_type IN ('pdf','csv','json')),
    file_path       VARCHAR(500),
    generated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_reports_prediction_id ON reports(prediction_id);
CREATE INDEX IF NOT EXISTS ix_reports_user_id ON reports(user_id);

-- ---------------------------------------------------------------------------
-- settings  (per-user or global key/value settings)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    key             VARCHAR(100) NOT NULL,
    value           TEXT,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS ix_settings_user_id ON settings(user_id);
