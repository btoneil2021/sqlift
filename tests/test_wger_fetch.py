from importlib.machinery import SourceFileLoader
from importlib.util import module_from_spec, spec_from_loader
from pathlib import Path


def _load_fetch_module():
    module_path = Path(__file__).resolve().parents[1] / "web scrapers" / "wger_fetch.py"
    loader = SourceFileLoader("wger_fetch", str(module_path))
    spec = spec_from_loader(loader.name, loader)
    module = module_from_spec(spec)
    loader.exec_module(module)
    return module


wger_fetch = _load_fetch_module()


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload


class _FakeSession:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    def get(self, url, params=None, timeout=10):
        self.calls.append({"url": url, "params": params, "timeout": timeout})
        return self._responses.pop(0)


def test_fetch_paginated_single_page():
    session = _FakeSession(
        [
            _FakeResponse({"results": [1, 2, 3], "next": None}),
        ]
    )

    results = wger_fetch.fetch_paginated(
        session, "https://wger.de/api/v2/exercise/"
    )

    assert results == [1, 2, 3]
    assert session.calls[0]["url"] == "https://wger.de/api/v2/exercise/"


def test_fetch_paginated_multiple_pages():
    session = _FakeSession(
        [
            _FakeResponse(
                {"results": ["a"], "next": "https://wger.de/api/v2/exercise/?page=2"}
            ),
            _FakeResponse({"results": ["b", "c"], "next": None}),
        ]
    )

    results = wger_fetch.fetch_paginated(
        session, "https://wger.de/api/v2/exercise/"
    )

    assert results == ["a", "b", "c"]
    assert session.calls[0]["url"] == "https://wger.de/api/v2/exercise/"
    assert session.calls[1]["url"] == "https://wger.de/api/v2/exercise/?page=2"


def test_fetch_exercises_uses_endpoint():
    session = _FakeSession(
        [
            _FakeResponse({"results": [{"id": 1}], "next": None}),
        ]
    )

    results = wger_fetch.fetch_exercises(session=session)

    assert results == [{"id": 1}]
    assert session.calls[0]["url"] == "https://wger.de/api/v2/exercise/"
