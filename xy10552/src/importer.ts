import { getDb } from './database';
import { 
  ImportData, 
  Store, 
  Product, 
  StorePrice, 
  Promotion, 
  TagPrintRecord, 
  TagScan 
} from './types';
import { generateHash } from './price-calculator';
import { v4 as uuidv4 } from 'uuid';

export interface ImportStats {
  stores: { inserted: number; updated: number; skipped: number };
  products: { inserted: number; updated: number; skipped: number };
  storePrices: { inserted: number; updated: number; skipped: number };
  promotions: { inserted: number; updated: number; skipped: number };
  tagPrintRecords: { inserted: number; updated: number; skipped: number };
  tagScans: { inserted: number; updated: number; skipped: number };
}

function createStats(): ImportStats {
  return {
    stores: { inserted: 0, updated: 0, skipped: 0 },
    products: { inserted: 0, updated: 0, skipped: 0 },
    storePrices: { inserted: 0, updated: 0, skipped: 0 },
    promotions: { inserted: 0, updated: 0, skipped: 0 },
    tagPrintRecords: { inserted: 0, updated: 0, skipped: 0 },
    tagScans: { inserted: 0, updated: 0, skipped: 0 }
  };
}

export function importStores(stores: Store[]): { inserted: number; updated: number; skipped: number } {
  const db = getDb();
  let inserted = 0, updated = 0, skipped = 0;
  
  for (const store of stores) {
    const existing = db.prepare('SELECT id FROM stores WHERE id = ?').get(store.id);
    
    if (existing) {
      const current = db.prepare('SELECT name FROM stores WHERE id = ?').get(store.id) as Store;
      if (current.name !== store.name) {
        db.prepare(`
          UPDATE stores SET name = ?, updated_at = datetime('now') WHERE id = ?
        `).run(store.name, store.id);
        updated++;
      } else {
        skipped++;
      }
    } else {
      db.prepare(`
        INSERT INTO stores (id, name) VALUES (?, ?)
      `).run(store.id, store.name);
      inserted++;
    }
  }
  
  return { inserted, updated, skipped };
}

export function importProducts(products: Product[]): { inserted: number; updated: number; skipped: number } {
  const db = getDb();
  let inserted = 0, updated = 0, skipped = 0;
  
  for (const product of products) {
    const existing = db.prepare('SELECT sku FROM products WHERE sku = ?').get(product.sku);
    
    if (existing) {
      const current = db.prepare('SELECT * FROM products WHERE sku = ?').get(product.sku) as Product;
      const needsUpdate = 
        current.name !== product.name ||
        current.category !== product.category ||
        current.unit !== product.unit ||
        current.base_price !== product.base_price;
      
      if (needsUpdate) {
        db.prepare(`
          UPDATE products 
          SET name = ?, category = ?, unit = ?, base_price = ?, updated_at = datetime('now')
          WHERE sku = ?
        `).run(product.name, product.category, product.unit, product.base_price, product.sku);
        updated++;
      } else {
        skipped++;
      }
    } else {
      db.prepare(`
        INSERT INTO products (sku, name, category, unit, base_price)
        VALUES (?, ?, ?, ?, ?)
      `).run(product.sku, product.name, product.category, product.unit, product.base_price);
      inserted++;
    }
  }
  
  return { inserted, updated, skipped };
}

export function importStorePrices(prices: StorePrice[]): { inserted: number; updated: number; skipped: number } {
  const db = getDb();
  let inserted = 0, updated = 0, skipped = 0;
  
  for (const price of prices) {
    const existing = db.prepare(`
      SELECT id FROM store_prices 
      WHERE store_id = ? AND sku = ? AND (effective_from = ? OR (effective_from IS NULL AND ? IS NULL))
    `).get(price.store_id, price.sku, price.effective_from, price.effective_from);
    
    if (existing) {
      const current = db.prepare('SELECT * FROM store_prices WHERE id = ?').get((existing as any).id) as StorePrice;
      const needsUpdate = 
        current.price !== price.price ||
        current.effective_to !== price.effective_to;
      
      if (needsUpdate) {
        db.prepare(`
          UPDATE store_prices 
          SET price = ?, effective_to = ?
          WHERE id = ?
        `).run(price.price, price.effective_to, (existing as any).id);
        updated++;
      } else {
        skipped++;
      }
    } else {
      const id = price.id || uuidv4();
      db.prepare(`
        INSERT INTO store_prices (id, store_id, sku, price, effective_from, effective_to)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, price.store_id, price.sku, price.price, price.effective_from, price.effective_to);
      inserted++;
    }
  }
  
  return { inserted, updated, skipped };
}

export function importPromotions(promotions: Promotion[]): { inserted: number; updated: number; skipped: number } {
  const db = getDb();
  let inserted = 0, updated = 0, skipped = 0;
  
  for (const promo of promotions) {
    const existing = db.prepare('SELECT id FROM promotions WHERE id = ?').get(promo.id);
    
    if (existing) {
      const current = db.prepare('SELECT * FROM promotions WHERE id = ?').get(promo.id) as Promotion;
      const needsUpdate = 
        current.sku !== promo.sku ||
        current.promotion_name !== promo.promotion_name ||
        current.promotion_type !== promo.promotion_type ||
        current.discount_value !== promo.discount_value ||
        current.effective_from !== promo.effective_from ||
        current.effective_to !== promo.effective_to ||
        current.priority !== promo.priority;
      
      if (needsUpdate) {
        db.prepare(`
          UPDATE promotions 
          SET sku = ?, promotion_name = ?, promotion_type = ?, discount_value = ?,
              effective_from = ?, effective_to = ?, priority = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(
          promo.sku, promo.promotion_name, promo.promotion_type, promo.discount_value,
          promo.effective_from, promo.effective_to, promo.priority, promo.id
        );
        updated++;
      } else {
        skipped++;
      }
    } else {
      db.prepare(`
        INSERT INTO promotions (id, sku, promotion_name, promotion_type, discount_value, effective_from, effective_to, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        promo.id, promo.sku, promo.promotion_name, promo.promotion_type, 
        promo.discount_value, promo.effective_from, promo.effective_to, promo.priority
      );
      inserted++;
    }
  }
  
  return { inserted, updated, skipped };
}

export function importTagPrintRecords(records: TagPrintRecord[]): { inserted: number; updated: number; skipped: number } {
  const db = getDb();
  let inserted = 0, updated = 0, skipped = 0;
  
  for (const record of records) {
    const existing = db.prepare(`
      SELECT id FROM tag_print_records 
      WHERE store_id = ? AND sku = ? AND print_version = ?
    `).get(record.store_id, record.sku, record.print_version);
    
    if (existing) {
      skipped++;
    } else {
      db.prepare(`
        INSERT INTO tag_print_records (id, store_id, sku, print_version, printed_price, printed_at, printed_by, hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.id, record.store_id, record.sku, record.print_version,
        record.printed_price, record.printed_at, record.printed_by, record.hash
      );
      inserted++;
    }
  }
  
  return { inserted, updated, skipped };
}

export function importTagScans(scans: TagScan[]): { inserted: number; updated: number; skipped: number } {
  const db = getDb();
  let inserted = 0, updated = 0, skipped = 0;
  
  for (const scan of scans) {
    const existingById = db.prepare('SELECT id FROM tag_scans WHERE id = ?').get(scan.id);
    
    if (existingById) {
      skipped++;
      continue;
    }
    
    const existingByHash = db.prepare(`
      SELECT id FROM tag_scans 
      WHERE store_id = ? AND sku = ? AND hash = ?
    `).get(scan.store_id, scan.sku, scan.hash);
    
    if (existingByHash) {
      skipped++;
      continue;
    }
    
    db.prepare(`
      INSERT INTO tag_scans (id, store_id, sku, scan_version, scanned_price, scanned_at, scanned_by, tag_id, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      scan.id, scan.store_id, scan.sku, scan.scan_version,
      scan.scanned_price, scan.scanned_at, scan.scanned_by, scan.tag_id, scan.hash
    );
    inserted++;
  }
  
  return { inserted, updated, skipped };
}

export function importData(data: ImportData): ImportStats {
  const stats = createStats();
  
  if (data.stores && data.stores.length > 0) {
    const result = importStores(data.stores);
    stats.stores = result;
  }
  
  if (data.products && data.products.length > 0) {
    const result = importProducts(data.products);
    stats.products = result;
  }
  
  if (data.store_prices && data.store_prices.length > 0) {
    const result = importStorePrices(data.store_prices);
    stats.storePrices = result;
  }
  
  if (data.promotions && data.promotions.length > 0) {
    const result = importPromotions(data.promotions);
    stats.promotions = result;
  }
  
  if (data.tag_print_records && data.tag_print_records.length > 0) {
    const result = importTagPrintRecords(data.tag_print_records);
    stats.tagPrintRecords = result;
  }
  
  if (data.tag_scans && data.tag_scans.length > 0) {
    const result = importTagScans(data.tag_scans);
    stats.tagScans = result;
  }
  
  return stats;
}
