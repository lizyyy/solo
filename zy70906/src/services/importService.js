const fs = require('fs');
const csv = require('csv-parser');
const store = require('../store');
const Receipt = require('../models/Receipt');
const Member = require('../models/Member');

class ImportService {
  async importReceiptsCSV(filePath) {
    return new Promise((resolve, reject) => {
      const receipts = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          const receipt = new Receipt({
            receiptNo: row.receiptNo || row.receipt_no || row.id,
            storeId: row.storeId || row.store_id,
            storeName: row.storeName || row.store_name,
            memberNo: row.memberNo || row.member_no,
            type: row.type || 'purchase',
            amount: parseFloat(row.amount),
            points: parseInt(row.points) || 0,
            transactionDate: row.transactionDate || row.transaction_date,
            cashier: row.cashier,
            remark: row.remark,
            parentReceiptNo: row.parentReceiptNo || row.parent_receipt_no || null
          });
          receipts.push(receipt);
          store.addReceipt(receipt);
        })
        .on('end', () => {
          resolve({ count: receipts.length, receipts });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  async importMembersJSON(filePath) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const members = [];
    for (const memberData of data) {
      const member = new Member(memberData);
      members.push(member);
      store.addMember(member);
    }
    return { count: members.length, members };
  }
}

module.exports = new ImportService();
