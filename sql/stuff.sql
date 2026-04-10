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
    ORDER BY wt.name ASC
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
    ORDER BY e.name ASC
$$;

CREATE OR REPLACE FUNCTION fn_get_workout_header(
    p_user_id BIGINT,
    p_workout_id BIGINT
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
    WHERE w.user_id = p_user_id
        AND w.workout_id = p_workout_id
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
    ORDER BY wt.name ASC
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
    ORDER BY we.sort_order ASC
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
$$;

CREATE OR REPLACE FUNCTION fn_get_new_workout_reference_data()
RETURNS JSONB
LANGUAGE sql
AS $$
    SELECT jsonb_build_object(
        -- Aggregates and builds a new array of objects for the workout tags.
        'tags',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'tag_name', wt.name,
                        'color_code', wt.color_code
                    )
                    ORDER BY wt.name ASC
                )
                FROM workout_tag wt
            ),
            '[]'
        ),
        -- Aggregates and builds a new array of objects for the muscle groups
        'muscle_groups',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'muscle_id', mg.muscle_id,
                        'muscle_group_name', mg.name,
                        'description', mg.description
                    )
                    ORDER BY mg.name ASC
                )
                FROM muscle_group mg
            ),
            '[]'
        ),
        -- Aggregates and builds a new array of objects for the equipment
        'equipment',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'equipment_id', e.equipment_id,
                        'equipment_name', e.name,
                        'description', e.description
                    )
                    ORDER BY e.name ASC
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
    -- Create the new workout
    INSERT INTO workout (user_id, name, preferred_day)
    VALUES (p_user_id, p_name, p_preferred_day)
    RETURNING workout_id INTO return_workout_id;

    -- Insert new workout_exercise rows where connects
    INSERT INTO workout_exercise (workout_id, sort_order, exercise_id)
    SELECT return_workout_id, (e_json ->> 'sort_order')::INTEGER, (e_json ->> 'exercise_id')::BIGINT
    FROM jsonb_array_elements(p_exercises_json) e_json;

    -- Insert new workout_tag_assignment rows where it connects
    INSERT INTO workout_tag_assignment (workout_id, tag_name)
    SELECT return_workout_id, wt_json ->> 'name'
    FROM jsonb_array_elements(p_tags_json) wt_json;

    -- Return new workout ID
    RETURN return_workout_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_update_workout_full(
    p_user_id BIGINT,
    p_workout_id BIGINT,
    p_name TEXT,
    p_preferred_day TEXT,
    p_exercises_json JSONB,
    p_tags_json JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update workout header that belongs to the provided user
    UPDATE workout
    SET
        name = btrim(p_name),
        preferred_day = NULLIF(btrim(p_preferred_day), '')
    WHERE workout_id = p_workout_id
        AND user_id = p_user_id;

    -- Delete existing workout_exercise rows for the workout
    DELETE FROM workout_exercise
    WHERE workout_id = p_workout_id;

    -- Insert new set of workout_exercise rows given the updated values for that workout
    INSERT INTO workout_exercise (
        workout_id,
        sort_order,
        exercise_id,
        target_sets,
        target_reps,
        target_weight,
        expected_rest_time
    )
    SELECT
        p_workout_id,
        (e_json ->> 'sort_order')::INTEGER,
        (e_json ->> 'exercise_id')::BIGINT,
        NULLIF(e_json ->> 'target_sets', '')::INTEGER,
        NULLIF(e_json ->> 'target_reps', '')::INTEGER,
        NULLIF(e_json ->> 'target_weight', '')::NUMERIC(8,2),
        NULLIF(e_json ->> 'expected_rest_time', '')::INTERVAL
    FROM jsonb_array_elements(COALESCE(p_exercises_json, '[]')) e_json
    ORDER BY (e_json ->> 'sort_order')::INTEGER ASC;

    -- Delete existing tag assignments from the old workout
    DELETE FROM workout_tag_assignment
    WHERE workout_id = p_workout_id;

    -- Add replacement tag assignments to the new workout
    INSERT INTO workout_tag_assignment (workout_id, tag_name)
    SELECT
        p_workout_id,
        p.tag_name
    FROM (
        SELECT DISTINCT
            wt_json ->> 'name' AS tag_name
        FROM jsonb_array_elements(COALESCE(p_tags_json, '[]')) wt_json
    ) p
    WHERE p.tag_name IS NOT NULL
        AND btrim(p.tag_name) <> ''
    ORDER BY p.tag_name ASC;

    -- Return the new workout ID
    RETURN p_workout_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_delete_workout(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
LANGUAGE sql
AS $$
    DELETE FROM workout
    WHERE workout_id = p_workout_id
        AND user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION fn_start_workout_session(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    return_new_session_id BIGINT;
BEGIN
    -- Get the latest in progress session id
    SELECT ws.workout_session_id
    INTO return_new_session_id
    FROM workout_session ws
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    WHERE w.user_id = p_user_id
        AND w.workout_id = p_workout_id
        AND ws.completion_status = 'In Progress'
    ORDER BY ws.start_date_time DESC
    LIMIT 1;

    IF return_new_session_id IS NOT NULL THEN
        RETURN return_new_session_id;
    END IF;

    -- If there isn't an in-progress session, make a new in-progress session
    INSERT INTO workout_session (
        workout_id,
        start_date_time,
        completion_status
    )
    VALUES (
        p_workout_id,
        NOW(),
        'In Progress'
    )
    RETURNING workout_session_id INTO return_new_session_id;

    RETURN return_new_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_get_in_progress_session_for_workout(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
RETURNS TABLE (
    workout_session_id BIGINT,
    start_date_time TIMESTAMP,
    end_date_time TIMESTAMP,
    completion_status workout_session_status
)
LANGUAGE sql
AS $$
    SELECT
        ws.workout_session_id,
        ws.start_date_time,
        ws.end_date_time,
        ws.completion_status
    FROM workout_session ws
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    WHERE w.user_id = p_user_id
        AND w.workout_id = p_workout_id
        AND ws.completion_status = 'In Progress'
    ORDER BY ws.start_date_time DESC
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION fn_get_tracking_payload(
    p_user_id BIGINT,
    p_workout_session_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    return_json JSONB;
BEGIN
    -- Build session object
    SELECT jsonb_build_object(
        'session',
        jsonb_build_object(
            'workout_session_id', ws.workout_session_id,
            'workout_id', w.workout_id,
            'workout_name', w.name,
            'start_date_time', ws.start_date_time,
            'end_date_time', ws.end_date_time,
            'notes', ws.notes,
            'completion_status', ws.completion_status,
            'difficulty_rating', ws.difficulty_rating,
            'enjoyment_rating', ws.enjoyment_rating,
            'energy_level_rating', ws.energy_level_rating
        ),
        -- Build exercises array
        'planned_exercises',
        COALESCE(
            (
                SELECT jsonb_agg(to_jsonb(pe) ORDER BY pe.sort_order)
                FROM fn_get_workout_exercises(p_user_id, w.workout_id) pe
            ),
            '[]'
        ),
        -- Build record_log array
        'records',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'record_log_id', rls.record_log_id,
                        'exercise_id', rls.exercise_id,
                        'exercise_name', rls.exercise_name,
                        'number', rls.number,
                        'timestamp', rls."timestamp",
                        'duration', rls.duration,
                        'set_count', rls.set_count,
                        -- Build set_log array
                        'sets',
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'set_log_id', sl.set_log_id,
                                        'number', sl.number,
                                        'type', sl.type,
                                        'weight', sl.weight,
                                        'reps', sl.reps,
                                        'rpe', sl.rpe,
                                        'rest_time', sl.rest_time
                                    )
                                    ORDER BY sl.number ASC
                                )
                                FROM set_log sl
                                WHERE sl.record_log_id = rls.record_log_id
                            ),
                            '[]'
                        )
                    )
                    ORDER BY rls.number ASC
                )
                FROM vw_record_log_summary rls
                WHERE rls.workout_session_id = ws.workout_session_id
            ),
            '[]'
        )
    )
    INTO return_json
    FROM workout_session ws
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    WHERE ws.workout_session_id = p_workout_session_id
        AND w.user_id = p_user_id;

    RETURN return_json;
END;
$$;

CREATE OR REPLACE FUNCTION fn_add_record_log(
    p_user_id BIGINT,
    p_workout_session_id BIGINT,
    p_exercise_id BIGINT
)
RETURNS TABLE (
    record_log_id BIGINT,
    assigned_number INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
    v_next_number INTEGER;
    v_record_log_id BIGINT;
BEGIN
    -- Get the next available record_log number given the workout_session
    SELECT COALESCE(MAX(rl.number), 0) + 1
    INTO v_next_number
    FROM record_log rl
    INNER JOIN workout_session ws
        ON ws.workout_session_id = rl.workout_session_id
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    WHERE rl.workout_session_id = p_workout_session_id
        and w.user_id = p_user_id;

    -- Insert the new record_log in
    INSERT INTO record_log (
        workout_session_id,
        exercise_id,
        number,
        "timestamp"
    )
    VALUES (
        p_workout_session_id,
        p_exercise_id,
        v_next_number,
        NOW()
    )
    RETURNING record_log.record_log_id INTO v_record_log_id;

    -- Returns the record log ID and the number it is stored in
    RETURN QUERY
    SELECT v_record_log_id, v_next_number;
END;
$$;