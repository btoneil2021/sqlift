---
name: sqlift-backend
description: Guide for writing Flask API endpoints in the SQLift project. Use this when adding or editing backend routes, database queries, or blueprints.
---

# SQLift Backend Conventions

All backend code lives in `api/`. Each page or feature area gets its own `.py` file with a Flask Blueprint, registered in `api/app.py`.

## Project structure

```
api/
├── app.py          # Flask app + blueprint registration
├── utils.py        # DB connection, api_route decorator, helpers
├── auth.py         # /api/auth/* routes
├── profile.py      # /api/profile/* routes
└── home.py         # /api/* misc routes
```

## Adding a new endpoint

### 1. Create (or open) the blueprint file

```python
# api/my_feature.py
from flask import Blueprint, jsonify, request, session
from psycopg.rows import dict_row
from api.utils import api_route

my_feature_bp = Blueprint('my_feature', __name__)
```

### 2. Write the route using `@api_route`

`@api_route` injects a live `conn` (psycopg connection) and handles DB errors. `limit` is optional.

```python
@my_feature_bp.route("/api/my-feature/<int:some_id>", methods=["GET"])
@api_route(limit="30 per minute")
def get_thing(conn, some_id):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM sqlift.my_db_function(%s)", (some_id,))
        result = cur.fetchone()

    if result is None:
        return jsonify(status="error", message="Not found."), 404

    return jsonify(status="ok", data=result)
```

### 3. Register in `api/app.py`

```python
from api.my_feature import my_feature_bp
app.register_blueprint(my_feature_bp)
```

### 4. Call from the frontend

The Vite dev proxy forwards `/api` to Flask at `http://127.0.0.1:5328`.

```js
const res = await fetch('/api/my-feature/123', { credentials: 'include' })
const data = await res.json()
```

---

## Database queries — always use DB functions

**Never write raw SQL in Flask routes.** Every query must call a PostgreSQL function in the `sqlift` schema.

```python
# CORRECT
cur.execute("SELECT * FROM sqlift.get_user_friends(%s)", (user_id,))

# WRONG — raw SQL belongs in the DB, not Flask
cur.execute("SELECT * FROM sqlift.\"user_friendship\" WHERE user_id = %s", (user_id,))
```

For write operations that don't return rows, use `SELECT` to call void functions and always `conn.commit()` after:

```python
cur.execute("SELECT sqlift.remove_friend(%s, %s)", (user_id, friend_id))
conn.commit()
```

For write operations that return the mutated row, use `RETURNING` inside the DB function and read with `cur.fetchone()`:

```python
cur.execute("SELECT * FROM sqlift.add_friend(%s, %s)", (user_id, target_username))
row = cur.fetchone()
conn.commit()
```

On constraint violations, catch the exception, `conn.rollback()`, inspect the message string, and return an appropriate HTTP error — don't let psycopg exceptions bubble to the client.

---

## Auth / session guard

Check `session.get("user_id")` at the top of any route that requires authentication. Return 403 immediately if it doesn't match the resource owner:

```python
if session.get("user_id") != user_id:
    return jsonify(status="error", message="Not authorized."), 403
```

---

## Response shape

Always return JSON with a `status` field:

```python
return jsonify(status="ok", data=result)          # success
return jsonify(status="error", message="..."), 4xx # failure
```

---

## Database schema reference

The full table and column definitions for all `sqlift` schema tables are in `docs/database_schema.sql`. Consult this file when writing new SQL functions or API endpoints to understand available columns, types, foreign keys, and constraints.

Key tables: `user`, `workout`, `workout_session`, `workout_exercise`, `exercise`, `record_log`, `set_log`, `measurement_log`, `user_goal`, `user_friendship`, `user_achievement`, `achievement`, `muscle_group`, `equipment`.

## SQL functions reference

All functions live in the `sqlift` schema. Source files are in `sql/`.

### `sql/auth_procs.sql`

| Function | Args | Returns | Purpose |
|---|---|---|---|
| `get_user_by_email` | `p_email TEXT` | user row + password | Login — fetch user and hash for bcrypt check |
| `signup_user` | username, email, password, first_name, last_name, phone_num | user row (no password) | Register new user |
| `is_username_available` | `p_username TEXT` | `BOOLEAN` | Check uniqueness before insert |

### `sql/profile_procs.sql`

| Function | Args | Returns | Purpose |
|---|---|---|---|
| `get_user_profile` | `p_user_id BIGINT` | user row (no password) | Fetch profile for display |
| `update_user_profile` | p_user_id + optional fields (all `DEFAULT NULL`) | updated user row | COALESCE update — only passed fields change |
| `change_user_password` | p_user_id, p_new_password_hash | `VOID` | Write new bcrypt hash |
| `get_user_password_hash` | `p_user_id BIGINT` | `password TEXT` | Read hash for bcrypt verification |
| `get_user_friends` | `p_user_id BIGINT` | friend rows | List friends ordered by name |
| `add_friend` | p_user_id, p_target_username | new friend row | Insert friendship; raises on self-add, duplicate, not-found |
| `remove_friend` | p_user_id, p_friend_id | `BOOLEAN` | Delete friendship; returns FALSE if not found |

---

## Writing new SQL functions

Add new functions to the appropriate file in `sql/` (create a new `sql/<feature>_procs.sql` for a new feature area). Follow these conventions:

- **Prefix parameters with `p_`** and local variables with `v_`.
- **Use `SET search_path TO sqlift`** at the top of each file.
- **Quote the `user` table** as `sqlift."user"` — it's a reserved word in PostgreSQL.
- **Return rows via `RETURN QUERY SELECT …`** inside a `RETURNS TABLE (…)` function.
- **Raise named exceptions** for business-rule violations (self-add, not found, etc.) so Flask can inspect the message string and return the right HTTP status.
- **Never use `DEFAULT NULL` parameters for required fields.** Only use defaults for genuinely optional update fields (like `update_user_profile`).

Example skeleton for a new feature:

```sql
-- sql/workout_procs.sql
SET search_path TO sqlift;

CREATE OR REPLACE FUNCTION get_user_workouts(p_user_id BIGINT)
RETURNS TABLE (
    workout_id BIGINT,
    name TEXT,
    preferred_day TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT w.workout_id, w.name, w.preferred_day
    FROM sqlift.workout w
    WHERE w.user_id = p_user_id
    ORDER BY w.name;
END;
$$ LANGUAGE plpgsql;
```
