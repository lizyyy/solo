import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Form,
  Select,
  Space,
  Alert,
  message,
  Statistic,
  Tag,
} from 'antd';
import {
  FileTextOutlined,
  DownloadOutlined,
  FileMarkdownOutlined,
  FileJsonOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;

const Export = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState({ markdown: false, json: false, cabinJson: false });
  const [stats, setStats] = useState(null);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [statsResponse, statusResponse] = await Promise.all([
        api.analysis.getStats(),
        api.sample.getStatus(),
      ]);
      
      setStats(statsResponse.data);
      setHasData(statusResponse.data.has_sample_data);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  const downloadMarkdown = async (values) => {
    setLoading(prev => ({ ...prev, markdown: true }));
    try {
      const params = {};
      if (values.deck) params.deck = values.deck;
      if (values.priority) params.priority = values.priority;

      const response = await api.export.getMarkdown(params);
      
      const blob = new Blob([response.data], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `maintenance-report-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      message.success('Markdown 报告导出成功');
    } catch (error) {
      console.error('导出 Markdown 失败:', error);
      message.error(error.response?.data?.error || '导出失败');
    } finally {
      setLoading(prev => ({ ...prev, markdown: false }));
    }
  };

  const downloadJson = async (values) => {
    setLoading(prev => ({ ...prev, json: true }));
    try {
      const params = {};
      if (values.deck) params.deck = values.deck;
      if (values.risk_level) params.risk_level = values.risk_level;
      if (values.maintenance_status) params.maintenance_status = values.maintenance_status;

      const response = await api.export.getJson(params);
      
      const blob = new Blob([response.data], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cabin-analysis-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      message.success('JSON 数据导出成功');
    } catch (error) {
      console.error('导出 JSON 失败:', error);
      message.error(error.response?.data?.error || '导出失败');
    } finally {
      setLoading(prev => ({ ...prev, json: false }));
    }
  };

  const getRiskCount = (riskLevel) => {
    if (!stats || !stats.risk_distribution) return 0;
    const item = stats.risk_distribution.find(r => r.risk_level === riskLevel);
    return item ? item.count : 0;
  };

  const getMaintenanceCount = (status) => {
    if (!stats || !stats.maintenance_distribution) return 0;
    const item = stats.maintenance_distribution.find(m => m.maintenance_status === status);
    return item ? item.count : 0;
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>
        <FileTextOutlined style={{ marginRight: 8 }} />
        数据导出
      </h2>

      {!hasData && (
        <Alert
          message="暂无数据可导出"
          description="请先导入数据并进行分析。"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="需优先检修"
                value={getMaintenanceCount('需优先检修')}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="需检修"
                value={getMaintenanceCount('需检修')}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="建议检查"
                value={getMaintenanceCount('建议检查')}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="误报排除"
                value={getMaintenanceCount('误报排除')}
                valueStyle={{ color: '#8c8c8c' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FileMarkdownOutlined style={{ color: '#1890ff', fontSize: 20 }} />
                导出 Markdown 维修交班单
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <p style={{ marginBottom: 16, color: '#666' }}>
              导出格式化的维修交班单，包含所有需要检修的舱房信息，适合打印或在交班会上使用。
              报告按优先级分类展示，并包含风险证据和备注信息。
            </p>

            <Form
              form={form}
              layout="vertical"
              onFinish={downloadMarkdown}
              initialValues={{}}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="deck" label="筛选甲板">
                    <Select placeholder="全部甲板" allowClear>
                      {stats?.deck_summary?.map(deck => (
                        <Option key={deck.deck} value={deck.deck}>
                          {deck.deck}层 ({deck.total_cabins}舱)
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="priority" label="筛选优先级">
                    <Select placeholder="全部优先级" allowClear>
                      <Option value="高">高优先级</Option>
                      <Option value="中">中优先级</Option>
                      <Option value="低">低优先级</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  htmlType="submit"
                  loading={loading.markdown}
                  disabled={!hasData}
                  size="large"
                >
                  导出 Markdown 报告
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FileJsonOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                导出 JSON 明细数据
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <p style={{ marginBottom: 16, color: '#666' }}>
              导出完整的结构化数据，包含所有舱房的分析结果、传感器数据、报警记录、
              巡检记录和客诉信息。适合进一步分析或导入其他系统。
            </p>

            <Form
              layout="vertical"
              onFinish={downloadJson}
              initialValues={{}}
            >
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="deck" label="筛选甲板">
                    <Select placeholder="全部" allowClear>
                      {stats?.deck_summary?.map(deck => (
                        <Option key={deck.deck} value={deck.deck}>
                          {deck.deck}层
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="risk_level" label="风险等级">
                    <Select placeholder="全部" allowClear>
                      <Option value="高风险">高风险</Option>
                      <Option value="中风险">中风险</Option>
                      <Option value="低风险">低风险</Option>
                      <Option value="正常">正常</Option>
                      <Option value="误报">误报</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="maintenance_status" label="维修状态">
                    <Select placeholder="全部" allowClear>
                      <Option value="需优先检修">需优先检修</Option>
                      <Option value="需检修">需检修</Option>
                      <Option value="建议检查">建议检查</Option>
                      <Option value="无需维修">无需维修</Option>
                      <Option value="误报排除">误报排除</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  htmlType="submit"
                  loading={loading.json}
                  disabled={!hasData}
                  size="large"
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                >
                  导出 JSON 数据
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>

      <Card title="导出格式说明" style={{ marginTop: 24 }}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <h4 style={{ marginBottom: 12 }}>
              <Tag color="blue">Markdown</Tag> 维修交班单格式
            </h4>
            <ul style={{ paddingLeft: 20, color: '#666' }}>
              <li><strong>统计概览</strong>: 各优先级舱房数量统计</li>
              <li><strong>高优先级任务</strong>: 详细列表，包含风险证据</li>
              <li><strong>中优先级任务</strong>: 计划处理的任务</li>
              <li><strong>低优先级任务</strong>: 建议检查的任务</li>
              <li><strong>交班记录</strong>: 交班人、接班人签字区域</li>
            </ul>
          </Col>
          <Col xs={24} md={12}>
            <h4 style={{ marginBottom: 12 }}>
              <Tag color="green">JSON</Tag> 明细数据格式
            </h4>
            <ul style={{ paddingLeft: 20, color: '#666' }}>
              <li><strong>元数据</strong>: 导出时间、筛选条件、总数</li>
              <li><strong>舱房分析</strong>: 风险等级、分数、维修状态</li>
              <li><strong>传感器数据</strong>: 最近10条温湿度记录</li>
              <li><strong>报警记录</strong>: 最近5条报警</li>
              <li><strong>巡检记录</strong>: 最近3次巡检</li>
              <li><strong>客诉记录</strong>: 最近5条客诉</li>
            </ul>
          </Col>
        </Row>
      </Card>

      <Alert
        message="使用提示"
        description={
          <div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Markdown 报告可以直接用任何 Markdown 编辑器打开，也可以转换为 PDF 打印</li>
              <li>JSON 数据包含完整的结构化信息，适合导入到其他系统进行进一步分析</li>
              <li>所有导出的数据都包含人工改判的结果，确保与界面显示一致</li>
              <li>建议每次换班前导出维修交班单，确保信息完整</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        style={{ marginTop: 24 }}
      />
    </div>
  );
};

export default Export;
