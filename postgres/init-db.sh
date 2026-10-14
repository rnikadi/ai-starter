#!/bin/bash
set -e

# Enable pgvector on development database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS vector;
EOSQL

# Automatically provision isolated test database for automated testing
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
    SELECT 'CREATE DATABASE aistarter_test_db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aistarter_test_db')\gexec
    \connect aistarter_test_db
    CREATE EXTENSION IF NOT EXISTS vector;
EOSQL

