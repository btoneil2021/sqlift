from importlib.machinery import SourceFileLoader
from importlib.util import module_from_spec, spec_from_loader
from pathlib import Path


def _load_import_module():
    module_path = (
        Path(__file__).resolve().parents[1] / "web scrapers" / "import_wger.py"
    )
    loader = SourceFileLoader("import_wger", str(module_path))
    spec = spec_from_loader(loader.name, loader)
    module = module_from_spec(spec)
    loader.exec_module(module)
    return module


import_wger = _load_import_module()


class _FakeCursor:
    def __init__(self, calls):
        self.calls = calls

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params=None):
        self.calls.append((sql, params))


class _FakeConnection:
    def __init__(self):
        self.calls = []

    def cursor(self):
        return _FakeCursor(self.calls)


def _first_index_of(calls, needle):
    for idx, (sql, _params) in enumerate(calls):
        if needle in sql:
            return idx
    return None


def test_write_dataset_orders_inserts_and_maps_buckets():
    dataset = {
        "muscles": [
            {"id": 1, "name": "Pectoralis major", "name_en": "Chest"},
            {"id": 2, "name": "Biceps brachii", "name_en": ""},
            {"id": None, "name": "Unknown", "name_en": ""},
        ],
        "equipment": [{"id": 10, "name": "Barbell"}, {"id": None, "name": "??"}],
        "exerciseinfo": [
            {
                "id": 101,
                "muscles": [1],
                "muscles_secondary": [2],
                "equipment": [10, None],
            }
        ],
        "translations": [
            {
                "exercise": 101,
                "name": "Bench Press",
                "description": "Classic press.",
            }
        ],
    }

    conn = _FakeConnection()
    summary = import_wger.write_dataset(conn, dataset)

    calls = conn.calls
    assert calls, "Expected SQL calls from write_dataset"

    muscle_idx = _first_index_of(calls, "sqlift.muscle_group")
    equipment_idx = _first_index_of(calls, "sqlift.equipment")
    exercise_idx = _first_index_of(calls, "sqlift.exercise ")
    emg_idx = _first_index_of(calls, "sqlift.exercise_muscle_group")
    ee_idx = _first_index_of(calls, "sqlift.exercise_equipment")

    assert muscle_idx is not None
    assert equipment_idx is not None
    assert exercise_idx is not None
    assert emg_idx is not None
    assert ee_idx is not None

    assert muscle_idx < equipment_idx < exercise_idx < emg_idx < ee_idx

    # Check that chest and arms buckets are used
    emg_params = [params for sql, params in calls if "exercise_muscle_group" in sql]
    assert (101, 1, "Primary") in emg_params
    assert (101, 4, "Secondary") in emg_params
    assert len(summary["skipped_missing_equipment"]) >= 1
    assert len(summary["skipped_missing_muscle"]) >= 0


def test_write_dataset_skips_missing_translation():
    dataset = {
        "muscles": [],
        "equipment": [],
        "exerciseinfo": [
            {"id": 201, "muscles": [], "muscles_secondary": [], "equipment": []},
            {"id": None, "muscles": [], "muscles_secondary": [], "equipment": []},
        ],
        "translations": [],
    }

    conn = _FakeConnection()
    summary = import_wger.write_dataset(conn, dataset)

    exercise_inserts = [sql for sql, _params in conn.calls if "sqlift.exercise " in sql]
    emg_inserts = [
        sql for sql, _params in conn.calls if "sqlift.exercise_muscle_group" in sql
    ]
    ee_inserts = [
        sql for sql, _params in conn.calls if "sqlift.exercise_equipment" in sql
    ]

    assert exercise_inserts == []
    assert emg_inserts == []
    assert ee_inserts == []
    assert summary["skipped_missing_translation"] == [{"exercise_id": 201}]
    assert len(summary["skipped_missing_id"]) == 1


def test_import_wger_dry_run_avoids_database(monkeypatch):
    dataset = {
        "muscles": [],
        "equipment": [],
        "exerciseinfo": [
            {"id": 301, "muscles": [], "muscles_secondary": [], "equipment": []},
            {"id": None, "muscles": [], "muscles_secondary": [], "equipment": []},
        ],
        "translations": [],
    }

    def fake_fetch_dataset(session=None, limit=None, max_pages=None):
        return dataset

    def fail_connect(*args, **kwargs):
        raise AssertionError("dry-run should not open a database connection")

    monkeypatch.setattr(import_wger, "fetch_dataset", fake_fetch_dataset)
    monkeypatch.setattr(import_wger.psycopg, "connect", fail_connect)

    summary = import_wger.import_wger(
        database_url="postgresql://example",
        dry_run=True,
    )

    assert summary["skipped_missing_translation"] == [{"exercise_id": 301}]
    assert len(summary["skipped_missing_id"]) == 1
