"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
exports.initializeDatabase = initializeDatabase;
exports.closeDatabase = closeDatabase;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const Vulnerability_1 = require("./entities/Vulnerability");
const Batch_1 = require("./entities/Batch");
const StatusLog_1 = require("./entities/StatusLog");
const Assignment_1 = require("./entities/Assignment");
const UpgradeTask_1 = require("./entities/UpgradeTask");
const DelayRequest_1 = require("./entities/DelayRequest");
const RiskItem_1 = require("./entities/RiskItem");
const isTest = process.env.NODE_ENV === 'test';
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'sqlite',
    database: isTest ? ':memory:' : './vulnerability.db',
    synchronize: true,
    logging: false,
    entities: [
        Vulnerability_1.Vulnerability,
        Batch_1.Batch,
        StatusLog_1.StatusLog,
        Assignment_1.Assignment,
        UpgradeTask_1.UpgradeTask,
        DelayRequest_1.DelayRequest,
        RiskItem_1.RiskItem
    ],
    migrations: [],
    subscribers: []
});
async function initializeDatabase() {
    if (!exports.AppDataSource.isInitialized) {
        await exports.AppDataSource.initialize();
    }
    return exports.AppDataSource;
}
async function closeDatabase() {
    if (exports.AppDataSource.isInitialized) {
        await exports.AppDataSource.destroy();
    }
}
//# sourceMappingURL=database.js.map