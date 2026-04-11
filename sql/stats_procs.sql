SET search_path TO sqlift;

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
