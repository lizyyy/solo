/**
 * 报告生成器
 * 生成仓库布局和拣货路线的报告
 */

const ReportGenerator = {
    generateMarkdown(reportData) {
        const warehouse = reportData.warehouse;
        const pickingOrder = reportData.pickingOrder;
        const report = this.generateReport(warehouse, pickingOrder);
        return this.toMarkdown(report);
    },
    
    generateHTML(reportData) {
        const warehouse = reportData.warehouse;
        const pickingOrder = reportData.pickingOrder;
        const report = this.generateReport(warehouse, pickingOrder);
        return this.toHTML(report);
    },
    
    generateReport(warehouse, pickingOrder = null, options = {}) {
        const report = {
            title: '仓库方案报告',
            generatedAt: new Date().toISOString(),
            warehouse: this.generateWarehouseSection(warehouse),
            conflicts: this.generateConflictsSection(warehouse),
            layoutSuggestions: this.generateLayoutSuggestions(warehouse)
        };
        
        if (pickingOrder) {
            report.picking = this.generatePickingSection(pickingOrder, warehouse);
        }
        
        return report;
    },
    
    generateWarehouseSection(warehouse) {
        const shelves = warehouse.getShelves();
        const zones = warehouse.getZones();
        const entrances = warehouse.getEntrances();
        const forbidden = warehouse.getForbiddenZones();
        
        return {
            name: warehouse.name,
            dimensions: {
                length: warehouse.length,
                width: warehouse.width,
                height: warehouse.height
            },
            gridSize: warehouse.gridSize,
            minAisleWidth: warehouse.minAisleWidth,
            statistics: {
                totalObjects: warehouse.objects.length,
                shelfCount: shelves.length,
                zoneCount: zones.length,
                entranceCount: entrances.length,
                forbiddenZoneCount: forbidden.length,
                skuCount: this.countTotalSkus(warehouse)
            },
            objects: warehouse.objects.map(obj => ({
                id: obj.id,
                type: obj.type,
                typeName: Constants.OBJECT_TYPE_NAMES[obj.type],
                name: obj.name,
                position: { x: obj.x, z: obj.z },
                size: { length: obj.length, width: obj.width, height: obj.height },
                rotation: obj.rotation,
                hasConflicts: obj.hasConflicts()
            }))
        };
    },
    
    countTotalSkus(warehouse) {
        const skus = new Set();
        const shelves = warehouse.getShelves();
        
        shelves.forEach(shelf => {
            shelf.slots.forEach(slot => {
                if (slot.sku) {
                    skus.add(slot.sku);
                }
            });
        });
        
        return skus.size;
    },
    
    generateConflictsSection(warehouse) {
        const conflicts = warehouse.getConflicts();
        
        const groupedByType = {};
        conflicts.forEach(conflict => {
            if (!groupedByType[conflict.type]) {
                groupedByType[conflict.type] = [];
            }
            groupedByType[conflict.type].push(conflict);
        });
        
        return {
            totalCount: conflicts.length,
            hasConflicts: conflicts.length > 0,
            byType: Object.entries(groupedByType).map(([type, items]) => ({
                type: type,
                typeName: Constants.CONFLICT_TYPE_NAMES[type],
                count: items.length,
                items: items
            })),
            allConflicts: conflicts
        };
    },
    
    generateLayoutSuggestions(warehouse) {
        const suggestions = [];
        const conflicts = warehouse.getConflicts();
        
        const overlapConflicts = conflicts.filter(c => c.type === Constants.CONFLICT_TYPES.OVERLAP);
        if (overlapConflicts.length > 0) {
            suggestions.push({
                priority: 'high',
                category: '布局优化',
                title: '存在对象重叠',
                description: `检测到 ${overlapConflicts.length} 处对象重叠问题。重叠的对象会导致拣货路线计算错误，建议立即调整。`,
                affectedObjects: overlapConflicts.map(c => ({
                    objectA: c.objectNameA,
                    objectB: c.objectNameB,
                    details: c.details
                }))
            });
        }
        
        const outOfBoundsConflicts = conflicts.filter(c => c.type === Constants.CONFLICT_TYPES.OUT_OF_BOUNDS);
        if (outOfBoundsConflicts.length > 0) {
            suggestions.push({
                priority: 'high',
                category: '布局优化',
                title: '对象越界',
                description: `有 ${outOfBoundsConflicts.length} 个对象超出仓库边界。这些对象在实际仓库中无法放置。`,
                affectedObjects: outOfBoundsConflicts.map(c => ({
                    objectName: c.objectNameA,
                    details: c.details
                }))
            });
        }
        
        const aisleConflicts = conflicts.filter(c => c.type === Constants.CONFLICT_TYPES.AISLE_TOO_NARROW);
        if (aisleConflicts.length > 0) {
            suggestions.push({
                priority: 'medium',
                category: '通道优化',
                title: '通道宽度不足',
                description: `检测到 ${aisleConflicts.length} 处通道宽度不足。最小通道宽度要求为 ${warehouse.minAisleWidth}m。通道过窄会影响拣货效率和安全。`,
                affectedObjects: aisleConflicts.map(c => ({
                    objectA: c.objectNameA,
                    objectB: c.objectNameB,
                    details: c.details
                }))
            });
        }
        
        const entranceConflicts = conflicts.filter(c => c.type === Constants.CONFLICT_TYPES.ENTRANCE_BLOCKED);
        if (entranceConflicts.length > 0) {
            suggestions.push({
                priority: 'high',
                category: '出入口优化',
                title: '出入口被阻挡',
                description: `检测到 ${entranceConflicts.length} 处出入口被阻挡。出入口必须保持畅通以确保货物进出顺畅。`,
                affectedObjects: entranceConflicts.map(c => ({
                    blockingObject: c.objectNameA,
                    entrance: c.objectNameB,
                    details: c.details
                }))
            });
        }
        
        const forbiddenConflicts = conflicts.filter(c => c.type === Constants.CONFLICT_TYPES.FORBIDDEN_ZONE);
        if (forbiddenConflicts.length > 0) {
            suggestions.push({
                priority: 'high',
                category: '布局优化',
                title: '禁放区冲突',
                description: `检测到 ${forbiddenConflicts.length} 个对象位于禁放区内。禁放区通常是建筑结构或设备区域，不可放置货架。`,
                affectedObjects: forbiddenConflicts.map(c => ({
                    object: c.objectNameA,
                    forbiddenZone: c.objectNameB,
                    details: c.details
                }))
            });
        }
        
        const shelves = warehouse.getShelves();
        if (shelves.length === 0) {
            suggestions.push({
                priority: 'info',
                category: '布局建议',
                title: '仓库为空',
                description: '当前仓库中没有放置任何货架。建议添加货架并配置 SKU 位置以开始规划。'
            });
        }
        
        const entrances = warehouse.getEntrances();
        if (entrances.length === 0) {
            suggestions.push({
                priority: 'medium',
                category: '布局建议',
                title: '未设置出入口',
                description: '建议添加至少一个入口和出口，以便正确计算拣货路线。'
            });
        }
        
        return suggestions;
    },
    
    generatePickingSection(pickingOrder, warehouse) {
        const validation = pickingOrder.validate(warehouse);
        const comparison = pickingOrder.getRouteComparison();
        
        return {
            name: pickingOrder.name,
            createdAt: pickingOrder.createdAt,
            status: pickingOrder.status,
            statistics: {
                totalItems: pickingOrder.items.length,
                validItems: validation.validCount,
                invalidItems: validation.invalidCount,
                totalQuantity: pickingOrder.getTotalQuantity(),
                uniqueSkus: pickingOrder.getUniqueSkus().length
            },
            validation: {
                isValid: validation.isValid,
                errors: validation.errors
            },
            items: pickingOrder.items.map(item => ({
                id: item.id,
                orderNo: item.orderNo,
                sku: item.sku,
                quantity: item.quantity,
                shelfSlot: item.shelfSlot,
                shelfId: item.shelfId,
                isValid: item.isValid,
                errors: item.validationErrors
            })),
            routeComparison: comparison,
            optimizedRoute: pickingOrder.optimizedRoute ? {
                totalDistance: pickingOrder.optimizedRoute.totalDistance,
                algorithm: pickingOrder.optimizedRoute.algorithm,
                pointCount: pickingOrder.optimizedRoute.points?.length || 0,
                points: pickingOrder.optimizedRoute.points?.map(p => ({
                    type: p.type,
                    label: p.label,
                    x: p.x,
                    z: p.z
                }))
            } : null,
            manualRoute: pickingOrder.manualRoute ? {
                totalDistance: pickingOrder.manualRoute.totalDistance,
                pointCount: pickingOrder.manualRoute.points?.length || 0
            } : null
        };
    },
    
    toMarkdown(report) {
        let md = `# ${report.title}\n\n`;
        md += `> 生成时间: ${new Date(report.generatedAt).toLocaleString()}\n\n`;
        md += `---\n\n`;
        
        md += `## 一、仓库概况\n\n`;
        md += `**仓库名称**: ${report.warehouse.name}\n\n`;
        md += `**仓库尺寸**: ${report.warehouse.dimensions.length}m × ${report.warehouse.dimensions.width}m × ${report.warehouse.dimensions.height}m\n\n`;
        md += `**网格大小**: ${report.warehouse.gridSize}m\n\n`;
        md += `**最小通道宽度**: ${report.warehouse.minAisleWidth}m\n\n`;
        
        md += `### 对象统计\n\n`;
        md += `| 类型 | 数量 |\n`;
        md += `|------|------|\n`;
        md += `| 货架 | ${report.warehouse.statistics.shelfCount} |\n`;
        md += `| 货区 | ${report.warehouse.statistics.zoneCount} |\n`;
        md += `| 出入口 | ${report.warehouse.statistics.entranceCount} |\n`;
        md += `| 禁放区 | ${report.warehouse.statistics.forbiddenZoneCount} |\n`;
        md += `| SKU 总数 | ${report.warehouse.statistics.skuCount} |\n\n`;
        
        md += `---\n\n`;
        
        md += `## 二、布局问题检测\n\n`;
        
        if (report.conflicts.hasConflicts) {
            md += `**⚠️ 检测到 ${report.conflicts.totalCount} 个布局问题**\n\n`;
            
            report.conflicts.byType.forEach(group => {
                md += `### ${group.typeName} (${group.count} 处)\n\n`;
                group.items.forEach((conflict, idx) => {
                    md += `**问题 ${idx + 1}**: ${conflict.description}\n\n`;
                    if (conflict.details) {
                        md += `> ${conflict.details}\n\n`;
                    }
                });
            });
        } else {
            md += `✅ **布局检查通过，未发现问题**\n\n`;
        }
        
        md += `---\n\n`;
        
        md += `## 三、优化建议\n\n`;
        
        if (report.layoutSuggestions.length === 0) {
            md += `✅ 仓库布局良好，暂无优化建议。\n\n`;
        } else {
            report.layoutSuggestions.forEach((suggestion, idx) => {
                const priorityIcon = {
                    'high': '🔴',
                    'medium': '🟡',
                    'info': '🔵'
                }[suggestion.priority] || '⚪';
                
                md += `### ${idx + 1}. ${priorityIcon} ${suggestion.title}\n\n`;
                md += `${suggestion.description}\n\n`;
                
                if (suggestion.affectedObjects && suggestion.affectedObjects.length > 0) {
                    md += `**涉及对象**:\n\n`;
                    suggestion.affectedObjects.forEach((obj, objIdx) => {
                        if (obj.objectA && obj.objectB) {
                            md += `${objIdx + 1}. "${obj.objectA}" 与 "${obj.objectB}"\n`;
                        } else if (obj.objectName) {
                            md += `${objIdx + 1}. "${obj.objectName}"\n`;
                        } else if (obj.blockingObject) {
                            md += `${objIdx + 1}. "${obj.blockingObject}" 阻挡了 "${obj.entrance}"\n`;
                        } else if (obj.object) {
                            md += `${objIdx + 1}. "${obj.object}" 位于禁放区 "${obj.forbiddenZone}" 内\n`;
                        }
                    });
                    md += `\n`;
                }
            });
        }
        
        if (report.picking) {
            md += `---\n\n`;
            md += `## 四、拣货单信息\n\n`;
            
            md += `**拣货单名称**: ${report.picking.name}\n\n`;
            md += `**创建时间**: ${new Date(report.picking.createdAt).toLocaleString()}\n\n`;
            md += `**状态**: ${report.picking.status}\n\n`;
            
            md += `### 统计信息\n\n`;
            md += `| 指标 | 数值 |\n`;
            md += `|------|------|\n`;
            md += `| 总行数 | ${report.picking.statistics.totalItems} |\n`;
            md += `| 有效行 | ${report.picking.statistics.validItems} |\n`;
            md += `| 无效行 | ${report.picking.statistics.invalidItems} |\n`;
            md += `| 总件数 | ${report.picking.statistics.totalQuantity} |\n`;
            md += `| 唯一 SKU | ${report.picking.statistics.uniqueSkus} |\n\n`;
            
            if (!report.picking.validation.isValid && report.picking.validation.errors.length > 0) {
                md += `### ⚠️ 数据验证错误\n\n`;
                report.picking.validation.errors.forEach((error, idx) => {
                    md += `${idx + 1}. ${error}\n`;
                });
                md += `\n`;
            }
            
            if (report.picking.routeComparison) {
                md += `### 路线对比\n\n`;
                
                const comp = report.picking.routeComparison;
                
                if (comp.optimizedDistance !== null) {
                    md += `**推荐路线距离**: ${Utils.formatDistance(comp.optimizedDistance)}\n\n`;
                }
                
                if (comp.manualDistance !== null) {
                    md += `**手动路线距离**: ${Utils.formatDistance(comp.manualDistance)}\n\n`;
                }
                
                if (comp.difference !== null) {
                    const sign = comp.difference > 0 ? '+' : '';
                    const percentStr = comp.differencePercent !== null ? ` (${sign}${comp.differencePercent.toFixed(1)}%)` : '';
                    md += `**路线差异**: ${sign}${Utils.formatDistance(comp.difference)}${percentStr}\n\n`;
                    
                    if (comp.difference > 0) {
                        md += `> 💡 建议: 推荐路线比手动路线短 ${Utils.formatDistance(comp.difference)}，建议采用推荐路线。\n\n`;
                    } else if (comp.difference < 0) {
                        md += `> 💡 注意: 手动路线比推荐路线短，这可能意味着推荐算法有优化空间。\n\n`;
                    }
                }
            }
            
            if (report.picking.items.length > 0) {
                md += `### 拣货明细\n\n`;
                md += `| 订单号 | SKU | 数量 | 货架位 | 状态 |\n`;
                md += `|--------|-----|------|--------|------|\n`;
                
                report.picking.items.forEach(item => {
                    const status = item.isValid ? '✅ 有效' : '❌ 无效';
                    md += `| ${item.orderNo} | ${item.sku} | ${item.quantity} | ${item.shelfSlot} | ${status} |\n`;
                });
                md += `\n`;
            }
        }
        
        md += `---\n\n`;
        md += `*报告由 3D 仓库拣货路线规划工具自动生成*\n`;
        
        return md;
    },
    
    toHTML(report) {
        let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #333;
            line-height: 1.6;
        }
        h1, h2, h3 {
            color: #1a1a2e;
            border-bottom: 2px solid #e94560;
            padding-bottom: 8px;
        }
        h1 {
            font-size: 2em;
        }
        h2 {
            font-size: 1.5em;
            margin-top: 2em;
        }
        h3 {
            font-size: 1.2em;
            border-bottom-width: 1px;
            border-bottom-color: #ddd;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #f5f5f5;
            font-weight: 600;
        }
        .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 1em;
            margin: 1em 0;
            border-radius: 4px;
        }
        .success {
            background-color: #d4edda;
            border-left: 4px solid #28a745;
            padding: 1em;
            margin: 1em 0;
            border-radius: 4px;
        }
        .error {
            background-color: #f8d7da;
            border-left: 4px solid #dc3545;
            padding: 1em;
            margin: 1em 0;
            border-radius: 4px;
        }
        .info {
            background-color: #d1ecf1;
            border-left: 4px solid #17a2b8;
            padding: 1em;
            margin: 1em 0;
            border-radius: 4px;
        }
        .priority-high { color: #dc3545; }
        .priority-medium { color: #ffc107; }
        .priority-info { color: #17a2b8; }
        .meta {
            color: #666;
            font-size: 0.9em;
            margin-bottom: 2em;
        }
        hr {
            border: none;
            border-top: 1px solid #ddd;
            margin: 2em 0;
        }
        ul, ol {
            padding-left: 1.5em;
        }
        li {
            margin: 0.5em 0;
        }
        blockquote {
            margin: 0;
            padding-left: 1em;
            border-left: 3px solid #e94560;
            color: #666;
            font-style: italic;
        }
        .footer {
            margin-top: 3em;
            padding-top: 1em;
            border-top: 1px solid #ddd;
            color: #888;
            font-size: 0.85em;
            text-align: center;
        }
    </style>
</head>
<body>
    <h1>${report.title}</h1>
    <div class="meta">生成时间: ${new Date(report.generatedAt).toLocaleString()}</div>
    
    <h2>一、仓库概况</h2>
    <p><strong>仓库名称:</strong> ${report.warehouse.name}</p>
    <p><strong>仓库尺寸:</strong> ${report.warehouse.dimensions.length}m × ${report.warehouse.dimensions.width}m × ${report.warehouse.dimensions.height}m</p>
    <p><strong>网格大小:</strong> ${report.warehouse.gridSize}m</p>
    <p><strong>最小通道宽度:</strong> ${report.warehouse.minAisleWidth}m</p>
    
    <h3>对象统计</h3>
    <table>
        <tr><th>类型</th><th>数量</th></tr>
        <tr><td>货架</td><td>${report.warehouse.statistics.shelfCount}</td></tr>
        <tr><td>货区</td><td>${report.warehouse.statistics.zoneCount}</td></tr>
        <tr><td>出入口</td><td>${report.warehouse.statistics.entranceCount}</td></tr>
        <tr><td>禁放区</td><td>${report.warehouse.statistics.forbiddenZoneCount}</td></tr>
        <tr><td>SKU 总数</td><td>${report.warehouse.statistics.skuCount}</td></tr>
    </table>
    
    <h2>二、布局问题检测</h2>`;
        
        if (report.conflicts.hasConflicts) {
            html += `
    <div class="error">
        <strong>⚠️ 检测到 ${report.conflicts.totalCount} 个布局问题</strong>
    </div>`;
            
            report.conflicts.byType.forEach(group => {
                html += `
    <h3>${group.typeName} (${group.count} 处)</h3>`;
                group.items.forEach((conflict, idx) => {
                    html += `
    <p><strong>问题 ${idx + 1}:</strong> ${conflict.description}</p>`;
                    if (conflict.details) {
                        html += `
    <blockquote>${conflict.details}</blockquote>`;
                    }
                });
            });
        } else {
            html += `
    <div class="success">
        <strong>✅ 布局检查通过，未发现问题</strong>
    </div>`;
        }
        
        html += `
    <h2>三、优化建议</h2>`;
        
        if (report.layoutSuggestions.length === 0) {
            html += `
    <div class="success">仓库布局良好，暂无优化建议。</div>`;
        } else {
            report.layoutSuggestions.forEach((suggestion, idx) => {
                const priorityClass = `priority-${suggestion.priority}`;
                const priorityIcon = {
                    'high': '🔴',
                    'medium': '🟡',
                    'info': '🔵'
                }[suggestion.priority] || '⚪';
                
                html += `
    <h3>${idx + 1}. ${priorityIcon} <span class="${priorityClass}">${suggestion.title}</span></h3>
    <p>${suggestion.description}</p>`;
                
                if (suggestion.affectedObjects && suggestion.affectedObjects.length > 0) {
                    html += `
    <p><strong>涉及对象:</strong></p>
    <ul>`;
                    suggestion.affectedObjects.forEach((obj, objIdx) => {
                        if (obj.objectA && obj.objectB) {
                            html += `<li>"${obj.objectA}" 与 "${obj.objectB}"</li>`;
                        } else if (obj.objectName) {
                            html += `<li>"${obj.objectName}"</li>`;
                        } else if (obj.blockingObject) {
                            html += `<li>"${obj.blockingObject}" 阻挡了 "${obj.entrance}"</li>`;
                        } else if (obj.object) {
                            html += `<li>"${obj.object}" 位于禁放区 "${obj.forbiddenZone}" 内</li>`;
                        }
                    });
                    html += `</ul>`;
                }
            });
        }
        
        if (report.picking) {
            html += `
    <h2>四、拣货单信息</h2>
    <p><strong>拣货单名称:</strong> ${report.picking.name}</p>
    <p><strong>创建时间:</strong> ${new Date(report.picking.createdAt).toLocaleString()}</p>
    <p><strong>状态:</strong> ${report.picking.status}</p>
    
    <h3>统计信息</h3>
    <table>
        <tr><th>指标</th><th>数值</th></tr>
        <tr><td>总行数</td><td>${report.picking.statistics.totalItems}</td></tr>
        <tr><td>有效行</td><td>${report.picking.statistics.validItems}</td></tr>
        <tr><td>无效行</td><td>${report.picking.statistics.invalidCount}</td></tr>
        <tr><td>总件数</td><td>${report.picking.statistics.totalQuantity}</td></tr>
        <tr><td>唯一 SKU</td><td>${report.picking.statistics.uniqueSkus}</td></tr>
    </table>`;
            
            if (!report.picking.validation.isValid && report.picking.validation.errors.length > 0) {
                html += `
    <div class="error">
        <strong>⚠️ 数据验证错误</strong>
        <ul>`;
                report.picking.validation.errors.forEach(error => {
                    html += `<li>${error}</li>`;
                });
                html += `
        </ul>
    </div>`;
            }
            
            if (report.picking.routeComparison) {
                const comp = report.picking.routeComparison;
                html += `
    <h3>路线对比</h3>`;
                
                if (comp.optimizedDistance !== null) {
                    html += `<p><strong>推荐路线距离:</strong> ${Utils.formatDistance(comp.optimizedDistance)}</p>`;
                }
                
                if (comp.manualDistance !== null) {
                    html += `<p><strong>手动路线距离:</strong> ${Utils.formatDistance(comp.manualDistance)}</p>`;
                }
                
                if (comp.difference !== null) {
                    const sign = comp.difference > 0 ? '+' : '';
                    const percentStr = comp.differencePercent !== null ? ` (${sign}${comp.differencePercent.toFixed(1)}%)` : '';
                    html += `<p><strong>路线差异:</strong> ${sign}${Utils.formatDistance(comp.difference)}${percentStr}</p>`;
                    
                    if (comp.difference > 0) {
                        html += `
    <div class="info">
        💡 建议: 推荐路线比手动路线短 ${Utils.formatDistance(comp.difference)}，建议采用推荐路线。
    </div>`;
                    } else if (comp.difference < 0) {
                        html += `
    <div class="warning">
        💡 注意: 手动路线比推荐路线短，这可能意味着推荐算法有优化空间。
    </div>`;
                    }
                }
            }
            
            if (report.picking.items.length > 0) {
                html += `
    <h3>拣货明细</h3>
    <table>
        <tr><th>订单号</th><th>SKU</th><th>数量</th><th>货架位</th><th>状态</th></tr>`;
                
                report.picking.items.forEach(item => {
                    const status = item.isValid ? '✅ 有效' : '❌ 无效';
                    html += `
        <tr><td>${item.orderNo}</td><td>${item.sku}</td><td>${item.quantity}</td><td>${item.shelfSlot}</td><td>${status}</td></tr>`;
                });
                html += `
    </table>`;
            }
        }
        
        html += `
    <hr>
    <div class="footer">
        报告由 3D 仓库拣货路线规划工具自动生成
    </div>
</body>
</html>`;
        
        return html;
    },
    
    downloadReport(warehouse, pickingOrder, format = 'markdown') {
        const report = this.generateReport(warehouse, pickingOrder);
        let content, filename, mimeType;
        
        if (format === 'html') {
            content = this.toHTML(report);
            filename = `warehouse-report-${Date.now()}.html`;
            mimeType = 'text/html';
        } else {
            content = this.toMarkdown(report);
            filename = `warehouse-report-${Date.now()}.md`;
            mimeType = 'text/markdown';
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        return { content, filename, format };
    }
};
