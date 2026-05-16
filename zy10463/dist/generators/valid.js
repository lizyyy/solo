"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidGenerator = void 0;
const base_1 = require("./base");
class ValidGenerator extends base_1.BaseGenerator {
    generate(index) {
        this.random = this.createSeededRandom(this.seed + index);
        const data = this.generateValid();
        return {
            data,
            reason: `正常样本 #${index + 1} - 通过Schema验证`
        };
    }
    createSeededRandom(seed) {
        let s = seed;
        return function () {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
    }
}
exports.ValidGenerator = ValidGenerator;
//# sourceMappingURL=valid.js.map