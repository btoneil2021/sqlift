import argparse
import json
import os
import sys
import psycopg
from dotenv import load_dotenv
import wger_fetch
import wger_data_cleaning
from wger_helper_functions import get_bucket_id_dict
from wger_helper_functions import get_media_from_exerciseinfo
from wger_helper_functions import get_translations_from_exerciseinfo
from wger_data_validation import check_dataset
from db_inserts import write_dataset

load_dotenv()


def _strip_env_quotes(value):
    if value is None:
        return None

    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        without_quotes = value[1:len(value) - 1]
        return without_quotes

    return value


def get_database_url():
    url = _strip_env_quotes(os.getenv("DATABASE_URL"))
    if not url:
        raise RuntimeError("Missing DATABASE_URL for importer.")

    if "[YOUR-PASSWORD]" in url:
        password = _strip_env_quotes(os.getenv("DATABASE_PASSWORD"))
        if not password:
            raise RuntimeError(
                "DATABASE_URL contains [YOUR-PASSWORD] placeholder, but "
                "DATABASE_PASSWORD environment variable is not set."
            )
        url = url.replace("[YOUR-PASSWORD]", password)

    return url


def get_dataset(session=None, limit=None, max_pages=None):
    params = {}
    if limit is not None:
        params["limit"] = limit

    if not params:
        params = None

    exercise_info_list = wger_fetch.get_all_pages(
        session,
        wger_fetch.WGER_BASE_URL + "/exerciseinfo/",
        params=params,
        max_pages=max_pages,
    )

    muscles = wger_fetch.get_all_pages(
        session,
        wger_fetch.WGER_BASE_URL + "/muscle/",
        params=None,
        max_pages=max_pages,
    )

    equipment = wger_fetch.get_all_pages(
        session,
        wger_fetch.WGER_BASE_URL + "/equipment/",
        params=None,
        max_pages=max_pages,
    )

    translations = get_translations_from_exerciseinfo(exercise_info_list)
    media = get_media_from_exerciseinfo(exercise_info_list)

    return {
        "exerciseinfo": exercise_info_list,
        "translations": translations,
        "muscles": muscles,
        "equipment": equipment,
        "media": media,
    }


def import_wger(
    database_url=None,
    session=None,
    limit=None,
    max_pages=None,
    dry_run=False,
):
    dataset = get_dataset(session=session, limit=limit, max_pages=max_pages)
    muscle_group_id_dict = get_bucket_id_dict()
    normalize = wger_data_cleaning.normalize_muscle_group

    if dry_run:
        return check_dataset(dataset, muscle_group_id_dict, normalize)

    if database_url is None:
        database_url = get_database_url()

    normalize_media_type = wger_data_cleaning.normalize_media_type
    with psycopg.connect(database_url, sslmode="require") as conn:
        summary = write_dataset(conn, dataset, muscle_group_id_dict, normalize, normalize_media_type)
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
    sys.exit(main())
