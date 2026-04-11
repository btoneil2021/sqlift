SET search_path TO sqlift;

-- Inserts a new body measurement log entry and returns the saved record
CREATE OR REPLACE FUNCTION log_measurement(
    p_user_id             BIGINT,
    p_weight              NUMERIC DEFAULT NULL,
    p_height              NUMERIC DEFAULT NULL,
    p_visual_body_fat_pct NUMERIC DEFAULT NULL,
    p_neck                NUMERIC DEFAULT NULL,
    p_shoulder            NUMERIC DEFAULT NULL,
    p_chest               NUMERIC DEFAULT NULL,
    p_bicep               NUMERIC DEFAULT NULL,
    p_forearm             NUMERIC DEFAULT NULL,
    p_waist               NUMERIC DEFAULT NULL,
    p_hips                NUMERIC DEFAULT NULL,
    p_thigh               NUMERIC DEFAULT NULL,
    p_calve               NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    user_id                  BIGINT,
    date_time                TIMESTAMP,
    weight                   NUMERIC,
    height                   NUMERIC,
    visual_body_fat_percent  NUMERIC,
    neck_measurement         NUMERIC,
    shoulder_measurement     NUMERIC,
    chest_measurement        NUMERIC,
    bicep_measurement        NUMERIC,
    forearm_measurement      NUMERIC,
    waist_measurement        NUMERIC,
    hips_measurement         NUMERIC,
    thigh_measurement        NUMERIC,
    calve_measurement        NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO sqlift.measurement_log (
        user_id, date_time,
        weight, height, visual_body_fat_percent,
        neck_measurement, shoulder_measurement, chest_measurement,
        bicep_measurement, forearm_measurement, waist_measurement,
        hips_measurement, thigh_measurement, calve_measurement
    ) VALUES (
        p_user_id, NOW(),
        p_weight, p_height, p_visual_body_fat_pct,
        p_neck, p_shoulder, p_chest,
        p_bicep, p_forearm, p_waist,
        p_hips, p_thigh, p_calve
    )
    RETURNING
        measurement_log.user_id,
        measurement_log.date_time,
        measurement_log.weight,
        measurement_log.height,
        measurement_log.visual_body_fat_percent,
        measurement_log.neck_measurement,
        measurement_log.shoulder_measurement,
        measurement_log.chest_measurement,
        measurement_log.bicep_measurement,
        measurement_log.forearm_measurement,
        measurement_log.waist_measurement,
        measurement_log.hips_measurement,
        measurement_log.thigh_measurement,
        measurement_log.calve_measurement;
END;
$$ LANGUAGE plpgsql;

-- Returns all goals for a user ordered by status and target date
CREATE OR REPLACE FUNCTION get_user_goals(p_user_id BIGINT)
RETURNS TABLE (
    goal_id           BIGINT,
    description       TEXT,
    target_date       DATE,
    completion_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT g.goal_id, g.description, g.target_date, g.completion_status
    FROM sqlift.user_goal g
    WHERE g.user_id = p_user_id
    ORDER BY
        CASE WHEN g.completion_status = 'completed' THEN 1 ELSE 0 END,
        g.target_date ASC NULLS LAST,
        g.goal_id DESC;
END;
$$ LANGUAGE plpgsql;

-- Inserts a new goal for a user and returns it
CREATE OR REPLACE FUNCTION add_user_goal(
    p_user_id     BIGINT,
    p_description TEXT,
    p_target_date DATE DEFAULT NULL
)
RETURNS TABLE (
    goal_id           BIGINT,
    description       TEXT,
    target_date       DATE,
    completion_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO sqlift.user_goal (user_id, description, target_date, completion_status)
    VALUES (p_user_id, p_description, p_target_date, 'in_progress')
    RETURNING
        user_goal.goal_id,
        user_goal.description,
        user_goal.target_date,
        user_goal.completion_status;
END;
$$ LANGUAGE plpgsql;

-- Updates the completion status of a goal and returns the updated record
CREATE OR REPLACE FUNCTION update_goal_status(
    p_user_id           BIGINT,
    p_goal_id           BIGINT,
    p_completion_status TEXT
)
RETURNS TABLE (
    goal_id           BIGINT,
    description       TEXT,
    target_date       DATE,
    completion_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    UPDATE sqlift.user_goal g
    SET completion_status = p_completion_status
    WHERE g.goal_id = p_goal_id AND g.user_id = p_user_id
    RETURNING
        g.goal_id,
        g.description,
        g.target_date,
        g.completion_status;
END;
$$ LANGUAGE plpgsql;

-- Deletes a goal and returns true if a row was removed
CREATE OR REPLACE FUNCTION delete_user_goal(p_user_id BIGINT, p_goal_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM sqlift.user_goal
    WHERE goal_id = p_goal_id AND user_id = p_user_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted > 0;
END;
$$ LANGUAGE plpgsql;

-- Returns completed workout session history for a user ordered by most recent
CREATE OR REPLACE FUNCTION get_user_workout_history(p_user_id BIGINT)
RETURNS TABLE (
    workout_session_id  BIGINT,
    workout_id          BIGINT,
    workout_name        TEXT,
    start_date_time     TIMESTAMP,
    end_date_time       TIMESTAMP,
    completion_status   TEXT,
    difficulty_rating   INTEGER,
    enjoyment_rating    INTEGER,
    energy_level_rating INTEGER,
    notes               TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ws.workout_session_id,
        ws.workout_id,
        w.name AS workout_name,
        ws.start_date_time,
        ws.end_date_time,
        ws.completion_status::TEXT,
        ws.difficulty_rating,
        ws.enjoyment_rating,
        ws.energy_level_rating,
        ws.notes
    FROM sqlift.workout_session ws
    JOIN sqlift.workout w ON w.workout_id = ws.workout_id
    WHERE w.user_id = p_user_id
      AND ws.completion_status = 'Completed'
    ORDER BY ws.start_date_time DESC;
END;
$$ LANGUAGE plpgsql;

-- Returns the current and longest consecutive daily workout streaks for a user
CREATE OR REPLACE FUNCTION get_user_daily_streaks(p_user_id BIGINT)
RETURNS TABLE (current_streak INT, longest_streak INT) AS $$
BEGIN
    RETURN QUERY
    WITH workout_days AS (
        SELECT DISTINCT ws.start_date_time::DATE AS day
        FROM sqlift.workout_session ws
        JOIN sqlift.workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id
          AND ws.completion_status = 'Completed'
    ),
    numbered AS (
        SELECT day, day - (ROW_NUMBER() OVER (ORDER BY day))::INT AS grp
        FROM workout_days
    ),
    runs AS (
        SELECT grp, COUNT(*)::INT AS run_len, MAX(day) AS last_day
        FROM numbered
        GROUP BY grp
    ),
    current_run AS (
        SELECT COALESCE(run_len, 0) AS len
        FROM runs
        WHERE last_day >= CURRENT_DATE - 1
        ORDER BY last_day DESC
        LIMIT 1
    )
    SELECT
        (SELECT COALESCE(len, 0) FROM current_run),
        (SELECT COALESCE(MAX(run_len), 0) FROM runs);
END;
$$ LANGUAGE plpgsql;

-- Returns per-workout consecutive weekly streaks for a user
CREATE OR REPLACE FUNCTION get_user_weekly_streaks(p_user_id BIGINT)
RETURNS TABLE (out_workout_id BIGINT, out_workout_name TEXT, out_weekly_streak INT) AS $$
BEGIN
    RETURN QUERY
    WITH workout_weeks AS (
        SELECT DISTINCT
            w.workout_id,
            w.name AS workout_name,
            DATE_TRUNC('week', ws.start_date_time)::DATE AS week_start
        FROM sqlift.workout_session ws
        JOIN sqlift.workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id
          AND ws.completion_status = 'Completed'
    ),
    numbered AS (
        SELECT
            workout_id,
            workout_name,
            week_start,
            week_start - make_interval(weeks => ROW_NUMBER() OVER (PARTITION BY workout_id ORDER BY week_start)::INT) AS grp
        FROM workout_weeks
    ),
    runs AS (
        SELECT workout_id, workout_name, grp, COUNT(*)::INT AS streak_len, MAX(week_start) AS last_week
        FROM numbered
        GROUP BY workout_id, workout_name, grp
    ),
    this_week  AS (SELECT DATE_TRUNC('week', CURRENT_DATE)::DATE AS w),
    last_week  AS (SELECT DATE_TRUNC('week', CURRENT_DATE - 7)::DATE AS w)
    SELECT r.workout_id, r.workout_name, r.streak_len
    FROM runs r, this_week tw, last_week lw
    WHERE r.last_week IN (tw.w, lw.w)
    ORDER BY r.streak_len DESC;
END;
$$ LANGUAGE plpgsql;

-- Returns max weight lifted per exercise per session date for rendering progression charts
CREATE OR REPLACE FUNCTION get_user_exercise_progression(p_user_id BIGINT)
RETURNS TABLE (
    exercise_id   BIGINT,
    exercise_name TEXT,
    session_date  DATE,
    max_weight_kg NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.exercise_id,
        e.name AS exercise_name,
        ws.start_date_time::DATE AS session_date,
        MAX(sl.weight) AS max_weight_kg
    FROM sqlift.set_log sl
    JOIN sqlift.record_log rl ON rl.record_log_id = sl.record_log_id
    JOIN sqlift.workout_session ws ON ws.workout_session_id = rl.workout_session_id
    JOIN sqlift.workout w ON w.workout_id = ws.workout_id
    JOIN sqlift.exercise e ON e.exercise_id = rl.exercise_id
    WHERE w.user_id = p_user_id
      AND ws.completion_status = 'Completed'
      AND sl.weight IS NOT NULL
      AND sl.weight > 0
    GROUP BY e.exercise_id, e.name, ws.start_date_time::DATE
    ORDER BY e.name, ws.start_date_time::DATE;
END;
$$ LANGUAGE plpgsql;

-- Returns aggregated lifetime hero stats including total volume, PRs, and top exercise
CREATE OR REPLACE FUNCTION get_user_hero_stats(p_user_id BIGINT)
RETURNS TABLE (
    total_sessions           BIGINT,
    total_volume_kg          NUMERIC,
    max_session_volume_kg    NUMERIC,
    heaviest_set_kg          NUMERIC,
    max_reps_in_set          INTEGER,
    avg_session_minutes      NUMERIC,
    top_exercise_by_volume   TEXT,
    pr_exercise_id           BIGINT,
    pr_exercise_name         TEXT,
    pr_weight_kg             NUMERIC,
    pr_reps                  INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH completed AS (
        SELECT ws.workout_session_id, ws.start_date_time, ws.end_date_time
        FROM sqlift.workout_session ws
        JOIN sqlift.workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id
          AND ws.completion_status = 'Completed'
    ),
    session_volumes AS (
        SELECT
            rl.workout_session_id,
            SUM(sl.weight * sl.reps) AS session_vol
        FROM sqlift.set_log sl
        JOIN sqlift.record_log rl ON rl.record_log_id = sl.record_log_id
        WHERE rl.workout_session_id IN (SELECT workout_session_id FROM completed)
          AND sl.weight IS NOT NULL AND sl.reps IS NOT NULL
        GROUP BY rl.workout_session_id
    ),
    all_sets AS (
        SELECT sl.weight, sl.reps, rl.exercise_id
        FROM sqlift.set_log sl
        JOIN sqlift.record_log rl ON rl.record_log_id = sl.record_log_id
        WHERE rl.workout_session_id IN (SELECT workout_session_id FROM completed)
          AND sl.weight IS NOT NULL
    ),
    exercise_volumes AS (
        SELECT
            rl2.exercise_id,
            e.name AS exercise_name,
            SUM(sl2.weight * sl2.reps) AS total_vol
        FROM sqlift.set_log sl2
        JOIN sqlift.record_log rl2 ON rl2.record_log_id = sl2.record_log_id
        JOIN sqlift.exercise e ON e.exercise_id = rl2.exercise_id
        WHERE rl2.workout_session_id IN (SELECT workout_session_id FROM completed)
          AND sl2.weight IS NOT NULL AND sl2.reps IS NOT NULL
        GROUP BY rl2.exercise_id, e.name
    ),
    top_ex AS (
        SELECT exercise_name FROM exercise_volumes ORDER BY total_vol DESC LIMIT 1
    ),
    pr_set AS (
        SELECT
            s.exercise_id,
            e2.name AS exercise_name,
            s.weight,
            s.reps
        FROM all_sets s
        JOIN sqlift.exercise e2 ON e2.exercise_id = s.exercise_id
        WHERE s.weight = (SELECT MAX(weight) FROM all_sets)
        ORDER BY s.reps DESC NULLS LAST
        LIMIT 1
    )
    SELECT
        (SELECT COUNT(*)::BIGINT FROM completed),
        COALESCE((SELECT SUM(session_vol) FROM session_volumes), 0),
        COALESCE((SELECT MAX(session_vol) FROM session_volumes), 0),
        COALESCE((SELECT MAX(weight) FROM all_sets), 0),
        COALESCE((SELECT MAX(reps) FROM sqlift.set_log sl3
                  JOIN sqlift.record_log rl3 ON rl3.record_log_id = sl3.record_log_id
                  WHERE rl3.workout_session_id IN (SELECT workout_session_id FROM completed)
                    AND sl3.reps IS NOT NULL), 0),
        COALESCE((
            SELECT ROUND(AVG(
                EXTRACT(EPOCH FROM (c.end_date_time - c.start_date_time)) / 60
            )::NUMERIC, 0)
            FROM completed c
            WHERE c.end_date_time IS NOT NULL
        ), 0),
        (SELECT exercise_name FROM top_ex),
        (SELECT exercise_id FROM pr_set),
        (SELECT exercise_name FROM pr_set),
        (SELECT weight FROM pr_set),
        (SELECT reps FROM pr_set);
END;
$$ LANGUAGE plpgsql;

-- Returns the heaviest single set PR per exercise for a user
CREATE OR REPLACE FUNCTION get_user_exercise_prs(p_user_id BIGINT)
RETURNS TABLE (
    exercise_id   BIGINT,
    exercise_name TEXT,
    max_weight_kg NUMERIC,
    reps_at_max   INTEGER,
    pr_date       DATE
) AS $$
BEGIN
    RETURN QUERY
    WITH completed_sessions AS (
        SELECT ws.workout_session_id, ws.start_date_time
        FROM sqlift.workout_session ws
        JOIN sqlift.workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id
          AND ws.completion_status = 'Completed'
    ),
    exercise_max AS (
        SELECT
            rl.exercise_id,
            MAX(sl.weight) AS max_w
        FROM sqlift.set_log sl
        JOIN sqlift.record_log rl ON rl.record_log_id = sl.record_log_id
        WHERE rl.workout_session_id IN (SELECT workout_session_id FROM completed_sessions)
          AND sl.weight IS NOT NULL AND sl.weight > 0
        GROUP BY rl.exercise_id
    ),
    pr_rows AS (
        SELECT DISTINCT ON (rl2.exercise_id)
            rl2.exercise_id,
            sl2.weight,
            sl2.reps,
            cs.start_date_time::DATE AS pr_date
        FROM sqlift.set_log sl2
        JOIN sqlift.record_log rl2 ON rl2.record_log_id = sl2.record_log_id
        JOIN completed_sessions cs ON cs.workout_session_id = rl2.workout_session_id
        JOIN exercise_max em ON em.exercise_id = rl2.exercise_id AND em.max_w = sl2.weight
        ORDER BY rl2.exercise_id, sl2.reps DESC NULLS LAST, cs.start_date_time DESC
    )
    SELECT
        pr.exercise_id,
        e.name,
        pr.weight,
        pr.reps,
        pr.pr_date
    FROM pr_rows pr
    JOIN sqlift.exercise e ON e.exercise_id = pr.exercise_id
    ORDER BY pr.weight DESC;
END;
$$ LANGUAGE plpgsql;
