# 🩺 GlucoseCheck — Diabetes Risk Screening (Full-Stack)

A production-structured full-stack rebuild of the original Streamlit diabetes
predictor: a **Flask API backend** (wrapping the existing trained model
unchanged) plus a **React + Vite frontend** with a dashboard, screening form,
history log, and model info page.

---

## 📌 Project Overview

- **Backend**: Flask REST API. Loads `diabetes_prediction_model.pkl` and
  serves predictions, history, and summary stats. The prediction logic and
  input encoding are copied over **unchanged** from the original `app.py` —
  same inputs in, same result out.
- **Frontend**: React (Vite) single-page app with a sidebar dashboard layout,
  a screening form, a lab-report-style result card with a risk gauge, a
  history table, and an about page.

---

## ✨ Features

- Dashboard with live stats (total screenings, positive/negative split, avg. glucose/BMI)
- New Screening form for all 8 model inputs, with validation
- Instant result "report slip" with risk-probability gauge
- Screening history with delete / clear-all
- Backend connection status indicator
- Loading states, error banners, and one automatic retry on network failure
- Responsive layout (desktop, tablet, mobile)

---

## 📁 Folder Structure

```
diabetes-app/
├── backend/
│   ├── app.py                       # Flask API (predict/history/stats/health)
│   ├── database.py                  # DB engine/session setup (SQLite/MySQL/PostgreSQL)
│   ├── models.py                    # SQLAlchemy ORM models
│   ├── schema.sql                   # Raw SQL schema (reference)
│   ├── init_db.py                   # Creates tables if missing
│   ├── seed_db.py                   # Loads realistic sample data
│   ├── app.db                       # SQLite database file (auto-created)
│   ├── train_model.py               # Original training script (unchanged)
│   ├── diabetes_prediction_model.pkl
│   ├── diabetes_prediction_dataset.csv
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── common/              # Alert, Loading, EmptyState
    │   │   ├── charts/               # RiskGauge (SVG)
    │   │   ├── forms/                # PredictionForm, ResultSlip
    │   │   ├── layout/               # Sidebar, Topbar, Footer, Layout
    │   │   └── ui/                   # Card, Button
    │   ├── pages/                   # Dashboard, Predict, History, About, NotFound
    │   ├── routes/                  # AppRoutes.jsx
    │   ├── services/                # api.js (axios client)
    │   ├── context/                 # AppContext.jsx (shared state)
    │   ├── utils/                   # format.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── .env.example
```

---

## 🗄️ Database

The backend now persists all prediction history in a **SQL database**
(SQLite by default) instead of the earlier JSON file. All existing API
routes and response shapes are **unchanged** — this is a storage-layer
swap only.

### New files

| File | Purpose |
|---|---|
| `backend/database.py` | Engine/session setup. Reads `DATABASE_URL` from `.env`. Auto-creates tables on startup. |
| `backend/models.py` | SQLAlchemy ORM models: `User`, `Patient`, `PredictionHistory`, `ChatHistory`, `Report`, `Setting`. |
| `backend/schema.sql` | Raw SQL schema (reference / manual setup). Not required for normal use. |
| `backend/init_db.py` | Creates all tables. Safe to re-run — never drops data. |
| `backend/seed_db.py` | Inserts realistic sample data (2 users, 2 patients, 3 predictions, chat messages, a report, settings). Idempotent — safe to re-run. |

### How it integrates with `app.py`

- `app.py` imports `init_engine_tables` from `database.py` and calls it once
  at startup — tables are created automatically if missing, nothing is
  touched if they already exist.
- `app.py` imports `PredictionHistory` from `models.py` and imports
  `get_session` from `database.py` — a context manager that commits on
  success, rolls back on error, and always closes the connection.
- The `read_history()` / `write_history()` JSON-file helpers were removed
  and replaced with SQLAlchemy queries inside each route. Every route's
  **path, method, request body, and JSON response shape are identical** to
  before.
- Every database call is wrapped in `try/except SQLAlchemyError`, returning
  a `500` with a clear error message on failure instead of crashing.

### Schema overview

| Table | Key columns | Notes |
|---|---|---|
| `users` | `id` PK, `username` / `email` UNIQUE, `role` CHECK | Optional auth, not required by existing routes |
| `patients` | `id` PK, `user_id` FK → users | Optional patient records |
| `prediction_history` | `id` PK (UUID), `user_id`/`patient_id` FK, CHECK constraints on `gender`, `result`, `bmi`, etc. | **Core table** backing `/api/predict`, `/api/history`, `/api/stats` |
| `chat_history` | `id` PK, `user_id` FK, `session_id` indexed | For a future AI assistant feature |
| `reports` | `id` PK, `prediction_id` FK → prediction_history | For future report exports |
| `settings` | `id` PK, `user_id` FK, UNIQUE(`user_id`,`key`) | Per-user or global (NULL user) key/value settings |

Full column definitions, foreign keys, indexes, and constraints are in
`backend/schema.sql` and `backend/models.py`.

### Switching to MySQL or PostgreSQL later

You only need to change **one line** in `backend/.env`:

```bash
# PostgreSQL
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@localhost:5432/diabetes_db

# MySQL
DATABASE_URL=mysql+pymysql://USER:PASSWORD@localhost:3306/diabetes_db
```

Then install the matching driver (already listed, commented out, in
`requirements.txt`):
```bash
pip install psycopg2-binary   # for PostgreSQL
# or
pip install PyMySQL           # for MySQL
```
No other code changes are needed — `database.py`, `models.py`, `init_db.py`,
and `app.py` all talk to SQLAlchemy's ORM layer, not to SQLite directly.

### Commands

```bash
cd backend

# 1. Install dependencies (includes SQLAlchemy + python-dotenv)
pip install -r requirements.txt

# 2. Copy env file (defaults to local SQLite — no setup needed)
cp .env.example .env

# 3. Create tables
python init_db.py

# 4. (Optional) Load realistic sample data
python seed_db.py

# 5. Run the app — tables are also auto-created on startup if step 3 was skipped
python app.py
```

---

## 🔐 Authentication (Phase 1 of the Multi-Role Upgrade)

The app now has full JWT-based authentication, built on top of the existing
database layer. **No existing route, prediction logic, or UI design was
changed** — this is purely additive.

### What's new

| Area | Details |
|---|---|
| Backend | `backend/auth.py` (hashing, JWT, decorators) + `backend/routes/auth_routes.py` (blueprint mounted at `/api/auth/*`) |
| Frontend | `Login`, `Register`, `ForgotPassword`, `ResetPassword`, `Profile` pages; `AuthContext`; `ProtectedRoute` |
| Database | `users` table gained `is_active`, `reset_token`, `reset_token_expires` |

### New API endpoints

| Method | Endpoint | Auth required |
|---|---|---|
| POST | `/api/auth/register` | No |
| POST | `/api/auth/login` | No |
| POST | `/api/auth/forgot-password` | No |
| POST | `/api/auth/reset-password` | No |
| POST | `/api/auth/logout` | No |
| GET | `/api/auth/me` | Yes |
| PUT | `/api/auth/profile` | Yes |
| PUT | `/api/auth/change-password` | Yes |

### Backward compatibility

`/api/predict` and `/api/history` still work **exactly as before** with no
token — this preserves any existing integrations. The difference:
- If a valid token **is** sent, the prediction is linked to that user, and
  `/api/history` returns only that user's records.
- If no token is sent, behavior is unchanged: predictions aren't linked to
  a user, and `/api/history` returns everything (as it always did).

### Demo accounts (from `seed_db.py`)

| Email | Password | Role |
|---|---|---|
| dr.mehta@example.com | ChangeMe123! | doctor |
| rahul.k@example.com | ChangeMe123! | user |

### Password reset in development

No email provider is configured yet. `POST /api/auth/forgot-password`
prints the reset link to the backend console **and** returns it in the
response body as `reset_token_dev_only`, so you can test the full flow
without setting up SMTP. Remove that field once a real email service
(SendGrid, SES, etc.) is wired up — see the comment in
`routes/auth_routes.py` for exactly where.

### JWT configuration

Set a real secret before deploying — see `backend/.env.example`:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### What's next

This is Phase 1 of the multi-role upgrade. Planned next phases: AI health
suggestions after each prediction, an AI chatbot, professional PDF reports,
and a full admin module (user management, analytics, audit logs). Ask for
any of these next and they'll build on this same foundation.

---

## 🛡️ Admin: Settings, Audit Logs & Backup/Restore

Built on top of the Phase 1 auth system. All routes below require an
`admin` role.

### Demo admin account
| Email | Password |
|---|---|
| admin@example.com | AdminPass123! |

### System Settings (`/admin/settings` in the UI)
Manage AI API key, email/SMTP, database (read-only display), application,
theme, and backup settings — grouped into tabs. Secret values (API key,
SMTP password) are masked on read and only ever accepted in full on write.
Backed by the existing `settings` table.

### Audit Logs (`/admin/audit-logs` in the UI)
Every login (success/failure), registration, prediction, history
delete/clear, profile/password change, settings update, and backup/restore
is recorded automatically via `backend/audit.py`. Filterable by action and
status, paginated.

### Backup & Restore (`/admin/backup` in the UI)
- **Create Backup** — snapshots the live SQLite file into `backend/backups/`
- **Export SQL** — downloads a portable `.sql` dump (via `sqlite3.iterdump()`)
- **Import SQL** — restores from an uploaded `.sql` file
- **Restore** — rolls back to any stored `.db` snapshot

Every restore path automatically snapshots the *current* database first
(`pre_restore_<timestamp>.db`) and swaps files atomically, so a bad restore
never leaves the live database partially overwritten.

> **Note:** built-in backup/restore only works with SQLite. For
> MySQL/PostgreSQL, use `mysqldump`/`pg_dump` and the matching restore tools
> — the settings/audit-log features work the same regardless of database.

### History: search, filters, pagination, export
- `GET /api/history/search` — new, paginated, filterable endpoint (by
  result, gender, date range, age range). Does not change the existing
  `GET /api/history` contract.
- `GET /api/history/export?format=csv|excel|pdf` — same filters, streams a
  file download. The History page in the UI now has a filter bar,
  pagination, and Export CSV/Excel/PDF buttons.
- The prediction result card also has a **Download as Image** button that
  exports the risk gauge as a PNG.

### Other additions in this phase
| Feature | Where |
|---|---|
| Dark/Light mode | `ThemeContext`, toggle in the top bar, persisted in `localStorage` |
| Toast notifications | `ToastContext` — used across settings, backups, history actions |
| Error boundary | `ErrorBoundary.jsx` wraps the whole app |
| Pagination component | `components/common/Pagination.jsx`, reused by History and Audit Logs |
| API documentation | `backend/API_DOCUMENTATION.md` — every endpoint, params, and response shape |

### What's still pending
This batch covers Settings, Audit Logs, Backup/Restore, and the
cross-cutting features list. Not yet built: the full **Admin Dashboard**
(KPI cards, system status), **User Management** (view/edit/deactivate
users), **Analytics Dashboard** (charts, distributions), **AI Chatbot**,
and **PDF health reports with QR codes** — these remain separate phases
from the original spec.

---

## ⚙️ Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

pip install -r requirements.txt

# copy env example (includes DATABASE_URL)
cp .env.example .env

# create tables + load sample data
python init_db.py
python seed_db.py

python app.py
```

The API runs at **http://localhost:5000**.

### API Endpoints

| Method | Endpoint              | Description                          |
|--------|------------------------|---------------------------------------|
| GET    | `/api/health`          | Health check + model-loaded status   |
| POST   | `/api/predict`         | Run a prediction, returns a report   |
| GET    | `/api/history?limit=50`| List recent predictions              |
| DELETE | `/api/history/<id>`    | Delete one history record            |
| DELETE | `/api/history`         | Clear all history                    |
| GET    | `/api/stats`           | Summary stats for the dashboard      |

**Example request body for `/api/predict`:**
```json
{
  "age": 45,
  "hypertension": "Yes",
  "heart_disease": "No",
  "bmi": 31.2,
  "HbA1c_level": 7.1,
  "blood_glucose_level": 180,
  "gender": "Female",
  "smoking_history": "former"
}
```

---

## 🎨 Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app runs at **http://localhost:5173** and proxies `/api/*` calls to the
Flask backend automatically in dev (see `vite.config.js`).

To build for production:
```bash
npm run build       # outputs static files to frontend/dist
npm run preview     # preview the production build locally
```

---

## 🔑 Environment Variables

**backend/.env**
```
FLASK_ENV=development
FLASK_DEBUG=1
PORT=5000
```

**frontend/.env**
```
VITE_API_BASE_URL=/api
```
Set `VITE_API_BASE_URL` to your deployed backend URL (e.g.
`https://your-api.onrender.com/api`) when building for production.

---

## ▶️ Running the Project (both at once)

Open two terminals:

```bash
# Terminal 1
cd backend && python app.py

# Terminal 2
cd frontend && npm run dev
```

Then visit **http://localhost:5173**.

---

## 🚀 Deployment Guide

- **Backend**: deploy to Render, Railway, or any host that supports Flask
  (use a production WSGI server such as `gunicorn app:app`, not the built-in
  dev server).
- **Frontend**: run `npm run build`, then deploy the `dist/` folder to
  Vercel, Netlify, or any static host. Set `VITE_API_BASE_URL` to the
  backend's public URL before building.

---

## 🧠 Model Details

- Task: Binary classification (Diabetes: Positive / Negative)
- Algorithm: Logistic Regression
- Input features (8): age, hypertension, heart_disease, bmi, HbA1c_level,
  blood_glucose_level, gender, smoking_history
- Preprocessing: categorical encoding + mean imputation for missing values,
  matched exactly between training and inference

To retrain the model:
```bash
cd backend
python train_model.py
```

---

## 🛠️ Troubleshooting

| Issue | Fix |
|---|---|
| "API offline" badge in the topbar | Make sure `python app.py` is running on port 5000 |
| CORS errors in the browser console | Confirm `flask-cors` is installed and the backend is running |
| Predictions look wrong | Re-run `train_model.py` to regenerate the `.pkl` file, or confirm the dataset wasn't modified |
| `ModuleNotFoundError` on backend start | Run `pip install -r requirements.txt` inside the backend's virtual environment |
| `sqlalchemy.exc.OperationalError: no such table` | Run `python init_db.py` before starting the app |
| Want to reset all data | Stop the server, delete `backend/app.db`, then run `python init_db.py` (and `python seed_db.py` if you want sample data back) |
| Switching to MySQL/PostgreSQL fails to connect | Confirm the driver is installed (`psycopg2-binary` or `PyMySQL`) and `DATABASE_URL` in `.env` matches your DB credentials |

---

## 🔮 Future Improvements

- User authentication and per-user history
- Export history as CSV/PDF
- Model comparison (Logistic Regression vs. Random Forest / XGBoost)
- Dockerized deployment (single `docker-compose up`)

---

## 📄 License

For educational and portfolio use. Not intended for real medical diagnosis.
