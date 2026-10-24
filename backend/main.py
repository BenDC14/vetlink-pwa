from datetime import datetime, timedelta
import json
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.database import auto_initialize_schema, get_connection, test_connection
from backend.security import create_session_token, hash_password, hash_session_token, verify_password

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
        print("[OK] VetLink MySQL schema verified / initialized.")
    except Exception as exc:
        print(f"[WARNING] Could not auto-initialize schema (ensure MySQL is running): {exc}")


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
    baseVersion: Optional[int] = None


class SyncBatchRequest(BaseModel):
    queue: List[SyncItem]


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class AdminCreateUserRequest(BaseModel):
    name: str
    email: str
    role: str
    temporary_password: str


class SyncConflictResolutionRequest(BaseModel):
    resolution: str


def decode_json_value(value):
    if isinstance(value, str):
        return json.loads(value)
    return value


def serialize_sync_conflict(row: dict) -> dict:
    created_at = row.get("created_at")
    return {
        "id": row["id"],
        "entityType": row["entity_type"],
        "entityId": row["entity_id"],
        "localData": decode_json_value(row["local_data"]),
        "cloudData": decode_json_value(row["cloud_data"]),
        "resolutionStatus": row["resolution_status"],
        "resolution": row.get("resolution"),
        "createdAt": created_at.isoformat() if hasattr(created_at, "isoformat") else created_at,
    }


def require_admin(user: dict) -> None:
    if user["role"] != "Clinic Admin":
        raise HTTPException(status_code=403, detail="Clinic administrator access required")


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


@app.post("/api/auth/login")
def login(request: LoginRequest):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, username, name, role, password_hash, must_change_password, is_active "
                "FROM users WHERE username = %s",
                (request.email.strip().lower(),),
            )
            user = cursor.fetchone()
            if (
                not user
                or not user["is_active"]
                or not user["password_hash"]
                or not verify_password(request.password, user["password_hash"])
            ):
                raise HTTPException(status_code=401, detail="Invalid email or password")

            token = create_session_token()
            expires_at = datetime.utcnow() + timedelta(hours=8)
            cursor.execute(
                "INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
                (hash_session_token(token), user["id"], expires_at),
            )
            return {
                "access_token": token,
                "token_type": "bearer",
                "expires_at": expires_at.isoformat(),
                "must_change_password": bool(user["must_change_password"]),
                "user": {
                    "id": user["id"],
                    "email": user["username"],
                    "name": user["name"],
                    "role": user["role"],
                },
            }
    finally:
        conn.close()


@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    get_current_user_from_header(authorization)
    token = authorization.removeprefix("Bearer ").strip()
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM auth_sessions WHERE token_hash = %s", (hash_session_token(token),))
        return {"success": True}
    finally:
        conn.close()


@app.post("/api/auth/change-password")
def change_password(request: ChangePasswordRequest, authorization: Optional[str] = Header(default=None)):
    user = get_current_user_from_header(authorization)
    new_password = request.new_password
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    if not any(character.isalpha() for character in new_password):
        raise HTTPException(status_code=400, detail="New password must include at least one letter")
    if not any(character.isdigit() for character in new_password):
        raise HTTPException(status_code=400, detail="New password must include at least one number")
    if not any(not character.isalnum() and not character.isspace() for character in new_password):
        raise HTTPException(status_code=400, detail="New password must include at least one special character")
    if any(character.isspace() or ord(character) < 32 or ord(character) == 127 for character in new_password):
        raise HTTPException(status_code=400, detail="Spaces and control characters are not allowed")

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT password_hash FROM users WHERE id = %s", (user["id"],))
            row = cursor.fetchone()
            if not row or not verify_password(request.current_password, row["password_hash"]):
                raise HTTPException(status_code=401, detail="Current password is incorrect")
            cursor.execute(
                "UPDATE users SET password_hash = %s, must_change_password = FALSE WHERE id = %s",
                (hash_password(new_password), user["id"]),
            )
        return {"success": True}
    finally:
        conn.close()


@app.get("/api/auth/me")
def auth_me(authorization: Optional[str] = Header(default=None)):
    user = get_current_user_from_header(authorization)
    return {
        "id": user["id"],
        "email": user["username"],
        "name": user["name"],
        "role": user["role"],
        "must_change_password": bool(user["must_change_password"]),
    }


def get_current_user_from_header(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.removeprefix("Bearer ").strip()
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT u.id, u.username, u.name, u.role, u.must_change_password, u.is_active
                   FROM auth_sessions s JOIN users u ON u.id = s.user_id
                   WHERE s.token_hash = %s AND s.expires_at > %s""",
                (hash_session_token(token), datetime.utcnow()),
            )
            user = cursor.fetchone()
            if not user or not user["is_active"]:
                raise HTTPException(status_code=401, detail="Session expired or account disabled")
            return user
    finally:
        conn.close()


@app.post("/api/admin/users")
def admin_create_user(request: AdminCreateUserRequest, authorization: Optional[str] = Header(default=None)):
    admin = get_current_user_from_header(authorization)
    require_admin(admin)
    name = request.name.strip()
    email = request.email.strip().lower()
    allowed_roles = {"Veterinarian", "Technician", "Assistant", "Clinic Admin"}
    if not name or "@" not in email:
        raise HTTPException(status_code=400, detail="A name and valid email are required")
    if request.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Invalid staff role")
    if len(request.temporary_password) < 10:
        raise HTTPException(status_code=400, detail="Temporary password must be at least 10 characters")

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
                   VALUES (%s, %s, %s, %s, %s, TRUE, TRUE, 'Online', 'synced', 1)""",
                (user_id, email, name, request.role, hash_password(request.temporary_password)),
            )
        conn.commit()
        return {"id": user_id, "email": email, "name": name, "role": request.role, "must_change_password": True}
    except Exception as err:
        conn.rollback()
        if getattr(err, "args", [None])[0] == 1062:
            raise HTTPException(status_code=409, detail="An account with this email already exists") from err
        raise
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# Data Inspection Endpoints (Easy testing from browser)
# -----------------------------------------------------------------------------
@app.get("/api/users")
def get_all_users(authorization: Optional[str] = Header(default=None)):
    """Returns all staff/users currently stored in MySQL."""
    user = get_current_user_from_header(authorization)
    require_admin(user)
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, username, name, role, device_status, sync_status, version, created_at, updated_at FROM users ORDER BY created_at ASC;")
            rows = cursor.fetchall()
            return {"users": rows, "count": len(rows)}
    finally:
        conn.close()


@app.get("/api/patients")
def get_all_patients(authorization: Optional[str] = Header(default=None)):
    """Returns all patients currently stored in MySQL."""
    get_current_user_from_header(authorization)
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
def sync_push(batch: SyncBatchRequest, authorization: Optional[str] = Header(default=None)):
    """
    Accepts pending items from IndexedDB syncQueue,
    executes upserts/deletes in MySQL, and returns list of synced item IDs.
    """
    current_user = get_current_user_from_header(authorization)
    if not batch.queue:
        return {"success": True, "synced_ids": [], "errors": []}

    conn = get_connection()
    synced_ids = []
    errors = []
    conflicts = []

    try:
        with conn.cursor() as cursor:
            for item in batch.queue:
                try:
                    entity_type = item.entityType.lower()
                    operation = item.operation.upper()
                    payload = item.payload or {}

                    if entity_type == "users" and current_user["role"] != "Clinic Admin":
                        raise ValueError("Only a clinic administrator can sync staff-account changes")
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

                    conn.begin()
                    table_name = "users" if entity_type == "users" else "patients"
                    cursor.execute(
                        f"SELECT * FROM {table_name} WHERE id = %s FOR UPDATE",
                        (item.entityId,),
                    )
                    cloud_record = cursor.fetchone()
                    supplied_base = item.baseVersion
                    if supplied_base is None and operation in ("CREATE", "UPDATE"):
                        supplied_base = max(int(payload.get("version", 1)) - 1, 0)

                    version_mismatch = (
                        operation in ("CREATE", "UPDATE", "DELETE")
                        and cloud_record is not None
                        and supplied_base is not None
                        and int(cloud_record["version"] or 1) != supplied_base
                    )
                    cloud_deleted_conflict = (
                        operation == "UPDATE"
                        and cloud_record is None
                        and supplied_base is not None
                        and supplied_base > 0
                    )
                    unexpected_create = operation == "CREATE" and cloud_record is not None and supplied_base == 0

                    if version_mismatch or cloud_deleted_conflict or unexpected_create:
                        cloud_version = dict(cloud_record) if cloud_record else {
                            "id": item.entityId,
                            "version": 0,
                            "_deleted": True,
                        }
                        cloud_version.pop("password_hash", None)
                        local_version = dict(payload)
                        if operation == "DELETE":
                            local_version["_deleted"] = True
                        conflict_data = {
                            "id": item.id,
                            "entity_type": entity_type,
                            "entity_id": item.entityId,
                            "local_data": json.dumps(local_version, default=str),
                            "cloud_data": json.dumps(cloud_version, default=str),
                        }
                        cursor.execute(
                            """INSERT INTO sync_conflicts
                               (id, entity_type, entity_id, local_data, cloud_data, resolution_status)
                               VALUES (%s, %s, %s, %s, %s, 'unresolved')
                               ON DUPLICATE KEY UPDATE local_data = VALUES(local_data),
                                 cloud_data = VALUES(cloud_data), resolution_status = 'unresolved'""",
                            (
                                conflict_data["id"],
                                conflict_data["entity_type"],
                                conflict_data["entity_id"],
                                conflict_data["local_data"],
                                conflict_data["cloud_data"],
                            ),
                        )
                        cursor.execute(
                            """INSERT INTO sync_queue
                               (id, entity_type, entity_id, operation, status, payload, created_at)
                               VALUES (%s, %s, %s, %s, 'conflict', %s, %s)
                               ON DUPLICATE KEY UPDATE status = 'conflict'""",
                            (item.id, entity_type, item.entityId, operation, json.dumps(payload, default=str), datetime.utcnow()),
                        )
                        conn.commit()
                        conflicts.append({
                            "id": item.id,
                            "queue_id": item.id,
                            "entityType": entity_type,
                            "entityId": item.entityId,
                            "localData": local_version,
                            "cloudData": cloud_version,
                            "baseVersion": supplied_base,
                            "operation": operation,
                            "reason": "The cloud record changed after this device's last synced version.",
                            "createdAt": datetime.utcnow().isoformat(),
                        })
                        continue

                    if entity_type == "users":
                        if operation in ("CREATE", "UPDATE"):
                            upsert_payload = {**payload, "version": int(cloud_record["version"]) + 1 if cloud_record else 1}
                            upsert_user(cursor, upsert_payload)
                        elif operation == "DELETE":
                            delete_user(cursor, item.entityId)

                    elif entity_type == "patients":
                        if operation in ("CREATE", "UPDATE"):
                            upsert_payload = {**payload, "version": int(cloud_record["version"]) + 1 if cloud_record else 1}
                            upsert_patient(cursor, upsert_payload)
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
                            json.dumps(payload, default=str),
                            datetime.utcnow(),
                        ),
                    )

                    conn.commit()
                    synced_ids.append(item.id)

                except Exception as item_err:
                    conn.rollback()
                    errors.append({
                        "id": item.id,
                        "entityId": item.entityId,
                        "error": str(item_err),
                    })

        return {
            "success": len(errors) == 0 and len(conflicts) == 0,
            "synced_ids": synced_ids,
            "synced_count": len(synced_ids),
            "errors": errors,
            "conflicts": conflicts,
            "server_time": datetime.utcnow().isoformat(),
        }

    finally:
        conn.close()


@app.get("/api/sync/pull")
def sync_pull(since: Optional[str] = Query(None, description="ISO timestamp"), authorization: Optional[str] = Header(default=None)):
    """
    Returns records from MySQL that were updated after `since`,
    allowing the PWA client to update its IndexedDB with cloud data.
    """
    get_current_user_from_header(authorization)
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
            cursor.execute(
                """SELECT id, entity_type, entity_id, local_data, cloud_data,
                          resolution_status, resolution, created_at
                   FROM sync_conflicts WHERE resolution_status = 'unresolved'
                   ORDER BY created_at DESC"""
            )
            conflicts = [serialize_sync_conflict(row) for row in cursor.fetchall()]

            return {
                "users": users,
                "patients": patients,
                "deleted": deleted,
                "conflicts": conflicts,
                "server_time": datetime.utcnow().isoformat(),
            }
    finally:
        conn.close()


@app.get("/api/sync/conflicts")
def get_sync_conflicts(authorization: Optional[str] = Header(default=None)):
    get_current_user_from_header(authorization)
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT id, entity_type, entity_id, local_data, cloud_data,
                          resolution_status, resolution, created_at
                   FROM sync_conflicts WHERE resolution_status = 'unresolved'
                   ORDER BY created_at DESC"""
            )
            return {"conflicts": [serialize_sync_conflict(row) for row in cursor.fetchall()]}
    finally:
        conn.close()


@app.post("/api/sync/conflicts/{conflict_id}/resolve")
def resolve_sync_conflict(
    conflict_id: str,
    request: SyncConflictResolutionRequest,
    authorization: Optional[str] = Header(default=None),
):
    get_current_user_from_header(authorization)
    if request.resolution not in ("local", "cloud"):
        raise HTTPException(status_code=400, detail="Resolution must be 'local' or 'cloud'")

    conn = get_connection()
    try:
        conn.begin()
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT id, entity_type, entity_id, local_data, cloud_data,
                          resolution_status, resolution, created_at
                   FROM sync_conflicts WHERE id = %s FOR UPDATE""",
                (conflict_id,),
            )
            conflict = cursor.fetchone()
            if not conflict:
                raise HTTPException(status_code=404, detail="Sync conflict not found")
            if conflict["resolution_status"] != "unresolved":
                raise HTTPException(status_code=409, detail="Sync conflict has already been resolved")

            entity_type = conflict["entity_type"]
            if entity_type not in ("users", "patients"):
                raise HTTPException(status_code=400, detail="Unsupported conflict type")
            table_name = "users" if entity_type == "users" else "patients"
            cursor.execute(f"SELECT * FROM {table_name} WHERE id = %s FOR UPDATE", (conflict["entity_id"],))
            current_cloud = cursor.fetchone()

            if request.resolution == "cloud":
                resolved_record = dict(current_cloud) if current_cloud else {"id": conflict["entity_id"], "_deleted": True}
            else:
                local_record = decode_json_value(conflict["local_data"])
                if local_record.get("_deleted"):
                    if entity_type == "users":
                        delete_user(cursor, conflict["entity_id"])
                    else:
                        delete_patient(cursor, conflict["entity_id"])
                    resolved_record = {"id": conflict["entity_id"], "_deleted": True}
                else:
                    next_version = int(current_cloud["version"] or 0) + 1 if current_cloud else 1
                    local_record["version"] = next_version
                    if entity_type == "users":
                        upsert_user(cursor, local_record)
                    else:
                        upsert_patient(cursor, local_record)
                    cursor.execute(f"SELECT * FROM {table_name} WHERE id = %s", (conflict["entity_id"],))
                    resolved_record = cursor.fetchone()

            cursor.execute(
                "UPDATE sync_conflicts SET resolution_status = 'resolved', resolution = %s WHERE id = %s",
                (request.resolution, conflict_id),
            )
            cursor.execute("UPDATE sync_queue SET status = 'processed' WHERE id = %s", (conflict_id,))
        conn.commit()
        return {"success": True, "resolution": request.resolution, "record": resolved_record}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# AI Disease Classification Endpoint (MobileNetV3 TFLite)
# -----------------------------------------------------------------------------
import base64
import io
from pathlib import Path

AI_MODEL_PATH = Path(__file__).resolve().parent.parent / "public" / "models" / "vetlink_model_v2.tflite"
AI_LABELS_PATH = Path(__file__).resolve().parent.parent / "public" / "models" / "vetlink_labels_v2.json"

_ai_interpreter = None
_ai_labels = []

def get_ai_model():
    global _ai_interpreter, _ai_labels
    if _ai_interpreter is not None:
        return _ai_interpreter, _ai_labels

    import tensorflow as tf

    with open(AI_LABELS_PATH, "r", encoding="utf-8") as f:
        lmap = json.load(f)
    _ai_labels = [lmap[str(i)] for i in range(len(lmap))]

    _ai_interpreter = tf.lite.Interpreter(model_path=str(AI_MODEL_PATH))
    _ai_interpreter.allocate_tensors()
    return _ai_interpreter, _ai_labels

SPECIES_CLASS_MAP = {
    "canine": ["Healthy", "Hotspots", "Mange", "Pyoderma", "Ringworm"],
    "dog":    ["Healthy", "Hotspots", "Mange", "Pyoderma", "Ringworm"],
    "feline": ["Healthy", "Hotspots", "Mange", "Pyoderma", "Ringworm"],
    "cat":    ["Healthy", "Hotspots", "Mange", "Pyoderma", "Ringworm"],
    "avian":  ["Avian Fowl Pox", "Bird_Healthy", "Scaly Face Scaly Leg Mite (Knemidocoptes)"],
    "bird":   ["Avian Fowl Pox", "Bird_Healthy", "Scaly Face Scaly Leg Mite (Knemidocoptes)"],
    "rabbit": ["Rabbit Mange", "Rabbit Ringworm", "Rabbit_Healthy"],
}

CLASS_DISPLAY_NAMES = {
    "Avian Fowl Pox": "Avian Fowl Pox",
    "Bird_Healthy": "Healthy (Bird)",
    "Healthy": "Healthy",
    "Hotspots": "Hot Spots",
    "Mange": "Mange",
    "Pyoderma": "Pyoderma",
    "Rabbit Mange": "Mange (Rabbit)",
    "Rabbit Ringworm": "Ringworm (Rabbit)",
    "Rabbit_Healthy": "Healthy (Rabbit)",
    "Ringworm": "Ringworm",
    "Scaly Face Scaly Leg Mite (Knemidocoptes)": "Scaly Face / Leg Mite",
}

class AIPredictionRequest(BaseModel):
    image: str
    species: Optional[str] = "Canine"

_animal_verifier = None

_animal_verifier = None
_animal_mask = None

def get_animal_verifier():
    global _animal_verifier, _animal_mask
    if _animal_verifier is not None:
        return _animal_verifier, _animal_mask
    try:
        import tensorflow as tf
        import numpy as np
        _animal_verifier = tf.keras.applications.MobileNetV3Small(weights="imagenet", include_top=True)
        # Precompute animal class boolean mask across 1,000 ImageNet categories
        # Synsets starting with n01 (fish, birds, reptiles) and n02 (mammals: dogs, cats, rabbits)
        dummy = np.eye(1000, dtype=np.float32)
        decoded = tf.keras.applications.mobilenet_v3.decode_predictions(dummy, top=1)
        _animal_mask = np.array([
            bool(r[0][0].startswith(("n01", "n02")) or r[0][1] in {"wool", "fleece", "feather_boa"})
            for r in decoded
        ], dtype=bool)
    except Exception as e:
        print(f"[WARN] Animal verifier unavailable: {e}")
        _animal_verifier = False
        _animal_mask = None
    return _animal_verifier, _animal_mask

SCREEN_OR_TECH_CLASSES = {
    # Screens / Monitors / Computers / UI
    "screen", "monitor", "television", "web_site", "digital_clock", "analog_clock",
    "cellular_telephone", "laptop", "notebook", "desktop_computer", "ping-pong_ball",
    "switch", "envelope", "traffic_light", "joystick", "scoreboard", "projector",
    "packet", "menu", "binder", "book_jacket", "desk", "dining_table", "radiator",
    "sliding_door", "window_shade", "remote_control", "keyboard", "mouse", "modem",
    "hard_disc", "loudspeaker", "oscilloscope", "plate", "cup", "coffee_mug",
    "spotlight", "dial", "crossword_puzzle", "rule", "slide_rule"
}

# Organic texture mimics in veterinary dermatology:
# Severe crusting, lichenification, and nodular mange / ringworm / calcinosis cutis
# often share low-level visual textures with fruits, fungi, barks, or sponges in ImageNet.
DERM_TEXTURE_MIMICS = {
    "custard_apple", "jackfruit", "breadfruit", "bolete", "sponge", "cauliflower",
    "coral_fungus", "honeycomb", "sea_anemone", "agaric", "mushroom", "earthstar",
    "wool", "fleece", "feather_boa", "head_cabbage", "acorn_squash", "butternut_squash",
    "conch", "snail", "slug"
}

@app.post("/api/ai/predict")
def predict_disease(req: AIPredictionRequest):
    try:
        import numpy as np
        from PIL import Image

        img_b64 = req.image
        if "," in img_b64:
            img_b64 = img_b64.split(",", 1)[1]

        raw_bytes = base64.b64decode(img_b64)
        pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB").resize((224, 224))
        img_arr = np.array(pil_img, dtype=np.float32)

        # 0. Animal / Screen / Inanimate Object Verification Gate
        verifier, animal_mask = get_animal_verifier()
        if verifier and animal_mask is not None:
            try:
                import tensorflow as tf
                arr_norm = tf.keras.applications.mobilenet_v3.preprocess_input(img_arr.copy())
                v_preds = verifier.predict(np.expand_dims(arr_norm, axis=0), verbose=0)
                
                # Calculate total probability mass of animal classes (Real animal lesions: 24% - 92%)
                p_animal = float(np.sum(v_preds[0, animal_mask]))
                
                top_dec = tf.keras.applications.mobilenet_v3.decode_predictions(v_preds, top=5)[0]
                top_id, top_name, top_score = top_dec[0]
                is_top_artifact = not top_id.startswith(("n01", "n02"))
                is_derm_mimic = (
                    top_name in DERM_TEXTURE_MIMICS or 
                    any(t[1] in DERM_TEXTURE_MIMICS for t in top_dec[:2])
                )
                is_screen_or_tech = (
                    top_name in SCREEN_OR_TECH_CLASSES or 
                    any(t[1] in SCREEN_OR_TECH_CLASSES and float(t[2]) >= 0.05 for t in top_dec)
                )

                # Calibrated Clinical Rejection Gate:
                # 1. Screen / computer monitor / digital display detected and animal sum < 25% (monitor photo had 13.3%)
                # 2. Or dermatological texture mimic (e.g. custard apple / jackfruit on crusted mange) rejected ONLY if near-zero animal signal (< 12%)
                # 3. Or generic inanimate manufactured artifact and animal sum < 20%
                # 4. Or overall animal probability mass is below true non-animal cutoff (< 16%)
                should_reject = False
                if is_screen_or_tech and p_animal < 0.25:
                    should_reject = True
                elif is_derm_mimic:
                    should_reject = (p_animal < 0.12)
                elif is_top_artifact and p_animal < 0.20:
                    should_reject = True
                elif p_animal < 0.16:
                    should_reject = True

                if should_reject:
                    clean_name = top_name.replace("_", " ").title()
                    detected_label = f"Computer Screen / {clean_name}" if is_screen_or_tech else clean_name
                    return {
                        "rejected": True,
                        "reason": "NON_ANIMAL",
                        "detected": detected_label,
                        "p_animal": round(p_animal, 3),
                        "message": f"Non-animal subject detected ({detected_label}, animal match: {round(p_animal * 100, 1)}%). VetLink only evaluates actual animal patient skin lesions (Canine, Feline, Avian, Rabbit). Please photograph the animal's skin condition directly."
                    }
            except Exception as v_err:
                print(f"[WARN] Animal verifier check error: {v_err}")

        interpreter, labels = get_ai_model()
        inp_idx = interpreter.get_input_details()[0]["index"]
        out_idx = interpreter.get_output_details()[0]["index"]

        inp_tensor = np.expand_dims(img_arr, axis=0)
        interpreter.set_tensor(inp_idx, inp_tensor)
        interpreter.invoke()
        raw_preds = interpreter.get_tensor(out_idx)[0].tolist()

        sp_key = (req.species or "canine").strip().lower()
        allowed = SPECIES_CLASS_MAP.get(sp_key, labels)

        filtered = [
            (labels[i], raw_preds[i])
            for i in range(len(raw_preds))
            if labels[i] in allowed
        ]

        # Re-normalize across the candidate classes
        filtered.sort(key=lambda x: x[1], reverse=True)
        sum_p = sum(p for _, p in filtered) or 1.0
        normalized = [(lbl, p / sum_p) for lbl, p in filtered]

        top_label, top_conf = normalized[0]
        top3 = [
            {
                "label": lbl,
                "display": CLASS_DISPLAY_NAMES.get(lbl, lbl),
                "confidence": conf,
            }
            for lbl, conf in normalized[:3]
        ]

        return {
            "label": top_label,
            "displayLabel": CLASS_DISPLAY_NAMES.get(top_label, top_label),
            "confidence": top_conf,
            "percent": f"{top_conf * 100:.1f}%",
            "top3": top3,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI inference error: {str(e)}")
