export class DieCutParser {
    parse(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return this.normalize(data);
        } catch (e) {
            throw new Error(`刀模JSON解析失败: ${e.message}`);
        }
    }

    normalize(data) {
        const pageWidth = data.pageWidth || 210;
        const pageHeight = data.pageHeight || 297;
        const bleed = data.bleed || 3;
        const unit = data.unit || 'mm';

        const dies = (data.dies || []).map((die, idx) => {
            let x = die.x;
            let y = die.y;

            if (x < 0 || y < 0) {
                die._hasNegativeCoord = true;
                die._originalX = x;
                die._originalY = y;
                x = Math.max(0, x);
                y = Math.max(0, y);
            }

            const width = die.width || 50;
            const height = die.height || 30;
            const colors = die.colors || ['C', 'M', 'Y', 'K'];

            return {
                id: die.id || `die_${idx}`,
                name: die.name || `刀模 ${idx + 1}`,
                x: this.toMM(x, unit),
                y: this.toMM(y, unit),
                width: this.toMM(width, unit),
                height: this.toMM(height, unit),
                colors: colors,
                rotation: die.rotation || 0,
                shape: die.shape || 'rect',
                points: this.normalizePoints(die.points, unit),
                _raw: die
            };
        });

        return {
            pageWidth: this.toMM(pageWidth, unit),
            pageHeight: this.toMM(pageHeight, unit),
            bleed: this.toMM(bleed, unit),
            unit: 'mm',
            dies
        };
    }

    normalizePoints(points, unit) {
        if (!points || !Array.isArray(points)) return null;
        return points.map(p => ({
            x: this.toMM(p.x, unit),
            y: this.toMM(p.y, unit)
        }));
    }

    toMM(value, fromUnit) {
        if (fromUnit === 'pt') {
            return value * 0.352778;
        }
        return value;
    }
}

export class GraphicsParser {
    parse(csvString) {
        try {
            const lines = csvString.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('CSV文件至少需要包含表头和一行数据');
            }

            const headers = this.parseCSVLine(lines[0]);
            const elements = [];

            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                if (values.length !== headers.length) continue;

                const element = {};
                headers.forEach((header, idx) => {
                    element[header.trim()] = values[idx]?.trim();
                });

                if (element.x !== undefined || element.x1 !== undefined) {
                    elements.push(this.normalizeElement(element));
                }
            }

            return elements;
        } catch (e) {
            throw new Error(`图文元素CSV解析失败: ${e.message}`);
        }
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }

    normalizeElement(el) {
        const unit = el.unit || 'mm';
        let x = parseFloat(el.x || el.x1) || 0;
        let y = parseFloat(el.y || el.y1) || 0;

        if (x < 0 || y < 0) {
            el._hasNegativeCoord = true;
            el._originalX = x;
            el._originalY = y;
            x = Math.max(0, x);
            y = Math.max(0, y);
        }

        const element = {
            id: el.id || `graphic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: el.type || 'image',
            name: el.name || el.text || '未命名元素',
            x: this.toMM(x, unit),
            y: this.toMM(y, unit),
            width: this.toMM(parseFloat(el.width || el.w) || 0, unit),
            height: this.toMM(parseFloat(el.height || el.h) || 0, unit),
            colors: this.parseColors(el.colors || el.color || 'C,M,Y,K'),
            isText: el.isText === 'true' || el.type === 'text' || el.isText === true,
            unit: 'mm'
        };

        if (element.type === 'text' || el.text) {
            element.text = el.text || el.content || '';
            element.fontSize = parseFloat(el.fontSize || el.size) || 12;
            element.fontFamily = el.fontFamily || 'Arial';
        }

        return element;
    }

    parseColors(colorStr) {
        if (Array.isArray(colorStr)) return colorStr;
        return colorStr.split(/[,;]/).map(c => c.trim()).filter(c => c);
    }

    toMM(value, fromUnit) {
        if (fromUnit === 'pt') {
            return value * 0.352778;
        }
        return value;
    }
}

export class RulesParser {
    constructor() {
        this.available = typeof jsyaml !== 'undefined';
    }

    parse(yamlString) {
        try {
            let data;
            if (this.available) {
                data = jsyaml.load(yamlString);
            } else {
                data = this.parseYAMLManual(yamlString);
            }
            return this.normalize(data);
        } catch (e) {
            throw new Error(`规则YAML解析失败: ${e.message}`);
        }
    }

    parseYAMLManual(yamlString) {
        const lines = yamlString.split('\n');
        const result = {};
        let currentSection = null;
        let sectionContent = {};

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const sectionMatch = trimmed.match(/^(\w+):\s*$/);
            if (sectionMatch) {
                if (currentSection) {
                    result[currentSection] = sectionContent;
                }
                currentSection = sectionMatch[1];
                sectionContent = {};
                continue;
            }

            const keyValueMatch = trimmed.match(/^(\w+):\s*(.+)$/);
            if (keyValueMatch) {
                const [, key, value] = keyValueMatch;
                sectionContent[key] = this.parseValue(value);
            }
        }

        if (currentSection) {
            result[currentSection] = sectionContent;
        }

        return result;
    }

    parseValue(value) {
        value = value.trim();
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null' || value === '~') return null;

        const numMatch = value.match(/^(-?\d+(?:\.\d+)?)\s*(mm|pt|cm)?$/);
        if (numMatch) {
            const num = parseFloat(numMatch[1]);
            const unit = numMatch[2] || 'mm';
            return this.toMM(num, unit);
        }

        return value.replace(/['"]/g, '');
    }

    toMM(value, fromUnit) {
        switch (fromUnit) {
            case 'pt': return value * 0.352778;
            case 'cm': return value * 10;
            default: return value;
        }
    }

    normalize(data) {
        const bleed = data.bleed || data.bleedSettings || {};
        const safeLine = data.safeLine || data.safeLineSettings || {};
        const colors = data.colors || data.colorSettings || {};
        const check = data.check || data.validation || {};

        return {
            bleed: {
                width: bleed.width ?? bleed.bleed ?? 3,
                unit: 'mm',
                checkInner: bleed.checkInner ?? true,
                checkOuter: bleed.checkOuter ?? true
            },
            safeLine: {
                width: safeLine.width ?? safeLine.safe ?? 3,
                unit: 'mm',
                isOuter: safeLine.isOuter ?? false
            },
            colors: {
                required: colors.required || ['C', 'M', 'Y', 'K'],
                optional: colors.optional || [],
                cmykOnly: colors.cmykOnly ?? false
            },
            check: {
                overlap: check.overlap ?? check.checkOverlap ?? true,
                bleed: check.bleed ?? check.checkBleed ?? true,
                safeLine: check.safeLine ?? check.checkSafeLine ?? true,
                colorLayer: check.colorLayer ?? check.checkColorLayer ?? true
            },
            units: {
                mixed: data.units?.mixed ?? false,
                default: data.units?.default ?? 'mm'
            }
        };
    }
}
