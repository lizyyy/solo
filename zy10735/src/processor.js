const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

async function readCSV(filePath) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function loadRules(rulesPath) {
  const content = fs.readFileSync(rulesPath, 'utf8');
  return JSON.parse(content);
}

function detectInvalidSamples(records, rules) {
  const invalid = [];
  const valid = [];
  const invalidRules = rules.invalidChecks || [];

  for (const record of records) {
    let isInvalid = false;
    let invalidReasons = [];

    for (const check of invalidRules) {
      const fieldValue = record[check.field];
      
      if (check.type === 'empty' && (!fieldValue || fieldValue.trim() === '')) {
        isInvalid = true;
        invalidReasons.push(`${check.field} 为空`);
      }
      
      if (check.type === 'range') {
        const numValue = parseFloat(fieldValue);
        if (isNaN(numValue) || numValue < check.min || numValue > check.max) {
          isInvalid = true;
          invalidReasons.push(`${check.field} 超出范围 [${check.min}, ${check.max}]`);
        }
      }
      
      if (check.type === 'enum' && !check.values.includes(fieldValue)) {
        isInvalid = true;
        invalidReasons.push(`${check.field} 不在允许值内`);
      }
      
      if (check.type === 'logic' && check.condition) {
        try {
          const conditionMet = eval(check.condition.replace(/\$(\w+)/g, (_, key) => {
            const val = record[key];
            return isNaN(val) ? `"${val}"` : val;
          }));
          if (conditionMet) {
            isInvalid = true;
            invalidReasons.push(check.reason || '逻辑校验失败');
          }
        } catch (e) {
        }
      }
    }

    if (isInvalid) {
      invalid.push({
        ...record,
        无效原因: invalidReasons.join('; ')
      });
    } else {
      valid.push(record);
    }
  }

  return { invalid, valid };
}

function detectDuplicates(records, rules) {
  const duplicateKeys = rules.duplicateKeys || ['受访者ID'];
  const seen = new Map();
  const duplicates = [];
  const unique = [];

  for (const record of records) {
    const key = duplicateKeys.map(k => record[k]).join('|');
    
    if (seen.has(key)) {
      seen.get(key).重复次数 += 1;
      duplicates.push({
        ...record,
        重复标识: key
      });
    } else {
      seen.set(key, { ...record, 重复次数: 1 });
    }
  }

  for (const [key, record] of seen) {
    if (record.重复次数 === 1) {
      unique.push(record);
    } else {
      duplicates.push({
        ...record,
        重复标识: key,
        重复说明: `该记录共出现 ${record.重复次数} 次`
      });
    }
  }

  return { duplicates, unique };
}

function calculateQuota(records, rules) {
  const quotaFields = rules.quotaFields || [];
  const quotaResults = {};
  const summary = {
    当前有效样本数: records.length,
    各地域配额情况: {},
    需补样总人数: 0,
    各维度补样明细: []
  };

  for (const quota of quotaFields) {
    const fieldName = quota.field;
    const targetQuotas = quota.targets;
    const counts = {};

    for (const target of targetQuotas) {
      counts[target.value] = {
        目标配额: target.count,
        当前有效样本数: 0
      };
    }

    for (const record of records) {
      const value = record[fieldName];
      if (counts[value]) {
        counts[value].当前有效样本数 += 1;
      }
    }

    for (const [value, data] of Object.entries(counts)) {
      const needSample = Math.max(0, data.目标配额 - data.当前有效样本数);
      counts[value].需补样人数 = needSample;
      summary.需补样总人数 += needSample;
      
      summary.各维度补样明细.push({
        配额维度: fieldName,
        配额值: value,
        目标配额: data.目标配额,
        当前有效: data.当前有效样本数,
        需补样: needSample,
        完成率: `${((data.当前有效样本数 / data.目标配额) * 100).toFixed(1)}%`
      });
    }

    quotaResults[fieldName] = counts;
    summary.各地域配额情况[fieldName] = counts;
  }

  return { quotaResults, summary };
}

async function processSurveyData(options) {
  const { inputPath, rulesPath, outputDir, dryRun, force } = options;

  console.log('='.repeat(60));
  console.log('📊 问卷回收数据配额补样计算');
  console.log('='.repeat(60));
  console.log(`📁 输入文件: ${inputPath}`);
  console.log(`📋 规则文件: ${rulesPath}`);
  console.log(`📤 输出目录: ${outputDir}`);
  console.log(`🔍 试运行模式: ${dryRun ? '是' : '否'}`);
  console.log('='.repeat(60));

  const records = await readCSV(inputPath);
  const rules = loadRules(rulesPath);

  console.log(`\n📊 原始数据概览:`);
  console.log(`   原始问卷总数: ${records.length} 份`);

  const { invalid, valid } = detectInvalidSamples(records, rules);
  console.log(`   无效样本数: ${invalid.length} 份`);
  console.log(`   初步有效样本: ${valid.length} 份`);

  const { duplicates, unique } = detectDuplicates(valid, rules);
  const finalValid = unique;
  console.log(`   重复答卷数: ${duplicates.length} 份`);
  console.log(`   最终有效样本: ${finalValid.length} 份`);

  const { quotaResults, summary } = calculateQuota(finalValid, rules);

  console.log('\n' + '='.repeat(60));
  console.log('📈 配额补样计算结果');
  console.log('='.repeat(60));
  
  console.log(`\n📍 各地域配额完成情况:`);
  for (const item of summary.各维度补样明细) {
    const status = item.需补样 > 0 ? '❌ 未达标' : '✅ 已达标';
    console.log(`   ${item.配额维度} - ${item.配额值}:`);
    console.log(`     目标: ${item.目标配额}, 当前: ${item.当前有效}, 需补样: ${item.需补样}, 完成率: ${item.完成率} ${status}`);
  }

  console.log(`\n🔢 补样汇总:`);
  console.log(`   需补样总人数: ${summary.需补样总人数} 人`);

  if (!dryRun) {
    console.log('\n' + '='.repeat(60));
    console.log('💾 正在保存输出文件...');

    const outputFiles = [
      {
        name: '无效样本清单.csv',
        data: invalid,
        desc: '无效样本清单'
      },
      {
        name: '重复答卷清单.csv',
        data: duplicates,
        desc: '重复答卷清单'
      },
      {
        name: '最终有效样本.csv',
        data: finalValid,
        desc: '最终有效样本'
      },
      {
        name: '配额补样计算结果.json',
        data: {
          计算时间: new Date().toISOString(),
          原始数据统计: {
            原始问卷总数: records.length,
            无效样本数: invalid.length,
            重复答卷数: duplicates.length,
            最终有效样本数: finalValid.length
          },
          配额补样汇总: summary
        },
        desc: '配额补样计算结果',
        isJson: true
      }
    ];

    for (const file of outputFiles) {
      const filePath = path.join(outputDir, file.name);
      
      if (fs.existsSync(filePath) && !force) {
        console.log(`   ⚠️  文件已存在，跳过: ${file.name}`);
        continue;
      }

      if (file.isJson) {
        fs.writeFileSync(filePath, JSON.stringify(file.data, null, 2), 'utf8');
      } else {
        if (file.data.length > 0) {
          const headers = Object.keys(file.data[0]).map(key => ({ id: key, title: key }));
          const csvWriter = createCsvWriter({ path: filePath, header: headers });
          await csvWriter.writeRecords(file.data);
        } else {
          fs.writeFileSync(filePath, '', 'utf8');
        }
      }
      console.log(`   ✅ 已保存: ${file.name}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 问卷回收数据配额补样计算完成!');
  console.log('='.repeat(60));
}

module.exports = {
  processSurveyData,
  detectInvalidSamples,
  detectDuplicates,
  calculateQuota
};
