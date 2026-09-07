# API Documentation — GlucoseCheck Backend

Base URL (development): `http://localhost:5000/api`

Authentication: send `Authorization: Bearer <token>` for any endpoint marked
**Auth required**. Tokens are issued by `/auth/login` and `/auth/register`.

---

## Health

### `GET /health`
Returns service + database status. No auth required.

```json
{ "status": "ok", "model_loaded": true, "database_connected": true }
```

---

## Authentication (`/auth/*`)

### `POST /auth/register`
Body: `{ "username", "email", "password", "full_name"? }`
Returns: `{ "token", "user" }` — `201 Created`. `409` if username/email taken.

### `POST /auth/login`
Body: `{ "email", "password" }`
Returns: `{ "token", "user" }`. `401` on bad credentials, `403` if deactivated.

### `POST /auth/forgot-password`
Body: `{ "email" }`
Returns a generic success message regardless of whether the email exists
(prevents email enumeration). In development (no email provider configured),
the response also includes `reset_token_dev_only` — remove this once real
email sending is wired up.

### `POST /auth/reset-password`
Body: `{ "token", "new_password" }`
Resets the password if the token is valid and unexpired (default: 30 min).

### `POST /auth/logout`
Stateless — the frontend simply discards its token. Included for API
consistency and as a future hook point for a token blocklist.

### `GET /auth/me` — **Auth required**
Returns the current user's profile.

### `PUT /auth/profile` — **Auth required**
Body: `{ "full_name"?, "email"? }`

### `PUT /auth/change-password` — **Auth required**
Body: `{ "old_password", "new_password" }`

---

## Prediction & History

### `POST /predict`
Body (all required):
```json
{
  "age": 45, "hypertension": "Yes", "heart_disease": "No",
  "bmi": 28.4, "HbA1c_level": 6.8, "blood_glucose_level": 150,
  "gender": "Female", "smoking_history": "former"
}
```
Works with or without a token. If a token is present, the prediction is
linked to that user. Returns the saved record including `result` and
`probability`.

### `GET /history?limit=50`
Anonymous: returns all records (legacy behavior, preserved for backward
compatibility). Logged in: returns only that user's records.

### `GET /history/search` — pagination + filters
Query params: `page`, `page_size` (max 100), `result` (`Positive`/`Negative`),
`gender`, `date_from`, `date_to`, `min_age`, `max_age`.
Returns: `{ items, total, page, page_size, total_pages }`.

### `GET /history/export?format=csv|excel|pdf`
Same filters as `/history/search`. Streams a file download.

### `DELETE /history/<id>`
### `DELETE /history` — clears all (respecting the same user-scoping as `GET /history`)
### `GET /stats` — totals, positive/negative split, average glucose/BMI

---

## Admin (`/admin/*`) — all routes require `role: admin`

### `GET /admin/settings`
Returns all settings grouped by category (`ai`, `email`, `database`,
`application`, `theme`, `backup`). Secret values are masked
(`••••••cdef`) and never returned in full.

### `PUT /admin/settings`
Body: `{ "<category>": { "<key>": "<value>" }, ... }` — only known
category/key pairs are accepted; others are reported back in `warnings`.

### `GET /admin/audit-logs`
Query params: `page`, `page_size` (max 100), `action`, `user_id`, `status`,
`date_from`, `date_to`. Returns `{ items, total, page, page_size, total_pages }`.

### `GET /admin/backup/export-sql`
Downloads a portable `.sql` dump of the current database (SQLite only).

### `POST /admin/backup/import-sql`
Multipart upload, field `file` (`.sql`). Restores the database from the
dump. A safety snapshot of the current state is created automatically
first, and the restore is applied to a temp file and atomically swapped in
— the live database is never left partially modified on failure.

### `POST /admin/backup/create`
Snapshots the current database file into `backend/backups/`.

### `GET /admin/backup/list`
Lists all stored backup files with size/type/created date.

### `POST /admin/backup/restore/<filename>`
Restores a stored `.db` snapshot (not `.sql` — use `import-sql` for those).
Also creates an automatic safety backup first.

### `GET /admin/backup/download/<filename>`
Downloads a stored backup file.

---

## Error format

All errors return JSON: `{ "error": "human-readable message" }` with an
appropriate HTTP status code (`400`, `401`, `403`, `404`, `409`, `500`).

## Auditable actions

Every login (success/failure), registration, prediction, history
deletion/clearing, profile/password change, settings update, and database
backup/restore is written to the `audit_logs` table — viewable via
`GET /admin/audit-logs`.
