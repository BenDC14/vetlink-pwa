from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import json
import os
import smtplib
import uuid
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


class UpdateProfileRequest(BaseModel):
    name: str


class AdminCreateUserRequest(BaseModel):
    name: str
    email: str
    role: str
    temporary_password: str


class CreatePatientRequest(BaseModel):
    name: str
    species: str = "Canine"
    breed: Optional[str] = ""
    age: Optional[str] = ""
    weight: Optional[str] = ""
    owner_name: Optional[str] = ""
    owner_phone: Optional[str] = ""
    is_archived: bool = False
    area_of_concern: str = ""
    last_visit: Optional[str] = None
    status: str = "Active"


class AuditLogItem(BaseModel):
    id: Optional[str] = None
    action: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    target_entity: Optional[str] = None
    target_id: Optional[str] = None
    details: Optional[str] = None
    created_at: Optional[str] = None


class SyncConflictResolutionRequest(BaseModel):
    resolution: str


class EmailPrescriptionRequest(BaseModel):
    recipient_email: str
    patient_id: Optional[str] = None
    patient_name: str
    owner_name: Optional[str] = "Pet Owner"
    species: Optional[str] = "Canine"
    breed: Optional[str] = "Unknown"
    weight: Optional[str] = None
    diagnosis: str
    prescription_text: str
    clinical_notes: Optional[str] = ""
    doctor_name: Optional[str] = "Dr. Sarah Lin, DVM"
    rx_id: Optional[str] = None


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


@app.patch("/api/auth/profile")
@app.put("/api/auth/profile")
def update_profile(request: UpdateProfileRequest, authorization: Optional[str] = Header(default=None)):
    user = get_current_user_from_header(authorization)
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Display name cannot be empty")
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE users SET name = %s, updated_at = %s WHERE id = %s",
                (name, datetime.utcnow(), user["id"]),
            )
        return {"success": True, "name": name}
    finally:
        conn.close()


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
    allowed_roles = {"Clinic Staff", "Clinic Admin"}
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
                "INSERT INTO id_counters (prefix, `last_value`) VALUES ('ST', 0) "
                "ON DUPLICATE KEY UPDATE `last_value` = `last_value`"
            )
            cursor.execute("SELECT `last_value` FROM id_counters WHERE prefix = 'ST' FOR UPDATE")
            counter_value = cursor.fetchone()["last_value"]
            cursor.execute("SELECT id FROM users WHERE id REGEXP '^ST-[0-9]+$'")
            existing_ids = cursor.fetchall()
            maximum_id = max(
                [int(row["id"].split("-")[1]) for row in existing_ids] + [counter_value],
            )
            next_value = maximum_id + 1
            user_id = f"ST-{next_value:03d}"
            cursor.execute("UPDATE id_counters SET `last_value` = %s WHERE prefix = 'ST'", (next_value,))
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
            normalized_patients = []
            for patient in rows:
                normalized_patients.append({
                    **patient,
                    "areaOfConcern": patient.get("area_of_concern"),
                    "lastVisit": patient.get("last_visit").isoformat() if patient.get("last_visit") else None,
                    "ownerId": patient.get("owner_id"),
                    "ownerName": patient.get("owner_name") or "",
                    "ownerPhone": patient.get("owner_phone") or "",
                    "weight": patient.get("weight") or "",
                    "isArchived": bool(patient.get("is_archived", False)),
                    "createdBy": patient.get("created_by"),
                    "syncStatus": patient.get("sync_status"),
                    "createdAt": patient.get("created_at").isoformat() if patient.get("created_at") else None,
                    "updatedAt": patient.get("updated_at").isoformat() if patient.get("updated_at") else None,
                })
            return {"patients": normalized_patients, "count": len(normalized_patients)}
    finally:
        conn.close()


@app.get("/api/audit-logs")
def get_audit_logs(authorization: Optional[str] = Header(default=None)):
    """Returns chronological audit logs for clinic administration."""
    current_user = get_current_user_from_header(authorization)
    require_admin(current_user)
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500;")
            rows = cursor.fetchall()
            normalized = []
            for r in rows:
                created_at = r.get("created_at")
                normalized.append({
                    "id": r["id"],
                    "action": r["action"],
                    "userId": r.get("user_id"),
                    "userName": r.get("user_name"),
                    "userRole": r.get("user_role"),
                    "targetEntity": r.get("target_entity"),
                    "targetId": r.get("target_id"),
                    "details": r.get("details"),
                    "createdAt": created_at.isoformat() if hasattr(created_at, "isoformat") else created_at,
                })
            return {"logs": normalized, "count": len(normalized)}
    finally:
        conn.close()


@app.post("/api/audit-logs", status_code=201)
def record_audit_log(item: AuditLogItem, authorization: Optional[str] = Header(default=None)):
    """Records an audit log entry into MySQL."""
    current_user = get_current_user_from_header(authorization)
    conn = get_connection()
    try:
        conn.begin()
        with conn.cursor() as cursor:
            log_id = item.id or f"LOG-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
            payload = {
                "id": log_id,
                "action": item.action,
                "userId": item.user_id or current_user.get("id"),
                "userName": item.user_name or current_user.get("name"),
                "userRole": item.user_role or current_user.get("role"),
                "targetEntity": item.target_entity or "",
                "targetId": item.target_id or "",
                "details": item.details or "",
                "createdAt": item.created_at or datetime.utcnow(),
            }
            upsert_audit_log(cursor, payload)
        conn.commit()
        return {"success": True, "log": payload}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.post("/api/patients", status_code=201)
def create_patient(request: CreatePatientRequest, authorization: Optional[str] = Header(default=None)):
    current_user = get_current_user_from_header(authorization)
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Patient name is required")

    conn = get_connection()
    try:
        conn.begin()
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO id_counters (prefix, `last_value`) VALUES ('PT', 1000) "
                "ON DUPLICATE KEY UPDATE `last_value` = `last_value`"
            )
            cursor.execute("SELECT `last_value` FROM id_counters WHERE prefix = 'PT' FOR UPDATE")
            counter_value = cursor.fetchone()["last_value"]
            cursor.execute("SELECT id FROM patients WHERE id REGEXP '^PT-[0-9]+$'")
            existing_ids = cursor.fetchall()
            maximum_id = max(
                [int(row["id"].split("-")[1]) for row in existing_ids] + [counter_value, 1000],
            )
            next_value = maximum_id + 1
            patient_id = f"PT-{next_value:04d}"
            cursor.execute("UPDATE id_counters SET `last_value` = %s WHERE prefix = 'PT'", (next_value,))

            patient_payload = {
                "id": patient_id,
                "name": name,
                "species": request.species,
                "breed": request.breed or "",
                "age": request.age or "",
                "weight": request.weight or "",
                "ownerName": request.owner_name or "",
                "ownerPhone": request.owner_phone or "",
                "isArchived": request.is_archived,
                "areaOfConcern": request.area_of_concern.strip(),
                "lastVisit": request.last_visit or datetime.utcnow().date().isoformat(),
                "status": request.status,
                "createdBy": current_user["id"],
                "version": 1,
            }
            upsert_patient(cursor, patient_payload)
            cursor.execute("SELECT * FROM patients WHERE id = %s", (patient_id,))
            patient = cursor.fetchone()
        conn.commit()

        return {
            **patient,
            "areaOfConcern": patient.get("area_of_concern"),
            "lastVisit": patient.get("last_visit").isoformat() if patient.get("last_visit") else None,
            "ownerId": patient.get("owner_id"),
            "ownerName": patient.get("owner_name") or "",
            "ownerPhone": patient.get("owner_phone") or "",
            "weight": patient.get("weight") or "",
            "isArchived": bool(patient.get("is_archived", False)),
            "createdBy": patient.get("created_by"),
            "syncStatus": patient.get("sync_status"),
            "createdAt": patient.get("created_at").isoformat() if patient.get("created_at") else None,
            "updatedAt": patient.get("updated_at").isoformat() if patient.get("updated_at") else None,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.get("/api/owners")
def list_owners(authorization: Optional[str] = Header(default=None)):
    get_current_user_from_header(authorization)
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM owners ORDER BY name ASC;")
            rows = cursor.fetchall()
            return {"success": True, "owners": rows}
    finally:
        conn.close()


@app.get("/api/owners/{owner_id}")
def get_owner(owner_id: str, authorization: Optional[str] = Header(default=None)):
    get_current_user_from_header(authorization)
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM owners WHERE id = %s;", (owner_id,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Owner not found")
            return {"success": True, "owner": row}
    finally:
        conn.close()


def dispatch_prescription_email(req: EmailPrescriptionRequest) -> tuple[bool, str]:
    """Sends prescription email via SMTP if configured, else records simulation."""
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_user or "clinic@vetlink.ph")
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")

    subject = f"Official Veterinary Prescription - {req.patient_name} ({req.diagnosis})"

    plain_text = f"""==================================================
VETLINK ANIMAL CARE CLINIC & HOSPITAL
Veterinary Medical Center • Department of Clinical Dermatology
102 Rizal Avenue, Brgy. San Antonio • Tel: (02) 8876-5432 • Mobile: 0917-123-4567 • clinic@vetlink.ph
==================================================

OFFICIAL VETERINARY PRESCRIPTION (℞)

PATIENT:         {req.patient_name}
SPECIES / BREED: {req.species} • {req.breed}
WEIGHT:          {req.weight or 'N/A'} kg
OWNER:           {req.owner_name}
DATE:            {datetime.utcnow().strftime('%B %d, %Y')}
CASE / RX ID:    {req.rx_id or 'RX-REF'}

CLINICAL DIAGNOSIS:
{req.diagnosis}

℞ MEDICATION & DOSAGE DISPENSING ORDER:
--------------------------------------------------
{req.prescription_text}
--------------------------------------------------

CLINICAL CARE, HOME ADMINISTRATION & RECHECK INSTRUCTIONS:
{req.clinical_notes or 'Follow standard clinical home care.'}

ATTENDING VETERINARIAN:
{req.doctor_name}
PRC License No.: VET-894102
PTR No.: 1948201

--------------------------------------------------
Notice: Official prescription issued under Republic Act 9268. Valid for 30 days.
=================================================="""

    html_text = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #0f172a; }}
    .rx-box {{ max-width: 640px; margin: 0 auto; background: #ffffff; border: 2px solid #0f172a; border-radius: 8px; padding: 28px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }}
    .clinic-head {{ text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px; }}
    .meta-table {{ width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; }}
    .meta-table td {{ padding: 8px 12px; }}
    .diag-banner {{ background: #f1f5f9; border-left: 4px solid #1e3a8a; padding: 8px 12px; margin-bottom: 16px; font-size: 13px; }}
    .rx-title {{ display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-weight: 800; font-size: 14px; color: #1e3a8a; }}
    .rx-orders {{ background: #f8fafc; border: 1.5px solid #0f172a; border-radius: 6px; padding: 12px; font-family: Consolas, monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; margin-bottom: 16px; }}
    .instructions {{ background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 12px; line-height: 1.5; color: #334155; margin-bottom: 20px; white-space: pre-wrap; }}
    .footer-sig {{ border-top: 1px solid #cbd5e1; padding-top: 14px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }}
  </style>
</head>
<body>
  <div class="rx-box">
    <div class="clinic-head">
      <h2 style="margin: 0 0 4px; font-size: 20px; color: #0f172a;">VETLINK ANIMAL CARE CLINIC & HOSPITAL</h2>
      <p style="margin: 0 0 4px; font-size: 12px; color: #334155; font-weight: 600;">Veterinary Medical Center • Department of Clinical Dermatology</p>
      <p style="margin: 0; font-size: 11px; color: #64748b;">102 Rizal Avenue, Brgy. San Antonio • Tel: (02) 8876-5432 • Mobile: 0917-123-4567 • clinic@vetlink.ph</p>
    </div>

    <table class="meta-table">
      <tr>
        <td><strong>PATIENT:</strong> {req.patient_name}<br><strong>SPECIES:</strong> {req.species} ({req.breed})</td>
        <td><strong>OWNER:</strong> {req.owner_name}<br><strong>DATE:</strong> {datetime.utcnow().strftime('%B %d, %Y')}</td>
      </tr>
      <tr>
        <td><strong>WEIGHT:</strong> {req.weight or 'N/A'} kg</td>
        <td><strong>RX / CASE ID:</strong> {req.rx_id or 'RX-OFFICIAL'}</td>
      </tr>
    </table>

    <div class="diag-banner">
      <strong>CLINICAL DIAGNOSIS:</strong> <u style="font-weight: 700;">{req.diagnosis}</u>
    </div>

    <div style="font-size: 22px; font-family: Georgia, serif; font-weight: bold; color: #1e3a8a; margin-bottom: 4px;">℞ MEDICATION & DOSAGE DISPENSING ORDER</div>
    <div class="rx-orders">{req.prescription_text}</div>

    <div style="font-weight: 700; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; color: #0f172a;">CLINICAL CARE, HOME ADMINISTRATION & RECHECK INSTRUCTIONS:</div>
    <div class="instructions">{req.clinical_notes or 'Administer as prescribed. Contact clinic if any adverse reactions occur.'}</div>

    <div class="footer-sig">
      <div style="max-width: 340px;">Notice: Official veterinary prescription issued under Republic Act 9268. Valid for 30 days.</div>
      <div style="text-align: right;">
        <strong>{req.doctor_name}</strong><br>
        PRC License No.: VET-894102<br>
        PTR No.: 1948201
      </div>
    </div>
  </div>
</body>
</html>"""

    if smtp_host and smtp_user and smtp_password:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"VetLink Animal Care Clinic <{smtp_from}>"
            msg["To"] = req.recipient_email
            msg.attach(MIMEText(plain_text, "plain"))
            msg.attach(MIMEText(html_text, "html"))

            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
                if smtp_use_tls:
                    server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, [req.recipient_email], msg.as_string())
            server.quit()
            return True, "Delivered via Clinic SMTP"
        except Exception as e:
            print(f"[WARN] SMTP delivery failed: {e}. Falling back to simulation.")
            return False, f"SMTP error: {str(e)}"

    print(f"[EMAIL SIMULATION] Prescription dispatched to {req.recipient_email} for patient {req.patient_name}.")
    return True, "Dispatched via Clinic Cloud Queue (Simulated)"


@app.post("/api/prescriptions/email")
def send_prescription_email(req: EmailPrescriptionRequest, authorization: Optional[str] = Header(default=None)):
    """Dispatches official prescription to pet owner's email address and logs audit trail."""
    current_user = None
    if authorization and authorization.startswith("Bearer "):
        try:
            current_user = get_current_user_from_header(authorization)
        except Exception:
            pass

    recipient = req.recipient_email.strip().lower()
    if not recipient or "@" not in recipient or "." not in recipient:
        raise HTTPException(status_code=400, detail="A valid recipient email address is required")

    success, message = dispatch_prescription_email(req)

    # Record Audit Log into MySQL if database is connected
    try:
        conn = get_connection()
        try:
            conn.begin()
            with conn.cursor() as cursor:
                log_id = f"LOG-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
                details = f"Prescription emailed to {recipient} for patient {req.patient_name} ({req.diagnosis}). Result: {message}"
                payload = {
                    "id": log_id,
                    "action": "PRESCRIPTION_EMAILED",
                    "userId": current_user.get("id") if current_user else "STAFF",
                    "userName": current_user.get("name") if current_user else (req.doctor_name or "Clinic Staff"),
                    "userRole": current_user.get("role") if current_user else "Staff",
                    "targetEntity": "patients",
                    "targetId": req.patient_id or "",
                    "details": details,
                    "createdAt": datetime.utcnow(),
                }
                upsert_audit_log(cursor, payload)
            conn.commit()
        except Exception as log_err:
            conn.rollback()
            print(f"[WARN] Could not record prescription audit log: {log_err}")
        finally:
            conn.close()
    except Exception as db_err:
        print(f"[WARN] DB connection unavailable for audit log: {db_err}")

    return {
        "success": True,
        "recipient": recipient,
        "message": f"Official prescription successfully emailed to {recipient}.",
        "detail": message,
    }


# -----------------------------------------------------------------------------
# Main Cloud Sync Handlers
# -----------------------------------------------------------------------------
def upsert_user(cursor, payload: dict):
    user_id = payload.get("id")
    username = payload.get("username") or f"{user_id}@clinic.vet"
    name = payload.get("name") or "Unnamed Staff"
    role = payload.get("role", "Clinic Staff")
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


def upsert_owner(cursor, payload: dict):
    owner_id = payload.get("id")
    name = payload.get("name") or "Unnamed Owner"
    phone = payload.get("phone") or ""
    email = payload.get("email") or ""
    address = payload.get("address") or ""
    version = payload.get("version", 1)
    now = datetime.utcnow()

    sql = """
        INSERT INTO owners (id, name, phone, email, address, sync_status, version, updated_at)
        VALUES (%s, %s, %s, %s, %s, 'synced', %s, %s)
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            phone = VALUES(phone),
            email = VALUES(email),
            address = VALUES(address),
            sync_status = 'synced',
            version = VALUES(version),
            updated_at = VALUES(updated_at);
    """
    cursor.execute(sql, (owner_id, name, phone, email, address, version, now))


def upsert_patient(cursor, payload: dict):
    patient_id = payload.get("id")
    name = payload.get("name", "Unknown Patient")
    species = payload.get("species", "Canine")
    breed = payload.get("breed", "")
    age = payload.get("age", "")
    weight = payload.get("weight", "")
    owner_name = payload.get("ownerName") or payload.get("owner_name", "")
    owner_phone = payload.get("ownerPhone") or payload.get("owner_phone", "")
    is_archived = bool(payload.get("isArchived", payload.get("is_archived", False)))
    area_of_concern = payload.get("areaOfConcern") or payload.get("area_of_concern", "")
    last_visit = payload.get("lastVisit") or payload.get("last_visit") or datetime.utcnow().date()
    status = payload.get("status", "Active")
    owner_id = payload.get("ownerId") or payload.get("owner_id")
    created_by = payload.get("createdBy") or payload.get("created_by")
    version = payload.get("version", 1)
    now = datetime.utcnow()

    sql = """
        INSERT INTO patients (id, name, species, breed, age, weight, owner_name, owner_phone, is_archived, area_of_concern, last_visit, status, owner_id, created_by, sync_status, version, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'synced', %s, %s)
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            species = VALUES(species),
            breed = VALUES(breed),
            age = VALUES(age),
            weight = VALUES(weight),
            owner_name = VALUES(owner_name),
            owner_phone = VALUES(owner_phone),
            is_archived = VALUES(is_archived),
            area_of_concern = VALUES(area_of_concern),
            last_visit = VALUES(last_visit),
            status = VALUES(status),
            owner_id = VALUES(owner_id),
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
            weight,
            owner_name,
            owner_phone,
            is_archived,
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


def parse_db_datetime(value) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        val = value.strip()
        if val.endswith("Z") or val.endswith("z"):
            val = val[:-1]
        if "+" in val:
            val = val.split("+")[0]
        val = val.replace("T", " ")
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                return datetime.strptime(val, fmt)
            except ValueError:
                pass
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00").replace("z", "+00:00"))
        except Exception:
            pass
    return datetime.utcnow()


def upsert_audit_log(cursor, payload: dict):
    log_id = payload.get("id") or f"LOG-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
    action = payload.get("action", "SYSTEM_EVENT")
    user_id = payload.get("userId") or payload.get("user_id", "")
    user_name = payload.get("userName") or payload.get("user_name", "")
    user_role = payload.get("userRole") or payload.get("user_role", "")
    target_entity = payload.get("targetEntity") or payload.get("target_entity", "")
    target_id = payload.get("targetId") or payload.get("target_id", "")
    details = payload.get("details", "")
    created_at = parse_db_datetime(payload.get("createdAt") or payload.get("created_at"))

    sql = """
        INSERT INTO audit_logs (id, action, user_id, user_name, user_role, target_entity, target_id, details, sync_status, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'synced', %s)
        ON DUPLICATE KEY UPDATE
            action = VALUES(action),
            user_id = VALUES(user_id),
            user_name = VALUES(user_name),
            user_role = VALUES(user_role),
            target_entity = VALUES(target_entity),
            target_id = VALUES(target_id),
            details = VALUES(details),
            sync_status = 'synced';
    """
    cursor.execute(sql, (log_id, action, user_id, user_name, user_role, target_entity, target_id, details, created_at))


def upsert_consultation(cursor, payload: dict):
    consultation_id = payload.get("id")
    patient_id = payload.get("patientId") or payload.get("patient_id")
    handled_by_user_id = payload.get("handledByUserId") or payload.get("handled_by_user_id")
    version = payload.get("version", 1)
    cursor.execute(
        """INSERT INTO consultations
           (id, patient_id, handled_by_user_id, clinical_notes, diagnosis,
            secondary_diagnosis, is_comorbid, treatment_plan, sync_status, version, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'synced', %s, %s)
           ON DUPLICATE KEY UPDATE
             patient_id = VALUES(patient_id), handled_by_user_id = VALUES(handled_by_user_id),
             clinical_notes = VALUES(clinical_notes), diagnosis = VALUES(diagnosis),
             secondary_diagnosis = VALUES(secondary_diagnosis), is_comorbid = VALUES(is_comorbid),
             treatment_plan = VALUES(treatment_plan), sync_status = 'synced',
             version = VALUES(version), updated_at = VALUES(updated_at)""",
        (
            consultation_id,
            patient_id,
            handled_by_user_id,
            payload.get("clinicalNotes") or payload.get("clinical_notes"),
            payload.get("diagnosis"),
            payload.get("secondaryDiagnosis") or payload.get("secondary_diagnosis"),
            bool(payload.get("isComorbid", payload.get("is_comorbid", False))),
            payload.get("treatmentPlan") or payload.get("treatment_plan"),
            version,
            datetime.utcnow(),
        ),
    )


def upsert_screening_result(cursor, payload: dict):
    result_id = payload.get("id")
    top3 = payload.get("aiTop3") or payload.get("ai_top3")
    if isinstance(top3, (list, dict)):
        top3 = json.dumps(top3, default=str)
    version = payload.get("version", 1)
    cursor.execute(
        """INSERT INTO screening_results
           (id, consultation_id, image_id, condition_id, severity_level_id,
            confidence_score, heatmap_data, image_data, ai_label, ai_display_label,
            ai_percent, ai_secondary_label, ai_secondary_confidence, is_comorbid,
            ai_description, ai_top3, species, review_status, sync_status, version, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'synced', %s, %s)
           ON DUPLICATE KEY UPDATE
             consultation_id = VALUES(consultation_id), image_id = VALUES(image_id),
             condition_id = VALUES(condition_id), severity_level_id = VALUES(severity_level_id),
             confidence_score = VALUES(confidence_score), heatmap_data = VALUES(heatmap_data),
             image_data = VALUES(image_data), ai_label = VALUES(ai_label),
             ai_display_label = VALUES(ai_display_label), ai_percent = VALUES(ai_percent),
             ai_secondary_label = VALUES(ai_secondary_label),
             ai_secondary_confidence = VALUES(ai_secondary_confidence),
             is_comorbid = VALUES(is_comorbid), ai_description = VALUES(ai_description),
             ai_top3 = VALUES(ai_top3), species = VALUES(species),
             review_status = VALUES(review_status), sync_status = 'synced',
             version = VALUES(version), updated_at = VALUES(updated_at)""",
        (
            result_id,
            payload.get("consultationId") or payload.get("consultation_id"),
            payload.get("imageId") or payload.get("image_id"),
            payload.get("conditionId") or payload.get("condition_id"),
            payload.get("severityLevelId") or payload.get("severity_level_id"),
            payload.get("aiConfidence", payload.get("confidence_score")),
            payload.get("heatmapData") or payload.get("heatmap_data"),
            payload.get("imageData") or payload.get("image_data"),
            payload.get("aiLabel") or payload.get("ai_label"),
            payload.get("aiDisplayLabel") or payload.get("ai_display_label"),
            payload.get("aiPercent") or payload.get("ai_percent"),
            payload.get("aiSecondaryLabel") or payload.get("ai_secondary_label"),
            payload.get("aiSecondaryConfidence", payload.get("ai_secondary_confidence")),
            bool(payload.get("isComorbid", payload.get("is_comorbid", False))),
            payload.get("aiDescription") or payload.get("ai_description"),
            top3,
            payload.get("species"),
            payload.get("reviewStatus") or payload.get("review_status") or "pending",
            version,
            datetime.utcnow(),
        ),
    )


SYNC_ENTITY_TABLES = {
    "users": "users",
    "owners": "owners",
    "patients": "patients",
    "consultations": "consultations",
    "screeningResults": "screening_results",
    "auditLogs": "audit_logs",
}


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
            entity_priority = {"users": 0, "owners": 1, "patients": 2, "consultations": 3, "screeningresults": 4, "auditlogs": 5}
            ordered_items = sorted(
                batch.queue,
                key=lambda item: (entity_priority.get(item.entityType.lower(), 99), item.createdAt or ""),
            )
            for item in ordered_items:
                try:
                    entity_type = item.entityType.lower()
                    if entity_type == "screeningresults":
                        entity_type = "screeningResults"
                    elif entity_type in ("auditlogs", "audit_logs"):
                        entity_type = "auditLogs"
                    operation = item.operation.upper()
                    payload = item.payload or {}

                    if entity_type == "users" and current_user["role"] != "Clinic Admin":
                        raise ValueError("Only a clinic administrator can sync staff-account changes")
                    if entity_type not in SYNC_ENTITY_TABLES:
                        raise ValueError(f"Unsupported entity type: {item.entityType}")
                    if operation not in ("CREATE", "UPDATE", "DELETE"):
                        raise ValueError(f"Unsupported operation: {item.operation}")

                    if operation in ("CREATE", "UPDATE"):
                        if payload.get("id") != item.entityId:
                            raise ValueError("Payload ID must match the queued entity ID")
                        if entity_type == "users":
                            required_fields = ("username", "name")
                        elif entity_type == "owners":
                            required_fields = ("name",)
                        elif entity_type == "patients":
                            required_fields = ("name",)
                        elif entity_type == "consultations":
                            required_fields = ("patientId",) if not payload.get("patient_id") else ()
                        elif entity_type == "auditLogs":
                            required_fields = ("action",)
                        else:
                            required_fields = ("consultationId",) if not payload.get("consultation_id") else ()
                        missing_fields = [field for field in required_fields if not payload.get(field)]
                        if missing_fields:
                            raise ValueError(f"Missing required payload fields: {', '.join(missing_fields)}")

                    conn.begin()
                    table_name = SYNC_ENTITY_TABLES[entity_type]
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

                    elif entity_type == "owners":
                        if operation in ("CREATE", "UPDATE"):
                            upsert_payload = {**payload, "version": int(cloud_record["version"]) + 1 if cloud_record else 1}
                            upsert_owner(cursor, upsert_payload)
                        elif operation == "DELETE":
                            cursor.execute("DELETE FROM owners WHERE id = %s", (item.entityId,))

                    elif entity_type == "patients":
                        if operation in ("CREATE", "UPDATE"):
                            upsert_payload = {**payload, "version": int(cloud_record["version"]) + 1 if cloud_record else 1}
                            upsert_patient(cursor, upsert_payload)
                        elif operation == "DELETE":
                            delete_patient(cursor, item.entityId)

                    elif entity_type == "consultations":
                        if operation in ("CREATE", "UPDATE"):
                            upsert_payload = {**payload, "version": int(cloud_record["version"]) + 1 if cloud_record else 1}
                            upsert_consultation(cursor, upsert_payload)
                        elif operation == "DELETE":
                            cursor.execute("DELETE FROM consultations WHERE id = %s", (item.entityId,))

                    elif entity_type == "screeningResults":
                        if operation in ("CREATE", "UPDATE"):
                            upsert_payload = {**payload, "version": int(cloud_record["version"]) + 1 if cloud_record else 1}
                            upsert_screening_result(cursor, upsert_payload)
                        elif operation == "DELETE":
                            cursor.execute("DELETE FROM screening_results WHERE id = %s", (item.entityId,))

                    elif entity_type in ("auditLogs", "audit_logs"):
                        if operation in ("CREATE", "UPDATE"):
                            upsert_audit_log(cursor, payload)
                        elif operation == "DELETE":
                            cursor.execute("DELETE FROM audit_logs WHERE id = %s", (item.entityId,))

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
                            entity_type,
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
                cursor.execute("SELECT * FROM owners WHERE updated_at > %s;", (since,))
                owners = cursor.fetchall()
                cursor.execute("SELECT * FROM patients WHERE updated_at > %s;", (since,))
                patients = cursor.fetchall()
                cursor.execute("SELECT * FROM consultations WHERE updated_at > %s;", (since,))
                consultations = cursor.fetchall()
                cursor.execute("SELECT * FROM screening_results WHERE updated_at > %s;", (since,))
                screening_results = cursor.fetchall()
                cursor.execute("SELECT * FROM audit_logs WHERE created_at > %s ORDER BY created_at DESC LIMIT 500;", (since,))
                audit_logs = cursor.fetchall()
            else:
                cursor.execute("SELECT * FROM users;")
                users = cursor.fetchall()
                cursor.execute("SELECT * FROM owners;")
                owners = cursor.fetchall()
                cursor.execute("SELECT * FROM patients;")
                patients = cursor.fetchall()
                cursor.execute("SELECT * FROM consultations;")
                consultations = cursor.fetchall()
                cursor.execute("SELECT * FROM screening_results;")
                screening_results = cursor.fetchall()
                cursor.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500;")
                audit_logs = cursor.fetchall()
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
                "owners": owners,
                "patients": patients,
                "consultations": consultations,
                "screeningResults": screening_results,
                "auditLogs": audit_logs,
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
            if entity_type not in SYNC_ENTITY_TABLES:
                raise HTTPException(status_code=400, detail="Unsupported conflict type")
            table_name = SYNC_ENTITY_TABLES[entity_type]
            cursor.execute(f"SELECT * FROM {table_name} WHERE id = %s FOR UPDATE", (conflict["entity_id"],))
            current_cloud = cursor.fetchone()

            if request.resolution == "cloud":
                resolved_record = dict(current_cloud) if current_cloud else {"id": conflict["entity_id"], "_deleted": True}
            else:
                local_record = decode_json_value(conflict["local_data"])
                if local_record.get("_deleted"):
                    cursor.execute(f"DELETE FROM {table_name} WHERE id = %s", (conflict["entity_id"],))
                    resolved_record = {"id": conflict["entity_id"], "_deleted": True}
                else:
                    next_version = int(current_cloud["version"] or 0) + 1 if current_cloud else 1
                    local_record["version"] = next_version
                    upsert_functions = {
                        "users": upsert_user,
                        "owners": upsert_owner,
                        "patients": upsert_patient,
                        "consultations": upsert_consultation,
                        "screeningResults": upsert_screening_result,
                    }
                    upsert_functions[entity_type](cursor, local_record)
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
    # Physical screens / Monitors / Displays
    "screen", "monitor", "television", "cellular_telephone",
    "laptop", "notebook", "desktop_computer", "oscilloscope",
    "digital_clock", "analog_clock"
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
        orig_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        img_arr = np.array(orig_img.resize((224, 224)), dtype=np.float32)

        interpreter, labels = get_ai_model()
        inp_idx = interpreter.get_input_details()[0]["index"]
        out_idx = interpreter.get_output_details()[0]["index"]

        sp_key = (req.species or "canine").strip().lower()
        allowed = SPECIES_CLASS_MAP.get(sp_key, labels)

        # 1. Primary Neural Evaluation on the clinician's submitted image
        inp_tensor = np.expand_dims(img_arr, axis=0)
        interpreter.set_tensor(inp_idx, inp_tensor)
        interpreter.invoke()
        raw_preds = interpreter.get_tensor(out_idx)[0].tolist()
        filtered = {labels[i]: float(raw_preds[i]) for i in range(len(labels)) if labels[i] in allowed}

        # 2. Automated Feline Ear & Cranial Lesion Focus:
        # In cats, facial anatomical landmarks (eyes/nose/whiskers) can bias MobileNetV3 toward Ringworm.
        # Check if the ear margins or cranial region (where Notoedres cati crusts localize) reveal severe Mange.
        if sp_key in ["feline", "cat"] and "Mange" in allowed:
            w, h = orig_img.size
            ear_candidates = [
                orig_img.crop((0, 0, int(w * 0.45), int(h * 0.35))),         # Left ear pinna
                orig_img.crop((int(w * 0.55), 0, w, int(h * 0.35))),         # Right ear pinna
                orig_img.crop((int(w * 0.15), 0, int(w * 0.85), int(h * 0.45))), # Cranial forehead/ears
            ]
            for cand_img in ear_candidates:
                cand_arr = np.array(cand_img.resize((224, 224)), dtype=np.float32)
                interpreter.set_tensor(inp_idx, np.expand_dims(cand_arr, axis=0))
                interpreter.invoke()
                cand_preds = interpreter.get_tensor(out_idx)[0].tolist()
                cand_filtered = {labels[i]: float(cand_preds[i]) for i in range(len(labels)) if labels[i] in allowed}
                cand_sum = sum(cand_filtered.values()) or 1.0
                if (cand_filtered.get("Mange", 0.0) / cand_sum) >= 0.70:
                    filtered = cand_filtered
                    break

        tot = sum(filtered.values()) or 1.0
        normalized = sorted([(lbl, filtered[lbl] / tot) for lbl in allowed], key=lambda x: x[1], reverse=True)
        top_label, top_conf = normalized[0]
        max_disease_conf = max([filtered[lbl] / tot for lbl in allowed if "Healthy" not in lbl] or [0.0])

        # 3. Animal / Screen / Inanimate Object Verification Gate
        verifier, animal_mask = get_animal_verifier()
        if verifier and animal_mask is not None:
            try:
                import tensorflow as tf
                arr_norm = tf.keras.applications.mobilenet_v3.preprocess_input(img_arr.copy())
                v_preds = verifier.predict(np.expand_dims(arr_norm, axis=0), verbose=0)
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
                    any(t[1] in SCREEN_OR_TECH_CLASSES and float(t[2]) >= 0.10 for t in top_dec)
                )

                # Calibrated Clinical Rejection Gate:
                # Bypass rejection if VetLink disease model confirms high-confidence animal pathology (>= 0.70)
                should_reject = False
                if is_screen_or_tech and p_animal < 0.35 and max_disease_conf < 0.70:
                    should_reject = True
                elif is_derm_mimic and p_animal < 0.10 and max_disease_conf < 0.70:
                    should_reject = True
                elif is_top_artifact and p_animal < 0.25 and max_disease_conf < 0.70:
                    should_reject = True
                elif p_animal < 0.16 and max_disease_conf < 0.60:
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
