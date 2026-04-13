from wger_helper_functions import get_muscle_bucket_dict
from wger_helper_functions import get_translation_dict
from wger_helper_functions import new_summary
from wger_helper_functions import get_item_id


def insert_muscle_group_rows(cur, muscle_group_id_dict):
    for group_name, muscle_group_id in muscle_group_id_dict.items():
        cur.execute(
            "INSERT INTO sqlift.muscle_group "
            "(muscle_id, name, description) "
            "VALUES (%s, %s, %s) "
            "ON CONFLICT (muscle_id) DO UPDATE "
            "SET name = EXCLUDED.name, description = EXCLUDED.description",
            (muscle_group_id, group_name, None),
        )


def insert_equipment_rows(cur, equipment, summary):
    for equipment_item in equipment:
        equipment_id = equipment_item.get("id")
        if equipment_id is None:
            summary["skipped_missing_equipment"].append(equipment_item)
            continue

        cur.execute(
            "INSERT INTO sqlift.equipment "
            "(equipment_id, name, description) "
            "VALUES (%s, %s, %s) "
            "ON CONFLICT (equipment_id) DO UPDATE "
            "SET name = EXCLUDED.name, description = EXCLUDED.description",
            (equipment_id, equipment_item.get("name"), None),
        )


def insert_exercise_rows(cur, exercise_info_list, translation_dict, summary):
    inserted_exercise_ids = set()
    for exercise in exercise_info_list:
        exercise_id = exercise.get("id")
        if exercise_id is None:
            summary["skipped_missing_id"].append(exercise)
            continue

        translation = translation_dict.get(exercise_id)
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
        inserted_exercise_ids.add(exercise_id)

    return inserted_exercise_ids


def insert_primary_muscle_rows(cur, exercise_info_list, inserted_exercise_ids, muscle_bucket_dict, summary):
    seen_groups_by_exercise = {}
    for exercise in exercise_info_list:
        exercise_id = exercise.get("id")
        if exercise_id not in inserted_exercise_ids:
            continue

        seen_group_ids = set()
        seen_groups_by_exercise[exercise_id] = seen_group_ids

        for muscle_entry in exercise.get("muscles", []):
            muscle_id = get_item_id(muscle_entry)
            if muscle_id is None:
                summary["skipped_missing_muscle"].append(
                    {"exercise_id": exercise_id, "muscle_id": None}
                )
                continue

            muscle_group_id = muscle_bucket_dict.get(muscle_id)
            if muscle_group_id is None or muscle_group_id in seen_group_ids:
                continue

            cur.execute(
                "INSERT INTO sqlift.exercise_muscle_group "
                "(exercise_id, muscle_id, role) "
                "VALUES (%s, %s, %s) "
                "ON CONFLICT (exercise_id, muscle_id) DO UPDATE "
                "SET role = EXCLUDED.role",
                (exercise_id, muscle_group_id, "Primary"),
            )
            seen_group_ids.add(muscle_group_id)

    return seen_groups_by_exercise


def insert_secondary_muscle_rows(cur, exercise_info_list, inserted_exercise_ids, muscle_bucket_dict, seen_groups_by_exercise, summary):
    for exercise in exercise_info_list:
        exercise_id = exercise.get("id")
        if exercise_id not in inserted_exercise_ids:
            continue

        seen_group_ids = seen_groups_by_exercise.get(exercise_id, set())
        for muscle_entry in exercise.get("muscles_secondary", []):
            muscle_id = get_item_id(muscle_entry)
            if muscle_id is None:
                summary["skipped_missing_muscle"].append(
                    {"exercise_id": exercise_id, "muscle_id": None}
                )
                continue

            muscle_group_id = muscle_bucket_dict.get(muscle_id)
            if muscle_group_id is None or muscle_group_id in seen_group_ids:
                continue

            cur.execute(
                "INSERT INTO sqlift.exercise_muscle_group "
                "(exercise_id, muscle_id, role) "
                "VALUES (%s, %s, %s) "
                "ON CONFLICT (exercise_id, muscle_id) DO UPDATE "
                "SET role = EXCLUDED.role",
                (exercise_id, muscle_group_id, "Secondary"),
            )
            seen_group_ids.add(muscle_group_id)


def insert_exercise_equipment_rows(cur, exercise_info_list, inserted_exercise_ids, summary):
    for exercise in exercise_info_list:
        exercise_id = exercise.get("id")
        if exercise_id not in inserted_exercise_ids:
            continue

        for equipment_entry in exercise.get("equipment", []):
            equipment_id = get_item_id(equipment_entry)
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


def insert_media_rows(cur, media, inserted_exercise_ids, normalize_media_type, summary):
    for media_item in media:
        exercise_id = get_item_id(media_item.get("exercise"))
        if media_item.get("image") is not None:
            url = media_item.get("image")
        else:
            url = media_item.get("url")

        media_type = normalize_media_type(url)
        if exercise_id is None or url is None or media_type is None:
            summary["skipped_missing_media"].append(
                {
                    "exercise_id": exercise_id,
                    "url": url,
                }
            )
            continue

        if exercise_id not in inserted_exercise_ids:
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


def write_dataset(conn, dataset, muscle_group_id_dict, normalize_func, normalize_media_type_func):
    muscles = dataset.get("muscles", [])
    equipment = dataset.get("equipment", [])
    exercise_info_list = dataset.get("exerciseinfo", [])
    translations = dataset.get("translations", [])
    media = dataset.get("media", [])

    translation_dict = get_translation_dict(translations)
    muscle_bucket_dict = get_muscle_bucket_dict(muscles, muscle_group_id_dict, normalize_func)

    summary = new_summary()

    with conn.cursor() as cur:
        insert_muscle_group_rows(cur, muscle_group_id_dict)
        insert_equipment_rows(cur, equipment, summary)
        inserted_exercise_ids = insert_exercise_rows(cur, exercise_info_list, translation_dict, summary)
        
        seen_groups_by_exercise = insert_primary_muscle_rows(cur, exercise_info_list, inserted_exercise_ids, muscle_bucket_dict, summary)
        insert_secondary_muscle_rows(cur, exercise_info_list, inserted_exercise_ids, muscle_bucket_dict, seen_groups_by_exercise, summary)

        insert_exercise_equipment_rows(cur, exercise_info_list, inserted_exercise_ids, summary)
        insert_media_rows(cur, media, inserted_exercise_ids, normalize_media_type_func, summary)

    return summary
