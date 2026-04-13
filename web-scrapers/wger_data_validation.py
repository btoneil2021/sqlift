from wger_helper_functions import get_muscle_bucket_dict
from wger_helper_functions import get_translation_dict
from wger_helper_functions import new_summary
from wger_helper_functions import get_item_id


def check_exercises(exercise_info_list, translation_dict, summary):
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

        inserted_exercise_ids.add(exercise_id)

    return inserted_exercise_ids


def check_primary_muscles(exercise_info_list, inserted_exercise_ids, muscle_bucket_dict, summary):
    for exercise in exercise_info_list:
        exercise_id = exercise.get("id")
        if exercise_id not in inserted_exercise_ids:
            continue

        for muscle_entry in exercise.get("muscles", []):
            muscle_id = get_item_id(muscle_entry)
            if muscle_id is None:
                summary["skipped_missing_muscle"].append(
                    {"exercise_id": exercise_id, "muscle_id": None}
                )
                continue

            if muscle_bucket_dict.get(muscle_id) is None:
                summary["skipped_missing_muscle"].append(
                    {"exercise_id": exercise_id, "muscle_id": muscle_id}
                )


def check_secondary_muscles(exercise_info_list, inserted_exercise_ids, muscle_bucket_dict, summary):
    for exercise in exercise_info_list:
        exercise_id = exercise.get("id")
        if exercise_id not in inserted_exercise_ids:
            continue

        for muscle_entry in exercise.get("muscles_secondary", []):
            muscle_id = get_item_id(muscle_entry)
            if muscle_id is None:
                summary["skipped_missing_muscle"].append(
                    {"exercise_id": exercise_id, "muscle_id": None}
                )
                continue

            if muscle_bucket_dict.get(muscle_id) is None:
                summary["skipped_missing_muscle"].append(
                    {"exercise_id": exercise_id, "muscle_id": muscle_id}
                )


def check_equipment(exercise_info_list, inserted_exercise_ids, summary):
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


def check_media(media, inserted_exercise_ids, summary):
    for media_item in media:
        exercise_id = get_item_id(media_item.get("exercise"))
        if media_item.get("image") is not None:
            url = media_item.get("image")
        else:
            url = media_item.get("url")

        if exercise_id is None or url is None:
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


def check_dataset(dataset, muscle_group_id_dict, normalize_func):
    muscles = dataset.get("muscles", [])
    exercise_info_list = dataset.get("exerciseinfo", [])
    translations = dataset.get("translations", [])
    media = dataset.get("media", [])

    translation_dict = get_translation_dict(translations)
    muscle_bucket_dict = get_muscle_bucket_dict(muscles, muscle_group_id_dict, normalize_func)

    summary = new_summary()
    inserted_exercise_ids = check_exercises(exercise_info_list, translation_dict, summary)
    check_primary_muscles(exercise_info_list, inserted_exercise_ids, muscle_bucket_dict, summary)
    check_secondary_muscles(exercise_info_list, inserted_exercise_ids, muscle_bucket_dict, summary)
    check_equipment(exercise_info_list, inserted_exercise_ids, summary)
    check_media(media, inserted_exercise_ids, summary)

    return summary
