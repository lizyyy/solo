const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dataStore = {
  walls: [],
  holds: [],
  routes: [],
  heatmap: [],
  feedback: [],
  riskAnalysis: []
};

function loadData() {
  const files = ['walls.json', 'holds.json', 'routes.json', 'heatmap.json', 'feedback.json', 'riskAnalysis.json'];
  
  files.forEach(file => {
    const filePath = path.join(DATA_DIR, file);
    const key = file.replace('.json', '');
    
    if (fs.existsSync(filePath)) {
      try {
        dataStore[key] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        console.error(`加载 ${file} 失败:`, e.message);
      }
    }
  });
}

function saveData(key) {
  const filePath = path.join(DATA_DIR, `${key}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(dataStore[key], null, 2));
    return true;
  } catch (e) {
    console.error(`保存 ${key} 失败:`, e.message);
    return false;
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

loadData();

module.exports = {
  dataStore,
  saveData,
  generateId,
  loadData
};
