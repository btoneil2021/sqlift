from pathlib import Path

from api import app as app_module
from api import index as index_module


class _FakeCursor:
    def __init__(self, rows, calls):
        self._rows = rows
        self._calls = calls

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params):
        self._calls["sql"] = sql
        self._calls["params"] = params

    def fetchall(self):
        return self._rows


class _FakeConnection:
    def __init__(self, rows, calls):
        self._rows = rows
        self._calls = calls

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def cursor(self, row_factory=None):
        self._calls["row_factory"] = row_factory
        return _FakeCursor(self._rows, self._calls)


def test_index_exports_the_flask_app():
    assert index_module.app is app_module.app


def test_supabase_health_function_exists_as_concrete_vercel_route():
    health_path = Path(__file__).resolve().parents[1] / "api" / "supabase" / "health.py"
    assert health_path.exists()

    text = health_path.read_text()
    assert "class handler(BaseHTTPRequestHandler):" in text
    assert "fetch_sample_users" in text
    assert "Could not reach the database." in text


def test_postgres_error_hint_explains_placeholder_password_failure():
    hint = app_module.postgres_error_hint(
        RuntimeError("password authentication failed for user postgres")
    )

    assert "DATABASE_URL" in hint
    assert "direct database connection string" in hint


def test_database_url_strips_quotes(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        '"postgresql://postgres:secret@db.llogioyvqexdoyvqqtti.supabase.co:5432/postgres"',
    )

    assert (
        app_module.get_database_url()
        == "postgresql://postgres:secret@db.llogioyvqexdoyvqqtti.supabase.co:5432/postgres"
    )


def test_fetch_sample_users_queries_sqlift_schema(monkeypatch):
    calls = {}
    rows = [
        {"user_id": 1, "username": "alpha", "email": "alpha@example.com"},
        {"user_id": 2, "username": "bravo", "email": "bravo@example.com"},
    ]

    def fake_connect(database_url, sslmode):
        calls["database_url"] = database_url
        calls["sslmode"] = sslmode
        return _FakeConnection(rows, calls)

    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://postgres:secret@db.llogioyvqexdoyvqqtti.supabase.co:5432/postgres",
    )
    monkeypatch.setattr(app_module.psycopg, "connect", fake_connect)

    result = app_module.fetch_sample_users(limit=2)

    assert calls["database_url"].startswith("postgresql://postgres:secret@")
    assert calls["sslmode"] == "require"
    assert calls["row_factory"] is app_module.dict_row
    assert '"sqlift"."user"' in calls["sql"] or 'sqlift."user"' in calls["sql"]
    assert calls["params"] == (2,)
    assert result == rows


def test_database_url_rejects_password_placeholder(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://postgres:[YOUR-PASSWORD]@db.llogioyvqexdoyvqqtti.supabase.co:5432/postgres",
    )

    try:
        app_module.get_database_url()
        raise AssertionError("Expected placeholder password validation to fail")
    except RuntimeError as exc:
        assert "[YOUR-PASSWORD]" in str(exc)


def test_supabase_health_route_returns_sample_users(monkeypatch):
    rows = [
        {"user_id": 7, "username": "charlie", "email": "charlie@example.com"}
    ]

    def fake_connect(database_url, sslmode):
        return _FakeConnection(rows, {})

    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://postgres:secret@db.llogioyvqexdoyvqqtti.supabase.co:5432/postgres",
    )
    monkeypatch.setattr(app_module.psycopg, "connect", fake_connect)

    client = app_module.app.test_client()
    response = client.get("/api/supabase/health")

    payload = response.get_json()

    assert response.status_code == 200
    assert payload["status"] == "ok"
    assert payload["connected"] is True
    assert payload["schema"] == "sqlift"
    assert payload["table"] == "user"
    assert payload["sample_users"] == rows
