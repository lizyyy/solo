import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  DatePicker,
  Select,
  Button,
  Switch,
  Alert,
  Row,
  Col,
  Descriptions,
  Modal,
  Radio,
  Space,
  Tag,
  Statistic,
  Table,
  Divider,
} from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { showSuccess, showError } from '../utils/api.js';

const { RangePicker } = DatePicker;
const { Option } = Select;

function ExportPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [currentFilters, setCurrentFilters] = useState(null);

  useEffect(() => {
    loadModelInfo();
    loadCategories();
  }, []);

  const loadModelInfo = async () => {
    try {
      const info = await api.get('/model/info');
      setModelInfo(info);
    } catch (error) {
      console.error('加载模型信息失败:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await api.get('/records', { params: { page_size: 9999 } });
      const cats = new Set();
      (data.items || []).forEach(item => {
        if (item.category) cats.add(item.category);
      });
      setCategories(Array.from(cats));
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };

  const handlePreview = async (values) => {
    setLoading(true);
    try {
      const params = {
        page_size: 9999,
      };

      if (values.date_range && values.date_range.length === 2) {
        params.start_date = values.date_range[0].format('YYYY-MM-DD');
        params.end_date = values.date_range[1].format('YYYY-MM-DD');
      }
      if (values.meal_types && values.meal_types.length > 0) {
        params.meal_type = values.meal_types[0];
      }
      if (values.categories && values.categories.length > 0) {
        params.keyword = values.categories[0];
      }

      const data = await api.get('/records', { params });
      const items = data.items || [];

      const stats = {
        total: items.length,
        predicted: items.filter(r => r.predicted_count > 0).length,
        reviewed: items.filter(r => r.is_reviewed).length,
        totalAmount: items.reduce((sum, r) => sum + (r.actual_count * r.price || 0), 0),
      };

      setPreviewData({
        records: items.slice(0, 5),
        stats,
        dateRange: values.date_range,
        mealTypes: values.meal_types,
        categories: values.categories,
        includeModelInfo: values.include_model_info,
        format: values.format,
      });

      setCurrentFilters({
        start_date: values.date_range ? values.date_range[0].format('YYYY-MM-DD') : null,
        end_date: values.date_range ? values.date_range[1].format('YYYY-MM-DD') : null,
        meal_types: values.meal_types,
        categories: values.categories,
      });

    } catch (error) {
      console.error('预览失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!previewData) {
      showError('请先点击「预览导出内容」确认导出范围');
      return;
    }

    setLoading(true);
    try {
      const requestData = {
        start_date: currentFilters?.start_date,
        end_date: currentFilters?.end_date,
        meal_types: currentFilters?.meal_types,
        categories: currentFilters?.categories,
        include_model_info: previewData.includeModelInfo,
        format: previewData.format,
      };

      const response = await api.post('/export', requestData, {
        responseType: 'blob',
      });

      const blob = new Blob([response], {
        type: previewData.format === 'csv'
          ? 'text/csv;charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = URL.createObjectURL(blob);
      const timestamp = dayjs().format('YYYYMMDD_HHmmss');
      const ext = previewData.format === 'csv' ? 'csv' : 'xlsx';
      const filename = `食堂备餐数据_${timestamp}.${ext}`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showSuccess(`导出成功！共 ${previewData.stats.total} 条记录`);
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const previewColumns = [
    {
      title: '日期',
      dataIndex: 'record_date',
      key: 'record_date',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '餐次',
      dataIndex: 'meal_type',
      key: 'meal_type',
      render: (type) => (
        <Tag color={type === '早餐' ? 'green' : type === '午餐' ? 'orange' : 'blue'}>
          {type}
        </Tag>
      ),
    },
    {
      title: '菜品名称',
      dataIndex: 'dish_name',
      key: 'dish_name',
    },
    {
      title: '预测份数',
      dataIndex: 'predicted_count',
      key: 'predicted_count',
      align: 'right',
    },
    {
      title: '实际份数',
      dataIndex: 'actual_count',
      key: 'actual_count',
      align: 'right',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">数据导出</h1>
        <p className="page-subtitle">
          导出备餐数据，导出的筛选条件与当前屏幕显示范围完全一致，并附模型说明
        </p>
      </div>

      <Alert
        message="导出说明"
        description={
          <div>
            <p>• <strong style={{ color: '#1677ff' }}>重要：</strong>导出的数据范围与您设置的筛选条件完全一致，请先预览确认</p>
            <p>• 导出文件包含「导出说明」工作表，记录了本次导出的筛选条件和模型版本</p>
            <p>• Excel 格式包含完整的格式和公式，CSV 格式更适合导入其他系统</p>
            <p>• 导出的模型说明与预测时使用的版本一致，确保数据可追溯</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={14}>
          <Card className="card-section" title="导出设置">
            <Form
              form={form}
              layout="vertical"
              onFinish={handlePreview}
              initialValues={{
                include_model_info: true,
                format: 'excel',
              }}
            >
              <Form.Item
                name="date_range"
                label="日期范围（不选则导出全部）"
              >
                <RangePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                  placeholder={['开始日期', '结束日期']}
                />
              </Form.Item>

              <Form.Item
                name="meal_types"
                label="餐次（不选则导出全部）"
              >
                <Select
                  mode="multiple"
                  placeholder="选择要导出的餐次"
                  allowClear
                >
                  <Option value="早餐">早餐</Option>
                  <Option value="午餐">午餐</Option>
                  <Option value="晚餐">晚餐</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="categories"
                label="菜品分类（不选则导出全部）"
              >
                <Select
                  mode="multiple"
                  placeholder="选择要导出的菜品分类"
                  allowClear
                  showSearch
                >
                  {categories.map(cat => (
                    <Option key={cat} value={cat}>{cat}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="include_model_info"
                label="包含模型说明"
                valuePropName="checked"
                tooltip="导出的 Excel 文件会包含「导出说明」工作表，记录筛选条件和模型版本"
              >
                <Switch
                  checkedChildren="包含"
                  unCheckedChildren="不包含"
                />
              </Form.Item>

              <Form.Item
                name="format"
                label="导出格式"
              >
                <Radio.Group>
                  <Radio.Button value="excel">
                    <FileExcelOutlined /> Excel (.xlsx)
                  </Radio.Button>
                  <Radio.Button value="csv">
                    <FileTextOutlined /> CSV (.csv)
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<ReloadOutlined />}
                    loading={loading}
                  >
                    预览导出内容
                  </Button>
                  <Button
                    icon={<InfoCircleOutlined />}
                    onClick={() => setShowModelInfo(true)}
                  >
                    查看模型说明
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} md={10}>
          <Card className="card-section" title="当前预测模型">
            {modelInfo && (
              <div>
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="模型版本">
                    <Tag color="blue">{modelInfo.model_version}</Tag>
                  </Descriptions.Item>
                </Descriptions>

                <Divider style={{ margin: '12px 0' }} />

                <h4 style={{ marginBottom: 8 }}>日期调整因子：</h4>
                <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
                  {Object.entries(modelInfo.date_factors).map(([key, value]) => (
                    <Col span={12} key={key}>
                      <Tag color="blue">{key}：{value}</Tag>
                    </Col>
                  ))}
                </Row>

                <h4 style={{ marginBottom: 8 }}>菜品分类系数：</h4>
                <Row gutter={[8, 8]}>
                  {Object.entries(modelInfo.category_factors).map(([key, value]) => (
                    <Col span={12} key={key}>
                      <Tag color="green">{key}：{value}</Tag>
                    </Col>
                  ))}
                </Row>

                <Button
                  type="link"
                  icon={<InfoCircleOutlined />}
                  onClick={() => setShowModelInfo(true)}
                  style={{ padding: 0, marginTop: 12 }}
                >
                  查看完整模型说明
                </Button>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {previewData && (
        <Card className="card-section" title="导出预览">
          <Alert
            message="以下是即将导出的数据范围和统计信息，请确认无误后再导出"
            type="success"
            showIcon
            style={{ marginBottom: 20 }}
          />

          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="总记录数" value={previewData.stats.total} suffix="条" />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="有预测值" value={previewData.stats.predicted} suffix="条" />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="已复核" value={previewData.stats.reviewed} suffix="条" />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic
                  title="预估总金额"
                  value={previewData.stats.totalAmount}
                  precision={2}
                  prefix="¥"
                />
              </Card>
            </Col>
          </Row>

          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>导出条件：</h4>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="日期范围">
                {previewData.dateRange && previewData.dateRange.length === 2
                  ? `${previewData.dateRange[0].format('YYYY-MM-DD')} ~ ${previewData.dateRange[1].format('YYYY-MM-DD')}`
                  : '全部'}
              </Descriptions.Item>
              <Descriptions.Item label="餐次">
                {previewData.mealTypes && previewData.mealTypes.length > 0
                  ? previewData.mealTypes.join('、')
                  : '全部'}
              </Descriptions.Item>
              <Descriptions.Item label="菜品分类">
                {previewData.categories && previewData.categories.length > 0
                  ? previewData.categories.join('、')
                  : '全部'}
              </Descriptions.Item>
              <Descriptions.Item label="包含模型说明">
                {previewData.includeModelInfo ? '是' : '否'}
              </Descriptions.Item>
              <Descriptions.Item label="导出格式">
                {previewData.format === 'excel' ? 'Excel (.xlsx)' : 'CSV (.csv)'}
              </Descriptions.Item>
              <Descriptions.Item label="模型版本">
                {modelInfo?.model_version || '-'}
              </Descriptions.Item>
            </Descriptions>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>数据预览（前5条）：</h4>
            <Table
              columns={previewColumns}
              dataSource={previewData.records}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setPreviewData(null)}>
                重新选择
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined />}
                onClick={handleExport}
                loading={loading}
              >
                确认导出
              </Button>
            </Space>
          </div>
        </Card>
      )}

      <Modal
        title="预测模型说明"
        open={showModelInfo}
        onCancel={() => setShowModelInfo(false)}
        footer={[
          <Button key="close" onClick={() => setShowModelInfo(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {modelInfo && (
          <div>
            <Alert
              message={`模型版本：${modelInfo.model_version}`}
              description="导出文件中会包含此模型说明，确保数据可追溯"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div className="model-info">
              <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                {modelInfo.model_description}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ExportPage;
