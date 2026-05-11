const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
const EXPORT_DIR = path.join(__dirname, 'exports');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

const DATA_FILES = {
  treePonds: path.join(DATA_DIR, 'tree-ponds.json'),
  treeSpecies: path.join(DATA_DIR, 'tree-species.json'),
  diseaseRecords: path.join(DATA_DIR, 'disease-records.json'),
  workspaces: path.join(DATA_DIR, 'workspaces.json')
};

function loadData(filePath, defaultData = []) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return defaultData;
  }
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadSampleData() {
  const sampleDir = path.join(__dirname, 'sample-data');
  
  if (fs.existsSync(sampleDir)) {
    const sampleFiles = fs.readdirSync(sampleDir);
    
    sampleFiles.forEach(file => {
      const targetFile = path.join(DATA_DIR, file);
      if (!fs.existsSync(targetFile) && file.endsWith('.json')) {
        const source = path.join(sampleDir, file);
        fs.copyFileSync(source, targetFile);
        console.log(`已加载样例数据: ${file}`);
      }
    });
  }
}

loadSampleData();

app.get('/api/tree-ponds', (req, res) => {
  try {
    const data = loadData(DATA_FILES.treePonds, []);
    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '加载树池数据失败'
    });
  }
});

app.post('/api/tree-ponds', (req, res) => {
  try {
    const data = loadData(DATA_FILES.treePonds, []);
    const newId = data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1;
    const newItem = {
      id: newId,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    
    const conflict = data.find(d => d.code === newItem.code);
    if (conflict) {
      return res.status(409).json({
        success: false,
        error: '树池编号冲突',
        conflictField: 'code',
        existingId: conflict.id
      });
    }
    
    if (!newItem.code || !newItem.location) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段',
        missingFields: [
          ...(!newItem.code ? ['code'] : []),
          ...(!newItem.location ? ['location'] : [])
        ]
      });
    }
    
    data.push(newItem);
    saveData(DATA_FILES.treePonds, data);
    
    res.status(201).json({
      success: true,
      message: '树池记录创建成功',
      data: newItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '创建树池记录失败'
    });
  }
});

app.put('/api/tree-ponds/:id', (req, res) => {
  try {
    const data = loadData(DATA_FILES.treePonds, []);
    const index = data.findIndex(d => d.id === parseInt(req.params.id));
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: '树池记录不存在'
      });
    }
    
    const updatedItem = {
      ...data[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    const conflict = data.find(d => 
      d.code === updatedItem.code && 
      d.id !== updatedItem.id
    );
    
    if (conflict) {
      return res.status(409).json({
        success: false,
        error: '树池编号冲突',
        conflictField: 'code',
        existingId: conflict.id
      });
    }
    
    data[index] = updatedItem;
    saveData(DATA_FILES.treePonds, data);
    
    res.json({
      success: true,
      message: '树池记录更新成功',
      data: updatedItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '更新树池记录失败'
    });
  }
});

app.delete('/api/tree-ponds/:id', (req, res) => {
  try {
    let data = loadData(DATA_FILES.treePonds, []);
    const originalCount = data.length;
    
    data = data.filter(d => d.id !== parseInt(req.params.id));
    
    if (data.length === originalCount) {
      return res.status(404).json({
        success: false,
        error: '树池记录不存在'
      });
    }
    
    saveData(DATA_FILES.treePonds, data);
    
    res.json({
      success: true,
      message: '树池记录删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '删除树池记录失败'
    });
  }
});

app.get('/api/tree-species', (req, res) => {
  try {
    const data = loadData(DATA_FILES.treeSpecies, []);
    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '加载树种档案失败'
    });
  }
});

app.post('/api/tree-species', (req, res) => {
  try {
    const data = loadData(DATA_FILES.treeSpecies, []);
    const newId = data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1;
    const newItem = {
      id: newId,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    
    if (!newItem.name) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段',
        missingFields: ['name']
      });
    }
    
    data.push(newItem);
    saveData(DATA_FILES.treeSpecies, data);
    
    res.status(201).json({
      success: true,
      message: '树种档案创建成功',
      data: newItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '创建树种档案失败'
    });
  }
});

app.put('/api/tree-species/:id', (req, res) => {
  try {
    const data = loadData(DATA_FILES.treeSpecies, []);
    const index = data.findIndex(d => d.id === parseInt(req.params.id));
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: '树种档案不存在'
      });
    }
    
    data[index] = {
      ...data[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    saveData(DATA_FILES.treeSpecies, data);
    
    res.json({
      success: true,
      message: '树种档案更新成功',
      data: data[index]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '更新树种档案失败'
    });
  }
});

app.get('/api/disease-records', (req, res) => {
  try {
    const data = loadData(DATA_FILES.diseaseRecords, []);
    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '加载病害记录失败'
    });
  }
});

app.post('/api/disease-records', (req, res) => {
  try {
    const data = loadData(DATA_FILES.diseaseRecords, []);
    const newId = data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1;
    const newItem = {
      id: newId,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    
    if (!newItem.treePondId) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段',
        missingFields: ['treePondId']
      });
    }
    
    data.push(newItem);
    saveData(DATA_FILES.diseaseRecords, data);
    
    res.status(201).json({
      success: true,
      message: '病害记录创建成功',
      data: newItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '创建病害记录失败'
    });
  }
});

app.put('/api/disease-records/:id', (req, res) => {
  try {
    const data = loadData(DATA_FILES.diseaseRecords, []);
    const index = data.findIndex(d => d.id === parseInt(req.params.id));
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: '病害记录不存在'
      });
    }
    
    data[index] = {
      ...data[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    saveData(DATA_FILES.diseaseRecords, data);
    
    res.json({
      success: true,
      message: '病害记录更新成功',
      data: data[index]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '更新病害记录失败'
    });
  }
});

app.get('/api/workspaces', (req, res) => {
  try {
    const data = loadData(DATA_FILES.workspaces, {});
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '加载工作区失败'
    });
  }
});

app.post('/api/workspaces/:name', (req, res) => {
  try {
    const data = loadData(DATA_FILES.workspaces, {});
    const name = req.params.name;
    data[name] = {
      ...req.body,
      savedAt: new Date().toISOString()
    };
    saveData(DATA_FILES.workspaces, data);
    
    res.json({
      success: true,
      message: `工作区 '${name}' 保存成功`,
      data: data[name]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '保存工作区失败'
    });
  }
});

app.get('/api/export', (req, res) => {
  try {
    const treePonds = loadData(DATA_FILES.treePonds, []);
    const treeSpecies = loadData(DATA_FILES.treeSpecies, []);
    const diseaseRecords = loadData(DATA_FILES.diseaseRecords, []);
    
    const filter = req.query;
    
    let filteredPonds = treePonds;
    
    if (filter.status) {
      filteredPonds = filteredPonds.filter(p => p.status === filter.status);
    }
    if (filter.waterLevel) {
      filteredPonds = filteredPonds.filter(p => p.waterLevel === parseInt(filter.waterLevel));
    }
    if (filter.treeSpecies) {
      filteredPonds = filteredPonds.filter(p => p.treeSpecies === filter.treeSpecies);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportData = {
      exportTime: new Date().toISOString(),
      filters: filter,
      treePonds: filteredPonds,
      treeSpecies: treeSpecies.filter(s => 
        filteredPonds.some(p => p.treeSpecies === s.name)
      ),
      diseaseRecords: diseaseRecords.filter(d => 
        filteredPonds.some(p => p.id === d.treePondId)
      ),
      statistics: {
        total: filteredPonds.length,
        byWaterLevel: {
          0: filteredPonds.filter(p => p.waterLevel === 0).length,
          1: filteredPonds.filter(p => p.waterLevel === 1).length,
          2: filteredPonds.filter(p => p.waterLevel === 2).length,
          3: filteredPonds.filter(p => p.waterLevel === 3).length
        },
        byStatus: {
          pending: filteredPonds.filter(p => p.status === 'pending').length,
          in_progress: filteredPonds.filter(p => p.status === 'in_progress').length,
          completed: filteredPonds.filter(p => p.status === 'completed').length
        }
      }
    };
    
    const fileName = `tree-pond-report-${timestamp}.json`;
    const filePath = path.join(EXPORT_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    
    res.json({
      success: true,
      message: '导出成功',
      fileName,
      data: exportData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '导出失败'
    });
  }
});

app.get('/api/statistics', (req, res) => {
  try {
    const treePonds = loadData(DATA_FILES.treePonds, []);
    const diseaseRecords = loadData(DATA_FILES.diseaseRecords, []);
    
    const stats = {
      totalTreePonds: treePonds.length,
      byWaterLevel: {
        0: treePonds.filter(p => p.waterLevel === 0).length,
        1: treePonds.filter(p => p.waterLevel === 1).length,
        2: treePonds.filter(p => p.waterLevel === 2).length,
        3: treePonds.filter(p => p.waterLevel === 3).length
      },
      byStatus: {
        pending: treePonds.filter(p => p.status === 'pending').length,
        in_progress: treePonds.filter(p => p.status === 'in_progress').length,
        completed: treePonds.filter(p => p.status === 'completed').length
      },
      urgentPonds: treePonds.filter(p => 
        p.waterLevel >= 2 && p.status !== 'completed'
      ).sort((a, b) => {
        const levelDiff = b.waterLevel - a.waterLevel;
        if (levelDiff !== 0) return levelDiff;
        return new Date(a.createdAt) - new Date(b.createdAt);
      }).slice(0, 5),
      diseaseCount: diseaseRecords.length,
      untreatedDiseases: diseaseRecords.filter(d => 
        d.status !== 'treated'
      ).length
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取统计数据失败'
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  城市树池积水巡检器 启动成功');
  console.log('========================================');
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log('  数据目录: ./data');
  console.log('  样例数据: ./sample-data');
  console.log('========================================');
  console.log('  API接口:');
  console.log('  GET  /api/tree-ponds      - 获取树池列表');
  console.log('  POST /api/tree-ponds      - 创建树池记录');
  console.log('  GET  /api/tree-species    - 获取树种档案');
  console.log('  GET  /api/disease-records - 获取病害记录');
  console.log('  GET  /api/statistics      - 获取统计数据');
  console.log('  GET  /api/export          - 导出数据');
  console.log('========================================');
});

module.exports = app;