import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { connectWebSocket, listExperiments } from '../api';

function RealTimeMonitor() {
  const [events, setEvents] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [experiments, setExperiments] = useState([]);

  useEffect(() => {
    const ws = connectWebSocket((msg) => {
      setEvents((prev) => [msg, ...prev].slice(0, 100));
    });

    return () => ws.close();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await listExperiments();
        setExperiments(res.data);
        
        const now = new Date().toLocaleTimeString();
        setMetrics((prev) => {
          const totalRequests = res.data.reduce((sum, e) => sum + (e.total_requests || 0), 0);
          const totalErrors = res.data.reduce((sum, e) => sum + (e.error_count || 0), 0);
          const next = [...prev, { time: now, requests: totalRequests, errors: totalErrors }];
          return next.slice(-20);
        });
      } catch (e) {}
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getEventColor = (type) => {
    if (type.includes('started')) return 'primary';
    if (type.includes('completed')) return 'success';
    if (type.includes('failed') || type.includes('error')) return 'error';
    if (type.includes('stopped')) return 'warning';
    return 'default';
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>实时监控</Typography>

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>实时指标</Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="requests" stroke="#1976d2" name="总请求" />
                    <Line type="monotone" dataKey="errors" stroke="#dc004e" name="错误数" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>活跃实验</Typography>
              <Box>
                {experiments
                  .filter((e) => e.status === 'running')
                  .map((e) => (
                    <Box key={e.id} mb={2}>
                      <Typography variant="subtitle2">{e.name}</Typography>
                      <Chip label={e.type} size="small" sx={{ mr: 1 }} />
                      <Chip label={`请求: ${e.total_requests || 0}`} size="small" color="primary" sx={{ mr: 1 }} />
                      <Chip label={`错误: ${e.error_count || 0}`} size="small" color={e.error_count > 0 ? 'error' : 'default'} />
                    </Box>
                  ))}
                {experiments.filter((e) => e.status === 'running').length === 0 && (
                  <Typography color="text.secondary">暂无活跃实验</Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>事件流</Typography>
          <TableContainer component={Paper} sx={{ maxHeight: 400, bgcolor: 'transparent' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>时间</TableCell>
                  <TableCell>类型</TableCell>
                  <TableCell>详情</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((e, idx) => (
                  <TableRow key={idx}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {e.timestamp}
                    </TableCell>
                    <TableCell>
                      <Chip label={e.type} color={getEventColor(e.type)} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {typeof e.data === 'string' ? e.data : JSON.stringify(e.data).slice(0, 100)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      等待事件...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}

export default RealTimeMonitor;
