import React, { useEffect } from 'react';
import { 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  Box,
  Chip,
  CircularProgress,
  Paper
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Assignment as TaskIcon,
  Assessment as EvalIcon,
  Storage as ContextIcon,
  Warning as RiskIcon
} from '@mui/icons-material';

import useAppStore from '../store/appStore';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

function StatCard({ title, value, icon: Icon, color, subtitle }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box 
            sx={{ 
              bgcolor: `${color}.light`, 
              borderRadius: 2, 
              p: 1,
              mr: 2
            }}
          >
            <Icon sx={{ color: `${color}.dark` }} />
          </Box>
          <Box>
            <Typography color="text.secondary" variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {value}
            </Typography>
          </Box>
        </Box>
        {subtitle && (
          <Typography color="text.secondary" variant="body2">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const tasks = useAppStore((state) => state.tasks);
  const evaluations = useAppStore((state) => state.evaluations);
  const strategies = useAppStore((state) => state.strategies);
  const loading = useAppStore((state) => state.loading);
  const fetchTasks = useAppStore((state) => state.fetchTasks);
  const fetchEvaluations = useAppStore((state) => state.fetchEvaluations);

  useEffect(() => {
    fetchTasks();
    fetchEvaluations();
  }, [fetchTasks, fetchEvaluations]);

  const highRiskCount = evaluations.filter(e => e.riskLevel === 'high').length;
  const mediumRiskCount = evaluations.filter(e => e.riskLevel === 'medium').length;
  const lowRiskCount = evaluations.filter(e => e.riskLevel === 'low').length;

  const riskData = [
    { name: '低风险', value: lowRiskCount, color: '#4caf50' },
    { name: '中风险', value: mediumRiskCount, color: '#ff9800' },
    { name: '高风险', value: highRiskCount, color: '#f44336' },
  ];

  const strategyUsage = strategies.map((s, index) => ({
    name: s.name.length > 20 ? s.name.substring(0, 20) + '...' : s.name,
    tokens: s.maxTokens,
    color: COLORS[index % COLORS.length]
  }));

  const sampleTokenData = [
    { name: 'Mon', retained: 4000, lost: 1200 },
    { name: 'Tue', retained: 3500, lost: 800 },
    { name: 'Wed', retained: 5000, lost: 2000 },
    { name: 'Thu', retained: 4200, lost: 500 },
    { name: 'Fri', retained: 4800, lost: 1500 },
  ];

  if (loading && tasks.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        仪表盘
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="任务总数" 
            value={tasks.length} 
            icon={TaskIcon}
            color="primary"
            subtitle="已创建的评估任务"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="评估次数" 
            value={evaluations.length} 
            icon={EvalIcon}
            color="secondary"
            subtitle="已完成的上下文评估"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="可用策略" 
            value={strategies.length} 
            icon={ContextIcon}
            color="success"
            subtitle="Token 预算策略"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="高风险样本" 
            value={highRiskCount} 
            icon={RiskIcon}
            color="error"
            subtitle="需要关注的评估"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                风险等级分布
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Token 策略配置
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={strategyUsage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [`${value.toLocaleString()} tokens`, '最大 Token']}
                    />
                    <Bar dataKey="tokens" fill="#1976d2" radius={[4, 4, 0, 0]}>
                      {strategyUsage.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Token 保留/丢失趋势 (示例)
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sampleTokenData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="retained" 
                      stroke="#4caf50" 
                      strokeWidth={2}
                      dot={{ fill: '#4caf50' }}
                      name="保留 Token"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="lost" 
                      stroke="#f44336" 
                      strokeWidth={2}
                      dot={{ fill: '#f44336' }}
                      name="丢失 Token"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {evaluations.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            最近评估
          </Typography>
          <Grid container spacing={2}>
            {evaluations.slice(0, 5).map((eval) => (
              <Grid item xs={12} md={6} lg={4} key={eval.id}>
                <Paper elevation={2} sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(eval.createdAt).toLocaleDateString()}
                    </Typography>
                    <Chip 
                      label={eval.riskLevel === 'high' ? '高风险' : eval.riskLevel === 'medium' ? '中风险' : '低风险'}
                      size="small"
                      color={eval.riskLevel === 'high' ? 'error' : eval.riskLevel === 'medium' ? 'warning' : 'success'}
                    />
                  </Box>
                  <Typography variant="body2">
                    保留: {eval.retainedTokens?.toLocaleString() || 0} tokens
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    丢失: {eval.lostTokens?.toLocaleString() || 0} tokens
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
}

export default Dashboard;
