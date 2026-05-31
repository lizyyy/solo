import React, { useState, useCallback } from 'react';
import {
  Card,
  Upload,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Alert,
  Divider,
  List,
  Typography,
  Row,
  Col,
} from 'antd';
import {
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { showSuccess, showError } from '../utils/api.js';

const { Text, Link } = Typography;

function ImportPage() {
  const [uploading, setUploading] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [showTemplate, setShowTemplate] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleUpload = useCallback(async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await api.post('/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setLastResult(result);
      showSuccess(result.user_message || '导入成功！');

      Modal.success({
        title: '导入完成',
        content: (
          <div>
            <p>{result.user_message}</p>
            <Divider />
            <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
              <div>
                <Text strong style={{ fontSize: 24, color: '#52c41a' }}>
                  {result.success_rows}
                </Text>
                <br />
                <Text type="secondary">成功</Text>
              </div>
              <div>
                <Text strong style={{ fontSize: 24, color: result.failed_rows > 0 ? '#ff4d4f' : '#9ca3af' }}>
                  {result.failed_rows}
                </Text>
                <br />
                <Text type="secondary">失败</Text>
              </div>
              <div>
                <Text strong style={{ fontSize: 24, color: '#1677ff' }}>
                  {result.total_rows}
                </Text>
                <br />
                <Text type="secondary">总计</Text>
              </div>
            </div>
            {result.errors && result.errors.length > 0 && (
              <div>
                <Text type="danger" strong>错误详情（前10条）：</Text>
                <List
                  size="small"
                  dataSource={result.errors.slice(0, 10)}
                  renderItem={(item) => (
                    <List.Item>
                      <Text type="danger">{item}</Text>
                    </List.Item>
                  )}
                />
              </div>
            )}
          </div>
        ),
      });

      loadImportHistory();
    } catch (error) {
      console.error('导入失败:', error);
    } finally {
      setUploading(false);
    }

    return false;
  }, []);

  const loadImportHistory = async () => {
    try {
      const data = await api.get('/history/imports', { params: { page_size: 10 } });
      setImportHistory(data.items || []);
    } catch (error) {
      console.error('加载导入历史失败:', error);
    }
  };

  React.useEffect(() => {
    loadImportHistory();
  }, []);

  const downloadTemplate = () => {
    const XLSX = require('xlsx');
    const data = [
      {
        '日期': '2024-01-15',
        '餐次': '午餐',
        '菜品分类': '热菜',
        '菜品名称': '红烧肉',
        '预测份数': 100,
        '实际份数': 95,
        '单位': '份',
        '单价': 15.0,
        '备注': '招牌菜',
      },
      {
        '日期': '2024-01-15',
        '餐次': '午餐',
        '菜品分类': '主食',
        '菜品名称': '米饭',
        '预测份数': 200,
        '实际份数': 190,
        '单位': '份',
        '单价': 2.0,
        '备注': '',
      },
      {
        '日期': '2024-01-15',
        '餐次': '晚餐',
        '菜品分类': '汤品',
        '菜品名称': '西红柿鸡蛋汤',
        '预测份数': 80,
        '实际份数': 75,
        '单位': '份',
        '单价': 5.0,
        '备注': '',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '备餐数据');
    XLSX.writeFile(wb, '食堂备餐数据导入模板.xlsx');
    showSuccess('模板已下载');
  };

  const historyColumns = [
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      ellipsis: true,
    },
    {
      title: '文件类型',
      dataIndex: 'file_type',
      key: 'file_type',
      width: 100,
      render: (type) => (
        <Tag icon={<FileExcelOutlined />} color="green">
          {type.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '总行数',
      dataIndex: 'total_rows',
      key: 'total_rows',
      width: 80,
      align: 'center',
    },
    {
      title: '成功',
      dataIndex: 'success_rows',
      key: 'success_rows',
      width: 80,
      align: 'center',
      render: (val) => <Text strong style={{ color: '#52c41a' }}>{val}</Text>,
    },
    {
      title: '失败',
      dataIndex: 'failed_rows',
      key: 'failed_rows',
      width: 80,
      align: 'center',
      render: (val) => val > 0 ? <Text strong type="danger">{val}</Text> : val,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colorMap = {
          completed: 'green',
          partial: 'orange',
          failed: 'red',
          processing: 'blue',
        };
        const textMap = {
          completed: '成功',
          partial: '部分成功',
          failed: '失败',
          processing: '处理中',
        };
        const iconMap = {
          completed: <CheckCircleOutlined />,
          partial: <InfoCircleOutlined />,
          failed: <CloseCircleOutlined />,
          processing: <UploadOutlined />,
        };
        return (
          <Tag icon={iconMap[status]} color={colorMap[status]}>
            {textMap[status]}
          </Tag>
        );
      },
    },
    {
      title: '导入时间',
      dataIndex: 'imported_at',
      key: 'imported_at',
      width: 170,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  const uploadProps = {
    beforeUpload: handleUpload,
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    multiple: false,
    maxCount: 1,
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">数据导入</h1>
        <p className="page-subtitle">导入历史用餐数据，用于训练预测模型和对比分析</p>
      </div>

      <Alert
        message="导入说明"
        description={
          <div>
            <p>• 支持 Excel（.xlsx/.xls）和 CSV 格式文件</p>
            <p>• 必需列：<Tag color="red">日期</Tag>、<Tag color="red">餐次</Tag>、<Tag color="red">菜品名称</Tag></p>
            <p>• 可选列：菜品分类、预测份数、实际份数、单位、单价、备注</p>
            <p>• 餐次支持多种写法：早餐/早饭/早、午餐/中饭/午、晚餐/晚饭/晚</p>
            <p>• 重复导入相同日期、餐次、菜品的记录会自动更新，不会重复</p>
            <p>• 建议先下载模板，按照模板格式整理数据后再导入</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card className="card-section" title="上传文件">
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Upload.Dragger
                {...uploadProps}
                style={{ marginBottom: 20 }}
                className={uploading ? 'import-dragover' : ''}
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined style={{ fontSize: 48, color: '#1677ff' }} />
                </p>
                <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500 }}>
                  点击或拖拽文件到此处上传
                </p>
                <p className="ant-upload-hint" style={{ color: '#9ca3af' }}>
                  支持 .xlsx、.xls、.csv 格式，单个文件不超过 10MB
                </p>
              </Upload.Dragger>

              <Space wrap style={{ justifyContent: 'center', marginTop: 20 }}>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={downloadTemplate}
                >
                  下载导入模板
                </Button>
                <Button
                  icon={<InfoCircleOutlined />}
                  onClick={() => setShowTemplate(true)}
                >
                  查看格式说明
                </Button>
              </Space>

              {uploading && (
                <Alert
                  message="正在导入中..."
                  description="请耐心等待，导入完成后会自动刷新列表"
                  type="info"
                  showIcon
                  style={{ marginTop: 20 }}
                />
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card className="card-section" title="最近导入记录">
            <Table
              columns={historyColumns}
              dataSource={importHistory}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 600 }}
              locale={{
                emptyText: (
                  <div className="empty-state">
                    <div className="empty-icon">📁</div>
                    <p>暂无导入记录</p>
                    <p style={{ fontSize: 12 }}>上传文件后会在这里显示</p>
                  </div>
                ),
              }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="导入格式说明"
        open={showTemplate}
        onCancel={() => setShowTemplate(false)}
        footer={[
          <Button key="close" onClick={() => setShowTemplate(false)}>
            关闭
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={downloadTemplate}
          >
            下载模板
          </Button>,
        ]}
        width={700}
      >
        <div className="modal-description">
          <p>请确保您的Excel或CSV文件包含以下列。列名可以是中文或英文，系统会自动识别。</p>
        </div>

        <Table
          size="small"
          pagination={false}
          dataSource={[
            { field: '日期', required: true, example: '2024-01-15', desc: '用餐日期，支持 YYYY-MM-DD 或 Excel 日期格式' },
            { field: '餐次', required: true, example: '午餐', desc: '早/午/晚餐，支持多种写法' },
            { field: '菜品名称', required: true, example: '红烧肉', desc: '具体的菜品名称' },
            { field: '菜品分类', required: false, example: '热菜', desc: '热菜/主食/汤品/冷菜/小吃等' },
            { field: '预测份数', required: false, example: '100', desc: '预测的销售份数，整数' },
            { field: '实际份数', required: false, example: '95', desc: '实际销售份数，整数' },
            { field: '单位', required: false, example: '份', desc: '计量单位，默认为"份"' },
            { field: '单价', required: false, example: '15.00', desc: '单份价格，元' },
            { field: '备注', required: false, example: '招牌菜', desc: '其他说明信息' },
          ]}
          columns={[
            {
              title: '列名',
              dataIndex: 'field',
              key: 'field',
              render: (text, record) => (
                <Space>
                  <Text strong>{text}</Text>
                  {record.required && <Tag color="red" size="small">必需</Tag>}
                  {!record.required && <Tag color="default" size="small">可选</Tag>}
                </Space>
              ),
            },
            { title: '示例', dataIndex: 'example', key: 'example' },
            { title: '说明', dataIndex: 'desc', key: 'desc' },
          ]}
        />

        <Alert
          message="小贴士"
          description="如果您的文件中日期、餐次、菜品都相同的多条记录，系统会自动更新已有的记录，不会创建重复数据。"
          type="success"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Modal>
    </div>
  );
}

export default ImportPage;
