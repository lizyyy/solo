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
exports.SampleGenerator = void 0;
const path = __importStar(require("path"));
const helpers_1 = require("../utils/helpers");
const validator_1 = require("../utils/validator");
const valid_1 = require("./valid");
const boundary_1 = require("./boundary");
const invalid_1 = require("./invalid");
class SampleGenerator {
    constructor(options) {
        this.samples = [];
        this.errors = [];
        this.startTime = 0;
        this.options = options;
        this.schema = (0, helpers_1.readJsonFile)(options.schemaPath);
        this.validateSchema();
    }
    validateSchema() {
        if (!validator_1.validator.isValidSchema(this.schema)) {
            throw new Error(`无效的JSON Schema: ${this.options.schemaPath}`);
        }
    }
    async generate() {
        this.startTime = Date.now();
        this.samples = [];
        this.errors = [];
        for (const sampleType of this.options.sampleTypes) {
            await this.generateSamplesByType(sampleType);
        }
        const summary = this.buildSummary();
        await this.exportSamples();
        return summary;
    }
    async generateSamplesByType(type) {
        const generator = this.createGenerator(type);
        for (let i = 0; i < this.options.countPerType; i++) {
            try {
                const targetField = this.options.fields?.[i % this.options.fields.length];
                const result = generator.generate(i, targetField);
                const validationResult = validator_1.validator.validate(this.schema, result.data);
                this.samples.push({
                    metadata: {
                        id: (0, helpers_1.generateId)(this.options.seed, i, type),
                        type,
                        schemaPath: this.options.schemaPath,
                        fieldPath: targetField || '',
                        reason: result.reason,
                        index: i,
                        seed: this.options.seed + i
                    },
                    data: result.data,
                    validationResult
                });
            }
            catch (error) {
                this.errors.push(`生成${type}样本#${i}失败: ${error.message}`);
            }
        }
    }
    createGenerator(type) {
        switch (type) {
            case 'valid':
                return new valid_1.ValidGenerator(this.schema, this.options.seed);
            case 'boundary':
                return new boundary_1.BoundaryGenerator(this.schema, this.options.seed);
            case 'invalid':
                return new invalid_1.InvalidGenerator(this.schema, this.options.seed);
            default:
                throw new Error(`未知的样本类型: ${type}`);
        }
    }
    async exportSamples() {
        const outputDir = this.options.outputDir;
        (0, helpers_1.ensureDir)(outputDir);
        for (const sample of this.samples) {
            const typeDir = path.join(outputDir, sample.metadata.type);
            (0, helpers_1.ensureDir)(typeDir);
            const fileName = `${sample.metadata.type}_${sample.metadata.id}.json`;
            const filePath = path.join(typeDir, fileName);
            (0, helpers_1.writeJsonFile)(filePath, {
                metadata: sample.metadata,
                data: sample.data,
                validation: sample.validationResult
            });
        }
        const index = {
            generatedAt: new Date().toISOString(),
            schema: this.options.schemaPath,
            options: this.options,
            total: this.samples.length,
            samples: this.samples.map(s => ({
                id: s.metadata.id,
                type: s.metadata.type,
                file: `${s.metadata.type}/${s.metadata.type}_${s.metadata.id}.json`,
                isValid: s.validationResult.isValid,
                reason: s.metadata.reason
            }))
        };
        (0, helpers_1.writeJsonFile)(path.join(outputDir, 'index.json'), index);
    }
    buildSummary() {
        return {
            totalSamples: this.samples.length,
            validCount: this.samples.filter(s => s.metadata.type === 'valid').length,
            boundaryCount: this.samples.filter(s => s.metadata.type === 'boundary').length,
            invalidCount: this.samples.filter(s => s.metadata.type === 'invalid').length,
            errors: this.errors,
            outputPath: this.options.outputDir,
            duration: Date.now() - this.startTime
        };
    }
    getSamples() {
        return this.samples;
    }
    getSchema() {
        return this.schema;
    }
}
exports.SampleGenerator = SampleGenerator;
//# sourceMappingURL=index.js.map