import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Table,
  Tag,
  Space,
  Alert,
  Modal,
  message,
  Statistic,
  Descriptions,
  Divider,
} from 'antd';
import {
  SettingOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { confirm } = Modal;

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [dataStatus, setDataStatus] = useState(null);
  const [hasSampleData, setHasSampleData] = useState(false);

  useEffect(() => {
    loadDataStatus();
  }, []);

  const loadDataStatus = async () => {
    setLoading(true);
    try {
      const response = await api.sample.getStatus();
      setDataStatus(response.data);
      setHasSampleData(response.data.has_sample_data);
    } catch (error) {
      console.error('获取数据状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const importSampleData = async () => {
    confirm({
      title: '确认导入示例数据',
      icon: <DatabaseOutlined />,
      content: '导入示例数据将添加测试数据到数据库中。是否继续？',
      okText: '确认导入',
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
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
      },
    });
  };

  const clearAllData = async () => {
    confirm({
      title: '确认清除所有数据',
      icon: <DeleteOutlined />,
      content: '此操作将清除数据库中的所有数据，包括舱房信息、传感器数据、报警记录、客诉记录和分析结果。此操作不可恢复！',
      okText: '确认清除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
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
      },
    });
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const response = await api.analysis.recalculate();
      message.success('分析完成');
      console.log('分析结果:', response.data);
      loadDataStatus();
    } catch (error) {
      console.error('分析失败:', error);
      message.error(error.response?.data?.error || '分析失败');
    } finally {
      setLoading(false);
    }
  };

  const statusColumns = [
    {
      title: '数据类型',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '记录数',
      dataIndex: 'count',
      key: 'count',
      render: (count) => (
        <span style={{ fontWeight: 'bold', color: count > 0 ? '#52c41a' : '#999' }}>
          {count?.toLocaleString() || 0}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'count',
      key: 'status',
      render: (count) => (
        count > 0 ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已加载
          </Tag>
        ) : (
          <Tag icon={<InfoCircleOutlined />} color="default">
            未加载
          </Tag>
        )
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

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>
        <SettingOutlined style={{ marginRight: 8 }} />
        系统设置
      </h2>

      <Alert
        message="系统信息"
        description={
          <Descriptions size="small" column={3}>
            <Descriptions.Item label="系统名称">邮轮客舱维护工具</Descriptions.Item>
            <Descriptions.Item label="版本">1.0.0</Descriptions.Item>
            <Descriptions.Item label="数据库">SQLite</Descriptions.Item>
          </Descriptions>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <DatabaseOutlined />
                当前数据状态
              </Space>
            }
            extra={
              <Button
                icon={<ReloadOutlined />}
                onClick={loadDataStatus}
                loading={loading}
                size="small"
              >
                刷新
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            {dataStatus ? (
              <div>
                <Table
                  columns={statusColumns}
                  dataSource={statusData}
                  rowKey="name"
                  pagination={false}
                  size="small"
                />
                
                <Divider />
                
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="总舱房数"
                      value={dataStatus.data_status.cabins?.count || 0}
                      prefix={<DatabaseOutlined />}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="传感器记录"
                      value={dataStatus.data_status.sensor_data?.count || 0}
                      suffix="条"
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="分析完成"
                      value={
                        dataStatus.data_status.analysis?.count > 0 && 
                        dataStatus.data_status.analysis?.count >= dataStatus.data_status.cabins?.count
                      }
                      valueRender={(val) => (
                        val ? (
                          <Tag color="green">是</Tag>
                        ) : (
                          <Tag color="orange">否</Tag>
                        )
                      )}
                    />
                  </Col>
                </Row>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 20 }}>
                加载中...
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <SettingOutlined />
                数据管理
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message="示例数据"
                description="导入示例数据可以快速体验系统功能。示例数据包含60个舱房、完整的24小时传感器数据、报警记录、巡检记录和客诉记录。"
                type="info"
                showIcon
              />
              
              <Button
                type="primary"
                icon={<DatabaseOutlined />}
                onClick={importSampleData}
                loading={loading}
                disabled={hasSampleData}
                size="large"
                block
              >
                {hasSampleData ? '已导入示例数据' : '导入示例数据'}
              </Button>

              <Divider />

              <Alert
                message="运行分析"
                description="在导入或更新数据后，需要运行分析来重新计算各舱房的风险等级和维修优先级。分析结果将根据规则引擎自动判断。"
                type="info"
                showIcon
              />
              
              <Button
                icon={<ReloadOutlined />}
                onClick={runAnalysis}
                loading={loading}
                disabled={!hasSampleData}
                size="large"
                block
              >
                运行分析
              </Button>

              <Divider />

              <Alert
                message="清除数据"
                description="此操作将清除所有数据，包括舱房信息、传感器数据、报警记录、客诉记录和分析结果。此操作不可恢复，请谨慎操作。"
                type="warning"
                showIcon
                icon={<WarningOutlined />}
              />
              
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={clearAllData}
                loading={loading}
                disabled={!hasSampleData}
                size="large"
                block
              >
                清除所有数据
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="分析规则说明" style={{ marginTop: 24 }}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <h4 style={{ marginBottom: 12 }}>风险评估规则</h4>
            <ul style={{ paddingLeft: 20, color: '#666' }}>
              <li><strong>温度异常</strong>: 温度低于 20°C 或高于 26°C</li>
              <li><strong>湿度异常</strong>: 湿度低于 40% 或高于 70%</li>
              <li><strong>冷凝水报警</strong>: 检测到冷凝水相关报警</li>
              <li><strong>巡检异常</strong>: 风机盘管、滤网或冷凝水管状态异常</li>
              <li><strong>乘客客诉</strong>: 存在未解决的空调相关客诉</li>
              <li><strong>持续异常</strong>: 连续多个读数显示异常</li>
            </ul>
          </Col>
          <Col xs={24} md={12}>
            <h4 style={{ marginBottom: 12 }}>误报检测规则</h4>
            <ul style={{ paddingLeft: 20, color: '#666' }}>
              <li><strong>短时开门</strong>: 温度骤降但很快恢复正常</li>
              <li><strong>单次异常</strong>: 只有单次读数异常，前后均正常</li>
              <li><strong>温度稳定</strong>: 异常前后温度波动小，状态稳定</li>
              <li><strong>温度差</strong>: 温度下降超过 2°C，提示可能开门</li>
            </ul>
            
            <h4 style={{ marginBottom: 12, marginTop: 24 }}>风险等级划分</h4>
            <ul style={{ paddingLeft: 20, color: '#666' }}>
              <li><strong>高风险</strong>: 风险分数 ≥ 50，需优先检修</li>
              <li><strong>中风险</strong>: 风险分数 ≥ 30，需检修</li>
              <li><strong>低风险</strong>: 风险分数 ≥ 15，建议检查</li>
              <li><strong>正常</strong>: 风险分数 < 15，无需维修</li>
            </ul>
          </Col>
        </Row>
      </Card>

      <Alert
        message="使用流程"
        description={
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li><strong>导入数据</strong>: 上传 CSV 数据文件或导入示例数据</li>
            <li><strong>运行分析</strong>: 系统自动分析各舱房风险等级</li>
            <li><strong>查看结果</strong>: 在舱房分析页面查看风险分布和详情</li>
            <li><strong>人工改判</strong>: 对系统判断进行人工调整，添加备注</li>
            <li><strong>导出报告</strong>: 生成维修交班单或导出 JSON 数据</li>
          </ol>
        }
        type="success"
        showIcon
        style={{ marginTop: 24 }}
      />
    </div>
  );
};

export default Settings;
