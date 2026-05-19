const Medicine = require('../models/Medicine');

async function test() {
  try {
    const medicine = await Medicine.findById(1);
    console.log('获取药品1:', medicine.name);
    console.log('contraindications:', medicine.contraindications);
    console.log('类型:', typeof medicine.contraindications);
  } catch (e) {
    console.error('错误:', e.message);
  }
  process.exit(0);
}

test();
