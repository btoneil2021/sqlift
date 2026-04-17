USE sqlift;

DROP TRIGGER IF EXISTS trg_prevent_friendship_with_self_insert
DELIMITER $$
CREATE TRIGGER trg_prevent_friendship_with_self_insert
BEFORE INSERT ON user_friendship
FOR EACH ROW
BEGIN
	IF NEW.user_id = NEW.friend_user_id THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'user_id and friend_user_id cannot be the same';
	END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_prevent_friendship_with_self_update
DELIMITER $$
CREATE TRIGGER trg_prevent_friendship_with_self_update
BEFORE UPDATE ON user_friendship
FOR EACH ROW
BEGIN
	IF NEW.user_id = NEW.friend_user_id THEN
		SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'user_id and friend_user_id cannot be the same';
	END IF;
END$$
DELIMITER ;