-- ========================================================
-- VetLink PWA — Complete MySQL Cloud Database Schema
-- Matches IndexedDB stores in src/db/database.js
-- ========================================================

CREATE DATABASE IF NOT EXISTS vetlink_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE vetlink_db;

-- --------------------------------------------------------
-- Users / Clinic Staff (matches 'users' store)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(128) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  role VARCHAR(64) DEFAULT 'Technician',
  password_hash VARCHAR(255) NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  device_status VARCHAR(32) DEFAULT 'Online',
  sync_status VARCHAR(32) DEFAULT 'synced',
  version INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_username (username),
  INDEX idx_users_sync (sync_status),
  INDEX idx_users_updated (updated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auth_sessions_user (user_id),
  INDEX idx_auth_sessions_expires (expires_at),
  CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS id_counters (
  prefix VARCHAR(16) PRIMARY KEY,
  last_value INT NOT NULL
) ENGINE=InnoDB;

-- --------------------------------------------------------
-- Pet Owners (matches 'owners' store)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS owners (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  phone VARCHAR(32),
  email VARCHAR(128),
  address TEXT,
  sync_status VARCHAR(32) DEFAULT 'synced',
  version INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_owners_sync (sync_status),
  INDEX idx_owners_updated (updated_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------
-- Reference: Skin Conditions (matches 'skinConditions' store)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS skin_conditions (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  recommended_treatment TEXT,
  sync_status VARCHAR(32) DEFAULT 'synced',
  version INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_skin_cond_sync (sync_status),
  INDEX idx_skin_cond_updated (updated_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------
-- Reference: Severity Levels (matches 'severityLevels' store)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS severity_levels (
  id VARCHAR(64) PRIMARY KEY,
  level_name VARCHAR(64) NOT NULL,
  score INT DEFAULT 0,
  sync_status VARCHAR(32) DEFAULT 'synced',
  version INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sev_sync (sync_status),
  INDEX idx_sev_updated (updated_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------
-- Reference: Symptoms (matches 'symptoms' store)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS symptoms (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  sync_status VARCHAR(32) DEFAULT 'synced',
  version INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_symptoms_sync (sync_status),
  INDEX idx_symptoms_updated (updated_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------
-- Patients (matches 'patients' store)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  species VARCHAR(64) DEFAULT 'Canine',
  breed VARCHAR(128),
  age VARCHAR(32),
  area_of_concern TEXT,
  last_visit DATE,
  status VARCHAR(64) DEFAULT 'Active',
  owner_id VARCHAR(64),
  created_by VARCHAR(64),
  sync_status VARCHAR(32) DEFAULT 'synced',
  version INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_patients_owner (owner_id),
  INDEX idx_patients_created_by (created_by),
  INDEX idx_patients_sync (sync_status),
  INDEX idx_patients_updated (updated_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------
-- Consultations (matches 'consultations' store)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS consultations (
  id VARCHAR(64) PRIMARY KEY,
  patient_id VARCHAR(64) NOT NULL,
  handled_by_user_id VARCHAR(64),
  clinical_notes TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  sync_status VARCHAR(32) DEFAULT 'synced',
  version INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_consult_patient (patient_id),
  INDEX idx_consult_handled_by (handled_by_user_id),
  INDEX idx_consult_sync (sync_status),
  INDEX idx_consult_updated (updated_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------
-- Consultation Symptoms Mapping (matches 'consultationSymptoms' store)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS consultation_symptoms (
  id VARCHAR(64) PRIMARY KEY,
  consultation_id VARCHAR(64) NOT NULL,
  symptom_id VARCHAR(64) NOT NULL,
  severity VARCHAR(32),
  sync_status VARCHAR(32) DEFAULT 'synced',
  version INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cs_consultation (consultation_id),
  INDEX idx_cs_symptom (symptom_id),
  INDEX idx_cs_sync (sync_status),
  INDEX idx_cs_updated (updated_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------
-- Uploaded Lesion Images (matches 'uploadedImages' store)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS uploaded_images (
  id VARCHAR(64) PRIMARY KEY,
  consultation_id VARCHAR(64),
  file_url VARCHAR(255),
  image_data LONGTEXT,
  sync_status VARCHAR(32) DEFAULT 'synced',
  version INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_images_consultation (consultation_id),
  INDEX idx_images_sync (sync_status),
  INDEX idx_images_updated (updated_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------
-- AI Screening Results (matches 'screeningResults' store)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS screening_results (
  id VARCHAR(64) PRIMARY KEY,
  consultation_id VARCHAR(64),
  image_id VARCHAR(64),
  condition_id VARCHAR(64),
  severity_level_id VARCHAR(64),
  confidence_score DECIMAL(5,2),
  heatmap_data LONGTEXT,
  review_status VARCHAR(32) DEFAULT 'pending',
  sync_status VARCHAR(32) DEFAULT 'synced',
  version INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sr_consultation (consultation_id),
  INDEX idx_sr_image (image_id),
  INDEX idx_sr_condition (condition_id),
  INDEX idx_sr_severity (severity_level_id),
  INDEX idx_sr_sync (sync_status),
  INDEX idx_sr_updated (updated_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------
-- Cloud Sync Tracking & Audit (matches 'syncQueue' & 'syncConflicts')
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_queue (
  id VARCHAR(64) PRIMARY KEY,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  operation VARCHAR(32) NOT NULL,
  status VARCHAR(32) DEFAULT 'pending',
  payload JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sq_entity (entity_type, entity_id),
  INDEX idx_sq_status (status),
  INDEX idx_sq_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id VARCHAR(64) PRIMARY KEY,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  local_data JSON,
  cloud_data JSON,
  resolution_status VARCHAR(32) DEFAULT 'unresolved',
  resolution VARCHAR(16),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sc_entity (entity_type, entity_id),
  INDEX idx_sc_status (resolution_status),
  INDEX idx_sc_created (created_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------
-- Initial Seed Data
-- --------------------------------------------------------
INSERT IGNORE INTO users (id, username, name, role, device_status, sync_status, version) VALUES
('ST-001', 'dr.sarah.lin@clinic.vet', 'Dr. Sarah Lin', 'Veterinarian', 'Online', 'synced', 1),
('ST-002', 'alex.tan@clinic.vet', 'Alex Tan', 'Technician', 'Offline', 'synced', 1),
('ST-003', 'maria.reyes@clinic.vet', 'Maria Reyes', 'Assistant', 'Online', 'synced', 1);

INSERT IGNORE INTO skin_conditions (id, name, description, recommended_treatment) VALUES
('COND-01', 'Irritant Contact Dermatitis', 'Non-infectious cutaneous reaction due to chemical or physical irritants.', 'Gentle cleansing, avoid suspected irritants, barrier ointment.'),
('COND-02', 'Flea Allergy Dermatitis', 'Hypersensitivity reaction to flea saliva leading to intense pruritus.', 'Administer adulticide flea control and anti-inflammatory therapy.'),
('COND-03', 'Malassezia Dermatitis', 'Opportunistic fungal yeast dermatitis commonly in skin folds or paws.', 'Topical antifungal wash (Chlorhexidine/Ketoconazole).'),
('COND-04', 'Pyoderma', 'Bacterial skin infection with papules, pustules, and crusts.', 'Cytology examination, antibacterial topical therapy or systemic antibiotics.');

INSERT IGNORE INTO severity_levels (id, level_name, score) VALUES
('SEV-01', 'Mild', 1),
('SEV-02', 'Moderate', 2),
('SEV-03', 'Severe', 3),
('SEV-04', 'Critical', 4);
