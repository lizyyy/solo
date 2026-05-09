import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip,
  Accordion, AccordionSummary, AccordionDetails,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { ExpandMore, PlayArrow, Preview } from '@mui/icons-material';
import {
  getMigrationTemplates, planMigration, executeMigration, dryRunMigration,
} from '../api';

const stepTypes = [
  { value: 'ddl', label: 'DDL（表结构变更）' },
  { value: 'dml', label: 'DML（数据变更）' },
  { value: 'index_build', label: '索引构建' },
  { value: 'constraint', label: '约束' },
  { value: 'data_check', label: '数据校验' },
];

function Migrations() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mig, setMig] = useState({
    name: '',
    version: '1.0.0',
    description: '',
    steps: [{
      name: '',
      type: 'ddl',
      description: '',
      up_sql: '',
      down_sql: '',
    }],
  });

  const { data: templates } = useQuery('templates', getMigrationTemplates);
  const [lastResult, setLastResult] = useState(null);

  const planMut = useMutation(planMigration, { onSuccess: (d) => setLastResult(d.data) });
  const execMut = useMutation(executeMigration, {
    onSuccess: (d) => {
      setLastResult(d.data);
      setOpen(false);
    },
  });
  const dryRunMut = useMutation(dryRunMigration, { onSuccess: (d) => setLastResult(d.data) });

  const addStep = () => {
    setMig({
      ...mig,
      steps: [...mig.steps, { name: '', type: 'ddl', description: '', up_sql: '', down_sql: '' }],
    });
  };

  const updateStep = (idx, field, value) => {
    const newSteps = [...mig.steps];
    newSteps[idx] = { ...newSteps[idx], [field]: value };
    setMig({ ...mig, steps: newSteps });
  };

  const removeStep = (idx) => {
    if (mig.steps.length > 1) {
      const newSteps = mig.steps.filter((_, i) => i !== idx);
      setMig({ ...mig, steps: newSteps });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">数据迁移</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          新建迁移
        </Button>
      </Box>

      <Grid container spacing={3} mb={4}>
        {(templates?.data || []).map((t) => (
          <Grid item xs={12} sm={6} md={3} key={t.id}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>{t.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t.description}
                </Typography>
                <Box>
                  {t.steps?.map((s, i) => (
                    <Chip key={i} label={s} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </Box>
                {t.risk && (
                  <Chip
                    label={`风险: ${t.risk.toUpperCase()}`}
                    color="warning"
                    size="small"
                    sx={{ mt: 1 }}
                  />
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {lastResult && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {lastResult.dry_run ? '预演结果 (Dry Run)' : '执行结果'}
            </Typography>
            
            <Box mb={2}>
              <Chip
                label={lastResult.result?.status || lastResult.plan?.risk_level || 'pending'}
                color={lastResult.result?.status === 'completed' ? 'success' : 'info'}
              />
              <Chip
                label={`预计时间: ${lastResult.plan?.estimated_time || 'N/A'}`}
                sx={{ ml: 1 }}
              />
            </Box>

            {lastResult.migration?.steps?.map((step, i) => (
              <Accordion key={i}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography>
                    Step {i + 1}: {step.name}
                    <Chip
                      label={step.type}
                      size="small"
                      sx={{ ml: 2 }}
                    />
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    Up SQL:
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      bgcolor: 'background.default',
                      p: 2,
                      borderRadius: 1,
                      overflowX: 'auto',
                      fontSize: 12,
                    }}
                  >
                    {step.up_sql || '(空)'}
                  </Box>
                  {step.down_sql && (
                    <>
                      <Typography variant="body2" color="text.secondary" mt={2} mb={1}>
                        Rollback SQL:
                      </Typography>
                      <Box
                        component="pre"
                        sx={{
                          bgcolor: 'background.default',
                          p: 2,
                          borderRadius: 1,
                          overflowX: 'auto',
                          fontSize: 12,
                        }}
                      >
                        {step.down_sql}
                      </Box>
                    </>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>配置数据迁移</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="迁移名称"
                value={mig.name}
                onChange={(e) => setMig({ ...mig, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="版本号"
                value={mig.version}
                onChange={(e) => setMig({ ...mig, version: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="描述"
                multiline
                rows={2}
                value={mig.description}
                onChange={(e) => setMig({ ...mig, description: e.target.value })}
              />
            </Grid>
          </Grid>

          <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>迁移步骤</Typography>
          
          {mig.steps.map((step, idx) => (
            <Card key={idx} sx={{ mb: 2 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={`步骤 ${idx + 1} 名称`}
                      value={step.name}
                      onChange={(e) => updateStep(idx, 'name', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>类型</InputLabel>
                      <Select
                        value={step.type}
                        label="类型"
                        onChange={(e) => updateStep(idx, 'type', e.target.value)}
                      >
                        {stepTypes.map((t) => (
                          <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Up SQL"
                      multiline
                      rows={3}
                      value={step.up_sql}
                      onChange={(e) => updateStep(idx, 'up_sql', e.target.value)}
                      placeholder="ALTER TABLE users ADD COLUMN email VARCHAR(255);"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Rollback SQL"
                      multiline
                      rows={2}
                      value={step.down_sql}
                      onChange={(e) => updateStep(idx, 'down_sql', e.target.value)}
                      placeholder="ALTER TABLE users DROP COLUMN email;"
                    />
                  </Grid>
                </Grid>
                {mig.steps.length > 1 && (
                  <Button color="error" size="small" onClick={() => removeStep(idx)} sx={{ mt: 1 }}>
                    删除此步骤
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          <Button onClick={addStep}>+ 添加步骤</Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button
            startIcon={<Preview />}
            onClick={() => dryRunMut.mutate(mig)}
            disabled={!mig.name || dryRunMut.isLoading}
          >
            预演 (Dry Run)
          </Button>
          <Button
            onClick={() => planMut.mutate(mig)}
            disabled={!mig.name || planMut.isLoading}
          >
            分析计划
          </Button>
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={() => execMut.mutate(mig)}
            disabled={!mig.name || execMut.isLoading}
            color="warning"
          >
            执行迁移
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Migrations;
