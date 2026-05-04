import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  LinearProgress,
  Chip,
  Divider,
  Alert,
  Paper,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  UploadFile as UploadIcon,
  Delete as DeleteIcon,
  Description as DocIcon,
  Code as CodeIcon,
  Note as NoteIcon,
  Dashboard as DashboardIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

import useAppStore from '../store/appStore';

const fileTypes = {
  conversations: {
    label: '对话记录',
    extension: '.jsonl',
    description: 'JSONL 格式的对话消息',
    icon: <CodeIcon />,
    color: 'primary'
  },
  docs: {
    label: '文档资料',
    extension: '.md',
    description: 'Markdown 格式的参考文档',
    icon: <DocIcon />,
    color: 'success'
  },
  toolResults: {
    label: '工具结果',
    extension: '.json',
    description: 'JSON 格式的工具调用结果',
    icon: <NoteIcon />,
    color: 'secondary'
  },
  budget: {
    label: '预算约束',
    extension: '.yaml',
    description: 'YAML 格式的预算和约束配置',
    icon: <DashboardIcon />,
    color: 'warning'
  }
};

function FileUpload() {
  const navigate = useNavigate();
  const [selectedTask, setSelectedTask] = useState('');
  const [files, setFiles] = useState({
    conversations: null,
    docs: null,
    toolResults: null,
    budget: null
  });
  const [fileContents, setFileContents] = useState({
    conversations: '',
    docs: '',
    toolResults: '',
    budget: ''
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  
  const tasks = useAppStore((state) => state.tasks);
  const currentContextPackage = useAppStore((state) => state.currentContextPackage);
  const uploadContext = useAppStore((state) => state.uploadContext);
  const createTask = useAppStore((state) => state.createTask);
  const fetchTasks = useAppStore((state) => state.fetchTasks);
  const strategies = useAppStore((state) => state.strategies);

  const handleFileSelect = (type) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const config = fileTypes[type];
    if (!file.name.endsWith(config.extension)) {
      setError(`文件类型错误，请上传 ${config.extension} 格式的文件`);
      return;
    }

    setFiles(prev => ({ ...prev, [type]: file }));
    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileContents(prev => ({ ...prev, [type]: event.target.result }));
    };
    reader.readAsText(file);
  };

  const handleRemoveFile = (type) => {
    setFiles(prev => ({ ...prev, [type]: null }));
    setFileContents(prev => ({ ...prev, [type]: '' }));
  };

  const handleCreateTask = async () => {
    if (!newTaskName.trim()) {
      setError('请输入任务名称');
      return;
    }

    try {
      const task = await createTask({
        name: newTaskName,
        description: newTaskDesc
      });
      setSelectedTask(task.id);
      setShowCreateTask(false);
      setNewTaskName('');
      setNewTaskDesc('');
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.error || '创建任务失败');
    }
  };

  const handleUpload = async () => {
    const hasFiles = Object.values(files).some(f => f !== null);
    if (!hasFiles) {
      setError('请至少上传一个文件');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    
    if (selectedTask) {
      formData.append('taskId', selectedTask);
    }

    Object.entries(files).forEach(([key, file]) => {
      if (file) {
        formData.append(key, file);
      }
    });

    try {
      const result = await uploadContext(formData, (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        setUploadProgress(percentCompleted);
      });

      setUploading(false);
      setUploadProgress(100);
      
      if (result && result.id) {
        setTimeout(() => {
          navigate('/evaluation');
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.error || '上传失败');
      setUploading(false);
    }
  };

  const formatJsonlPreview = (content) => {
    if (!content) return '';
    const lines = content.trim().split('\n').slice(0, 10);
    return lines.map(line => {
      try {
        return JSON.stringify(JSON.parse(line), null, 2);
      } catch {
        return line;
      }
    }).join('\n\n...');
  };

  const truncateContent = (content, maxLines = 50) => {
    if (!content) return '';
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content;
    return lines.slice(0, maxLines).join('\n') + '\n\n... (内容已截断，共 ' + lines.length + ' 行)';
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        上传文件
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            选择任务 (可选)
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <FormControl fullWidth>
              <InputLabel>关联任务</InputLabel>
              <Select
                value={selectedTask}
                label="关联任务"
                onChange={(e) => setSelectedTask(e.target.value)}
              >
                <MenuItem value="">
                  <em>不关联任务</em>
                </MenuItem>
                {tasks.map((task) => (
                  <MenuItem key={task.id} value={task.id}>
                    {task.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowCreateTask(true)}
              sx={{ minWidth: 120 }}
            >
              新建任务
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Typography variant="h6" gutterBottom>
        上传上下文文件
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {Object.entries(fileTypes).map(([key, config]) => (
          <Card key={key} sx={{ border: files[key] ? 2 : 0, borderColor: `${config.color}.main` }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box sx={{ mr: 2, color: `${config.color}.main` }}>
                  {config.icon}
                </Box>
                <Box>
                  <Typography variant="subtitle1">
                    {config.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {config.description} ({config.extension})
                  </Typography>
                </Box>
              </Box>

              {files[key] ? (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Chip 
                      label={files[key].name}
                      size="small"
                      color={config.color}
                      onDelete={() => handleRemoveFile(key)}
                      deleteIcon={<DeleteIcon />}
                    />
                    <Button
                      size="small"
                      onClick={() => setPreviewFile({ type: key, content: fileContents[key] })}
                    >
                      预览
                    </Button>
                  </Box>
                  <Box sx={{ maxHeight: 150, overflow: 'auto', bgcolor: 'grey.50', p: 1, borderRadius: 1 }}>
                    {key === 'conversations' ? (
                      <SyntaxHighlighter 
                        language="json" 
                        style={materialLight}
                        customStyle={{ margin: 0, fontSize: 12 }}
                      >
                        {formatJsonlPreview(fileContents[key])}
                      </SyntaxHighlighter>
                    ) : key === 'toolResults' ? (
                      <SyntaxHighlighter 
                        language="json" 
                        style={materialLight}
                        customStyle={{ margin: 0, fontSize: 12 }}
                      >
                        {truncateContent(fileContents[key])}
                      </SyntaxHighlighter>
                    ) : key === 'budget' ? (
                      <SyntaxHighlighter 
                        language="yaml" 
                        style={materialLight}
                        customStyle={{ margin: 0, fontSize: 12 }}
                      >
                        {truncateContent(fileContents[key])}
                      </SyntaxHighlighter>
                    ) : (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {truncateContent(fileContents[key])}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ) : (
                <Box>
                  <input
                    accept={config.extension}
                    style={{ display: 'none' }}
                    id={`file-upload-${key}`}
                    type="file"
                    onChange={handleFileSelect(key)}
                  />
                  <label htmlFor={`file-upload-${key}`}>
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<UploadIcon />}
                      fullWidth
                    >
                      选择文件
                    </Button>
                  </label>
                </Box>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>

      {uploading && (
        <Box sx={{ mt: 3, mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            上传进度: {uploadProgress}%
          </Typography>
          <LinearProgress variant="determinate" value={uploadProgress} />
        </Box>
      )}

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          onClick={() => {
            setFiles({ conversations: null, docs: null, toolResults: null, budget: null });
            setFileContents({ conversations: '', docs: '', toolResults: '', budget: '' });
          }}
        >
          重置
        </Button>
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={uploading || !Object.values(files).some(f => f)}
          startIcon={<UploadIcon />}
        >
          {uploading ? '上传中...' : '上传并分析'}
        </Button>
      </Box>

      <Dialog 
        open={!!previewFile} 
        onClose={() => setPreviewFile(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          文件预览 - {previewFile ? fileTypes[previewFile.type]?.label : ''}
        </DialogTitle>
        <DialogContent dividers>
          {previewFile && (
            <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
              {previewFile.type === 'conversations' ? (
                <SyntaxHighlighter 
                  language="json" 
                  style={materialLight}
                  customStyle={{ margin: 0 }}
                >
                  {formatJsonlPreview(previewFile.content)}
                </SyntaxHighlighter>
              ) : previewFile.type === 'toolResults' ? (
                <SyntaxHighlighter 
                  language="json" 
                  style={materialLight}
                  customStyle={{ margin: 0 }}
                >
                  {previewFile.content}
                </SyntaxHighlighter>
              ) : previewFile.type === 'budget' ? (
                <SyntaxHighlighter 
                  language="yaml" 
                  style={materialLight}
                  customStyle={{ margin: 0 }}
                >
                  {previewFile.content}
                </SyntaxHighlighter>
              ) : (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {previewFile.content}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewFile(null)}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showCreateTask} onClose={() => setShowCreateTask(false)}>
        <DialogTitle>新建任务</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, minWidth: 400 }}>
            <TextField
              autoFocus
              margin="dense"
              label="任务名称"
              fullWidth
              variant="outlined"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
            />
            <TextField
              margin="dense"
              label="描述 (可选)"
              fullWidth
              variant="outlined"
              multiline
              rows={3}
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateTask(false)}>取消</Button>
          <Button onClick={handleCreateTask} variant="contained">
            创建
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default FileUpload;
