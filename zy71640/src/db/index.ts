import Dexie, { type Table } from 'dexie'
import type { Exhibition, Wall, Artwork, Light, VisitorPath, SafetyZone, Source, Conflict } from '@/types'

class ExhibitionDB extends Dexie {
  exhibitions!: Table<Exhibition>
  walls!: Table<Wall>
  artworks!: Table<Artwork>
  lights!: Table<Light>
  paths!: Table<VisitorPath>
  safetyZones!: Table<SafetyZone>
  sources!: Table<Source>
  conflicts!: Table<Conflict>

  constructor() {
    super('ExhibitionDB')
    this.version(1).stores({
      exhibitions: 'id, name',
      walls: 'id, exhibitionId',
      artworks: 'id, exhibitionId, wallId',
      lights: 'id, exhibitionId',
      paths: 'id, exhibitionId',
      safetyZones: 'id, exhibitionId, artworkId',
      sources: 'id, type',
      conflicts: 'id, type, severity',
    })
  }
}

export const db = new ExhibitionDB()
