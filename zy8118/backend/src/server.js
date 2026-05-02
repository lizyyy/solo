import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { OpenAPIParser, JSONLParser } from './parser/index.js';
import { ContractIndex } from './contract-index/index.js';
import { DiffRuleEngine } from './diff-rules/index.js';
import { ReportExporter } from './report-exporter/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

let currentAnalysis = null;
let contractIndex = null;

app.post('/api/upload/openapi', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const content = req.file.buffer.toString('utf-8');
    const isYaml = req.file.originalname.endsWith('.yaml') || req.file.originalname.endsWith('.yml');

    const parseResult = await OpenAPIParser.parse(content, isYaml);

    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error });
    }

    contractIndex = new ContractIndex(parseResult.data);

    const versionConflicts = contractIndex.getVersionConflicts();
    const missingOperationIds = contractIndex.getMissingOperationIds();

    res.json({
      success: true,
      spec: {
        title: parseResult.data.info?.title,
        version: parseResult.data.info?.version,
        description: parseResult.data.info?.description
      },
      operations: contractIndex.operations.map((op) => ({
        operationId: op.operationId,
        path: op.path,
        method: op.method,
        summary: op.summary,
        tags: op.tags,
        deprecated: op.deprecated
      })),
      versionConflicts,
      missingOperationIds
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload/jsonl', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const content = req.file.buffer.toString('utf-8');
    const parseResult = JSONLParser.parse(content);

    if (!parseResult.success && parseResult.errors.length > 0) {
      return res.status(400).json({ 
        error: 'JSONL 解析存在错误',
        errors: parseResult.errors.slice(0, 10)
      });
    }

    const requestResponsePairs = JSONLParser.extractRequestResponsePairs(parseResult.data);

    res.json({
      success: true,
      totalRecords: parseResult.data.length,
      parseErrors: parseResult.errors || [],
      requestResponsePairs: requestResponsePairs.map((pair) => ({
        id: pair.id,
        request: {
          method: pair.request.method,
          url: pair.request.url
        },
        response: pair.response ? {
          status: pair.response.status
        } : null,
        hasMockResponse: !!pair.mockResponse,
        timestamp: pair.timestamp
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload/mock', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const content = req.file.buffer.toString('utf-8');
    let mockResponses;

    try {
      mockResponses = JSON.parse(content);
    } catch (e) {
      return res.status(400).json({ error: 'Mock 响应必须是有效的 JSON 格式' });
    }

    if (!Array.isArray(mockResponses)) {
      mockResponses = [mockResponses];
    }

    res.json({
      success: true,
      totalMocks: mockResponses.length,
      mockResponses: mockResponses.map((mock, index) => ({
        id: index,
        path: mock.path || mock.url,
        method: mock.method?.toUpperCase(),
        status: mock.status || 200,
        hasBody: !!mock.body
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { openapiContent, jsonlContent, mockContent } = req.body;

    if (!openapiContent || !jsonlContent) {
      return res.status(400).json({ error: '需要提供 OpenAPI 合约和接口调用数据' });
    }

    const isYaml = typeof openapiContent === 'string' && (
      openapiContent.includes('openapi:') || 
      openapiContent.includes('swagger:')
    );

    const parseResult = await OpenAPIParser.parse(openapiContent, isYaml);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error });
    }

    contractIndex = new ContractIndex(parseResult.data);

    let requestResponsePairs = [];
    if (typeof jsonlContent === 'string') {
      const jsonlParseResult = JSONLParser.parse(jsonlContent);
      if (!jsonlParseResult.success && jsonlParseResult.errors?.length > 0) {
        return res.status(400).json({ 
          error: 'JSONL 解析错误',
          errors: jsonlParseResult.errors 
        });
      }
      requestResponsePairs = JSONLParser.extractRequestResponsePairs(jsonlParseResult.data);
    } else if (Array.isArray(jsonlContent)) {
      requestResponsePairs = JSONLParser.extractRequestResponsePairs(jsonlContent);
    }

    if (mockContent) {
      let mockResponses;
      if (typeof mockContent === 'string') {
        try {
          mockResponses = JSON.parse(mockContent);
        } catch (e) {
          return res.status(400).json({ error: 'Mock 响应必须是有效的 JSON' });
        }
      } else {
        mockResponses = mockContent;
      }

      if (!Array.isArray(mockResponses)) {
        mockResponses = [mockResponses];
      }

      requestResponsePairs = requestResponsePairs.map((pair) => {
        const matchingMock = mockResponses.find((mock) => {
          const mockPath = mock.path || mock.url;
          const mockMethod = mock.method?.toUpperCase();
          
          return mockPath === pair.request.url && 
                 (!mockMethod || mockMethod === pair.request.method);
        });

        if (matchingMock) {
          return {
            ...pair,
            mockResponse: {
              status: matchingMock.status || 200,
              body: matchingMock.body
            }
          };
        }
        return pair;
      });
    }

    const diffEngine = new DiffRuleEngine(contractIndex);

    const allIssues = [];
    const unmatchedRequests = [];
    const matchedPairs = [];

    requestResponsePairs.forEach((pair) => {
      const matchResult = contractIndex.findOperationByRequest(pair.request);
      
      if (matchResult.found) {
        const operation = matchResult.operation;
        const issues = diffEngine.analyze(pair, operation);
        
        issues.forEach((issue) => {
          allIssues.push({
            ...issue,
            operation,
            pairId: pair.id
          });
        });

        matchedPairs.push({
          ...pair,
          matchedOperation: operation,
          pathParams: matchResult.pathParams,
          issues
        });
      } else {
        unmatchedRequests.push({
          ...pair,
          suggestions: matchResult.suggestions
        });
      }
    });

    const errorCount = allIssues.filter((i) => i.severity === 'error').length;
    const warningCount = allIssues.filter((i) => i.severity === 'warning').length;
    const infoCount = allIssues.filter((i) => i.severity === 'info').length;

    const issuesByRule = {};
    allIssues.forEach((issue) => {
      if (!issuesByRule[issue.ruleId]) {
        issuesByRule[issue.ruleId] = {
          ruleName: issue.ruleName,
          count: 0,
          severity: issue.severity
        };
      }
      issuesByRule[issue.ruleId].count++;
    });

    const versionConflicts = contractIndex.getVersionConflicts();
    const missingOperationIds = contractIndex.getMissingOperationIds();

    const analysisResult = {
      specInfo: {
        title: parseResult.data.info?.title,
        version: parseResult.data.info?.version,
        description: parseResult.data.info?.description
      },
      requestResponsePairs: matchedPairs,
      issues: allIssues,
      versionConflicts,
      missingOperationIds,
      unmatchedRequests,
      summary: {
        totalRequests: requestResponsePairs.length,
        matchedRequests: matchedPairs.length,
        unmatchedRequests: unmatchedRequests.length,
        totalIssues: allIssues.length,
        errorCount,
        warningCount,
        infoCount,
        issuesByRule
      }
    };

    currentAnalysis = analysisResult;

    const jsonReport = ReportExporter.exportToJSON(analysisResult);
    const mdReport = ReportExporter.exportToMarkdown(analysisResult);

    res.json({
      success: true,
      ...analysisResult,
      reports: {
        json: JSON.parse(jsonReport),
        markdown: mdReport
      }
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/report/json', (req, res) => {
  if (!currentAnalysis) {
    return res.status(404).json({ error: '没有可用的分析结果' });
  }

  const jsonReport = ReportExporter.exportToJSON(currentAnalysis);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=drift_report.json');
  res.send(jsonReport);
});

app.get('/api/report/markdown', (req, res) => {
  if (!currentAnalysis) {
    return res.status(404).json({ error: '没有可用的分析结果' });
  }

  const mdReport = ReportExporter.exportToMarkdown(currentAnalysis);
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', 'attachment; filename=drift_report.md');
  res.send(mdReport);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`OpenAPI 合约漂移回放台后端服务运行在 http://localhost:${PORT}`);
});
