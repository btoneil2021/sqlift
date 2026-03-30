import re


_BUCKETS = {
    "Chest",
    "Back",
    "Shoulders",
    "Arms",
    "Core",
    "Glutes",
    "Legs",
    "Calves",
    "Forearms",
    "Neck",
}


_KEYWORD_MAP = [
    ("pectoralis", "Chest"),
    ("pec", "Chest"),
    ("chest", "Chest"),
    ("latissimus", "Back"),
    ("lats", "Back"),
    ("back", "Back"),
    ("trapezius", "Back"),
    ("deltoid", "Shoulders"),
    ("shoulder", "Shoulders"),
    ("biceps", "Arms"),
    ("triceps", "Arms"),
    ("brachialis", "Arms"),
    ("brachii", "Arms"),
    ("abdominis", "Core"),
    ("abs", "Core"),
    ("oblique", "Core"),
    ("core", "Core"),
    ("glute", "Glutes"),
    ("hamstring", "Legs"),
    ("quadriceps", "Legs"),
    ("quad", "Legs"),
    ("thigh", "Legs"),
    ("adductor", "Legs"),
    ("abductor", "Legs"),
    ("gastrocnemius", "Calves"),
    ("soleus", "Calves"),
    ("calf", "Calves"),
    ("forearm", "Forearms"),
    ("brachioradialis", "Forearms"),
    ("neck", "Neck"),
]


def _normalize_text(value):
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def normalize_muscle_group(raw_name):
    """
    Normalize a raw muscle label into a broad user-facing bucket.

    Unknown or empty inputs intentionally return None to avoid inventing
    categories that the UI doesn't recognize.
    """
    if raw_name is None:
        return None

    normalized = _normalize_text(str(raw_name))
    if not normalized:
        return None

    for keyword, bucket in _KEYWORD_MAP:
        if keyword in normalized:
            return bucket

    return None
