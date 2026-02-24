-- Migration 001: Magic Link table for Self-Service updates
-- Run on: fillqr production DB
-- Requires: tbl_application must exist

CREATE TABLE IF NOT EXISTS `tbl_magic_link` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `token` varchar(64) NOT NULL,
  `application_id` bigint NOT NULL,
  `tenant_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  `used_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_token` (`token`),
  KEY `idx_app_id` (`application_id`),
  CONSTRAINT `fk_magic_link_app` FOREIGN KEY (`application_id`) REFERENCES `tbl_application` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Track migration
INSERT IGNORE INTO `tbl_schema_version` (`name`) VALUES ('001_magic_link');
