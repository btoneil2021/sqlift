USE sqlift;

DROP PROCEDURE IF EXISTS get_in_progress_workout_session;
DELIMITER $$
CREATE PROCEDURE get_in_progress_session_for_workout(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
BEGIN
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
    LIMIT 1;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS get_workout_session;
DELIMITER $$
CREATE PROCEDURE get_workout_session(
    p_user_id BIGINT,
    p_workout_session_id BIGINT
)
BEGIN
    SELECT
        ws.workout_session_id,
        w.workout_id,
        w.name AS workout_name,
        ws.start_date_time,
        ws.end_date_time,
        ws.notes,
        ws.completion_status,
        ws.difficulty_rating,
        ws.enjoyment_rating,
        ws.energy_level_rating
    FROM workout_session ws
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    WHERE ws.workout_session_id = p_workout_session_id
		AND w.user_id = p_user_id;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS list_workout_sessions;
DELIMITER $$
CREATE PROCEDURE list_workout_sessions(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
BEGIN
    SELECT
        ws.workout_session_id,
        ws.start_date_time,
        ws.completion_status,
        ws.notes,
        COUNT(rl.record_log_id) AS exercise_count
    FROM workout_session ws
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    LEFT JOIN record_log rl
        ON rl.workout_session_id = ws.workout_session_id
    WHERE w.user_id = p_user_id
		AND ws.workout_id = p_workout_id
    GROUP BY
        ws.workout_session_id,
        ws.start_date_time,
        ws.completion_status,
        ws.notes
    ORDER BY ws.start_date_time DESC;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS get_workout_records;
DELIMITER $$
CREATE PROCEDURE get_workout_records(
    p_user_id BIGINT,
    p_workout_session_id BIGINT
)
BEGIN
    SELECT
        rl.record_log_id,
        rl.workout_session_id,
        rl.exercise_id,
        e.name AS exercise_name,
        rl.number,
        rl.timestamp,
        rl.duration,
        COUNT(sl.set_log_id) AS set_count
    FROM record_log rl
    INNER JOIN workout_session ws
        ON ws.workout_session_id = rl.workout_session_id
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    LEFT JOIN exercise e
        ON e.exercise_id = rl.exercise_id
    LEFT JOIN set_log sl
        ON sl.record_log_id = rl.record_log_id
    WHERE w.user_id = p_user_id
		AND ws.workout_session_id = p_workout_session_id
    GROUP BY
        rl.record_log_id,
        rl.workout_session_id,
        rl.exercise_id,
        exercise_name,
        rl.number,
        rl.timestamp,
        rl.duration
    ORDER BY rl.number ASC;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS get_sets_for_record_log;
DELIMITER $$
CREATE PROCEDURE get_sets_for_record_log(
    p_user_id BIGINT,
    p_record_log_id BIGINT
)
BEGIN
    SELECT
        sl.set_log_id,
        sl.record_log_id,
        sl.number,
        sl.type,
        sl.weight,
        sl.reps,
        sl.rpe,
        sl.rest_time
    FROM set_log sl
    INNER JOIN record_log rl
        ON rl.record_log_id = sl.record_log_id
    INNER JOIN workout_session ws
        ON ws.workout_session_id = rl.workout_session_id
    INNER JOIN workout w
        ON w.workout_id = ws.workout_id
    WHERE w.user_id = p_user_id
		AND rl.record_log_id = p_record_log_id
    ORDER BY sl.number ASC;
END $$
DELIMITER ;