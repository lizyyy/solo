"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
exports.mergeConfig = mergeConfig;
exports.DEFAULT_CONFIG = {
    samplingDelayThresholdMs: 5000,
    allowDeprecatedEvents: false,
    allowOptionalParameters: true,
    strictTypeChecking: true,
    pagePathMatching: 'prefix'
};
function mergeConfig(partial) {
    return {
        ...exports.DEFAULT_CONFIG,
        ...partial
    };
}
//# sourceMappingURL=config.js.map