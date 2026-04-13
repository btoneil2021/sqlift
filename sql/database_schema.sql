CREATE TABLE sqlift.achievement (
  achievement_id bigint NOT NULL DEFAULT nextval('sqlift.achievement_achievement_id_seq'::regclass),
  name text NOT NULL,
  description text,
  achievement_img_url text,
  CONSTRAINT achievement_pkey PRIMARY KEY (achievement_id)
);
CREATE TABLE sqlift.equipment (
  equipment_id bigint NOT NULL DEFAULT nextval('sqlift.equipment_equipment_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  description text,
  CONSTRAINT equipment_pkey PRIMARY KEY (equipment_id)
);
CREATE TABLE sqlift.exercise (
  exercise_id bigint NOT NULL DEFAULT nextval('sqlift.exercise_exercise_id_seq'::regclass),
  name text NOT NULL,
  description text,
  is_unilateral boolean NOT NULL DEFAULT false,
  instruction text,
  CONSTRAINT exercise_pkey PRIMARY KEY (exercise_id)
);
CREATE TABLE sqlift.exercise_equipment (
  exercise_id bigint NOT NULL DEFAULT nextval('sqlift.exercise_equipment_exercise_id_seq'::regclass),
  equipment_id bigint NOT NULL DEFAULT nextval('sqlift.exercise_equipment_equipment_id_seq'::regclass),
  CONSTRAINT exercise_equipment_pkey PRIMARY KEY (exercise_id, equipment_id),
  CONSTRAINT exercise_equipment_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES sqlift.exercise(exercise_id),
  CONSTRAINT exercise_equipment_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES sqlift.equipment(equipment_id)
);
CREATE TABLE sqlift.exercise_muscle_group (
  exercise_id bigint NOT NULL DEFAULT nextval('sqlift.exercise_muscle_group_exercise_id_seq'::regclass),
  muscle_id bigint NOT NULL DEFAULT nextval('sqlift.exercise_muscle_group_muscle_id_seq'::regclass),
  role USER-DEFINED,
  CONSTRAINT exercise_muscle_group_pkey PRIMARY KEY (exercise_id, muscle_id),
  CONSTRAINT exercise_muscle_group_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES sqlift.exercise(exercise_id),
  CONSTRAINT exercise_muscle_group_muscle_id_fkey FOREIGN KEY (muscle_id) REFERENCES sqlift.muscle_group(muscle_id)
);
CREATE TABLE sqlift.measurement_log (
  user_id bigint NOT NULL,
  date_time timestamp without time zone NOT NULL,
  height numeric,
  weight numeric,
  visual_body_fat_percent numeric,
  neck_measurement numeric,
  shoulder_measurement numeric,
  chest_measurement numeric,
  bicep_measurement numeric,
  forearm_measurement numeric,
  waist_measurement numeric,
  hips_measurement numeric,
  thigh_measurement numeric,
  calve_measurement numeric,
  CONSTRAINT measurement_log_pkey PRIMARY KEY (user_id, date_time),
  CONSTRAINT measurement_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES sqlift.user(user_id)
);
CREATE TABLE sqlift.media (
  url text NOT NULL,
  exercise_id bigint NOT NULL DEFAULT nextval('sqlift.media_exercise_id_seq'::regclass),
  type text NOT NULL,
  CONSTRAINT media_pkey PRIMARY KEY (url),
  CONSTRAINT media_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES sqlift.exercise(exercise_id)
);
CREATE TABLE sqlift.muscle_group (
  muscle_id bigint NOT NULL DEFAULT nextval('sqlift.muscle_group_muscle_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  description text,
  CONSTRAINT muscle_group_pkey PRIMARY KEY (muscle_id)
);
CREATE TABLE sqlift.record_log (
  record_log_id bigint NOT NULL,
  workout_session_id bigint NOT NULL DEFAULT nextval('sqlift.record_log_workout_session_id_seq'::regclass),
  exercise_id bigint NOT NULL DEFAULT nextval('sqlift.record_log_exercise_id_seq'::regclass),
  number integer NOT NULL,
  timestamp timestamp without time zone NOT NULL,
  duration interval,
  CONSTRAINT record_log_pkey PRIMARY KEY (record_log_id),
  CONSTRAINT record_log_workout_session_id_fkey FOREIGN KEY (workout_session_id) REFERENCES sqlift.workout_session(workout_session_id),
  CONSTRAINT record_log_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES sqlift.exercise(exercise_id)
);
CREATE TABLE sqlift.set_log (
  set_log_id bigint NOT NULL DEFAULT nextval('sqlift.set_log_set_log_id_seq'::regclass),
  record_log_id bigint NOT NULL,
  number integer NOT NULL,
  type USER-DEFINED,
  weight numeric,
  reps integer,
  rpe numeric,
  rest_time interval,
  CONSTRAINT set_log_pkey PRIMARY KEY (set_log_id),
  CONSTRAINT set_log_record_log_id_fkey FOREIGN KEY (record_log_id) REFERENCES sqlift.record_log(record_log_id)
);
CREATE TABLE sqlift.user (
  user_id bigint NOT NULL DEFAULT nextval('sqlift.user_user_id_seq'::regclass),
  username text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  height numeric,
  sex text,
  email text NOT NULL UNIQUE,
  phone_num text NOT NULL UNIQUE,
  password text NOT NULL,
  profile_pic_url text,
  CONSTRAINT user_pkey PRIMARY KEY (user_id)
);
CREATE TABLE sqlift.user_achievement (
  user_id bigint NOT NULL DEFAULT nextval('sqlift.user_achievement_user_id_seq'::regclass),
  achievement_id bigint NOT NULL DEFAULT nextval('sqlift.user_achievement_achievement_id_seq'::regclass),
  date_earned date,
  CONSTRAINT user_achievement_pkey PRIMARY KEY (user_id, achievement_id),
  CONSTRAINT user_achievement_user_id_fkey FOREIGN KEY (user_id) REFERENCES sqlift.user(user_id),
  CONSTRAINT user_achievement_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES sqlift.achievement(achievement_id)
);
CREATE TABLE sqlift.user_friendship (
  user_id bigint NOT NULL DEFAULT nextval('sqlift.user_friendship_user_id_seq'::regclass),
  friend_user_id bigint NOT NULL DEFAULT nextval('sqlift.user_friendship_friend_user_id_seq'::regclass),
  friendship_level USER-DEFINED,
  CONSTRAINT user_friendship_pkey PRIMARY KEY (user_id, friend_user_id),
  CONSTRAINT user_friendship_user_id_fkey FOREIGN KEY (user_id) REFERENCES sqlift.user(user_id),
  CONSTRAINT user_friendship_friend_user_id_fkey FOREIGN KEY (friend_user_id) REFERENCES sqlift.user(user_id)
);
CREATE TABLE sqlift.user_goal (
  goal_id bigint NOT NULL DEFAULT nextval('sqlift.user_goal_goal_id_seq'::regclass),
  user_id bigint NOT NULL,
  description text NOT NULL,
  target_date date,
  completion_status text,
  CONSTRAINT user_goal_pkey PRIMARY KEY (goal_id),
  CONSTRAINT user_goal_user_id_fkey FOREIGN KEY (user_id) REFERENCES sqlift.user(user_id)
);
CREATE TABLE sqlift.workout (
  workout_id bigint NOT NULL DEFAULT nextval('sqlift.workout_workout_id_seq'::regclass),
  user_id bigint NOT NULL,
  name text NOT NULL,
  preferred_day text,
  CONSTRAINT workout_pkey PRIMARY KEY (workout_id),
  CONSTRAINT workout_user_id_fkey FOREIGN KEY (user_id) REFERENCES sqlift.user(user_id)
);
CREATE TABLE sqlift.workout_exercise (
  workout_id bigint NOT NULL DEFAULT nextval('sqlift.workout_exercise_workout_id_seq'::regclass),
  sort_order integer NOT NULL,
  exercise_id bigint NOT NULL DEFAULT nextval('sqlift.workout_exercise_exercise_id_seq'::regclass),
  target_sets integer,
  target_reps integer,
  target_weight numeric,
  expected_rest_time interval,
  CONSTRAINT workout_exercise_pkey PRIMARY KEY (workout_id, sort_order),
  CONSTRAINT workout_exercise_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES sqlift.workout(workout_id),
  CONSTRAINT workout_exercise_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES sqlift.exercise(exercise_id)
);
CREATE TABLE sqlift.workout_session (
  workout_session_id bigint NOT NULL,
  workout_id bigint NOT NULL DEFAULT nextval('sqlift.workout_session_workout_id_seq'::regclass),
  start_date_time timestamp without time zone NOT NULL,
  end_date_time timestamp without time zone,
  notes text,
  completion_status USER-DEFINED,
  difficulty_rating integer,
  enjoyment_rating integer,
  energy_level_rating integer,
  CONSTRAINT workout_session_pkey PRIMARY KEY (workout_session_id),
  CONSTRAINT workout_session_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES sqlift.workout(workout_id)
);
CREATE TABLE sqlift.workout_tag (
  name text NOT NULL,
  color_code text,
  CONSTRAINT workout_tag_pkey PRIMARY KEY (name)
);
CREATE TABLE sqlift.workout_tag_assignment (
  workout_id bigint NOT NULL DEFAULT nextval('sqlift.workout_tag_assignment_workout_id_seq'::regclass),
  tag_name text NOT NULL,
  CONSTRAINT workout_tag_assignment_pkey PRIMARY KEY (workout_id, tag_name),
  CONSTRAINT workout_tag_assignment_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES sqlift.workout(workout_id),
  CONSTRAINT workout_tag_assignment_tag_name_fkey FOREIGN KEY (tag_name) REFERENCES sqlift.workout_tag(name)
);