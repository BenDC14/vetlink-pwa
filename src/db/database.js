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

function createSyncQueueItem(entityType, entityId, operation, payload, createdAt) {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`

  return { id, entityType, entityId, operation, payload, status: 'pending', createdAt }
}

export async function addPatient(patient) {
  const db = await initDatabase()
  const now = new Date().toISOString()
  const record = {
    ...patient,
    updatedAt: now,
    syncStatus: 'pending',
    version: 1,
  }

  const tx = db.transaction(['patients', 'syncQueue'], 'readwrite')
  await tx.objectStore('patients').put(record)
  await tx.objectStore('syncQueue').put(createSyncQueueItem('patients', record.id, 'CREATE', record, now))
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
  await tx.objectStore('syncQueue').put(createSyncQueueItem('users', id, 'CREATE', record, now))
  await tx.done
  return record
}

export async function updateStaffUser(id, updates) {
  const db = await initDatabase()
  const now = new Date().toISOString()

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
  await tx.objectStore('syncQueue').put(createSyncQueueItem('users', id, 'UPDATE', updatedRecord, now))
  await tx.done
  return updatedRecord
}

export async function deleteStaffUser(id) {
  const db = await initDatabase()
  const now = new Date().toISOString()

  const tx = db.transaction(['users', 'syncQueue'], 'readwrite')
  const existing = await tx.objectStore('users').get(id)
  if (existing) {
    await tx.objectStore('users').delete(id)
    await tx.objectStore('syncQueue').put(createSyncQueueItem('users', id, 'DELETE', { id }, now))
  }
  await tx.done
  return id
}

export async function getPendingSyncQueue() {
  const db = await initDatabase()
  return db.getAll('syncQueue')
}

export async function performCloudSync(apiBaseUrl = 'http://localhost:8000') {
  const db = await initDatabase()
  const queue = await db.getAll('syncQueue')
  let pushResult = { success: true, synced_ids: [], synced_count: 0, errors: [] }

  if (queue.length > 0) {
    const preparedQueue = await Promise.all(queue.map(async (item) => {
      if (item.operation && item.payload) return item

      const storeName = item.entityType === 'users' ? 'users' : item.entityType === 'patients' ? 'patients' : null
      const record = storeName ? await db.get(storeName, item.entityId) : null
      return {
        ...item,
        operation: item.operation || (record ? 'UPDATE' : 'DELETE'),
        payload: item.payload || record || { id: item.entityId },
      }
    }))

    const response = await fetch(`${apiBaseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue: preparedQueue }),
    })

    if (!response.ok) {
      throw new Error(`Cloud server responded with status HTTP ${response.status}`)
    }

    pushResult = await response.json()
    const syncedIds = new Set(pushResult.synced_ids || [])

    if (syncedIds.size > 0) {
      const tx = db.transaction(['syncQueue', 'users', 'patients'], 'readwrite')
      const queueStore = tx.objectStore('syncQueue')
      const userStore = tx.objectStore('users')
      const patientStore = tx.objectStore('patients')

      for (const item of queue) {
        if (!syncedIds.has(item.id)) continue
        await queueStore.delete(item.id)

        const store = item.entityType === 'users' ? userStore : item.entityType === 'patients' ? patientStore : null
        if (store) {
          const record = await store.get(item.entityId)
          const remaining = await queueStore.index('entityId').getAll(item.entityId)
          if (record && remaining.length === 0) {
            record.syncStatus = 'synced'
            await store.put(record)
          }
        }
      }
      await tx.done
    }
  }

  const pullResponse = await fetch(`${apiBaseUrl}/api/sync/pull`)
  if (!pullResponse.ok) {
    throw new Error(`Cloud pull failed with status HTTP ${pullResponse.status}`)
  }
  const cloudSnapshot = await pullResponse.json()
  const currentQueue = await db.getAll('syncQueue')
  const queuedEntities = new Set(currentQueue.map((item) => `${item.entityType}:${item.entityId}`))

  const reconcileStore = async (storeName, cloudRecords, deletedRecords, mapRecord) => {
    const localRecords = await db.getAll(storeName)
    const cloudById = new Map(cloudRecords.map((record) => {
      const mapped = mapRecord(record)
      return [mapped.id, mapped]
    }))
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)

    for (const [id, cloudRecord] of cloudById) {
      if (queuedEntities.has(`${storeName}:${id}`)) continue
      await store.put({ ...cloudRecord, syncStatus: 'synced' })
    }

    for (const localRecord of localRecords) {
      const cloudDeleted = deletedRecords.some((item) =>
        item.entity_type === storeName && item.entity_id === localRecord.id,
      )
      if (cloudDeleted && !cloudById.has(localRecord.id) && !queuedEntities.has(`${storeName}:${localRecord.id}`)) {
        await store.delete(localRecord.id)
      }
    }
    await tx.done
  }

  await reconcileStore('users', cloudSnapshot.users || [], cloudSnapshot.deleted || [], (record) => ({
    ...record,
    deviceStatus: record.device_status ?? record.deviceStatus,
    syncStatus: record.sync_status ?? record.syncStatus,
    createdAt: record.created_at ?? record.createdAt,
    updatedAt: record.updated_at ?? record.updatedAt,
  }))
  await reconcileStore('patients', cloudSnapshot.patients || [], cloudSnapshot.deleted || [], (record) => ({
    ...record,
    areaOfConcern: record.area_of_concern ?? record.areaOfConcern,
    lastVisit: record.last_visit ?? record.lastVisit,
    ownerId: record.owner_id ?? record.ownerId,
    createdBy: record.created_by ?? record.createdBy,
    syncStatus: record.sync_status ?? record.syncStatus,
    createdAt: record.created_at ?? record.createdAt,
    updatedAt: record.updated_at ?? record.updatedAt,
  }))

  const remainingQueue = await db.getAll('syncQueue')
  const failedItems = pushResult.errors || []
  const pendingKeys = new Set(remainingQueue.map((item) => `${item.entityType}:${item.entityId}`))
  const localIds = new Set()
  for (const storeName of ['users', 'patients']) {
    const localRecords = await db.getAll(storeName)
    for (const record of localRecords) {
      if (!pendingKeys.has(`${storeName}:${record.id}`)) localIds.add(`${storeName}:${record.id}`)
    }
  }
  const cloudIds = new Set([
    ...(cloudSnapshot.users || []).map((record) => `users:${record.id}`),
    ...(cloudSnapshot.patients || []).map((record) => `patients:${record.id}`),
  ].filter((key) => !pendingKeys.has(key)))
  const hasUnqueuedMismatch = localIds.size !== cloudIds.size || [...localIds].some((id) => !cloudIds.has(id))
  return {
    success: pushResult.success !== false && remainingQueue.length === 0 && !hasUnqueuedMismatch,
    syncedCount: pushResult.synced_count || pushResult.synced_ids?.length || 0,
    pendingCount: remainingQueue.length,
    errors: failedItems,
    message: hasUnqueuedMismatch
      ? 'Sync could not confirm parity: unqueued local and cloud records differ.'
      : remainingQueue.length === 0
        ? 'Local and cloud records are synchronized.'
        : `Cloud sync completed with ${remainingQueue.length} local change(s) still pending.`,
  }
}
