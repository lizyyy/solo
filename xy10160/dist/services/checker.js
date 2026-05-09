"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareAllProducts = exports.compareProducts = void 0;
const lodash_1 = __importDefault(require("lodash"));
const MANDATORY_FIELDS = ['id', 'name', 'price', 'category'];
const compareProducts = (indexProduct, sourceProduct) => {
    const missingFields = [];
    const mismatchedFields = [];
    const extraFields = [];
    const allIndexKeys = Object.keys(indexProduct);
    const allSourceKeys = Object.keys(sourceProduct);
    const allKeys = lodash_1.default.union(allIndexKeys, allSourceKeys);
    for (const key of allKeys) {
        const inIndex = allIndexKeys.includes(key);
        const inSource = allSourceKeys.includes(key);
        if (inSource && !inIndex) {
            if (MANDATORY_FIELDS.includes(key)) {
                missingFields.push(key);
            }
            else {
                missingFields.push(key);
            }
        }
        else if (inIndex && !inSource) {
            extraFields.push(key);
        }
        else if (inIndex && inSource) {
            const indexVal = indexProduct[key];
            const sourceVal = sourceProduct[key];
            if (!lodash_1.default.isEqual(indexVal, sourceVal)) {
                mismatchedFields.push({
                    productId: sourceProduct.id,
                    fieldName: key,
                    indexValue: indexVal,
                    sourceValue: sourceVal,
                    diffType: 'mismatch',
                });
            }
        }
    }
    const hasIssue = missingFields.length > 0 || mismatchedFields.length > 0;
    return {
        productId: sourceProduct.id,
        productName: sourceProduct.name || indexProduct.name || 'Unknown',
        missingFields,
        mismatchedFields,
        extraFields,
        hasIssue,
    };
};
exports.compareProducts = compareProducts;
const compareAllProducts = (indexProducts, sourceProducts) => {
    const indexMap = new Map();
    const sourceMap = new Map();
    indexProducts.forEach((p) => indexMap.set(p.id, p));
    sourceProducts.forEach((p) => sourceMap.set(p.id, p));
    const productDiffs = [];
    const fieldMissingCounts = {};
    let missingFieldsTotal = 0;
    let mismatchedFieldsTotal = 0;
    let withIssues = 0;
    for (const sourceProduct of sourceProducts) {
        const indexProduct = indexMap.get(sourceProduct.id);
        if (!indexProduct) {
            productDiffs.push({
                productId: sourceProduct.id,
                productName: sourceProduct.name || 'Unknown',
                missingFields: ['ENTIRE_PRODUCT'],
                mismatchedFields: [],
                extraFields: [],
                hasIssue: true,
            });
            withIssues++;
            missingFieldsTotal += MANDATORY_FIELDS.length;
            continue;
        }
        const diff = (0, exports.compareProducts)(indexProduct, sourceProduct);
        productDiffs.push(diff);
        if (diff.hasIssue) {
            withIssues++;
        }
        diff.missingFields.forEach((field) => {
            fieldMissingCounts[field] = (fieldMissingCounts[field] || 0) + 1;
            missingFieldsTotal++;
        });
        mismatchedFieldsTotal += diff.mismatchedFields.length;
    }
    for (const [id, indexProduct] of indexMap) {
        if (!sourceMap.has(id)) {
            productDiffs.push({
                productId: id,
                productName: indexProduct.name || 'Unknown',
                missingFields: [],
                mismatchedFields: [],
                extraFields: ['ENTIRE_PRODUCT_IN_INDEX'],
                hasIssue: false,
            });
        }
    }
    const mostCommonMissingFields = Object.entries(fieldMissingCounts)
        .map(([field, count]) => ({ field, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    const summary = {
        totalChecked: sourceProducts.length,
        withIssues,
        withoutIssues: productDiffs.length - withIssues,
        missingFieldsTotal,
        mismatchedFieldsTotal,
        mostCommonMissingFields,
    };
    return {
        productDiffs,
        summary,
        missingFieldsCount: missingFieldsTotal,
        mismatchedFieldsCount: mismatchedFieldsTotal,
    };
};
exports.compareAllProducts = compareAllProducts;
//# sourceMappingURL=checker.js.map