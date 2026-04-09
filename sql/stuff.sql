CREATE VIEW vw_workout_history_summary AS 
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

CREATE VIEW vw_record_log_summary AS
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