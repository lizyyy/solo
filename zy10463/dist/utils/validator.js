"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validator = exports.SchemaValidator = void 0;
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
class SchemaValidator {
    constructor() {
        this.ajv = new ajv_1.default({
            allErrors: true,
            verbose: true,
            strict: false
        });
        (0, ajv_formats_1.default)(this.ajv);
    }
    validate(schema, data) {
        try {
            const validate = this.ajv.compile(schema);
            const isValid = validate(data);
            const errors = (validate.errors || []).map((err) => ({
                keyword: err.keyword,
                instancePath: err.instancePath,
                schemaPath: err.schemaPath,
                message: err.message || '',
                params: err.params
            }));
            return {
                isValid: isValid,
                errors
            };
        }
        catch (error) {
            return {
                isValid: false,
                errors: [{
                        keyword: 'compilation',
                        instancePath: '',
                        schemaPath: '',
                        message: `Schema编译错误: ${error.message}`,
                        params: {}
                    }]
            };
        }
    }
    isValidSchema(schema) {
        try {
            this.ajv.compile(schema);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.SchemaValidator = SchemaValidator;
exports.validator = new SchemaValidator();
//# sourceMappingURL=validator.js.map