import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  Location, LocationAlias, Feedback, PlanVersion,
  PlanLocation, Photo, OperationLog, MergeSuggestion
} from '@/types'

interface ChargingStationDB extends DBSchema {
  locations: {
    key: string
    value: Location
    indexes: {
      'by-canonicalName': string
      'by-status': string
      'by-source': string
      'by-mergeStatus': string
      'by-createdAt': string
    }
  }
  locationAliases: {
    key: string
    value: LocationAlias
    indexes: {
      'by-locationId': string
      'by-alias': string
    }
  }
  feedbacks: {
    key: string
    value: Feedback
    indexes: {
      'by-locationId': string
      'by-status': string
      'by-createdAt': string
    }
  }
  planVersions: {
    key: string
    value: PlanVersion
    indexes: {
      'by-versionName': string
      'by-createdAt': string
    }
  }
  planLocations: {
    key: string
    value: PlanLocation
    indexes: {
      'by-planId': string
      'by-locationId': string
    }
  }
  photos: {
    key: string
    value: Photo
    indexes: {
      'by-locationId': string
      'by-uploadedAt': string
    }
  }
  operationLogs: {
    key: string
    value: OperationLog
    indexes: {
      'by-type': string
      'by-operatedAt': string
    }
  }
  mergeSuggestions: {
    key: string
    value: MergeSuggestion
    indexes: {
      'by-resolved': string
    }
  }
}

const DB_NAME = 'charging-station-db'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<ChargingStationDB> | null = null

export async function getDB(): Promise<IDBPDatabase<ChargingStationDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<ChargingStationDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const locationStore = db.createObjectStore('locations', { keyPath: 'id' })
      locationStore.createIndex('by-canonicalName', 'canonicalName')
      locationStore.createIndex('by-status', 'status')
      locationStore.createIndex('by-source', 'source')
      locationStore.createIndex('by-mergeStatus', 'mergeStatus')
      locationStore.createIndex('by-createdAt', 'createdAt')

      const aliasStore = db.createObjectStore('locationAliases', { keyPath: 'id' })
      aliasStore.createIndex('by-locationId', 'locationId')
      aliasStore.createIndex('by-alias', 'alias')

      const feedbackStore = db.createObjectStore('feedbacks', { keyPath: 'id' })
      feedbackStore.createIndex('by-locationId', 'locationId')
      feedbackStore.createIndex('by-status', 'status')
      feedbackStore.createIndex('by-createdAt', 'createdAt')

      const planStore = db.createObjectStore('planVersions', { keyPath: 'id' })
      planStore.createIndex('by-versionName', 'versionName')
      planStore.createIndex('by-createdAt', 'createdAt')

      const planLocStore = db.createObjectStore('planLocations', { keyPath: 'id' })
      planLocStore.createIndex('by-planId', 'planId')
      planLocStore.createIndex('by-locationId', 'locationId')

      const photoStore = db.createObjectStore('photos', { keyPath: 'id' })
      photoStore.createIndex('by-locationId', 'locationId')
      photoStore.createIndex('by-uploadedAt', 'uploadedAt')

      const logStore = db.createObjectStore('operationLogs', { keyPath: 'id' })
      logStore.createIndex('by-type', 'type')
      logStore.createIndex('by-operatedAt', 'operatedAt')

      const mergeStore = db.createObjectStore('mergeSuggestions', { keyPath: 'id' })
      mergeStore.createIndex('by-resolved', 'resolved')
    },
  })

  return dbInstance
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function nowISO(): string {
  return new Date().toISOString()
}
