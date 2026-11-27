CREATE TABLE IF NOT EXISTS sync_changes (
  user_id VARCHAR(128) NOT NULL,
  revision BIGINT UNSIGNED NOT NULL,
  sequence_no INT UNSIGNED NOT NULL,
  kind VARCHAR(32) NOT NULL,
  entity_key VARCHAR(255) NOT NULL,
  value_json JSON NOT NULL,
  PRIMARY KEY (user_id, revision, sequence_no)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sync_requests (
  user_id VARCHAR(128) NOT NULL,
  device_id VARCHAR(128) NOT NULL,
  request_id VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  revision BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, device_id, request_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sync_reset_receipts (
  user_id VARCHAR(128) NOT NULL,
  device_id VARCHAR(128) NOT NULL,
  request_id VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  result_json JSON NOT NULL,
  PRIMARY KEY (user_id, device_id, request_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sync_recoveries (
  user_id VARCHAR(128) NOT NULL,
  recovery_id VARCHAR(255) NOT NULL,
  value_json JSON NOT NULL,
  PRIMARY KEY (user_id, recovery_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sync_submissions (
  user_id VARCHAR(128) NOT NULL,
  submission_id VARCHAR(128) NOT NULL,
  problem_id VARCHAR(32) NOT NULL,
  value_json JSON NOT NULL,
  PRIMARY KEY (user_id, submission_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sync_conflicts (
  conflict_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  problem_id VARCHAR(32) NOT NULL,
  lang VARCHAR(32) NOT NULL,
  mode VARCHAR(32) NOT NULL,
  code_text MEDIUMTEXT NULL,
  note_text MEDIUMTEXT NULL,
  content_hash CHAR(64) NOT NULL,
  device_id VARCHAR(128) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX conflicts_by_user (user_id, created_at)
) ENGINE=InnoDB;
