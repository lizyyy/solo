import { useState } from 'react';
import { useQuery } from 'react-query';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField,
  FormControl, InputLabel, Select, MenuItem, Alert,
} from '@mui/material';
import { Download } from '@mui/icons-material';
import { listExperiments, exportReport } from '../api';

function Reports() {
  const { data: experiments } = useQuery('experiments', listExperiments);
  const [selectedExp, setSelectedExp] = useState('');
  const [format, setFormat] = useState('json');
  const [error, setError] = useState('');

  const handleExport = async () => {
    try {
      const params = {
        experiment_id: selectedExp || undefined,
        format,
      };

      const res = await exportReport(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setError('');
    } catch (e) {
      setError('导出失败: ' + (e.response?.data?.error || e.message));
    }
  };

  const completedExps = (experiments?.data || []).filter(
    (e) => e.status === 'completed' || e.status === 'failed' || e.status === 'stopped'
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>报告导出</Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>导出报告</Typography>

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>选择实验</InputLabel>
                <Select
                  value={selectedExp}
                  label="选择实验"
                  onChange={(e) => setSelectedExp(e.target.value)}
                >
                  <MenuItem value="">全部（综合报告）</MenuItem>
                  {completedExps.map((e) => (
                    <MenuItem key={e.id} value={e.id}>
                      {e.name} ({e.status})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>导出格式</InputLabel>
                <Select
                  value={format}
                  label="导出格式"
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <MenuItem value="json">JSON</MenuItem>
                  <MenuItem value="markdown">Markdown</MenuItem>
                  <MenuItem value="html">HTML</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="contained"
                fullWidth
                startIcon={<Download />}
                onClick={handleExport}
              >
                导出报告
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>报告内容</Typography>
              
              <Typography variant="subtitle2" gutterBottom>生成的报告包含：</Typography>
              
              <Box component="ul" sx={{ pl: 2 }}>
                <Typography component="li" variant="body2" mb={1}>
                  健康评分 (0-100)
                </Typography>
                <Typography component="li" variant="body2" mb={1}>
                  成功率 / 错误率统计
                </Typography>
                <Typography component="li" variant="body2" mb={1}>
                  迁移步骤详细记录
                </Typography>
                <Typography component="li" variant="body2" mb={1}>
                  回滚日志（如有）
                </Typography>
                <Typography component="li" variant="body2" mb={1}>
                  混沌实验结果
                </Typography>
                <Typography component="li" variant="body2" mb={1}>
                  数据完整性检查结果
                </Typography>
                <Typography component="li" variant="body2" mb={1}>
                  智能建议与改进措施
                </Typography>
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                建议在执行数据迁移期间同时运行混沌实验，以验证系统在异常情况下的表现。
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>可用实验</Typography>
              <Box>
                {(experiments?.data || []).length === 0 ? (
                  <Typography color="text.secondary">
                    暂无历史实验数据。请先前往「混沌实验」创建实验。
                  </Typography>
                ) : (
                  <Box>
                    {(experiments?.data || []).map((e) => (
                      <Box
                        key={e.id}
                        sx={{
                          p: 2,
                          mb: 1,
                          bgcolor: 'background.default',
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="subtitle2">{e.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          类型: {e.type} | 状态: {e.status} | 
                          请求: {e.total_requests || 0} | 错误: {e.error_count || 0}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Reports;
