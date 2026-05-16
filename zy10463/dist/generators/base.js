"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseGenerator = void 0;
const json_schema_faker_1 = require("json-schema-faker");
const helpers_1 = require("../utils/helpers");
class BaseGenerator {
    constructor(schema, seed) {
        this.schema = schema;
        this.seed = seed;
        this.random = (0, helpers_1.seededRandom)(seed);
    }
    generateValid() {
        json_schema_faker_1.JSONSchemaFaker.option({
            random: this.random,
            useDefaultValue: true,
            useExamplesValue: true,
            failOnInvalidTypes: false,
            alwaysFakeOptionals: true
        });
        return json_schema_faker_1.JSONSchemaFaker.generate(this.schema);
    }
    getPropertyAtPath(obj, path) {
        const parts = path.split('.').filter(Boolean);
        let current = obj;
        let parent = null;
        let lastKey = '';
        for (const part of parts) {
            if (current && typeof current === 'object') {
                parent = current;
                lastKey = part;
                current = current[part];
            }
            else {
                return null;
            }
        }
        return {
            parent: parent,
            key: lastKey,
            value: current
        };
    }
    setPropertyAtPath(obj, path, value) {
        const parts = path.split('.').filter(Boolean);
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
        current[parts[parts.length - 1]] = value;
    }
}
exports.BaseGenerator = BaseGenerator;
//# sourceMappingURL=base.js.map