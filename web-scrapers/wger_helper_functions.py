from urllib.parse import urljoin


MUSCLE_GROUPS = [
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


def get_bucket_id_dict():
    bucket_id_dict = {}
    for idx, name in enumerate(MUSCLE_GROUPS):
        bucket_id_dict[name] = idx + 1

    return bucket_id_dict


def get_item_id(value):
    if isinstance(value, dict):
        return value.get("id")

    return value


def new_summary():
    return {
        "skipped_missing_translation": [],
        "skipped_missing_id": [],
        "skipped_missing_muscle": [],
        "skipped_missing_equipment": [],
        "skipped_missing_media": [],
    }


def get_english_translation(exercise):
    translations = exercise.get("translations", [])
    for translation in translations:
        if translation.get("language") == 2:
            return translation

    if translations:
        return translations[0]

    return None


def get_translations_from_exerciseinfo(exercise_info_list):
    translations = []
    for exercise in exercise_info_list:
        exercise_id = exercise.get("id")
        if exercise_id is None:
            continue

        translation = get_english_translation(exercise)
        if translation:
            translations.append(translation)

    return translations


def get_media_from_exerciseinfo(exercise_info_list):
    media = []
    for exercise in exercise_info_list:
        exercise_id = exercise.get("id")
        if exercise.get("images") is None:
            images = []
        else:
            images = exercise.get("images")

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


def get_translation_dict(translations):
    translation_dict = {}
    for translation in translations:
        exercise_id = translation.get("exercise")

        if exercise_id is None or exercise_id in translation_dict:
            continue

        if translation.get("language") != 2:
            continue

        translation_dict[exercise_id] = translation

    return translation_dict


def get_muscle_bucket_dict(muscles, muscle_group_id_dict, normalize_func):
    muscle_group_dict = {}
    for muscle in muscles:
        if muscle.get("name_en"):
            raw_muscle_name = muscle.get("name_en")
        elif muscle.get("name"):
            raw_muscle_name = muscle.get("name")
        else:
            raw_muscle_name = ""

        muscle_group = normalize_func(raw_muscle_name)
        if muscle_group is None:
            continue

        muscle_group_id = muscle_group_id_dict.get(muscle_group)
        if muscle_group_id is None:
            continue

        muscle_group_dict[muscle.get("id")] = muscle_group_id

    return muscle_group_dict
