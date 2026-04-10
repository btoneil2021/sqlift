CREATE OR REPLACE VIEW vw_workout_history_summary AS 
    SELECT
        w.workout_id,
        COUNT(ws.workout_session_id) AS total_sessions,
        COUNT(ws.workout_session_id) FILTER (WHERE ws.completion_status = 'Completed') AS completed_sessions,
        COUNT(ws.workout_session_id) FILTER (WHERE ws.completion_status = 'In Progress') AS in_progress_sessions,
        MAX(ws.start_date_time) AS last_started_at,
        MAX(ws.end_date_time) FILTER (WHERE ws.completion_status = 'Completed') AS last_completed_at
    FROM workout w 
    LEFT JOIN workout_session ws
        ON w.workout_id = ws.workout_id
    GROUP BY w.workout_id;

CREATE OR REPLACE VIEW vw_record_log_summary AS
    SELECT
        rl.record_log_id AS record_log_id,
        rl.workout_session_id AS workout_session_id,
        e.exercise_id AS exercise_id,
        e.name AS exercise_name,
        rl.number AS record_log_number,
        rl.timestamp AS record_log_timestamp,
        rl.duration AS record_log_duration,
        COALESCE(COUNT(sl.set_log_id), 0) AS set_count
    FROM record_log rl
    LEFT JOIN set_log sl
        ON rl.record_log_id = sl.record_log_id
    LEFT JOIN exercise e
        ON rl.exercise_id = e.exercise_id
    GROUP BY rl.record_log_id, rl.workout_session_id, e.exercise_id, 
        e.name,rl.number, rl.timestamp, rl.duration;

CREATE OR REPLACE FUNCTION fn_compute_workout_primary_muscle_group(
    p_workout_id BIGINT
)
RETURNS TEXT
LANGUAGE sql
AS $$
    SELECT mg.name AS primary_muscle_group_name
    FROM workout_exercise we
    INNER JOIN exercise_muscle_group emg
        ON emg.exercise_id = we.exercise_id
    INNER JOIN muscle_group mg
        ON mg.muscle_id = emg.muscle_id
    WHERE we.workout_id = p_workout_id
        AND emg.role = 'Primary'
    GROUP BY mg.muscle_id, mg.name
    ORDER BY COUNT(emg.exercise_id) DESC, mg.muscle_id ASC
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_list_workout_tags()
RETURNS TABLE (
    tag_name TEXT,
    color_code TEXT
)
LANGUAGE sql
AS $$
    SELECT 
        wt.name AS tag_name, 
        wt.color_code AS color_code
    FROM workout_tag wt
    ORDER BY wt.name DESC
$$;

CREATE OR REPLACE FUNCTION fn_search_exercise_library(
    p_search_text TEXT DEFAULT NULL
)
RETURNS TABLE (
    exercise_id BIGINT,
    exercise_name TEXT
)
LANGUAGE sql
AS $$
    SELECT 
        e.exercise_id, 
        e.name AS exercise_name
    FROM exercise e
    WHERE
        p_search_text IS NULL
        OR btrim(p_search_text) = ''
        OR e.name ILIKE '%' || btrim(p_search_text) || '%'
    ORDER BY e.name DESC
$$;

CREATE OR REPLACE FUNCTION fn_get_workout_header(
    user_id BIGINT,
    workout_id BIGINT
)
RETURNS TABLE (
    workout_id BIGINT,
    workout_name TEXT,
    preferred_day TEXT,
    primary_muscle_group TEXT
)
LANGUAGE sql
AS $$
    SELECT
        w.workout_id,
        w.name AS workout_name,
        w.preferred_day,
        fn_compute_workout_primary_muscle_group(w.workout_id) AS primary_muscle_group
    FROM workout w
    WHERE w.user_id = user_id
        AND w.workout_id = workout_id
$$;

CREATE OR REPLACE FUNCTION fn_get_workout_tags(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
RETURNS TABLE (
    tag_name TEXT,
    color_code TEXT
)
LANGUAGE sql
AS $$
    SELECT
        wt.name AS tag_name,
        wt.color_code AS color_code
    FROM workout_tag wt
    INNER JOIN workout_tag_assignment wta
        ON wta.tag_name = wt.name
    INNER JOIN workout w
        ON wta.workout_id = w.workout_id
    WHERE w.user_id = p_user_id
        AND w.workout_id = p_workout_id
    ORDER BY wt.name DESC
$$;

CREATE OR REPLACE FUNCTION fn_get_workout_exercises(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
RETURNS TABLE (
    workout_exercise_sort_order INTEGER,
    exercise_id BIGINT,
    exercise_name TEXT,
    target_sets INTEGER,
    target_reps INTEGER,
    target_weight NUMERIC(8,2),
    expected_rest_time INTERVAL
)
LANGUAGE sql
AS $$
    SELECT
        we.sort_order AS workout_exercise_sort_order,
        we.exercise_id,
        e.name AS exercise_name,
        we.target_sets,
        we.target_reps,
        we.target_weight,
        we.expected_rest_time
    FROM workout_exercise we
    INNER JOIN workout w
        ON w.workout_id = we.workout_id
    INNER JOIN exercise e
        ON e.exercise_id = we.exercise_id
    WHERE w.user_id = p_user_id
        AND w.workout_id = p_workout_id
    ORDER BY we.sort_order DESC
$$;

CREATE OR REPLACE FUNCTION fn_get_workout_history(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
RETURNS TABLE (
    total_sessions BIGINT,
    completed_sessions BIGINT,
    in_progress_sessions BIGINT,
    last_started_at TIMESTAMP,
    last_completed_at TIMESTAMP,
    average_difficulty NUMERIC,
    average_enjoyment NUMERIC,
    average_energy_level NUMERIC
)
LANGUAGE sql
AS $$
    SELECT
        COALESCE(v.total_sessions, 0) AS total_sessions,
        COALESCE(v.completed_sessions, 0) AS completed_sessions,
        COALESCE(v.in_progress_sessions, 0) AS in_progress_sessions,
        v.last_started_at,
        v.last_completed_at,
        ROUND(AVG(ws.difficulty_rating), 1) AS average_difficulty,
        ROUND(AVG(ws.enjoyment_rating), 1) AS average_enjoyment,
        ROUND(AVG(ws.energy_level_rating), 1) AS average_energy_level
    FROM vw_workout_history_summary v
    LEFT JOIN workout w
        ON w.workout_id = v.workout_id
    LEFT JOIN workout_session ws
        ON ws.workout_id = w.workout_id
    WHERE w.user_id = p_user_id
        AND w.workout_id = p_workout_id
    GROUP BY
        v.total_sessions,
        v.completed_sessions,
        v.in_progress_sessions,
        v.last_started_at,
        v.last_completed_at
$$;

CREATE OR REPLACE FUNCTION fn_get_view_workout_payload(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
RETURNS JSONB
LANGUAGE sql
AS $$
    SELECT jsonb_build_object(
        'header',
        COALESCE(
            (SELECT to_jsonb(wh) FROM fn_get_workout_header(p_user_id, p_workout_id) wh),
            '{}'
        ),
        'tags',
        COALESCE(
            (SELECT jsonb_agg(to_jsonb(wt) ORDER BY wt.tag_name)
             FROM fn_get_workout_tags(p_user_id, p_workout_id) wt),
            '[]'
        ),
        'exercises',
        COALESCE(
            (SELECT jsonb_agg(to_jsonb(we) ORDER BY we.sort_order)
             FROM fn_get_workout_exercises(p_user_id, p_workout_id) we),
            '[]'
        ),
        'history',
        COALESCE(
            (SELECT to_jsonb(wh) FROM fn_get_workout_history(p_user_id, p_workout_id) wh),
            '{}'
        )
    )
    FROM workout w
    WHERE w.user_id = p_user_id
        AND w.workout_id = p_workout_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_get_new_workout_reference_data()
RETURNS JSONB
LANGUAGE sql
AS $$
    SELECT jsonb_build_object(
        'tags',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'tag_name', wt.name,
                        'color_code', wt.color_code
                    )
                    ORDER BY wt.name
                )
                FROM workout_tag wt
            ),
            '[]'
        ),
        'muscle_groups',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'muscle_id', mg.muscle_id,
                        'muscle_group_name', mg.name,
                        'description', mg.description
                    )
                    ORDER BY mg.name
                )
                FROM muscle_group mg
            ),
            '[]'
        ),
        'equipment',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'equipment_id', e.equipment_id,
                        'equipment_name', e.name,
                        'description', e.description
                    )
                    ORDER BY e.name
                )
                FROM equipment e
            ),
            '[]'
        )
    )
$$;

CREATE OR REPLACE FUNCTION fn_create_workout_full(
    p_user_id BIGINT,
    p_name TEXT,
    p_preferred_day TEXT,
    p_exercises_json JSONB,
    p_tags_json JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    return_workout_id BIGINT;
BEGIN
    INSERT INTO workout (user_id, name, preferred_day)
    VALUES (p_user_id, p_name, p_preferred_day)
    RETURNING workout_id INTO return_workout_id;

    INSERT INTO workout_exercise (workout_id, sort_order, exercise_id)
    SELECT return_workout_id, (e_json ->> 'sort_order')::INTEGER, (e_json ->> 'exercise_id')::BIGINT
    FROM jsonb_array_elements(p_exercises_json) e_json;

    INSERT INTO workout_tag_assignment (workout_id, tag_name)
    SELECT return_workout_id, wt_json ->> 'name'
    FROM jsonb_array_elements(p_tags_json) wt_json;

    RETURN return_workout_id;
END;
$$;