from datetime import datetime
import json
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.database import auto_initialize_schema, get_connection, test_connection

app = FastAPI(
    title="VetLink Cloud Sync API",
    description="Sync backend bridge between VetLink PWA IndexedDB and MySQL database.",
    version="1.0.0",
)

# Enable CORS for local Vite dev server and PWA devices
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local Wi-Fi / tablet testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Attempt auto-initialization of MySQL tables on server start."""
    try:
        auto_initialize_schema()
        print("✓ VetLink MySQL schema verified / initialized.")
    except Exception as exc:
        print(f"⚠ Could not auto-initialize schema (ensure MySQL is running): {exc}")


# -----------------------------------------------------------------------------
# Data Models
# -----------------------------------------------------------------------------
class SyncItem(BaseModel):
    id: str
    entityType: str
    entityId: str
    operation: str  # CREATE, UPDATE, DELETE
    status: Optional[str] = "pending"
    createdAt: Optional[str] = None
    payload: Optional[Dict[str, Any]] = Field(default_factory=dict)


class SyncBatchRequest(BaseModel):
    queue: List[SyncItem]


# -----------------------------------------------------------------------------
# Health & Status Endpoints
# -----------------------------------------------------------------------------
@app.get("/")
def root():
    return {
        "service": "VetLink Cloud Sync API",
        "status": "online",
        "docs_url": "/docs",
    }


@app.get("/api/health")
def health_check():
    """Verifies connection to XAMPP MySQL and returns record statistics."""
    try:
        db_info = test_connection()
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) AS total FROM users;")
            users_count = cursor.fetchone()["total"]
            cursor.execute("SELECT COUNT(*) AS total FROM patients;")
            patients_count = cursor.fetchone()["total"]
        conn.close()

        return {
            "status": "healthy",
            "database": db_info,
            "counts": {
                "users": users_count,
                "patients": patients_count,
            },
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as err:
        raise HTTPException(
            status_code=503,
            detail=f"Database connection error: {str(err)}",
        )


# -----------------------------------------------------------------------------
# Data Inspection Endpoints (Easy testing from browser)
# -----------------------------------------------------------------------------
@app.get("/api/users")
def get_all_users():
    """Returns all staff/users currently stored in MySQL."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users ORDER BY created_at ASC;")
            rows = cursor.fetchall()
            return {"users": rows, "count": len(rows)}
    finally:
        conn.close()


@app.get("/api/patients")
def get_all_patients():
    """Returns all patients currently stored in MySQL."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM patients ORDER BY updated_at DESC;")
            rows = cursor.fetchall()
            return {"patients": rows, "count": len(rows)}
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# Main Cloud Sync Handlers
# -----------------------------------------------------------------------------
def upsert_user(cursor, payload: dict):
    user_id = payload.get("id")
    username = payload.get("username") or f"{user_id}@clinic.vet"
    name = payload.get("name") or "Unnamed Staff"
    role = payload.get("role", "Technician")
    device_status = payload.get("deviceStatus") or payload.get("device_status", "Online")
    version = payload.get("version", 1)
    now = datetime.utcnow()

    sql = """
        INSERT INTO users (id, username, name, role, device_status, sync_status, version, updated_at)
        VALUES (%s, %s, %s, %s, %s, 'synced', %s, %s)
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            username = VALUES(username),
            role = VALUES(role),
            device_status = VALUES(device_status),
            sync_status = 'synced',
            version = VALUES(version),
            updated_at = VALUES(updated_at);
    """
    cursor.execute(sql, (user_id, username, name, role, device_status, version, now))


def delete_user(cursor, entity_id: str):
    cursor.execute("DELETE FROM users WHERE id = %s;", (entity_id,))


def upsert_patient(cursor, payload: dict):
    patient_id = payload.get("id")
    name = payload.get("name", "Unknown Patient")
    species = payload.get("species", "Canine")
    breed = payload.get("breed", "")
    age = payload.get("age", "")
    area_of_concern = payload.get("areaOfConcern") or payload.get("area_of_concern", "")
    last_visit = payload.get("lastVisit") or payload.get("last_visit") or datetime.utcnow().date()
    status = payload.get("status", "Active")
    owner_id = payload.get("ownerId") or payload.get("owner_id")
    created_by = payload.get("createdBy") or payload.get("created_by")
    version = payload.get("version", 1)
    now = datetime.utcnow()

    sql = """
        INSERT INTO patients (id, name, species, breed, age, area_of_concern, last_visit, status, owner_id, created_by, sync_status, version, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'synced', %s, %s)
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            species = VALUES(species),
            breed = VALUES(breed),
            age = VALUES(age),
            area_of_concern = VALUES(area_of_concern),
            last_visit = VALUES(last_visit),
            status = VALUES(status),
            sync_status = 'synced',
            version = VALUES(version),
            updated_at = VALUES(updated_at);
    """
    cursor.execute(
        sql,
        (
            patient_id,
            name,
            species,
            breed,
            age,
            area_of_concern,
            last_visit,
            status,
            owner_id,
            created_by,
            version,
            now,
        ),
    )


def delete_patient(cursor, entity_id: str):
    cursor.execute("DELETE FROM patients WHERE id = %s;", (entity_id,))


@app.post("/api/sync")
def sync_push(batch: SyncBatchRequest):
    """
    Accepts pending items from IndexedDB syncQueue,
    executes upserts/deletes in MySQL, and returns list of synced item IDs.
    """
    if not batch.queue:
        return {"success": True, "synced_ids": [], "errors": []}

    conn = get_connection()
    synced_ids = []
    errors = []

    try:
        with conn.cursor() as cursor:
            for item in batch.queue:
                try:
                    entity_type = item.entityType.lower()
                    operation = item.operation.upper()
                    payload = item.payload or {}

                    if entity_type not in ("users", "patients"):
                        raise ValueError(f"Unsupported entity type: {item.entityType}")
                    if operation not in ("CREATE", "UPDATE", "DELETE"):
                        raise ValueError(f"Unsupported operation: {item.operation}")

                    if operation in ("CREATE", "UPDATE"):
                        if payload.get("id") != item.entityId:
                            raise ValueError("Payload ID must match the queued entity ID")
                        required_fields = ("username", "name") if entity_type == "users" else ("name",)
                        missing_fields = [field for field in required_fields if not payload.get(field)]
                        if missing_fields:
                            raise ValueError(f"Missing required payload fields: {', '.join(missing_fields)}")

                    if entity_type == "users":
                        if operation in ("CREATE", "UPDATE"):
                            upsert_user(cursor, payload)
                        elif operation == "DELETE":
                            delete_user(cursor, item.entityId)

                    elif entity_type == "patients":
                        if operation in ("CREATE", "UPDATE"):
                            upsert_patient(cursor, payload)
                        elif operation == "DELETE":
                            delete_patient(cursor, item.entityId)

                    # Log sync audit trail into MySQL sync_queue table
                    audit_sql = """
                        INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, payload, created_at)
                        VALUES (%s, %s, %s, %s, 'processed', %s, %s)
                        ON DUPLICATE KEY UPDATE status = 'processed';
                    """
                    cursor.execute(
                        audit_sql,
                        (
                            item.id,
                            item.entityType,
                            item.entityId,
                            operation,
                            json.dumps(payload),
                            datetime.utcnow(),
                        ),
                    )

                    synced_ids.append(item.id)

                except Exception as item_err:
                    errors.append({
                        "id": item.id,
                        "entityId": item.entityId,
                        "error": str(item_err),
                    })

        return {
            "success": len(errors) == 0,
            "synced_ids": synced_ids,
            "synced_count": len(synced_ids),
            "errors": errors,
            "server_time": datetime.utcnow().isoformat(),
        }

    finally:
        conn.close()


@app.get("/api/sync/pull")
def sync_pull(since: Optional[str] = Query(None, description="ISO timestamp")):
    """
    Returns records from MySQL that were updated after `since`,
    allowing the PWA client to update its IndexedDB with cloud data.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            if since:
                cursor.execute("SELECT * FROM users WHERE updated_at > %s;", (since,))
                users = cursor.fetchall()
                cursor.execute("SELECT * FROM patients WHERE updated_at > %s;", (since,))
                patients = cursor.fetchall()
            else:
                cursor.execute("SELECT * FROM users;")
                users = cursor.fetchall()
                cursor.execute("SELECT * FROM patients;")
                patients = cursor.fetchall()
            cursor.execute(
                "SELECT DISTINCT entity_type, entity_id FROM sync_queue "
                "WHERE status = 'processed' AND operation = 'DELETE';"
            )
            deleted = cursor.fetchall()

            return {
                "users": users,
                "patients": patients,
                "deleted": deleted,
                "server_time": datetime.utcnow().isoformat(),
            }
    finally:
        conn.close()
