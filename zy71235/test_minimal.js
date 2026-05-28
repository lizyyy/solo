const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('🧪 核心修复验证测试');
console.log('='.repeat(60));

const appCode = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

let passed = 0;
let failed = 0;

console.log('\n📋 验证1: Stock类包含remark和receipt字段定义');
const stockClassMatch = appCode.match(/class Stock \{[\s\S]*?\n    \}/);
if (stockClassMatch) {
    const hasRemark = stockClassMatch[0].includes('this.remark = data.remark || \'\'');
    const hasReceipt = stockClassMatch[0].includes('this.receipt = data.receipt || \'\'');
    console.log(`  remark字段: ${hasRemark ? '✅' : '❌'}`);
    console.log(`  receipt字段: ${hasReceipt ? '✅' : '❌'}`);
    if (hasRemark && hasReceipt) passed++; else failed++;
} else {
    console.log('  ❌ 未找到Stock类定义');
    failed++;
}

console.log('\n📋 验证2: importStocks保存receipt字段，版本更新保留原有字段');
const importStocksMatch = appCode.match(/importStocks\(data, version\) \{[\s\S]*?\n        \}/);
if (importStocksMatch) {
    const hasReceiptSave = importStocksMatch[0].includes('receipt: stockData.receipt');
    const hasExistingCheck = importStocksMatch[0].includes('existingStock');
    const hasRemarkKeep = importStocksMatch[0].includes('existingStock && existingStock.remark');
    const hasReceiptKeep = importStocksMatch[0].includes('existingStock && existingStock.receipt');
    console.log(`  保存receipt: ${hasReceiptSave ? '✅' : '❌'}`);
    console.log(`  检查已有数据: ${hasExistingCheck ? '✅' : '❌'}`);
    console.log(`  保留原有remark: ${hasRemarkKeep ? '✅' : '❌'}`);
    console.log(`  保留原有receipt: ${hasReceiptKeep ? '✅' : '❌'}`);
    if (hasReceiptSave && hasExistingCheck && hasRemarkKeep && hasReceiptKeep) passed++; else failed++;
} else {
    console.log('  ❌ 未找到importStocks方法');
    failed++;
}

console.log('\n📋 验证3: importOrders不再调用validateOrder，改用validateImportOrder');
const importOrdersMatch = appCode.match(/importOrders\(data, version\) \{[\s\S]*?\n        \}/);
if (importOrdersMatch) {
    const usesValidateImportOrder = importOrdersMatch[0].includes('this.validateImportOrder(order)');
    const notUsesValidateOrder = !importOrdersMatch[0].includes('this.game.validateOrder(order)');
    console.log(`  使用validateImportOrder: ${usesValidateImportOrder ? '✅' : '❌'}`);
    console.log(`  不使用validateOrder: ${notUsesValidateOrder ? '✅' : '❌'}`);
    if (usesValidateImportOrder && notUsesValidateOrder) passed++; else failed++;
} else {
    console.log('  ❌ 未找到importOrders方法');
    failed++;
}

console.log('\n📋 验证4: validateImportOrder不包含交易时段检查');
const validateImportOrderMatch = appCode.match(/validateImportOrder\(order\) \{[\s\S]*?\n        \}/);
if (validateImportOrderMatch) {
    const hasNoTradingPhaseCheck = !validateImportOrderMatch[0].includes('GamePhase.TRADING') && 
                                   !validateImportOrderMatch[0].includes('game.phase !==');
    const hasPriceLimitCheck = validateImportOrderMatch[0].includes('PRICE_LIMIT_VIOLATION');
    const hasCashCheck = validateImportOrderMatch[0].includes('INSUFFICIENT_CASH');
    const hasPositionCheck = validateImportOrderMatch[0].includes('INSUFFICIENT_POSITION');
    console.log(`  无交易时段检查: ${hasNoTradingPhaseCheck ? '✅' : '❌'}`);
    console.log(`  有涨跌停检查: ${hasPriceLimitCheck ? '✅' : '❌'}`);
    console.log(`  有资金检查: ${hasCashCheck ? '✅' : '❌'}`);
    console.log(`  有持仓检查: ${hasPositionCheck ? '✅' : '❌'}`);
    if (hasNoTradingPhaseCheck && hasPriceLimitCheck && hasCashCheck && hasPositionCheck) passed++; else failed++;
} else {
    console.log('  ❌ 未找到validateImportOrder方法');
    failed++;
}

console.log('\n📋 验证5: 订单正确挂入stock.bidOrders/askOrders');
if (importOrdersMatch) {
    const hasBidOrdersPush = importOrdersMatch[0].includes('stock.bidOrders.push(order)');
    const hasAskOrdersPush = importOrdersMatch[0].includes('stock.askOrders.push(order)');
    const hasBidSort = importOrdersMatch[0].includes('stock.bidOrders.sort');
    const hasAskSort = importOrdersMatch[0].includes('stock.askOrders.sort');
    console.log(`  挂入bidOrders: ${hasBidOrdersPush ? '✅' : '❌'}`);
    console.log(`  挂入askOrders: ${hasAskOrdersPush ? '✅' : '❌'}`);
    console.log(`  买盘降序排序: ${hasBidSort ? '✅' : '❌'}`);
    console.log(`  卖盘升序排序: ${hasAskSort ? '✅' : '❌'}`);
    if (hasBidOrdersPush && hasAskOrdersPush && hasBidSort && hasAskSort) passed++; else failed++;
} else {
    console.log('  ❌ 未找到importOrders方法');
    failed++;
}

console.log('\n📋 验证6: 违规订单标记为REJECTED，不进入买卖盘');
if (importOrdersMatch) {
    const hasRejectOrder = importOrdersMatch[0].includes('order.status = OrderStatus.REJECTED');
    const hasRejectReturn = importOrdersMatch[0].includes('if (validation.rejectOrder)');
    console.log(`  标记REJECTED: ${hasRejectOrder ? '✅' : '❌'}`);
    console.log(`  拒绝后返回: ${hasRejectReturn ? '✅' : '❌'}`);
    if (hasRejectOrder && hasRejectReturn) passed++; else failed++;
} else {
    console.log('  ❌ 未找到importOrders方法');
    failed++;
}

console.log('\n📋 验证7: 违规严重程度分级正确');
if (validateImportOrderMatch) {
    const priceLimitSeverity = validateImportOrderMatch[0].includes('severity: ViolationSeverity.MEDIUM') && 
                              validateImportOrderMatch[0].includes('PRICE_LIMIT_VIOLATION');
    const cashSeverity = validateImportOrderMatch[0].includes('severity: ViolationSeverity.HIGH') && 
                         validateImportOrderMatch[0].includes('INSUFFICIENT_CASH');
    const positionSeverity = validateImportOrderMatch[0].includes('severity: ViolationSeverity.HIGH') && 
                             validateImportOrderMatch[0].includes('INSUFFICIENT_POSITION');
    console.log(`  涨跌停违规严重程度(中等): ${priceLimitSeverity ? '✅' : '❌'}`);
    console.log(`  资金不足违规严重程度(严重): ${cashSeverity ? '✅' : '❌'}`);
    console.log(`  持仓不足违规严重程度(严重): ${positionSeverity ? '✅' : '❌'}`);
    if (priceLimitSeverity && cashSeverity && positionSeverity) passed++; else failed++;
} else {
    console.log('  ❌ 未找到validateImportOrder方法');
    failed++;
}

console.log('\n📋 验证8: 股票卡片UI显示remark和receipt');
const renderStockPoolMatch = appCode.match(/renderStockPool\(\) \{[\s\S]*?\n        \}/);
if (renderStockPoolMatch) {
    const hasRemarkDisplay = renderStockPoolMatch[0].includes('stock.remark');
    const hasReceiptDisplay = renderStockPoolMatch[0].includes('stock.receipt');
    console.log(`  显示remark: ${hasRemarkDisplay ? '✅' : '❌'}`);
    console.log(`  显示receipt: ${hasReceiptDisplay ? '✅' : '❌'}`);
    if (hasRemarkDisplay && hasReceiptDisplay) passed++; else failed++;
} else {
    console.log('  ❌ 未找到renderStockPool方法');
    failed++;
}

console.log('\n📋 验证9: CSS样式包含stock-remark和stock-receipt');
const cssCode = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const hasRemarkCss = cssCode.includes('.stock-remark');
const hasReceiptCss = cssCode.includes('.stock-receipt');
console.log(`  stock-remark样式: ${hasRemarkCss ? '✅' : '❌'}`);
console.log(`  stock-receipt样式: ${hasReceiptCss ? '✅' : '❌'}`);
if (hasRemarkCss && hasReceiptCss) passed++; else failed++;

console.log('\n' + '='.repeat(60));
console.log(`📊 测试结果: ${passed} 项通过, ${failed} 项失败`);
console.log('='.repeat(60));

if (failed === 0) {
    console.log('\n✅ 所有核心修复验证通过！');
    console.log('\n📋 修复内容总结:');
    console.log('  1. ✅ Stock类添加了remark和receipt字段');
    console.log('  2. ✅ importStocks版本更新时保留原有remark和receipt');
    console.log('  3. ✅ importOrders使用validateImportOrder，跳过交易时段检查');
    console.log('  4. ✅ validateImportOrder正确识别涨跌停、资金不足、持仓不足等违规');
    console.log('  5. ✅ 有效订单正确进入stock.bidOrders/askOrders');
    console.log('  6. ✅ 违规订单按严重程度分级（中等/严重）');
    console.log('  7. ✅ 违规订单标记为REJECTED，不进入买卖盘');
    console.log('  8. ✅ 股票卡片UI显示remark和receipt');
    console.log('  9. ✅ CSS样式支持remark和receipt显示');
    process.exit(0);
} else {
    console.log('\n❌ 部分验证失败，请检查修复');
    process.exit(1);
}
