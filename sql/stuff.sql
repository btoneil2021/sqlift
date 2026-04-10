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
        rl.number AS number,
        rl.timestamp AS timestamp,
        rl.duration AS duration,
        COALESCE(COUNT(sl.set_log_id)) AS set_count
    FROM record_log rl
    LEFT JOIN set_log sl
        ON rl.record_log_id = sl.record_log_id
    LEFT JOIN exercise e
        ON rl.exercise_id = e.exercise_id
    GROUP BY rl.record_log_id, rl.workout_session_id, e.exercise_id, 
        e.name,rl.number, rl.timestamp, rl.duration;

CREATE OR REPLACE FUNCTION fn_compute_workout_primary_muscle_group(p_workout_id BIGINT)
RETURNS TEXT
LANGUAGE sql
AS $$
    SELECT mg.name
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
    name TEXT,
    color_code TEXT
)
LANGUAGE sql
AS $$
    SELECT wt.name, wt.color_code
    FROM workout_tag wt
    ORDER BY wt.name
$$;