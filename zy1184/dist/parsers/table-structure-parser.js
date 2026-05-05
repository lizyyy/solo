"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableStructureParser = void 0;
exports.parseTableStructure = parseTableStructure;
class TableStructureParser {
    constructor(options = {}) {
        this.options = {
            format: 'sql',
            includeIndexes: true,
            includeForeignKeys: true,
            ...options,
        };
    }
    parse(content) {
        switch (this.options.format) {
            case 'json':
                return this.parseJsonFormat(content);
            case 'yaml':
                return this.parseYamlFormat(content);
            case 'sql':
            default:
                return this.parseSqlFormat(content);
        }
    }
    parseJsonFormat(content) {
        try {
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
                return data.map(item => this.parseJsonItem(item));
            }
            return [this.parseJsonItem(data)];
        }
        catch {
            return [];
        }
    }
    parseJsonItem(item) {
        return {
            tableName: item.tableName || item.name || '',
            schema: item.schema,
            columns: (item.columns || []).map((col) => ({
                name: col.name || col.columnName,
                dataType: col.dataType || col.type,
                nullable: col.nullable ?? col.isNullable ?? true,
                defaultValue: col.defaultValue,
                isPrimaryKey: col.isPrimaryKey || col.primaryKey || false,
                isAutoIncrement: col.isAutoIncrement || col.autoIncrement || false,
                isUnique: col.isUnique || col.unique || false,
                comment: col.comment,
                characterMaximumLength: col.characterMaximumLength || col.maxLength,
                numericPrecision: col.numericPrecision || col.precision,
                numericScale: col.numericScale || col.scale,
            })),
            primaryKey: item.primaryKey ? {
                name: item.primaryKey.name,
                columns: item.primaryKey.columns || [item.primaryKey.column],
            } : undefined,
            indexes: (item.indexes || []).map((idx) => ({
                name: idx.name,
                columns: idx.columns || [idx.column],
                isUnique: idx.isUnique || idx.unique || false,
                isPrimary: idx.isPrimary || idx.primary || false,
                type: idx.type,
            })),
            foreignKeys: (item.foreignKeys || item.foreign_keys || []).map((fk) => ({
                name: fk.name,
                columnName: fk.columnName || fk.column,
                referencedTableName: fk.referencedTableName || fk.referencedTable,
                referencedColumnName: fk.referencedColumnName || fk.referencedColumn,
                onDelete: fk.onDelete,
                onUpdate: fk.onUpdate,
            })),
            estimatedRowCount: item.estimatedRowCount || item.rowCount,
            comment: item.comment,
        };
    }
    parseYamlFormat(content) {
        try {
            const yaml = require('yaml');
            const data = yaml.parse(content);
            if (Array.isArray(data)) {
                return data.map((item) => this.parseJsonItem(item));
            }
            return [this.parseJsonItem(data)];
        }
        catch {
            return [];
        }
    }
    parseSqlFormat(content) {
        const tables = [];
        const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?([a-zA-Z_][a-zA-Z0-9_]*)`?\.)?`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s*\(/gi;
        let match;
        const statements = this.splitStatements(content);
        for (const statement of statements) {
            const createMatch = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?([a-zA-Z_][a-zA-Z0-9_]*)`?\.)?`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s*\(([\s\S]*)\)/i);
            if (createMatch) {
                const schema = createMatch[1];
                const tableName = createMatch[2];
                const body = createMatch[3];
                const table = this.parseCreateTableBody(tableName, schema, body);
                const indexStatements = statements.filter(s => s.toUpperCase().includes(`CREATE INDEX`) &&
                    s.toUpperCase().includes(tableName.toUpperCase()));
                for (const idxStmt of indexStatements) {
                    const index = this.parseIndexStatement(idxStmt, tableName);
                    if (index) {
                        table.indexes.push(index);
                    }
                }
                tables.push(table);
            }
        }
        return tables;
    }
    splitStatements(content) {
        const statements = [];
        let current = '';
        let inString = false;
        let stringChar = '';
        let depth = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            if ((char === "'" || char === '"' || char === '`') && !inString) {
                inString = true;
                stringChar = char;
                current += char;
            }
            else if (char === stringChar && inString) {
                if (content[i - 1] !== '\\') {
                    inString = false;
                }
                current += char;
            }
            else if (!inString) {
                if (char === '(') {
                    depth++;
                    current += char;
                }
                else if (char === ')') {
                    depth--;
                    current += char;
                }
                else if (char === ';' && depth === 0) {
                    if (current.trim()) {
                        statements.push(current.trim());
                    }
                    current = '';
                }
                else {
                    current += char;
                }
            }
            else {
                current += char;
            }
        }
        if (current.trim()) {
            statements.push(current.trim());
        }
        return statements;
    }
    parseCreateTableBody(tableName, schema, body) {
        const columns = [];
        let primaryKey;
        const indexes = [];
        const foreignKeys = [];
        const lines = body.split(',');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            if (trimmed.toUpperCase().startsWith('PRIMARY KEY')) {
                primaryKey = this.parsePrimaryKeyConstraint(trimmed);
            }
            else if (trimmed.toUpperCase().startsWith('FOREIGN KEY')) {
                const fk = this.parseForeignKeyConstraint(trimmed);
                if (fk)
                    foreignKeys.push(fk);
            }
            else if (trimmed.toUpperCase().startsWith('UNIQUE') || trimmed.toUpperCase().startsWith('INDEX') || trimmed.toUpperCase().startsWith('KEY')) {
                const idx = this.parseIndexConstraint(trimmed, tableName);
                if (idx)
                    indexes.push(idx);
            }
            else {
                const column = this.parseColumnDefinition(trimmed);
                if (column) {
                    columns.push(column);
                    if (column.isPrimaryKey) {
                        if (!primaryKey) {
                            primaryKey = { columns: [column.name] };
                        }
                        else if (!primaryKey.columns.includes(column.name)) {
                            primaryKey.columns.push(column.name);
                        }
                    }
                }
            }
        }
        return {
            tableName,
            schema,
            columns,
            primaryKey,
            indexes,
            foreignKeys,
        };
    }
    parseColumnDefinition(line) {
        const match = line.match(/^`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s+([a-zA-Z]+(?:\(\d+(?:,\d+)?\))?)(.*)$/i);
        if (!match)
            return null;
        const name = match[1];
        const dataType = match[2];
        const constraints = match[3].toUpperCase();
        const lengthMatch = dataType.match(/\((\d+)(?:,(\d+))?\)/);
        const characterMaximumLength = lengthMatch ? parseInt(lengthMatch[1], 10) : undefined;
        const numericPrecision = lengthMatch ? parseInt(lengthMatch[1], 10) : undefined;
        const numericScale = lengthMatch && lengthMatch[2] ? parseInt(lengthMatch[2], 10) : undefined;
        return {
            name,
            dataType: dataType.replace(/\(\d+(?:,\d+)?\)/, '').toUpperCase(),
            nullable: !constraints.includes('NOT NULL'),
            defaultValue: this.extractDefaultValue(line),
            isPrimaryKey: constraints.includes('PRIMARY KEY'),
            isAutoIncrement: constraints.includes('AUTO_INCREMENT') || constraints.includes('SERIAL') || constraints.includes('IDENTITY'),
            isUnique: constraints.includes('UNIQUE'),
            characterMaximumLength,
            numericPrecision,
            numericScale,
        };
    }
    extractDefaultValue(line) {
        const match = line.match(/DEFAULT\s+('.*?'|".*?"|\d+(?:\.\d+)?|NULL|TRUE|FALSE)/i);
        if (!match)
            return undefined;
        const value = match[1].trim();
        if (value.toUpperCase() === 'NULL')
            return null;
        if (value.toUpperCase() === 'TRUE')
            return true;
        if (value.toUpperCase() === 'FALSE')
            return false;
        if (value.startsWith("'") && value.endsWith("'"))
            return value.slice(1, -1);
        if (value.startsWith('"') && value.endsWith('"'))
            return value.slice(1, -1);
        if (!isNaN(Number(value)))
            return Number(value);
        return value;
    }
    parsePrimaryKeyConstraint(line) {
        const columnsMatch = line.match(/\(([^)]+)\)/);
        const columns = columnsMatch
            ? columnsMatch[1].split(',').map(c => c.trim().replace(/`/g, ''))
            : [];
        const nameMatch = line.match(/CONSTRAINT\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i);
        const name = nameMatch ? nameMatch[1] : undefined;
        return { name, columns };
    }
    parseForeignKeyConstraint(line) {
        const columnMatch = line.match(/FOREIGN\s+KEY\s*\(\s*`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s*\)/i);
        const referenceMatch = line.match(/REFERENCES\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s*\(\s*`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s*\)/i);
        if (!columnMatch || !referenceMatch)
            return null;
        const nameMatch = line.match(/CONSTRAINT\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i);
        const onDeleteMatch = line.match(/ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION|SET\s+DEFAULT)/i);
        const onUpdateMatch = line.match(/ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION|SET\s+DEFAULT)/i);
        return {
            name: nameMatch ? nameMatch[1] : undefined,
            columnName: columnMatch[1],
            referencedTableName: referenceMatch[1],
            referencedColumnName: referenceMatch[2],
            onDelete: onDeleteMatch ? onDeleteMatch[1].replace(/\s+/g, '_') : undefined,
            onUpdate: onUpdateMatch ? onUpdateMatch[1].replace(/\s+/g, '_') : undefined,
        };
    }
    parseIndexConstraint(line, tableName) {
        const unique = line.toUpperCase().startsWith('UNIQUE');
        const nameMatch = line.match(/(?:UNIQUE\s+)?(?:INDEX|KEY)\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i);
        const columnsMatch = line.match(/\(([^)]+)\)/);
        if (!columnsMatch)
            return null;
        const columns = columnsMatch[1].split(',').map(c => c.trim().replace(/`/g, ''));
        return {
            name: nameMatch ? nameMatch[1] : `idx_${tableName}_${columns.join('_')}`,
            columns,
            isUnique: unique,
            isPrimary: false,
        };
    }
    parseIndexStatement(statement, tableName) {
        const unique = statement.toUpperCase().includes('UNIQUE');
        const nameMatch = statement.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i);
        const tableMatch = statement.match(/ON\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i);
        const columnsMatch = statement.match(/\(([^)]+)\)/);
        if (!columnsMatch || (tableMatch && tableMatch[1] !== tableName))
            return null;
        const columns = columnsMatch[1].split(',').map(c => c.trim().replace(/`/g, ''));
        return {
            name: nameMatch ? nameMatch[1] : `idx_${tableName}_${columns.join('_')}`,
            columns,
            isUnique: unique,
            isPrimary: false,
        };
    }
}
exports.TableStructureParser = TableStructureParser;
function parseTableStructure(content, options) {
    const parser = new TableStructureParser(options);
    return parser.parse(content);
}
//# sourceMappingURL=table-structure-parser.js.map