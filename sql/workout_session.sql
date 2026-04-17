USE sqlift;

DROP FUNCTION IF EXISTS get_workout_session_status_for_user;
DELIMITER $$
CREATE FUNCTION get_workout_session_status_for_user(
    p_user_id BIGINT,
    p_workout_session_id BIGINT
)
RETURNS VARCHAR(20) DETERMINISTIC
BEGIN
    DECLARE v_status VARCHAR(20);

    SELECT ws.completion_status
    INTO v_status
    FROM workout_session AS ws
    INNER JOIN workout AS w
        ON w.workout_id = ws.workout_id
    WHERE ws.workout_session_id = p_workout_session_id
		AND w.user_id = p_user_id
    LIMIT 1;

    RETURN v_status;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS get_in_progress_workout_session;
DELIMITER $$
CREATE PROCEDURE get_in_progress_workout_session(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
BEGIN
    SELECT ws.workout_session_id,
        ws.start_date_time,
        ws.end_date_time,
        ws.completion_status
    FROM workout_session AS ws
    INNER JOIN workout AS w
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
    SELECT ws.workout_session_id,
        w.workout_id,
        w.name AS workout_name,
        ws.start_date_time,
        ws.end_date_time,
        ws.notes,
        ws.completion_status,
        ws.difficulty_rating,
        ws.enjoyment_rating,
        ws.energy_level_rating
    FROM workout_session AS ws
    INNER JOIN workout AS w
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
    SELECT ws.workout_session_id,
        ws.start_date_time,
        ws.completion_status,
        ws.notes,
        COUNT(rl.record_log_id) AS exercise_count
    FROM workout_session AS ws
    INNER JOIN workout AS w
        ON w.workout_id = ws.workout_id
    LEFT JOIN record_log AS rl
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
    SELECT rl.record_log_id,
        rl.workout_session_id,
        rl.exercise_id,
        e.name AS exercise_name,
        rl.number,
        rl.timestamp,
        rl.duration,
        COUNT(sl.set_log_id) AS set_count
    FROM record_log AS rl
    INNER JOIN workout_session ws
        ON ws.workout_session_id = rl.workout_session_id
    INNER JOIN workout AS w
        ON w.workout_id = ws.workout_id
    LEFT JOIN exercise AS e
        ON e.exercise_id = rl.exercise_id
    LEFT JOIN set_log AS sl
        ON sl.record_log_id = rl.record_log_id
    WHERE w.user_id = p_user_id
		AND ws.workout_session_id = p_workout_session_id
    GROUP BY rl.record_log_id,
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
    SELECT sl.set_log_id,
        sl.record_log_id,
        sl.number,
        sl.type,
        sl.weight,
        sl.reps,
        sl.rpe,
        sl.rest_time
    FROM set_log AS sl
    INNER JOIN record_log AS rl
        ON rl.record_log_id = sl.record_log_id
    INNER JOIN workout_session AS ws
        ON ws.workout_session_id = rl.workout_session_id
    INNER JOIN workout AS w
        ON w.workout_id = ws.workout_id
    WHERE w.user_id = p_user_id
		AND rl.record_log_id = p_record_log_id
    ORDER BY sl.number ASC;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS start_workout_session;
DELIMITER $$
CREATE PROCEDURE start_workout_session(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
BEGIN
    DECLARE v_session_id BIGINT DEFAULT NULL;

    IF NOT EXISTS (
        SELECT 1
        FROM workout AS w
        WHERE w.workout_id = p_workout_id
			AND w.user_id = p_user_id
    ) THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Workout not found for this user';
    END IF;

    SELECT ws.workout_session_id
    INTO v_session_id
    FROM workout_session AS ws
    INNER JOIN workout AS w
        ON w.workout_id = ws.workout_id
    WHERE w.user_id = p_user_id
		AND w.workout_id = p_workout_id
		AND ws.completion_status = 'In Progress'
    ORDER BY ws.start_date_time DESC
    LIMIT 1;

    IF v_session_id IS NULL THEN
        INSERT INTO workout_session (
            workout_id,
            start_date_time,
            completion_status
        )
        VALUES (
            p_workout_id,
            NOW(),
            'In Progress'
        );
    END IF;

    SELECT COALESCE(v_session_id, LAST_INSERT_ID()) AS workout_session_id;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS finish_workout_session;
DELIMITER $$
CREATE PROCEDURE finish_workout_session(
    p_user_id BIGINT,
    p_workout_session_id BIGINT,
    p_notes TEXT,
    p_difficulty_rating INT,
    p_enjoyment_rating INT,
    p_energy_level_rating INT
)
BEGIN
    DECLARE v_status VARCHAR(20);

    SET v_status = get_workout_session_status_for_user(p_user_id, p_workout_session_id);

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Workout session not found for this user';
    END IF;

    IF v_status <> 'In Progress' THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Only In Progress sessions can be finished';
    END IF;

    IF p_difficulty_rating IS NOT NULL
		AND (p_difficulty_rating < 0 OR p_difficulty_rating > 10) THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Difficulty rating must be between 0 and 10';
    END IF;

    IF p_enjoyment_rating IS NOT NULL
		AND (p_enjoyment_rating < 0 OR p_enjoyment_rating > 10) THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Enjoyment rating must be between 0 and 10';
    END IF;

    IF p_energy_level_rating IS NOT NULL
		AND (p_energy_level_rating < 0 OR p_energy_level_rating > 10) THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Energy level rating must be between 0 and 10';
    END IF;

    UPDATE workout_session
    SET end_date_time = NOW(),
        notes = p_notes,
        completion_status = 'Completed',
        difficulty_rating = p_difficulty_rating,
        enjoyment_rating = p_enjoyment_rating,
        energy_level_rating = p_energy_level_rating
    WHERE workout_session_id = p_workout_session_id;

    SELECT ws.workout_session_id,
        ws.workout_id,
        ws.start_date_time,
        ws.end_date_time,
        ws.notes,
        ws.completion_status,
        ws.difficulty_rating,
        ws.enjoyment_rating,
        ws.energy_level_rating
    FROM workout_session AS ws
    WHERE ws.workout_session_id = p_workout_session_id;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS create_record_log;
DELIMITER $$
CREATE PROCEDURE create_record_log(
    p_user_id BIGINT,
    p_workout_session_id BIGINT,
    p_exercise_id BIGINT
)
BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE v_next_number INT;
    DECLARE v_record_log_id BIGINT;

    SET v_status = get_workout_session_status_for_user(p_user_id, p_workout_session_id);

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Workout session not found for this user';
    END IF;

    IF v_status <> 'In Progress' THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Cannot add a record log to a session that is not In Progress';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM exercise AS e
        WHERE e.exercise_id = p_exercise_id
    ) THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Exercise does not exist';
    END IF;

    SELECT COALESCE(MAX(rl.number), 0) + 1
    INTO v_next_number
    FROM record_log AS rl
    WHERE rl.workout_session_id = p_workout_session_id;

    INSERT INTO record_log (
        workout_session_id,
        exercise_id,
        number,
        timestamp
    )
    VALUES (
        p_workout_session_id,
        p_exercise_id,
        v_next_number,
        NOW()
    );

    SELECT LAST_INSERT_ID() AS record_log_id, v_next_number AS assigned_number;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS create_set_log;
DELIMITER $$
CREATE PROCEDURE create_set_log(
    p_user_id BIGINT,
    p_record_log_id BIGINT,
    p_type ENUM('Warm-up', 'Working', 'Drop'),
    p_weight DECIMAL(8,2),
    p_reps INT,
    p_rpe DECIMAL(3,1),
    p_rest_time INT
)
BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE v_next_number INT;
    DECLARE v_set_log_id BIGINT;

    SELECT ws.completion_status
    INTO v_status
    FROM workout_session AS ws
    INNER JOIN record_log AS rl
        ON rl.workout_session_id = ws.workout_session_id
    INNER JOIN workout AS w
        ON w.workout_id = ws.workout_id
    WHERE rl.record_log_id = p_record_log_id
		AND w.user_id = p_user_id
    LIMIT 1;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Record log not found for this user';
    END IF;

    IF v_status <> 'In Progress' THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Cannot add a set to a session that is not In Progress';
    END IF;

    IF p_rpe IS NOT NULL AND (p_rpe < 0 OR p_rpe > 10) THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'RPE must be between 0 and 10';
    END IF;

    IF p_weight IS NOT NULL AND p_weight < 0 THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Weight cannot be negative';
    END IF;

    IF p_reps IS NOT NULL AND p_reps <= 0 THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Reps must be greater than 0';
    END IF;

    IF p_rest_time IS NOT NULL AND p_rest_time < 0 THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Rest time cannot be negative';
    END IF;

    SELECT COALESCE(MAX(sl.number), 0) + 1
    INTO v_next_number
    FROM set_log AS sl
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
        v_next_number,
        p_type,
        p_weight,
        p_reps,
        p_rpe,
        p_rest_time
    );

    SELECT LAST_INSERT_ID() AS set_log_id, v_next_number AS assigned_number;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS update_set_log;
DELIMITER $$
CREATE PROCEDURE update_set_log(
    p_user_id BIGINT,
    p_set_log_id BIGINT,
    p_type ENUM('Warm-up', 'Working', 'Drop'),
    p_weight DECIMAL(8,2),
    p_reps INT,
    p_rpe DECIMAL(3,1),
    p_rest_time INT
)
BEGIN
    DECLARE v_status VARCHAR(20);

    SELECT ws.completion_status
    INTO v_status
    FROM workout_session AS ws
    INNER JOIN record_log AS rl
        ON rl.workout_session_id = ws.workout_session_id
    INNER JOIN set_log AS sl
        ON sl.record_log_id = rl.record_log_id
    INNER JOIN workout AS w
        ON w.workout_id = ws.workout_id
    WHERE sl.set_log_id = p_set_log_id
		AND w.user_id = p_user_id
    LIMIT 1;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Set log not found for this user';
    END IF;

    IF v_status <> 'In Progress' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot update a set in a session that is not In Progress';
    END IF;

    IF p_rpe IS NOT NULL 
        AND (p_rpe < 0 OR p_rpe > 10) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'RPE must be between 0 and 10';
    END IF;

    IF p_weight IS NOT NULL 
        AND p_weight < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Weight cannot be negative';
    END IF;

    IF p_reps IS NOT NULL 
        AND p_reps <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Reps must be greater than 0';
    END IF;

    IF p_rest_time IS NOT NULL 
        AND p_rest_time < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Rest time cannot be negative';
    END IF;

    UPDATE set_log
    SET type = p_type,
        weight = p_weight,
        reps = p_reps,
        rpe = p_rpe,
        rest_time = p_rest_time
    WHERE set_log_id = p_set_log_id;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS delete_record_log;
DELIMITER $$
CREATE PROCEDURE delete_record_log(
    p_user_id BIGINT,
    p_record_log_id BIGINT
)
BEGIN
    DECLARE v_workout_session_id BIGINT;
    DECLARE v_old_number INT;
    DECLARE v_status VARCHAR(20);

    SELECT
        rl.workout_session_id,
        rl.number,
        ws.completion_status
    INTO
        v_workout_session_id,
        v_old_number,
        v_status
    FROM record_log AS rl
    INNER JOIN workout_session AS ws
        ON ws.workout_session_id = rl.workout_session_id
    INNER JOIN workout AS w
        ON w.workout_id = ws.workout_id
    WHERE rl.record_log_id = p_record_log_id
      AND w.user_id = p_user_id
    LIMIT 1;

    IF v_workout_session_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Record log not found for this user';
    END IF;

    IF v_status <> 'In Progress' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot delete a record log from a session that is not In Progress';
    END IF;

    DELETE FROM record_log
    WHERE record_log_id = p_record_log_id;

    UPDATE record_log
    SET number = number - 1
    WHERE workout_session_id = v_workout_session_id
      AND number > v_old_number;

    SELECT TRUE AS deleted;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS delete_set_log;
DELIMITER $$
CREATE PROCEDURE delete_set_log(
    p_user_id BIGINT,
    p_set_log_id BIGINT
)
BEGIN
    DECLARE v_record_log_id BIGINT;
    DECLARE v_old_number INT;
    DECLARE v_status VARCHAR(20);

    SELECT
        sl.record_log_id,
        sl.number,
        ws.completion_status
    INTO
        v_record_log_id,
        v_old_number,
        v_status
    FROM set_log AS sl
    INNER JOIN record_log AS rl
        ON rl.record_log_id = sl.record_log_id
    INNER JOIN workout_session AS ws
        ON ws.workout_session_id = rl.workout_session_id
    INNER JOIN workout AS w
        ON w.workout_id = ws.workout_id
    WHERE sl.set_log_id = p_set_log_id
		AND w.user_id = p_user_id
    LIMIT 1;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Set log not found for this user';
    END IF;

    IF v_status <> 'In Progress' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot delete a set from a session that is not In Progress';
    END IF;

    DELETE FROM set_log
    WHERE set_log_id = p_set_log_id;

    UPDATE set_log
    SET number = number - 1
    WHERE record_log_id = v_record_log_id
		AND number > v_old_number;

    SELECT TRUE AS deleted;
END $$
DELIMITER ;