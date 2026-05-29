import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = dirname(__dirname)
const DB_PATH = join(PROJECT_ROOT, 'data', 'app.db')

mkdirSync(dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    floor INTEGER NOT NULL,
    adjacentRooms TEXT NOT NULL DEFAULT '[]',
    baseNoiseLevel INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT NOT NULL,
    instrument TEXT NOT NULL,
    person TEXT NOT NULL,
    timeSlot TEXT NOT NULL,
    date TEXT NOT NULL,
    noiseLevel INTEGER NOT NULL DEFAULT 0,
    originalRoom TEXT,
    originalInstrument TEXT,
    status TEXT NOT NULL DEFAULT 'normal',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS swap_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservationId INTEGER NOT NULL,
    fromRoom TEXT NOT NULL,
    toRoom TEXT NOT NULL,
    reason TEXT NOT NULL,
    operator TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS detection_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    conflictCount INTEGER NOT NULL DEFAULT 0,
    adjacencyRiskCount INTEGER NOT NULL DEFAULT 0,
    details TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );
`)

const roomCount = (db.prepare('SELECT COUNT(*) as count FROM rooms').get() as { count: number }).count

if (roomCount === 0) {
  const insertRoom = db.prepare(
    'INSERT INTO rooms (name, type, floor, adjacentRooms, baseNoiseLevel) VALUES (?, ?, ?, ?, ?)'
  )

  const rooms = [
    ['A101', '钢琴房', 1, JSON.stringify(['A102', 'A103']), 2],
    ['A102', '钢琴房', 1, JSON.stringify(['A101', 'A103']), 2],
    ['A103', '鼓房', 1, JSON.stringify(['A102', 'B201']), 5],
    ['B201', '声乐教室', 2, JSON.stringify(['A103', 'B202']), 4],
    ['B202', '钢琴房', 2, JSON.stringify(['B201', 'B203']), 2],
    ['B203', '鼓房', 2, JSON.stringify(['B202']), 5],
  ]

  const seedRooms = db.transaction((data: (string | number)[][]) => {
    for (const r of data) insertRoom.run(...r)
  })
  seedRooms(rooms)

  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()

  const insertReservation = db.prepare(
    'INSERT INTO reservations (room, instrument, person, timeSlot, date, noiseLevel, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )

  const reservations = [
    ['A101', '钢琴', '张老师', '08:00-10:00', today, 2, 'normal', now, now],
    ['A103', '架子鼓', '李老师', '08:00-10:00', today, 5, 'normal', now, now],
    ['B201', '声乐', '王老师', '08:00-10:00', today, 4, 'normal', now, now],
    ['A102', '钢琴', '张老师', '10:00-12:00', today, 2, 'normal', now, now],
    ['A102', '钢琴', '赵老师', '10:00-12:00', today, 2, 'normal', now, now],
    ['B203', '架子鼓', '刘老师', '14:00-16:00', today, 5, 'normal', now, now],
    ['B202', '钢琴', '陈老师', '14:00-16:00', today, 2, 'normal', now, now],
    ['A103', '架子鼓', '李老师', '16:00-18:00', today, 5, 'normal', now, now],
  ]

  const seedReservations = db.transaction((data: (string | number)[][]) => {
    for (const r of data) insertReservation.run(...r)
  })
  seedReservations(reservations)
}

export default db
