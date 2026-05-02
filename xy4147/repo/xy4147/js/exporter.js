/**
 * Markdown导出模块
 * 负责导出复盘报告
 */

import { Direction } from './levels.js';
import { Severity } from './rules.js';

export class MarkdownExporter {
    constructor() {
        this.report = [];
    }

    generateReport(level, simulationResult, result, placedItems, simulationTime) {
        this.report = [];
        
        this.addHeader(level);
        this.addSummary(simulationResult, result, simulationTime, level);
        this.addIssues(result);
        this.addLayoutInfo(level, placedItems);
        this.addRecommendations(result);
        this.addFooter();
        
        return this.report.join('\n');
    }

    addHeader(level) {
        const difficultyLabels = {
            'easy': '初级',
            'medium': '中级', 
            'hard': '高级'
        };
        
        this.report.push(`# 烟雾逃生路线演练复盘报告\n`);
        this.report.push(`## 关卡信息\n`);
        this.report.push(`| 项目 | 内容 |`);
        this.report.push(`|------|------|`);
        this.report.push(`| 关卡名称 | ${level.title} |`);
        this.report.push(`| 难度等级 | ${difficultyLabels[level.difficulty] || level.difficulty} |`);
        this.report.push(`| 时间限制 | ${level.timeLimit} 秒 |`);
        this.report.push(`| 总人数 | ${level.people.length} 人 |`);
        this.report.push(`| 行动不便人员 | ${level.people.filter(p => p.type === 'disabled').length} 人 |`);
        this.report.push(`| 出口数量 | ${level.exits.length} 个 |`);
        this.report.push(`| 楼梯数量 | ${level.stairs.length} 个 |`);
        this.report.push(`| 烟雾源 | ${level.smokeSources.length} 处 |`);
        this.report.push(``);
    }

    addSummary(simulationResult, result, simulationTime, level) {
        this.report.push(`## 模拟结果摘要\n`);
        
        const escaped = simulationResult.people.filter(p => p.escaped).length;
        const dead = simulationResult.people.filter(p => p.dead).length;
        const trapped = level.people.length - escaped - dead;
        const disabledTotal = level.people.filter(p => p.type === 'disabled').length;
        const disabledEscaped = simulationResult.people.filter(p => p.type === 'disabled' && p.escaped).length;
        
        this.report.push(`### 疏散统计\n`);
        this.report.push(`- **疏散成功**: ${escaped} 人`);
        this.report.push(`- **在烟雾中死亡**: ${dead} 人`);
        this.report.push(`- **被困/未疏散**: ${trapped} 人`);
        this.report.push(`- **行动不便人员救援率**: ${disabledEscaped}/${disabledTotal} (${Math.round(disabledEscaped/disabledTotal*100)}%)`);
        this.report.push(`- **模拟用时**: ${Math.round(simulationTime)} 秒`);
        this.report.push(`- **时间限制**: ${level.timeLimit} 秒`);
        this.report.push(``);
        
        this.report.push(`### 评分结果\n`);
        this.report.push(`- **总分**: ${result.score} 分`);
        this.report.push(`- **评级**: ${this.getGradeDisplay(result.grade)}`);
        this.report.push(``);
        
        this.report.push(`### 问题统计\n`);
        const critical = result.issues.filter(i => i.severity === Severity.CRITICAL).length;
        const error = result.issues.filter(i => i.severity === Severity.ERROR).length;
        const warning = result.issues.filter(i => i.severity === Severity.WARNING).length;
        
        this.report.push(`| 严重程度 | 数量 |`);
        this.report.push(`|----------|------|`);
        this.report.push(`| 🔴 严重 | ${critical} |`);
        this.report.push(`| 🟠 错误 | ${error} |`);
        this.report.push(`| 🟡 警告 | ${warning} |`);
        this.report.push(``);
    }

    addIssues(result) {
        if (result.issues.length === 0) {
            this.report.push(`## 问题详情\n`);
            this.report.push(`✅ 未发现任何问题，疏散方案完美！\n`);
            return;
        }
        
        this.report.push(`## 问题详情\n`);
        
        const critical = result.issues.filter(i => i.severity === Severity.CRITICAL);
        const error = result.issues.filter(i => i.severity === Severity.ERROR);
        const warning = result.issues.filter(i => i.severity === Severity.WARNING);
        
        if (critical.length > 0) {
            this.report.push(`### 🔴 严重问题\n`);
            critical.forEach((issue, index) => {
                this.report.push(`#### ${index + 1}. ${issue.title}`);
                this.report.push(`> ${issue.description}`);
                this.report.push(`> 扣分: ${issue.scorePenalty} 分\n`);
            });
        }
        
        if (error.length > 0) {
            this.report.push(`### 🟠 错误\n`);
            error.forEach((issue, index) => {
                this.report.push(`#### ${index + 1}. ${issue.title}`);
                this.report.push(`> ${issue.description}`);
                this.report.push(`> 扣分: ${issue.scorePenalty} 分\n`);
            });
        }
        
        if (warning.length > 0) {
            this.report.push(`### 🟡 警告\n`);
            warning.forEach((issue, index) => {
                this.report.push(`#### ${index + 1}. ${issue.title}`);
                this.report.push(`> ${issue.description}`);
                this.report.push(`> 扣分: ${issue.scorePenalty} 分\n`);
            });
        }
    }

    addLayoutInfo(level, placedItems) {
        this.report.push(`## 方案布局\n`);
        
        const arrows = placedItems.filter(i => i.type === 'arrow');
        const blocks = placedItems.filter(i => i.type === 'block');
        const extinguishers = placedItems.filter(i => i.type === 'extinguisher');
        const assemblies = placedItems.filter(i => i.type === 'assembly');
        
        this.report.push(`### 放置物品统计\n`);
        this.report.push(`- **疏散箭头**: ${arrows.length} 个 (上限: ${level.maxArrows})`);
        this.report.push(`- **危险门封堵**: ${blocks.length} 个 (上限: ${level.maxBlocks})`);
        this.report.push(`- **灭火器**: ${extinguishers.length} 个 (上限: ${level.maxExtinguishers})`);
        this.report.push(`- **集合点**: ${assemblies.length} 个 (需要: ${level.requiredAssemblyPoints})\n`);
        
        if (arrows.length > 0) {
            this.report.push(`### 疏散箭头位置\n`);
            this.report.push(`| 位置 | 方向 |`);
            this.report.push(`|------|------|`);
            arrows.forEach(arrow => {
                const dirName = this.getDirectionName(arrow.direction);
                this.report.push(`| (${arrow.x}, ${arrow.y}) | ${dirName} |`);
            });
            this.report.push(``);
        }
        
        if (blocks.length > 0) {
            this.report.push(`### 封堵的门\n`);
            this.report.push(`| 位置 |`);
            this.report.push(`|------|`);
            blocks.forEach(block => {
                this.report.push(`| (${block.x}, ${block.y}) |`);
            });
            this.report.push(``);
        }
        
        if (extinguishers.length > 0) {
            this.report.push(`### 灭火器位置\n`);
            this.report.push(`| 位置 |`);
            this.report.push(`|------|`);
            extinguishers.forEach(ext => {
                this.report.push(`| (${ext.x}, ${ext.y}) |`);
            });
            this.report.push(``);
        }
        
        if (assemblies.length > 0) {
            this.report.push(`### 集合点位置\n`);
            this.report.push(`| 位置 |`);
            this.report.push(`|------|`);
            assemblies.forEach(asm => {
                this.report.push(`| (${asm.x}, ${asm.y}) |`);
            });
            this.report.push(``);
        }
    }

    addRecommendations(result) {
        this.report.push(`## 改进建议\n`);
        
        const critical = result.issues.filter(i => i.severity === Severity.CRITICAL);
        const error = result.issues.filter(i => i.severity === Severity.ERROR);
        
        if (critical.length === 0 && error.length === 0) {
            this.report.push(`✅ 方案表现优秀！以下是一些额外的建议：\n`);
            this.report.push(`1. 考虑增加更多集合点以便疏散后人员清点`);
            this.report.push(`2. 在关键位置增加灭火器以延缓烟雾扩散`);
            this.report.push(`3. 尝试设计多条疏散路线作为备用方案`);
            this.report.push(`4. 定期检查和维护消防设施\n`);
        } else {
            this.report.push(`根据模拟结果，提出以下针对性改进建议：\n`);
            
            let recIndex = 1;
            
            const hasUnrescued = critical.some(i => i.title.includes('未救援') || i.title.includes('行动不便'));
            if (hasUnrescued) {
                this.report.push(`${recIndex}. **行动不便人员救援问题**: `);
                this.report.push(`   确保行动不便人员附近有足够的正常人员可以提供帮助。`);
                this.report.push(`   考虑在行动不便人员起始位置附近设置辅助人员等候点。\n`);
                recIndex++;
            }
            
            const hasStairCongestion = critical.some(i => i.title.includes('楼梯口'));
            if (hasStairCongestion) {
                this.report.push(`${recIndex}. **楼梯口拥堵问题**: `);
                this.report.push(`   重新规划路线，分散人流到不同的楼梯和出口。`);
                this.report.push(`   可以使用箭头引导不同区域的人群使用不同的出口。\n`);
                recIndex++;
            }
            
            const hasSmokeDeath = critical.some(i => i.title.includes('烟雾中死亡'));
            if (hasSmokeDeath) {
                this.report.push(`${recIndex}. **烟雾致死问题**: `);
                this.report.push(`   重新检查路线，确保所有路线都避开烟雾扩散区域。`);
                this.report.push(`   封堵通往烟雾区的危险门，在关键位置放置灭火器。\n`);
                recIndex++;
            }
            
            const hasTimeout = error.some(i => i.title.includes('超时'));
            if (hasTimeout) {
                this.report.push(`${recIndex}. **疏散超时问题**: `);
                this.report.push(`   优化路线，使用更短、更直接的疏散路线。`);
                this.report.push(`   确保所有出口都被充分利用，避免人流集中在少数出口。\n`);
                recIndex++;
            }
            
            const hasTrapped = critical.some(i => i.title.includes('被困'));
            if (hasTrapped) {
                this.report.push(`${recIndex}. **人员被困问题**: `);
                this.report.push(`   检查是否所有房间和区域都有通往出口的有效路线。`);
                this.report.push(`   确保箭头方向正确，没有形成死循环或错误引导。\n`);
                recIndex++;
            }
        }
    }

    addFooter() {
        this.report.push(`---\n`);
        this.report.push(`*报告生成时间: ${new Date().toLocaleString('zh-CN')}*`);
        this.report.push(`*此报告由"烟雾逃生路线演练场"系统自动生成*\n`);
        this.report.push(`\n> 💡 提示: 此复盘报告可用于消防安全培训课堂讨论和方案改进。`);
    }

    getGradeDisplay(grade) {
        const gradeInfo = {
            'S': { emoji: '⭐', desc: '完美' },
            'A': { emoji: '🎯', desc: '优秀' },
            'B': { emoji: '👍', desc: '良好' },
            'C': { emoji: '📝', desc: '及格' },
            'D': { emoji: '⚠️', desc: '需改进' },
            'F': { emoji: '❌', desc: '不及格' }
        };
        const info = gradeInfo[grade] || { emoji: '?', desc: '未知' };
        return `${info.emoji} ${grade} (${info.desc})`;
    }

    getDirectionName(direction) {
        const dirs = ['↑ 上', '→ 右', '↓ 下', '← 左'];
        return dirs[direction] || '未知';
    }

    downloadReport(content, filename = 'evacuation-report.md') {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

export const markdownExporter = new MarkdownExporter();
