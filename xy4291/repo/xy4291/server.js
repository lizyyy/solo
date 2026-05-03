const express = require('express');
const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'data')));

app.get('/api/data/patients', (req, res) => {
  try {
    const csvPath = path.join(__dirname, 'data', 'patients.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const patients = parseCSV(csvContent);
    res.json(patients);
  } catch (error) {
    console.error('Error reading patients data:', error);
    res.status(500).json({ error: 'Failed to read patients data' });
  }
});

app.get('/api/data/vitals', (req, res) => {
  try {
    const jsonPath = path.join(__dirname, 'data', 'vitals.json');
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const vitals = JSON.parse(jsonContent);
    res.json(vitals);
  } catch (error) {
    console.error('Error reading vitals data:', error);
    res.status(500).json({ error: 'Failed to read vitals data' });
  }
});

app.get('/api/data/schedule', (req, res) => {
  try {
    const yamlPath = path.join(__dirname, 'data', 'schedule.yaml');
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    const schedule = yaml.load(yamlContent);
    res.json(schedule);
  } catch (error) {
    console.error('Error reading schedule data:', error);
    res.status(500).json({ error: 'Failed to read schedule data' });
  }
});

function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
}

app.listen(PORT, () => {
  console.log(`夜班分诊风暴服务器已启动: http://localhost:${PORT}`);
});
