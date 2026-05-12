"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCheckRules = runCheckRules;
const price_calculator_1 = require("./price-calculator");
const database_1 = require("./database");
function getLatestPrintRecord(storeId, sku) {
    const db = (0, database_1.getDb)();
    const result = db.prepare(`
    SELECT * FROM tag_print_records 
    WHERE store_id = ? AND sku = ?
    ORDER BY printed_at DESC
    LIMIT 1
  `).get(storeId, sku);
    return result;
}
function isDuplicateScan(scan, storeId, sku) {
    const db = (0, database_1.getDb)();
    const existing = db.prepare(`
    SELECT id FROM tag_scans 
    WHERE store_id = ? AND sku = ? AND hash = ?
  `).get(storeId, sku, scan.hash);
    return !!existing;
}
function getExistingCheckResult(scanId) {
    const db = (0, database_1.getDb)();
    return db.prepare(`
    SELECT id, status FROM check_results WHERE scan_id = ?
  `).get(scanId);
}
function runCheckRules(input) {
    const { scan, storeId, sku, checkTime, allPrintRecords } = input;
    const existingResult = getExistingCheckResult(scan.id);
    if (existingResult) {
        const db = (0, database_1.getDb)();
        const issues = db.prepare(`
      SELECT * FROM check_issues WHERE check_result_id = ?
    `).all(existingResult.id);
        const fullResult = db.prepare(`
      SELECT * FROM check_results WHERE id = ?
    `).get(existingResult.id);
        return {
            status: existingResult.status,
            issues,
            systemPrice: fullResult.system_price,
            basePrice: fullResult.system_price,
            storePrice: fullResult.store_price,
            effectivePromotionId: fullResult.effective_promotion_id
        };
    }
    const issues = [];
    let status = 'PASS';
    const priceInfo = (0, price_calculator_1.calculateSystemPrice)(sku, storeId, checkTime);
    const latestPrint = getLatestPrintRecord(storeId, sku);
    const activePromotions = (0, price_calculator_1.getEffectivePromotions)(sku, checkTime);
    if (latestPrint) {
        if (scan.scan_version !== latestPrint.print_version) {
            issues.push({
                check_result_id: '',
                issue_type: 'VERSION',
                issue_code: 'OLD_TAG_VERSION',
                issue_message: `扫描版本 ${scan.scan_version} 与最新打印版本 ${latestPrint.print_version} 不一致`,
                severity: 'CRITICAL'
            });
            status = 'MUST_REPRINT';
        }
    }
    const printedPrice = latestPrint ? latestPrint.printed_price : scan.scanned_price;
    if (Math.abs(scan.scanned_price - priceInfo.price) > 0.001) {
        issues.push({
            check_result_id: '',
            issue_type: 'PRICE',
            issue_code: 'PRICE_MISMATCH',
            issue_message: `扫描价格 ¥${scan.scanned_price.toFixed(2)} 与系统价 ¥${priceInfo.price.toFixed(2)} 不一致`,
            severity: 'CRITICAL'
        });
        status = 'MUST_REPRINT';
    }
    if (latestPrint && Math.abs(latestPrint.printed_price - priceInfo.price) > 0.001) {
        issues.push({
            check_result_id: '',
            issue_type: 'PRICE',
            issue_code: 'PRINTED_PRICE_OUTDATED',
            issue_message: `打印价格 ¥${latestPrint.printed_price.toFixed(2)} 与当前系统价 ¥${priceInfo.price.toFixed(2)} 不一致，可能已过期`,
            severity: 'WARNING'
        });
        if (status !== 'MUST_REPRINT') {
            status = 'CAN_CONTINUE';
        }
    }
    const db = (0, database_1.getDb)();
    const allPromotions = db.prepare(`
    SELECT * FROM promotions WHERE sku = ?
  `).all(sku);
    const printedAt = latestPrint ? latestPrint.printed_at : scan.scanned_at;
    const promoActiveAtPrint = allPromotions.filter(p => {
        return (0, price_calculator_1.isPromotionActive)(p, printedAt);
    });
    const promoActiveNow = activePromotions;
    if (promoActiveNow.length === 0 && promoActiveAtPrint.length > 0) {
        issues.push({
            check_result_id: '',
            issue_type: 'PROMOTION',
            issue_code: 'PROMOTION_ENDED',
            issue_message: `打印时有活动，但当前活动已结束。活动数: 打印时 ${promoActiveAtPrint.length} 个, 当前 0 个`,
            severity: 'CRITICAL'
        });
        status = 'MUST_REPRINT';
    }
    if (promoActiveNow.length > promoActiveAtPrint.length) {
        issues.push({
            check_result_id: '',
            issue_type: 'PROMOTION',
            issue_code: 'NEW_PROMOTION_STARTED',
            issue_message: `有新活动开始。活动数: 打印时 ${promoActiveAtPrint.length} 个, 当前 ${promoActiveNow.length} 个`,
            severity: 'WARNING'
        });
        if (status !== 'MUST_REPRINT') {
            status = 'NEEDS_MANUAL_CHECK';
        }
    }
    if (promoActiveNow.length > 1) {
        issues.push({
            check_result_id: '',
            issue_type: 'PROMOTION',
            issue_code: 'MULTIPLE_PROMOTIONS',
            issue_message: `同一商品有 ${promoActiveNow.length} 个同时进行的活动，最高优先级: ${promoActiveNow[0].promotion_name}`,
            severity: 'INFO'
        });
        if (status === 'PASS') {
            status = 'CAN_CONTINUE';
        }
    }
    if (priceInfo.storePrice !== undefined &&
        Math.abs(priceInfo.storePrice - priceInfo.basePrice) > 0.001) {
        issues.push({
            check_result_id: '',
            issue_type: 'PRICE',
            issue_code: 'STORE_PRICE_OVERRIDE',
            issue_message: `门店特价覆盖总部价: 总部 ¥${priceInfo.basePrice.toFixed(2)} → 门店 ¥${priceInfo.storePrice.toFixed(2)}`,
            severity: 'INFO'
        });
    }
    const scanHistory = db.prepare(`
    SELECT * FROM tag_scans 
    WHERE store_id = ? AND sku = ? AND hash = ?
    ORDER BY scanned_at DESC
  `).all(storeId, sku, scan.hash);
    if (scanHistory.length > 1) {
        issues.push({
            check_result_id: '',
            issue_type: 'DUPLICATE',
            issue_code: 'DUPLICATE_SCAN',
            issue_message: `检测到重复扫描，已扫描 ${scanHistory.length} 次，首次: ${scanHistory[scanHistory.length - 1].scanned_at}`,
            severity: 'WARNING'
        });
    }
    if (status === 'PASS' && issues.length > 0) {
        const hasWarning = issues.some(i => i.severity === 'WARNING');
        if (hasWarning) {
            status = 'CAN_CONTINUE';
        }
    }
    return {
        status,
        issues,
        systemPrice: priceInfo.price,
        basePrice: priceInfo.basePrice,
        storePrice: priceInfo.storePrice,
        effectivePromotionId: priceInfo.effectivePromotion?.id
    };
}
