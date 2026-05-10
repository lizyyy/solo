"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    dbPath: process.env.DB_PATH || './data/risk_control.db',
    coolDownPeriodHours: parseInt(process.env.COOL_DOWN_HOURS || '24', 10),
    maxTransfersPerHour: parseInt(process.env.MAX_TRANSFERS_PER_HOUR || '5', 10),
    maxTransfersPerDay: parseInt(process.env.MAX_TRANSFERS_PER_DAY || '20', 10),
    serverPort: parseInt(process.env.PORT || '3000', 10),
};
//# sourceMappingURL=config.js.map