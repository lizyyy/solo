import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField,
  Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton,
} from '@mui/material';
import { PlayArrow, Stop, Description } from '@mui/icons-material';
import {
  getChaosTypes, listExperiments, startExperiment, stopExperiment,
} from '../api';

function ChaosExperiments() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newExp, setNewExp] = useState({
    name: '',
    type: 'high_concurrency',
    config: {
      duration: 60,
      concurrent_users: 100,
      requests_per_second: 100,
    },
  });

  const { data: types } = useQuery('chaosTypes', getChaosTypes);
  const { data: experiments } = useQuery('experiments', listExperiments, { refetchInterval: 2000 });

  const startMutation = useMutation(startExperiment, {
    onSuccess: () => {
      queryClient.invalidateQueries('experiments');
      setOpen(false);
    },
  });

  const stopMutation = useMutation(stopExperiment, {
    onSuccess: () => queryClient.invalidateQueries('experiments'),
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'primary';
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'stopped': return 'warning';
      default: return 'default';
    }
  };

  const handleStart = () => {
    const config = {
      ...newExp.config,
      duration: newExp.config.duration ? `${newExp.config.duration}s` : undefined,
    };
    startMutation.mutate({ name: newExp.name, type: newExp.type, config });
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">混沌实验</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          创建实验
        </Button>
      </Box>

      <Grid container spacing={3} mb={4}>
        {(types?.data || []).map((t) => (
          <Grid item xs={12} sm={6} md={3} key={t.type}>
            <Card sx={{
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
              border: t.risk === 'critical' ? '1px solid #dc004e' : t.risk === 'high' ? '1px solid #fd7e14' : 'none',
            }}
            onClick={() => { setNewExp({ ...newExp, type: t.type }); setOpen(true); }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>{t.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t.description}
                </Typography>
                <Chip
                  label={t.risk.toUpperCase()}
                  color={t.risk === 'critical' ? 'error' : t.risk === 'high' ? 'warning' : 'info'}
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>实验列表</Typography>
          <TableContainer component={Paper} sx={{ bgcolor: 'transparent' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>名称</TableCell>
                  <TableCell>类型</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>请求数</TableCell>
                  <TableCell>错误数</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(experiments?.data || []).map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {exp.id?.slice(-8)}
                    </TableCell>
                    <TableCell>{exp.name}</TableCell>
                    <TableCell>{exp.type}</TableCell>
                    <TableCell>
                      <Chip label={exp.status} color={getStatusColor(exp.status)} size="small" />
                    </TableCell>
                    <TableCell>{exp.total_requests || 0}</TableCell>
                    <TableCell>{exp.error_count || 0}</TableCell>
                    <TableCell>
                      {exp.status === 'running' ? (
                        <IconButton color="error" onClick={() => stopMutation.mutate(exp.id)}>
                          <Stop />
                        </IconButton>
                      ) : (
                        <IconButton color="info">
                          <Description />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!experiments?.data || experiments.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      暂无实验，点击上方「创建实验」开始
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>创建混沌实验</DialogTitle>
        <DialogContent>
          <Box pt={1}>
            <TextField
              fullWidth
              label="实验名称"
              value={newExp.name}
              onChange={(e) => setNewExp({ ...newExp, name: e.target.value })}
              sx={{ mb: 2 }}
            />
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>实验类型</InputLabel>
              <Select
                value={newExp.type}
                label="实验类型"
                onChange={(e) => setNewExp({ ...newExp, type: e.target.value })}
              >
                {(types?.data || []).map((t) => (
                  <MenuItem key={t.type} value={t.type}>{t.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label="持续时间（秒）"
              value={newExp.config.duration}
              onChange={(e) => setNewExp({
                ...newExp,
                config: { ...newExp.config, duration: parseInt(e.target.value) || 0 }
              })}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              type="number"
              label="并发用户数"
              value={newExp.config.concurrent_users}
              onChange={(e) => setNewExp({
                ...newExp,
                config: { ...newExp.config, concurrent_users: parseInt(e.target.value) || 0 }
              })}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              type="number"
              label="每秒请求数"
              value={newExp.config.requests_per_second}
              onChange={(e) => setNewExp({
                ...newExp,
                config: { ...newExp.config, requests_per_second: parseInt(e.target.value) || 0 }
              })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleStart}
            disabled={!newExp.name || startMutation.isLoading}
            startIcon={<PlayArrow />}
          >
            启动实验
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ChaosExperiments;
