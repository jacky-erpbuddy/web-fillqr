-- fillQR MySQL Schema
-- Exported: 2026-02-23
-- Server: Variomedia (fillqr.de)
-- Database: [name redacted]
--
-- ACHTUNG: Dieses File ist ein Export, keine Migration.
-- Fuer Schema-Aenderungen: SQL-Statements in PROJEKT.md dokumentieren.

CREATE TABLE `tbl_tenant` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key_slug` varchar(60) NOT NULL,
  `name` varchar(140) NOT NULL,
  `logo_path` varchar(255) DEFAULT NULL,
  `email_notify` varchar(190) NOT NULL,
  `active` tinyint NOT NULL DEFAULT '1',
  `theme_json` json NOT NULL DEFAULT (json_object()),
  `settings_json` json NOT NULL DEFAULT (json_object(_utf8mb4'require_iban',false,_utf8mb4'show_birthdate',true,_utf8mb4'allow_newsletter',true)),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `entry_days` varchar(20) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `key_slug` (`key_slug`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tbl_tenant_domain` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `host` varchar(190) NOT NULL,
  `is_primary` tinyint NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `host` (`host`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `tbl_tenant_domain_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tbl_tenant` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tbl_membership_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `code` varchar(60) NOT NULL,
  `label` varchar(120) NOT NULL,
  `price` decimal(8,2) DEFAULT NULL,
  `active` tinyint NOT NULL DEFAULT '1',
  `sort_no` int NOT NULL DEFAULT '100',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_type_code` (`tenant_id`,`code`),
  CONSTRAINT `tbl_membership_type_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tbl_tenant` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tbl_discipline` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `code` varchar(50) NOT NULL,
  `label` varchar(100) NOT NULL,
  `sort_no` int NOT NULL DEFAULT '0',
  `active` tinyint NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_discipline_tenant` (`tenant_id`),
  CONSTRAINT `fk_discipline_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tbl_tenant` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tbl_application` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `status` enum('new','reviewed','active','passive','resting','suspended','terminated','rejected','exported','archived') NOT NULL DEFAULT 'new',
  `has_warnings` tinyint(1) NOT NULL DEFAULT '0',
  `full_name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `birthdate` date DEFAULT NULL,
  `is_minor` tinyint(1) NOT NULL DEFAULT '0',
  `guardian_name` varchar(255) DEFAULT NULL,
  `guardian_relation` varchar(100) DEFAULT NULL,
  `guardian_email` varchar(255) DEFAULT NULL,
  `guardian_phone` varchar(50) DEFAULT NULL,
  `photo_path` varchar(255) DEFAULT NULL,
  `street` varchar(140) DEFAULT NULL,
  `zip` varchar(20) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `membership_type_code` varchar(60) DEFAULT NULL,
  `style` varchar(100) DEFAULT NULL,
  `entry_date` date DEFAULT NULL,
  `remarks` text,
  `iban` varchar(34) DEFAULT NULL,
  `bic` varchar(11) DEFAULT NULL,
  `sepa_account_holder` varchar(255) DEFAULT NULL,
  `sepa_iban` varchar(34) DEFAULT NULL,
  `sepa_bic` varchar(11) DEFAULT NULL,
  `sepa_consent` datetime DEFAULT NULL,
  `sepa_consent_at` datetime DEFAULT NULL,
  `sepa_mandate_id` varchar(64) DEFAULT NULL,
  `sepa_mandate_date` date DEFAULT NULL,
  `gdpr_consent` tinyint NOT NULL DEFAULT '0',
  `gdpr_consent_at` datetime DEFAULT NULL,
  `privacy_version` varchar(32) DEFAULT NULL,
  `newsletter_optin` tinyint NOT NULL DEFAULT '0',
  `newsletter_at` datetime DEFAULT NULL,
  `client_ip` varbinary(16) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `referer_url` varchar(255) DEFAULT NULL,
  `exported_at` datetime DEFAULT NULL,
  `external_id` varchar(64) DEFAULT NULL,
  `source_ref` varchar(64) DEFAULT NULL,
  `extra` json NOT NULL DEFAULT (json_object()),
  PRIMARY KEY (`id`),
  KEY `idx_tenant_created` (`tenant_id`,`created_at`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_email` (`email`),
  KEY `idx_exported` (`exported_at`),
  CONSTRAINT `tbl_application_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tbl_tenant` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tbl_application_event` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `application_id` bigint NOT NULL,
  `ts` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `event` varchar(60) NOT NULL,
  `meta` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_app_ts` (`application_id`,`ts`),
  CONSTRAINT `tbl_application_event_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `tbl_application` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tbl_app_user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `email` varchar(190) NOT NULL,
  `pass_hash` varchar(255) NOT NULL,
  `role` enum('admin','editor') NOT NULL DEFAULT 'admin',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_per_tenant` (`tenant_id`,`email`),
  CONSTRAINT `tbl_app_user_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tbl_tenant` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tbl_schema_version` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `applied_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
