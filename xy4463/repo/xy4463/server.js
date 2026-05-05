const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

const DATA_FILES = {
  birds: path.join(DATA_DIR, 'birds.json'),
  vetRecords: path.join(DATA_DIR, 'vetRecords.json'),
  weightRecords: path.join(DATA_DIR, 'weightRecords.json'),
  flightCageObservations: path.join(DATA_DIR, 'flightCageObservations.json'),
  ringNumbers: path.join(DATA_DIR, 'ringNumbers.json'),
  weather: path.join(DATA_DIR, 'weather.json'),
  assessments: path.join(DATA_DIR, 'assessments.json'),
  manualDecisions: path.join(DATA_DIR, 'manualDecisions.json')
};

function initDataFiles() {
  for (const [key, filePath] of Object.entries(DATA_FILES)) {
    if (!fs.existsSync(filePath)) {
      fs.writeJsonSync(filePath, []);
    }
  }
}

initDataFiles();

app.get('/api/data/:type', (req, res) => {
  const { type } = req.params;
  const filePath = DATA_FILES[type];
  
  if (!filePath) {
    return res.status(400).json({ error: '无效的数据类型' });
  }
  
  try {
    const data = fs.readJsonSync(filePath);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: '读取数据失败' });
  }
});

app.post('/api/data/:type', (req, res) => {
  const { type } = req.params;
  const filePath = DATA_FILES[type];
  
  if (!filePath) {
    return res.status(400).json({ error: '无效的数据类型' });
  }
  
  try {
    const data = req.body;
    fs.writeJsonSync(filePath, data, { spaces: 2 });
    res.json({ success: true, message: '数据保存成功' });
  } catch (error) {
    res.status(500).json({ error: '保存数据失败' });
  }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }
  
  try {
    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    let data;
    
    try {
      data = JSON.parse(fileContent);
    } catch (jsonError) {
      try {
        const lines = fileContent.split('\n').filter(line => line.trim());
        data = lines.map(line => JSON.parse(line));
      } catch (ndjsonError) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: '文件格式错误，需要JSON或NDJSON格式' });
      }
    }
    
    fs.unlinkSync(filePath);
    res.json({ success: true, data, filename: req.file.originalname });
  } catch (error) {
    res.status(500).json({ error: '处理文件失败' });
  }
});

app.get('/api/export/markdown', (req, res) => {
  try {
    const birds = fs.readJsonSync(DATA_FILES.birds);
    const assessments = fs.readJsonSync(DATA_FILES.assessments);
    const manualDecisions = fs.readJsonSync(DATA_FILES.manualDecisions);
    
    let markdown = '# 野鸟放飞清单\n\n';
    markdown += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    
    const approvedBirds = [];
    const delayedBirds = [];
    const needRecheckBirds = [];
    
    birds.forEach(bird => {
      const assessment = assessments.find(a => a.birdId === bird.id);
      const manualDecision = manualDecisions.find(m => m.birdId === bird.id);
      
      let status = '待评估';
      let riskReasons = [];
      let notes = '';
      
      if (manualDecision) {
        status = manualDecision.status;
        notes = manualDecision.notes || '';
      } else if (assessment) {
        status = assessment.status;
        riskReasons = assessment.riskReasons || [];
      }
      
      const birdInfo = {
        ...bird,
        status,
        riskReasons,
        notes
      };
      
      if (status === '可放飞') {
        approvedBirds.push(birdInfo);
      } else if (status === '需延后') {
        delayedBirds.push(birdInfo);
      } else if (status === '需补检') {
        needRecheckBirds.push(birdInfo);
      }
    });
    
    markdown += `## 统计信息\n\n`;
    markdown += `- 总鸟类数量: ${birds.length}\n`;
    markdown += `- 可放飞: ${approvedBirds.length}\n`;
    markdown += `- 需延后: ${delayedBirds.length}\n`;
    markdown += `- 需补检: ${needRecheckBirds.length}\n\n`;
    
    if (approvedBirds.length > 0) {
      markdown += `## 可放飞鸟类\n\n`;
      approvedBirds.forEach(bird => {
        markdown += `### ${bird.species} (ID: ${bird.id})\n\n`;
        markdown += `- 环志编号: ${bird.ringNumber || '无'}\n`;
        markdown += `- 救助日期: ${bird.rescueDate}\n`;
        markdown += `- 状态: 可放飞\n`;
        if (bird.notes) {
          markdown += `- 备注: ${bird.notes}\n`;
        }
        markdown += '\n';
      });
    }
    
    if (delayedBirds.length > 0) {
      markdown += `## 需延后鸟类\n\n`;
      delayedBirds.forEach(bird => {
        markdown += `### ${bird.species} (ID: ${bird.id})\n\n`;
        markdown += `- 环志编号: ${bird.ringNumber || '无'}\n`;
        markdown += `- 救助日期: ${bird.rescueDate}\n`;
        markdown += `- 状态: 需延后\n`;
        if (bird.riskReasons.length > 0) {
          markdown += `- 风险原因:\n`;
          bird.riskReasons.forEach(reason => {
            markdown += `  - ${reason}\n`;
          });
        }
        if (bird.notes) {
          markdown += `- 备注: ${bird.notes}\n`;
        }
        markdown += '\n';
      });
    }
    
    if (needRecheckBirds.length > 0) {
      markdown += `## 需补检鸟类\n\n`;
      needRecheckBirds.forEach(bird => {
        markdown += `### ${bird.species} (ID: ${bird.id})\n\n`;
        markdown += `- 环志编号: ${bird.ringNumber || '无'}\n`;
        markdown += `- 救助日期: ${bird.rescueDate}\n`;
        markdown += `- 状态: 需补检\n`;
        if (bird.riskReasons.length > 0) {
          markdown += `- 风险原因:\n`;
          bird.riskReasons.forEach(reason => {
            markdown += `  - ${reason}\n`;
          });
        }
        if (bird.notes) {
          markdown += `- 备注: ${bird.notes}\n`;
        }
        markdown += '\n';
      });
    }
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=bird-release-list.md');
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ error: '导出Markdown失败' });
  }
});

app.get('/api/export/json', (req, res) => {
  try {
    const exportData = {
      exportTime: new Date().toISOString(),
      birds: fs.readJsonSync(DATA_FILES.birds),
      vetRecords: fs.readJsonSync(DATA_FILES.vetRecords),
      weightRecords: fs.readJsonSync(DATA_FILES.weightRecords),
      flightCageObservations: fs.readJsonSync(DATA_FILES.flightCageObservations),
      ringNumbers: fs.readJsonSync(DATA_FILES.ringNumbers),
      weather: fs.readJsonSync(DATA_FILES.weather),
      assessments: fs.readJsonSync(DATA_FILES.assessments),
      manualDecisions: fs.readJsonSync(DATA_FILES.manualDecisions)
    };
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=bird-release-audit.json');
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    res.status(500).json({ error: '导出JSON失败' });
  }
});

app.listen(PORT, () => {
  console.log(`野鸟放飞复核系统已启动: http://localhost:${PORT}`);
});
