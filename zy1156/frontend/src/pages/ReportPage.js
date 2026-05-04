import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  Alert,
  Paper,
  Grid,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress
} from '@mui/material';
import {
  Download as DownloadIcon,
  Description as ReportIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

import useAppStore from '../store/appStore';

function ReportPage() {
  const [selectedEvaluation, setSelectedEvaluation] = useState('');
  const [previewFormat, setPreviewFormat] = useState('markdown');
  const [previewContent, setPreviewContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedReports, setGeneratedReports] = useState([]);

  const evaluations = useAppStore((state) => state.evaluations);
  const currentEvaluation = useAppStore((state) => state.currentEvaluation);
  const generateReport = useAppStore((state) => state.generateReport);
  const fetchEvaluations = useAppStore((state) => state.fetchEvaluations);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  useEffect(() => {
    if (currentEvaluation && !selectedEvaluation) {
      setSelectedEvaluation(currentEvaluation.id);
    }
  }, [currentEvaluation, selectedEvaluation]);

  const handlePreviewReport = async () => {
    if (!selectedEvaluation) {
      setError('请选择一个评估记录');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const evalItem = evaluations.find(e => e.id === selectedEvaluation);
      if (!evalItem) {
        setError('评估记录不存在');
        return;
      }

      if (previewFormat === 'markdown') {
        const mdContent = generateMarkdownPreview(evalItem);
        setPreviewContent(mdContent);
      } else {
        const jsonContent = generateJsonPreview(evalItem);
        setPreviewContent(JSON.stringify(jsonContent, null, 2));
      }
    } catch (err) {
      setError(err.response?.data?.error || '预览失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedEvaluation) {
      setError('请选择一个评估记录');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const report = await generateReport({
        evaluationId: selectedEvaluation,
        format: previewFormat
      });

      const blob = new Blob([report.content], { 
        type: previewFormat === 'markdown' ? 'text/markdown' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evaluation-report-${selectedEvaluation}.${previewFormat === 'markdown' ? 'md' : 'json'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setGeneratedReports(prev => [...prev, {
        id: report.reportId,
        evaluationId: selectedEvaluation,
        format: previewFormat,
        createdAt: report.createdAt
      }]);
    } catch (err) {
      setError(err.response?.data?.error || '生成报告失败');
    } finally {
      setLoading(false);
    }
  };

  const generateMarkdownPreview = (evaluation) => {
    const result = evaluation.result;
    const stats = result?.statistics || {};
    const retained = result?.retained || {};
    const lost = result?.lost || {};

    let md = `# LLM 上下文评估报告

## 基本信息

| 项目 | 值 |
|------|-----|
| 评估 ID | ${evaluation.id} |
| 上下文包 ID | ${evaluation.contextPackageId} |
| 风险等级 | ${getRiskBadge(evaluation.riskLevel)} |
| 评估时间 | ${evaluation.createdAt} |

## Token 统计

| 指标 | 数值 |
|------|------|
| 原始 Token 总数 | ${stats.totalOriginalTokens || 0} |
| 保留 Token 数 | ${stats.totalRetainedTokens || 0} |
| 丢失 Token 数 | ${stats.totalLostTokens || 0} |
| 保留率 | ${calculateRetentionRate(stats)}% |

## 保留内容摘要

`;

    if (retained.conversations?.length > 0) {
      md += `### 对话消息 (${retained.conversations.length} 条)

`;
      retained.conversations.slice(0, 3).forEach((msg, idx) => {
        md += `**${msg.role}**:
\`\`\`
${truncateText(msg.content || '', 200)}
\`\`\`

`;
      });
      if (retained.conversations.length > 3) {
        md += `... 还有 ${retained.conversations.length - 3} 条消息

`;
      }
    }

    if (retained.docs) {
      md += `### 文档资料

\`\`\`markdown
${truncateText(retained.docs, 300)}
\`\`\`

`;
    }

    md += `## 丢失内容摘要

`;

    const hasLostContent = 
      (lost.conversations?.length > 0) || 
      lost.docs || 
      lost.toolResults;

    if (!hasLostContent) {
      md += `✅ 所有内容均已保留。

`;
    } else {
      if (lost.conversations?.length > 0) {
        md += `### 丢失的对话消息 (${lost.conversations.length} 条)

`;
        lost.conversations.slice(0, 3).forEach((msg, idx) => {
          md += `- **${msg.role}**: ${truncateText(msg.content || '', 80)}
`;
        });
        md += `
`;
      }

      if (lost.docs) {
        md += `### 丢失的文档资料

部分文档内容被裁剪。

`;
      }
    }

    if (evaluation.notes) {
      md += `## 备注

${evaluation.notes}

`;
    }

    md += `---

*报告预览时间: ${new Date().toISOString()}*
`;

    return md;
  };

  const generateJsonPreview = (evaluation) => {
    return {
      reportId: 'preview',
      generatedAt: new Date().toISOString(),
      evaluation: {
        id: evaluation.id,
        contextPackageId: evaluation.contextPackageId,
        strategyId: evaluation.strategyId,
        riskLevel: evaluation.riskLevel,
        notes: evaluation.notes,
        createdAt: evaluation.createdAt
      },
      statistics: evaluation.result?.statistics || {},
      retained: evaluation.result?.retained || {},
      lost: evaluation.result?.lost || {}
    };
  };

  const getRiskBadge = (riskLevel) => {
    const badges = {
      low: '🟢 低风险',
      medium: '🟡 中风险',
      high: '🔴 高风险'
    };
    return badges[riskLevel] || riskLevel;
  };

  const calculateRetentionRate = (stats) => {
    if (!stats || stats.totalOriginalTokens === 0) return 100;
    return Math.round((stats.totalRetainedTokens / stats.totalOriginalTokens) * 100);
  };

  const truncateText = (text, maxLength) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '... (已截断)';
  };

  const selectedEval = evaluations.find(e => e.id === selectedEvaluation);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        报告导出
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            选择评估记录
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>评估记录</InputLabel>
                <Select
                  value={selectedEvaluation}
                  label="评估记录"
                  onChange={(e) => setSelectedEvaluation(e.target.value)}
                >
                  <MenuItem value="">
                    <em>请选择</em>
                  </MenuItem>
                  {evaluations.map((eval) => (
                    <MenuItem key={eval.id} value={eval.id}>
                      {new Date(eval.createdAt).toLocaleString()} - 
                      {eval.riskLevel === 'high' ? '高风险' : eval.riskLevel === 'medium' ? '中风险' : '低风险'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>导出格式</InputLabel>
                <Select
                  value={previewFormat}
                  label="导出格式"
                  onChange={(e) => setPreviewFormat(e.target.value)}
                >
                  <MenuItem value="markdown">Markdown (.md)</MenuItem>
                  <MenuItem value="json">JSON (.json)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handlePreviewReport}
              disabled={loading || !selectedEvaluation}
              startIcon={<RefreshIcon />}
            >
              预览报告
            </Button>
            <Button
              variant="contained"
              onClick={handleGenerateReport}
              disabled={loading || !selectedEvaluation}
              startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
            >
              {loading ? '生成中...' : '下载报告'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {selectedEval && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              评估摘要
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e3f2fd' }}>
                  <Typography variant="body2" color="text.secondary">
                    总 Token
                  </Typography>
                  <Typography variant="h5">
                    {selectedEval.retainedTokens + selectedEval.lostTokens}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f5e9' }}>
                  <Typography variant="body2" color="text.secondary">
                    保留
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    {selectedEval.retainedTokens}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#ffebee' }}>
                  <Typography variant="body2" color="text.secondary">
                    丢失
                  </Typography>
                  <Typography variant="h5" color="error.main">
                    {selectedEval.lostTokens}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    风险等级
                  </Typography>
                  <Chip 
                    label={selectedEval.riskLevel === 'high' ? '高风险' : selectedEval.riskLevel === 'medium' ? '中风险' : '低风险'}
                    color={selectedEval.riskLevel === 'high' ? 'error' : selectedEval.riskLevel === 'medium' ? 'warning' : 'success'}
                  />
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {previewContent && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              报告预览 ({previewFormat === 'markdown' ? 'Markdown' : 'JSON'})
            </Typography>
            
            {previewFormat === 'markdown' ? (
              <Box 
                sx={{ 
                  maxHeight: 600, 
                  overflow: 'auto',
                  bgcolor: 'grey.50',
                  p: 2,
                  borderRadius: 1,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace'
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {previewContent}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                <SyntaxHighlighter 
                  language="json" 
                  style={materialLight}
                  customStyle={{ margin: 0 }}
                >
                  {previewContent}
                </SyntaxHighlighter>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {generatedReports.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            已生成的报告
          </Typography>
          <Grid container spacing={2}>
            {generatedReports.map((report) => (
              <Grid item xs={12} md={6} lg={4} key={report.id}>
                <Paper elevation={2} sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(report.createdAt).toLocaleString()}
                      </Typography>
                      <Chip 
                        label={report.format.toUpperCase()}
                        size="small"
                        color="primary"
                        sx={{ mt: 1 }}
                      />
                    </Box>
                    <ReportIcon color="primary" />
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {evaluations.length === 0 && (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <ReportIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                暂无评估记录
              </Typography>
              <Typography variant="body2" color="text.secondary">
                请先上传文件并运行评估，然后在此处生成报告
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default ReportPage;
