import argparse
import getpass

from backend.database import auto_initialize_schema, get_connection
from backend.security import hash_password


def main():
    parser = argparse.ArgumentParser(description="Create the first VetLink clinic administrator.")
    parser.add_argument("--email", required=True, help="Administrator email address")
    args = parser.parse_args()
    email = args.email.strip().lower()
    if "@" not in email:
        parser.error("Provide a valid email address.")

    password = getpass.getpass("Temporary admin password (input hidden): ")
    confirmation = getpass.getpass("Confirm temporary password: ")
    if password != confirmation:
        parser.error("Passwords did not match.")
    if len(password) < 10:
        parser.error("Temporary password must be at least 10 characters.")

    auto_initialize_schema()
    conn = get_connection()
    try:
        conn.begin()
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO id_counters (prefix, last_value) VALUES ('ST', 0) "
                "ON DUPLICATE KEY UPDATE last_value = last_value"
            )
            cursor.execute("SELECT last_value FROM id_counters WHERE prefix = 'ST' FOR UPDATE")
            counter_value = cursor.fetchone()["last_value"]
            cursor.execute("SELECT id FROM users WHERE id REGEXP '^ST-[0-9]+$'")
            existing_ids = cursor.fetchall()
            maximum_id = max(
                [int(row["id"].split("-")[1]) for row in existing_ids] + [counter_value],
            )
            next_value = maximum_id + 1
            user_id = f"ST-{next_value:03d}"
            cursor.execute("UPDATE id_counters SET last_value = %s WHERE prefix = 'ST'", (next_value,))
            cursor.execute(
                """INSERT INTO users
                   (id, username, name, role, password_hash, must_change_password, is_active,
                    device_status, sync_status, version)
                   VALUES (%s, %s, %s, 'Clinic Admin', %s, TRUE, TRUE, 'Online', 'synced', 1)""",
                (user_id, email, "Clinic Administrator", hash_password(password)),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"Created administrator account {email} ({user_id}).")
    print("The account will require a password change at first sign-in.")


if __name__ == "__main__":
    main()
