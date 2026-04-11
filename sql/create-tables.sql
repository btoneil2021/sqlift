CREATE SCHEMA IF NOT EXISTS sqlift;
SET search_path TO sqlift;


CREATE TYPE friendship_level AS ENUM (
  'Private',
  'Basic',
  'Full'
);


CREATE TYPE workout_session_status AS ENUM (
  'Not Started',
  'In Progress',
  'Completed'
);


CREATE TYPE muscle_role AS ENUM (
  'Primary',
  'Secondary',
  'Stabilizer'
);


CREATE TYPE set_type AS ENUM (
  'Warm-up',
  'Working',
  'Drop'
);


CREATE TABLE "user" (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  height DECIMAL(6,2),
  sex TEXT,
  email TEXT NOT NULL,
  phone_num TEXT NOT NULL,
  password TEXT NOT NULL,
  profile_pic_url TEXT,


  UNIQUE(username),
  UNIQUE(email),
  UNIQUE(phone_num)
);


CREATE TABLE measurement_log (
  user_id BIGINT NOT NULL,
  date_time TIMESTAMP NOT NULL,
  height DECIMAL(6,2),
  weight DECIMAL(6,2),
  visual_body_fat_percent DECIMAL(5,2),
  neck_measurement DECIMAL(6,2),
  shoulder_measurement DECIMAL(6,2),
  chest_measurement DECIMAL(6,2),
  bicep_measurement DECIMAL(6,2),
  forearm_measurement DECIMAL(6,2),
  waist_measurement DECIMAL(6,2),
  hips_measurement DECIMAL(6,2),
  thigh_measurement DECIMAL(6,2),
  calve_measurement DECIMAL(6,2),
  PRIMARY KEY (user_id, date_time),


  FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
);


CREATE TABLE achievement (
  achievement_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  achievement_img_url TEXT
);


CREATE TABLE user_goal (
  goal_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  description TEXT NOT NULL,
  target_date DATE,
  completion_status TEXT,


    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
);


CREATE TABLE user_achievement (
  user_id BIGINT NOT NULL,
  achievement_id BIGINT NOT NULL,
  date_earned DATE,
  PRIMARY KEY (user_id, achievement_id),


  FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievement(achievement_id) ON DELETE CASCADE
);


CREATE TABLE user_friendship (
  user_id BIGINT NOT NULL,
  friend_user_id BIGINT NOT NULL,
  friendship_level friendship_level,
  PRIMARY KEY (user_id, friend_user_id),


  FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE,
  FOREIGN KEY (friend_user_id) REFERENCES "user"(user_id) ON DELETE CASCADE,


  CHECK (user_id <> friend_user_id)
);


CREATE TABLE workout (
  workout_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  preferred_day TEXT,
  UNIQUE (user_id, name),
  UNIQUE (user_id, workout_id),


  FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
);


CREATE TABLE workout_tag (
  name TEXT PRIMARY KEY,
  color_code TEXT
);


CREATE TABLE workout_tag_assignment (
  workout_id BIGINT NOT NULL,
  tag_name TEXT NOT NULL,
  PRIMARY KEY (workout_id, tag_name),


  FOREIGN KEY (workout_id) REFERENCES workout(workout_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_name) REFERENCES workout_tag(name) ON DELETE CASCADE
);


CREATE TABLE workout_session (
  workout_session_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workout_id BIGINT NOT NULL,
  start_date_time TIMESTAMP NOT NULL,
  end_date_time TIMESTAMP,
  notes TEXT,
  completion_status workout_session_status,
  difficulty_rating INTEGER,
  enjoyment_rating INTEGER,
  energy_level_rating INTEGER,


  UNIQUE (workout_id, start_date_time),


  FOREIGN KEY (workout_id) REFERENCES workout(workout_id) ON DELETE CASCADE,
  CHECK (difficulty_rating >= 0 AND difficulty_rating <= 10),
  CHECK (enjoyment_rating >= 0 AND enjoyment_rating <= 10),
  CHECK (energy_level_rating >= 0 AND energy_level_rating <= 10)
);


CREATE TABLE exercise (
  exercise_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_unilateral BOOLEAN NOT NULL DEFAULT FALSE,
  instruction TEXT
);


CREATE TABLE workout_exercise (
  workout_id BIGINT NOT NULL,
  sort_order INTEGER NOT NULL,
  exercise_id BIGINT NOT NULL,
  target_sets INTEGER,
  target_reps INTEGER,
  target_weight DECIMAL(8,2),
  expected_rest_time INTERVAL,
  PRIMARY KEY (workout_id, sort_order),
  UNIQUE (workout_id, exercise_id),


  FOREIGN KEY (workout_id) REFERENCES workout(workout_id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercise(exercise_id) ON DELETE CASCADE,

  CHECK (sort_order > 0),
  CHECK (target_sets > 0),
  CHECK (target_reps > 0),
  CHECK (target_weight >= 0)
);


CREATE TABLE equipment (
  equipment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,


  UNIQUE (name)
);


CREATE TABLE exercise_equipment (
  exercise_id BIGINT NOT NULL,
  equipment_id BIGINT NOT NULL,
  PRIMARY KEY (exercise_id, equipment_id),


  FOREIGN KEY (exercise_id) REFERENCES exercise(exercise_id) ON DELETE CASCADE,
  FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON DELETE CASCADE
);


CREATE TABLE media (
  url TEXT PRIMARY KEY,
  exercise_id BIGINT,
  type TEXT NOT NULL,


  FOREIGN KEY (exercise_id) REFERENCES exercise(exercise_id) ON DELETE CASCADE
);


CREATE TABLE muscle_group (
  muscle_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,


  UNIQUE (name)
);


CREATE TABLE exercise_muscle_group (
  exercise_id BIGINT NOT NULL,
  muscle_id BIGINT NOT NULL,
  role muscle_role,
  PRIMARY KEY (exercise_id, muscle_id),


  FOREIGN KEY (exercise_id) REFERENCES exercise(exercise_id) ON DELETE CASCADE,
  FOREIGN KEY (muscle_id) REFERENCES muscle_group(muscle_id) ON DELETE CASCADE
);


CREATE TABLE record_log (
  record_log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workout_session_id BIGINT NOT NULL,
  exercise_id BIGINT NOT NULL,
  number INTEGER NOT NULL,
  "timestamp" TIMESTAMP NOT NULL,
  duration INTERVAL,


  UNIQUE (workout_session_id, number),
  FOREIGN KEY (workout_session_id) REFERENCES workout_session(workout_session_id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercise(exercise_id) ON DELETE CASCADE,

  CHECK (number > 0)
);


CREATE TABLE set_log (
  set_log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_log_id BIGINT NOT NULL,
  number INTEGER NOT NULL,
  type set_type,
  weight DECIMAL(8,2),
  reps INTEGER,
  rpe DECIMAL(3,1),
  rest_time INTERVAL,
  UNIQUE (record_log_id, number),


  FOREIGN KEY (record_log_id) REFERENCES record_log(record_log_id) ON DELETE CASCADE,

  CHECK (number > 0),
  CHECK (weight >= 0),
  CHECK (reps > 0),
  CHECK (rpe >= 0 AND rpe <= 10)
);
