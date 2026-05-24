"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTerraformFile = readTerraformFile;
const unitConverter_1 = require("../utils/unitConverter");
const fileReader_1 = require("./fileReader");
function readTerraformFile(filePath) {
    const content = (0, fileReader_1.readFile)(filePath);
    const data = (0, fileReader_1.parseJsonOrYaml)(content, filePath);
    const results = [];
    const source = 'terraform';
    if (data.log_retention && typeof data.log_retention === 'object') {
        for (const [serviceName, rawRetention] of Object.entries(data.log_retention)) {
            const retention = (0, unitConverter_1.parseRetention)(rawRetention);
            results.push({
                serviceName,
                retentionDays: retention.days,
                source,
                rawValue: retention.rawValue,
            });
        }
    }
    return results;
}
