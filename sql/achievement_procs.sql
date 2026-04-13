SET search_path TO sqlift;

-- Seed canonical achievements (safe to re-run)
INSERT INTO sqlift.achievement (name, description) VALUES
  -- Onboarding
  ('Baptism by Iron',       'Complete your first workout session'),
  ('Goal Setter',           'Define your first fitness goal'),
  -- Consistency & Streaks
  ('Habit Former',          'Complete 3 workouts in a single calendar week'),
  ('Unstoppable',           'Maintain a 7-day consecutive workout streak'),
  ('Early Bird',            'Complete a workout before 7:00 AM'),
  ('Night Owl',             'Complete a workout after 10:00 PM'),
  ('Venerated Veteran',     'Complete 100 total workout sessions'),
  -- Performance & Strength
  ('PR Crusher',            'Set a personal record on any exercise'),
  ('Volume King',           'Move over 10,000 lbs in a single session'),
  ('Century Club',          'Perform a set with 100 or more reps'),
  ('Heavy Hitter',          'Lift 315 lbs or more in a single set'),
  ('No Pain No Gain',       'Log a session with an average RPE of 9 or higher'),
  -- Social
  ('Socialite',             'Add your first friend'),
  ('Squad Goals',           'Have 5 or more confirmed friends'),
  -- Knowledge & Tracking
  ('Bio Tracker',           'Log your body measurements in 4 different weeks'),
  ('Transformation Start',  'Log your weight at least twice to track progress'),
  ('Muscle Scholar',        'Work out 5 different muscle groups in one week'),
  ('Tool Master',           'Use 10 different types of equipment'),
  -- Special / Milestone
  ('The Architect',         'Create 10 custom workout templates'),
  ('Completionist',         'Complete every planned set in a full workout session')
ON CONFLICT (name) DO NOTHING;


-- Evaluates all achievement conditions for p_user_id, awards any newly earned ones
CREATE OR REPLACE FUNCTION evaluate_and_get_achievements(p_user_id BIGINT, p_timezone TEXT DEFAULT 'UTC')
RETURNS TABLE (
    achievement_id      BIGINT,
    name                TEXT,
    description         TEXT,
    achievement_img_url TEXT,
    date_earned         DATE
) AS $$
DECLARE
    v_total_sessions     BIGINT;
    v_max_session_vol_kg NUMERIC;
    v_heaviest_set_kg    NUMERIC;
    v_max_reps           INTEGER;
    v_longest_streak     INTEGER;
    v_pr_count           INTEGER;
    v_workout_count      INTEGER;
    -- Consistency
    v_habit_formed       BOOLEAN;
    v_early_bird         BOOLEAN;
    v_night_owl          BOOLEAN;
    -- Performance
    v_high_rpe_session   BOOLEAN;
    -- Social
    v_confirmed_friends  INTEGER;
    -- Tracking
    v_goal_count         INTEGER;
    v_measurement_weeks  INTEGER;
    v_weight_entries     INTEGER;
    v_muscle_scholar     BOOLEAN;
    v_equipment_count    INTEGER;
    -- Milestone
    v_completionist      BOOLEAN;
BEGIN
    SELECT h.total_sessions, h.max_session_volume_kg, h.heaviest_set_kg, h.max_reps_in_set
    INTO v_total_sessions, v_max_session_vol_kg, v_heaviest_set_kg, v_max_reps
    FROM sqlift.get_user_hero_stats(p_user_id) h;

    SELECT s.longest_streak INTO v_longest_streak
    FROM sqlift.get_user_daily_streaks(p_user_id) s;

    SELECT COUNT(*)::INTEGER INTO v_pr_count
    FROM sqlift.get_user_exercise_prs(p_user_id);

    SELECT COUNT(*)::INTEGER INTO v_workout_count
    FROM sqlift.workout WHERE user_id = p_user_id;

    -- ── Consistency ───────────────────────────────────────────────────────────
    SELECT EXISTS (
        SELECT 1 FROM (
            SELECT COUNT(*) AS week_sessions
            FROM sqlift.workout_session ws
            JOIN sqlift.workout w ON w.workout_id = ws.workout_id
            WHERE w.user_id = p_user_id AND ws.completion_status = 'Completed'
            GROUP BY DATE_TRUNC('week', ws.start_date_time)
            HAVING COUNT(*) >= 3
        ) sub
    ) INTO v_habit_formed;

    -- Any completed session starting before 07:00 (in user's local timezone)
    SELECT EXISTS (
        SELECT 1
        FROM sqlift.workout_session ws
        JOIN sqlift.workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id
          AND ws.completion_status = 'Completed'
          AND EXTRACT(HOUR FROM (ws.start_date_time AT TIME ZONE 'UTC' AT TIME ZONE p_timezone)) < 7
    ) INTO v_early_bird;

    -- Any completed session starting at or after 22:00 (in user's local timezone)
    SELECT EXISTS (
        SELECT 1
        FROM sqlift.workout_session ws
        JOIN sqlift.workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id
          AND ws.completion_status = 'Completed'
          AND EXTRACT(HOUR FROM (ws.start_date_time AT TIME ZONE 'UTC' AT TIME ZONE p_timezone)) >= 22
    ) INTO v_night_owl;

    -- ── Performance ───────────────────────────────────────────────────────────
    SELECT EXISTS (
        SELECT 1
        FROM (
            SELECT AVG(sl.rpe) AS avg_rpe
            FROM sqlift.set_log sl
            JOIN sqlift.record_log rl ON rl.record_log_id = sl.record_log_id
            JOIN sqlift.workout_session ws ON ws.workout_session_id = rl.workout_session_id
            JOIN sqlift.workout w ON w.workout_id = ws.workout_id
            WHERE w.user_id = p_user_id
              AND ws.completion_status = 'Completed'
              AND sl.rpe IS NOT NULL
            GROUP BY rl.workout_session_id
            HAVING AVG(sl.rpe) >= 9
        ) rpe_check
    ) INTO v_high_rpe_session;

    -- ── Social ────────────────────────────────────────────────────────────────
    SELECT COUNT(*)::INTEGER INTO v_confirmed_friends
    FROM sqlift.user_friendship uf
    WHERE uf.user_id = p_user_id
      AND uf.friendship_level = 'Full'
      AND EXISTS (
          SELECT 1 FROM sqlift.user_friendship rev
          WHERE rev.user_id = uf.friend_user_id
            AND rev.friend_user_id = p_user_id
            AND rev.friendship_level = 'Full'
      );

    -- ── Knowledge & Tracking ──────────────────────────────────────────────────
    SELECT COUNT(*)::INTEGER INTO v_goal_count
    FROM sqlift.user_goal WHERE user_id = p_user_id;

    -- Distinct calendar weeks that have a measurement log entry
    SELECT COUNT(DISTINCT DATE_TRUNC('week', ml.date_time))::INTEGER INTO v_measurement_weeks
    FROM sqlift.measurement_log ml
    WHERE ml.user_id = p_user_id;

    -- Number of weight entries logged
    SELECT COUNT(*)::INTEGER INTO v_weight_entries
    FROM sqlift.measurement_log ml
    WHERE ml.user_id = p_user_id AND ml.weight IS NOT NULL;

    -- 5+ distinct muscle groups worked in any single calendar week
    SELECT EXISTS (
        SELECT 1 FROM (
            SELECT COUNT(DISTINCT emg.muscle_id) AS muscles
            FROM sqlift.workout_session ws
            JOIN sqlift.workout w ON w.workout_id = ws.workout_id
            JOIN sqlift.record_log rl ON rl.workout_session_id = ws.workout_session_id
            JOIN sqlift.exercise_muscle_group emg ON emg.exercise_id = rl.exercise_id
            WHERE w.user_id = p_user_id
              AND ws.completion_status = 'Completed'
            GROUP BY DATE_TRUNC('week', ws.start_date_time)
            HAVING COUNT(DISTINCT emg.muscle_id) >= 5
        ) muscle_check
    ) INTO v_muscle_scholar;

    -- Distinct equipment types ever used
    SELECT COUNT(DISTINCT ee.equipment_id)::INTEGER INTO v_equipment_count
    FROM sqlift.record_log rl
    JOIN sqlift.workout_session ws ON ws.workout_session_id = rl.workout_session_id
    JOIN sqlift.workout w ON w.workout_id = ws.workout_id
    JOIN sqlift.exercise_equipment ee ON ee.exercise_id = rl.exercise_id
    WHERE w.user_id = p_user_id
      AND ws.completion_status = 'Completed';

    -- ── Milestone ────────────────────────────────────────────────────────────
    SELECT EXISTS (
        SELECT 1
        FROM (
            SELECT
                ws.workout_session_id,
                COUNT(*) FILTER (
                    WHERE actual_sets.set_count >= we.target_sets
                ) AS exercises_complete,
                COUNT(*) AS exercises_total
            FROM sqlift.workout_session ws
            JOIN sqlift.workout w ON w.workout_id = ws.workout_id
            JOIN sqlift.workout_exercise we ON we.workout_id = ws.workout_id
            LEFT JOIN (
                SELECT rl.workout_session_id, rl.exercise_id, COUNT(*)::INTEGER AS set_count
                FROM sqlift.set_log sl
                JOIN sqlift.record_log rl ON rl.record_log_id = sl.record_log_id
                GROUP BY rl.workout_session_id, rl.exercise_id
            ) actual_sets ON actual_sets.workout_session_id = ws.workout_session_id
                          AND actual_sets.exercise_id = we.exercise_id
            WHERE w.user_id = p_user_id
              AND ws.completion_status = 'Completed'
              AND we.target_sets IS NOT NULL
            GROUP BY ws.workout_session_id
            HAVING COUNT(*) > 0
               AND COUNT(*) FILTER (
                       WHERE actual_sets.set_count >= we.target_sets
                   ) = COUNT(*)
        ) complete_sessions
    ) INTO v_completionist;

    -- ── Award newly earned achievements ───────────────────────────────────────
    INSERT INTO sqlift.user_achievement (user_id, achievement_id, date_earned)
    SELECT p_user_id, a.achievement_id, CURRENT_DATE
    FROM sqlift.achievement a
    WHERE (a.name = 'Baptism by Iron'      AND v_total_sessions >= 1)
       OR (a.name = 'Goal Setter'          AND v_goal_count >= 1)
       OR (a.name = 'Habit Former'         AND v_habit_formed = TRUE)
       OR (a.name = 'Unstoppable'          AND v_longest_streak >= 7)
       OR (a.name = 'Early Bird'           AND v_early_bird = TRUE)
       OR (a.name = 'Night Owl'            AND v_night_owl = TRUE)
       OR (a.name = 'Venerated Veteran'    AND v_total_sessions >= 100)
       OR (a.name = 'PR Crusher'           AND v_pr_count >= 1)
       OR (a.name = 'Volume King'          AND v_max_session_vol_kg >= 4535)
       OR (a.name = 'Century Club'         AND v_max_reps >= 100)
       OR (a.name = 'Heavy Hitter'         AND v_heaviest_set_kg >= 143)
       OR (a.name = 'No Pain No Gain'      AND v_high_rpe_session = TRUE)
       OR (a.name = 'Socialite'            AND v_confirmed_friends >= 1)
       OR (a.name = 'Squad Goals'          AND v_confirmed_friends >= 5)
       OR (a.name = 'Bio Tracker'          AND v_measurement_weeks >= 4)
       OR (a.name = 'Transformation Start' AND v_weight_entries >= 2)
       OR (a.name = 'Muscle Scholar'       AND v_muscle_scholar = TRUE)
       OR (a.name = 'Tool Master'          AND v_equipment_count >= 10)
       OR (a.name = 'The Architect'        AND v_workout_count >= 10)
       OR (a.name = 'Completionist'        AND v_completionist = TRUE)
    ON CONFLICT ON CONSTRAINT user_achievement_pkey DO NOTHING;

    -- ── Return all earned achievements ────────────────────────────────────────
    RETURN QUERY
    SELECT a.achievement_id, a.name, a.description, a.achievement_img_url, ua.date_earned
    FROM sqlift.user_achievement ua
    JOIN sqlift.achievement a ON a.achievement_id = ua.achievement_id
    WHERE ua.user_id = p_user_id
    ORDER BY ua.date_earned ASC, a.achievement_id ASC;
END;
$$ LANGUAGE plpgsql;
