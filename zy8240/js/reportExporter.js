const ReportExporter = (function() {
    'use strict';
    
    function generateReport(shelters, evacuees, supplyRules, issues, statistics) {
        const reportDate = new Date().toISOString().split('T')[0];
        const reportTime = new Date().toLocaleTimeString('zh-CN');
        
        let report = `# 社区应急避难点复盘报告

**生成时间**: ${reportDate} ${reportTime}

---

## 一、概览

### 1.1 基本统计

| 指标 | 数值 |
|------|------|
| 避难点数量 | ${statistics.totalShelters} |
| 转移人员总数 | ${statistics.totalEvacuees} |
| 检测到的问题 | ${statistics.totalIssues} |
| 物资缺口总数 | ${statistics.supplyStats.totalShortage} |

### 1.2 床位使用情况

| 指标 | 数值 |
|------|------|
| 总床位容量 | ${statistics.bedStats.totalCapacity} |
| 已占用床位 | ${statistics.bedStats.totalOccupied} |
| 可用床位 | ${statistics.bedStats.totalAvailable} |
| 超配避难点数量 | ${statistics.bedStats.overCapacityShelters} |
| 超配总人数 | ${statistics.bedStats.totalOverage} |

### 1.3 人群分布

| 人群类型 | 数量 |
|----------|------|
| 婴幼儿 (0-2岁) | ${statistics.demographicStats.infants} |
| 儿童 (3-17岁) | ${statistics.demographicStats.children} |
| 成人 (18-64岁) | ${statistics.demographicStats.adults} |
| 老年人 (65岁+) | ${statistics.demographicStats.elderly} |
| 残疾人 | ${statistics.demographicStats.disabled} |
| 孕妇 | ${statistics.demographicStats.pregnant} |
| 慢性病患者 | ${statistics.demographicStats.chronic} |

---

## 二、避难点详情

`;
        
        shelters.forEach(shelter => {
            const shelterState = statistics.shelterStates?.[shelter.id] || {};
            const shelterEvacuees = evacuees.filter(e => e.shelter_id === shelter.id);
            const shelterIssues = issues.filter(i => i.shelterId === shelter.id);
            
            report += `### ${shelter.name}

**位置**: ${shelter.location || '未提供'}  
**床位容量**: ${shelter.capacity || 0}  
**当前入住**: ${shelterEvacuees.length}人  
**检测到问题**: ${shelterIssues.length}个

`;
            
            if (shelterIssues.length > 0) {
                report += `**问题列表**:

`;
                shelterIssues.forEach((issue, index) => {
                    const severityEmoji = issue.severity === 'high' ? '🔴' : 
                                          issue.severity === 'medium' ? '🟡' : '🔵';
                    report += `${index + 1}. ${severityEmoji} **${issue.title}**  
   ${issue.description}

`;
                });
            }
            
            report += `---

`;
        });
        
        report += `## 三、问题分析

### 3.1 问题分类统计

| 问题类型 | 数量 |
|----------|------|
`;
        
        Object.entries(statistics.issueStats.byType).forEach(([type, count]) => {
            const typeLabel = getIssueTypeLabel(type);
            report += `| ${typeLabel} | ${count} |
`;
        });
        
        report += `
### 3.2 严重程度分布

| 严重程度 | 数量 |
|----------|------|
| 🔴 高 | ${statistics.issueStats.bySeverity.high} |
| 🟡 中 | ${statistics.issueStats.bySeverity.medium} |
| 🔵 低 | ${statistics.issueStats.bySeverity.low} |

---

## 四、详细问题记录

`;
        
        if (issues.length === 0) {
            report += `本次复盘未检测到任何问题。

`;
        } else {
            const highIssues = issues.filter(i => i.severity === 'high');
            const mediumIssues = issues.filter(i => i.severity === 'medium');
            const lowIssues = issues.filter(i => i.severity === 'low');
            
            if (highIssues.length > 0) {
                report += `### 4.1 高优先级问题 (🔴)

`;
                highIssues.forEach((issue, index) => {
                    report += `#### ${index + 1}. ${issue.title}

- **描述**: ${issue.description}
- **严重程度**: 高
- **涉及避难点**: ${issue.shelterName || '全局'}
- **发生时间**: ${issue.timestamp || '未知'}
- **状态**: ${getStatusText(issue.status)}

`;
                    if (issue.affectedEvacuees && issue.affectedEvacuees.length > 0) {
                        report += `- **受影响人员**: ${issue.affectedEvacuees.map(e => e.name).join(', ')}

`;
                    }
                });
            }
            
            if (mediumIssues.length > 0) {
                report += `### 4.2 中优先级问题 (🟡)

`;
                mediumIssues.forEach((issue, index) => {
                    report += `#### ${index + 1}. ${issue.title}

- **描述**: ${issue.description}
- **严重程度**: 中
- **涉及避难点**: ${issue.shelterName || '全局'}
- **发生时间**: ${issue.timestamp || '未知'}
- **状态**: ${getStatusText(issue.status)}

`;
                });
            }
            
            if (lowIssues.length > 0) {
                report += `### 4.3 低优先级问题 (🔵)

`;
                lowIssues.forEach((issue, index) => {
                    report += `#### ${index + 1}. ${issue.title}

- **描述**: ${issue.description}
- **严重程度**: 低
- **涉及避难点**: ${issue.shelterName || '全局'}
- **发生时间**: ${issue.timestamp || '未知'}
- **状态**: ${getStatusText(issue.status)}

`;
                });
            }
        }
        
        report += `---

## 五、物资分析

`;
        
        if (supplyRules && supplyRules.supply_types) {
            report += `### 5.1 物资类型定义

| 物资ID | 物资名称 | 单位 |
|--------|----------|------|
`;
            
            supplyRules.supply_types.forEach(supply => {
                report += `| ${supply.id} | ${supply.name} | ${supply.unit || '个'} |
`;
            });
            
            report += `
### 5.2 分配规则

`;
            
            if (supplyRules.rules && supplyRules.rules.length > 0) {
                supplyRules.rules.forEach((rule, index) => {
                    report += `#### 规则 ${index + 1}

`;
                    if (rule.condition) {
                        report += `- **适用条件**: 
`;
                        if (rule.condition.age_range) {
                            const min = rule.condition.age_range.min !== undefined ? rule.condition.age_range.min : '无限制';
                            const max = rule.condition.age_range.max !== undefined ? rule.condition.age_range.max : '无限制';
                            report += `  - 年龄范围: ${min} - ${max}岁
`;
                        }
                        if (rule.condition.special_needs) {
                            const needs = Array.isArray(rule.condition.special_needs) 
                                ? rule.condition.special_needs 
                                : [rule.condition.special_needs];
                            report += `  - 特殊需求: ${needs.join(', ')}
`;
                        }
                    }
                    
                    if (rule.action) {
                        const supplyType = supplyRules.supply_types?.find(s => s.id === rule.action.supply_type);
                        report += `- **分配物资**: ${supplyType?.name || rule.action.supply_type}
- **分配数量**: 每人 ${rule.action.quantity || 1} ${supplyType?.unit || '个'}

`;
                    }
                });
            } else {
                report += `未定义物资分配规则。

`;
            }
        } else {
            report += `未定义物资规则数据。

`;
        }
        
        report += `---

## 六、特殊人群照护

`;
        
        const specialCareGroups = {
            infants: evacuees.filter(e => e.age !== undefined && e.age < 3),
            elderly: evacuees.filter(e => e.age !== undefined && e.age >= 65),
            disabled: evacuees.filter(e => {
                if (!e.special_needs) return false;
                const needs = Array.isArray(e.special_needs) ? e.special_needs : [e.special_needs];
                return needs.some(n => n.toLowerCase().includes('残疾') || n.toLowerCase().includes('disabled'));
            }),
            pregnant: evacuees.filter(e => {
                if (!e.special_needs) return false;
                const needs = Array.isArray(e.special_needs) ? e.special_needs : [e.special_needs];
                return needs.some(n => n.toLowerCase().includes('孕妇') || n.toLowerCase().includes('pregnant'));
            })
        };
        
        report += `### 6.1 特殊人群统计

| 人群类型 | 数量 | 照护状态 |
|----------|------|----------|
| 婴幼儿 (0-2岁) | ${specialCareGroups.infants.length} | ${specialCareGroups.infants.length > 0 ? '需关注' : '正常'} |
| 老年人 (65岁+) | ${specialCareGroups.elderly.length} | ${specialCareGroups.elderly.length > 5 ? '需重点关注' : '正常'} |
| 残疾人 | ${specialCareGroups.disabled.length} | ${specialCareGroups.disabled.length > 0 ? '需特殊照护' : '正常'} |
| 孕妇 | ${specialCareGroups.pregnant.length} | ${specialCareGroups.pregnant.length > 0 ? '需医疗关注' : '正常'} |

`;
        
        const allSpecialNeeds = [
            ...specialCareGroups.infants,
            ...specialCareGroups.elderly,
            ...specialCareGroups.disabled,
            ...specialCareGroups.pregnant
        ];
        
        if (allSpecialNeeds.length > 0) {
            report += `### 6.2 特殊人群详情

| 人员ID | 姓名 | 年龄 | 特殊需求 | 避难点 | 照护建议 |
|--------|------|------|----------|--------|----------|
`;
            
            allSpecialNeeds.forEach(evacuee => {
                const shelter = shelters.find(s => s.id === evacuee.shelter_id);
                let specialNeeds = [];
                
                if (evacuee.age < 3) specialNeeds.push('婴幼儿');
                if (evacuee.age >= 65) specialNeeds.push('老年人');
                
                if (evacuee.special_needs) {
                    const needs = Array.isArray(evacuee.special_needs) ? evacuee.special_needs : [evacuee.special_needs];
                    specialNeeds.push(...needs);
                }
                
                let careAdvice = '常规照护';
                if (evacuee.age < 3) careAdvice = '需要专人看护、奶粉尿布供应';
                else if (evacuee.age >= 65) careAdvice = '需要定期检查、常备药品';
                else if (specialNeeds.some(n => n.toLowerCase().includes('残疾'))) careAdvice = '需要无障碍设施、辅助器具';
                else if (specialNeeds.some(n => n.toLowerCase().includes('孕妇'))) careAdvice = '需要医疗检查、营养供应';
                
                report += `| ${evacuee.id} | ${evacuee.name} | ${evacuee.age !== undefined ? evacuee.age : '-'} | ${specialNeeds.join('、')} | ${shelter?.name || '-'} | ${careAdvice} |
`;
            });
            
            report += `
`;
        }
        
        report += `---

## 七、改进建议

基于本次复盘分析，提出以下改进建议：

`;
        
        const suggestions = [];
        
        if (statistics.bedStats.overCapacityShelters > 0) {
            suggestions.push({
                priority: '高',
                title: '床位容量扩容',
                description: `检测到 ${statistics.bedStats.overCapacityShelters} 个避难点存在床位超配情况，超配人数达 ${statistics.bedStats.totalOverage} 人。建议：
- 立即评估当前避难点的实际容纳能力
- 考虑启用备用避难点
- 协调周边地区的避难点资源`
            });
        }
        
        if (statistics.supplyStats.totalShortage > 0) {
            suggestions.push({
                priority: '高',
                title: '物资补充',
                description: `检测到 ${statistics.supplyStats.suppliesWithShortage} 项物资存在短缺，总缺口 ${statistics.supplyStats.totalShortage} 单位。建议：
- 优先保障婴幼儿、老年人、残疾人等特殊人群的物资需求
- 建立应急物资储备机制
- 制定物资分配优先级规则`
            });
        }
        
        const duplicateIssues = issues.filter(i => i.type === 'duplicate_registration');
        if (duplicateIssues.length > 0) {
            suggestions.push({
                priority: '中',
                title: '登记系统优化',
                description: `检测到 ${duplicateIssues.length} 例重复登记情况。建议：
- 完善人员登记系统，增加ID唯一性校验
- 建立实时数据同步机制
- 培训登记人员，提高数据录入准确性`
            });
        }
        
        const midnightIssues = issues.filter(i => i.type === 'midnight_statistics');
        if (midnightIssues.length > 0) {
            suggestions.push({
                priority: '低',
                title: '统计流程优化',
                description: `检测到跨午夜数据，可能存在统计误差。建议：
- 明确每日统计截止时间
- 建立数据交接机制
- 增加数据校验环节`
            });
        }
        
        const specialCareIssues = issues.filter(i => i.type === 'special_care_needed');
        if (specialCareIssues.length > 0) {
            suggestions.push({
                priority: '中',
                title: '特殊人群照护',
                description: `检测到需要特殊照护的人群。建议：
- 建立特殊人群识别和登记机制
- 配备专业照护人员
- 准备特殊需求物资（如轮椅、医疗设备等）`
            });
        }
        
        if (suggestions.length === 0) {
            report += `本次复盘未发现重大问题，整体运营状况良好。建议：
- 持续优化登记流程
- 定期检查物资储备
- 加强人员培训

`;
        } else {
            suggestions.forEach((suggestion, index) => {
                const priorityEmoji = suggestion.priority === '高' ? '🔴' : 
                                       suggestion.priority === '中' ? '🟡' : '🔵';
                report += `### ${index + 1}. ${priorityEmoji} ${suggestion.title}

**优先级**: ${suggestion.priority}

${suggestion.description}

`;
            });
        }
        
        report += `---

## 附录

### A. 数据文件说明

本次复盘使用以下数据文件：
- \`shelters.json\` - 避难点信息
- \`evacuees.csv\` - 转移人员信息
- \`supply_rules.yaml\` - 物资分配规则

### B. 工具信息

- **工具名称**: 社区应急避难点复盘工具
- **报告版本**: 1.0
- **生成时间**: ${new Date().toLocaleString('zh-CN')}

---

*本报告由系统自动生成，仅供参考。*
`;
        
        return report;
    }
    
    function getIssueTypeLabel(type) {
        const labels = {
            'over_capacity': '床位超配',
            'supply_shortage': '物资短缺',
            'duplicate_registration': '重复登记',
            'midnight_statistics': '跨午夜统计',
            'special_care_needed': '特殊照护'
        };
        return labels[type] || type;
    }
    
    function getStatusText(status) {
        const statusLabels = {
            'detected': '已检测',
            'suspected': '疑似',
            'warning': '警告',
            'attention_needed': '需关注',
            'monitored': '监控中'
        };
        return statusLabels[status] || status;
    }
    
    return {
        generateReport,
        getIssueTypeLabel,
        getStatusText
    };
})();
