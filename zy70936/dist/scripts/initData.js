"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const database_1 = require("../database");
const importService = __importStar(require("../services/importService"));
(0, database_1.initDatabase)();
const dataDir = path.join(process.cwd(), 'data');
async function initAll() {
    console.log('开始初始化数据...\n');
    const customerResult = await importService.importCustomersFromJson(path.join(dataDir, 'customers.json'), 'system');
    console.log('顾客档案导入:', customerResult);
    const medicineResult = await importService.importMedicinesFromJson(path.join(dataDir, 'medicines.json'), 'system');
    console.log('药品数据导入:', medicineResult);
    const ruleResult = await importService.importFollowUpRulesFromJson(path.join(dataDir, 'followUpRules.json'), 'system');
    console.log('随访规则导入:', ruleResult);
    const purchaseResult = await importService.importPurchaseRecordsFromCsv(path.join(dataDir, 'purchases.csv'), 'system');
    console.log('购药记录导入:', purchaseResult);
    console.log('\n数据初始化完成！');
}
initAll().catch(console.error);
