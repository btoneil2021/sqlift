-- Stored procedures for authentication logic
SET search_path TO sqlift;

-- Fetches a user record by email or username for login verification
CREATE OR REPLACE FUNCTION get_user_for_login(p_identifier TEXT)
RETURNS TABLE (
    user_id BIGINT,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    height DECIMAL(6,2),
    sex TEXT,
    email TEXT,
    phone_num TEXT,
    profile_pic_url TEXT,
    password TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.user_id, u.username, u.first_name, u.last_name,
           u.height, u.sex, u.email, u.phone_num, u.profile_pic_url, u.password
    FROM sqlift."user" u
    WHERE u.email = p_identifier OR u.username = p_identifier;
END;
$$ LANGUAGE plpgsql;

-- Inserts a new user and returns their profile
CREATE OR REPLACE FUNCTION signup_user(
    p_username TEXT,
    p_email TEXT,
    p_password TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_phone_num TEXT
)
RETURNS TABLE (
    user_id BIGINT,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    height DECIMAL(6,2),
    sex TEXT,
    email TEXT,
    phone_num TEXT,
    profile_pic_url TEXT
) AS $$
DECLARE
    v_user_id BIGINT;
BEGIN
    INSERT INTO sqlift."user" (username, email, password, first_name, last_name, phone_num)
    VALUES (p_username, p_email, p_password, p_first_name, p_last_name, p_phone_num)
    RETURNING "user".user_id INTO v_user_id;

    RETURN QUERY
    SELECT u.user_id, u.username, u.first_name, u.last_name,
           u.height, u.sex, u.email, u.phone_num, u.profile_pic_url
    FROM sqlift."user" u
    WHERE u.user_id = v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Returns true if the given username is not already taken
CREATE OR REPLACE FUNCTION is_username_available(p_username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM sqlift."user" WHERE username = p_username
    );
END;
$$ LANGUAGE plpgsql;
