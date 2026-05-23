const { get } = require('../db');

async function validateCustomerExists(customerId) {
  const customer = await get('SELECT id FROM customers WHERE id = ?', [customerId]);
  if (!customer) throw new Error(`顾客不存在: ${customerId}`);
  return customer;
}

async function validateStoreExists(storeId) {
  const store = await get('SELECT id, status FROM stores WHERE id = ?', [storeId]);
  if (!store) throw new Error(`门店不存在: ${storeId}`);
  if (store.status !== 'active') throw new Error(`门店已停用: ${storeId}`);
  return store;
}

async function validatePackageExists(packageId) {
  const pkg = await get('SELECT id, status, customer_id, current_store_id FROM treatment_packages WHERE id = ?', [packageId]);
  if (!pkg) throw new Error(`套餐不存在: ${packageId}`);
  if (pkg.status !== 'active') throw new Error(`套餐状态异常: ${pkg.status}`);
  return pkg;
}

async function validateStoreActive(storeId) {
  const store = await get('SELECT id, status FROM stores WHERE id = ?', [storeId]);
  if (!store) throw new Error(`门店不存在: ${storeId}`);
  if (store.status !== 'active') throw new Error(`门店已停用: ${storeId}`);
  return store;
}

async function validatePackageStoreMatch(packageId, storeId) {
  const pkg = await get('SELECT current_store_id FROM treatment_packages WHERE id = ?', [packageId]);
  if (!pkg) throw new Error(`套餐不存在: ${packageId}`);
  if (pkg.current_store_id !== storeId) {
    throw new Error(`核销门店与套餐当前门店不符，需先转店`);
  }
  return true;
}

module.exports = {
  validateCustomerExists,
  validateStoreExists,
  validatePackageExists,
  validateStoreActive,
  validatePackageStoreMatch
};
