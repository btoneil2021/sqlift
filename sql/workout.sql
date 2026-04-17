USE sqlift;

-- Return the top primary muscle group for the provided workout.
DROP FUNCTION IF EXISTS get_primary_muscle_group_for_workout;
DELIMITER $$
CREATE FUNCTION get_primary_muscle_group_for_workout(
    p_workout_id BIGINT
)
RETURNS VARCHAR(255) READS SQL DATA
BEGIN
	DECLARE primary_muscle_group_name VARCHAR(255);
    
    SELECT mg.name INTO primary_muscle_group_name
    FROM workout_exercise AS we
    INNER JOIN exercise_muscle_group AS emg
        ON emg.exercise_id = we.exercise_id
    INNER JOIN muscle_group AS mg
        ON mg.muscle_id = emg.muscle_id
    WHERE we.workout_id = p_workout_id
        AND emg.role = 'Primary'
    GROUP BY mg.muscle_id, mg.name
    ORDER BY COUNT(emg.exercise_id) DESC, mg.muscle_id ASC
    LIMIT 1;
    
    RETURN primary_muscle_group_name;
END $$
DELIMITER ;

-- Return the matching exercise library rows for the provided search text.
DROP PROCEDURE IF EXISTS search_exercises;
DELIMITER $$
CREATE PROCEDURE search_exercises(
    p_search_text VARCHAR(255)
)
BEGIN
    SELECT 
        e.exercise_id, 
        e.name AS exercise_name
    FROM exercise AS e
    WHERE p_search_text IS NULL
        OR TRIM(p_search_text) = ''
        OR LOWER(e.name) LIKE CONCAT('%', LOWER(TRIM(p_search_text)), '%')
    ORDER BY e.name ASC;
END $$
DELIMITER ;

-- Return the header-level fields for the requested workout.
DROP PROCEDURE IF EXISTS get_workout;
DELIMITER $$
CREATE PROCEDURE get_workout(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
BEGIN
    SELECT
        w.workout_id,
        w.name AS workout_name,
        w.preferred_day,
        get_primary_muscle_group_for_workout(w.workout_id) AS primary_muscle_group
    FROM workout AS w
    WHERE w.user_id = p_user_id
        AND w.workout_id = p_workout_id;
END $$
DELIMITER ;

-- Return the tags for the requested workout.
DROP PROCEDURE IF EXISTS get_workout_tags;
DELIMITER $$
CREATE PROCEDURE get_workout_tags(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
BEGIN
    SELECT
        wt.name AS tag_name,
        wt.color_code AS color_code
    FROM workout_tag AS wt
    INNER JOIN workout_tag_assignment AS wta
        ON wta.tag_name = wt.name
    INNER JOIN workout AS w
        ON wta.workout_id = w.workout_id
    WHERE w.user_id = p_user_id
        AND w.workout_id = p_workout_id
    ORDER BY wt.name ASC;
END $$
DELIMITER ;

-- Return the planned exercises for the requested workout in sort order
DROP PROCEDURE IF EXISTS get_workout_exercises;
DELIMITER $$
CREATE PROCEDURE get_workout_exercises(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
BEGIN
    SELECT
        we.sort_order AS sort_order,
        we.exercise_id,
        e.name AS exercise_name,
        we.target_sets,
        we.target_reps,
        we.target_weight,
        we.expected_rest_time
    FROM workout_exercise AS we
    INNER JOIN workout AS w
        ON w.workout_id = we.workout_id
    INNER JOIN exercise AS e
        ON e.exercise_id = we.exercise_id
    WHERE w.user_id = p_user_id
        AND w.workout_id = p_workout_id
    ORDER BY we.sort_order ASC;
END $$
DELIMITER ;

-- Return grouped workout history for the requested workout.
DROP PROCEDURE IF EXISTS get_workout_history;
DELIMITER $$
CREATE PROCEDURE get_workout_history(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
BEGIN
    SELECT
        COALESCE(wsd.total_sessions, 0) AS total_sessions,
        COALESCE(wsd.completed_sessions, 0) AS completed_sessions,
        COALESCE(wsd.in_progress_sessions, 0) AS in_progress_sessions,
        COALESCE(wsd.abandoned_sessions, 0) AS abandoned_sessions,
        wsd.last_started_at,
        wsd.last_completed_at,
        ROUND(AVG(ws.difficulty_rating), 1) AS average_difficulty,
        ROUND(AVG(ws.enjoyment_rating), 1) AS average_enjoyment,
        ROUND(AVG(ws.energy_level_rating), 1) AS average_energy_level
    FROM (
		SELECT
			w.workout_id,
            COUNT(ws.workout_session_id) AS total_sessions,
            SUM(
				CASE
					WHEN ws.completion_status = 'Completed'
					    AND (ws.notes IS NULL OR ws.notes <> 'Abandoned')
						THEN 1 
                    ELSE 0
				END
			) AS completed_sessions,
            SUM(
				CASE
					WHEN ws.completion_status = 'In Progress'
						THEN 1
                    ELSE 0
				END
			) AS in_progress_sessions,
			MAX(ws.start_date_time) AS last_started_at,
            MAX(
				CASE
					WHEN ws.completion_status = 'Completed'
						THEN ws.end_date_time
					ELSE NULL
				END
			) AS last_completed_at,
            SUM(
				CASE
					WHEN ws.completion_status = 'Completed'
						AND ws.notes = 'Abandoned'
						THEN 1
					ELSE 0
				END
			) AS abandoned_sessions
		FROM workout AS w
		LEFT JOIN workout_session AS ws
			ON w.workout_id = ws.workout_id
		GROUP BY w.workout_id
    ) wsd
    LEFT JOIN workout AS w
        ON w.workout_id = wsd.workout_id
    LEFT JOIN workout_session AS ws
        ON ws.workout_id = w.workout_id
    WHERE w.user_id = p_user_id
        AND w.workout_id = p_workout_id
    GROUP BY
        wsd.total_sessions,
        wsd.completed_sessions,
        wsd.in_progress_sessions,
        wsd.abandoned_sessions,
        wsd.last_started_at,
        wsd.last_completed_at;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS create_full_workout;
DELIMITER $$
CREATE PROCEDURE create_full_workout(
    p_user_id BIGINT,
    p_name VARCHAR(255),
    p_preferred_day TEXT
)
BEGIN
    IF p_name IS NULL OR TRIM(p_name) = '' THEN
		SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Workout name is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM user AS u
        WHERE u.user_id = p_user_id
    ) THEN
		SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'User does not exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM workout AS w
        WHERE w.user_id = p_user_id
            AND w.name = TRIM(p_name)
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Workout name already exists for this user';
    END IF;

    -- Create the new workout
    INSERT INTO workout (user_id, name, preferred_day)
    VALUES (p_user_id, TRIM(p_name), NULLIF(TRIM(p_preferred_day), ''));

    SELECT LAST_INSERT_ID() AS workout_id;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS create_workout_exercise;
DELIMITER $$
CREATE PROCEDURE create_workout_exercise(
	p_user_id BIGINT,
    p_workout_id BIGINT,
    p_sort_order INT,
    p_exercise_id BIGINT,
    p_target_sets INT,
    p_target_reps INT,
    p_target_weight DECIMAL(8,2),
    p_expected_rest_time INT
)
BEGIN
	IF NOT EXISTS (
		SELECT 1
        FROM workout AS w
        WHERE w.workout_id = p_workout_id
			AND w.user_id = p_user_id
	) THEN
		SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Workout not found for this user';
	END IF;
    
    IF NOT EXISTS (
        SELECT 1
        FROM exercise AS e
        WHERE e.exercise_id = p_exercise_id
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Exercise does not exist';
    END IF;

    IF p_sort_order IS NULL 
        OR p_sort_order <= 0 THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Sort order must be a number greater than 0';
    END IF;

    IF p_target_sets IS NOT NULL 
        AND p_target_sets <= 0 THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Target sets must be a number greater than 0';
    END IF;

    IF p_target_reps IS NOT NULL 
        AND p_target_reps <= 0 THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Target reps must be a number greater than 0';
    END IF;

    IF p_target_weight IS NOT NULL 
        AND p_target_weight < 0 THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Target weight cannot be negative or null';
    END IF;
    
    IF EXISTS (
        SELECT 1
        FROM workout_exercise AS we
        WHERE we.workout_id = p_workout_id
			AND we.sort_order = p_sort_order
    ) THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Duplicate sort_order values are not allowed';
    END IF;
    
    -- Insert new workout_exercise rows
    INSERT INTO workout_exercise (
        workout_id, 
        sort_order, 
        exercise_id,
        target_sets,
        target_reps,
        target_weight,
        expected_rest_time
    )
    VALUES (
        p_workout_id,
        p_sort_order,
        p_exercise_id,
        p_target_sets,
        p_target_reps,
        p_target_weight,
        p_expected_rest_time
    );
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS add_workout_tag;
DELIMITER $$
CREATE PROCEDURE add_workout_tag(
	p_user_id BIGINT,
    p_workout_id BIGINT,
    p_tag_name VARCHAR(255)
)
BEGIN
	IF p_tag_name IS NULL 
        OR TRIM(p_tag_name) = '' THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Tag name is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM workout AS w
        WHERE w.workout_id = p_workout_id
          AND w.user_id = p_user_id
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Workout not found for this user';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM workout_tag AS wt
        WHERE wt.name = TRIM(p_tag_name)
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Tag name does not exist';
    END IF;

    -- Insert new workout_tag_assignment rows
    INSERT INTO workout_tag_assignment (workout_id, tag_name)
    VALUES (p_workout_id, TRIM(p_tag_name));
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS update_workout;
DELIMITER $$
CREATE PROCEDURE update_workout(
    p_user_id BIGINT,
    p_workout_id BIGINT,
    p_name VARCHAR(255),
    p_preferred_day VARCHAR(255)
)
BEGIN
    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Workout name is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM workout AS w
        WHERE w.workout_id = p_workout_id
			AND w.user_id = p_user_id
    ) THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Workout not found for this user';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM workout AS w
        WHERE w.user_id = p_user_id
			AND w.name = TRIM(p_name)
			AND w.workout_id <> p_workout_id
    ) THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Workout name already exists for this user';
    END IF;

    UPDATE workout
    SET name = TRIM(p_name), preferred_day = NULLIF(TRIM(p_preferred_day), '')
    WHERE workout_id = p_workout_id
		AND user_id = p_user_id;

    SELECT p_workout_id AS workout_id;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS delete_workout;
DELIMITER $$
CREATE PROCEDURE delete_workout(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM workout AS w
        WHERE w.workout_id = p_workout_id
			AND w.user_id = p_user_id
    ) THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Workout not found for this user';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM workout_session AS ws
        INNER JOIN workout AS w
            ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id
			AND w.workout_id = p_workout_id
            AND ws.completion_status = 'In Progress'
    ) THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Cannot delete a workout with an in-progress session';
    END IF;

    DELETE FROM workout
    WHERE workout_id = p_workout_id
		AND user_id = p_user_id;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS delete_workout_exercise;
DELIMITER $$
CREATE PROCEDURE delete_workout_exercise(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM workout AS w
        WHERE w.workout_id = p_workout_id
			AND w.user_id = p_user_id
    ) THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Workout not found for this user';
    END IF;

    DELETE FROM workout_exercise
    WHERE workout_id = p_workout_id;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS delete_workout_tags_assignment;
DELIMITER $$
CREATE PROCEDURE delete_workout_tags_assignment(
    p_user_id BIGINT,
    p_workout_id BIGINT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM workout AS w
        WHERE w.workout_id = p_workout_id
			AND w.user_id = p_user_id
    ) THEN
        SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Workout not found for this user';
    END IF;

    DELETE FROM workout_tag_assignment
    WHERE workout_id = p_workout_id;
END $$
DELIMITER ;