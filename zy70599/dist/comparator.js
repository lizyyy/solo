"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DictionaryComparator = void 0;
class DictionaryComparator {
    compare(sources) {
        const allFieldNames = this.getAllFieldNames(sources);
        const conflicts = [];
        for (const fieldName of allFieldNames) {
            const fieldConflicts = this.compareField(fieldName, sources);
            conflicts.push(...fieldConflicts);
        }
        const parseErrors = sources.flatMap(s => s.errors);
        return {
            timestamp: new Date().toISOString(),
            sources: sources.map(s => ({
                systemName: s.systemName,
                filePath: s.filePath,
                fieldCount: s.fields.size,
                errorCount: s.errors.length
            })),
            conflicts,
            summary: {
                totalFields: allFieldNames.size,
                commonFields: this.countCommonFields(sources, allFieldNames),
                criticalConflicts: conflicts.filter(c => c.level === 'critical').length,
                warningConflicts: conflicts.filter(c => c.level === 'warning').length,
                infoConflicts: conflicts.filter(c => c.level === 'info').length,
                parseErrors: parseErrors.length
            },
            parseErrors
        };
    }
    getAllFieldNames(sources) {
        const allNames = new Set();
        for (const source of sources) {
            for (const name of source.fields.keys()) {
                allNames.add(name);
            }
        }
        return allNames;
    }
    countCommonFields(sources, allFieldNames) {
        let count = 0;
        for (const fieldName of allFieldNames) {
            const hasField = sources.every(s => s.fields.has(fieldName));
            if (hasField)
                count++;
        }
        return count;
    }
    compareField(fieldName, sources) {
        const conflicts = [];
        const fieldSources = sources.map(s => ({
            systemName: s.systemName,
            field: s.fields.get(fieldName)
        }));
        const missingSystems = fieldSources.filter(s => !s.field);
        if (missingSystems.length > 0 && missingSystems.length < sources.length) {
            conflicts.push({
                fieldName,
                level: missingSystems.length === 1 ? 'warning' : 'critical',
                type: 'missing_field',
                sources: fieldSources,
                details: `以下系统缺少该字段: ${missingSystems.map(s => s.systemName).join(', ')}`
            });
            return conflicts;
        }
        if (missingSystems.length === sources.length) {
            return conflicts;
        }
        const fields = fieldSources.filter(s => s.field).map(s => s.field);
        const types = [...new Set(fields.map(f => f.type))];
        if (types.length > 1) {
            const typeDetails = fieldSources
                .map(s => `${s.systemName}: ${s.field?.type || 'N/A'}`)
                .join('; ');
            conflicts.push({
                fieldName,
                level: 'critical',
                type: 'type_mismatch',
                sources: fieldSources,
                details: `类型不匹配: ${typeDetails}`
            });
        }
        const enumSets = fields.map(f => new Set(f.enumValues));
        const allEnums = new Set();
        enumSets.forEach(set => set.forEach(e => allEnums.add(e)));
        const hasEnumDiff = enumSets.some((set, i) => {
            if (i === 0)
                return false;
            return set.size !== enumSets[0].size ||
                ![...set].every(v => enumSets[0].has(v));
        });
        if (hasEnumDiff && allEnums.size > 0) {
            const enumDetails = fieldSources
                .map(s => `${s.systemName}: [${(s.field?.enumValues || []).join(', ')}]`)
                .join('; ');
            conflicts.push({
                fieldName,
                level: this.determineEnumLevel(fields),
                type: 'enum_mismatch',
                sources: fieldSources,
                details: `枚举值不匹配: ${enumDetails}`
            });
        }
        const descriptions = fields.map(f => f.description.trim());
        const uniqueDescs = [...new Set(descriptions.filter(Boolean))];
        if (uniqueDescs.length > 1) {
            const descDetails = fieldSources
                .map(s => `${s.systemName}: "${s.field?.description || ''}"`)
                .join('; ');
            conflicts.push({
                fieldName,
                level: 'info',
                type: 'description_mismatch',
                sources: fieldSources,
                details: `业务说明不一致: ${descDetails}`
            });
        }
        return conflicts;
    }
    determineEnumLevel(fields) {
        const hasEmpty = fields.some(f => f.enumValues.length === 0);
        if (hasEmpty) {
            return 'warning';
        }
        const allSizes = fields.map(f => f.enumValues.length);
        const maxSize = Math.max(...allSizes);
        const minSize = Math.min(...allSizes);
        if (maxSize - minSize >= 2) {
            return 'critical';
        }
        return 'warning';
    }
}
exports.DictionaryComparator = DictionaryComparator;
