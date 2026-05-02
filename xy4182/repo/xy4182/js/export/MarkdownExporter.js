/**
 * Markdown复盘导出器
 * 将游戏过程导出为详细的Markdown复盘文档
 */

class MarkdownExporter {
    constructor(engine, level, replaySystem) {
        this.engine = engine;
        this.level = level;
        this.replaySystem = replaySystem;
    }

    generateReview() {
        const level = this.level || this.engine.level;
        const state = this.engine.getGameState();
        const incidents = this.engine.incidents;
        const ships = this.engine.ships;
        
        let md = '';
        
        md += this.generateHeader(level, state);
        md += '\n';
        
        md += this.generateLevelOverview(level);
        md += '\n';
        
        md += this.generateGameResult(state);
        md += '\n';
        
        md += this.generateShipStatus(ships);
        md += '\n';
        
        md += this.generateIncidentReport(incidents);
        md += '\n';
        
        md += this.generateRuleViolations(incidents);
        md += '\n';
        
        md += this.generateSummary(state, incidents);
        md += '\n';
        
        md += this.generateTips(incidents, ships);
        md += '\n';
        
        md += this.generateAppendix(level, state);
        
        return md;
    }

    generateHeader(level, state) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('zh-CN');
        const timeStr = now.toLocaleTimeString('zh-CN');
        
        return `# 窄水道避碰演练复盘报告

**训练日期**: ${dateStr} ${timeStr}  
**关卡名称**: ${level?.name || '未命名关卡'}  
**难度等级**: ${this.getDifficultyText(level?.difficulty)}  

---
`;
    }

    getDifficultyText(difficulty) {
        switch (difficulty) {
            case 'easy': return '简单';
            case 'medium': return '中等';
            case 'hard': return '困难';
            default: return '自定义';
        }
    }

    generateLevelOverview(level) {
        if (!level) return '## 关卡信息\n\n无关卡数据\n';
        
        const ships = level.ships || [];
        const controllable = ships.filter(s => s.mode === MovementMode.PLAYER_CONTROLLED);
        const aiControlled = ships.filter(s => s.mode !== MovementMode.PLAYER_CONTROLLED);
        
        const berths = level.boardData?.berths || [];
        const currents = level.boardData?.currents || [];
        
        return `## 关卡概览

### 目标说明
${level.description || '将所有可控船舶安全带到指定泊位。'}

### 船舶配置
| 类型 | 数量 | 说明 |
|------|------|------|
| 可控船舶 | ${controllable.length} | 玩家可控制操作 |
| 来船/AI船 | ${aiControlled.length} | 预设航线或AI控制 |

### 环境要素
| 要素 | 数量 |
|------|------|
| 泊位 | ${berths.length} |
| 潮流区域 | ${currents.length} |

`;
    }

    generateGameResult(state) {
        const result = state.winner === 'success' ? '成功' : 
                       state.winner === 'timeout' ? '超时' : '进行中';
        
        return `## 演练结果

| 项目 | 数值 |
|------|------|
| 完成状态 | ${result} |
| 使用回合 | ${state.turn - 1} / ${this.engine.totalTurns} |
| 总扣分数 | ${state.penaltyPoints} 分 |

> 评分标准：扣分越少越好，零扣分为满分操作。

`;
    }

    generateShipStatus(ships) {
        if (!ships || ships.length === 0) return '## 船舶状态\n\n无船舶数据\n';
        
        let md = '## 船舶最终状态\n\n';
        md += '| 船舶名称 | 类型 | 最终位置 | 最终状态 |\n';
        md += '|----------|------|----------|----------|\n';
        
        for (const ship of ships) {
            const type = this.getShipTypeText(ship.type);
            const state = this.getShipStateText(ship.state);
            const pos = `(${ship.x}, ${ship.y})`;
            
            md += `| ${ship.name} | ${type} | ${pos} | ${state} |\n`;
        }
        
        md += '\n';
        
        const arrived = ships.filter(s => s.state === ShipState.ARRIVED);
        const active = ships.filter(s => s.state === ShipState.ACTIVE);
        
        if (arrived.length > 0) {
            md += `### 已靠泊船舶 (${arrived.length}艘)\n\n`;
            for (const ship of arrived) {
                md += `- **${ship.name}**: 于第 ${ship.arrivedAt} 回合抵达泊位\n`;
            }
            md += '\n';
        }
        
        if (active.length > 0) {
            md += `### 仍在航行船舶 (${active.length}艘)\n\n`;
            for (const ship of active) {
                if (ship.isControllable()) {
                    md += `- **${ship.name}**: 未完成任务\n`;
                }
            }
            md += '\n';
        }
        
        return md;
    }

    getShipTypeText(type) {
        switch (type) {
            case ShipType.TUG: return '拖轮';
            case ShipType.CARGO: return '货船';
            case ShipType.OTHER: return '来船';
            default: return '未知';
        }
    }

    getShipStateText(state) {
        switch (state) {
            case ShipState.ACTIVE: return '航行中';
            case ShipState.ARRIVED: return '已抵达';
            case ShipState.DAMAGED: return '受损';
            case ShipState.SUNK: return '沉没';
            default: return '未知';
        }
    }

    generateIncidentReport(incidents) {
        if (!incidents || incidents.length === 0) {
            return `## 事故与违规记录

**无任何事故或违规记录！** 这是完美的操作表现！

> 继续保持良好的航行习惯和规则意识。

`;
        }
        
        const collisionCount = incidents.filter(i => i.type === IncidentType.COLLISION).length;
        const shallowCount = incidents.filter(i => i.type === IncidentType.SHALLOW).length;
        const giveWayCount = incidents.filter(i => i.type === IncidentType.GIVE_WAY).length;
        const speedCount = incidents.filter(i => i.type === IncidentType.SPEED).length;
        const boundaryCount = incidents.filter(i => i.type === IncidentType.BOUNDARY).length;
        
        let md = `## 事故与违规记录

### 违规统计
| 违规类型 | 次数 | 单次扣分 | 累计扣分 |
|----------|------|----------|----------|
| 碰撞事故 | ${collisionCount} | 10分 | ${collisionCount * 10}分 |
| 让路违规 | ${giveWayCount} | 3分 | ${giveWayCount * 3}分 |
| 浅滩驶入 | ${shallowCount} | 5分 | ${shallowCount * 5}分 |
| 越界违规 | ${boundaryCount} | 5分 | ${boundaryCount * 5}分 |
| 超速违规 | ${speedCount} | 2分 | ${speedCount * 2}分 |

`;

        md += '### 详细违规记录\n\n';
        
        for (const incident of incidents) {
            const typeText = this.getIncidentTypeText(incident.type);
            md += `**回合 ${incident.turn} - ${typeText}**\n\n`;
            md += `- 描述: ${incident.description}\n`;
            md += `- 扣分数: ${incident.points}分\n`;
            
            if (incident.details) {
                md += `- 详细信息:\n`;
                const details = incident.details;
                if (details.encounterType) {
                    md += `  - 遭遇类型: ${this.getEncounterTypeText(details.encounterType)}\n`;
                }
                if (details.giveWayShip) {
                    md += `  - 让路船: ${details.giveWayShip}\n`;
                }
                if (details.standOnShip) {
                    md += `  - 直航船: ${details.standOnShip}\n`;
                }
            }
            
            md += '\n';
        }
        
        return md;
    }

    getIncidentTypeText(type) {
        switch (type) {
            case IncidentType.COLLISION: return '碰撞事故';
            case IncidentType.SHALLOW: return '浅滩驶入';
            case IncidentType.SPEED: return '超速违规';
            case IncidentType.GIVE_WAY: return '让路违规';
            case IncidentType.BOUNDARY: return '越界违规';
            default: return '未知违规';
        }
    }

    getEncounterTypeText(type) {
        switch (type) {
            case EncounterType.HEAD_ON: return '对遇';
            case EncounterType.CROSSING: return '交叉相遇';
            case EncounterType.OVERTAKING: return '追越';
            default: return '未知';
        }
    }

    generateRuleViolations(incidents) {
        const giveWayViolations = incidents.filter(i => i.type === IncidentType.GIVE_WAY);
        const collisionViolations = incidents.filter(i => i.type === IncidentType.COLLISION);
        
        if (giveWayViolations.length === 0 && collisionViolations.length === 0) {
            return '## 会遇规则分析\n\n无会遇规则相关的违规记录。\n';
        }
        
        let md = '## 会遇规则分析\n\n';
        
        if (giveWayViolations.length > 0) {
            md += `### 让路违规分析 (${giveWayViolations.length}次)\n\n`;
            
            const groupedByType = {};
            for (const v of giveWayViolations) {
                const type = v.details?.encounterType || 'unknown';
                if (!groupedByType[type]) groupedByType[type] = [];
                groupedByType[type].push(v);
            }
            
            for (const [type, violations] of Object.entries(groupedByType)) {
                const typeText = this.getEncounterTypeText(type);
                md += `#### ${typeText}让路违规\n\n`;
                md += `共 ${violations.length} 次违规\n\n`;
                
                for (const v of violations) {
                    md += `- **回合 ${v.turn}**: ${v.description}\n`;
                }
                
                md += '\n';
                md += `**规则提示**: ${this.getRuleDescription(type)}\n\n`;
            }
        }
        
        if (collisionViolations.length > 0) {
            md += `### 碰撞事故分析 (${collisionViolations.length}次)\n\n`;
            
            for (const collision of collisionViolations) {
                md += `- **回合 ${collision.turn}**: ${collision.description}\n`;
            }
            
            md += '\n';
            md += `**防碰撞建议**:\n`;
            md += `- 保持安全距离，确保留有足够的避让空间\n`;
            md += `- 提前观察周围船舶动态，预判可能的会遇局面\n`;
            md += `- 严格遵守让路义务，不要抢行\n`;
            md += '\n';
        }
        
        return md;
    }

    getRuleDescription(encounterType) {
        switch (encounterType) {
            case EncounterType.HEAD_ON:
                return '对遇规则：两船对遇时，应各自向右转向，从他船左舷驶过。确保右侧通行。';
            
            case EncounterType.CROSSING:
                return '交叉相遇规则：有他船在本船右舷的船舶应给他船让路。如当时环境许可，还应避免横越他船的前方。记住：让右方来船！';
            
            case EncounterType.OVERTAKING:
                return '追越规则：任何船舶，在追越任何他船时，均应给被追越船让路。被追越船为直航船。';
            
            default:
                return '请认真学习《国际海上避碰规则》。';
        }
    }

    generateSummary(state, incidents) {
        const totalPoints = state.penaltyPoints;
        const turnsUsed = state.turn - 1;
        
        let rating, ratingText;
        if (totalPoints === 0) {
            rating = '★★★★★';
            ratingText = '完美操作';
        } else if (totalPoints <= 5) {
            rating = '★★★★☆';
            ratingText = '优秀';
        } else if (totalPoints <= 10) {
            rating = '★★★☆☆';
            ratingText = '良好';
        } else if (totalPoints <= 20) {
            rating = '★★☆☆☆';
            ratingText = '合格';
        } else {
            rating = '★☆☆☆☆';
            ratingText = '需要加强练习';
        }
        
        return `## 总结

### 综合评分
**${rating} ${ratingText}**

| 指标 | 评价 |
|------|------|
| 扣分情况 | ${totalPoints === 0 ? '零扣分，完美' : 
              totalPoints <= 5 ? '扣分较少，表现优秀' :
              totalPoints <= 10 ? '扣分适中，表现良好' : '扣分较多，需改进'} |
| 回合使用 | ${turnsUsed} 回合 |

### 主要问题
${incidents.length === 0 ? 
  '无明显问题，继续保持！' : 
  this.listMainIssues(incidents)}

`;
    }

    listMainIssues(incidents) {
        const issues = [];
        
        const collisionCount = incidents.filter(i => i.type === IncidentType.COLLISION).length;
        const giveWayCount = incidents.filter(i => i.type === IncidentType.GIVE_WAY).length;
        const shallowCount = incidents.filter(i => i.type === IncidentType.SHALLOW).length;
        
        if (collisionCount > 0) issues.push(`- 发生了 ${collisionCount} 次碰撞，安全距离意识不足`);
        if (giveWayCount > 0) issues.push(`- 有 ${giveWayCount} 次让路违规，需加强避碰规则学习`);
        if (shallowCount > 0) issues.push(`- 驶入浅滩 ${shallowCount} 次，环境观察不够`);
        
        return issues.length > 0 ? issues.join('\n') : '- 整体操作较好';
    }

    generateTips(incidents, ships) {
        const tips = [];
        
        const giveWayCount = incidents.filter(i => i.type === IncidentType.GIVE_WAY).length;
        if (giveWayCount > 0) {
            tips.push('### 避碰规则建议');
            tips.push('- **交叉相遇**: 牢记"让右方来船"原则。当有船舶在你右舷时，你是让路船。');
            tips.push('- **对遇**: 两船对遇时，各自向右转向，从他船左舷驶过。');
            tips.push('- **追越**: 追越船始终是让路船，要给被追越船足够的空间。');
            tips.push('');
        }
        
        const shallowCount = incidents.filter(i => i.type === IncidentType.SHALLOW).length;
        if (shallowCount > 0) {
            tips.push('### 航道观察建议');
            tips.push('- 浅滩区域显示为黄色，禁止驶入。');
            tips.push('- 限速区显示为灰色，最高只能移动1格。');
            tips.push('- 泊位显示为绿色，是目标停靠区域。');
            tips.push('');
        }
        
        const currentArea = ships.some(s => {
            const effect = this.engine.board?.getCurrentEffect?.(s.x, s.y);
            return effect && (effect.dx !== 0 || effect.dy !== 0);
        });
        
        if (currentArea || (this.engine.board?.currents?.length > 0)) {
            tips.push('### 潮流影响建议');
            tips.push('- 潮流会自动推动船舶，规划移动时要考虑潮流叠加。');
            tips.push('- 橙色箭头表示潮流方向，进入潮流区前要预判影响。');
            tips.push('- 靠近泊位时，提前减速以抵消潮流影响。');
            tips.push('');
        }
        
        if (tips.length === 0) {
            tips.push('### 保持优秀表现！');
            tips.push('- 您的操作表现优秀，请继续保持良好的航行习惯。');
            tips.push('- 可以尝试更高难度的关卡挑战自己。');
            tips.push('');
        }
        
        return `## 训练建议\n\n${tips.join('\n')}`;
    }

    generateAppendix(level, state) {
        let md = '---\n\n';
        md += '## 附录\n\n';
        
        md += '### 扣分标准\n';
        md += '| 违规类型 | 扣分数 |\n';
        md += '|----------|--------|\n';
        md += '| 碰撞事故 | 10分 |\n';
        md += '| 浅滩驶入 | 5分 |\n';
        md += '| 越界违规 | 5分 |\n';
        md += '| 让路违规 | 3分 |\n';
        md += '| 超速违规 | 2分 |\n';
        md += '\n';
        
        md += '### 避碰规则速览\n';
        md += '- **交叉相遇**: 让右方来船\n';
        md += '- **对遇**: 各自向右转向\n';
        md += '- **追越**: 追越船让路\n';
        md += '\n';
        
        md += '---\n\n';
        md += `*此复盘报告由窄水道避碰演练系统生成 ${new Date().toLocaleString('zh-CN')}*\n`;
        
        return md;
    }

    exportToFile(filename = 'review.md') {
        const md = this.generateReview();
        
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        return md;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MarkdownExporter };
}
