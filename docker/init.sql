-- PostgreSQL initialization script for Drake AI
-- This runs automatically when the container first starts

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE drakeai TO drakeai;
