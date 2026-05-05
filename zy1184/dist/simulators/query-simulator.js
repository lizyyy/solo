"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuerySimulator = void 0;
exports.simulateQuery = simulateQuery;
exports.simulateQueriesBatch = simulateQueriesBatch;
const models_1 = require("../models");
const preload_simulator_1 = require("./preload-simulator");
const batch_query_simulator_1 = require("./batch-query-simulator");
const field_trimming_simulator_1 = require("./field-trimming-simulator");
const cursor_pagination_simulator_1 = require("./cursor-pagination-simulator");
class QuerySimulator {
    constructor(options = {}, tableStructures, repositoryMethods) {
        this.options = { ...models_1.DEFAULT_SIMULATION_OPTIONS, ...options };
        this.tableStructures = tableStructures;
        this.repositoryMethods = repositoryMethods;
    }
    simulate(requestGroup, issues) {
        const optimizations = [];
        const preloadOpt = (0, preload_simulator_1.simulatePreload)(requestGroup, issues, this.options, this.tableStructures, this.repositoryMethods);
        if (preloadOpt)
            optimizations.push(preloadOpt);
        const batchOpt = (0, batch_query_simulator_1.simulateBatchQuery)(requestGroup, issues, this.options, this.tableStructures, this.repositoryMethods);
        if (batchOpt)
            optimizations.push(batchOpt);
        const fieldOpt = (0, field_trimming_simulator_1.simulateFieldTrimming)(requestGroup, issues, this.options, this.tableStructures, this.repositoryMethods);
        if (fieldOpt)
            optimizations.push(fieldOpt);
        const cursorOpt = (0, cursor_pagination_simulator_1.simulateCursorPagination)(requestGroup, issues, this.options, this.tableStructures, this.repositoryMethods);
        if (cursorOpt)
            optimizations.push(cursorOpt);
        const comparison = this.createComparison(requestGroup, optimizations);
        return {
            requestId: requestGroup.requestId,
            originalRequestGroup: requestGroup,
            optimizations,
            comparison,
            simulationTime: new Date(),
        };
    }
    simulateBatch(requestGroups, issuesMap) {
        const results = [];
        for (const group of requestGroups) {
            const issues = issuesMap.get(group.requestId) || [];
            results.push(this.simulate(group, issues));
        }
        return results;
    }
    createComparison(requestGroup, optimizations) {
        const originalQueryCount = requestGroup.totalQueryCount;
        const originalDuration = requestGroup.totalQueryDuration;
        const originalDataTransfer = originalQueryCount * 150;
        let optimizedQueryCount = originalQueryCount;
        let optimizedDuration = originalDuration;
        let optimizedDataTransfer = originalDataTransfer;
        for (const opt of optimizations) {
            optimizedQueryCount += opt.impact.queryCountChange;
            optimizedDuration += opt.impact.durationChangeMs;
            optimizedDataTransfer += opt.impact.dataTransferChangeBytes;
        }
        optimizedQueryCount = Math.max(1, optimizedQueryCount);
        optimizedDuration = Math.max(0, optimizedDuration);
        optimizedDataTransfer = Math.max(0, optimizedDataTransfer);
        const queryCountReduction = originalQueryCount - optimizedQueryCount;
        const durationReductionMs = originalDuration - optimizedDuration;
        const dataTransferReductionBytes = originalDataTransfer - optimizedDataTransfer;
        return {
            original: {
                totalRequests: 1,
                totalQueries: originalQueryCount,
                totalDurationMs: originalDuration,
                totalDataTransferBytes: originalDataTransfer,
                avgQueriesPerRequest: originalQueryCount,
                avgDurationPerRequest: originalDuration,
            },
            optimized: {
                totalRequests: 1,
                totalQueries: optimizedQueryCount,
                totalDurationMs: optimizedDuration,
                totalDataTransferBytes: optimizedDataTransfer,
                avgQueriesPerRequest: optimizedQueryCount,
                avgDurationPerRequest: optimizedDuration,
            },
            improvement: {
                queryCountReduction,
                queryCountReductionPercent: originalQueryCount > 0
                    ? Math.round((queryCountReduction / originalQueryCount) * 100)
                    : 0,
                durationReductionMs,
                durationReductionPercent: originalDuration > 0
                    ? Math.round((durationReductionMs / originalDuration) * 100)
                    : 0,
                dataTransferReductionBytes,
                dataTransferReductionPercent: originalDataTransfer > 0
                    ? Math.round((dataTransferReductionBytes / originalDataTransfer) * 100)
                    : 0,
            },
        };
    }
    static simulate(requestGroup, issues, options, tableStructures, repositoryMethods) {
        const simulator = new QuerySimulator(options, tableStructures, repositoryMethods);
        return simulator.simulate(requestGroup, issues);
    }
    static simulateBatch(requestGroups, issuesMap, options, tableStructures, repositoryMethods) {
        const simulator = new QuerySimulator(options, tableStructures, repositoryMethods);
        return simulator.simulateBatch(requestGroups, issuesMap);
    }
}
exports.QuerySimulator = QuerySimulator;
function simulateQuery(requestGroup, issues, options, tableStructures, repositoryMethods) {
    return QuerySimulator.simulate(requestGroup, issues, options, tableStructures, repositoryMethods);
}
function simulateQueriesBatch(requestGroups, issuesMap, options, tableStructures, repositoryMethods) {
    return QuerySimulator.simulateBatch(requestGroups, issuesMap, options, tableStructures, repositoryMethods);
}
//# sourceMappingURL=query-simulator.js.map