
class MarkdownExporter {
    constructor(rulesEngine) {
        this.rulesEngine = rulesEngine;
    }

    generateReportTitle(title, eventName, date) {
        let md = `# ${title}\n\n`;
        if (eventName) {
            md += `## 项目: ${eventName}\n\n`;
        }
        if (date) {
            md += `**日期**: ${date}\n\n`;
        }
        md += '---\n\n';
        return md;
    }

    generateIndividualRankings(rankings, title = '个人排名') {
        if (!rankings || rankings.length === 0) {
            return `### ${title}\n\n暂无数据\n\n`;
        }

        let md = `### ${title}\n\n`;
        md += '| 排名 | 号码 | 姓名 | 队伍 | 有效次数 | 失误 | 犯规 | 成绩 | 备注 |\n';
        md += '|------|------|------|------|----------|------|------|------|------|\n';

        rankings.forEach(result => {
            const rank = result.rank === -1 ? 'DQ' : (result.isTie ? `${result.rank}(并列)` : String(result.rank));
            const score = result.score || 0;
            const remarks = [];
            
            if (result.disqualified) {
                remarks.push('取消资格');
            }
            if (result.exceptionNotes) {
                remarks.push(result.exceptionNotes);
            }

            md += `| ${rank} | ${result.athleteNumber || '-'} | ${result.athleteName || '-'} | ${result.team || '-'} | ${result.rawCount || 0} | ${result.errorCount || 0} | ${result.foulCount || 0} | ${score} | ${remarks.join('; ') || '-'} |\n`;
        });

        md += '\n';
        return md;
    }

    generateTeamRankings(teamRankings, title = '团队总分排名') {
        if (!teamRankings || teamRankings.length === 0) {
            return `### ${title}\n\n暂无数据\n\n`;
        }

        let md = `### ${title}\n\n`;
        md += '| 排名 | 队伍 | 项目 | 参赛人数 | 总分 | 备注 |\n';
        md += '|------|------|------|----------|------|------|\n';

        teamRankings.forEach(team => {
            const rank = team.isTie ? `${team.rank}(并列)` : String(team.rank);
            const eventName = this.rulesEngine.getEventName(team.event);

            md += `| ${rank} | ${team.team} | ${eventName} | ${team.count} | ${team.totalScore} | - |\n`;
        });

        md += '\n';
        return md;
    }

    generateGroupResults(groupName, athletes, results, title = '分组成绩') {
        let md = `### ${title} - ${groupName}\n\n`;
        
        if (!athletes || athletes.length === 0) {
            md += '暂无选手数据\n\n';
            return md;
        }

        md += '| 号码 | 姓名 | 队伍 | 有效次数 | 失误 | 犯规 | 成绩 | 状态 |\n';
        md += '|------|------|------|----------|------|------|------|------|\n';

        athletes.forEach(athlete => {
            const result = results.find(r => r.athleteId === athlete.id);
            let rawCount = '-', errorCount = '-', foulCount = '-', score = '-', status = '未比赛';

            if (result) {
                const scored = this.rulesEngine.calculateEffectiveScore(result, result.eventType);
                rawCount = result.rawCount || 0;
                errorCount = result.errorCount || 0;
                foulCount = result.foulCount || 0;
                score = scored.score;
                status = result.confirmed ? '已确认' : '待确认';

                if (scored.disqualified) {
                    status = '取消资格';
                }
            }

            md += `| ${athlete.number} | ${athlete.name} | ${athlete.team || '-'} | ${rawCount} | ${errorCount} | ${foulCount} | ${score} | ${status} |\n`;
        });

        md += '\n';
        return md;
    }

    generateAthleteDetail(athlete, result, eventType) {
        let md = `### 选手详情: ${athlete.name}\n\n`;
        
        md += `- **号码**: ${athlete.number}\n`;
        md += `- **姓名**: ${athlete.name}\n`;
        md += `- **队伍**: ${athlete.team || '未设置'}\n`;
        md += `- **项目**: ${this.rulesEngine.getEventName(eventType)}\n\n`;

        if (result) {
            const scored = this.rulesEngine.calculateEffectiveScore(result, eventType);
            
            md += '#### 比赛成绩\n\n';
            md += `- **有效次数**: ${result.rawCount || 0}\n`;
            md += `- **失误次数**: ${result.errorCount || 0}\n`;
            md += `- **犯规次数**: ${result.foulCount || 0}\n`;
            md += `- **最终成绩**: ${scored.score}\n`;
            md += `- **成绩状态**: ${result.confirmed ? '已确认' : '待确认'}\n`;
            
            if (scored.disqualified) {
                md += `- **状态**: ⚠️ 已取消资格\n`;
            }

            if (scored.message) {
                md += `- **计算说明**: ${scored.message}\n`;
            }

            if (result.exceptionNotes) {
                md += `\n#### 异常记录\n\n${result.exceptionNotes}\n`;
            }
        } else {
            md += '\n暂无比赛成绩\n';
        }

        md += '\n';
        return md;
    }

    generateFullReport(options = {}) {
        const {
            title = '跳绳比赛成绩单',
            eventType,
            date = new Date().toLocaleDateString('zh-CN'),
            individualRankings = [],
            teamRankings = [],
            groups = [],
            athletes = [],
            results = []
        } = options;

        let md = this.generateReportTitle(
            title, 
            eventType ? this.rulesEngine.getEventName(eventType) : null,
            date
        );

        if (individualRankings && individualRankings.length > 0) {
            md += this.generateIndividualRankings(individualRankings);
        }

        if (teamRankings && teamRankings.length > 0) {
            md += this.generateTeamRankings(teamRankings);
        }

        if (groups && groups.length > 0) {
            md += '---\n\n';
            md += '## 各分组详细成绩\n\n';

            groups.forEach(group => {
                const groupAthletes = athletes.filter(a => a.groupId === group.id);
                const groupResults = results.filter(r => r.groupId === group.id);
                md += this.generateGroupResults(group.name, groupAthletes, groupResults);
            });
        }

        md += '---\n\n';
        md += `*本成绩单生成时间: ${new Date().toLocaleString('zh-CN')}*\n`;
        md += `*跳绳比赛计分台 v1.0*\n`;

        return md;
    }

    exportReport(mdContent, filename = null) {
        const timestamp = new Date().toISOString().slice(0, 10);
        const actualFilename = filename || `jump_rope_report_${timestamp}.md`;

        const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = actualFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    generateQuickReport(rankings, eventType, title = '跳绳比赛成绩') {
        const date = new Date().toLocaleDateString('zh-CN');
        
        let md = `# ${title}\n\n`;
        md += `**项目**: ${this.rulesEngine.getEventName(eventType)}\n\n`;
        md += `**日期**: ${date}\n\n`;
        md += '---\n\n';

        if (rankings && rankings.length > 0) {
            md += this.generateIndividualRankings(rankings, '最终排名');
        } else {
            md += '暂无排名数据\n\n';
        }

        md += `*生成时间: ${new Date().toLocaleString('zh-CN')}*\n`;

        return md;
    }
}

export default MarkdownExporter;
