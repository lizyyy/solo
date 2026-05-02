/**
 * 判定规则模块
 * 负责判定拥堵、逆行、超时和未救援等问题
 */

export const IssueType = {
    CONGESTION: 'congestion',
    STAIR_CONGESTION: 'stair_congestion',
    RETROGRADE: 'retrograde',
    TIMEOUT: 'timeout',
    UNRESCUED: 'unrescued',
    SMOKE_DEATH: 'smoke_death',
    SMOKE_ROUTE: 'smoke_route',
    INVALID_BLOCK: 'invalid_block',
    MISSING_ASSEMBLY: 'missing_assembly',
    NOT_ALL_ESCAPED: 'not_all_escaped'
};

export const Severity = {
    CRITICAL: 'critical',
    ERROR: 'error',
    WARNING: 'warning',
    SUCCESS: 'success'
};

export class RuleEngine {
    constructor(level) {
        this.level = level;
        this.issues = [];
    }

    validate(peopleSimulation, smokeSimulation, simulationResult, placedItems, simulationTime) {
        this.issues = [];
        
        this.checkNotAllEscaped(simulationResult);
        this.checkTimeout(simulationTime);
        this.checkUnrescued(simulationResult);
        this.checkSmokeDeath(simulationResult);
        this.checkCongestion(simulationResult);
        this.checkStairCongestion(simulationResult);
        this.checkSmokeRoutes(simulationResult, smokeSimulation);
        this.checkAssemblyPoints(placedItems);
        this.checkInvalidBlocks(placedItems);
        this.checkRetrograde(simulationResult, placedItems);
        
        return this.issues;
    }

    checkNotAllEscaped(result) {
        const totalPeople = this.level.people.length;
        const escaped = result.people.filter(p => p.escaped).length;
        const dead = result.people.filter(p => p.dead).length;
        
        if (escaped + dead < totalPeople) {
            const trapped = totalPeople - escaped - dead;
            this.addIssue({
                type: IssueType.NOT_ALL_ESCAPED,
                severity: Severity.CRITICAL,
                icon: '🚨',
                title: '存在被困人员',
                description: `有 ${trapped} 人未能成功疏散，也未在烟雾中死亡。他们可能被困在某个区域或路径规划有误。`,
                scorePenalty: trapped * 15
            });
        }
    }

    checkTimeout(simulationTime) {
        const timeLimit = this.level.timeLimit;
        
        if (simulationTime > timeLimit) {
            const overtime = simulationTime - timeLimit;
            this.addIssue({
                type: IssueType.TIMEOUT,
                severity: Severity.ERROR,
                icon: '⏰',
                title: '疏散超时',
                description: `疏散时间超过限制 ${Math.round(timeLimit)} 秒，实际用时 ${Math.round(simulationTime)} 秒。超时 ${Math.round(overtime)} 秒。`,
                scorePenalty: Math.min(overtime * 0.5, 20)
            });
        }
    }

    checkUnrescued(result) {
        const disabledPeople = this.level.people.filter(p => p.type === 'disabled');
        const unrescued = disabledPeople.filter(p => !p.escaped && !p.dead);
        const deadDisabled = disabledPeople.filter(p => p.dead);
        
        if (unrescued.length > 0) {
            this.addIssue({
                type: IssueType.UNRESCUED,
                severity: Severity.CRITICAL,
                icon: '♿',
                title: '行动不便人员未救援',
                description: `${unrescued.length} 名行动不便人员未能成功疏散或被救援。他们需要附近正常人员的协助才能移动。`,
                scorePenalty: unrescued.length * 25
            });
        }
        
        if (deadDisabled.length > 0) {
            this.addIssue({
                type: IssueType.SMOKE_DEATH,
                severity: Severity.CRITICAL,
                icon: '💀',
                title: '行动不便人员在烟雾中死亡',
                description: `${deadDisabled.length} 名行动不便人员在烟雾中死亡。他们可能因为未能及时被救援而无法及时逃离危险区域。`,
                scorePenalty: deadDisabled.length * 30
            });
        }
    }

    checkSmokeDeath(result) {
        const deaths = result.people.filter(p => p.dead);
        
        if (deaths.length > 0) {
            const normalDeaths = deaths.filter(p => p.type === 'normal');
            
            if (normalDeaths.length > 0) {
                this.addIssue({
                    type: IssueType.SMOKE_DEATH,
                    severity: Severity.CRITICAL,
                    icon: '💀',
                    title: '人员在烟雾中死亡',
                    description: `${normalDeaths.length} 名正常人员在烟雾中死亡。路线规划可能导致他们进入了烟雾区域，或者疏散速度不够快。`,
                    scorePenalty: normalDeaths.length * 20
                });
            }
        }
    }

    checkCongestion(result) {
        if (result.congestionPoints && result.congestionPoints.length > 0) {
            result.congestionPoints.forEach(point => {
                this.addIssue({
                    type: IssueType.CONGESTION,
                    severity: point.count >= 5 ? Severity.ERROR : Severity.WARNING,
                    icon: '👥',
                    title: '区域拥堵',
                    description: `位置 (${point.x}, ${point.y}) 发生拥堵，有 ${point.count} 人同时在此区域聚集。这可能导致疏散速度降低。`,
                    scorePenalty: point.count * 2
                });
            });
        }
    }

    checkStairCongestion(result) {
        if (result.stairCongestion && result.stairCongestion.length > 0) {
            result.stairCongestion.forEach(point => {
                this.addIssue({
                    type: IssueType.STAIR_CONGESTION,
                    severity: Severity.CRITICAL,
                    icon: '🪜',
                    title: '楼梯口拥堵',
                    description: `楼梯位置 (${point.x}, ${point.y}) 严重拥堵！容量为 ${point.capacity} 人，实际有 ${point.count} 人。这是严重的安全隐患。`,
                    scorePenalty: (point.count - point.capacity) * 10
                });
            });
        }
    }

    checkSmokeRoutes(result, smokeSimulation) {
        if (!smokeSimulation || !smokeSimulation.smokeState) return;
        
        const smokeState = smokeSimulation.smokeState;
        
        result.people.forEach(person => {
            if (person.path) {
                const enteredSmoke = person.path.some(point => {
                    const key = `${point.x},${point.y}`;
                    return smokeState[key] && smokeState[key] > 0.3;
                });
                
                if (enteredSmoke && !person.dead) {
                    this.addIssue({
                        type: IssueType.SMOKE_ROUTE,
                        severity: Severity.WARNING,
                        icon: '💨',
                        title: '路线经过烟雾区',
                        description: `人员 ${person.id} 的疏散路线经过了烟雾区域。虽然他们成功逃生，但这是不安全的做法。`,
                        scorePenalty: 5
                    });
                }
            }
        });
    }

    checkAssemblyPoints(placedItems) {
        const assemblyPoints = placedItems.filter(item => item.type === 'assembly');
        const required = this.level.requiredAssemblyPoints || 1;
        
        if (assemblyPoints.length < required) {
            this.addIssue({
                type: IssueType.MISSING_ASSEMBLY,
                severity: Severity.WARNING,
                icon: '🏁',
                title: '集合点不足',
                description: `需要设置 ${required} 个集合点，当前只设置了 ${assemblyPoints.length} 个。集合点用于疏散后人员清点。`,
                scorePenalty: (required - assemblyPoints.length) * 10
            });
        }
    }

    checkInvalidBlocks(placedItems) {
        const blocks = placedItems.filter(item => item.type === 'block');
        
        blocks.forEach(block => {
            const isDoor = this.level.grid[block.y]?.[block.x] === 2;
            
            if (!isDoor) {
                this.addIssue({
                    type: IssueType.INVALID_BLOCK,
                    severity: Severity.WARNING,
                    icon: '🚫',
                    title: '无效封堵',
                    description: `位置 (${block.x}, ${block.y}) 的封堵不是门。封堵应该只用于危险门。`,
                    scorePenalty: 5
                });
            }
        });
        
        const maxBlocks = this.level.maxBlocks || 0;
        if (blocks.length > maxBlocks) {
            this.addIssue({
                type: IssueType.INVALID_BLOCK,
                severity: Severity.ERROR,
                icon: '🚫',
                title: '封堵数量过多',
                description: `最多允许 ${maxBlocks} 个封堵，当前使用了 ${blocks.length} 个。`,
                scorePenalty: (blocks.length - maxBlocks) * 8
            });
        }
    }

    checkRetrograde(result, placedItems) {
        const arrows = placedItems.filter(item => item.type === 'arrow');
        
        for (const arrow of arrows) {
            const neighbors = arrows.filter(a => 
                Math.abs(a.x - arrow.x) <= 1 && 
                Math.abs(a.y - arrow.y) <= 1 && 
                a !== arrow
            );
            
            for (const neighbor of neighbors) {
                const isOpposite = this.areDirectionsOpposite(arrow.direction, neighbor.direction);
                const isPointingToEachOther = this.arePointingToEachOther(arrow, neighbor);
                
                if (isOpposite && isPointingToEachOther) {
                    this.addIssue({
                        type: IssueType.RETROGRADE,
                        severity: Severity.WARNING,
                        icon: '↔️',
                        title: '发现逆行箭头',
                        description: `位置 (${arrow.x}, ${arrow.y}) 和 (${neighbor.x}, ${neighbor.y}) 的箭头方向相反且指向对方。这可能导致人员混乱和逆行。`,
                        scorePenalty: 8
                    });
                }
            }
        }
    }

    areDirectionsOpposite(dir1, dir2) {
        return (dir1 + 2) % 4 === dir2;
    }

    arePointingToEachOther(arrow1, arrow2) {
        const dx = arrow2.x - arrow1.x;
        const dy = arrow2.y - arrow1.y;
        
        const dirs = [
            { dx: 0, dy: -1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }
        ];
        
        const dir1 = dirs[arrow1.direction];
        const dir2 = dirs[arrow2.direction];
        
        const pointingToward = (dir1.dx * dx + dir1.dy * dy) > 0;
        const pointingToward2 = (dir2.dx * (-dx) + dir2.dy * (-dy)) > 0;
        
        return pointingToward && pointingToward2;
    }

    addIssue(issue) {
        this.issues.push({
            ...issue,
            id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
    }

    calculateScore(issues, maxScore = 100) {
        let totalPenalty = 0;
        
        issues.forEach(issue => {
            totalPenalty += issue.scorePenalty || 0;
        });
        
        const score = Math.max(0, maxScore - totalPenalty);
        
        let grade = 'F';
        if (score >= 95) grade = 'S';
        else if (score >= 85) grade = 'A';
        else if (score >= 70) grade = 'B';
        else if (score >= 50) grade = 'C';
        else if (score >= 30) grade = 'D';
        
        return {
            score: Math.round(score),
            grade,
            totalPenalty
        };
    }

    getDetailedResults(issues, scoreResult) {
        const critical = issues.filter(i => i.severity === Severity.CRITICAL);
        const errors = issues.filter(i => i.severity === Severity.ERROR);
        const warnings = issues.filter(i => i.severity === Severity.WARNING);
        
        return {
            score: scoreResult.score,
            grade: scoreResult.grade,
            issues: issues,
            summary: {
                critical: critical.length,
                error: errors.length,
                warning: warnings.length
            },
            hasCritical: critical.length > 0,
            hasErrors: errors.length > 0,
            hasWarnings: warnings.length > 0
        };
    }
}
