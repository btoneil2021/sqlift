-- Stored procedures for profile management
SET search_path TO sqlift;

-- Get full user profile
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id BIGINT)
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
BEGIN
    RETURN QUERY
    SELECT u.user_id, u.username, u.first_name, u.last_name,
           u.height, u.sex, u.email, u.phone_num, u.profile_pic_url
    FROM sqlift."user" u
    WHERE u.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Update user profile (with COALESCE for optional updates)
CREATE OR REPLACE FUNCTION update_user_profile(
    p_user_id BIGINT,
    p_username TEXT DEFAULT NULL,
    p_first_name TEXT DEFAULT NULL,
    p_last_name TEXT DEFAULT NULL,
    p_height DECIMAL DEFAULT NULL,
    p_sex TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone_num TEXT DEFAULT NULL,
    p_profile_pic_url TEXT DEFAULT NULL
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
BEGIN
    UPDATE sqlift."user"
    SET username = COALESCE(p_username, username),
        first_name = COALESCE(p_first_name, first_name),
        last_name = COALESCE(p_last_name, last_name),
        height = COALESCE(p_height, height),
        sex = COALESCE(p_sex, sex),
        email = COALESCE(p_email, email),
        phone_num = COALESCE(p_phone_num, phone_num),
        profile_pic_url = COALESCE(p_profile_pic_url, profile_pic_url)
    WHERE sqlift."user".user_id = p_user_id;

    RETURN QUERY
    SELECT u.user_id, u.username, u.first_name, u.last_name,
           u.height, u.sex, u.email, u.phone_num, u.profile_pic_url
    FROM sqlift."user" u
    WHERE u.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Change user password
CREATE OR REPLACE FUNCTION change_user_password(
    p_user_id BIGINT,
    p_new_password_hash TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE sqlift."user"
    SET password = p_new_password_hash
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
