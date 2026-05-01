export class RuleEngine {
    constructor() {
        this.issues = [];
    }

    validate(dieData, graphics, rules) {
        this.issues = [];

        if (!dieData || !rules) {
            return this.issues;
        }

        if (rules.check.bleed) {
            this.checkBleedIssues(dieData, rules);
        }

        if (rules.check.safeLine) {
            this.checkSafeLineIssues(dieData, graphics, rules);
        }

        if (rules.check.colorLayer) {
            this.checkColorLayerIssues(dieData, rules);
        }

        if (rules.check.overlap) {
            this.checkOverlapIssues(dieData);
        }

        return this.issues;
    }

    checkBleedIssues(dieData, rules) {
        const bleedWidth = rules.bleed.width;
        const pageWidth = dieData.pageWidth;
        const pageHeight = dieData.pageHeight;

        for (const die of dieData.dies) {
            const dieLeft = die.x;
            const dieRight = die.x + die.width;
            const dieTop = die.y;
            const dieBottom = die.y + die.height;

            if (dieLeft < bleedWidth) {
                this.addIssue({
                    type: 'bleed',
                    severity: 'error',
                    title: '出血不足 - 左侧',
                    element: die.name,
                    detail: `刀模左侧距页面左边 ${dieLeft.toFixed(2)}mm，小于出血宽度 ${bleedWidth}mm`,
                    bounds: {
                        x: dieLeft,
                        y: dieTop,
                        width: bleedWidth - dieLeft,
                        height: die.height
                    }
                });
            }

            if (dieTop < bleedWidth) {
                this.addIssue({
                    type: 'bleed',
                    severity: 'error',
                    title: '出血不足 - 顶部',
                    element: die.name,
                    detail: `刀模顶部距页面上边 ${dieTop.toFixed(2)}mm，小于出血宽度 ${bleedWidth}mm`,
                    bounds: {
                        x: dieLeft,
                        y: dieTop,
                        width: die.width,
                        height: bleedWidth - dieTop
                    }
                });
            }

            if (dieRight > pageWidth - bleedWidth) {
                const overflow = dieRight - (pageWidth - bleedWidth);
                this.addIssue({
                    type: 'bleed',
                    severity: 'error',
                    title: '出血不足 - 右侧',
                    element: die.name,
                    detail: `刀模右侧超出安全区域 ${overflow.toFixed(2)}mm`,
                    bounds: {
                        x: pageWidth - bleedWidth,
                        y: dieTop,
                        width: overflow,
                        height: die.height
                    }
                });
            }

            if (dieBottom > pageHeight - bleedWidth) {
                const overflow = dieBottom - (pageHeight - bleedWidth);
                this.addIssue({
                    type: 'bleed',
                    severity: 'error',
                    title: '出血不足 - 底部',
                    element: die.name,
                    detail: `刀模底部超出安全区域 ${overflow.toFixed(2)}mm`,
                    bounds: {
                        x: dieLeft,
                        y: pageHeight - bleedWidth,
                        width: die.width,
                        height: overflow
                    }
                });
            }

            if (die._hasNegativeCoord) {
                this.addIssue({
                    type: 'bleed',
                    severity: 'warning',
                    title: '坐标异常 - 负数坐标',
                    element: die.name,
                    detail: `刀模原始坐标为 (${die._originalX}, ${die._originalY})，已自动修正为 (${die.x}, ${die.y})`,
                    bounds: die
                });
            }
        }
    }

    checkSafeLineIssues(dieData, graphics, rules) {
        const safeWidth = rules.safeLine.width;
        const pageWidth = dieData.pageWidth;
        const pageHeight = dieData.pageHeight;
        const safeZoneInner = safeWidth;
        const safeZoneOuter = rules.safeLine.isOuter ? safeWidth : 0;

        for (const die of dieData.dies) {
            const dieLeft = die.x;
            const dieRight = die.x + die.width;
            const dieTop = die.y;
            const dieBottom = die.y + die.height;

            const innerLeft = safeZoneInner;
            const innerRight = pageWidth - safeZoneInner;
            const innerTop = safeZoneInner;
            const innerBottom = pageHeight - safeZoneInner;

            if (dieLeft < innerLeft) {
                this.addIssue({
                    type: 'text-on-line',
                    severity: 'warning',
                    title: '刀模进入安全线内侧 - 左侧',
                    element: die.name,
                    detail: `刀模左侧进入安全线内侧 ${(innerLeft - dieLeft).toFixed(2)}mm`,
                    bounds: {
                        x: dieLeft,
                        y: dieTop,
                        width: Math.max(0, innerLeft - dieLeft),
                        height: die.height
                    }
                });
            }

            if (dieRight > innerRight) {
                this.addIssue({
                    type: 'text-on-line',
                    severity: 'warning',
                    title: '刀模进入安全线内侧 - 右侧',
                    element: die.name,
                    detail: `刀模右侧进入安全线内侧 ${(dieRight - innerRight).toFixed(2)}mm`,
                    bounds: {
                        x: innerRight,
                        y: dieTop,
                        width: Math.max(0, dieRight - innerRight),
                        height: die.height
                    }
                });
            }

            if (dieTop < innerTop) {
                this.addIssue({
                    type: 'text-on-line',
                    severity: 'warning',
                    title: '刀模进入安全线内侧 - 顶部',
                    element: die.name,
                    detail: `刀模顶部进入安全线内侧 ${(innerTop - dieTop).toFixed(2)}mm`,
                    bounds: {
                        x: dieLeft,
                        y: dieTop,
                        width: die.width,
                        height: Math.max(0, innerTop - dieTop)
                    }
                });
            }

            if (dieBottom > innerBottom) {
                this.addIssue({
                    type: 'text-on-line',
                    severity: 'warning',
                    title: '刀模进入安全线内侧 - 底部',
                    element: die.name,
                    detail: `刀模底部进入安全线内侧 ${(dieBottom - innerBottom).toFixed(2)}mm`,
                    bounds: {
                        x: dieLeft,
                        y: innerBottom,
                        width: die.width,
                        height: Math.max(0, dieBottom - innerBottom)
                    }
                });
            }
        }

        if (graphics) {
            for (const graphic of graphics) {
                if (!graphic.isText) continue;

                const gLeft = graphic.x;
                const gRight = graphic.x + graphic.width;
                const gTop = graphic.y;
                const gBottom = graphic.y + graphic.height;

                const textOnLeft = gLeft < innerLeft && gRight > safeZoneOuter;
                const textOnRight = gRight > innerRight && gLeft < pageWidth - safeZoneOuter;
                const textOnTop = gTop < innerTop && gBottom > safeZoneOuter;
                const textOnBottom = gBottom > innerBottom && gTop < pageHeight - safeZoneOuter;

                if (textOnLeft || textOnRight || textOnTop || textOnBottom) {
                    this.addIssue({
                        type: 'text-on-line',
                        severity: 'warning',
                        title: '文字压线',
                        element: graphic.name,
                        detail: `文字元素位于安全线区域内，可能被裁切`,
                        bounds: graphic
                    });
                }
            }
        }
    }

    checkColorLayerIssues(dieData, rules) {
        const requiredColors = rules.colors.required;
        const cmykOnly = rules.colors.cmykOnly;

        for (const die of dieData.dies) {
            const dieColors = die.colors || [];

            for (const required of requiredColors) {
                if (!dieColors.includes(required)) {
                    this.addIssue({
                        type: 'missing-color',
                        severity: 'error',
                        title: '色版缺失',
                        element: die.name,
                        detail: `刀模缺少 ${required} 色版，当前色版: ${dieColors.join(', ') || '无'}`,
                        bounds: die
                    });
                }
            }

            if (cmykOnly) {
                const invalidColors = dieColors.filter(c =>
                    !['C', 'M', 'Y', 'K', 'c', 'm', 'y', 'k'].includes(c)
                );
                if (invalidColors.length > 0) {
                    this.addIssue({
                        type: 'missing-color',
                        severity: 'warning',
                        title: '非CMYK色版',
                        element: die.name,
                        detail: `刀模包含非CMYK色版: ${invalidColors.join(', ')}`,
                        bounds: die
                    });
                }
            }
        }
    }

    checkOverlapIssues(dieData) {
        const dies = dieData.dies;

        for (let i = 0; i < dies.length; i++) {
            for (let j = i + 1; j < dies.length; j++) {
                const die1 = dies[i];
                const die2 = dies[j];

                const overlap = this.calculateOverlap(die1, die2);

                if (overlap.area > 0) {
                    this.addIssue({
                        type: 'overlap',
                        severity: 'error',
                        title: '刀模重叠',
                        element: `${die1.name} ↔ ${die2.name}`,
                        detail: `两个刀模重叠区域: ${overlap.area.toFixed(2)} mm² (${(overlap.width).toFixed(2)}mm × ${(overlap.height).toFixed(2)}mm)`,
                        bounds: overlap,
                        elements: [die1, die2]
                    });
                }
            }
        }
    }

    calculateOverlap(die1, die2) {
        const x1 = Math.max(die1.x, die2.x);
        const y1 = Math.max(die1.y, die2.y);
        const x2 = Math.min(die1.x + die1.width, die2.x + die2.width);
        const y2 = Math.min(die1.y + die1.height, die2.y + die2.height);

        const width = Math.max(0, x2 - x1);
        const height = Math.max(0, y2 - y1);

        return {
            x: x1,
            y: y1,
            width,
            height,
            area: width * height
        };
    }

    addIssue(issue) {
        this.issues.push({
            id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            ...issue
        });
    }

    getIssuesByType(type) {
        return this.issues.filter(i => i.type === type);
    }

    getIssuesBySeverity(severity) {
        return this.issues.filter(i => i.severity === severity);
    }

    getIssueSummary() {
        return {
            total: this.issues.length,
            errors: this.issues.filter(i => i.severity === 'error').length,
            warnings: this.issues.filter(i => i.severity === 'warning').length,
            byType: {
                bleed: this.issues.filter(i => i.type === 'bleed').length,
                'text-on-line': this.issues.filter(i => i.type === 'text-on-line').length,
                'missing-color': this.issues.filter(i => i.type === 'missing-color').length,
                overlap: this.issues.filter(i => i.type === 'overlap').length
            }
        };
    }
}
