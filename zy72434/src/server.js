const express = require('express');
const path = require('path');
const core = require('./core');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/annotations', (req, res) => {
  const { status } = req.query;
  const list = core.listAnnotations(status);
  res.json({ data: list });
});

app.get('/api/annotations/:id', (req, res) => {
  const detail = core.getAnnotationDetail(req.params.id);
  if (!detail) {
    return res.status(404).json({ error: '找不到这条标注' });
  }
  res.json({ data: detail });
});

app.post('/api/import/licenses', (req, res) => {
  const result = core.importLicenses(req.body);
  res.json({ data: result, message: `成功导入 ${result.length} 条授权期限记录` });
});

app.post('/api/import/notes', (req, res) => {
  const result = core.importEngineerNotes(req.body);
  const conflicts = result.filter(r => r.hasConflict).length;
  res.json({
    data: result,
    message: `成功导入 ${result.length} 条调音师留言${conflicts > 0 ? `，发现 ${conflicts} 条曲名冲突` : ''}`,
    conflicts,
  });
});

app.post('/api/annotations/:id/review', (req, res) => {
  const { reviewer, decision, feedback } = req.body;
  const result = core.reviewAnnotation(req.params.id, reviewer || 'API用户', decision, feedback);
  if (!result) {
    return res.status(404).json({ error: '找不到这条标注' });
  }
  res.json({ data: result, message: '复核完成' });
});

app.get('/api/report/weekly', (req, res) => {
  const report = core.getWeeklyReport();
  res.json({ data: report });
});

app.listen(PORT, () => {
  console.log(`🎷 爵士即兴段落标注系统已启动`);
  console.log(`   Web看板: http://localhost:${PORT}`);
  console.log(`   API文档:`);
  console.log(`     GET  /api/annotations              - 列出标注`);
  console.log(`     GET  /api/annotations/:id          - 标注详情（含授权页和调音师留言）`);
  console.log(`     POST /api/import/licenses          - 导入授权期限页`);
  console.log(`     POST /api/import/notes             - 导入调音师留言`);
  console.log(`     POST /api/annotations/:id/review   - 音乐老师复核`);
  console.log(`     GET  /api/report/weekly            - 店长周报`);
  console.log();
});
