-- Modular recruitment form foundation. MySQL only.
-- Historical applications remain on the legacy form (form_version_id IS NULL).
-- Default schema/version are initialized transactionally by the application.
CREATE TABLE IF NOT EXISTS recruitment_form_versions (
    id BINARY(16) NOT NULL,
    version_number BIGINT NOT NULL,
    schema_json LONGTEXT NOT NULL,
    published_by_account_id BINARY(16) NULL,
    published_by VARCHAR(190) NOT NULL,
    published_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_form_version_number UNIQUE (version_number),
    CONSTRAINT fk_form_version_publisher FOREIGN KEY (published_by_account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recruitment_form_config (
    id BIGINT NOT NULL,
    draft_schema_json LONGTEXT NOT NULL,
    draft_revision BIGINT NOT NULL DEFAULT 0,
    published_draft_revision BIGINT NOT NULL DEFAULT 0,
    published_version_id BINARY(16) NOT NULL,
    updated_by VARCHAR(190) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    lock_version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_form_config_publication FOREIGN KEY (published_version_id) REFERENCES recruitment_form_versions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='recruitment_applications' AND column_name='form_version_id')=0, 'ALTER TABLE recruitment_applications ADD COLUMN form_version_id BINARY(16) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='recruitment_applications' AND column_name='form_answers_json')=0, 'ALTER TABLE recruitment_applications ADD COLUMN form_answers_json LONGTEXT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='recruitment_applications' AND column_name='form_answers_revision')=0, 'ALTER TABLE recruitment_applications ADD COLUMN form_answers_revision BIGINT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() AND table_name='recruitment_applications' AND constraint_name='fk_application_form_version')=0, 'ALTER TABLE recruitment_applications ADD CONSTRAINT fk_application_form_version FOREIGN KEY (form_version_id) REFERENCES recruitment_form_versions(id)', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS recruitment_form_attachments (
    id BINARY(16) NOT NULL,
    application_id BINARY(16) NOT NULL,
    owner_account_id BINARY(16) NOT NULL,
    module_id BINARY(16) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(80) NOT NULL,
    size_bytes BIGINT NOT NULL,
    display_order INTEGER NOT NULL,
    active BIT(1) NOT NULL DEFAULT b'1',
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_form_attachment_stored UNIQUE (stored_name),
    CONSTRAINT fk_form_attachment_application FOREIGN KEY (application_id) REFERENCES recruitment_applications(id),
    CONSTRAINT fk_form_attachment_owner FOREIGN KEY (owner_account_id) REFERENCES accounts(id),
    INDEX idx_form_attachment_application (application_id, module_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recruitment_form_submissions (
    id BINARY(16) NOT NULL,
    account_id BINARY(16) NOT NULL,
    request_key BINARY(16) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    application_id BINARY(16) NOT NULL,
    form_version_id BINARY(16) NOT NULL,
    result_json LONGTEXT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_form_submission_request UNIQUE (account_id, request_key),
    CONSTRAINT fk_form_submission_account FOREIGN KEY (account_id) REFERENCES accounts(id),
    CONSTRAINT fk_form_submission_application FOREIGN KEY (application_id) REFERENCES recruitment_applications(id),
    CONSTRAINT fk_form_submission_version FOREIGN KEY (form_version_id) REFERENCES recruitment_form_versions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
