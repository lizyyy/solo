import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import moment from 'moment';
import config from '../config/index.js';
import { validateAll } from '../core/validator.js';
import { createAggregator } from '../core/aggregator.js';
import { analyzeRisks } from '../core/riskAnalyzer.js';
import { analyzeShoes } from '../core/shoeAnalyzer.js';
import { analyzeSoreness } from '../core/sorenessAnalyzer.js';
import { generateReport } from '../core/reportGenerator.js';
import { formatDate } from '../utils/date.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.server.port || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../data')));

function loadAndAnalyze(dataDir, options = {}) {
  const referenceDate = options.referenceDate ? moment(options.referenceDate) : moment();
  
  const validation = validateAll(dataDir, options);
  const aggregator = createAggregator(validation);
  
  const risk = analyzeRisks(aggregator, referenceDate);
  const shoes = analyzeShoes(aggregator, referenceDate);
  const soreness = analyzeSoreness(aggregator, referenceDate);
  
  return {
    validation,
    aggregator,
    risk,
    shoes,
    soreness,
    referenceDate
  };
}

function prepareForSerialization(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => prepareForSerialization(item));
  }
  
  if (obj && typeof obj === 'object') {
    if (obj._isAMomentObject) {
      return formatDate(obj);
    }
    
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'date' || key === 'startDate' || key === 'endDate' || key === 'firstRun' || key === 'lastRun') {
        result[key] = value ? formatDate(value) : null;
      } else if (key === 'raw' || key === 'runs') {
        continue;
      } else {
        result[key] = prepareForSerialization(value);
      }
    }
    return result;
  }
  
  return obj;
}

app.get('/api/analyze', (req, res) => {
  try {
    const dataDir = req.query.dataDir || config.dataDir;
    const referenceDate = req.query.referenceDate;
    
    const analysis = loadAndAnalyze(dataDir, { referenceDate });
    
    const response = {
      success: true,
      generatedAt: analysis.referenceDate.toISOString(),
      validation: prepareForSerialization(analysis.validation),
      summary: {
        risk: {
          overallLevel: analysis.risk.summary.overallLevel,
          riskCount: analysis.risk.summary.riskCount,
          warningCount: analysis.risk.summary.warningCount
        },
        shoes: prepareForSerialization(analysis.shoes.stats),
        soreness: prepareForSerialization(analysis.soreness.summary)
      }
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/risks', (req, res) => {
  try {
    const dataDir = req.query.dataDir || config.dataDir;
    const referenceDate = req.query.referenceDate;
    
    const analysis = loadAndAnalyze(dataDir, { referenceDate });
    
    res.json({
      success: true,
      risks: prepareForSerialization(analysis.risk.risks),
      warnings: prepareForSerialization(analysis.risk.warnings),
      acwr: {
        value: analysis.risk.acwr.acwr,
        level: analysis.risk.acwr.level,
        message: analysis.risk.acwr.message,
        acuteWorkload: analysis.risk.acwr.acuteWorkload,
        chronicAvgWorkload: analysis.risk.acwr.chronicAvgWorkload,
        acuteDistance: analysis.risk.acwr.acuteDistance,
        chronicAvgDistance: analysis.risk.acwr.chronicAvgDistance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/shoes', (req, res) => {
  try {
    const dataDir = req.query.dataDir || config.dataDir;
    const referenceDate = req.query.referenceDate;
    
    const analysis = loadAndAnalyze(dataDir, { referenceDate });
    
    res.json({
      success: true,
      stats: prepareForSerialization(analysis.shoes.stats),
      shoes: prepareForSerialization(analysis.shoes.shoeStats),
      alerts: prepareForSerialization(analysis.shoes.alerts),
      warnings: prepareForSerialization(analysis.shoes.warnings),
      rotationSuggestions: prepareForSerialization(analysis.shoes.rotationSuggestions)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/soreness', (req, res) => {
  try {
    const dataDir = req.query.dataDir || config.dataDir;
    const referenceDate = req.query.referenceDate;
    
    const analysis = loadAndAnalyze(dataDir, { referenceDate });
    
    res.json({
      success: true,
      summary: prepareForSerialization(analysis.soreness.summary),
      locationStats: prepareForSerialization(analysis.soreness.locationStats),
      patterns: prepareForSerialization(analysis.soreness.patterns),
      recentSoreness: prepareForSerialization(analysis.soreness.recentSoreness)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/charts/weekly-distance', (req, res) => {
  try {
    const dataDir = req.query.dataDir || config.dataDir;
    const weeks = parseInt(req.query.weeks) || 12;
    
    const analysis = loadAndAnalyze(dataDir);
    const weeklyData = analysis.aggregator.aggregateByWeek();
    
    const chartData = weeklyData.slice(-weeks).map(w => ({
      week: w.key,
      startDate: formatDate(w.startDate),
      distance: parseFloat(w.totalDistance.toFixed(1)),
      elevation: parseFloat(w.totalElevation.toFixed(0)),
      runCount: w.runCount
    }));
    
    res.json({
      success: true,
      data: chartData
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/charts/shoe-mileage', (req, res) => {
  try {
    const dataDir = req.query.dataDir || config.dataDir;
    
    const analysis = loadAndAnalyze(dataDir);
    
    const chartData = analysis.shoes.shoeStats
      .filter(s => !s.retired)
      .map(s => ({
        name: s.name,
        totalDistance: parseFloat(s.totalDistance.toFixed(1)),
        remainingMileage: parseFloat(Math.max(0, s.remainingMileage).toFixed(1)),
        status: s.overallStatus
      }));
    
    res.json({
      success: true,
      data: chartData
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/charts/soreness-distribution', (req, res) => {
  try {
    const dataDir = req.query.dataDir || config.dataDir;
    
    const analysis = loadAndAnalyze(dataDir);
    
    const chartData = analysis.soreness.locationStats.map(loc => ({
      location: loc.location,
      count: loc.count,
      avgSeverity: parseFloat(loc.avgSeverity.toFixed(1)),
      maxSeverity: loc.maxSeverity
    }));
    
    res.json({
      success: true,
      data: chartData
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/report/:format', (req, res) => {
  try {
    const format = req.params.format;
    const dataDir = req.query.dataDir || config.dataDir;
    const referenceDate = req.query.referenceDate;
    
    if (!['markdown', 'html', 'json'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: '不支持的格式，支持: markdown, html, json'
      });
    }
    
    const analysis = loadAndAnalyze(dataDir, { referenceDate });
    const report = generateReport(
      {
        risk: analysis.risk,
        shoes: analysis.shoes,
        soreness: analysis.soreness,
        aggregator: analysis.aggregator
      },
      analysis.validation,
      format,
      { referenceDate: analysis.referenceDate }
    );
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.send(report);
    } else if (format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(report);
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="running-analysis.md"');
      res.send(report);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/validate', (req, res) => {
  try {
    const dataDir = req.query.dataDir || config.dataDir;
    const validation = validateAll(dataDir);
    
    res.json({
      success: true,
      allValid: validation.allValid,
      runs: {
        count: validation.runs.data.length,
        errors: validation.runs.errors.length,
        warnings: validation.runs.warnings.length,
        errorList: validation.runs.errors,
        warningList: validation.runs.warnings
      },
      shoes: {
        count: validation.shoes.data.length,
        errors: validation.shoes.errors.length,
        warnings: validation.shoes.warnings.length,
        errorList: validation.shoes.errors,
        warningList: validation.shoes.warnings
      },
      soreness: {
        count: validation.soreness.data.length,
        errors: validation.soreness.errors.length,
        warnings: validation.soreness.warnings.length,
        errorList: validation.soreness.errors,
        warningList: validation.soreness.warnings
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/runs', (req, res) => {
  try {
    const dataDir = req.query.dataDir || config.dataDir;
    const analysis = loadAndAnalyze(dataDir);
    
    const runs = analysis.aggregator.runs.map(r => ({
      id: r.id,
      date: formatDate(r.date),
      distance: r.distance,
      duration: r.duration,
      pace: r.pace,
      elevation: r.elevation,
      surface: r.surface,
      trainingType: r.trainingType,
      shoe: r.shoe
    }));
    
    res.json({
      success: true,
      count: runs.length,
      runs
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`
========================================
  跑步训练负荷分析工具 Running Analyzer
========================================

服务已启动: http://localhost:${PORT}

可用的 API 端点:
  GET /                    - 分析仪表盘
  GET /api/analyze         - 完整分析结果
  GET /api/risks           - 风险分析
  GET /api/shoes           - 跑鞋分析
  GET /api/soreness        - 疼痛分析
  GET /api/report/markdown - 导出 Markdown 报告
  GET /api/report/html     - 导出 HTML 报告
  GET /api/report/json     - 导出 JSON 报告
  GET /api/validate        - 数据校验

数据目录: ${config.dataDir}

请确保数据目录中包含以下文件:
  - runs.csv      - 跑步记录
  - shoes.json    - 跑鞋信息
  - soreness.csv  - 疼痛日志

========================================
`);
});
