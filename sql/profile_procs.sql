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

CREATE OR REPLACE FUNCTION get_user_password_hash(p_user_id BIGINT)
RETURNS TABLE (password TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT u.password
    FROM sqlift."user" u
    WHERE u.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_friends(p_user_id BIGINT)
RETURNS TABLE (
    friend_user_id BIGINT,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT combined.friend_user_id,
           combined.username,
           combined.first_name,
           combined.last_name,
           combined.status
    FROM (
        -- Outgoing rows: sent requests and confirmed mutual friends
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
               END::TEXT AS status
        FROM sqlift.user_friendship uf
        JOIN sqlift."user" u ON u.user_id = uf.friend_user_id
        WHERE uf.user_id = p_user_id

        UNION ALL

        SELECT rev.user_id AS friend_user_id,
               u.username,
               u.first_name,
               u.last_name,
               'received'::TEXT AS status
        FROM sqlift.user_friendship rev
        JOIN sqlift."user" u ON u.user_id = rev.user_id
        WHERE rev.friend_user_id = p_user_id
          AND rev.friendship_level = 'Basic'
          AND NOT EXISTS (
              SELECT 1 FROM sqlift.user_friendship outgoing
              WHERE outgoing.user_id = p_user_id
                AND outgoing.friend_user_id = rev.user_id
          )
    ) combined
    ORDER BY combined.first_name, combined.last_name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_friend(p_user_id BIGINT, p_target_username TEXT)
RETURNS TABLE (
    friend_user_id BIGINT,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    status TEXT
) AS $$
DECLARE
    v_target_id BIGINT;
    v_reverse_level sqlift.friendship_level;
    v_status TEXT;
BEGIN
    SELECT u.user_id INTO v_target_id
    FROM sqlift."user" u
    WHERE u.username = p_target_username;

    IF v_target_id IS NULL THEN
        RAISE EXCEPTION 'User not found: %', p_target_username;
    END IF;

    IF v_target_id = p_user_id THEN
        RAISE EXCEPTION 'Cannot add yourself as a friend';
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

        v_status := 'friends';
    ELSE
        INSERT INTO sqlift.user_friendship (user_id, friend_user_id, friendship_level)
        VALUES (p_user_id, v_target_id, 'Basic');

        v_status := 'sent';
    END IF;

    RETURN QUERY
    SELECT v_target_id,
           u.username,
           u.first_name,
           u.last_name,
           v_status
    FROM sqlift."user" u
    WHERE u.user_id = v_target_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION remove_friend(p_user_id BIGINT, p_friend_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM sqlift.user_friendship
    WHERE user_id = p_user_id AND friend_user_id = p_friend_id;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted > 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_latest_measurements(p_user_id BIGINT)
RETURNS TABLE (
    date_time         TIMESTAMP,
    weight            DECIMAL(6,2),
    waist_measurement DECIMAL(6,2),
    chest_measurement DECIMAL(6,2),
    bicep_measurement DECIMAL(6,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT m.date_time,
           m.weight,
           m.waist_measurement,
           m.chest_measurement,
           m.bicep_measurement
    FROM sqlift.measurement_log m
    WHERE m.user_id = p_user_id
    ORDER BY m.date_time DESC
    LIMIT 2;
END;
$$ LANGUAGE plpgsql;
