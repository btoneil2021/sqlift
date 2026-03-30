from importlib.machinery import SourceFileLoader
from importlib.util import module_from_spec, spec_from_loader
from pathlib import Path


def _load_mapping_module():
    module_path = Path(__file__).resolve().parents[1] / "web-scrapers" / "wger_mapping.py"
    loader = SourceFileLoader("wger_mapping", str(module_path))
    spec = spec_from_loader(loader.name, loader)
    module = module_from_spec(spec)
    loader.exec_module(module)
    return module


wger_mapping = _load_mapping_module()


def test_normalize_muscle_group_maps_common_muscles():
    assert wger_mapping.normalize_muscle_group("Pectoralis major") == "Chest"
    assert wger_mapping.normalize_muscle_group("latissimus dorsi") == "Back"
    assert wger_mapping.normalize_muscle_group("Deltoids") == "Shoulders"
    assert wger_mapping.normalize_muscle_group("Biceps brachii") == "Arms"
    assert wger_mapping.normalize_muscle_group("Rectus abdominis") == "Core"
    assert wger_mapping.normalize_muscle_group("Gluteus maximus") == "Glutes"
    assert wger_mapping.normalize_muscle_group("Quadriceps femoris") == "Legs"
    assert wger_mapping.normalize_muscle_group("Gastrocnemius") == "Calves"
    assert wger_mapping.normalize_muscle_group("Brachioradialis") == "Forearms"
    assert wger_mapping.normalize_muscle_group("Neck") == "Neck"


def test_normalize_muscle_group_handles_synonyms_and_spacing():
    assert wger_mapping.normalize_muscle_group("pecs") == "Chest"
    assert wger_mapping.normalize_muscle_group(" upper  back ") == "Back"
    assert wger_mapping.normalize_muscle_group("triceps") == "Arms"
    assert wger_mapping.normalize_muscle_group("abs") == "Core"
    assert wger_mapping.normalize_muscle_group("glutes") == "Glutes"
    assert wger_mapping.normalize_muscle_group("quads") == "Legs"
    assert wger_mapping.normalize_muscle_group("calf") == "Calves"
    assert wger_mapping.normalize_muscle_group("forearm") == "Forearms"


def test_normalize_muscle_group_unknown_returns_none():
    assert wger_mapping.normalize_muscle_group("mystery muscle") is None
    assert wger_mapping.normalize_muscle_group("") is None
    assert wger_mapping.normalize_muscle_group(None) is None
