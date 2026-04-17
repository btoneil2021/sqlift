USE sqlift;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed canonical achievements (safe to re-run)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO achievement (name, description) VALUES
  ('Baptism by Iron',       'Complete your first workout session'),
  ('Goal Setter',           'Define your first fitness goal'),
  ('Habit Former',          'Complete 3 workouts in a single calendar week'),
  ('Unstoppable',           'Maintain a 7-day consecutive workout streak'),
  ('Early Bird',            'Complete a workout before 7:00 AM'),
  ('Night Owl',             'Complete a workout after 10:00 PM'),
  ('Venerated Veteran',     'Complete 100 total workout sessions'),
  ('PR Crusher',            'Set a personal record on any exercise'),
  ('Volume King',           'Move over 10,000 lbs in a single session'),
  ('Century Club',          'Perform a set with 100 or more reps'),
  ('Heavy Hitter',          'Lift 315 lbs or more in a single set'),
  ('No Pain No Gain',       'Log a session with an average RPE of 9 or higher'),
  ('Socialite',             'Add your first friend'),
  ('Squad Goals',           'Have 5 or more confirmed friends'),
  ('Bio Tracker',           'Log your body measurements in 4 different weeks'),
  ('Transformation Start',  'Log your weight at least twice to track progress'),
  ('Muscle Scholar',        'Work out 5 different muscle groups in one week'),
  ('Tool Master',           'Use 10 different types of equipment'),
  ('The Architect',         'Create 10 custom workout templates'),
  ('Completionist',         'Complete every planned set in a full workout session');


-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_total_completed_sessions;
DELIMITER $$
CREATE FUNCTION ach_total_completed_sessions(p_user_id BIGINT)
RETURNS INT NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v INT;
    SELECT COUNT(*) INTO v
    FROM workout_session ws
    JOIN workout w ON w.workout_id = ws.workout_id
    WHERE w.user_id = p_user_id AND ws.completion_status = 'Completed';
    RETURN COALESCE(v, 0);
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_goal_count;
DELIMITER $$
CREATE FUNCTION ach_goal_count(p_user_id BIGINT)
RETURNS INT NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v INT;
    SELECT COUNT(*) INTO v FROM user_goal WHERE user_id = p_user_id;
    RETURN COALESCE(v, 0);
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_longest_daily_streak;
DELIMITER $$
CREATE FUNCTION ach_longest_daily_streak(p_user_id BIGINT)
RETURNS INT NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v INT;
    WITH workout_days AS (
        SELECT DISTINCT DATE(ws.start_date_time) AS day
        FROM workout_session ws
        JOIN workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id AND ws.completion_status = 'Completed'
    ),
    numbered AS (
        SELECT day,
               DATE_SUB(day, INTERVAL ROW_NUMBER() OVER (ORDER BY day) DAY) AS grp
        FROM workout_days
    ),
    runs AS (
        SELECT COUNT(*) AS run_len FROM numbered GROUP BY grp
    )
    SELECT COALESCE(MAX(run_len), 0) INTO v FROM runs;
    RETURN COALESCE(v, 0);
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_habit_formed;
DELIMITER $$
CREATE FUNCTION ach_habit_formed(p_user_id BIGINT)
RETURNS TINYINT(1) NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v TINYINT(1) DEFAULT 0;
    SELECT COUNT(*) > 0 INTO v
    FROM (
        SELECT 1
        FROM workout_session ws
        JOIN workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id AND ws.completion_status = 'Completed'
        GROUP BY YEARWEEK(ws.start_date_time, 1)
        HAVING COUNT(*) >= 3
    ) sub;
    RETURN v;
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_early_bird;
DELIMITER $$
CREATE FUNCTION ach_early_bird(p_user_id BIGINT)
RETURNS TINYINT(1) NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v TINYINT(1) DEFAULT 0;
    SELECT COUNT(*) > 0 INTO v
    FROM workout_session ws
    JOIN workout w ON w.workout_id = ws.workout_id
    WHERE w.user_id = p_user_id
      AND ws.completion_status = 'Completed'
      AND HOUR(ws.start_date_time) < 7;
    RETURN v;
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_night_owl;
DELIMITER $$
CREATE FUNCTION ach_night_owl(p_user_id BIGINT)
RETURNS TINYINT(1) NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v TINYINT(1) DEFAULT 0;
    SELECT COUNT(*) > 0 INTO v
    FROM workout_session ws
    JOIN workout w ON w.workout_id = ws.workout_id
    WHERE w.user_id = p_user_id
      AND ws.completion_status = 'Completed'
      AND HOUR(ws.start_date_time) >= 22;
    RETURN v;
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_max_session_volume_kg;
DELIMITER $$
CREATE FUNCTION ach_max_session_volume_kg(p_user_id BIGINT)
RETURNS DECIMAL(12,2) NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v DECIMAL(12,2);
    SELECT COALESCE(MAX(session_vol), 0) INTO v
    FROM (
        SELECT SUM(sl.weight * sl.reps) AS session_vol
        FROM set_log sl
        JOIN record_log rl ON rl.record_log_id = sl.record_log_id
        JOIN workout_session ws ON ws.workout_session_id = rl.workout_session_id
        JOIN workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id AND ws.completion_status = 'Completed'
        GROUP BY ws.workout_session_id
    ) vol;
    RETURN COALESCE(v, 0);
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_heaviest_set_kg;
DELIMITER $$
CREATE FUNCTION ach_heaviest_set_kg(p_user_id BIGINT)
RETURNS DECIMAL(8,2) NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v DECIMAL(8,2);
    SELECT COALESCE(MAX(sl.weight), 0) INTO v
    FROM set_log sl
    JOIN record_log rl ON rl.record_log_id = sl.record_log_id
    JOIN workout_session ws ON ws.workout_session_id = rl.workout_session_id
    JOIN workout w ON w.workout_id = ws.workout_id
    WHERE w.user_id = p_user_id AND ws.completion_status = 'Completed';
    RETURN COALESCE(v, 0);
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_max_reps;
DELIMITER $$
CREATE FUNCTION ach_max_reps(p_user_id BIGINT)
RETURNS INT NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v INT;
    SELECT COALESCE(MAX(sl.reps), 0) INTO v
    FROM set_log sl
    JOIN record_log rl ON rl.record_log_id = sl.record_log_id
    JOIN workout_session ws ON ws.workout_session_id = rl.workout_session_id
    JOIN workout w ON w.workout_id = ws.workout_id
    WHERE w.user_id = p_user_id AND ws.completion_status = 'Completed';
    RETURN COALESCE(v, 0);
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_pr_count;
DELIMITER $$
CREATE FUNCTION ach_pr_count(p_user_id BIGINT)
RETURNS INT NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v INT;
    SELECT COUNT(DISTINCT rl.exercise_id) INTO v
    FROM set_log sl
    JOIN record_log rl ON rl.record_log_id = sl.record_log_id
    JOIN workout_session ws ON ws.workout_session_id = rl.workout_session_id
    JOIN workout w ON w.workout_id = ws.workout_id
    WHERE w.user_id = p_user_id
      AND ws.completion_status = 'Completed'
      AND sl.weight IS NOT NULL
      AND sl.weight > 0;
    RETURN COALESCE(v, 0);
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_high_rpe_session;
DELIMITER $$
CREATE FUNCTION ach_high_rpe_session(p_user_id BIGINT)
RETURNS TINYINT(1) NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v TINYINT(1) DEFAULT 0;
    SELECT COUNT(*) > 0 INTO v
    FROM (
        SELECT 1
        FROM set_log sl
        JOIN record_log rl ON rl.record_log_id = sl.record_log_id
        JOIN workout_session ws ON ws.workout_session_id = rl.workout_session_id
        JOIN workout w ON w.workout_id = ws.workout_id
        WHERE w.user_id = p_user_id
          AND ws.completion_status = 'Completed'
          AND sl.rpe IS NOT NULL
        GROUP BY rl.workout_session_id
        HAVING AVG(sl.rpe) >= 9
    ) rpe_check;
    RETURN v;
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_confirmed_friends_count;
DELIMITER $$
CREATE FUNCTION ach_confirmed_friends_count(p_user_id BIGINT)
RETURNS INT NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v INT;
    SELECT COUNT(*) INTO v
    FROM user_friendship uf
    WHERE uf.user_id = p_user_id
      AND uf.friendship_level = 'Full'
      AND EXISTS (
          SELECT 1 FROM user_friendship rev
          WHERE rev.user_id = uf.friend_user_id
            AND rev.friend_user_id = p_user_id
            AND rev.friendship_level = 'Full'
      );
    RETURN COALESCE(v, 0);
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_measurement_weeks;
DELIMITER $$
CREATE FUNCTION ach_measurement_weeks(p_user_id BIGINT)
RETURNS INT NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v INT;
    SELECT COUNT(DISTINCT YEARWEEK(date_time, 1)) INTO v
    FROM measurement_log
    WHERE user_id = p_user_id AND weight IS NOT NULL;
    RETURN COALESCE(v, 0);
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_weight_entries;
DELIMITER $$
CREATE FUNCTION ach_weight_entries(p_user_id BIGINT)
RETURNS INT NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v INT;
    SELECT COUNT(*) INTO v
    FROM measurement_log
    WHERE user_id = p_user_id AND weight IS NOT NULL;
    RETURN COALESCE(v, 0);
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_muscle_scholar;
DELIMITER $$
CREATE FUNCTION ach_muscle_scholar(p_user_id BIGINT)
RETURNS TINYINT(1) NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v TINYINT(1) DEFAULT 0;
    SELECT COUNT(*) > 0 INTO v
    FROM (
        SELECT 1
        FROM workout_session ws
        JOIN workout w ON w.workout_id = ws.workout_id
        JOIN record_log rl ON rl.workout_session_id = ws.workout_session_id
        JOIN exercise_muscle_group emg ON emg.exercise_id = rl.exercise_id
        WHERE w.user_id = p_user_id AND ws.completion_status = 'Completed'
        GROUP BY YEARWEEK(ws.start_date_time, 1)
        HAVING COUNT(DISTINCT emg.muscle_id) >= 5
    ) mc;
    RETURN v;
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_equipment_count;
DELIMITER $$
CREATE FUNCTION ach_equipment_count(p_user_id BIGINT)
RETURNS INT NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v INT;
    SELECT COUNT(DISTINCT ee.equipment_id) INTO v
    FROM record_log rl
    JOIN workout_session ws ON ws.workout_session_id = rl.workout_session_id
    JOIN workout w ON w.workout_id = ws.workout_id
    JOIN exercise_equipment ee ON ee.exercise_id = rl.exercise_id
    WHERE w.user_id = p_user_id AND ws.completion_status = 'Completed';
    RETURN COALESCE(v, 0);
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_workout_template_count;
DELIMITER $$
CREATE FUNCTION ach_workout_template_count(p_user_id BIGINT)
RETURNS INT NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v INT;
    SELECT COUNT(*) INTO v FROM workout WHERE user_id = p_user_id;
    RETURN COALESCE(v, 0);
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS ach_completionist;
DELIMITER $$
CREATE FUNCTION ach_completionist(p_user_id BIGINT)
RETURNS TINYINT(1) NOT DETERMINISTIC READS SQL DATA
BEGIN
    DECLARE v TINYINT(1) DEFAULT 0;
    SELECT COUNT(*) > 0 INTO v
    FROM (
        SELECT ws.workout_session_id,
               SUM(CASE WHEN COALESCE(a.set_count, 0) >= we.target_sets THEN 1 ELSE 0 END) AS complete_ex,
               COUNT(*) AS total_ex
        FROM workout_session ws
        JOIN workout w ON w.workout_id = ws.workout_id
        JOIN workout_exercise we ON we.workout_id = ws.workout_id
        LEFT JOIN (
            SELECT rl.workout_session_id, rl.exercise_id, COUNT(*) AS set_count
            FROM set_log sl
            JOIN record_log rl ON rl.record_log_id = sl.record_log_id
            GROUP BY rl.workout_session_id, rl.exercise_id
        ) a ON a.workout_session_id = ws.workout_session_id
           AND a.exercise_id = we.exercise_id
        WHERE w.user_id = p_user_id
          AND ws.completion_status = 'Completed'
          AND we.target_sets IS NOT NULL
        GROUP BY ws.workout_session_id
        HAVING COUNT(*) > 0 AND complete_ex = COUNT(*)
    ) comp;
    RETURN v;
END $$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────

DROP PROCEDURE IF EXISTS evaluate_and_get_achievements;
DELIMITER $$
CREATE PROCEDURE evaluate_and_get_achievements(p_user_id BIGINT)
BEGIN
    -- Collect all computed check values once
    DECLARE v_total_sessions     INT     DEFAULT ach_total_completed_sessions(p_user_id);
    DECLARE v_goal_count         INT     DEFAULT ach_goal_count(p_user_id);
    DECLARE v_longest_streak     INT     DEFAULT ach_longest_daily_streak(p_user_id);
    DECLARE v_habit_formed       TINYINT DEFAULT ach_habit_formed(p_user_id);
    DECLARE v_early_bird         TINYINT DEFAULT ach_early_bird(p_user_id);
    DECLARE v_night_owl          TINYINT DEFAULT ach_night_owl(p_user_id);
    DECLARE v_max_vol_kg         DECIMAL(12,2) DEFAULT ach_max_session_volume_kg(p_user_id);
    DECLARE v_heaviest_kg        DECIMAL(8,2)  DEFAULT ach_heaviest_set_kg(p_user_id);
    DECLARE v_max_reps           INT     DEFAULT ach_max_reps(p_user_id);
    DECLARE v_pr_count           INT     DEFAULT ach_pr_count(p_user_id);
    DECLARE v_high_rpe           TINYINT DEFAULT ach_high_rpe_session(p_user_id);
    DECLARE v_friends            INT     DEFAULT ach_confirmed_friends_count(p_user_id);
    DECLARE v_measure_weeks      INT     DEFAULT ach_measurement_weeks(p_user_id);
    DECLARE v_weight_entries     INT     DEFAULT ach_weight_entries(p_user_id);
    DECLARE v_muscle_scholar     TINYINT DEFAULT ach_muscle_scholar(p_user_id);
    DECLARE v_equip_count        INT     DEFAULT ach_equipment_count(p_user_id);
    DECLARE v_template_count     INT     DEFAULT ach_workout_template_count(p_user_id);
    DECLARE v_completionist      TINYINT DEFAULT ach_completionist(p_user_id);

    -- Award any newly earned achievements (INSERT IGNORE skips already-earned ones)
    INSERT IGNORE INTO user_achievement (user_id, achievement_id, date_earned)
    SELECT p_user_id, a.achievement_id, CURDATE()
    FROM achievement a
    WHERE
       (a.name = 'Baptism by Iron'      AND v_total_sessions  >= 1)
    OR (a.name = 'Goal Setter'          AND v_goal_count       >= 1)
    OR (a.name = 'Habit Former'         AND v_habit_formed      = 1)
    OR (a.name = 'Unstoppable'          AND v_longest_streak   >= 7)
    OR (a.name = 'Early Bird'           AND v_early_bird        = 1)
    OR (a.name = 'Night Owl'            AND v_night_owl         = 1)
    OR (a.name = 'Venerated Veteran'    AND v_total_sessions  >= 100)
    OR (a.name = 'PR Crusher'           AND v_pr_count          >= 1)
    OR (a.name = 'Volume King'          AND v_max_vol_kg       >= 4535)
    OR (a.name = 'Century Club'         AND v_max_reps         >= 100)
    OR (a.name = 'Heavy Hitter'         AND v_heaviest_kg      >= 143)
    OR (a.name = 'No Pain No Gain'      AND v_high_rpe          = 1)
    OR (a.name = 'Socialite'            AND v_friends           >= 1)
    OR (a.name = 'Squad Goals'          AND v_friends           >= 5)
    OR (a.name = 'Bio Tracker'          AND v_measure_weeks     >= 4)
    OR (a.name = 'Transformation Start' AND v_weight_entries    >= 2)
    OR (a.name = 'Muscle Scholar'       AND v_muscle_scholar    = 1)
    OR (a.name = 'Tool Master'          AND v_equip_count       >= 10)
    OR (a.name = 'The Architect'        AND v_template_count    >= 10)
    OR (a.name = 'Completionist'        AND v_completionist     = 1);

    -- Return all achievements this user has earned
    SELECT a.achievement_id, a.name, a.description, a.achievement_img_url, ua.date_earned
    FROM user_achievement ua
    JOIN achievement a ON a.achievement_id = ua.achievement_id
    WHERE ua.user_id = p_user_id
    ORDER BY ua.date_earned ASC, a.achievement_id ASC;
END $$
DELIMITER ;
