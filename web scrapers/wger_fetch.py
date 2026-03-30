import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

WGER_BASE_URL = "https://wger.de/api/v2"


class _SimpleResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _SimpleSession:
    def get(self, url, params=None, timeout=10):
        if params:
            query = urlencode(params)
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}{query}"

        request = Request(url, headers={"Accept": "application/json"})
        with urlopen(request, timeout=timeout) as response:
            status_code = response.status
            payload = json.loads(response.read().decode("utf-8"))
        return _SimpleResponse(status_code, payload)


def _get_session(session):
    return session or _SimpleSession()


def fetch_paginated(session, url, params=None, max_pages=None):
    session = _get_session(session)
    results = []
    next_url = url
    page_count = 0

    while next_url:
        response = session.get(next_url, params=params, timeout=10)
        if response.status_code >= 400:
            raise RuntimeError(f"WGER request failed with status {response.status_code}")

        payload = response.json()
        results.extend(payload.get("results", []))
        next_url = payload.get("next")
        page_count += 1

        if max_pages is not None and page_count >= max_pages:
            break

        # Only apply params to the first request when next URLs are provided
        params = None

    return results


def fetch_exercises(session=None, params=None, max_pages=None):
    url = f"{WGER_BASE_URL}/exercise/"
    return fetch_paginated(session, url, params=params, max_pages=max_pages)


def fetch_muscles(session=None, params=None, max_pages=None):
    url = f"{WGER_BASE_URL}/muscle/"
    return fetch_paginated(session, url, params=params, max_pages=max_pages)


def fetch_equipment(session=None, params=None, max_pages=None):
    url = f"{WGER_BASE_URL}/equipment/"
    return fetch_paginated(session, url, params=params, max_pages=max_pages)
