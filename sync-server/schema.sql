CREATE TABLE IF NOT EXISTS sync_meta (
  user_id VARCHAR(128) NOT NULL PRIMARY KEY,
  data_epoch BIGINT UNSIGNED NOT NULL DEFAULT 0,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  plan_settings_json JSON NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS problem_progress (
  user_id VARCHAR(128) NOT NULL,
  problem_id VARCHAR(32) NOT NULL,
  solved BOOLEAN NOT NULL DEFAULT FALSE,
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  solved_at DATETIME(6) NULL,
  reset_at DATETIME(6) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id, problem_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS study_plan_learned (
  user_id VARCHAR(128) NOT NULL,
  problem_id VARCHAR(32) NOT NULL,
  first_date DATE NULL,
  last_date DATE NULL,
  stage INT UNSIGNED NOT NULL DEFAULT 0,
  due_date DATE NULL,
  deleted_at DATETIME(6) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id, problem_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS study_events (
  user_id VARCHAR(128) NOT NULL,
  problem_id VARCHAR(32) NOT NULL,
  event_date DATE NOT NULL,
  kind ENUM('new','review') NOT NULL,
  source ENUM('test','manual') NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id, problem_id, event_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS code_drafts_notes (
  user_id VARCHAR(128) NOT NULL,
  problem_id VARCHAR(32) NOT NULL,
  lang VARCHAR(32) NOT NULL,
  mode VARCHAR(32) NOT NULL,
  code_text MEDIUMTEXT NULL,
  note_text MEDIUMTEXT NULL,
  content_hash CHAR(64) NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  device_id VARCHAR(128) NOT NULL,
  PRIMARY KEY (user_id, problem_id, lang, mode)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sync_snapshots (
  snapshot_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  reason ENUM('manual','before_reset_all') NOT NULL,
  payload_gzip LONGBLOB NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX snapshots_by_user (user_id, created_at)
) ENGINE=InnoDB;
