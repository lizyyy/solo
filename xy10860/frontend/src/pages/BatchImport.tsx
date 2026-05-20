import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Typography,
  message,
  Table,
  Tag,
  Input,
  Select,
  Modal,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { ReleaseOrderCreate, EnvironmentType } from '../types';
import { releaseOrderApi } from '../api';

const { Title } = Typography;

const environmentOptions = [
  { label: '开发', value: EnvironmentType.DEV },
  { label: '测试', value: EnvironmentType.TEST },
  { label: '预发布', value: EnvironmentType.STAGING },
  { label: '生产', value: EnvironmentType.PROD },
];

interface ImportItem extends ReleaseOrderCreate {
  key: string;
}

export default function BatchImport() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ImportItem[]>([]);
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    setItems([
      ...items,
      {
        key: Date.now().toString(),
        title: '',
        environment: EnvironmentType.DEV,
        created_by: '',
        check_items: [],
        approvers: [],
      },
    ]);
  };

  const updateItem = (key: string, field: string, value: any) => {
    setItems(items.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  };

  const removeItem = (key: string) => {
    setItems(items.filter((item) => item.key !== key));
  };

  const loadExample = () => {
    setItems([
      {
        key: '1',
        title: '用户服务 v2.1.0 发布',
        description: '包含用户中心API更新和性能优化',
        version: 'v2.1.0',
        environment: EnvironmentType.PROD,
        created_by: '张三',
        check_items: [
          { name: '单元测试通过率', description: '确保 > 90%' },
          { name: '压力测试结果', description: 'QPS 达标' },
        ],
        approvers: ['李四', '王五'],
      },
      {
        key: '2',
        title: '订单系统热修复',
        description: '修复支付回调超时问题',
        version: 'v1.0.1',
        environment: EnvironmentType.PROD,
        created_by: '赵六',
        check_items: [{ name: '回归测试验证' }],
        approvers: ['李四'],
      },
    ]);
    message.success('已加载示例数据');
  };

  const handleImport = async () => {
    const invalidItems = items.filter((item) => !item.title || !item.created_by);
    if (invalidItems.length > 0) {
      message.error('请完善所有必填字段');
      return;
    }

    setLoading(true);
    try {
      const response = await releaseOrderApi.batchImport(
        items.map(({ key, ...rest }) => rest)
      );
      message.success(
        `导入成功: ${response.data.success_count} 个，失败: ${response.data.failed_count} 个`
      );
      if (response.data.errors.length > 0) {
        Modal.error({
          title: '导入错误详情',
          content: (
            <ul>
              {response.data.errors.map((err: string, idx: number) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          ),
        });
      }
      navigate('/');
    } catch (error) {
      message.error('导入失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '标题 *',
      dataIndex: 'title',
      key: 'title',
      render: (_: string, record: ImportItem) => (
        <Input
          value={record.title}
          onChange={(e) => updateItem(record.key, 'title', e.target.value)}
          placeholder="请输入标题"
        />
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (_: string, record: ImportItem) => (
        <Input
          value={record.version || ''}
          onChange={(e) => updateItem(record.key, 'version', e.target.value)}
          placeholder="版本号"
        />
      ),
    },
    {
      title: '环境 *',
      dataIndex: 'environment',
      key: 'environment',
      width: 120,
      render: (_: EnvironmentType, record: ImportItem) => (
        <Select
          value={record.environment}
          onChange={(value) => updateItem(record.key, 'environment', value)}
          options={environmentOptions}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '创建人 *',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 120,
      render: (_: string, record: ImportItem) => (
        <Input
          value={record.created_by}
          onChange={(e) => updateItem(record.key, 'created_by', e.target.value)}
          placeholder="创建人"
        />
      ),
    },
    {
      title: '检查项',
      dataIndex: 'check_items',
      key: 'check_items',
      width: 100,
      render: (checkItems: any[]) => (
        <Tag color="blue">{checkItems?.length || 0} 项</Tag>
      ),
    },
    {
      title: '审批人',
      dataIndex: 'approvers',
      key: 'approvers',
      width: 100,
      render: (approvers: string[]) => (
        <Tag color="green">{approvers?.length || 0} 人</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: any, record: ImportItem) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeItem(record.key)}
        />
      ),
    },
  ];

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4}>批量导入发布单</Title>
          <Space>
            <Button onClick={loadExample}>加载示例</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={addItem}>
              添加发布单
            </Button>
          </Space>
        </div>

        <Card>
          <Table
            columns={columns}
            dataSource={items}
            pagination={false}
            locale={{ emptyText: '暂无数据，请点击"添加发布单"或"加载示例"' }}
          />

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => navigate('/')}>取消</Button>
              <Button type="primary" onClick={handleImport} loading={loading}>
                确认导入 ({items.length} 项)
              </Button>
            </Space>
          </div>
        </Card>

        <Card title="导入说明">
          <ul>
            <li>带 * 标记的为必填字段</li>
            <li>点击"加载示例"可以查看导入数据的格式</li>
            <li>检查项和审批人可在详情页继续编辑</li>
            <li>支持通过 API 上传 JSON 格式的批量数据</li>
          </ul>
        </Card>
      </Space>
    </div>
  );
}
