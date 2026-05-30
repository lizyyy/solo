import { getDb, initDb } from './index.js';
import {
  MOCK_AUTHORS,
  MOCK_BOOKS,
  MOCK_CONTRACTS,
  MOCK_ROYALTY_LADDERS,
  MOCK_SALES_RECORDS,
  MOCK_RETURN_RECORDS,
  MOCK_DISCOUNT_ACTIVITIES,
} from '../mock/data.js';

export function seedDatabase(): void {
  const db = getDb();

  const tx = db.transaction(() => {
    const insertAuthor = db.prepare(`
      INSERT OR REPLACE INTO author (id, name, tax_id, bank_account, email, tax_rate, created_at, updated_at)
      VALUES (@id, @name, @taxId, @bankAccount, @email, @taxRate, @createdAt, @updatedAt)
    `);

    for (const author of MOCK_AUTHORS) {
      insertAuthor.run(author);
    }

    const insertBook = db.prepare(`
      INSERT OR REPLACE INTO book (id, isbn, title, author_id, product_type, list_price, publish_date, created_at)
      VALUES (@id, @isbn, @title, @authorId, @productType, @listPrice, @publishDate, @createdAt)
    `);

    for (const book of MOCK_BOOKS) {
      insertBook.run(book);
    }

    const insertContract = db.prepare(`
      INSERT OR REPLACE INTO contract (id, author_id, book_id, effective_date, expiry_date, status, special_terms, created_at)
      VALUES (@id, @authorId, @bookId, @effectiveDate, @expiryDate, @status, @specialTerms, @createdAt)
    `);

    for (const contract of MOCK_CONTRACTS) {
      insertContract.run(contract);
    }

    const insertLadder = db.prepare(`
      INSERT OR REPLACE INTO royalty_ladder (id, contract_id, product_type, min_volume, max_volume, rate, ladder_type, created_at)
      VALUES (@id, @contractId, @productType, @minVolume, @maxVolume, @rate, @ladderType, @createdAt)
    `);

    for (const ladder of MOCK_ROYALTY_LADDERS) {
      insertLadder.run(ladder);
    }

    const insertDiscount = db.prepare(`
      INSERT OR REPLACE INTO discount_activity (id, name, start_date, end_date, product_type, adjusted_rate, ladder_override, created_at)
      VALUES (@id, @name, @startDate, @endDate, @productType, @adjustedRate, @ladderOverride, @createdAt)
    `);

    for (const discount of MOCK_DISCOUNT_ACTIVITIES) {
      insertDiscount.run(discount);
    }

    const insertSale = db.prepare(`
      INSERT OR REPLACE INTO sales_record (id, book_id, channel, sale_date, quantity, unit_price, total_amount, discount_activity_id, is_dirty, raw_data, created_at)
      VALUES (@id, @bookId, @channel, @saleDate, @quantity, @unitPrice, @totalAmount, @discountActivityId, @isDirty, @rawData, @createdAt)
    `);

    for (const sale of MOCK_SALES_RECORDS) {
      insertSale.run({
        ...sale,
        isDirty: sale.isDirty ? 1 : 0,
      });
    }

    const insertReturn = db.prepare(`
      INSERT OR REPLACE INTO return_record (id, book_id, original_sale_id, return_date, settlement_period, quantity, amount, reason, is_late, created_at)
      VALUES (@id, @bookId, @originalSaleId, @returnDate, @settlementPeriod, @quantity, @amount, @reason, @isLate, @createdAt)
    `);

    for (const ret of MOCK_RETURN_RECORDS) {
      insertReturn.run({
        ...ret,
        isLate: ret.isLate ? 1 : 0,
      });
    }
  });

  tx();

  console.log('Database seeded successfully!');
  console.log(`  Authors: ${MOCK_AUTHORS.length}`);
  console.log(`  Books: ${MOCK_BOOKS.length}`);
  console.log(`  Contracts: ${MOCK_CONTRACTS.length}`);
  console.log(`  Royalty Ladders: ${MOCK_ROYALTY_LADDERS.length}`);
  console.log(`  Discount Activities: ${MOCK_DISCOUNT_ACTIVITIES.length}`);
  console.log(`  Sales Records: ${MOCK_SALES_RECORDS.length}`);
  console.log(`  Return Records: ${MOCK_RETURN_RECORDS.length}`);
}

export function initAndSeed(): void {
  initDb();
  seedDatabase();
}

if (process.argv[1] && process.argv[1].includes('seed')) {
  initAndSeed();
}
