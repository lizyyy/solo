export class StorageManager {
    constructor() {
        this.STORAGE_KEY = 'pipeline_inspection_schemes';
    }
    
    saveScheme(name, pointData, routeData, analysisData = null) {
        const schemes = this.loadAllSchemes();
        
        const scheme = {
            id: Date.now(),
            name,
            createdAt: new Date().toISOString(),
            points: pointData,
            route: routeData,
            analysis: analysisData
        };
        
        schemes.push(scheme);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(schemes));
        
        return scheme;
    }
    
    loadAllSchemes() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load schemes:', e);
            return [];
        }
    }
    
    loadScheme(id) {
        const schemes = this.loadAllSchemes();
        return schemes.find(s => s.id === id) || null;
    }
    
    deleteScheme(id) {
        const schemes = this.loadAllSchemes();
        const filtered = schemes.filter(s => s.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
        return filtered.length !== schemes.length;
    }
    
    updateScheme(id, updates) {
        const schemes = this.loadAllSchemes();
        const index = schemes.findIndex(s => s.id === id);
        
        if (index !== -1) {
            schemes[index] = {
                ...schemes[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(schemes));
            return schemes[index];
        }
        
        return null;
    }
    
    exportReport(analysisData, pointData, routeData) {
        const date = new Date();
        const dateStr = date.toLocaleString('zh-CN');
        
        let report = `
================================================================================
                    地下管线巡检路线分析报告
================================================================================

生成时间: ${dateStr}

================================================================================
一、基本信息
================================================================================

总点位数量: ${pointData.points.length}
路线长度: ${routeData.totalDistance.toFixed(2)} 米
路线经过点位: ${routeData.pointIds.length}

================================================================================
二、管线点坐标信息
================================================================================

序号    名称       X坐标      Y坐标      Z坐标      状态      标记
--------------------------------------------------------------------------------
`;
        
        pointData.points.forEach((point, index) => {
            const state = point.isVisited ? '已巡检' : '未巡检';
            const marked = point.isMarked ? '异常' : '正常';
            report += `${String(index + 1).padEnd(6)}  ${point.name.padEnd(10)} `;
            report += `${point.x.toFixed(2).padStart(8)}  ${point.y.toFixed(2).padStart(8)}  ${point.z.toFixed(2).padStart(8)}  `;
            report += `${state.padEnd(6)}  ${marked.padEnd(6)}\n`;
        });
        
        report += `
================================================================================
三、巡检路线
================================================================================

路线顺序: ${routeData.pointIds.map(id => {
    const point = pointData.points.find(p => p.id === id);
    return point ? point.name : `P${id}`;
}).join(' -> ')}

总长度: ${routeData.totalDistance.toFixed(2)} 米

================================================================================
四、分析结果
================================================================================
`;
        
        if (analysisData) {
            report += `
总体评估: ${analysisData.valid ? '合格' : '不合格'}
发现问题数: ${analysisData.totalIssues}

--------------------------------------------------------------------------------
4.1 边界校验结果
--------------------------------------------------------------------------------
`;
            if (analysisData.boundary.valid) {
                report += '✓ 所有路线段均在边界范围内\n';
            } else {
                report += `✗ 发现 ${analysisData.boundary.violationCount} 处边界违规:\n`;
                analysisData.boundary.violations.forEach((v, i) => {
                    report += `   ${i + 1}. 路段 ${v.segment} 超出边界\n`;
                    report += `      位置: (${v.position.x.toFixed(2)}, ${v.position.y.toFixed(2)}, ${v.position.z.toFixed(2)})\n`;
                });
            }
            
            report += `
--------------------------------------------------------------------------------
4.2 点位距离校验结果
--------------------------------------------------------------------------------
`;
            if (analysisData.pointCollisions.valid) {
                report += '✓ 所有点位间距符合要求\n';
            } else {
                report += `✗ 发现 ${analysisData.pointCollisions.collisionCount} 处点位过近:\n`;
                analysisData.pointCollisions.collisions.forEach((c, i) => {
                    report += `   ${i + 1}. ${c.point1.name} 与 ${c.point2.name} 距离 ${c.distance.toFixed(2)} 米\n`;
                    report += `      最小允许距离: ${c.minDistance} 米\n`;
                });
            }
            
            report += `
--------------------------------------------------------------------------------
4.3 路线与点位碰撞检测
--------------------------------------------------------------------------------
`;
            if (analysisData.routeCollisions.valid) {
                report += '✓ 路线与非途经点位保持安全距离\n';
            } else {
                report += `✗ 发现 ${analysisData.routeCollisions.collisionCount} 处路线过近问题:\n`;
                analysisData.routeCollisions.collisions.forEach((c, i) => {
                    report += `   ${i + 1}. 路段 ${c.segment} 距 ${c.point.name} 仅 ${c.distance.toFixed(2)} 米\n`;
                    report += `      最小安全距离: ${c.minDistance} 米\n`;
                });
            }
            
            report += `
--------------------------------------------------------------------------------
4.4 覆盖分析结果
--------------------------------------------------------------------------------
`;
            report += `总点位: ${analysisData.coverage.totalPoints}\n`;
            report += `已覆盖: ${analysisData.coverage.visitedCount}\n`;
            report += `覆盖率: ${analysisData.coverage.coverageRate}%\n`;
            
            if (analysisData.coverage.unvisitedCount > 0) {
                report += `\n✗ 漏检点位 (${analysisData.coverage.unvisitedCount} 个):\n`;
                analysisData.coverage.unvisitedPoints.forEach((p, i) => {
                    report += `   ${i + 1}. ${p.name} (${p.position.x.toFixed(1)}, ${p.position.y.toFixed(1)}, ${p.position.z.toFixed(1)})\n`;
                });
            } else {
                report += '\n✓ 所有点位均已覆盖\n';
            }
            
        } else {
            report += '暂无分析数据，请先运行分析。\n';
        }
        
        report += `
================================================================================
                              报告结束
================================================================================
`;
        
        return report;
    }
    
    downloadReport(filename, content) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    exportJSON(data, filename) {
        const content = JSON.stringify(data, null, 2);
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
}