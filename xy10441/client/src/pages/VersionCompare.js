import React, { useState, useEffect } from 'react';
import {
  Card,
  Select,
  Button,
  Row,
  Col,
  Table,
  Tag,
  Typography,
  Divider,
  Space,
  Empty,
  Descriptions
} from 'antd';
import { FileSearchOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const VersionCompare = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [versions, setVersions] = useState([]);
  const [version1, setVersion1] = useState(null);
  const [version2, setVersion2] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/projects')
      .then(res => setProjects(res.data))
      .catch(console.error);
  }, []);

  const handleProjectChange = (projectId) => {
    setSelectedProject(projectId);
    setVersion1(null);
    setVersion2(null);
    setCompareResult(null);
    api.get(`/projects/${projectId}`)
      .then(res => {
        setVersions(res.data.versions || []);
      })
      .catch(console.error);
  };

  const handleCompare = () => {
    if (!version1 || !version2) return;
    
    setLoading(true);
    api.get('/proposals/versions/compare', {
      params: { version1_id: version1, version2_id: version2 }
    })
      .then(res => {
        setCompareResult(res.data);
      })
      .catch(error => {
        console.error(error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const getStatusTag = (version) => {
    if (!version) return null;
    if (version.is_voided) {
      return <Tag color="red" icon={<CloseCircleOutlined />}>已作废</Tag>;
    }
    if (version.is_confirmed) {
      return <Tag color="green" icon={<CheckCircleOutlined />}>有效版本</Tag>;
    }
    return <Tag color="orange">草稿</Tag>;
  };

  const getDiffItems = (items1, items2) => {
    const map1 = new Map(items1?.map(item => [item.item_name, item]) || []);
    const map2 = new Map(items2?.map(item => [item.item_name, item]) || []);
    
    const allNames = new Set([...map1.keys(), ...map2.keys()]);
    const diffs = [];
    
    allNames.forEach(name => {
      const item1 = map1.get(name);
      const item2 = map2.get(name);
      
      if (!item1) {
        diffs.push({ type: 'add', name, v1: null, v2: item2 });
      } else if (!item2) {
        diffs.push({ type: 'remove', name, v1: item1, v2: null });
      } else if (parseFloat(item1.amount) !== parseFloat(item2.amount)) {
        diffs.push({ type: 'change', name, v1: item1, v2: item2 });
      }
    });
    
    return diffs;
  };

  const renderComparison = () => {
    if (!compareResult) {
      return <Empty description="请选择两个版本进行对比" />;
    }

    const { version1: v1, version2: v2 } = compareResult;
    const amountDiff = parseFloat(v2.final_amount) - parseFloat(v1.final_amount);
    const itemDiffs = getDiffItems(v1.quotation_items, v2.quotation_items);

    return (
      <div>
        <Row gutter={16}>
          <Col span={12}>
            <Card title={`版本 ${v1.version_number}: ${v1.version_name}`} style={{ height: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {getStatusTag(v1)}
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="报价总额">
                    <Text strong style={{ fontSize: 20, color: '#1890ff' }}>
                      ¥{parseFloat(v1.final_amount).toLocaleString()}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="创建时间">
                    {dayjs(v1.created_at).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                  <Descriptions.Item label="确认时间">
                    {v1.confirmed_at ? dayjs(v1.confirmed_at).format('YYYY-MM-DD HH:mm') : '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Space>
            </Card>
          </Col>
          <Col span={12}>
            <Card title={`版本 ${v2.version_number}: ${v2.version_name}`} style={{ height: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {getStatusTag(v2)}
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="报价总额">
                    <Space>
                      <Text strong style={{ fontSize: 20, color: '#1890ff' }}>
                        ¥{parseFloat(v2.final_amount).toLocaleString()}
                      </Text>
                      {amountDiff !== 0 && (
                        <Tag color={amountDiff > 0 ? 'red' : 'green'}>
                          {amountDiff > 0 ? '+' : ''}¥{amountDiff.toLocaleString()}
                        </Tag>
                      )}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="创建时间">
                    {dayjs(v2.created_at).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                  <Descriptions.Item label="确认时间">
                    {v2.confirmed_at ? dayjs(v2.confirmed_at).format('YYYY-MM-DD HH:mm') : '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Space>
            </Card>
          </Col>
        </Row>

        <Divider>报价明细对比</Divider>
        
        {itemDiffs.length === 0 ? (
          <Card>
            <Empty description="两个版本报价明细一致" />
          </Card>
        ) : (
          <Table
            dataSource={itemDiffs}
            rowKey="name"
            columns={[
              {
                title: '变更类型',
                dataIndex: 'type',
                key: 'type',
                width: 100,
                render: (type) => {
                  if (type === 'add') return <Tag color="green">新增</Tag>;
                  if (type === 'remove') return <Tag color="red">删除</Tag>;
                  return <Tag color="blue">修改</Tag>;
                }
              },
              { title: '项目名称', dataIndex: 'name', key: 'name' },
              {
                title: `版本 ${v1.version_number}`,
                key: 'v1',
                render: (_, record) => {
                  if (!record.v1) return <Text type="secondary">-</Text>;
                  return (
                    <Space direction="vertical" size={0}>
                      <Text>¥{parseFloat(record.v1.amount).toLocaleString()}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.v1.quantity} {record.v1.unit} × ¥{parseFloat(record.v1.unit_price).toLocaleString()}
                      </Text>
                    </Space>
                  );
                }
              },
              {
                title: `版本 ${v2.version_number}`,
                key: 'v2',
                render: (_, record) => {
                  if (!record.v2) return <Text type="secondary">-</Text>;
                  return (
                    <Space direction="vertical" size={0}>
                      <Text>¥{parseFloat(record.v2.amount).toLocaleString()}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.v2.quantity} {record.v2.unit} × ¥{parseFloat(record.v2.unit_price).toLocaleString()}
                      </Text>
                    </Space>
                  );
                }
              },
              {
                title: '差价',
                key: 'diff',
                render: (_, record) => {
                  if (!record.v1 || !record.v2) return '-';
                  const diff = parseFloat(record.v2.amount) - parseFloat(record.v1.amount);
                  return (
                    <Tag color={diff > 0 ? 'red' : diff < 0 ? 'green' : 'default'}>
                      {diff > 0 ? '+' : ''}¥{diff.toLocaleString()}
                    </Tag>
                  );
                }
              }
            ]}
            pagination={false}
          />
        )}

        <Divider>范围说明对比</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Card title={`版本 ${v1.version_number}`} size="small">
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {v1.scope_description || '暂无范围说明'}
              </pre>
            </Card>
          </Col>
          <Col span={12}>
            <Card title={`版本 ${v2.version_number}`} size="small">
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {v2.scope_description || '暂无范围说明'}
              </pre>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <FileSearchOutlined style={{ marginRight: 8 }} />
        版本对比
      </Title>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="bottom">
          <Col span={8}>
            <div style={{ marginBottom: 8 }}>选择项目</div>
            <Select
              style={{ width: '100%' }}
              placeholder="请选择项目"
              value={selectedProject}
              onChange={handleProjectChange}
              showSearch
              optionFilterProp="children"
            >
              {projects.map(p => (
                <Option key={p.id} value={p.id}>
                  {p.customer_name} - {p.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 8 }}>版本 1</div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择第一个版本"
              value={version1}
              onChange={setVersion1}
              disabled={!selectedProject}
            >
              {versions.map(v => (
                <Option key={v.id} value={v.id}>
                  {v.version_number} - {v.version_name}
                  {v.is_confirmed && !v.is_voided && ' [有效]'}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 8 }}>版本 2</div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择第二个版本"
              value={version2}
              onChange={setVersion2}
              disabled={!selectedProject}
            >
              {versions.map(v => (
                <Option key={v.id} value={v.id}>
                  {v.version_number} - {v.version_name}
                  {v.is_confirmed && !v.is_voided && ' [有效]'}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Button
              type="primary"
              block
              onClick={handleCompare}
              loading={loading}
              disabled={!version1 || !version2}
            >
              开始对比
            </Button>
          </Col>
        </Row>
      </Card>

      {renderComparison()}
    </div>
  );
};

export default VersionCompare;
