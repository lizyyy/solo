import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Upload, 
  Button, 
  message, 
  Progress, 
  List, 
  Tag, 
  Alert,
  Space,
  Divider,
  Select,
  Input,
  Row,
  Col,
  Descriptions
} from 'antd';
import { 
  InboxOutlined, 
  UploadOutlined, 
  DeleteOutlined, 
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { fileApi, incidentApi } from '../services/api';

const { Dragger } = Upload;
const { Option } = Select;
const { TextArea } = Input;

const FileUpload = () => {
  const navigate = useNavigate();
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [incidentId, setIncidentId] = useState(null);
  const [createNewIncident, setCreateNewIncident] = useState(true);
  const [existingIncidents, setExistingIncidents] = useState([]);
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [uploadResults, setUploadResults] = useState(null);

  useEffect(() => {
    loadExistingIncidents();
  }, []);

  const loadExistingIncidents = async () => {
    try {
      const response = await incidentApi.getAll();
      if (response.success) {
        setExistingIncidents(response.data || []);
      }
    } catch (error) {
      console.error('加载事故列表失败:', error);
    }
  };

  const getFileStatusIcon = (status) => {
    switch (status) {
      case 'PARSED':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'PARSING':
        return <Progress type="circle" percent={50} size={20} />;
      case 'FAILED':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PARSED':
        return 'success';
      case 'PARSING':
        return 'processing';
      case 'FAILED':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择要上传的文件');
      return;
    }

    if (createNewIncident && !incidentTitle.trim()) {
      message.warning('请输入事故标题');
      return;
    }

    setUploading(true);
    try {
      let targetIncidentId = incidentId;
      
      // 如果创建新事故
      if (createNewIncident) {
        const newIncident = {
          title: incidentTitle.trim(),
          description: incidentDescription.trim() || null,
          status: 'OPEN'
        };
        
        const createResponse = await incidentApi.create(newIncident);
        if (createResponse.success) {
          targetIncidentId = createResponse.data.id;
        } else {
          throw new Error(createResponse.message || '创建事故失败');
        }
      }

      // 上传文件
      const files = fileList.map(item => item.originFileObj);
      const uploadResponse = await fileApi.uploadMultiple(files, targetIncidentId);
      
      if (uploadResponse.success) {
        setUploadResults(uploadResponse.data);
        message.success('上传成功');
        
        // 清空表单
        setFileList([]);
        setIncidentTitle('');
        setIncidentDescription('');
        
        // 延迟跳转到事故详情
        setTimeout(() => {
          navigate(`/incidents/${targetIncidentId}`);
        }, 2000);
      } else {
        message.error(uploadResponse.message || '上传失败');
      }
    } catch (error) {
      console.error('上传失败:', error);
      message.error(error.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const uploadProps = {
    multiple: true,
    fileList,
    beforeUpload: (file) => {
      const isLt100M = file.size / 1024 / 1024 < 100;
      if (!isLt100M) {
        message.error('文件大小不能超过 100MB');
        return false;
      }
      
      // 检查文件名是否符合要求
      const fileName = file.name.toLowerCase();
      const validPatterns = [
        /incident\.json$/i,
        /gc\.log$/i,
        /gc\.log\.\d+$/i,
        /thread.*dump/i,
        /thread.*stack/i,
        /slow.*request/i,
        /access.*log/i,
        /io.*block/i,
        /network.*rtt/i
      ];
      
      const isValid = validPatterns.some(pattern => pattern.test(fileName));
      if (!isValid) {
        message.warning(`文件 ${file.name} 可能不是支持的类型，但仍会尝试解析`);
      }
      
      // 不自动上传
      return false;
    },
    onChange: ({ fileList: newFileList }) => {
      setFileList(newFileList);
    },
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    }
  };

  return (
    <div>
      <Card title="上传性能数据文件">
        <Alert
          message="支持的文件类型"
          description={
            <div>
              <Space wrap>
                <Tag color="blue">incident.json</Tag>
                <Tag color="orange">gc.log</Tag>
                <Tag color="green">thread-dump</Tag>
                <Tag color="purple">slow-request</Tag>
                <Tag color="cyan">io-block</Tag>
                <Tag color="magenta">network-rtt</Tag>
              </Space>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card title="目标事故" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Select
                  style={{ width: '100%' }}
                  value={createNewIncident ? 'new' : incidentId}
                  onChange={(value) => {
                    if (value === 'new') {
                      setCreateNewIncident(true);
                      setIncidentId(null);
                    } else {
                      setCreateNewIncident(false);
                      setIncidentId(value);
                    }
                  }}
                >
                  <Option value="new">创建新事故</Option>
                  {existingIncidents.map(incident => (
                    <Option key={incident.id} value={incident.id}>
                      {incident.title} ({incident.status})
                    </Option>
                  ))}
                </Select>

                {createNewIncident && (
                  <>
                    <Input
                      placeholder="事故标题 *"
                      value={incidentTitle}
                      onChange={(e) => setIncidentTitle(e.target.value)}
                    />
                    <TextArea
                      placeholder="事故描述（可选）"
                      value={incidentDescription}
                      onChange={(e) => setIncidentDescription(e.target.value)}
                      rows={3}
                    />
                  </>
                )}

                {!createNewIncident && incidentId && (
                  <Descriptions size="small" column={1}>
                    {existingIncidents.filter(i => i.id === incidentId).map(incident => (
                      <React.Fragment key={incident.id}>
                        <Descriptions.Item label="标题">{incident.title}</Descriptions.Item>
                        <Descriptions.Item label="状态">
                          <Tag color={incident.status === 'OPEN' ? 'red' : 'green'}>
                            {incident.status}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="创建时间">
                          {incident.createdAt ? dayjs(incident.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
                        </Descriptions.Item>
                      </React.Fragment>
                    ))}
                  </Descriptions>
                )}
              </Space>
            </Card>
          </Col>

          <Col span={12}>
            <Card title="上传说明" size="small">
              <List
                size="small"
                dataSource={[
                  '支持单次上传多个文件',
                  '文件大小限制：单文件不超过 100MB',
                  '系统会自动识别文件类型并解析',
                  '解析完成后会生成时间线和瓶颈排序',
                  '可以将多个相关文件关联到同一个事故'
                ]}
                renderItem={(item) => <List.Item>{item}</List.Item>}
              />
            </Card>
          </Col>
        </Row>

        <Divider />

        <Dragger {...uploadProps} accept=".json,.log,.txt">
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 incident.json、gc.log、thread-dump、slow-request、io-block、network-rtt 等格式
          </p>
        </Dragger>

        {fileList.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Divider>已选择的文件</Divider>
            <List
              dataSource={fileList}
              renderItem={(file) => (
                <List.Item
                  actions={[
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        const index = fileList.indexOf(file);
                        const newFileList = fileList.slice();
                        newFileList.splice(index, 1);
                        setFileList(newFileList);
                      }}
                    />
                  ]}
                >
                  <List.Item.Meta
                    avatar={getFileStatusIcon(file.status)}
                    title={file.name}
                    description={
                      <Space>
                        <span>{(file.size / 1024).toFixed(2)} KB</span>
                        {file.status && (
                          <Tag color={getStatusColor(file.status)}>{file.status}</Tag>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => navigate('/incidents')}>
              返回列表
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={handleUpload}
              loading={uploading}
              disabled={fileList.length === 0}
            >
              开始上传并解析
            </Button>
          </Space>
        </div>

        {uploadResults && (
          <div style={{ marginTop: 16 }}>
            <Alert
              message="上传结果"
              type={uploadResults.failedCount > 0 ? 'warning' : 'success'}
              showIcon
              description={
                <div>
                  <p>成功解析: {uploadResults.successCount} 个文件</p>
                  {uploadResults.failedCount > 0 && (
                    <p>解析失败: {uploadResults.failedCount} 个文件</p>
                  )}
                  {uploadResults.results && uploadResults.results.length > 0 && (
                    <List
                      size="small"
                      style={{ marginTop: 8 }}
                    >
                      {uploadResults.results.map((result, index) => (
                        <List.Item key={index}>
                          <Space>
                            <Tag color={result.parsed ? 'success' : 'error'}>
                              {result.parsed ? '解析成功' : '解析失败'}
                            </Tag>
                            <span>{result.fileName}</span>
                            {result.message && <span style={{ color: '#8c8c8c' }}>{result.message}</span>}
                          </Space>
                        </List.Item>
                      ))}
                    </List>
                  )}
                  <p style={{ marginTop: 8, color: '#1890ff' }}>
                    正在跳转到事故详情页面...
                  </p>
                </div>
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default FileUpload;
