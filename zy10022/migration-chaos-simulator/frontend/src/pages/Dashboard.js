import { useQuery } from 'react-query';
import { Grid, Card, CardContent, Typography, Box, CircularProgress, Chip } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { getStats } from '../api';

const mockHistory = [
  { time: '00:00', requests: 1200, errors: 12 },
  { time: '04:00', requests: 800, errors: 5 },
  { time: '08:00', requests: 2500, errors: 45 },
  { time: '12:00', requests: 3200, errors: 89 },
  { time: '16:00', requests: 4100, errors: 156 },
  { time: '20:00', requests: 2800, errors: 67 },
  { time: '24:00', requests: 1500, errors: 23 },
];

function DashboardPage() {
  const { data, isLoading } = useQuery('stats', getStats, { refetchInterval: 5000 });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const stats = data?.data || {
    active_experiments: 0,
    total_experiments: 0,
    total_requests: 0,
    total_errors: 0,
    total_migrations: 0,
    active_traces: 0,
  };

  const errorRate = stats.total_requests > 0 
    ? ((stats.total_errors / stats.total_requests) * 100).toFixed(2)
    : '0';

  return (
    <Box>
      <Typography variant="h4" gutterBottom>系统仪表盘</Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'primary.dark' }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>活跃实验</Typography>
              <Typography variant="h3">{stats.active_experiments}</Typography>
              <Chip label="运行中" color="primary" size="small" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'info.dark' }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>总请求数</Typography>
              <Typography variant="h3">{stats.total_requests.toLocaleString()}</Typography>
              <Typography variant="caption" color="text.secondary">
                累计混沌实验请求
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: stats.total_errors > 0 ? 'error.dark' : 'success.dark' }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>错误率</Typography>
              <Typography variant="h3">{errorRate}%</Typography>
              <Typography variant="caption" color="text.secondary">
                {stats.total_errors} 个错误
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'warning.dark' }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>迁移任务</Typography>
              <Typography variant="h3">{stats.total_migrations}</Typography>
              <Typography variant="caption" color="text.secondary">
                {stats.active_traces} 个活跃追踪
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>请求趋势（24小时）</Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="requests" stroke="#1976d2" fill="#1976d2" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="errors" stroke="#dc004e" fill="#dc004e" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>快速开始</Typography>
              <Box sx={{ '& > *': { mb: 2 } }}>
                <Typography variant="body2" color="text.secondary">
                  1. 前往「混沌实验」创建故障注入实验
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  2. 前往「数据迁移」配置迁移脚本
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  3. 同时运行混沌实验 + 迁移演练
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  4. 在「报告导出」查看分析结果
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default DashboardPage;
