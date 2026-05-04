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
  CircularProgress,
  Grid,
  Paper,
  Checkbox,
  ListItemText,
  List,
  ListItem,
  ListItemIcon
} from '@mui/material';
import {
  CompareArrows as CompareIcon,
  PlayArrow as PlayIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';

import useAppStore from '../store/appStore';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

function ComparisonPage() {
  const [selectedContextPackage, setSelectedContextPackage] = useState('');
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const strategies = useAppStore((state) => state.strategies);
  const currentContextPackage = useAppStore((state) => state.currentContextPackage);
  const compareStrategies = useAppStore((state) => state.compareStrategies);

  useEffect(() => {
    if (currentContextPackage && !selectedContextPackage) {
      setSelectedContextPackage(currentContextPackage.id);
    }
  }, [currentContextPackage, selectedContextPackage]);

  const handleStrategyToggle = (strategyId) => {
    setSelectedStrategies(prev => {
      if (prev.includes(strategyId)) {
        return prev.filter(id => id !== strategyId);
      }
      return [...prev, strategyId];
    });
  };

  const handleRunComparison = async () => {
    if (!selectedContextPackage) {
      setError('请选择一个上下文包');
      return;
    }
    if (selectedStrategies.length < 2) {
      setError('请至少选择两个策略进行对比');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await compareStrategies({
        contextPackageId: selectedContextPackage,
        strategyIds: selectedStrategies
      });
      setComparisonResult(result);
    } catch (err) {
      setError(err.response?.data?.error || '对比失败');
    } finally {
      setLoading(false);
    }
  };

  const chartData = comparisonResult?.comparisons?.map((comp, index) => ({
    name: comp.strategy?.name?.length > 15 
      ? comp.strategy?.name.substring(0, 15) + '...' 
      : comp.strategy?.name || `策略 ${index + 1}`,
    保留: comp.result?.statistics?.totalRetainedTokens || 0,
    丢失: comp.result?.statistics?.totalLostTokens || 0,
    color: COLORS[index % COLORS.length]
  })) || [];

  const retentionChartData = comparisonResult?.comparisons?.map((comp, index) => ({
    name: comp.strategy?.name?.length > 15 
      ? comp.strategy?.name.substring(0, 15) + '...' 
      : comp.strategy?.name || `策略 ${index + 1}`,
    保留率: comp.result?.statistics?.totalOriginalTokens 
      ? Math.round((comp.result.statistics.totalRetainedTokens / comp.result.statistics.totalOriginalTokens) * 100)
      : 0,
    color: COLORS[index % COLORS.length]
  })) || [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        方案对比
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            配置对比参数
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>选择上下文包</InputLabel>
                <Select
                  value={selectedContextPackage}
                  label="选择上下文包"
                  onChange={(e) => setSelectedContextPackage(e.target.value)}
                >
                  {currentContextPackage && (
                    <MenuItem value={currentContextPackage.id}>
                      当前上下文包 ({currentContextPackage.totalTokens?.toLocaleString()} tokens)
                    </MenuItem>
                  )}
                  {!currentContextPackage && (
                    <MenuItem value="" disabled>
                      请先上传上下文文件
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                选择策略 (至少 2 个)
              </Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <List dense>
                  {strategies.map((strategy) => (
                    <ListItem key={strategy.id}>
                      <ListItemIcon>
                        <Checkbox
                          checked={selectedStrategies.includes(strategy.id)}
                          onChange={() => handleStrategyToggle(strategy.id)}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>{strategy.name}</span>
                            {strategy.isDefault && (
                              <Chip label="默认" size="small" />
                            )}
                          </Box>
                        }
                        secondary={
                          <span>最大 {strategy.maxTokens?.toLocaleString()} tokens</span>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleRunComparison}
              disabled={loading || selectedStrategies.length < 2 || !selectedContextPackage}
              startIcon={loading ? <CircularProgress size={20} /> : <PlayIcon />}
            >
              {loading ? '对比中...' : '开始对比'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {comparisonResult && (
        <>
          <Typography variant="h6" gutterBottom>
            对比结果
          </Typography>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Token 分布对比
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip 
                          formatter={(value) => [`${value?.toLocaleString()} tokens`]}
                        />
                        <Legend />
                        <Bar dataKey="保留" fill="#4caf50" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="丢失" fill="#f44336" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    保留率对比
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={retentionChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} unit="%" />
                        <Tooltip 
                          formatter={(value) => [`${value}%`, '保留率']}
                        />
                        <Bar dataKey="保留率" radius={[4, 4, 0, 0]}>
                          {retentionChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Typography variant="h6" gutterBottom>
            详细对比
          </Typography>

          <Grid container spacing={3}>
            {comparisonResult.comparisons?.map((comp, index) => (
              <Grid item xs={12} md={6} lg={4} key={comp.strategy?.id || index}>
                <Card 
                  sx={{ 
                    height: '100%',
                    border: 2,
                    borderColor: COLORS[index % COLORS.length]
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Box 
                        sx={{ 
                          width: 16, 
                          height: 16, 
                          borderRadius: '50%',
                          bgcolor: COLORS[index % COLORS.length],
                          mr: 1
                        }} 
                      />
                      <Typography variant="h6">
                        {comp.strategy?.name || `策略 ${index + 1}`}
                      </Typography>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    <Box sx={{ my: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        最大 Token
                      </Typography>
                      <Typography variant="h6">
                        {comp.strategy?.maxTokens?.toLocaleString()}
                      </Typography>
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#e8f5e9' }}>
                          <Typography variant="body2" color="text.secondary">
                            保留
                          </Typography>
                          <Typography variant="h6" color="success.main">
                            {comp.result?.statistics?.totalRetainedTokens?.toLocaleString()}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6}>
                        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#ffebee' }}>
                          <Typography variant="body2" color="text.secondary">
                            丢失
                          </Typography>
                          <Typography variant="h6" color="error.main">
                            {comp.result?.statistics?.totalLostTokens?.toLocaleString()}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        内容摘要
                      </Typography>
                      <Chip 
                        label={`对话: ${comp.result?.retained?.conversations?.length || 0} 条`}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                      {comp.result?.retained?.docs && (
                        <Chip 
                          label="有文档"
                          size="small"
                          color="primary"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      )}
                      {comp.result?.retained?.toolResults && (
                        <Chip 
                          label="有工具结果"
                          size="small"
                          color="secondary"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      )}
                      {comp.result?.lost?.conversations?.length > 0 && (
                        <Chip 
                          label={`丢失 ${comp.result.lost.conversations.length} 条消息`}
                          size="small"
                          color="error"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {!comparisonResult && !loading && (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CompareIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                选择策略进行对比
              </Typography>
              <Typography variant="body2" color="text.secondary">
                选择至少两个 Token 预算策略，查看它们对同一上下文包的不同处理结果
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default ComparisonPage;
