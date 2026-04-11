-- Aggregate workout session history.
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

-- Derive set count from record log, making it easier to do operations
CREATE OR REPLACE VIEW vw_record_log_summary AS
    SELECT
        rl.record_log_id,
        rl.workout_session_id,
        e.exercise_id,
        e.name AS exercise_name,
        rl.number,
        rl.timestamp,
        rl.duration,
        COUNT(sl.set_log_id) AS set_count
    FROM record_log rl
    LEFT JOIN set_log sl
        ON rl.record_log_id = sl.record_log_id
    LEFT JOIN exercise e
        ON rl.exercise_id = e.exercise_id
    GROUP BY 
        rl.record_log_id, 
        rl.workout_session_id, 
        e.exercise_id, 
        e.name,
        rl.number, 
        rl."timestamp", 
        rl.duration;

-- Return the top primary muscle group for the provided workout.
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

-- Return the available workout tags in alphabetical order.
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

-- Return the matching exercise library rows for the provided search text.
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
    WHERE p_search_text IS NULL
        OR btrim(p_search_text) = ''
        OR e.name ILIKE '%' || btrim(p_search_text) || '%'
    ORDER BY e.name ASC
$$;

-- Return the header-level fields for the requested workout.
CREATE OR REPLACE FUNCTION fn_get_workout_header(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
RETURNS TABLE (
    workout_id BIGINT,
    name TEXT,
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

-- Return the tags for the requested workout.
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

-- Return the planned exercises for the requested workout in sort order.
CREATE OR REPLACE FUNCTION fn_get_workout_exercises(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
RETURNS TABLE (
    sort_order INTEGER,
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
        we.sort_order AS sort_order,
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

-- Return grouped workout history for the requested workout.
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
        -- Build workout header object
        'header',
        COALESCE(
            (SELECT to_jsonb(whe) FROM fn_get_workout_header(p_user_id, p_workout_id) whe),
            '{}'::JSONB
        ),
        -- Build tags array.
        'tags',
        COALESCE(
            (SELECT jsonb_agg(to_jsonb(wt) ORDER BY wt.tag_name)
             FROM fn_get_workout_tags(p_user_id, p_workout_id) wt),
            '[]'::JSONB
        ),
        -- Build planned exercise array
        'exercises',
        COALESCE(
            (SELECT jsonb_agg(to_jsonb(we) ORDER BY we.sort_order)
             FROM fn_get_workout_exercises(p_user_id, p_workout_id) we),
            '[]'::JSONB
        ),
        -- Build workout history object
        'history',
        COALESCE(
            (SELECT to_jsonb(whi) FROM fn_get_workout_history(p_user_id, p_workout_id) whi),
            '{}'::JSONB
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
                        'name', wt.name,
                        'color_code', wt.color_code
                    )
                    ORDER BY wt.name ASC
                )
                FROM workout_tag wt
            ),
            '[]'::JSONB
        ),
        -- Aggregates and builds a new array of objects for the muscle groups
        'muscle_groups',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'muscle_id', mg.muscle_id,
                        'name', mg.name,
                        'description', mg.description
                    )
                    ORDER BY mg.name ASC
                )
                FROM muscle_group mg
            ),
            '[]'::JSONB
        ),
        -- Aggregates and builds a new array of objects for the equipment
        'equipment',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'equipment_id', e.equipment_id,
                        'name', e.name,
                        'description', e.description
                    )
                    ORDER BY e.name ASC
                )
                FROM equipment e
            ),
            '[]'::JSONB
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
    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION 'Workout name is required';
    END IF;

    IF jsonb_typeof(COALESCE(p_exercises_json, '[]'::JSONB)) <> 'array' THEN
        RAISE EXCEPTION 'p_exercises_json must be a JSON array';
    END IF;

    IF jsonb_typeof(COALESCE(p_tags_json, '[]'::JSONB)) <> 'array' THEN
        RAISE EXCEPTION 'p_tags_json must be a JSON array';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM "user" u
        WHERE u.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'User % does not exist', p_user_id;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM workout w
        WHERE w.user_id = p_user_id
            AND w.name = btrim(p_name)
    ) THEN
        RAISE EXCEPTION 'Workout name already exists for this user';
    END IF;

    -- Check and make sure that two exercises do not have the same sort_order.
    IF EXISTS (
        WITH json_output AS (
            SELECT (e_json ->> 'sort_order')::INTEGER AS sort_order
            FROM jsonb_array_elements(COALESCE(p_exercises_json, '[]'::JSONB)) e_json
        )
        SELECT 1
        FROM json_output
        GROUP BY sort_order
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate sort_order values are not allowed';
    END IF;

    -- Check and make sure that exercise JSONB exists and has at least one element.
    IF EXISTS (
        WITH json_output1 AS (
            SELECT DISTINCT (e_json ->> 'exercise_id')::BIGINT AS exercise_id
            FROM jsonb_array_elements(COALESCE(p_exercises_json, '[]'::JSONB)) e_json
        )
        SELECT 1
        FROM json_output1 jo1
        LEFT JOIN exercise e
            ON e.exercise_id = jo1.exercise_id
        WHERE e.exercise_id IS NULL
    ) THEN
        RAISE EXCEPTION 'One or more exercise_id values do not exist';
    END IF;

    -- Check and make sure that the tag names given actually exist
    IF EXISTS (
        WITH json_output2 AS (
            SELECT DISTINCT (t_json ->> 'name') AS tag_name
            FROM jsonb_array_elements(COALESCE(p_tags_json, '[]'::jsonb)) t_json
        )
        SELECT 1
        FROM json_output2 jo2
        LEFT JOIN workout_tag wt
            ON wt.name = jo2.tag_name
        WHERE jo2.tag_name IS NOT NULL
            AND btrim(jo2.tag_name) <> ''
            AND wt.name IS NULL
    ) THEN
        RAISE EXCEPTION 'One or more tag names do not exist';
    END IF;

    -- Create the new workout
    INSERT INTO workout (user_id, name, preferred_day)
    VALUES (p_user_id, btrim(p_name), NULLIF(btrim(p_preferred_day), ''))
    RETURNING workout_id INTO return_workout_id;

    -- Insert new workout_exercise rows where connects
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
        return_workout_id, 
        (e_json ->> 'sort_order')::INTEGER, 
        (e_json ->> 'exercise_id')::BIGINT,
        NULLIF(e_json ->> 'target_sets', '')::INTEGER,
        NULLIF(e_json ->> 'target_reps', '')::INTEGER,
        NULLIF(e_json ->> 'target_weight', '')::NUMERIC(8,2),
        NULLIF(e_json ->> 'expected_rest_time', '')::INTERVAL
    FROM jsonb_array_elements(COALESCE(p_exercises_json, '[]'::JSONB)) e_json
    ORDER BY (e_json ->> 'sort_order')::INTEGER;

    -- Insert new workout_tag_assignment rows where it connects
    INSERT INTO workout_tag_assignment (workout_id, tag_name)
    SELECT return_workout_id, wt.tag_name
    FROM (
        SELECT DISTINCT (wt_json ->> 'name') AS tag_name
        FROM jsonb_array_elements(COALESCE(p_tags_json, '[]'::JSONB)) wt_json
    ) wt
    WHERE wt.tag_name IS NOT NULL
        AND btrim(wt.tag_name) <> '';

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
    IF NOT EXISTS (
        SELECT 1
        FROM workout w
        WHERE w.workout_id = p_workout_id
            AND w.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Workout % not found for user %', p_workout_id, p_user_id;
    END IF;

    -- Check and make sure that exercise JSONB exists and has at least one element.
    IF EXISTS (
        WITH json_output AS (
            SELECT DISTINCT (e_json ->> 'exercise_id')::BIGINT AS exercise_id
            FROM jsonb_array_elements(COALESCE(p_exercises_json, '[]'::JSONB)) e_json
        )
        SELECT 1
        FROM json_output jo
        LEFT JOIN exercise e
            ON e.exercise_id = jo.exercise_id
        WHERE e.exercise_id IS NULL
    ) THEN
        RAISE EXCEPTION 'One or more exercise_id values do not exist';
    END IF;

    -- Check and make sure that the tag names given actually exist
    IF EXISTS (
        WITH json_output1 AS (
            SELECT DISTINCT (t_json ->> 'name') AS tag_name
            FROM jsonb_array_elements(COALESCE(p_tags_json, '[]'::jsonb)) t_json
        )
        SELECT 1
        FROM json_output1 jo1
        LEFT JOIN workout_tag wt
            ON wt.name = jo1.tag_name
        WHERE jo1.tag_name IS NOT NULL
            AND btrim(jo1.tag_name) <> ''
            AND wt.name IS NULL
    ) THEN
        RAISE EXCEPTION 'One or more tag names do not exist';
    END IF;

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
    FROM jsonb_array_elements(COALESCE(p_exercises_json, '[]'::JSONB)) e_json
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
        FROM jsonb_array_elements(COALESCE(p_tags_json, '[]'::JSONB)) wt_json
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
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM workout w
        WHERE w.workout_id = p_workout_id
            AND w.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Workout % not found for user %', p_workout_id, p_user_id;
    END IF;

    -- If there's an in-progress session for the workout, prevent the delete
    IF EXISTS (
        SELECT 1
        FROM workout_session ws
        INNER JOIN workout w
            ON w.workout_id = ws.workout_id
        WHERE w.workout_id = p_workout_id
            AND w.user_id = p_user_id
            AND ws.completion_status = 'In Progress'
    ) THEN
        RAISE EXCEPTION 'Cannot delete a workout with an in-progress session';
    END IF;

    -- Deletes...
    DELETE FROM workout
    WHERE workout_id = p_workout_id
        AND user_id = p_user_id;

    RETURN TRUE;
END;
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
    IF NOT EXISTS (
        SELECT 1
        FROM workout w
        WHERE w.workout_id = p_workout_id
            AND w.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Workout % not found for user %', p_workout_id, p_user_id;
    END IF;

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

-- Returns the most recent in-progress session for the requested workout.
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
            '[]'::JSONB
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
                            '[]'::JSONB
                        )
                    )
                    ORDER BY rls.number ASC
                )
                FROM vw_record_log_summary rls
                WHERE rls.workout_session_id = ws.workout_session_id
            ),
            '[]'::JSONB
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
    return_next_number INTEGER;
    return_record_log_id BIGINT;
BEGIN
    -- Lock and confirm proper existence of parent workout_session for the record_log
    -- before inserting.
    SELECT ws.completion_status::TEXT
    INTO v_status
    FROM workout_session ws
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    WHERE ws.workout_session_id = p_workout_session_id
        AND w.user_id = p_user_id
    FOR UPDATE OF ws;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Workout session % not found for user %', p_workout_session_id, p_user_id;
    END IF;

    IF v_status <> 'In Progress' THEN
        RAISE EXCEPTION 'Cannot add a record log to a session that is not In Progress';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM exercise e
        WHERE e.exercise_id = p_exercise_id
    ) THEN
        RAISE EXCEPTION 'Exercise % does not exist', p_exercise_id;
    END IF;

    -- Get the next available record_log number given the workout_session
    SELECT COALESCE(MAX(rl.number), 0) + 1
    INTO return_next_number
    FROM record_log rl
    WHERE rl.workout_session_id = p_workout_session_id;

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
        return_next_number,
        NOW()
    )
    RETURNING record_log.record_log_id INTO return_record_log_id;

    -- Returns the record log ID and the number it is stored in
    RETURN QUERY
    SELECT return_record_log_id, return_next_number;
END;
$$;

CREATE OR REPLACE FUNCTION fn_delete_record_log(
    p_user_id BIGINT,
    p_record_log_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_workout_session_id BIGINT;
    v_old_number INTEGER;
    v_status TEXT;
BEGIN
    -- Get parent workout_session, current record number, and session status.
    SELECT
        rl.workout_session_id,
        rl.number,
        ws.completion_status::TEXT
    INTO
        v_workout_session_id,
        v_old_number,
        v_status
    FROM record_log rl
    INNER JOIN workout_session ws
        ON ws.workout_session_id = rl.workout_session_id
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    WHERE rl.record_log_id = p_record_log_id
        AND w.user_id = p_user_id
    FOR UPDATE OF rl;

    IF v_workout_session_id IS NULL THEN
        RAISE EXCEPTION 'Record log % not found for user %', p_record_log_id, p_user_id;
    END IF;

    IF v_status <> 'In Progress' THEN
        RAISE EXCEPTION 'Cannot delete a record log from a session that is not In Progress';
    END IF;

    DELETE FROM record_log
    WHERE record_log_id = p_record_log_id;

    -- Update all other record_log rows in the same session to fill the gap
    -- from deleting the current one (this and future delete).
    UPDATE record_log
    SET number = number - 1
    WHERE workout_session_id = v_workout_session_id
        AND number > v_old_number;

    RETURN TRUE;
END;
$$;


CREATE OR REPLACE FUNCTION fn_add_set_log(
    p_user_id BIGINT,
    p_record_log_id BIGINT,
    p_type set_type,
    p_weight NUMERIC(8,2),
    p_reps INTEGER,
    p_rpe NUMERIC(3,1),
    p_rest_time INTERVAL
)
RETURNS TABLE (
    set_log_id BIGINT,
    assigned_number INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
    return_next_number INTEGER;
    return_set_log_id BIGINT;
BEGIN
    -- Lock and validate parent record_log before inserting new set
    SELECT ws.completion_status
    INTO v_status
    FROM workout_session ws
    INNER JOIN record_log rl
        ON rl.workout_session_id = ws.workout_session_id
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    WHERE rl.record_log_id = p_record_log_id
        AND w.user_id = p_user_id
    FOR UPDATE OF rl;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Record log % not found for user %', p_record_log_id, p_user_id;
    END IF;

    IF v_status <> 'In Progress' THEN
        RAISE EXCEPTION 'Cannot add a set to a session that is not In Progress';
    END IF;

    -- Get next available set_log number for the given parent record_log
    SELECT COALESCE(MAX(sl.number), 0) + 1
    INTO return_next_number
    FROM set_log sl
    WHERE sl.record_log_id = p_record_log_id;

    INSERT INTO set_log (
        record_log_id,
        number,
        type,
        weight,
        reps,
        rpe,
        rest_time
    )
    VALUES (
        p_record_log_id,
        return_next_number,
        p_type,
        p_weight,
        p_reps,
        p_rpe,
        p_rest_time
    )
    RETURNING set_log.set_log_id INTO return_set_log_id;

    RETURN QUERY
    SELECT return_set_log_id, return_next_number;
END;
$$;

CREATE OR REPLACE FUNCTION fn_update_set_log(
    p_user_id BIGINT,
    p_set_log_id BIGINT,
    p_type set_type,
    p_weight NUMERIC(8,2),
    p_reps INTEGER,
    p_rpe NUMERIC(3,1),
    p_rest_time INTERVAL
)
RETURNS TABLE (
    set_log_id BIGINT,
    record_log_id BIGINT,
    number INTEGER,
    type set_type,
    weight NUMERIC(8,2),
    reps INTEGER,
    rpe NUMERIC(3,1),
    rest_time INTERVAL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
BEGIN
    -- Lock and confirm existence of set_log before updating.
    SELECT ws.completion_status::TEXT
    INTO v_status
    FROM workout_session ws
    INNER JOIN record_log rl
        ON rl.workout_session_id = ws.workout_session_id
    INNER JOIN set_log sl
        ON sl.record_log_id = rl.record_log_id
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    WHERE sl.set_log_id = p_set_log_id
        AND w.user_id = p_user_id
    FOR UPDATE OF sl;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Set log % not found for user %', p_set_log_id, p_user_id;
    END IF;

    IF v_status <> 'In Progress' THEN
        RAISE EXCEPTION 'Cannot update a set in a session that is not In Progress';
    END IF;

    -- Update all editable fields and return the new row info
    RETURN QUERY
    UPDATE set_log sl
    SET
        type = p_type,
        weight = p_weight,
        reps = p_reps,
        rpe = p_rpe,
        rest_time = p_rest_time
    WHERE sl.set_log_id = p_set_log_id
    RETURNING
        sl.set_log_id,
        sl.record_log_id,
        sl.number,
        sl.type,
        sl.weight,
        sl.reps,
        sl.rpe,
        sl.rest_time;
END;
$$;

CREATE OR REPLACE FUNCTION fn_delete_set_log(
    p_user_id BIGINT,
    p_set_log_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_record_log_id BIGINT;
    v_old_number INTEGER;
    v_status TEXT;
BEGIN
    -- Lock set log to delete, get parent record_log, the current set num,
    -- and the workout_session completion status
    SELECT
        sl.record_log_id,
        sl.number,
        ws.completion_status::TEXT
    INTO
        v_record_log_id,
        v_old_number,
        v_status
    FROM set_log sl
    INNER JOIN record_log rl
        ON rl.record_log_id = sl.record_log_id
    INNER JOIN workout_session ws
        ON ws.workout_session_id = rl.workout_session_id
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    WHERE sl.set_log_id = p_set_log_id
        AND w.user_id = p_user_id
    FOR UPDATE OF sl;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Set log % not found for user %', p_set_log_id, p_user_id;
    END IF;

    IF v_status <> 'In Progress' THEN
        RAISE EXCEPTION 'Cannot delete a set from a session that is not In Progress';
    END IF;

    DELETE FROM set_log
    WHERE set_log_id = p_set_log_id;

    -- Close numbering gap for remaining set_log instances in the same record_log
    UPDATE set_log
    SET number = number - 1
    WHERE record_log_id = v_record_log_id
        AND number > v_old_number;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION fn_finish_workout_session(
    p_user_id BIGINT,
    p_workout_session_id BIGINT,
    p_notes TEXT,
    p_difficulty_rating INTEGER,
    p_enjoyment_rating INTEGER,
    p_energy_level_rating INTEGER
)
RETURNS TABLE (
    workout_session_id BIGINT,
    workout_id BIGINT,
    start_date_time TIMESTAMP,
    end_date_time TIMESTAMP,
    notes TEXT,
    completion_status workout_session_status,
    difficulty_rating INTEGER,
    enjoyment_rating INTEGER,
    energy_level_rating INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
BEGIN
    -- Lock the workout_session and check it
    SELECT ws.completion_status::TEXT
    INTO v_status
    FROM workout_session ws
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    WHERE ws.workout_session_id = p_workout_session_id
        AND w.user_id = p_user_id
    FOR UPDATE OF ws;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Workout session % not found for user %', p_workout_session_id, p_user_id;
    END IF;

    IF v_status <> 'In Progress' THEN
        RAISE EXCEPTION 'Only In Progress sessions can be finished';
    END IF;

    -- Update the workout session so it's completed and return the row data
    RETURN QUERY
    UPDATE workout_session ws
    SET
        end_date_time = NOW(),
        notes = p_notes,
        completion_status = 'Completed',
        difficulty_rating = p_difficulty_rating,
        enjoyment_rating = p_enjoyment_rating,
        energy_level_rating = p_energy_level_rating
    WHERE ws.workout_session_id = p_workout_session_id
    RETURNING
        ws.workout_session_id,
        ws.workout_id,
        ws.start_date_time,
        ws.end_date_time,
        ws.notes,
        ws.completion_status,
        ws.difficulty_rating,
        ws.enjoyment_rating,
        ws.energy_level_rating;
END;
$$;

CREATE OR REPLACE FUNCTION fn_fetch_session_state(
    p_user_id BIGINT,
    p_workout_session_id BIGINT
)
RETURNS JSONB
LANGUAGE sql
AS $$
    SELECT fn_get_tracking_payload(p_user_id, p_workout_session_id)
$$;

CREATE OR REPLACE FUNCTION trg_block_finalized_session_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
    v_record_log_id BIGINT;
    v_workout_session_id BIGINT;
BEGIN
    -- If the table is record_log, then the session ID is contained there, no join required.
    IF TG_TABLE_NAME = 'record_log' THEN
        v_workout_session_id := COALESCE(NEW.workout_session_id, OLD.workout_session_id);

        SELECT ws.completion_status::TEXT
        INTO v_status
        FROM workout_session ws
        WHERE ws.workout_session_id = v_workout_session_id;

    -- If the table is set_log, we have to join record_log in order to get the session ID
    ELSIF TG_TABLE_NAME = 'set_log' THEN
        v_record_log_id := COALESCE(NEW.record_log_id, OLD.record_log_id);

        SELECT ws.completion_status::TEXT
        INTO v_status
        FROM workout_session ws
        INNER JOIN record_log rl
            ON rl.workout_session_id = ws.workout_session_id
        WHERE rl.record_log_id = v_record_log_id;
    
    -- No other case where we need it, so just raise.
    ELSE
        RAISE EXCEPTION 'Unsupported trigger table: %', TG_TABLE_NAME;
    END IF;

    -- Cascaded deletes don't need to get checked.
    -- pg_trigger_depth() > 1 means the trigger was fired by the cascade
    -- rather than by direct user interaction.
    -- Also, don't check if the session doesn't exist.
    IF TG_OP = 'DELETE' AND (pg_trigger_depth() > 1 OR v_status IS NULL) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Block provided operations by the trigger for sessions that are not "In Progress".
    -- Also block situations where the parent doesn't exist (since this happens after the cascade
    -- check, it doesn't ruin anything)
    IF v_status IS NULL OR v_status <> 'In Progress' THEN
        RAISE EXCEPTION
            'Cannot % rows in % because the parent workout session is not In Progress',
            lower(TG_OP),
            TG_TABLE_NAME;
    END IF;

    -- Return and allow op to continue.
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger for record_log for all write operations just in case.
DROP TRIGGER IF EXISTS trg_record_log_block_finalized_session_edits ON record_log;
CREATE TRIGGER trg_record_log_block_finalized_session_edits
BEFORE INSERT OR UPDATE OR DELETE
ON record_log
FOR EACH ROW
EXECUTE FUNCTION trg_block_finalized_session_edits();

-- Trigger for set_log for all write operations just in case.
DROP TRIGGER IF EXISTS trg_set_log_block_finalized_session_edits ON set_log;
CREATE TRIGGER trg_set_log_block_finalized_session_edits
BEFORE INSERT OR UPDATE OR DELETE
ON set_log
FOR EACH ROW
EXECUTE FUNCTION trg_block_finalized_session_edits();