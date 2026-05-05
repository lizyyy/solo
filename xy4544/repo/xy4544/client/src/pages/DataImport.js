import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Upload,
  Button,
  message,
  Progress,
  Divider,
  Alert,
  Table,
  Tag,
  Statistic,
  Space,
} from 'antd';
import {
  UploadOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

const DataImport = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [dataStatus, setDataStatus] = useState(null);

  useEffect(() => {
    loadDataStatus();
  }, []);

  const loadDataStatus = async () => {
    try {
      const response = await api.sample.getStatus();
      setDataStatus(response.data);
    } catch (error) {
      console.error('获取数据状态失败:', error);
    }
  };

  const handleUpload = async (type, file) => {
    const formData = new FormData();
    formData.append(`${type}File`, file);

    setUploadProgress(prev => ({ ...prev, [type]: 0 }));

    try {
      let response;
      
      switch (type) {
        case 'sensor':
          response = await api.sensor.upload(formData, (progress) => {
            setUploadProgress(prev => ({ ...prev, [type]: progress }));
          });
          break;
        case 'inspection':
          response = await api.inspection.upload(formData, (progress) => {
            setUploadProgress(prev => ({ ...prev, [type]: progress }));
          });
          break;
        case 'alarm':
          response = await api.alarm.upload(formData, (progress) => {
            setUploadProgress(prev => ({ ...prev, [type]: progress }));
          });
          break;
        case 'complaint':
          response = await api.complaint.upload(formData, (progress) => {
            setUploadProgress(prev => ({ ...prev, [type]: progress }));
          });
          break;
      }

      message.success(response.data.message);
      setUploadProgress(prev => ({ ...prev, [type]: 100 }));
      loadDataStatus();
    } catch (error) {
      console.error('上传失败:', error);
      message.error(error.response?.data?.error || '上传失败');
      setUploadProgress(prev => ({ ...prev, [type]: 0 }));
    }
  };

  const importSampleData = async () => {
    setLoading(true);
    try {
      const response = await api.sample.import();
      message.success('示例数据导入成功');
      console.log('导入结果:', response.data);
      loadDataStatus();
    } catch (error) {
      console.error('导入示例数据失败:', error);
      message.error(error.response?.data?.error || '导入示例数据失败');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const response = await api.analysis.recalculate();
      message.success(response.data.message);
      loadDataStatus();
    } catch (error) {
      console.error('分析失败:', error);
      message.error(error.response?.data?.error || '分析失败');
    } finally {
      setAnalyzing(false);
    }
  };

  const clearAllData = async () => {
    setLoading(true);
    try {
      const response = await api.sample.clear();
      message.success('所有数据已清除');
      loadDataStatus();
    } catch (error) {
      console.error('清除数据失败:', error);
      message.error(error.response?.data?.error || '清除数据失败');
    } finally {
      setLoading(false);
    }
  };

  const uploadProps = (type) => ({
    name: `${type}File`,
    accept: '.csv',
    showUploadList: false,
    beforeUpload: (file) => {
      const isCSV = file.name.toLowerCase().endsWith('.csv');
      if (!isCSV) {
        message.error('只能上传 CSV 文件!');
        return Upload.LIST_IGNORE;
      }
      handleUpload(type, file);
      return false;
    },
  });

  const dataTypes = [
    {
      key: 'sensor',
      name: '温湿度传感器数据',
      description: '包含舱房号、时间戳、温度、湿度等字段的CSV文件',
      icon: <DatabaseOutlined />,
    },
    {
      key: 'inspection',
      name: '风机盘管巡检表',
      description: '包含舱房号、巡检日期、风机盘管状态、滤网状态等字段的CSV文件',
      icon: <CheckCircleOutlined />,
    },
    {
      key: 'alarm',
      name: '冷凝水报警数据',
      description: '包含舱房号、报警时间、报警类型、报警级别等字段的CSV文件',
      icon: <Alert type="warning" />,
    },
    {
      key: 'complaint',
      name: '乘客客诉数据',
      description: '包含舱房号、投诉时间、投诉类型、描述等字段的CSV文件',
      icon: <Alert type="error" />,
    },
  ];

  const statusColumns = [
    {
      title: '数据类型',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '记录数',
      dataIndex: 'count',
      key: 'count',
      render: (count) => (
        <span style={{ fontWeight: 'bold', color: count > 0 ? '#52c41a' : '#999' }}>
          {count}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'count',
      key: 'status',
      render: (count) => (
        count > 0 ? <Tag color="green">已加载</Tag> : <Tag color="default">未加载</Tag>
      ),
    },
  ];

  const statusData = dataStatus ? [
    { name: '舱房信息', count: dataStatus.data_status.cabins?.count || 0 },
    { name: '传感器数据', count: dataStatus.data_status.sensor_data?.count || 0 },
    { name: '巡检数据', count: dataStatus.data_status.inspections?.count || 0 },
    { name: '报警数据', count: dataStatus.data_status.alarms?.count || 0 },
    { name: '客诉数据', count: dataStatus.data_status.complaints?.count || 0 },
    { name: '分析结果', count: dataStatus.data_status.analysis?.count || 0 },
  ] : [];

  const hasData = dataStatus && dataStatus.has_sample_data;
  const hasAnalysis = dataStatus?.data_status?.analysis?.count > 0;

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>
        <UploadOutlined style={{ marginRight: 8 }} />
        数据导入
      </h2>

      <Alert
        message="CSV 文件格式要求"
        description={
          <div>
            <p>所有上传的 CSV 文件应包含以下字段（支持中英文列名）：</p>
            <ul>
              <li><strong>舱房号</strong> (cabin_number, cabin) - 必填</li>
              <li><strong>时间戳/日期</strong> (timestamp, time, date) - 必填</li>
              <li>其他字段根据数据类型有所不同</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card title="快速开始 - 导入示例数据" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p>系统包含预置的示例数据，包括：</p>
            <ul>
              <li>60 个舱房（3-8层甲板）</li>
              <li>完整的24小时温湿度传感器数据</li>
              <li>风机盘管巡检记录</li>
              <li>冷凝水报警记录</li>
              <li>乘客客诉记录</li>
              <li>包含高风险、中风险、误报等多种场景</li>
            </ul>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={<DatabaseOutlined />}
              onClick={importSampleData}
              loading={loading}
              disabled={hasData}
              style={{ marginBottom: 8 }}
            >
              {hasData ? '已导入示例数据' : '导入示例数据'}
            </Button>
            {hasData && (
              <div>
                <Tag color="green">数据已加载</Tag>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card title="当前数据状态" style={{ marginBottom: 24 }}>
        {dataStatus ? (
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Table
                columns={statusColumns}
                dataSource={statusData}
                rowKey="name"
                pagination={false}
                size="small"
              />
            </Col>
            <Col xs={24} lg={12}>
              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small">
                    <Statistic
                      title="总舱房数"
                      value={dataStatus.data_status.cabins?.count || 0}
                      prefix={<DatabaseOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small">
                    <Statistic
                      title="传感器记录"
                      value={dataStatus.data_status.sensor_data?.count || 0}
                      prefix={<DatabaseOutlined />}
                    />
                  </Card>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={runAnalysis}
                    loading={analyzing}
                    disabled={!hasData}
                    block
                  >
                    {hasAnalysis ? '重新分析' : '运行分析'}
                  </Button>
                </Col>
                <Col span={12}>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={clearAllData}
                    loading={loading}
                    disabled={!hasData}
                    block
                  >
                    清除所有数据
                  </Button>
                </Col>
              </Row>
            </Col>
          </Row>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>
            加载中...
          </div>
        )}
      </Card>

      <Card title="手动上传数据文件">
        <Row gutter={16}>
          {dataTypes.map((type) => (
            <Col xs={24} sm={12} lg={6} key={type.key}>
              <Card
                size="small"
                style={{ marginBottom: 16 }}
                bodyStyle={{ textAlign: 'center' }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>
                  {type.icon}
                </div>
                <h4 style={{ marginBottom: 8 }}>{type.name}</h4>
                <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                  {type.description}
                </p>
                <Upload {...uploadProps(type.key)}>
                  <Button icon={<UploadOutlined />}>
                    上传 CSV
                  </Button>
                </Upload>
                {uploadProgress[type.key] !== undefined && uploadProgress[type.key] > 0 && (
                  <Progress
                    percent={uploadProgress[type.key]}
                    size="small"
                    style={{ marginTop: 8 }}
                    status={uploadProgress[type.key] === 100 ? 'success' : 'active'}
                  />
                )}
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {hasAnalysis && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Space>
            <Button type="primary" onClick={() => navigate('/')}>
              查看仪表板
            </Button>
            <Button onClick={() => navigate('/analysis')}>
              查看分析结果
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
};

export default DataImport;
