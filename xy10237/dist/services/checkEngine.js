"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckEngine = void 0;
const uuid_1 = require("uuid");
const countryRules_1 = require("../data/countryRules");
class CheckEngine {
    constructor(customRules) {
        this.rules = new Map();
        const allRules = customRules || countryRules_1.defaultCountryRules;
        allRules.forEach(rule => {
            this.rules.set(rule.countryCode.toUpperCase(), rule);
        });
    }
    getRule(countryCode) {
        return this.rules.get(countryCode.toUpperCase());
    }
    getAllRules() {
        return Array.from(this.rules.values());
    }
    addOrUpdateRule(rule) {
        this.rules.set(rule.countryCode.toUpperCase(), rule);
    }
    checkSample(sample, runNumber = 1) {
        const checkItems = [];
        const errors = [];
        const warnings = [];
        const rule = this.rules.get(sample.destinationCountry.toUpperCase());
        if (!rule) {
            checkItems.push({
                name: '国家规则验证',
                passed: false,
                message: `未找到目的国 ${sample.destinationCountry} 的清关规则`,
                details: '请确保目的国代码正确，或添加该国家的清关规则'
            });
            errors.push(`未知目的国: ${sample.destinationCountry}`);
            return this.buildResult(sample, 'failed', checkItems, errors, warnings, [], runNumber);
        }
        checkItems.push({
            name: '国家规则验证',
            passed: true,
            message: `已加载 ${rule.countryName} (${rule.countryCode}) 的清关规则`,
            details: rule.notes
        });
        const availableMaterialTypes = sample.materials
            .filter(m => m.valid)
            .map(m => m.type);
        const missingMaterials = [];
        const requiredMaterials = rule.requiredMaterials || ['invoice', 'composition', 'declaration'];
        requiredMaterials.forEach(requiredType => {
            const hasMaterial = availableMaterialTypes.includes(requiredType);
            if (hasMaterial) {
                checkItems.push({
                    name: `${(0, countryRules_1.getMaterialTypeName)(requiredType)}检查`,
                    passed: true,
                    message: `${(0, countryRules_1.getMaterialTypeName)(requiredType)}已提供且有效`,
                    details: sample.materials.find(m => m.type === requiredType && m.valid)?.notes
                });
            }
            else {
                checkItems.push({
                    name: `${(0, countryRules_1.getMaterialTypeName)(requiredType)}检查`,
                    passed: false,
                    message: `缺少必要的${(0, countryRules_1.getMaterialTypeName)(requiredType)}`,
                    details: `目的国 ${rule.countryName} 要求必须提供${(0, countryRules_1.getMaterialTypeName)(requiredType)}`
                });
                errors.push(`缺少必要材料: ${(0, countryRules_1.getMaterialTypeName)(requiredType)}`);
                missingMaterials.push(requiredType);
            }
        });
        sample.materials.forEach(material => {
            if (!material.valid) {
                checkItems.push({
                    name: `${(0, countryRules_1.getMaterialTypeName)(material.type)}有效性`,
                    passed: false,
                    message: `${(0, countryRules_1.getMaterialTypeName)(material.type)}无效`,
                    details: material.notes || '文件内容或格式不符合要求'
                });
                if (!missingMaterials.includes(material.type)) {
                    errors.push(`${(0, countryRules_1.getMaterialTypeName)(material.type)}无效，请重新上传`);
                }
            }
        });
        if (rule.valueThreshold && sample.value > rule.valueThreshold) {
            checkItems.push({
                name: '价值阈值检查',
                passed: false,
                message: `样品价值(${sample.value} ${sample.currency})超过阈值(${rule.valueThreshold})`,
                details: '超过阈值的样品可能需要额外的报关文件和缴纳关税'
            });
            warnings.push(`样品价值超过 ${rule.countryName} 免税阈值，可能需要额外清关文件`);
        }
        else if (rule.valueThreshold) {
            checkItems.push({
                name: '价值阈值检查',
                passed: true,
                message: `样品价值(${sample.value} ${sample.currency})在阈值(${rule.valueThreshold})范围内`,
                details: '符合简化清关条件'
            });
        }
        if (rule.additionalRequirements) {
            rule.additionalRequirements.forEach(req => {
                if (req.mandatory) {
                    checkItems.push({
                        name: `附加要求: ${req.name}`,
                        passed: false,
                        message: `需确认是否提供${req.name}`,
                        details: req.description
                    });
                    warnings.push(`需确认是否提供 ${req.name}: ${req.description}`);
                }
            });
        }
        const hasInvalidMaterials = sample.materials.some(m => !m.valid);
        const allRequiredPresent = requiredMaterials.every(type => availableMaterialTypes.includes(type));
        let status;
        if (errors.length > 0 || !allRequiredPresent || hasInvalidMaterials) {
            status = 'failed';
        }
        else if (warnings.length > 0) {
            status = 'manual_review';
        }
        else {
            status = 'passed';
        }
        return this.buildResult(sample, status, checkItems, errors, warnings, missingMaterials, runNumber);
    }
    buildResult(sample, status, checkItems, errors, warnings, missingMaterials, runNumber) {
        return {
            id: (0, uuid_1.v4)(),
            sampleId: sample.id,
            sampleName: sample.name,
            destinationCountry: sample.destinationCountry,
            status,
            checkItems,
            errors,
            warnings,
            missingMaterials,
            checkedAt: new Date().toISOString(),
            runNumber
        };
    }
    validateMaterialList(materials) {
        const issues = [];
        const validTypes = ['invoice', 'composition', 'declaration'];
        materials.forEach((m, index) => {
            if (!validTypes.includes(m.type)) {
                issues.push(`第 ${index + 1} 项材料类型无效: ${m.type}`);
            }
        });
        const requiredTypes = ['invoice', 'composition', 'declaration'];
        requiredTypes.forEach(reqType => {
            const hasType = materials.some(m => m.type === reqType);
            if (!hasType) {
                issues.push(`材料清单未包含必要类型: ${(0, countryRules_1.getMaterialTypeName)(reqType)}`);
            }
        });
        return {
            isValid: issues.length === 0,
            issues
        };
    }
    validateCountryRules() {
        const details = this.getAllRules().map(rule => ({
            countryCode: rule.countryCode,
            countryName: rule.countryName,
            requiredMaterials: (rule.requiredMaterials || []).length
        }));
        const isValid = details.every(d => d.requiredMaterials >= 3);
        return { isValid, details };
    }
}
exports.CheckEngine = CheckEngine;
