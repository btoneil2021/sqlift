-- Stored procedures for profile management
USE sqlift;

-- Returns the full profile for a given user
DROP PROCEDURE IF EXISTS get_user_profile;
DELIMITER $$
CREATE PROCEDURE get_user_profile(p_user_id BIGINT)
BEGIN
    SELECT u.user_id, u.username, u.first_name, u.last_name,
           u.height, u.sex, u.email, u.phone_num, u.profile_pic_url
    FROM user u
    WHERE u.user_id = p_user_id;
END $$
DELIMITER ;

-- Updates any provided profile fields for a user, leaving unspecified fields unchanged
DROP PROCEDURE IF EXISTS update_user_profile;
DELIMITER $$
CREATE PROCEDURE update_user_profile(
    p_user_id BIGINT,
    p_username VARCHAR(255),
    p_first_name TEXT,
    p_last_name TEXT,
    p_height DECIMAL(6,2),
    p_sex TEXT,
    p_email VARCHAR(255),
    p_phone_num VARCHAR(15),
    p_profile_pic_url TEXT
)
BEGIN
    IF p_email IS NOT NULL AND EXISTS (
        SELECT 1 FROM user u
        WHERE u.email = p_email AND u.user_id <> p_user_id
    ) THEN
		SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'email already in use';
    END IF;

    IF p_phone_num IS NOT NULL AND p_phone_num <> '' AND EXISTS (
        SELECT 1 FROM user u
        WHERE u.phone_num = p_phone_num AND u.user_id <> p_user_id
    ) THEN
		SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'phone number already in use';
    END IF;

    UPDATE user u
    SET username        = COALESCE(p_username,        u.username),
        first_name      = COALESCE(p_first_name,      u.first_name),
        last_name       = COALESCE(p_last_name,       u.last_name),
        height          = COALESCE(p_height,          u.height),
        sex             = COALESCE(p_sex,             u.sex),
        email           = COALESCE(p_email,           u.email),
        phone_num       = COALESCE(p_phone_num,       u.phone_num),
        profile_pic_url = COALESCE(p_profile_pic_url, u.profile_pic_url)
    WHERE u.user_id = p_user_id;

    SELECT u.user_id, u.username, u.first_name, u.last_name,
           u.height, u.sex, u.email, u.phone_num, u.profile_pic_url
    FROM user u
    WHERE u.user_id = p_user_id;
END $$
DELIMITER ;

-- Updates the stored password hash for a user
DROP PROCEDURE IF EXISTS change_user_password;
DELIMITER $$
CREATE PROCEDURE change_user_password(
    p_user_id BIGINT,
    p_new_password_hash TEXT
)
BEGIN
    UPDATE user
    SET password = p_new_password_hash
    WHERE user_id = p_user_id;
END $$
DELIMITER ;

-- Returns the stored password hash for a user
DROP PROCEDURE IF EXISTS get_user_password_hash;
DELIMITER $$
CREATE PROCEDURE get_user_password_hash(p_user_id BIGINT)
BEGIN
    SELECT u.password
    FROM user u
    WHERE u.user_id = p_user_id;
END $$
DELIMITER ;

-- Returns all friends and pending friend requests for a user
DROP PROCEDURE IF EXISTS get_user_friends;
DELIMITER $$
CREATE PROCEDURE get_user_friends(p_user_id BIGINT)
BEGIN
    SELECT combined.friend_user_id,
           combined.username,
           combined.first_name,
           combined.last_name,
           combined.status
    FROM (
        SELECT uf.friend_user_id,
               u.username,
               u.first_name,
               u.last_name,
               CASE
                   WHEN uf.friendship_level = 'Full'
                    AND EXISTS (
                        SELECT 1 FROM sqlift.user_friendship rev
                        WHERE rev.user_id = uf.friend_user_id
                          AND rev.friend_user_id = p_user_id
                          AND rev.friendship_level = 'Full'
                    ) THEN 'friends'
                   ELSE 'sent'
               END AS status
        FROM sqlift.user_friendship uf
        JOIN user u ON u.user_id = uf.friend_user_id
        WHERE uf.user_id = p_user_id

        UNION ALL

        SELECT rev.user_id AS friend_user_id,
               u.username,
               u.first_name,
               u.last_name,
               'received' AS status
        FROM sqlift.user_friendship rev
        JOIN user u ON u.user_id = rev.user_id
        WHERE rev.friend_user_id = p_user_id
          AND rev.friendship_level = 'Basic'
          AND NOT EXISTS (
              SELECT 1 FROM sqlift.user_friendship outgoing
              WHERE outgoing.user_id = p_user_id
                AND outgoing.friend_user_id = rev.user_id
          )
    ) combined
    ORDER BY combined.first_name, combined.last_name;
END $$
DELIMITER ;

-- Sends a friend request or confirms one if the target already sent a request
DROP PROCEDURE IF EXISTS add_friend;
DELIMITER $$
CREATE PROCEDURE add_friend(p_user_id BIGINT, p_target_username VARCHAR(255))
BEGIN
	DECLARE v_target_id BIGINT DEFAULT NULL;
    DECLARE v_reverse_level VARCHAR(20) DEFAULT NULL;
    DECLARE v_status TEXT;
	
    SELECT u.user_id INTO v_target_id
    FROM user u
    WHERE u.username = p_target_username;

    IF v_target_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'User not found';
    END IF;

    IF v_target_id = p_user_id THEN
		SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot add yourself as a friend';
    END IF;

    SELECT uf.friendship_level INTO v_reverse_level
    FROM sqlift.user_friendship uf
    WHERE uf.user_id = v_target_id AND uf.friend_user_id = p_user_id;

    IF v_reverse_level = 'Basic' THEN
        INSERT INTO sqlift.user_friendship (user_id, friend_user_id, friendship_level)
        VALUES (p_user_id, v_target_id, 'Full');

        UPDATE sqlift.user_friendship uf2
        SET friendship_level = 'Full'
        WHERE uf2.user_id = v_target_id AND uf2.friend_user_id = p_user_id;

        SET v_status = 'friends';
    ELSE
        INSERT INTO sqlift.user_friendship (user_id, friend_user_id, friendship_level)
        VALUES (p_user_id, v_target_id, 'Basic');

        SET v_status = 'sent';
    END IF;

    SELECT v_target_id,
           u.username,
           u.first_name,
           u.last_name,
           v_status
    FROM user u
    WHERE u.user_id = v_target_id;
END $$
DELIMITER ;

-- Removes the friendship record between two users and returns true if a row was deleted
DROP PROCEDURE IF EXISTS remove_friend;
DELIMITER $$
CREATE PROCEDURE remove_friend(p_user_id BIGINT, p_friend_id BIGINT)
BEGIN
    DELETE FROM sqlift.user_friendship
    WHERE user_id = p_user_id AND friend_user_id = p_friend_id;
    
    SELECT ROW_COUNT() > 0 AS was_deleted;
END $$
DELIMITER ;

-- Returns the two most recent measurement log entries for a user (for profile comparison)
DROP PROCEDURE IF EXISTS get_latest_measurements;
DELIMITER $$
CREATE PROCEDURE get_latest_measurements(p_user_id BIGINT)
BEGIN
    SELECT m.date_time,
           m.weight,
           m.visual_body_fat_percent,
           m.neck_measurement,
           m.shoulder_measurement,
           m.chest_measurement,
           m.bicep_measurement,
           m.forearm_measurement,
           m.waist_measurement,
           m.hips_measurement,
           m.thigh_measurement,
           m.calve_measurement
    FROM sqlift.measurement_log m
    WHERE m.user_id = p_user_id
    ORDER BY m.date_time DESC
    LIMIT 2;
END $$
DELIMITER ;

-- Returns all measurement log entries for a user (for stats graph)
DROP PROCEDURE IF EXISTS get_all_measurements;
DELIMITER $$
CREATE PROCEDURE get_all_measurements(p_user_id BIGINT)
BEGIN
    SELECT m.date_time,
           m.weight,
           m.visual_body_fat_percent,
           m.neck_measurement,
           m.shoulder_measurement,
           m.chest_measurement,
           m.bicep_measurement,
           m.forearm_measurement,
           m.waist_measurement,
           m.hips_measurement,
           m.thigh_measurement,
           m.calve_measurement
    FROM sqlift.measurement_log m
    WHERE m.user_id = p_user_id
    ORDER BY m.date_time DESC;
END $$
DELIMITER ;
