import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Tabs,
  Tab,
  TextField,
  CircularProgress,
  Grid,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Save as SaveIcon,
  Description as ReportIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

import useAppStore from '../store/appStore';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

function EvaluationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [tabValue, setTabValue] = useState(0);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [selectedContextPackage, setSelectedContextPackage] = useState('');
  const [dryRunResult, setDryRunResult] = useState(null);
  const [riskLevel, setRiskLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strategies = useAppStore((state) => state.strategies);
  const currentContextPackage = useAppStore((state) => state.currentContextPackage);
  const currentEvaluation = useAppStore((state) => state.currentEvaluation);
  const evaluations = useAppStore((state) => state.evaluations);
  const tasks = useAppStore((state) => state.tasks);
  
  const runEvaluation = useAppStore((state) => state.runEvaluation);
  const runDryEvaluation = useAppStore((state) => state.runDryEvaluation);
  const updateEvaluation = useAppStore((state) => state.updateEvaluation);
  const generateReport = useAppStore((state) => state.generateReport);
  const fetchEvaluations = useAppStore((state) => state.fetchEvaluations);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  useEffect(() => {
    if (strategies.length > 0 && !selectedStrategy) {
      const defaultStrategy = strategies.find(s => s.isDefault);
      setSelectedStrategy(defaultStrategy?.id || strategies[0]?.id);
    }
  }, [strategies, selectedStrategy]);

  useEffect(() => {
    if (currentContextPackage && !selectedContextPackage) {
      setSelectedContextPackage(currentContextPackage.id);
    }
  }, [currentContextPackage, selectedContextPackage]);

  const handleRunEvaluation = async (isDry = false) => {
    if (!selectedStrategy) {
      setError('请选择 Token 预算策略');
      return;
    }

    if (!selectedContextPackage && !currentContextPackage) {
      setError('请先上传上下文文件');
      return;
    }

    setLoading(true);
    setError('');

    const contextId = selectedContextPackage || currentContextPackage?.id;

    try {
      if (isDry) {
        const result = await runDryEvaluation({
          contextPackageId: contextId,
          strategyId: selectedStrategy
        });
        setDryRunResult(result);
        setTabValue(1);
      } else {
        const evaluation = await runEvaluation({
          contextPackageId: contextId,
          strategyId: selectedStrategy,
          notes: notes
        });
        if (evaluation) {
          setRiskLevel(evaluation.riskLevel);
          setNotes(evaluation.notes || '');
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || '评估失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvaluation = async () => {
    if (!currentEvaluation?.id) {
      setError('没有可保存的评估');
      return;
    }

    try {
      await updateEvaluation(currentEvaluation.id, {
        riskLevel,
        notes
      });
    } catch (err) {
      setError(err.response?.data?.error || '保存失败');
    }
  };

  const handleGenerateReport = async (format) => {
    if (!currentEvaluation?.id) {
      setError('请先运行评估');
      return;
    }

    setLoading(true);
    try {
      const report = await generateReport({
        evaluationId: currentEvaluation.id,
        format
      });

      const blob = new Blob([report.content], { 
        type: format === 'markdown' ? 'text/markdown' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evaluation-report-${currentEvaluation.id}.${format === 'markdown' ? 'md' : 'json'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || '生成报告失败');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getRiskIcon = (level) => {
    switch (level) {
      case 'high': return <ErrorIcon color="error" />;
      case 'medium': return <WarningIcon color="warning" />;
      case 'low': return <CheckIcon color="success" />;
      default: return null;
    }
  };

  const resultToShow = currentEvaluation?.result || dryRunResult?.result;
  const stats = resultToShow?.statistics;
  const retained = resultToShow?.retained;
  const lost = resultToShow?.lost;

  const pieData = stats ? [
    { name: '保留', value: stats.totalRetainedTokens, color: '#4caf50' },
    { name: '丢失', value: stats.totalLostTokens, color: '#f44336' }
  ] : [];

  const breakdownData = retained ? [
    { name: '对话', retained: retained.conversations?.length || 0, lost: lost?.conversations?.length || 0 },
    { name: '文档', retained: retained.docs ? 1 : 0, lost: lost?.docs ? 1 : 0 },
    { name: '工具结果', retained: retained.toolResults ? 1 : 0, lost: lost?.toolResults ? 1 : 0 }
  ] : [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        评估分析
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            配置
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Token 预算策略</InputLabel>
                <Select
                  value={selectedStrategy}
                  label="Token 预算策略"
                  onChange={(e) => setSelectedStrategy(e.target.value)}
                >
                  {strategies.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name} ({s.maxTokens.toLocaleString()} tokens)
                      {s.isDefault && ' (默认)'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>上下文包</InputLabel>
                <Select
                  value={selectedContextPackage || currentContextPackage?.id || ''}
                  label="上下文包"
                  onChange={(e) => setSelectedContextPackage(e.target.value)}
                >
                  <MenuItem value="">
                    <em>请选择</em>
                  </MenuItem>
                  {currentContextPackage && (
                    <MenuItem value={currentContextPackage.id}>
                      当前上传 ({currentContextPackage.totalTokens?.toLocaleString() || 0} tokens)
                    </MenuItem>
                  )}
                  {evaluations
                    .filter(e => e.contextPackageId)
                    .map(e => (
                      <MenuItem key={e.contextPackageId} value={e.contextPackageId}>
                        历史上下文 ({new Date(e.createdAt).toLocaleDateString()})
                      </MenuItem>
                    ))
                  }
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => handleRunEvaluation(true)}
              disabled={loading || !selectedStrategy}
            >
              模拟运行
            </Button>
            <Button
              variant="contained"
              onClick={() => handleRunEvaluation(false)}
              disabled={loading || !selectedStrategy}
              startIcon={loading ? <CircularProgress size={20} /> : <PlayIcon />}
            >
              {loading ? '运行中...' : '运行评估'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {(resultToShow || currentEvaluation) && (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
              <Tab label="概览" />
              <Tab label="保留内容" />
              <Tab label="丢失内容" />
              <Tab label="风险标记" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Token 分布
                    </Typography>
                    {stats && (
                      <Box>
                        <Box sx={{ height: 200 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value) => [`${value.toLocaleString()} tokens`, '']}
                              />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </Box>
                        <Grid container spacing={2} sx={{ mt: 2 }}>
                          <Grid item xs={6}>
                            <Paper sx={{ p: 2, bgcolor: 'success.light' }}>
                              <Typography variant="body2" color="success.dark">
                                保留 Token
                              </Typography>
                              <Typography variant="h5" color="success.dark">
                                {stats.totalRetainedTokens?.toLocaleString() || 0}
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={6}>
                            <Paper sx={{ p: 2, bgcolor: 'error.light' }}>
                              <Typography variant="body2" color="error.dark">
                                丢失 Token
                              </Typography>
                              <Typography variant="h5" color="error.dark">
                                {stats.totalLostTokens?.toLocaleString() || 0}
                              </Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      内容类型分布
                    </Typography>
                    {breakdownData.length > 0 && (
                      <Box sx={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={breakdownData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="retained" fill="#4caf50" name="保留" />
                            <Bar dataKey="lost" fill="#f44336" name="丢失" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  保留的内容
                </Typography>
                
                {retained?.conversations?.length > 0 && (
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>
                        对话消息 ({retained.conversations.length} 条)
                      </Typography>
                      <Chip 
                        label="已保留" 
                        size="small" 
                        color="success" 
                        sx={{ ml: 2 }}
                      />
                    </AccordionSummary>
                    <AccordionDetails>
                      {retained.conversations.map((msg, idx) => (
                        <Paper 
                          key={idx} 
                          sx={{ 
                            p: 2, 
                            mb: 2,
                            bgcolor: msg.role === 'system' 
                              ? 'info.light' 
                              : msg.role === 'user' 
                              ? 'primary.light' 
                              : 'grey.100'
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Chip 
                              label={msg.role} 
                              size="small"
                              color={msg.role === 'system' ? 'info' : msg.role === 'user' ? 'primary' : 'default'}
                            />
                          </Box>
                          <Typography 
                            variant="body2" 
                            sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
                          >
                            {msg.content}
                          </Typography>
                        </Paper>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                )}

                {retained?.docs && (
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>文档资料</Typography>
                      <Chip 
                        label="已保留" 
                        size="small" 
                        color="success" 
                        sx={{ ml: 2 }}
                      />
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box 
                        sx={{ 
                          maxHeight: 400, 
                          overflow: 'auto',
                          bgcolor: 'grey.50',
                          p: 2,
                          borderRadius: 1
                        }}
                      >
                        <Typography sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 14 }}>
                          {retained.docs}
                        </Typography>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                )}

                {retained?.toolResults && (
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>工具结果</Typography>
                      <Chip 
                        label="已保留" 
                        size="small" 
                        color="success" 
                        sx={{ ml: 2 }}
                      />
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                        <SyntaxHighlighter 
                          language="json" 
                          style={materialLight}
                          customStyle={{ margin: 0 }}
                        >
                          {typeof retained.toolResults === 'string' 
                            ? retained.toolResults 
                            : JSON.stringify(retained.toolResults, null, 2)}
                        </SyntaxHighlighter>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                )}

                {retained?.budgetConstraints && Object.keys(retained.budgetConstraints).length > 0 && (
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>预算约束</Typography>
                      <Chip 
                        label="已保留" 
                        size="small" 
                        color="success" 
                        sx={{ ml: 2 }}
                      />
                    </AccordionSummary>
                    <AccordionDetails>
                      <SyntaxHighlighter 
                        language="yaml" 
                        style={materialLight}
                        customStyle={{ margin: 0 }}
                      >
                        {JSON.stringify(retained.budgetConstraints, null, 2)}
                      </SyntaxHighlighter>
                    </AccordionDetails>
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  丢失的内容
                </Typography>
                
                {!lost?.conversations?.length && !lost?.docs && !lost?.toolResults ? (
                  <Alert severity="success">
                    所有内容均已保留，没有丢失的数据
                  </Alert>
                ) : (
                  <>
                    {lost?.conversations?.length > 0 && (
                      <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography>
                            对话消息 ({lost.conversations.length} 条)
                          </Typography>
                          <Chip 
                            label="已丢失" 
                            size="small" 
                            color="error" 
                            sx={{ ml: 2 }}
                          />
                        </AccordionSummary>
                        <AccordionDetails>
                          {lost.conversations.map((msg, idx) => (
                            <Paper 
                              key={idx} 
                              sx={{ 
                                p: 2, 
                                mb: 2,
                                bgcolor: 'error.light',
                                opacity: 0.7
                              }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Chip label={msg.role} size="small" color="error" />
                              </Box>
                              <Typography 
                                variant="body2" 
                                sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
                              >
                                {msg.content}
                              </Typography>
                            </Paper>
                          ))}
                        </AccordionDetails>
                      </Accordion>
                    )}

                    {lost?.docs && (
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography>文档资料</Typography>
                          <Chip 
                            label="已丢失" 
                            size="small" 
                            color="error" 
                            sx={{ ml: 2 }}
                          />
                        </AccordionSummary>
                        <AccordionDetails>
                          <Alert severity="warning">
                            部分文档内容在裁剪过程中丢失
                          </Alert>
                        </AccordionDetails>
                      </Accordion>
                    )}

                    {lost?.toolResults && (
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography>工具结果</Typography>
                          <Chip 
                            label="已丢失" 
                            size="small" 
                            color="error" 
                            sx={{ ml: 2 }}
                          />
                        </AccordionSummary>
                        <AccordionDetails>
                          <Alert severity="warning">
                            部分工具结果在裁剪过程中丢失
                          </Alert>
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  风险标记
                </Typography>
                
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>风险等级</InputLabel>
                      <Select
                        value={riskLevel || currentEvaluation?.riskLevel || ''}
                        label="风险等级"
                        onChange={(e) => setRiskLevel(e.target.value)}
                      >
                        <MenuItem value="low">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <CheckIcon color="success" sx={{ mr: 1 }} />
                            低风险
                          </Box>
                        </MenuItem>
                        <MenuItem value="medium">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <WarningIcon color="warning" sx={{ mr: 1 }} />
                            中风险
                          </Box>
                        </MenuItem>
                        <MenuItem value="high">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ErrorIcon color="error" sx={{ mr: 1 }} />
                            高风险
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Box sx={{ mt: 3 }}>
                  <TextField
                    fullWidth
                    label="备注"
                    multiline
                    rows={4}
                    value={notes || currentEvaluation?.notes || ''}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="添加评估备注..."
                  />
                </Box>

                <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={handleSaveEvaluation}
                    disabled={!currentEvaluation}
                    startIcon={<SaveIcon />}
                  >
                    保存标记
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => handleGenerateReport('markdown')}
                    disabled={!currentEvaluation || loading}
                    startIcon={<ReportIcon />}
                  >
                    导出 Markdown
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => handleGenerateReport('json')}
                    disabled={!currentEvaluation || loading}
                    startIcon={<ReportIcon />}
                  >
                    导出 JSON
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </TabPanel>
        </>
      )}

      {evaluations.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            历史评估
          </Typography>
          <Grid container spacing={2}>
            {evaluations.slice(0, 10).map((eval) => (
              <Grid item xs={12} md={6} lg={4} key={eval.id}>
                <Paper 
                  elevation={2} 
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                  onClick={() => {
                    useAppStore.getState().setCurrentEvaluation(eval);
                    setRiskLevel(eval.riskLevel);
                    setNotes(eval.notes || '');
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(eval.createdAt).toLocaleString()}
                    </Typography>
                    {getRiskIcon(eval.riskLevel)}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip 
                      label={`保留: ${(eval.retainedTokens || 0).toLocaleString()}`}
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                    <Chip 
                      label={`丢失: ${(eval.lostTokens || 0).toLocaleString()}`}
                      size="small"
                      color="error"
                      variant="outlined"
                    />
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
}

export default EvaluationPage;
