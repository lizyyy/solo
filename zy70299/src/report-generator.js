const fs = require('fs').promises;
const path = require('path');
const { stringify } = require('csv-stringify/sync');

class ReportGenerator {
  async generateReport(signs, inspections, riskResults, format = 'console', outputPath = null) {
    switch (format) {
      case 'json':
        return this._generateJSONReport(signs, inspections, riskResults, outputPath);
      case 'csv':
        return this._generateCSVReport(signs, inspections, riskResults, outputPath);
      case 'console':
      default:
        return this._generateConsoleReport(signs, inspections, riskResults);
    }
  }

  _generateConsoleReport(signs, inspections, riskResults) {
    const highRisk = riskResults.filter(r => r.riskLevel === 'high');
    const mediumRisk = riskResults.filter(r => r.riskLevel === 'medium');
    const lowRisk = riskResults.filter(r => r.riskLevel === 'low');
    const needsReview = riskResults.filter(r => r.needsReview);
    const noInspection = signs.filter(s => !inspections.some(i => i.signId === s.id));

    console.log('\n' + '='.repeat(100));
    console.log('                    📊 户外广告牌巡检风险评估报告');
    console.log('='.repeat(100));
    console.log(`\n📅 评估时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`\n📈 总体统计`);
    console.log('-' .repeat(50));
    console.log(`  广告牌总数: ${signs.length}`);
    console.log(`  巡检记录数: ${inspections.length}`);
    console.log(`  🔴 高风险: ${highRisk.length}`);
    console.log(`  🟡 中风险: ${mediumRisk.length}`);
    console.log(`  🟢 低风险: ${lowRisk.length}`);
    console.log(`  ⚠️  需要人工确认: ${needsReview.length}`);
    console.log(`  ❓ 无巡检记录: ${noInspection.length}`);

    if (needsReview.length > 0) {
      console.log(`\n\n🔔 需要人工确认的广告牌 (${needsReview.length}个)`);
      console.log('='.repeat(100));
      
      needsReview.forEach((result, idx) => {
        const levelIcon = result.riskLevel === 'high' ? '🔴' : result.riskLevel === 'medium' ? '🟡' : '🟢';
        console.log(`\n${idx + 1}. ${levelIcon} ${result.riskLevel.toUpperCase()}风险 - 评分: ${result.riskScore}/14`);
        console.log(`   广告牌 ID: ${result.signId}`);
        console.log(`   位置: ${result.location}`);
        console.log(`   业主: ${result.owner || '未知'}`);
        
        console.log(`\n   🔧 巡检状态:`);
        console.log(`      结构锈蚀: ${this._formatRustLevel(result.rustLevel)} (${result.rustScore}分)`);
        console.log(`      照明状态: ${this._formatLightingStatus(result.lightingStatus)} (${result.lightingScore}分)`);
        console.log(`      合同到期: ${result.contractEndDate} (${this._formatContractDays(result.daysUntilContractEnd)})`);
        console.log(`      最后巡检: ${result.inspectionDate || '暂无记录'}`);
        
        console.log(`\n   🚨 复核原因:`);
        result.reviewReasons.forEach(reason => {
          console.log(`      • ${reason}`);
        });
        
        console.log(`\n   💡 建议措施:`);
        result.recommendations.forEach(rec => {
          console.log(`      • ${rec}`);
        });
      });
    }

    console.log(`\n\n📋 所有广告牌风险清单`);
    console.log('='.repeat(100));
    
    console.log('\n' + '-'.repeat(100));
    console.log(`${'排名'.padEnd(4)} ${'ID'.padEnd(10)} ${'风险'.padEnd(6)} ${'评分'.padEnd(6)} ${'锈蚀'.padEnd(8)} ${'照明'.padEnd(8)} ${'合同剩余'.padEnd(10)} ${'位置'}`);
    console.log('-'.repeat(100));
    
    riskResults.forEach((result, idx) => {
      const rank = idx + 1;
      const level = result.riskLevel === 'high' ? '🔴高' : result.riskLevel === 'medium' ? '🟡中' : '🟢低';
      const rust = this._formatRustLevelShort(result.rustLevel);
      const lighting = this._formatLightingShort(result.lightingStatus);
      const contract = this._formatContractDaysShort(result.daysUntilContractEnd);
      
      console.log(
        `${rank.toString().padEnd(4)} ` +
        `${result.signId.padEnd(10)} ` +
        `${level.padEnd(6)} ` +
        `${result.riskScore.toString().padEnd(6)} ` +
        `${rust.padEnd(8)} ` +
        `${lighting.padEnd(8)} ` +
        `${contract.padEnd(10)} ` +
        `${result.location}`
      );
    });
    console.log('-'.repeat(100));

    console.log(`\n\n📐 评分说明`);
    console.log('-' .repeat(50));
    console.log(`  结构锈蚀: 无=0, 轻微=1, 中度=3, 严重=5`);
    console.log(`  照明状态: 正常=0, 部分故障=2, 完全故障=4`);
    console.log(`  合同到期: 已过期=5, 7天内=4, 14天内=3, 30天内=2, 60天内=1, 60天以上=0`);
    console.log(`  总分: 0-14`);
    console.log(`  风险等级: 0-2=低, 3-7=中, 8+=高 (需复核的自动升为高风险)`);
    
    console.log('\n' + '='.repeat(100));
    console.log(`\n💡 下一步操作:`);
    console.log(`  1. 优先处理 🔴 高风险广告牌`);
    console.log(`  2. 及时处理 ⚠️ 需要人工确认的广告牌`);
    console.log(`  3. 导出报表: os-inspect report --json 或 --csv --output <文件>`);
    console.log(`  4. 查看统计: os-inspect stats`);
    console.log('');
  }

  _generateJSONReport(signs, inspections, riskResults, outputPath) {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalSigns: signs.length,
        totalInspections: inspections.length,
        highRisk: riskResults.filter(r => r.riskLevel === 'high').length,
        mediumRisk: riskResults.filter(r => r.riskLevel === 'medium').length,
        lowRisk: riskResults.filter(r => r.riskLevel === 'low').length,
        needsReview: riskResults.filter(r => r.needsReview).length,
        noInspection: signs.filter(s => !inspections.some(i => i.signId === s.id)).length
      },
      needsReview: riskResults.filter(r => r.needsReview),
      allResults: riskResults,
      scoringRules: {
        rust: { none: 0, minor: 1, moderate: 3, severe: 5 },
        lighting: { working: 0, partial: 2, failed: 4 },
        contract: {
          expired: 5,
          within7Days: 4,
          within14Days: 3,
          within30Days: 2,
          within60Days: 1,
          moreThan60Days: 0
        }
      }
    };

    const jsonStr = JSON.stringify(report, null, 2);
    
    if (outputPath) {
      fs.writeFile(path.resolve(outputPath), jsonStr);
      console.log(`\n✅ JSON 报表已保存到: ${outputPath}`);
    } else {
      console.log(jsonStr);
    }
    
    return report;
  }

  _generateCSVReport(signs, inspections, riskResults, outputPath) {
    const rows = riskResults.map((r, idx) => ({
      排名: idx + 1,
      广告牌ID: r.signId,
      位置: r.location,
      业主: r.owner || '',
      风险等级: this._formatRiskLevel(r.riskLevel),
      风险评分: r.riskScore,
      锈蚀评分: r.rustScore,
      照明评分: r.lightingScore,
      合同评分: r.contractScore,
      锈蚀程度: this._formatRustLevelCN(r.rustLevel),
      照明状态: this._formatLightingCN(r.lightingStatus),
      合同到期日: r.contractEndDate,
      合同剩余天数: r.daysUntilContractEnd,
      最后巡检日: r.inspectionDate || '',
      巡检员: r.inspector || '',
      需要复核: r.needsReview ? '是' : '否',
      复核原因: r.reviewReasons.join('; '),
      建议措施: r.recommendations.join('; ')
    }));

    const csv = stringify(rows, { header: true, quoted: true });
    
    if (outputPath) {
      fs.writeFile(path.resolve(outputPath), '\uFEFF' + csv);
      console.log(`\n✅ CSV 报表已保存到: ${outputPath}`);
    } else {
      console.log(csv);
    }
    
    return rows;
  }

  _formatRustLevel(level) {
    const map = {
      'none': '✅ 无锈蚀',
      'minor': '⚠️ 轻微锈蚀',
      'moderate': '🔧 中度锈蚀',
      'severe': '🚨 严重锈蚀'
    };
    return map[level] || level;
  }

  _formatRustLevelShort(level) {
    const map = {
      'none': '无',
      'minor': '轻微',
      'moderate': '中度',
      'severe': '严重'
    };
    return map[level] || level;
  }

  _formatRustLevelCN(level) {
    return this._formatRustLevelShort(level);
  }

  _formatLightingStatus(status) {
    const map = {
      'working': '✅ 正常',
      'partial': '⚠️ 部分故障',
      'failed': '🚨 完全故障'
    };
    return map[status] || status;
  }

  _formatLightingShort(status) {
    const map = {
      'working': '正常',
      'partial': '部分故障',
      'failed': '完全故障'
    };
    return map[status] || status;
  }

  _formatLightingCN(status) {
    return this._formatLightingShort(status);
  }

  _formatRiskLevel(level) {
    const map = {
      'high': '高',
      'medium': '中',
      'low': '低'
    };
    return map[level] || level;
  }

  _formatContractDays(days) {
    if (days < 0) return `🚨 已过期 ${Math.abs(days)} 天`;
    if (days <= 7) return `🔴 ${days} 天后到期`;
    if (days <= 14) return `🟡 ${days} 天后到期`;
    if (days <= 30) return `🟠 ${days} 天后到期`;
    return `${days} 天后到期`;
  }

  _formatContractDaysShort(days) {
    if (days < 0) return `过期${Math.abs(days)}天`;
    if (days <= 30) return `${days}天`;
    return `${days}天`;
  }
}

module.exports = { ReportGenerator };
