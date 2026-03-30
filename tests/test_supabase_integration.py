from api import app as app_module
from api import index as index_module


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeRequestBuilder:
    def __init__(self, result):
        self._result = result
        self.selected_columns = None
        self.limit_value = None

    def select(self, columns):
        self.selected_columns = columns
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def execute(self):
        return self._result


class _FakeSchemaClient:
    def __init__(self, result, calls):
        self._result = result
        self._calls = calls

    def from_(self, table_name):
        self._calls["table_name"] = table_name
        return _FakeRequestBuilder(self._result)


class _FakeSupabaseClient:
    def __init__(self, result, calls):
        self._result = result
        self._calls = calls

    def schema(self, schema_name):
        self._calls["schema_name"] = schema_name
        return _FakeSchemaClient(self._result, self._calls)


def test_index_exports_the_flask_app():
    assert index_module.app is app_module.app


def test_fetch_sample_users_queries_sqlift_schema(monkeypatch):
    calls = {}
    result = _FakeResult(
        [
            {"user_id": 1, "username": "alpha", "email": "alpha@example.com"},
            {"user_id": 2, "username": "bravo", "email": "bravo@example.com"},
        ]
    )

    def fake_create_client(url, key):
        calls["url"] = url
        calls["key"] = key
        return _FakeSupabaseClient(result, calls)

    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "secret-value")
    monkeypatch.setattr(app_module, "create_client", fake_create_client)
    app_module.get_supabase_client.cache_clear()

    rows = app_module.fetch_sample_users(limit=2)

    assert calls["url"] == "https://example.supabase.co"
    assert calls["key"] == "secret-value"
    assert calls["schema_name"] == "sqlift"
    assert calls["table_name"] == "user"
    assert rows == result.data


def test_supabase_health_route_returns_sample_users(monkeypatch):
    result = _FakeResult(
        [
            {"user_id": 7, "username": "charlie", "email": "charlie@example.com"}
        ]
    )

    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "another-secret")
    monkeypatch.setattr(
        app_module,
        "create_client",
        lambda url, key: _FakeSupabaseClient(result, {}),
    )
    app_module.get_supabase_client.cache_clear()

    client = app_module.app.test_client()
    response = client.get("/api/supabase/health")

    payload = response.get_json()

    assert response.status_code == 200
    assert payload["status"] == "ok"
    assert payload["connected"] is True
    assert payload["schema"] == "sqlift"
    assert payload["table"] == "user"
    assert payload["sample_users"] == result.data
