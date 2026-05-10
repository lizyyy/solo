const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const { generateRecommendations, BOOKS } = require('./recommender');
const { DEMO_SCENARIOS, RULE_VERIFICATION_TESTS } = require('./data/demo-scenarios');
const { AGE_TIERS } = require('./rules/age-rules');
const { PARENT_GOALS } = require('./rules/parent-goal-rules');
const { THEMES } = require('./rules/theme-rules');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

const recommendationHistory = [];

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/meta/age-tiers', (req, res) => {
  res.json(AGE_TIERS);
});

app.get('/api/meta/parent-goals', (req, res) => {
  const goals = Object.entries(PARENT_GOALS).map(([id, data]) => ({
    id,
    ...data
  }));
  res.json(goals);
});

app.get('/api/meta/themes', (req, res) => {
  res.json(THEMES);
});

app.get('/api/books', (req, res) => {
  res.json({
    count: BOOKS.length,
    books: BOOKS
  });
});

app.get('/api/books/:id', (req, res) => {
  const book = BOOKS.find(b => b.id === req.params.id);
  if (!book) {
    return res.status(404).json({ error: 'Book not found', id: req.params.id });
  }
  res.json(book);
});

app.post('/api/recommend', (req, res) => {
  const input = req.body;
  
  if (!input || typeof input !== 'object') {
    return res.status(400).json({
      error: 'Invalid input',
      message: '请求体必须是JSON对象'
    });
  }
  
  const state = generateRecommendations({
    childAge: input.childAge,
    parentGoals: input.parentGoals || [],
    borrowingHistory: input.borrowingHistory || []
  });
  
  const historyRecord = {
    id: state.id,
    timestamp: state.createdAt,
    input: {
      childAge: input.childAge,
      parentGoals: input.parentGoals,
      borrowingHistoryCount: (input.borrowingHistory || []).length
    },
    status: state.blockedAt ? 'blocked' : 'completed',
    blockedAt: state.blockedAt,
    issuesCount: state.issues.length
  };
  
  recommendationHistory.unshift(historyRecord);
  if (recommendationHistory.length > 50) {
    recommendationHistory.pop();
  }
  
  res.json(state);
});

app.get('/api/demo/scenarios', (req, res) => {
  res.json({
    count: DEMO_SCENARIOS.length,
    scenarios: DEMO_SCENARIOS.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description
    }))
  });
});

app.get('/api/demo/scenarios/:id', (req, res) => {
  const scenario = DEMO_SCENARIOS.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found', id: req.params.id });
  }
  res.json(scenario);
});

app.post('/api/demo/run/:id', (req, res) => {
  const scenario = DEMO_SCENARIOS.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found', id: req.params.id });
  }
  
  const state = generateRecommendations(scenario.input);
  
  res.json({
    scenario: {
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      expectedOutcome: scenario.expectedOutcome
    },
    result: state
  });
});

app.get('/api/rules/verification', (req, res) => {
  res.json({
    count: RULE_VERIFICATION_TESTS.length,
    rules: RULE_VERIFICATION_TESTS
  });
});

app.post('/api/rules/verify', (req, res) => {
  const testCases = req.body.testCases || [];
  const results = [];
  
  testCases.forEach((test, index) => {
    let passed = false;
    let message = '';
    let actual = null;
    
    if (test.type === 'age') {
      const state = generateRecommendations({
        childAge: test.age,
        parentGoals: [],
        borrowingHistory: []
      });
      
      if (state.finalRecommendations) {
        const recThemes = new Set();
        state.finalRecommendations.recommendations.forEach(r => {
          r.themes.forEach(t => recThemes.add(t));
        });
        
        const expectedSet = new Set(test.expectedThemes);
        const matches = test.expectedThemes.filter(t => recThemes.has(t));
        passed = matches.length >= Math.ceil(test.expectedThemes.length * 0.5);
        actual = {
          ageTier: state.finalRecommendations.summary.ageTier,
          themesInRecommendations: Array.from(recThemes).slice(0, 10)
        };
        message = passed 
          ? `年龄${test.age}岁匹配正确：推荐包含${matches.join('、')}` 
          : `期望主题：${test.expectedThemes.join('、')}，实际：${Array.from(recThemes).slice(0, 5).join('、')}`;
      }
    } else if (test.type === 'goal') {
      const state = generateRecommendations({
        childAge: 5,
        parentGoals: [test.goal],
        borrowingHistory: []
      });
      
      if (state.finalRecommendations) {
        const topBooks = state.finalRecommendations.recommendations.slice(0, 3);
        const hasBoostedBooks = topBooks.some(b => 
          b.themes.some(t => test.boostThemes.includes(t))
        );
        passed = hasBoostedBooks;
        message = passed 
          ? `目标"${test.goal}"生效：前3名包含${test.boostThemes.join('或')}主题` 
          : '目标加权可能未生效';
      }
    } else if (test.type === 'dirty_data') {
      const state = generateRecommendations(test.input);
      passed = state.issues.length > 0 && 
        state.issues.some(i => i.code === test.expectedError);
      message = passed 
        ? `脏数据正确识别：${test.expectedError}` 
        : `预期错误码：${test.expectedError}，实际问题数：${state.issues.length}`;
      actual = {
        issuesCount: state.issues.length,
        issueCodes: state.issues.map(i => i.code)
      };
    }
    
    results.push({
      testIndex: index + 1,
      ...test,
      passed,
      message,
      actual
    });
  });
  
  const passedCount = results.filter(r => r.passed).length;
  
  res.json({
    summary: {
      total: results.length,
      passed: passedCount,
      failed: results.length - passedCount,
      passRate: `${(passedCount / results.length * 100).toFixed(0)}%`
    },
    results
  });
});

app.get('/api/history', (req, res) => {
  res.json({
    count: recommendationHistory.length,
    records: recommendationHistory
  });
});

app.get('/api/history/:id', (req, res) => {
  const record = recommendationHistory.find(r => r.id === req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'History record not found', id: req.params.id });
  }
  res.json(record);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     儿童绘本借阅主题推荐器 - 服务已启动                  ║
╠══════════════════════════════════════════════════════════╣
║  本地访问: http://localhost:${PORT}                        ║
║                                                          ║
║  API 端点:                                                ║
║    GET  /api/health              - 健康检查               ║
║    POST /api/recommend           - 生成推荐               ║
║    GET  /api/demo/scenarios      - 演示场景列表           ║
║    POST /api/demo/run/:id        - 运行演示场景           ║
║    GET  /api/rules/verification  - 规则验证测试           ║
║    POST /api/rules/verify        - 执行规则验证           ║
║    GET  /api/history             - 推荐历史               ║
╚══════════════════════════════════════════════════════════╝
  `);
});
