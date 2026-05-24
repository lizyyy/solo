"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPlatformFile = readPlatformFile;
const unitConverter_1 = require("../utils/unitConverter");
const fileReader_1 = require("./fileReader");
function readPlatformFile(filePath) {
    const content = (0, fileReader_1.readFile)(filePath);
    const data = (0, fileReader_1.parseJsonOrYaml)(content, filePath);
    const results = [];
    const source = 'platform';
    if (data.services && Array.isArray(data.services)) {
        for (const service of data.services) {
            let retention;
            if (service.log_retention_days !== undefined) {
                retention = (0, unitConverter_1.parseRetention)(service.log_retention_days);
            }
            else if (service.log_retention !== undefined) {
                retention = (0, unitConverter_1.parseRetention)(service.log_retention);
            }
            else {
                continue;
            }
            results.push({
                serviceName: service.name,
                retentionDays: retention.days,
                source,
                rawValue: retention.rawValue,
            });
        }
    }
    return results;
}
