USE sqlift;

DROP PROCEDURE IF EXISTS list_user_workouts;
DELIMITER $$
CREATE PROCEDURE list_user_workouts(
    p_user_id BIGINT
)
BEGIN
    SELECT
        w.workout_id,
        w.name,
        w.preferred_day,
        get_primary_muscle_group_for_workout(w.workout_id) AS primary_muscle_group,
        COALESCE(v.total_sessions, 0) AS total_sessions,
        v.last_started_at
    FROM workout AS w
    LEFT JOIN (
        SELECT
            w2.workout_id,
            COUNT(ws.workout_session_id) AS total_sessions,
            MAX(ws.start_date_time) AS last_started_at
        FROM workout AS w2
        LEFT JOIN workout_session AS ws
            ON ws.workout_id = w2.workout_id
        GROUP BY w2.workout_id
    ) AS v ON v.workout_id = w.workout_id
    WHERE w.user_id = p_user_id
    ORDER BY w.name ASC;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS list_user_workout_tags;
DELIMITER $$

CREATE PROCEDURE list_user_workout_tags(
    p_user_id BIGINT
)
BEGIN
    SELECT
        w.workout_id,
        wt.name AS tag_name,
        wt.color_code
    FROM workout AS w
    INNER JOIN workout_tag_assignment AS wta
        ON wta.workout_id = w.workout_id
    INNER JOIN workout_tag AS wt
        ON wt.name = wta.tag_name
    WHERE w.user_id = p_user_id
    ORDER BY w.name ASC, wt.name ASC;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS get_exercise_by_id;
DELIMITER $$
CREATE PROCEDURE get_exercise_by_id(
    p_exercise_id BIGINT
)
BEGIN
    SELECT
        e.exercise_id,
        e.name,
        e.description,
        e.instruction,
        e.is_unilateral
    FROM exercise AS e
    WHERE e.exercise_id = p_exercise_id;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS get_exercise_muscle_groups;
DELIMITER $$
CREATE PROCEDURE get_exercise_muscle_groups(
    p_exercise_id BIGINT
)
BEGIN
    SELECT
        mg.name,
        emg.role
    FROM exercise_muscle_group AS emg
    INNER JOIN muscle_group AS mg
        ON mg.muscle_id = emg.muscle_id
    WHERE emg.exercise_id = p_exercise_id
    ORDER BY emg.role ASC, mg.name ASC;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS get_exercise_equipment;
DELIMITER $$
CREATE PROCEDURE get_exercise_equipment(
    p_exercise_id BIGINT
)
BEGIN
    SELECT
        eq.equipment_id,
        eq.name,
        eq.description
    FROM exercise_equipment AS ee
    INNER JOIN equipment AS eq
        ON eq.equipment_id = ee.equipment_id
    WHERE ee.exercise_id = p_exercise_id
    ORDER BY eq.name ASC;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS get_exercise_media;
DELIMITER $$
CREATE PROCEDURE get_exercise_media(
    p_exercise_id BIGINT
)
BEGIN
    SELECT
        m.url,
        m.type
    FROM media AS m
    WHERE m.exercise_id = p_exercise_id
    ORDER BY m.url ASC;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS get_exercise_library;
DELIMITER $$
CREATE PROCEDURE get_exercise_library()
BEGIN
    SELECT
        e.exercise_id,
        e.name,
        e.description,
        e.is_unilateral
    FROM exercise AS e
    ORDER BY e.name ASC;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS get_exercise_library_muscle_groups;
DELIMITER $$
CREATE PROCEDURE get_exercise_library_muscle_groups()
BEGIN
    SELECT
        emg.exercise_id,
        mg.name,
        emg.role
    FROM exercise_muscle_group AS emg
    INNER JOIN muscle_group AS mg
        ON mg.muscle_id = emg.muscle_id
    ORDER BY emg.exercise_id ASC, emg.role ASC, mg.name ASC;
END $$
DELIMITER ;

DROP PROCEDURE IF EXISTS get_exercise_library_equipment;
DELIMITER $$
CREATE PROCEDURE get_exercise_library_equipment()
BEGIN
    SELECT
        ee.exercise_id,
        eq.equipment_id,
        eq.name,
        eq.description
    FROM exercise_equipment AS ee
    INNER JOIN equipment eq
        ON eq.equipment_id = ee.equipment_id
    ORDER BY ee.exercise_id ASC, eq.name ASC;
END $$
DELIMITER ;