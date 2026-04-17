USE sqlift;

DELIMITER $$

-- Inserts a new body measurement log entry and returns the saved record
DROP PROCEDURE IF EXISTS log_measurement $$
CREATE PROCEDURE log_measurement(
    IN p_user_id             BIGINT,
    IN p_weight              DECIMAL(10,2),
    IN p_height              DECIMAL(10,2),
    IN p_visual_body_fat_pct DECIMAL(10,2),
    IN p_neck                DECIMAL(10,2),
    IN p_shoulder            DECIMAL(10,2),
    IN p_chest               DECIMAL(10,2),
    IN p_bicep               DECIMAL(10,2),
    IN p_forearm             DECIMAL(10,2),
    IN p_waist               DECIMAL(10,2),
    IN p_hips                DECIMAL(10,2),
    IN p_thigh               DECIMAL(10,2),
    IN p_calve               DECIMAL(10,2)
)
BEGIN
    SET @now_ts = NOW();
    INSERT INTO measurement_log (
        user_id, date_time,
        weight, height, visual_body_fat_percent,
        neck_measurement, shoulder_measurement, chest_measurement,
        bicep_measurement, forearm_measurement, waist_measurement,
        hips_measurement, thigh_measurement, calve_measurement
    ) VALUES (
        p_user_id, @now_ts,
        p_weight, p_height, p_visual_body_fat_pct,
        p_neck, p_shoulder, p_chest,
        p_bicep, p_forearm, p_waist,
        p_hips, p_thigh, p_calve
    );
    
    SELECT 
        user_id, date_time, weight, height, visual_body_fat_percent,
        neck_measurement, shoulder_measurement, chest_measurement,
        bicep_measurement, forearm_measurement, waist_measurement,
        hips_measurement, thigh_measurement, calve_measurement
    FROM measurement_log
    WHERE user_id = p_user_id AND date_time = @now_ts;
END $$

-- Returns all goals for a user ordered by status and target date
DROP PROCEDURE IF EXISTS get_user_goals $$
CREATE PROCEDURE get_user_goals(IN p_user_id BIGINT)
BEGIN
    SELECT g.goal_id, g.description, g.target_date, g.completion_status
    FROM user_goal g
    WHERE g.user_id = p_user_id
    ORDER BY
        (g.completion_status = 'completed') ASC,
        (g.target_date IS NULL) ASC,
        g.target_date ASC,
        g.goal_id DESC;
END $$

-- Inserts a new goal for a user and returns it
DROP PROCEDURE IF EXISTS add_user_goal $$
CREATE PROCEDURE add_user_goal(
    IN p_user_id     BIGINT,
    IN p_description TEXT,
    IN p_target_date DATE
)
BEGIN
    INSERT INTO user_goal (user_id, description, target_date, completion_status)
    VALUES (p_user_id, p_description, p_target_date, 'in_progress');
    
    SELECT goal_id, description, target_date, completion_status
    FROM user_goal
    WHERE goal_id = LAST_INSERT_ID();
END $$

-- Updates the completion status of a goal and returns the updated record
DROP PROCEDURE IF EXISTS update_goal_status $$
CREATE PROCEDURE update_goal_status(
    IN p_user_id           BIGINT,
    IN p_goal_id           BIGINT,
    IN p_completion_status TEXT
)
BEGIN
    UPDATE user_goal g
    SET completion_status = p_completion_status
    WHERE g.goal_id = p_goal_id AND g.user_id = p_user_id;
    
    SELECT goal_id, description, target_date, completion_status
    FROM user_goal
    WHERE goal_id = p_goal_id AND user_id = p_user_id;
END $$

-- Deletes a goal and returns true (1) if a row was removed
DROP PROCEDURE IF EXISTS delete_user_goal $$
CREATE PROCEDURE delete_user_goal(IN p_user_id BIGINT, IN p_goal_id BIGINT)
BEGIN
    DELETE FROM user_goal
    WHERE goal_id = p_goal_id AND user_id = p_user_id;
    SELECT ROW_COUNT() > 0 AS deleted;
END $$

-- Returns completed workout session history for a user ordered by most recent
DROP PROCEDURE IF EXISTS get_user_workout_history $$
CREATE PROCEDURE get_user_workout_history(IN p_user_id BIGINT)
BEGIN
    SELECT
        ws.workout_session_id,
        ws.workout_id,
        w.name AS workout_name,
        ws.start_date_time,
        ws.end_date_time,
        ws.completion_status,
        ws.difficulty_rating,
        ws.enjoyment_rating,
        ws.energy_level_rating,
        ws.notes
    FROM workout_session ws
    JOIN workout w ON w.workout_id = ws.workout_id
    WHERE w.user_id = p_user_id
      AND ws.completion_status = 'Completed'
    ORDER BY ws.start_date_time DESC;
END $$

-- Returns the current and longest consecutive daily workout streaks for a user
DROP PROCEDURE IF EXISTS get_user_daily_streaks $$
CREATE PROCEDURE get_user_daily_streaks(IN p_user_id BIGINT)
BEGIN
    WITH workout_days AS (
        SELECT DISTINCT DATE(ws.start_date_time) AS day
        FROM workout_session ws
        JOIN workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id
          AND ws.completion_status = 'Completed'
    ),
    numbered AS (
        SELECT day, DATE_SUB(day, INTERVAL ROW_NUMBER() OVER (ORDER BY day) DAY) AS grp
        FROM workout_days
    ),
    runs AS (
        SELECT grp, COUNT(*) AS run_len, MAX(day) AS last_day
        FROM numbered
        GROUP BY grp
    ),
    current_run AS (
        SELECT IFNULL(run_len, 0) AS len
        FROM runs
        WHERE last_day >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        ORDER BY last_day DESC
        LIMIT 1
    )
    SELECT
        (SELECT IFNULL(len, 0) FROM (SELECT 1) dummy LEFT JOIN current_run ON 1=1) AS current_streak,
        (SELECT IFNULL(MAX(run_len), 0) FROM runs) AS longest_streak;
END $$

-- Returns per-workout consecutive weekly streaks for a user
DROP PROCEDURE IF EXISTS get_user_weekly_streaks $$
CREATE PROCEDURE get_user_weekly_streaks(IN p_user_id BIGINT)
BEGIN
    WITH workout_weeks AS (
        SELECT DISTINCT
            w.workout_id,
            w.name AS workout_name,
            -- Monday-based week start
            DATE_SUB(DATE(ws.start_date_time), INTERVAL WEEKDAY(DATE(ws.start_date_time)) DAY) AS week_start
        FROM workout_session ws
        JOIN workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id
          AND ws.completion_status = 'Completed'
    ),
    numbered AS (
        SELECT
            workout_id,
            workout_name,
            week_start,
            DATE_SUB(week_start, INTERVAL ROW_NUMBER() OVER (PARTITION BY workout_id ORDER BY week_start) WEEK) AS grp
        FROM workout_weeks
    ),
    runs AS (
        SELECT workout_id, workout_name, grp, COUNT(*) AS streak_len, MAX(week_start) AS last_week
        FROM numbered
        GROUP BY workout_id, workout_name, grp
    ),
    dates AS (
        SELECT 
            DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AS this_week,
            DATE_SUB(CURDATE(), INTERVAL (WEEKDAY(CURDATE()) + 7) DAY) AS last_week
    )
    SELECT r.workout_id AS out_workout_id, r.workout_name AS out_workout_name, r.streak_len AS out_weekly_streak
    FROM runs r
    JOIN dates d ON r.last_week IN (d.this_week, d.last_week)
    ORDER BY r.streak_len DESC;
END $$

-- Returns max weight lifted per exercise per session date for rendering progression charts
DROP PROCEDURE IF EXISTS get_user_exercise_progression $$
CREATE PROCEDURE get_user_exercise_progression(IN p_user_id BIGINT)
BEGIN
    SELECT
        e.exercise_id,
        e.name AS exercise_name,
        DATE(ws.start_date_time) AS session_date,
        MAX(sl.weight) AS max_weight_kg
    FROM set_log sl
    JOIN record_log rl ON rl.record_log_id = sl.record_log_id
    JOIN workout_session ws ON ws.workout_session_id = rl.workout_session_id
    JOIN workout w ON w.workout_id = ws.workout_id
    JOIN exercise e ON e.exercise_id = rl.exercise_id
    WHERE w.user_id = p_user_id
      AND ws.completion_status = 'Completed'
      AND sl.weight IS NOT NULL
      AND sl.weight > 0
    GROUP BY e.exercise_id, e.name, ws.workout_session_id, DATE(ws.start_date_time)
    ORDER BY e.name, session_date;
END $$

-- Returns aggregated lifetime hero stats including total volume, PRs, and top exercise
DROP PROCEDURE IF EXISTS get_user_hero_stats $$
CREATE PROCEDURE get_user_hero_stats(IN p_user_id BIGINT)
BEGIN
    WITH completed AS (
        SELECT ws.workout_session_id, ws.start_date_time, ws.end_date_time
        FROM workout_session ws
        JOIN workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id
          AND ws.completion_status = 'Completed'
    ),
    session_volumes AS (
        SELECT
            rl.workout_session_id,
            SUM(sl.weight * sl.reps) AS session_vol
        FROM set_log sl
        JOIN record_log rl ON rl.record_log_id = sl.record_log_id
        WHERE rl.workout_session_id IN (SELECT workout_session_id FROM completed)
          AND sl.weight IS NOT NULL AND sl.reps IS NOT NULL
        GROUP BY rl.workout_session_id
    ),
    all_sets AS (
        SELECT sl.weight, sl.reps, rl.exercise_id
        FROM set_log sl
        JOIN record_log rl ON rl.record_log_id = sl.record_log_id
        WHERE rl.workout_session_id IN (SELECT workout_session_id FROM completed)
          AND sl.weight IS NOT NULL
    ),
    exercise_volumes AS (
        SELECT
            rl2.exercise_id,
            e.name AS exercise_name,
            SUM(sl2.weight * sl2.reps) AS total_vol
        FROM set_log sl2
        JOIN record_log rl2 ON rl2.record_log_id = sl2.record_log_id
        JOIN exercise e ON e.exercise_id = rl2.exercise_id
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
        JOIN exercise e2 ON e2.exercise_id = s.exercise_id
        WHERE s.weight = (SELECT MAX(weight) FROM all_sets)
        ORDER BY (s.reps IS NULL) ASC, s.reps DESC
        LIMIT 1
    )
    SELECT
        (SELECT COUNT(*) FROM completed) AS total_sessions,
        IFNULL((SELECT SUM(session_vol) FROM session_volumes), 0) AS total_volume_kg,
        IFNULL((SELECT MAX(session_vol) FROM session_volumes), 0) AS max_session_volume_kg,
        IFNULL((SELECT MAX(weight) FROM all_sets), 0) AS heaviest_set_kg,
        IFNULL((SELECT MAX(reps) FROM set_log sl3
                  JOIN record_log rl3 ON rl3.record_log_id = sl3.record_log_id
                  WHERE rl3.workout_session_id IN (SELECT workout_session_id FROM completed)
                    AND sl3.reps IS NOT NULL), 0) AS max_reps_in_set,
        IFNULL((
            SELECT ROUND(AVG(
                TIMESTAMPDIFF(SECOND, c.start_date_time, c.end_date_time) / 60
            ), 0)
            FROM completed c
            WHERE c.end_date_time IS NOT NULL
        ), 0) AS avg_session_minutes,
        (SELECT exercise_name FROM top_ex) AS top_exercise_by_volume,
        (SELECT exercise_id FROM pr_set) AS pr_exercise_id,
        (SELECT exercise_name FROM pr_set) AS pr_exercise_name,
        (SELECT weight FROM pr_set) AS pr_weight_kg,
        (SELECT reps FROM pr_set) AS pr_reps;
END $$

-- Returns the heaviest single set PR per exercise for a user
DROP PROCEDURE IF EXISTS get_user_exercise_prs $$
CREATE PROCEDURE get_user_exercise_prs(IN p_user_id BIGINT)
BEGIN
    WITH completed_sessions AS (
        SELECT ws.workout_session_id, ws.start_date_time
        FROM workout_session ws
        JOIN workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id
          AND ws.completion_status = 'Completed'
    ),
    exercise_max AS (
        SELECT
            rl.exercise_id,
            MAX(sl.weight) AS max_w
        FROM set_log sl
        JOIN record_log rl ON rl.record_log_id = sl.record_log_id
        WHERE rl.workout_session_id IN (SELECT workout_session_id FROM completed_sessions)
          AND sl.weight IS NOT NULL AND sl.weight > 0
        GROUP BY rl.exercise_id
    ),
    pr_rows AS (
        SELECT 
            rl2.exercise_id,
            sl2.weight,
            sl2.reps,
            DATE(cs.start_date_time) AS pr_date,
            ROW_NUMBER() OVER (PARTITION BY rl2.exercise_id ORDER BY sl2.reps DESC, cs.start_date_time DESC) as rn
        FROM set_log sl2
        JOIN record_log rl2 ON rl2.record_log_id = sl2.record_log_id
        JOIN completed_sessions cs ON cs.workout_session_id = rl2.workout_session_id
        JOIN exercise_max em ON em.exercise_id = rl2.exercise_id AND em.max_w = sl2.weight
    )
    SELECT
        pr.exercise_id,
        e.name AS exercise_name,
        pr.weight AS max_weight_kg,
        pr.reps AS reps_at_max,
        pr.pr_date
    FROM pr_rows pr
    JOIN exercise e ON e.exercise_id = pr.exercise_id
    WHERE pr.rn = 1
    ORDER BY pr.weight DESC;
END $$

-- Returns total volume (kg) per muscle group per session date for a user
DROP PROCEDURE IF EXISTS get_muscle_volume_by_session $$
CREATE PROCEDURE get_muscle_volume_by_session(IN p_user_id BIGINT)
BEGIN
    SELECT
        DATE(ws.start_date_time) AS session_date,
        mg.name                  AS muscle_name,
        SUM(sl.weight * sl.reps) AS volume_kg
    FROM set_log sl
    JOIN record_log rl        ON rl.record_log_id        = sl.record_log_id
    JOIN workout_session ws   ON ws.workout_session_id   = rl.workout_session_id
    JOIN workout w            ON w.workout_id            = ws.workout_id
    JOIN exercise_muscle_group emg ON emg.exercise_id    = rl.exercise_id
    JOIN muscle_group mg      ON mg.muscle_id            = emg.muscle_id
    WHERE w.user_id = p_user_id
      AND ws.completion_status = 'Completed'
      AND sl.weight IS NOT NULL
      AND sl.reps   IS NOT NULL
      AND sl.weight > 0
    GROUP BY DATE(ws.start_date_time), mg.muscle_id, mg.name
    ORDER BY session_date DESC, volume_kg DESC;
END $$

-- Returns the muscle group the user has accumulated the most volume in across all logs
DROP PROCEDURE IF EXISTS get_favourite_muscle $$
CREATE PROCEDURE get_favourite_muscle(IN p_user_id BIGINT)
BEGIN
    SELECT
        mg.name                  AS muscle_name,
        SUM(sl.weight * sl.reps) AS total_volume
    FROM set_log sl
    JOIN record_log rl        ON rl.record_log_id        = sl.record_log_id
    JOIN workout_session ws   ON ws.workout_session_id   = rl.workout_session_id
    JOIN workout w            ON w.workout_id            = ws.workout_id
    JOIN exercise_muscle_group emg ON emg.exercise_id    = rl.exercise_id
    JOIN muscle_group mg      ON mg.muscle_id            = emg.muscle_id
    WHERE w.user_id = p_user_id
      AND ws.completion_status = 'Completed'
      AND sl.weight IS NOT NULL
      AND sl.reps   IS NOT NULL
      AND sl.weight > 0
    GROUP BY mg.muscle_id, mg.name
    ORDER BY total_volume DESC
    LIMIT 1;
END $$

DELIMITER ;
