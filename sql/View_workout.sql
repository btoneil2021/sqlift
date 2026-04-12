-- Returns a JSON array of all workouts owned by the given user,
-- including tags, primary muscle group, and session summary counts.
CREATE OR REPLACE FUNCTION sqlift.fn_list_user_workouts(
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

-- Returns a single exercise by ID with description, muscle groups, and equipment.
CREATE OR REPLACE FUNCTION sqlift.fn_get_exercise_by_id(
    p_exercise_id BIGINT
)
RETURNS JSONB
LANGUAGE sql
SET search_path = sqlift
AS $$
    SELECT jsonb_build_object(
        'exercise_id',   e.exercise_id,
        'name',          e.name,
        'description',   e.description,
        'instruction',   e.instruction,
        'is_unilateral', e.is_unilateral,
        'muscle_groups', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object('name', mg.name, 'role', emg.role)
                    ORDER BY emg.role ASC, mg.name ASC
                )
                FROM exercise_muscle_group emg
                INNER JOIN muscle_group mg ON mg.muscle_id = emg.muscle_id
                WHERE emg.exercise_id = e.exercise_id
            ),
            '[]'::JSONB
        ),
        'equipment', COALESCE(
            (
                SELECT jsonb_agg(eq.name ORDER BY eq.name ASC)
                FROM exercise_equipment ee
                INNER JOIN equipment eq ON eq.equipment_id = ee.equipment_id
                WHERE ee.exercise_id = e.exercise_id
            ),
            '[]'::JSONB
        ),
        'media', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object('url', m.url, 'type', m.type)
                    ORDER BY m.url ASC
                )
                FROM media m
                WHERE m.exercise_id = e.exercise_id
            ),
            '[]'::JSONB
        )
    )
    FROM exercise e
    WHERE e.exercise_id = p_exercise_id;
$$;

-- Returns all exercises with description, muscle groups, and equipment for the library.
CREATE OR REPLACE FUNCTION sqlift.fn_get_exercise_library()
RETURNS JSONB
LANGUAGE sql
SET search_path = sqlift
AS $$
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'exercise_id',   e.exercise_id,
                'name',          e.name,
                'description',   e.description,
                'is_unilateral', e.is_unilateral,
                'muscle_groups', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'name', mg.name,
                                'role', emg.role
                            )
                            ORDER BY emg.role ASC, mg.name ASC
                        )
                        FROM exercise_muscle_group emg
                        INNER JOIN muscle_group mg ON mg.muscle_id = emg.muscle_id
                        WHERE emg.exercise_id = e.exercise_id
                    ),
                    '[]'::JSONB
                ),
                'equipment', COALESCE(
                    (
                        SELECT jsonb_agg(eq.name ORDER BY eq.name ASC)
                        FROM exercise_equipment ee
                        INNER JOIN equipment eq ON eq.equipment_id = ee.equipment_id
                        WHERE ee.exercise_id = e.exercise_id
                    ),
                    '[]'::JSONB
                )
            )
            ORDER BY e.name ASC
        ),
        '[]'::JSONB
    )
    FROM exercise e;
$$;