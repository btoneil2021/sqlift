-- Returns a JSON array of all workouts owned by the given user,
-- including tags, primary muscle group, and session summary counts.
CREATE OR REPLACE FUNCTION fn_list_user_workouts(
    p_user_id BIGINT
)
RETURNS JSONB
LANGUAGE sql
SET search_path = sqlift
AS $$
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'workout_id',           w.workout_id,
                'name',                 w.name,
                'preferred_day',        w.preferred_day,
                'primary_muscle_group', fn_compute_workout_primary_muscle_group(w.workout_id),
                'tags', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'tag_name',   wt.name,
                                'color_code', wt.color_code
                            )
                            ORDER BY wt.name ASC
                        )
                        FROM workout_tag_assignment wta
                        INNER JOIN workout_tag wt ON wt.name = wta.tag_name
                        WHERE wta.workout_id = w.workout_id
                    ),
                    '[]'::JSONB
                ),
                'total_sessions',  COALESCE(v.total_sessions, 0),
                'last_started_at', v.last_started_at
            )
            ORDER BY w.name ASC
        ),
        '[]'::JSONB
    )
    FROM workout w
    LEFT JOIN vw_workout_history_summary v ON v.workout_id = w.workout_id
    WHERE w.user_id = p_user_id;
$$;