const fs = require('fs');
const path = require('path');
const config = require('./config');

class ReportGenerator {
  constructor() {
    this.outputDir = config.outputDir;
    this._ensureOutputDir();
  }

  _ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  generateReport(mission, analysis) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${mission.id}-复盘-${timestamp}.txt`;
    const filepath = path.join(this.outputDir, filename);
    
    const content = this._buildReportContent(mission, analysis);
    fs.writeFileSync(filepath, content, 'utf8');
    
    return { filepath, filename };
  }

  _buildReportContent(mission, analysis) {
    const lines = [];
    
    lines.push('='.repeat(60));
    lines.push('  灾后道路侦察 - 飞行复盘报告');
    lines.push('='.repeat(60));
    lines.push('');
    
    lines.push('【基本信息】');
    lines.push(`  任务编号: ${mission.id}`);
    lines.push(`  飞行日期: ${mission.date}`);
    lines.push(`  航线名称: ${mission.routeName}`);
    lines.push(`  飞手: ${mission.pilot || '未记录'}`);
    lines.push(`  分析时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');
    
    lines.push('【航线概览】');
    if (analysis.route) {
      lines.push(`  航点数: ${analysis.route.waypointCount}`);
      lines.push(`  总里程: ${Math.round(analysis.route.totalDistance)} 米`);
      lines.push(`  最高海拔: ${Math.round(analysis.route.maxAltitude)} 米`);
      lines.push(`  KML文件: ${mission.kmlFile}`);
    }
    lines.push('');
    
    lines.push('【禁飞区检查】');
    if (analysis.noFlyZone) {
      lines.push(`  结果: ${analysis.noFlyZone.safe ? '✅ 通过' : '❌ 有冲突'}`);
      lines.push(`  说明: ${analysis.noFlyZone.summary}`);
      
      if (analysis.noFlyZone.violations.length > 0) {
        lines.push('');
        lines.push('  ⚠️  冲突详情:');
        for (const v of analysis.noFlyZone.violations) {
          lines.push(`    - ${v.message}`);
        }
      }
      
      if (analysis.noFlyZone.warnings.length > 0) {
        lines.push('');
        lines.push('  ⚡ 注意事项:');
        for (const w of analysis.noFlyZone.warnings) {
          lines.push(`    - ${w.message}`);
        }
      }
    }
    lines.push('');
    
    lines.push('【电池情况】');
    if (analysis.battery) {
      lines.push(`  电池数量: ${analysis.battery.summary.batteryCount} 块`);
      lines.push(`  记录条数: ${analysis.battery.summary.recordCount}`);
      lines.push(`  最低电压: ${analysis.battery.summary.lowestVoltage}V`);
      lines.push(`  最低电量: ${analysis.battery.summary.lowestCapacity}%`);
      lines.push(`  状态: ${analysis.batterySafety.safe ? '✅ 正常' : '❌ 有问题'}`);
      
      if (analysis.batterySafety.issues.length > 0) {
        lines.push('');
        lines.push('  ⚠️  电池问题:');
        for (const issue of analysis.batterySafety.issues) {
          const icon = issue.type === 'critical' ? '🔴' : '🟡';
          lines.push(`    ${icon} ${issue.message}`);
        }
      }
      
      lines.push('');
      lines.push('  电池记录:');
      lines.push('  ' + '-'.repeat(50));
      lines.push('    时间    电池    电压    电量    状态');
      lines.push('  ' + '-'.repeat(50));
      
      for (const record of analysis.battery.records) {
        let statusIcon = '✅';
        if (record.status === 'critical') statusIcon = '🔴';
        else if (record.status === 'warning') statusIcon = '🟡';
        
        lines.push(`    ${record.time.padEnd(6)}  ${record.batteryId.padEnd(6)}  ${String(record.voltage).padEnd(5)}V  ${String(record.capacity).padEnd(4)}%  ${statusIcon}`);
      }
    }
    lines.push('');
    
    if (analysis.weather) {
      lines.push('【气象条件】');
      lines.push(`  风速: ${analysis.weather.windSpeed} m/s`);
      lines.push(`  能见度: ${analysis.weather.visibility} 米`);
      lines.push(`  天气: ${analysis.weather.condition}`);
      lines.push('');
    }
    
    lines.push('【总体结论】');
    const overallSafe = analysis.noFlyZone?.safe && analysis.batterySafety?.safe;
    lines.push(`  综合判定: ${overallSafe ? '✅ 可以执行' : '❌ 需要整改'}`);
    
    if (!overallSafe) {
      lines.push('');
      lines.push('  📝 整改建议:');
      if (!analysis.noFlyZone?.safe) {
        lines.push('    1. 调整航线避开禁飞区，或申请空域许可');
      }
      if (!analysis.batterySafety?.safe) {
        lines.push('    2. 更换电池，确保返航电量充足');
      }
    }
    lines.push('');
    
    lines.push('='.repeat(60));
    lines.push('  下一班接班请直接看此报告，不用翻聊天记录');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }

  generateQuickReport(analysis) {
    const lines = [];
    
    lines.push('');
    lines.push('┌' + '─'.repeat(58) + '┐');
    lines.push('│' + '  快速检查结果'.padEnd(58) + '│');
    lines.push('├' + '─'.repeat(58) + '┤');
    
    const routeStatus = analysis.noFlyZone?.safe ? '✅ 航线安全' : '❌ 航线有问题';
    const batteryStatus = analysis.batterySafety?.safe ? '✅ 电池正常' : '❌ 电池有问题';
    
    lines.push(`│  ${routeStatus.padEnd(55)}│`);
    lines.push(`│  ${batteryStatus.padEnd(55)}│`);
    
    if (analysis.noFlyZone?.violations.length > 0) {
      lines.push('│' + ' '.repeat(58) + '│');
      for (const v of analysis.noFlyZone.violations) {
        const msg = `⚠️  ${v.message}`;
        lines.push(`│  ${msg.substring(0, 56).padEnd(56)}│`);
      }
    }
    
    lines.push('└' + '─'.repeat(58) + '┘');
    lines.push('');
    
    return lines.join('\n');
  }

  generateChangeReport(changes) {
    const lines = [];
    
    lines.push('');
    lines.push('╔' + '═'.repeat(58) + '╗');
    lines.push('║' + '  ⚠️  发现数据版本不一致'.padEnd(58) + '║');
    lines.push('╠' + '═'.repeat(58) + '╣');
    
    for (const change of changes) {
      lines.push('║' + ' '.repeat(58) + '║');
      lines.push(`║  ${change.message.substring(0, 56).padEnd(56)}║`);
      lines.push(`║    之前: ${String(change.oldValue).substring(0, 50).padEnd(50)}║`);
      lines.push(`║    现在: ${String(change.newValue).substring(0, 50).padEnd(50)}║`);
    }
    
    lines.push('║' + ' '.repeat(58) + '║');
    lines.push('║  💡 建议: 确认哪个版本正确，不要直接覆盖'.padEnd(58) + '║');
    lines.push('╚' + '═'.repeat(58) + '╝');
    lines.push('');
    
    return lines.join('\n');
  }
}

module.exports = ReportGenerator;
