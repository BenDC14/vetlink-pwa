import { openDB } from 'idb'
const DB_NAME = "vetlink_local_db";
const DB_VERSION = 1;

const schema = {
  patients: {
    keyPath: "id",
    indexes: [
      "ownerId",
      "createdBy",
      "updatedAt",
      "syncStatus",
      "version"
    ]
  },
  consultations: {
    keyPath: "id",
    indexes: [
      "patientId",
      "handledByUserId",
      "updatedAt",
      "syncStatus",
      "version"
    ]
  },
  screeningResults: {
    keyPath: "id",
    indexes: [
      "consultationId",
      "imageId",
      "conditionId",
      "severityLevelId",
      "updatedAt",
      "syncStatus",
      "version"
    ]
  },
  uploadedImages: {
    keyPath: "id",
    indexes: [
      "consultationId",
      "updatedAt",
      "syncStatus",
      "version"
    ]
  },
  owners: {
    keyPath: "id",
    indexes: ["updatedAt", "syncStatus", "version"]
  },
  users: {
    keyPath: "id",
    indexes: ["username", "updatedAt", "syncStatus", "version"]
  },
  symptoms: {
    keyPath: "id",
    indexes: ["updatedAt", "syncStatus", "version"]
  },
  skinConditions: {
    keyPath: "id",
    indexes: ["updatedAt", "syncStatus", "version"]
  },
  severityLevels: {
    keyPath: "id",
    indexes: ["updatedAt", "syncStatus", "version"]
  },
  consultationSymptoms: {
    keyPath: "id",
    indexes: [
      "consultationId",
      "symptomId",
      "updatedAt",
      "syncStatus",
      "version"
    ]
  },
  syncQueue: {
    keyPath: "id",
    indexes: [
      "entityType",
      "entityId",
      "status",
      "createdAt"
    ]
  },
  syncConflicts: {
    keyPath: "id",
    indexes: [
      "entityType",
      "entityId",
      "resolutionStatus",
      "createdAt"
    ]
  }
};

export function initDatabase() {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        Object.entries(schema).forEach(([storeName, storeConfig]) => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, {
              keyPath: storeConfig.keyPath,
            })
  
            storeConfig.indexes.forEach((indexName) => {
              store.createIndex(indexName, indexName)
            })
          }
        })
      },
    })
  }

export async function addPatient(patient) {
  const db = await initDatabase()
  const now = new Date().toISOString()
  const syncId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const record = {
    ...patient,
    updatedAt: now,
    syncStatus: 'pending',
    version: 1,
  }

  const tx = db.transaction(['patients', 'syncQueue'], 'readwrite')
  await tx.objectStore('patients').put(record)
  await tx.objectStore('syncQueue').put({
    id: syncId,
    entityType: 'patients',
    entityId: record.id,
    status: 'pending',
    createdAt: now,
  })
  await tx.done
  return record
}

export async function getPatients() {
  const db = await initDatabase()
  return db.getAll('patients')
}

const DEFAULT_STAFF = [
  {
    id: 'ST-001',
    username: 'dr.sarah.lin@clinic.vet',
    name: 'Dr. Sarah Lin',
    role: 'Veterinarian',
    deviceStatus: 'Online',
    syncStatus: 'synced',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ST-002',
    username: 'alex.tan@clinic.vet',
    name: 'Alex Tan',
    role: 'Technician',
    deviceStatus: 'Offline',
    syncStatus: 'synced',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ST-003',
    username: 'maria.reyes@clinic.vet',
    name: 'Maria Reyes',
    role: 'Assistant',
    deviceStatus: 'Online',
    syncStatus: 'synced',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export async function getStaffUsers() {
  const db = await initDatabase()
  const existing = await db.getAll('users')
  if (!existing || existing.length === 0) {
    const tx = db.transaction('users', 'readwrite')
    for (const member of DEFAULT_STAFF) {
      await tx.store.put(member)
    }
    await tx.done
    return DEFAULT_STAFF
  }
  return existing
}

export async function addStaffUser(staff) {
  const db = await initDatabase()
  const now = new Date().toISOString()
  const id = staff.id?.trim() || `ST-${String(Math.floor(100 + Math.random() * 900))}`
  const syncId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const record = {
    ...staff,
    id,
    username: staff.username?.trim() || `${staff.name.toLowerCase().replace(/\s+/g, '.')}@clinic.vet`,
    name: staff.name.trim(),
    role: staff.role || 'Technician',
    deviceStatus: staff.deviceStatus || 'Online',
    syncStatus: 'pending',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }

  const tx = db.transaction(['users', 'syncQueue'], 'readwrite')
  await tx.objectStore('users').put(record)
  await tx.objectStore('syncQueue').put({
    id: syncId,
    entityType: 'users',
    entityId: id,
    status: 'pending',
    createdAt: now,
  })
  await tx.done
  return record
}

export async function updateStaffUser(id, updates) {
  const db = await initDatabase()
  const now = new Date().toISOString()
  const syncId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const tx = db.transaction(['users', 'syncQueue'], 'readwrite')
  const existing = await tx.objectStore('users').get(id)
  if (!existing) {
    throw new Error(`Staff member with ID ${id} not found`)
  }

  const updatedRecord = {
    ...existing,
    ...updates,
    id,
    username: updates.username?.trim() || existing.username,
    name: updates.name ? updates.name.trim() : existing.name,
    role: updates.role || existing.role,
    deviceStatus: updates.deviceStatus || existing.deviceStatus,
    syncStatus: 'pending',
    version: (existing.version || 1) + 1,
    updatedAt: now,
  }

  await tx.objectStore('users').put(updatedRecord)
  await tx.objectStore('syncQueue').put({
    id: syncId,
    entityType: 'users',
    entityId: id,
    status: 'pending',
    createdAt: now,
  })
  await tx.done
  return updatedRecord
}

export async function deleteStaffUser(id) {
  const db = await initDatabase()
  const now = new Date().toISOString()
  const syncId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const tx = db.transaction(['users', 'syncQueue'], 'readwrite')
  const existing = await tx.objectStore('users').get(id)
  if (existing) {
    await tx.objectStore('users').delete(id)
    await tx.objectStore('syncQueue').put({
      id: syncId,
      entityType: 'users',
      entityId: id,
      status: 'pending',
      createdAt: now,
    })
  }
  await tx.done
  return id
}