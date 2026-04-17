DROP DATABASE IF EXISTS sqlift;
CREATE DATABASE sqlift;
USE sqlift;

DROP TABLE IF EXISTS user;
CREATE TABLE user (
  user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  height DECIMAL(6,2),
  sex TEXT,
  email VARCHAR(255) NOT NULL,
  phone_num VARCHAR(15) NOT NULL,
  password TEXT NOT NULL,
  profile_pic_url TEXT,


  UNIQUE(username),
  UNIQUE(email),
  UNIQUE(phone_num)
);

DROP TABLE IF EXISTS measurement_log;
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


  FOREIGN KEY (user_id) REFERENCES user(user_id) ON UPDATE CASCADE ON DELETE CASCADE
);

DROP TABLE IF EXISTS achievement;
CREATE TABLE achievement (
  achievement_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  achievement_img_url TEXT
);

DROP TABLE IF EXISTS user_goal;
CREATE TABLE user_goal (
  goal_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  description TEXT NOT NULL,
  target_date DATE,
  completion_status TEXT,


    FOREIGN KEY (user_id) REFERENCES user(user_id) ON UPDATE CASCADE ON DELETE CASCADE
);

DROP TABLE IF EXISTS user_achievement;
CREATE TABLE user_achievement (
  user_id BIGINT NOT NULL,
  achievement_id BIGINT NOT NULL,
  date_earned DATE,
  PRIMARY KEY (user_id, achievement_id),


  FOREIGN KEY (user_id) REFERENCES user(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievement(achievement_id) ON UPDATE CASCADE ON DELETE CASCADE
);

DROP TABLE IF EXISTS user_friendship;
CREATE TABLE user_friendship (
  user_id BIGINT NOT NULL,
  friend_user_id BIGINT NOT NULL,
  friendship_level ENUM('Private', 'Basic', 'Full'),
  PRIMARY KEY (user_id, friend_user_id),

  FOREIGN KEY (user_id) REFERENCES user(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (friend_user_id) REFERENCES user(user_id) ON UPDATE CASCADE ON DELETE CASCADE
);

DROP TABLE IF EXISTS workout;
CREATE TABLE workout (
  workout_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  preferred_day TEXT,
  UNIQUE (user_id, name),
  UNIQUE (user_id, workout_id),

  FOREIGN KEY (user_id) REFERENCES user(user_id) ON UPDATE CASCADE ON DELETE CASCADE
);

DROP TABLE IF EXISTS workout_tag;
CREATE TABLE workout_tag (
  name VARCHAR(255) PRIMARY KEY,
  color_code TEXT
);

DROP TABLE IF EXISTS workout_tag_assignment;
CREATE TABLE workout_tag_assignment (
  workout_id BIGINT NOT NULL,
  tag_name VARCHAR(255) NOT NULL,
  PRIMARY KEY (workout_id, tag_name),

  FOREIGN KEY (workout_id) REFERENCES workout(workout_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (tag_name) REFERENCES workout_tag(name) ON UPDATE CASCADE ON DELETE CASCADE
);

DROP TABLE IF EXISTS workout_session;
CREATE TABLE workout_session (
  workout_session_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  workout_id BIGINT NOT NULL,
  start_date_time TIMESTAMP NOT NULL,
  end_date_time TIMESTAMP,
  notes TEXT,
  completion_status ENUM('Not Started', 'In Progress', 'Completed'),
  difficulty_rating INTEGER,
  enjoyment_rating INTEGER,
  energy_level_rating INTEGER,

  UNIQUE (workout_id, start_date_time),

  FOREIGN KEY (workout_id) REFERENCES workout(workout_id) ON UPDATE CASCADE ON DELETE CASCADE,
  
  CHECK (difficulty_rating >= 0 AND difficulty_rating <= 10),
  CHECK (enjoyment_rating >= 0 AND enjoyment_rating <= 10),
  CHECK (energy_level_rating >= 0 AND energy_level_rating <= 10)
);

DROP TABLE IF EXISTS exercise;
CREATE TABLE exercise (
  exercise_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_unilateral BOOLEAN NOT NULL DEFAULT FALSE,
  instruction TEXT
);

DROP TABLE IF EXISTS workout_exercise;
CREATE TABLE workout_exercise (
  workout_id BIGINT NOT NULL,
  sort_order INTEGER NOT NULL,
  exercise_id BIGINT NOT NULL,
  target_sets INTEGER,
  target_reps INTEGER,
  target_weight DECIMAL(8,2),
  expected_rest_time INT,
  PRIMARY KEY (workout_id, sort_order),

  FOREIGN KEY (workout_id) REFERENCES workout(workout_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercise(exercise_id) ON UPDATE CASCADE ON DELETE CASCADE,

  CHECK (sort_order > 0),
  CHECK (target_sets > 0),
  CHECK (target_reps > 0),
  CHECK (target_weight >= 0)
);

DROP TABLE IF EXISTS equipment;
CREATE TABLE equipment (
  equipment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  UNIQUE (name)
);

DROP TABLE IF EXISTS exercise_equipment;
CREATE TABLE exercise_equipment (
  exercise_id BIGINT NOT NULL,
  equipment_id BIGINT NOT NULL,
  PRIMARY KEY (exercise_id, equipment_id),

  FOREIGN KEY (exercise_id) REFERENCES exercise(exercise_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON UPDATE CASCADE ON DELETE CASCADE
);

DROP TABLE IF EXISTS media;
CREATE TABLE media (
  url VARCHAR(255) PRIMARY KEY,
  exercise_id BIGINT,
  type TEXT NOT NULL,

  FOREIGN KEY (exercise_id) REFERENCES exercise(exercise_id) ON UPDATE CASCADE ON DELETE CASCADE
);

DROP TABLE IF EXISTS muscle_group;
CREATE TABLE muscle_group (
  muscle_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  UNIQUE (name)
);

DROP TABLE IF EXISTS exercise_muscle_group;
CREATE TABLE exercise_muscle_group (
  exercise_id BIGINT NOT NULL,
  muscle_id BIGINT NOT NULL,
  role ENUM('Primary', 'Secondary', 'Stabilizer'),
  PRIMARY KEY (exercise_id, muscle_id),

  FOREIGN KEY (exercise_id) REFERENCES exercise(exercise_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (muscle_id) REFERENCES muscle_group(muscle_id) ON UPDATE CASCADE ON DELETE CASCADE
);

DROP TABLE IF EXISTS record_log;
CREATE TABLE record_log (
  record_log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  workout_session_id BIGINT NOT NULL,
  exercise_id BIGINT NOT NULL,
  number INTEGER NOT NULL,
  timestamp DATETIME NOT NULL,
  duration INT,

  UNIQUE (workout_session_id, number),
  FOREIGN KEY (workout_session_id) REFERENCES workout_session(workout_session_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercise(exercise_id) ON UPDATE CASCADE ON DELETE CASCADE,

  CHECK (number > 0)
);

DROP TABLE IF EXISTS set_log;
CREATE TABLE set_log (
  set_log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  record_log_id BIGINT NOT NULL,
  number INTEGER NOT NULL,
  type ENUM('Warm-up', 'Working', 'Drop'),
  weight DECIMAL(8,2),
  reps INTEGER,
  rpe DECIMAL(3,1),
  rest_time INT,
  UNIQUE (record_log_id, number),

  FOREIGN KEY (record_log_id) REFERENCES record_log(record_log_id) ON UPDATE CASCADE ON DELETE CASCADE,

  CHECK (number > 0),
  CHECK (weight >= 0),
  CHECK (reps > 0),
  CHECK (rpe >= 0 AND rpe <= 10)
);

