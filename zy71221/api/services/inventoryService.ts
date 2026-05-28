import db from '../db.js'

interface InventoryRow {
  id: number
  security_code: string
  security_name: string
  total_qty: number
  locked_qty: number
}

interface InventoryWithAvailable extends InventoryRow {
  available_qty: number
}

function getAllInventory(): InventoryWithAvailable[] {
  const rows = db.prepare('SELECT * FROM inventory ORDER BY security_code').all() as InventoryRow[]
  return rows.map(row => ({
    ...row,
    available_qty: row.total_qty - row.locked_qty,
  }))
}

function getBySecurityCode(code: string): InventoryWithAvailable | undefined {
  const row = db.prepare('SELECT * FROM inventory WHERE security_code = ?').get(code) as InventoryRow | undefined
  if (!row) return undefined
  return {
    ...row,
    available_qty: row.total_qty - row.locked_qty,
  }
}

export default { getAllInventory, getBySecurityCode }
