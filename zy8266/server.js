const express = require('express');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const yaml = require('js-yaml');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

function parseCSV(content) {
  const lines = content.split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const results = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    results.push(obj);
  }
  return results;
}

function parseJSONL(content) {
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => JSON.parse(line));
}

function parseYAML(content) {
  return yaml.load(content);
}

app.post('/api/import', (req, res) => {
  try {
    const { dishes, sampleFridges, allergenRules, supplierBatches } = req.body;
    
    const data = {
      dishes: dishes ? parseCSV(dishes) : [],
      sampleFridges: sampleFridges ? parseJSONL(sampleFridges) : [],
      allergenRules: allergenRules ? parseYAML(allergenRules) : [],
      supplierBatches: supplierBatches ? parseCSV(supplierBatches) : []
    };
    
    const issues = analyzeIssues(data);
    const summary = generateSummary(data, issues);
    
    res.json({
      success: true,
      data,
      issues,
      summary
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function analyzeIssues(data) {
  const issues = [];
  const { dishes, sampleFridges, allergenRules, supplierBatches } = data;
  
  const MIN_WEIGHT = 125;
  const MIN_TEMP = 0;
  const MAX_TEMP = 4;
  const TEMP_GAP_THRESHOLD = 2;
  
  sampleFridges.forEach(sample => {
    if (sample.weight && parseFloat(sample.weight) < MIN_WEIGHT) {
      issues.push({
        type: 'weight_insufficient',
        severity: 'high',
        dishId: sample.dishId,
        dishName: sample.dishName || '未知菜品',
        window: sample.window,
        date: sample.date,
        actualWeight: sample.weight,
        requiredWeight: MIN_WEIGHT,
        description: `留样重量不足: ${sample.weight}g (标准: ${MIN_WEIGHT}g)`
      });
    }
    
    if (sample.temperatureLogs && Array.isArray(sample.temperatureLogs)) {
      const sortedLogs = [...sample.temperatureLogs].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      
      for (let i = 1; i < sortedLogs.length; i++) {
        const prev = new Date(sortedLogs[i-1].timestamp);
        const curr = new Date(sortedLogs[i].timestamp);
        const gapHours = (curr - prev) / (1000 * 60 * 60);
        
        if (gapHours > TEMP_GAP_THRESHOLD) {
          issues.push({
            type: 'temperature_gap',
            severity: 'high',
            fridgeId: sample.fridgeId,
            dishId: sample.dishId,
            dishName: sample.dishName || '未知菜品',
            window: sample.window,
            date: sample.date,
            gapStart: sortedLogs[i-1].timestamp,
            gapEnd: sortedLogs[i].timestamp,
            gapHours: gapHours.toFixed(1),
            description: `温度记录断档: ${gapHours.toFixed(1)}小时`
          });
        }
      }
      
      sortedLogs.forEach(log => {
        const temp = parseFloat(log.temperature);
        if (temp < MIN_TEMP || temp > MAX_TEMP) {
          issues.push({
            type: 'temperature_abnormal',
            severity: 'high',
            fridgeId: sample.fridgeId,
            dishId: sample.dishId,
            dishName: sample.dishName || '未知菜品',
            window: sample.window,
            date: sample.date,
            timestamp: log.timestamp,
            temperature: log.temperature,
            description: `温度异常: ${log.temperature}°C (范围: ${MIN_TEMP}-${MAX_TEMP}°C)`
          });
        }
      });
    }
  });
  
  dishes.forEach(dish => {
    if (dish.servingTime && dish.servingTime.includes('夜宵')) {
      const dishDate = dish.date || new Date().toISOString().split('T')[0];
      const sampleForDish = sampleFridges.find(s => 
        s.dishId === dish.id && s.date === dishDate
      );
      
      if (sampleForDish && sampleForDish.date !== dishDate) {
        issues.push({
          type: 'midnight_misclassification',
          severity: 'medium',
          dishId: dish.id,
          dishName: dish.name || '未知菜品',
          window: dish.window,
          correctDate: dishDate,
          recordedDate: sampleForDish.date,
          description: `跨午夜夜宵归属错误: 应属于 ${dishDate}，但记录为 ${sampleForDish.date}`
        });
      }
    }
  });
  
  const batchMap = new Map();
  supplierBatches.forEach(batch => {
    const key = `${batch.ingredientId}-${batch.window}-${batch.date}`;
    if (batchMap.has(key)) {
      const existing = batchMap.get(key);
      if (existing.batchNumber !== batch.batchNumber) {
        issues.push({
          type: 'batch_mismatch',
          severity: 'high',
          ingredientId: batch.ingredientId,
          ingredientName: batch.ingredientName || '未知原料',
          window: batch.window,
          date: batch.date,
          batch1: existing.batchNumber,
          batch2: batch.batchNumber,
          description: `批次错配: 同一原料同一窗口出现不同批次: ${existing.batchNumber} vs ${batch.batchNumber}`
        });
      }
    } else {
      batchMap.set(key, batch);
    }
  });
  
  if (allergenRules && allergenRules.rules) {
    allergenRules.rules.forEach(rule => {
      if (rule.highRiskIngredients) {
        rule.highRiskIngredients.forEach(ingredient => {
          const batches = supplierBatches.filter(b => 
            b.ingredientName && b.ingredientName.includes(ingredient)
          );
          
          batches.forEach(batch => {
            const relatedDishes = dishes.filter(d => 
              d.ingredients && d.ingredients.includes(ingredient)
            );
            
            relatedDishes.forEach(dish => {
              issues.push({
                type: 'allergen_risk',
                severity: 'high',
                dishId: dish.id,
                dishName: dish.name || '未知菜品',
                window: dish.window,
                date: dish.date,
                allergen: rule.allergen || ingredient,
                ingredient: ingredient,
                batchNumber: batch.batchNumber,
                description: `过敏原风险: ${dish.name} 含有 ${ingredient}，属于 ${rule.allergen} 过敏原风险`
              });
            });
          });
        });
      }
    });
  }
  
  return issues;
}

function generateSummary(data, issues) {
  const { dishes, sampleFridges, allergenRules, supplierBatches } = data;
  
  const stats = {
    totalDishes: dishes.length,
    totalSamples: sampleFridges.length,
    totalBatches: supplierBatches.length,
    totalIssues: issues.length,
    issuesByType: {},
    issuesBySeverity: {
      high: 0,
      medium: 0,
      low: 0
    }
  };
  
  issues.forEach(issue => {
    stats.issuesByType[issue.type] = (stats.issuesByType[issue.type] || 0) + 1;
    stats.issuesBySeverity[issue.severity] = (stats.issuesBySeverity[issue.severity] || 0) + 1;
  });
  
  return stats;
}

app.get('/api/sample-data/:type', (req, res) => {
  const type = req.params.type;
  const sampleDataPath = path.join(__dirname, 'sample-data');
  
  const fileMap = {
    'dishes': 'dishes.csv',
    'sample-fridges': 'sample_fridges.jsonl',
    'allergen-rules': 'allergen_rules.yaml',
    'supplier-batches': 'supplier_batches.csv'
  };
  
  const fileName = fileMap[type];
  if (!fileName) {
    return res.status(404).json({ error: 'Invalid data type' });
  }
  
  const filePath = path.join(sampleDataPath, fileName);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Sample data not found' });
  }
});

app.listen(PORT, () => {
  console.log(`校园食堂留样与过敏原追溯复盘看板已启动: http://localhost:${PORT}`);
});
