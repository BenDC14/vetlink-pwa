import os
from pathlib import Path
from dotenv import load_dotenv
import pymysql
import pymysql.cursors

# Load .env file from the backend directory
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "vetlink_db")


def get_connection(include_db: bool = True):
    """Establish and return a PyMySQL connection."""
    try:
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME if include_db else None,
            cursorclass=pymysql.cursors.DictCursor,
            charset="utf8mb4",
            autocommit=True,
        )
        return conn
    except pymysql.MySQLError as err:
        if err.args[0] == 1049 and include_db:
            # Database does not exist yet; try connecting without database to create it
            return get_connection(include_db=False)
        raise ConnectionError(
            f"Failed to connect to MySQL on {DB_HOST}:{DB_PORT}. "
            f"Please verify XAMPP MySQL is running. Error: {err}"
        ) from err


def test_connection():
    """Verify MySQL connectivity and return basic metadata."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT VERSION() as version, DATABASE() as db;")
            row = cursor.fetchone()
            return {
                "status": "connected",
                "host": DB_HOST,
                "port": DB_PORT,
                "database": row["db"] or DB_NAME,
                "mysql_version": row["version"],
            }
    finally:
        conn.close()


def auto_initialize_schema():
    """Executes schema.sql if database or tables do not exist yet."""
    schema_path = Path(__file__).parent.parent / "schema.sql"
    if not schema_path.exists():
        return False

    conn = get_connection(include_db=False)
    try:
        with conn.cursor() as cursor:
            # Read and split SQL commands from schema.sql
            sql_content = schema_path.read_text(encoding="utf-8")
            # Execute multiple statements
            statements = [s.strip() for s in sql_content.split(";") if s.strip()]
            for stmt in statements:
                cursor.execute(stmt)
            cursor.execute("SHOW COLUMNS FROM users")
            user_columns = {row["Field"] for row in cursor.fetchall()}
            migrations = {
                "password_hash": "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL",
                "must_change_password": "ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE",
                "is_active": "ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE",
            }
            for column, statement in migrations.items():
                if column not in user_columns:
                    cursor.execute(statement)
            cursor.execute("SHOW COLUMNS FROM sync_conflicts")
            conflict_columns = {row["Field"] for row in cursor.fetchall()}
            if "resolution" not in conflict_columns:
                cursor.execute("ALTER TABLE sync_conflicts ADD COLUMN resolution VARCHAR(16) NULL")
        return True
    finally:
        conn.close()
