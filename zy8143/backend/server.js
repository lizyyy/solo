const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 导入服务模块
const FileParser = require('./services/FileParser');
const Validator = require('./services/Validator');
const Exporter = require('./services/Exporter');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 配置文件上传
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 保留原始文件名
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// 初始化服务实例
const fileParser = new FileParser();
const validator = new Validator();
const exporter = new Exporter();

// API 路由

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'e-archive-validation-service'
  });
});

// 文件上传并校验
app.post('/api/validate', upload.array('files'), async (req, res) => {
  try {
    console.log('收到文件上传请求:', req.files ? `${req.files.length} 个文件` : '无文件');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有上传任何文件'
      });
    }

    // 1. 解析所有文件
    console.log('开始解析文件...');
    const parsedData = await fileParser.parseAllFiles(req.files);
    console.log('文件解析完成');
    console.log('- 案件清单:', parsedData.caseManifest);
    console.log('- 文档数量:', parsedData.documents.length);
    console.log('- OCR文本数量:', parsedData.ocrTexts.length);
    console.log('- 签名日志数量:', parsedData.signatureLogs.length);
    console.log('- 归档规则:', parsedData.archiveRules);

    // 2. 执行校验
    console.log('开始执行校验...');
    const validationResult = await validator.validate(parsedData);
    console.log('校验完成');
    console.log('- 案件数量:', validationResult.summary.totalCases);
    console.log('- 文档数量:', validationResult.summary.totalDocuments);
    console.log('- 风险总数:', validationResult.summary.totalRisks);
    console.log('- 高风险:', validationResult.summary.highRisks);
    console.log('- 中风险:', validationResult.summary.mediumRisks);
    console.log('- 低风险:', validationResult.summary.lowRisks);

    // 3. 清理上传的文件
    req.files.forEach(file => {
      const filePath = path.join(uploadDir, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    // 4. 返回结果
    res.json({
      success: true,
      message: '校验完成',
      data: validationResult
    });

  } catch (error) {
    console.error('校验过程出错:', error);
    
    // 清理上传的文件（如果有）
    if (req.files) {
      req.files.forEach(file => {
        const filePath = path.join(uploadDir, file.filename);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (cleanupError) {
            console.error('清理文件失败:', cleanupError);
          }
        }
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || '校验过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 导出审查报告 (Markdown格式)
app.post('/api/export/report', (req, res) => {
  try {
    const { validationResult } = req.body;
    
    if (!validationResult) {
      return res.status(400).json({
        success: false,
        message: '缺少校验结果数据'
      });
    }

    console.log('生成审查报告...');
    const report = exporter.exportReviewReport(validationResult);
    
    // 设置响应头，使其作为文件下载
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=review_report.md');
    
    res.send(report);
    console.log('审查报告生成完成');

  } catch (error) {
    console.error('导出报告出错:', error);
    res.status(500).json({
      success: false,
      message: '导出报告失败: ' + error.message
    });
  }
});

// 导出问题清单 (CSV格式)
app.post('/api/export/issues', (req, res) => {
  try {
    const { validationResult } = req.body;
    
    if (!validationResult) {
      return res.status(400).json({
        success: false,
        message: '缺少校验结果数据'
      });
    }

    console.log('生成问题清单CSV...');
    const csv = exporter.exportIssuesCSV(validationResult);
    
    // 设置响应头，使其作为文件下载
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=issues.csv');
    
    // 添加 BOM 以确保 Excel 正确识别中文
    const bom = '\uFEFF';
    res.send(bom + csv);
    console.log('问题清单CSV生成完成');

  } catch (error) {
    console.error('导出问题清单出错:', error);
    res.status(500).json({
      success: false,
      message: '导出问题清单失败: ' + error.message
    });
  }
});

// 获取支持的文件类型
app.get('/api/supported-files', (req, res) => {
  res.json({
    success: true,
    data: {
      requiredFiles: [
        {
          name: 'case_manifest.json',
          description: '案件清单文件，包含案件基本信息',
          format: 'JSON'
        },
        {
          name: 'documents.csv',
          description: '文档清单文件，包含所有文书的详细信息',
          format: 'CSV'
        },
        {
          name: 'ocr_text.jsonl',
          description: 'OCR识别文本，用于密级脱敏检查',
          format: 'JSON Lines'
        },
        {
          name: 'signature_log.jsonl',
          description: '电子签名日志，用于签名有效期校验',
          format: 'JSON Lines'
        },
        {
          name: 'archive_rules.yaml',
          description: '归档规则配置，包含必备材料清单等规则',
          format: 'YAML'
        }
      ]
    }
  });
});

// 获取校验规则说明
app.get('/api/validation-rules', (req, res) => {
  res.json({
    success: true,
    data: {
      rules: [
        {
          name: '必备材料检查',
          description: '检查每个案件是否包含归档规则中要求的必备材料',
          riskLevel: 'high'
        },
        {
          name: '页码连续性检查',
          description: '检查文档页码是否连续，是否存在跳页或重复页码',
          riskLevel: 'high'
        },
        {
          name: '案号格式校验',
          description: '检查案号格式是否符合规范',
          riskLevel: 'medium'
        },
        {
          name: '文书类型匹配',
          description: '检查文书类型是否与案件类型匹配',
          riskLevel: 'low'
        },
        {
          name: '重复文号检查',
          description: '检查是否存在重复的文书号',
          riskLevel: 'high'
        },
        {
          name: '跨年度案号提醒',
          description: '对跨年度的案号进行提醒',
          riskLevel: 'low'
        },
        {
          name: '电子签名有效期',
          description: '检查电子签名是否在有效期内',
          riskLevel: 'high'
        },
        {
          name: '密级脱敏检查',
          description: '检查敏感信息（身份证号、手机号、银行卡号等）是否已脱敏',
          riskLevel: 'high'
        }
      ]
    }
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '文件过大'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的接口不存在'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log('=================================');
  console.log('  电子卷宗归档验收工作台 - 后端服务');
  console.log('=================================');
  console.log(`服务已启动，监听端口: ${PORT}`);
  console.log(`API 基础地址: http://localhost:${PORT}/api`);
  console.log('');
  console.log('可用接口:');
  console.log('  GET  /api/health           - 健康检查');
  console.log('  POST /api/validate         - 文件上传并校验');
  console.log('  POST /api/export/report    - 导出审查报告 (Markdown)');
  console.log('  POST /api/export/issues    - 导出问题清单 (CSV)');
  console.log('  GET  /api/supported-files  - 获取支持的文件类型');
  console.log('  GET  /api/validation-rules - 获取校验规则说明');
  console.log('');
  console.log('=================================');
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务...');
  
  // 清理上传目录
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      if (fs.lstatSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
  }
  
  console.log('服务已关闭');
  process.exit(0);
});
