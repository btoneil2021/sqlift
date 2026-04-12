-- leaderboard 
-- Ranks the logged-in user + their friends by total lift volume (weight x reps).
CREATE OR REPLACE FUNCTION sqlift.fn_get_leaderboard(
    p_user_id BIGINT
)
RETURNS JSONB
LANGUAGE sql
SET search_path = sqlift
AS $$
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'user_id',        ranked.user_id,
                'username',       ranked.username,
                'total_volume',   ranked.total_volume,
                'max_weight',     ranked.max_weight,
                'sessions_done',  ranked.sessions_done,
                'rank',           ranked.rank,
                'is_me',          ranked.user_id = p_user_id
            )
            ORDER BY ranked.rank ASC
        ),
        '[]'::JSONB
    )
    FROM (
        SELECT
            u.user_id,
            u.username,
            COALESCE(SUM(sl.weight * sl.reps), 0)   AS total_volume,
            COALESCE(MAX(sl.weight), 0)              AS max_weight,
            COUNT(DISTINCT ws.workout_session_id)    AS sessions_done,
            RANK() OVER (
                ORDER BY COALESCE(SUM(sl.weight * sl.reps), 0) DESC
            ) AS rank
        FROM "user" u
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
    ) ranked;
$$;
