import argparse
import json
import os
from importlib.machinery import SourceFileLoader
from importlib.util import module_from_spec, spec_from_loader
from pathlib import Path
from urllib.parse import urljoin

import psycopg
from dotenv import load_dotenv

load_dotenv()


CANONICAL_BUCKETS = [
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
]


def _load_module(file_name, module_name):
    module_path = Path(__file__).resolve().parent / file_name
    loader = SourceFileLoader(module_name, str(module_path))
    spec = spec_from_loader(loader.name, loader)
    module = module_from_spec(spec)
    loader.exec_module(module)
    return module


def _get_mapping_module():
    return _load_module("wger_mapping.py", "wger_mapping")


def _get_fetch_module():
    return _load_module("wger_fetch.py", "wger_fetch")


def build_bucket_id_map():
    return {name: idx + 1 for idx, name in enumerate(CANONICAL_BUCKETS)}


def _extract_primary_translation(item):
    translations = item.get("translations") or []
    for translation in translations:
        if translation.get("language") == 2:
            return translation
    return translations[0] if translations else None


def _extract_translations_from_exerciseinfo(exerciseinfo):
    translations = []
    for item in exerciseinfo:
        exercise_id = item.get("id")
        if exercise_id is None:
            continue
        translation = _extract_primary_translation(item)
        if translation:
            translations.append(translation)
    return translations


def _extract_media_from_exerciseinfo(exerciseinfo):
    media = []
    for item in exerciseinfo:
        exercise_id = item.get("id")
        images = item.get("images") or []
        for image in images:
            url = image.get("image")
            if not url:
                continue
            media.append(
                {
                    "exercise": exercise_id,
                    "url": urljoin("https://wger.de", url),
                    "type": image.get("style"),
                }
            )
    return media


def _clean_env_value(value):
    if value is None:
        return None
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def get_database_url():
    url = _clean_env_value(os.getenv("DATABASE_URL"))
    if not url:
        raise RuntimeError("Missing DATABASE_URL for importer.")

    if "[YOUR-PASSWORD]" in url:
        password = _clean_env_value(os.getenv("DATABASE_PASSWORD"))
        if not password:
            raise RuntimeError(
                "DATABASE_URL contains [YOUR-PASSWORD] placeholder, but "
                "DATABASE_PASSWORD environment variable is not set."
            )
        url = url.replace("[YOUR-PASSWORD]", password)

    return url


def fetch_dataset(session=None, limit=None, max_pages=None):
    fetch = _get_fetch_module()
    params = {}
    if limit is not None:
        params["limit"] = limit

    exerciseinfo = fetch.fetch_paginated(
        session,
        f"{fetch.WGER_BASE_URL}/exerciseinfo/",
        params=params or None,
        max_pages=max_pages,
    )
    muscles = fetch.fetch_paginated(
        session,
        f"{fetch.WGER_BASE_URL}/muscle/",
        params=None,
        max_pages=max_pages,
    )
    equipment = fetch.fetch_paginated(
        session,
        f"{fetch.WGER_BASE_URL}/equipment/",
        params=None,
        max_pages=max_pages,
    )
    translations = _extract_translations_from_exerciseinfo(exerciseinfo)
    media = _extract_media_from_exerciseinfo(exerciseinfo)

    return {
        "exerciseinfo": exerciseinfo,
        "translations": translations,
        "muscles": muscles,
        "equipment": equipment,
        "media": media,
    }


def _build_translation_map(translations):
    translation_map = {}
    for translation in translations:
        exercise_id = translation.get("exercise")
        if exercise_id is None or exercise_id in translation_map:
            continue
        if translation.get("language") != 2:
            continue
        translation_map[exercise_id] = translation
    return translation_map


def _build_muscle_bucket_map(muscles, bucket_id_map, normalize_func):
    muscle_map = {}
    for muscle in muscles:
        raw_name = muscle.get("name_en") or muscle.get("name") or ""
        bucket = normalize_func(raw_name)
        if bucket is None:
            continue
        bucket_id = bucket_id_map.get(bucket)
        if bucket_id is None:
            continue
        muscle_map[muscle.get("id")] = bucket_id
    return muscle_map


def _related_item_id(value):
    if isinstance(value, dict):
        return value.get("id")
    return value


def _build_summary(dataset, bucket_id_map=None):
    bucket_id_map = bucket_id_map or build_bucket_id_map()
    muscles = dataset.get("muscles", [])
    exerciseinfo = dataset.get("exerciseinfo", [])
    translations = dataset.get("translations", [])
    media = dataset.get("media", [])

    mapping_module = _get_mapping_module()
    normalize = mapping_module.normalize_muscle_group
    translation_map = _build_translation_map(translations)
    muscle_bucket_map = _build_muscle_bucket_map(muscles, bucket_id_map, normalize)

    summary = {
        "skipped_missing_translation": [],
        "skipped_missing_id": [],
        "skipped_missing_muscle": [],
        "skipped_missing_equipment": [],
        "skipped_missing_media": [],
    }

    inserted_exercises = set()
    for item in exerciseinfo:
        exercise_id = item.get("id")
        if exercise_id is None:
            summary["skipped_missing_id"].append(item)
            continue
        translation = translation_map.get(exercise_id)
        if not translation:
            summary["skipped_missing_translation"].append(
                {"exercise_id": exercise_id}
            )
            continue
        inserted_exercises.add(exercise_id)

    for item in exerciseinfo:
        exercise_id = item.get("id")
        if exercise_id not in inserted_exercises:
            continue
        for muscle_entry in item.get("muscles", []) or []:
            muscle_id = _related_item_id(muscle_entry)
            if muscle_id is None:
                summary["skipped_missing_muscle"].append(
                    {"exercise_id": exercise_id, "muscle_id": None}
                )
                continue
            if muscle_bucket_map.get(muscle_id) is None:
                summary["skipped_missing_muscle"].append(
                    {"exercise_id": exercise_id, "muscle_id": muscle_id}
                )

        for muscle_entry in item.get("muscles_secondary", []) or []:
            muscle_id = _related_item_id(muscle_entry)
            if muscle_id is None:
                summary["skipped_missing_muscle"].append(
                    {"exercise_id": exercise_id, "muscle_id": None}
                )
                continue
            if muscle_bucket_map.get(muscle_id) is None:
                summary["skipped_missing_muscle"].append(
                    {"exercise_id": exercise_id, "muscle_id": muscle_id}
                )

        for equipment_entry in item.get("equipment", []) or []:
            equipment_id = _related_item_id(equipment_entry)
            if equipment_id is None:
                summary["skipped_missing_equipment"].append(
                    {"exercise_id": exercise_id, "equipment_id": None}
                )

    for item in media:
        exercise_id = _related_item_id(item.get("exercise"))
        url = item.get("image") or item.get("url")
        if exercise_id is None or url is None:
            summary["skipped_missing_media"].append(
                {
                    "exercise_id": exercise_id,
                    "url": url,
                }
            )
            continue
        if exercise_id not in inserted_exercises:
            summary["skipped_missing_media"].append(
                {
                    "exercise_id": exercise_id,
                    "url": url,
                }
            )

    return summary


def write_dataset(conn, dataset, bucket_id_map=None):
    bucket_id_map = bucket_id_map or build_bucket_id_map()
    muscles = dataset.get("muscles", [])
    equipment = dataset.get("equipment", [])
    exerciseinfo = dataset.get("exerciseinfo", [])
    translations = dataset.get("translations", [])
    media = dataset.get("media", [])

    mapping_module = _get_mapping_module()
    normalize = mapping_module.normalize_muscle_group
    normalize_media_type = mapping_module.normalize_media_type
    translation_map = _build_translation_map(translations)
    muscle_bucket_map = _build_muscle_bucket_map(muscles, bucket_id_map, normalize)

    summary = {
        "skipped_missing_translation": [],
        "skipped_missing_id": [],
        "skipped_missing_muscle": [],
        "skipped_missing_equipment": [],
        "skipped_missing_media": [],
    }

    with conn.cursor() as cur:
        for bucket_name, bucket_id in bucket_id_map.items():
            cur.execute(
                "INSERT INTO sqlift.muscle_group "
                "(muscle_id, name, description) "
                "VALUES (%s, %s, %s) "
                "ON CONFLICT (muscle_id) DO UPDATE "
                "SET name = EXCLUDED.name, description = EXCLUDED.description",
                (bucket_id, bucket_name, None),
            )

        for item in equipment:
            equipment_id = item.get("id")
            if equipment_id is None:
                summary["skipped_missing_equipment"].append(item)
                continue
            cur.execute(
                "INSERT INTO sqlift.equipment "
                "(equipment_id, name, description) "
                "VALUES (%s, %s, %s) "
                "ON CONFLICT (equipment_id) DO UPDATE "
                "SET name = EXCLUDED.name, description = EXCLUDED.description",
                (equipment_id, item.get("name"), None),
            )

        inserted_exercises = set()
        for item in exerciseinfo:
            exercise_id = item.get("id")
            if exercise_id is None:
                summary["skipped_missing_id"].append(item)
                continue
            translation = translation_map.get(exercise_id)
            if not translation:
                summary["skipped_missing_translation"].append(
                    {"exercise_id": exercise_id}
                )
                continue
            cur.execute(
                "INSERT INTO sqlift.exercise "
                "(exercise_id, name, description, is_unilateral, instruction) "
                "VALUES (%s, %s, %s, %s, %s) "
                "ON CONFLICT (exercise_id) DO UPDATE "
                "SET name = EXCLUDED.name, description = EXCLUDED.description, "
                "is_unilateral = EXCLUDED.is_unilateral, "
                "instruction = EXCLUDED.instruction",
                (
                    exercise_id,
                    translation.get("name"),
                    translation.get("description"),
                    False,
                    None,
                ),
            )
            inserted_exercises.add(exercise_id)

        for item in exerciseinfo:
            exercise_id = item.get("id")
            if exercise_id not in inserted_exercises:
                continue
            seen_bucket_ids = set()
            for muscle_entry in item.get("muscles", []) or []:
                muscle_id = _related_item_id(muscle_entry)
                if muscle_id is None:
                    summary["skipped_missing_muscle"].append(
                        {"exercise_id": exercise_id, "muscle_id": None}
                    )
                    continue
                bucket_id = muscle_bucket_map.get(muscle_id)
                if bucket_id is None or bucket_id in seen_bucket_ids:
                    continue
                cur.execute(
                    "INSERT INTO sqlift.exercise_muscle_group "
                    "(exercise_id, muscle_id, role) "
                    "VALUES (%s, %s, %s) "
                    "ON CONFLICT (exercise_id, muscle_id) DO UPDATE "
                    "SET role = EXCLUDED.role",
                    (exercise_id, bucket_id, "Primary"),
                )
                seen_bucket_ids.add(bucket_id)

            for muscle_entry in item.get("muscles_secondary", []) or []:
                muscle_id = _related_item_id(muscle_entry)
                if muscle_id is None:
                    summary["skipped_missing_muscle"].append(
                        {"exercise_id": exercise_id, "muscle_id": None}
                    )
                    continue
                bucket_id = muscle_bucket_map.get(muscle_id)
                if bucket_id is None or bucket_id in seen_bucket_ids:
                    continue
                cur.execute(
                    "INSERT INTO sqlift.exercise_muscle_group "
                    "(exercise_id, muscle_id, role) "
                    "VALUES (%s, %s, %s) "
                    "ON CONFLICT (exercise_id, muscle_id) DO UPDATE "
                    "SET role = EXCLUDED.role",
                    (exercise_id, bucket_id, "Secondary"),
                )
                seen_bucket_ids.add(bucket_id)

        for item in exerciseinfo:
            exercise_id = item.get("id")
            if exercise_id not in inserted_exercises:
                continue
            for equipment_entry in item.get("equipment", []) or []:
                equipment_id = _related_item_id(equipment_entry)
                if equipment_id is None:
                    summary["skipped_missing_equipment"].append(
                        {"exercise_id": exercise_id, "equipment_id": None}
                    )
                    continue
                cur.execute(
                    "INSERT INTO sqlift.exercise_equipment "
                    "(exercise_id, equipment_id) "
                    "VALUES (%s, %s) "
                    "ON CONFLICT (exercise_id, equipment_id) DO NOTHING",
                    (exercise_id, equipment_id),
                )

        for item in media:
            exercise_id = _related_item_id(item.get("exercise"))
            url = item.get("image") or item.get("url")
            media_type = normalize_media_type(url)
            if exercise_id is None or url is None or media_type is None:
                summary["skipped_missing_media"].append(
                    {
                        "exercise_id": exercise_id,
                        "url": url,
                    }
                )
                continue
            if exercise_id not in inserted_exercises:
                summary["skipped_missing_media"].append(
                    {
                        "exercise_id": exercise_id,
                        "url": url,
                    }
                )
                continue
            cur.execute(
                "INSERT INTO sqlift.media "
                "(url, exercise_id, type) "
                "VALUES (%s, %s, %s) "
                "ON CONFLICT (url) DO UPDATE "
                "SET exercise_id = EXCLUDED.exercise_id, type = EXCLUDED.type",
                (url, exercise_id, media_type),
            )

    return summary


def import_wger(
    database_url=None,
    session=None,
    limit=None,
    max_pages=None,
    dry_run=False,
):
    dataset = fetch_dataset(session=session, limit=limit, max_pages=max_pages)
    if dry_run:
        return _build_summary(dataset)

    database_url = database_url or get_database_url()
    with psycopg.connect(database_url, sslmode="require") as conn:
        summary = write_dataset(conn, dataset)
        conn.commit()
    return summary


def build_parser():
    parser = argparse.ArgumentParser(description="Import wger data into Supabase.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch data and print a summary without writing to the database.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit the exerciseinfo fetch size for a smaller import.",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="Limit the number of pages fetched from each wger endpoint.",
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="Override DATABASE_URL for a one-off import run.",
    )
    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    summary = import_wger(
        database_url=args.database_url,
        limit=args.limit,
        max_pages=args.max_pages,
        dry_run=args.dry_run,
    )
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
