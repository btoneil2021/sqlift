-- Stored procedures for authentication logic
USE sqlift;

-- Fetches a user record by email or username for login verification
DROP PROCEDURE IF EXISTS get_user_for_login;
DELIMITER $$
CREATE PROCEDURE get_user_for_login(p_identifier VARCHAR(255))
BEGIN
    SELECT u.user_id, u.username, u.first_name, u.last_name,
           u.height, u.sex, u.email, u.phone_num, u.profile_pic_url, u.password
    FROM user u
    WHERE u.email = identifier OR u.username = p_identifier;
END $$
DELIMITER ;

-- Inserts a new user and returns their profile
DROP PROCEDURE IF EXISTS signup_user;
DELIMITER $$
CREATE PROCEDURE signup_user(
    p_username VARCHAR(255),
    p_email VARCHAR(255),
    p_password TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_phone_num VARCHAR(15)
)
BEGIN
	DECLARE v_user_id BIGINT;
    
    INSERT INTO user (username, email, password, first_name, last_name, phone_num)
    VALUES (p_username, p_email, p_password, p_first_name, p_last_name, p_phone_num);

    SELECT u.user_id, u.username, u.first_name, u.last_name,
           u.height, u.sex, u.email, u.phone_num, u.profile_pic_url
    FROM user u
    WHERE u.user_id = v_user_id;
END $$
DELIMITER ;

-- Returns true if the given username is not already taken
DROP PROCEDURE IF EXISTS is_username_available;
DELIMITER $$
CREATE PROCEDURE is_username_available(p_username VARCHAR(255))
BEGIN
    SELECT NOT EXISTS (
        SELECT 1 FROM user WHERE username = p_username
    ) AS is_available;
END $$
DELIMITER ;
