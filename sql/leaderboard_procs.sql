USE sqlift;

-- Ranks the logged-in user + their friends by total lift volume (weight x reps).
DROP PROCEDURE IF EXISTS get_leaderboard;
DELIMITER $$
CREATE PROCEDURE get_leaderboard(p_user_id BIGINT)
BEGIN
    SELECT
        u.user_id,
        u.username,
        COALESCE(SUM(sl.weight * sl.reps), 0)         AS total_volume,
        COALESCE(MAX(sl.weight), 0)                    AS max_weight,
        COUNT(DISTINCT ws.workout_session_id)          AS sessions_done,
        RANK() OVER (
            ORDER BY COALESCE(SUM(sl.weight * sl.reps), 0) DESC
        )                                              AS `rank`,
        (u.user_id = p_user_id)                        AS is_me
    FROM user u
    LEFT JOIN workout w
        ON w.user_id = u.user_id
    LEFT JOIN workout_session ws
        ON ws.workout_id = w.workout_id
        AND ws.completion_status = 'Completed'
    LEFT JOIN record_log rl
        ON rl.workout_session_id = ws.workout_session_id
    LEFT JOIN set_log sl
        ON sl.record_log_id = rl.record_log_id
    WHERE
        u.user_id = p_user_id
        OR u.user_id IN (
            SELECT uf.friend_user_id
            FROM user_friendship uf
            WHERE uf.user_id = p_user_id
        )
    GROUP BY u.user_id, u.username
    ORDER BY `rank` ASC;
END $$
DELIMITER ;

-- Ranks ALL users by total lift volume (weight x reps).
DROP PROCEDURE IF EXISTS get_global_leaderboard;
DELIMITER $$
CREATE PROCEDURE get_global_leaderboard(p_user_id BIGINT)
BEGIN
    SELECT
        u.user_id,
        u.username,
        COALESCE(SUM(sl.weight * sl.reps), 0)         AS total_volume,
        COALESCE(MAX(sl.weight), 0)                    AS max_weight,
        COUNT(DISTINCT ws.workout_session_id)          AS sessions_done,
        RANK() OVER (
            ORDER BY COALESCE(SUM(sl.weight * sl.reps), 0) DESC
        )                                              AS `rank`,
        (u.user_id = p_user_id)                        AS is_me
    FROM user u
    LEFT JOIN workout w
        ON w.user_id = u.user_id
    LEFT JOIN workout_session ws
        ON ws.workout_id = w.workout_id
        AND ws.completion_status = 'Completed'
    LEFT JOIN record_log rl
        ON rl.workout_session_id = ws.workout_session_id
    LEFT JOIN set_log sl
        ON sl.record_log_id = rl.record_log_id
    GROUP BY u.user_id, u.username
    ORDER BY `rank` ASC;
END $$
DELIMITER ;
