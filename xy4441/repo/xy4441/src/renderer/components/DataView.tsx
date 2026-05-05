import React, { useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Typography,
  Tabs,
  Empty,
  Space,
  Input,
  Select,
  Row,
  Col,
} from 'antd';
import {
  CalendarOutlined,
  ShoppingOutlined,
  FileTextOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { useApp } from '../store/AppContext';
import {
  SceneSchedule,
  CostumeItem,
  WashRecord,
  AlterationRecord,
  ReferencePhoto,
} from '../../shared/types';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

const DataView: React.FC = () => {
  const {
    scenes,
    costumes,
    washRecords,
    alterationRecords,
    photos,
  } = useApp();

  const [activeTab, setActiveTab] = useState('scenes');
  const [searchText, setSearchText] = useState('');
  const [filterCharacter, setFilterCharacter] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // 场次表
  const sceneColumns = [
    {
      title: '场次号',
      dataIndex: 'sceneNumber',
      key: 'sceneNumber',
      width: 100,
      fixed: 'left' as const,
      sorter: (a: SceneSchedule, b: SceneSchedule) =>
        a.sceneNumber.localeCompare(b.sceneNumber),
    },
    {
      title: '场次名称',
      dataIndex: 'sceneName',
      key: 'sceneName',
    },
    {
      title: '拍摄日期',
      dataIndex: 'shootDate',
      key: 'shootDate',
      width: 120,
      sorter: (a: SceneSchedule, b: SceneSchedule) =>
        a.shootDate.localeCompare(b.shootDate),
    },
    {
      title: '地点',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: '角色',
      dataIndex: 'characters',
      key: 'characters',
      render: (chars: string[]) => (
        <Space wrap>
          {chars.map((c, i) => (
            <Tag key={i} size="small" color="blue">
              {c}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '日夜',
      dataIndex: 'dayNight',
      key: 'dayNight',
      width: 80,
    },
    {
      title: '天气',
      dataIndex: 'weather',
      key: 'weather',
      width: 80,
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
  ];

  // 服装表
  const costumeColumns = [
    {
      title: '条码',
      dataIndex: 'barcode',
      key: 'barcode',
      width: 120,
      fixed: 'left' as const,
    },
    {
      title: '角色',
      dataIndex: 'character',
      key: 'character',
      width: 100,
      filters: Array.from(new Set(costumes.map((c) => c.character))).map((c) => ({
        text: c,
        value: c,
      })),
      onFilter: (value: any, record: CostumeItem) =>
        record.character.includes(value),
    },
    {
      title: '服装名称',
      dataIndex: 'itemName',
      key: 'itemName',
    },
    {
      title: '尺码',
      dataIndex: 'size',
      key: 'size',
      width: 80,
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 80,
    },
    {
      title: '适用场次',
      dataIndex: 'scenes',
      key: 'scenes',
      render: (s: string[]) => s.join(', '),
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '可用', value: 'available' },
        { text: '清洗中', value: 'in_wash' },
        { text: '改衣中', value: 'in_alteration' },
        { text: '已借出', value: 'checked_out' },
        { text: '丢失', value: 'lost' },
      ],
      onFilter: (value: any, record: CostumeItem) => record.status === value,
      render: (status: string) => {
        const statusMap: Record<
          string,
          { text: string; color: string }
        > = {
          available: { text: '可用', color: 'success' },
          in_wash: { text: '清洗中', color: 'processing' },
          in_alteration: { text: '改衣中', color: 'warning' },
          checked_out: { text: '已借出', color: 'default' },
          lost: { text: '丢失', color: 'error' },
        };
        const info =
          statusMap[status] || { text: status, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '最后更新',
      dataIndex: 'lastUpdated',
      key: 'lastUpdated',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
  ];

  // 清洗记录表
  const washColumns = [
    {
      title: '条码',
      dataIndex: 'barcode',
      key: 'barcode',
      width: 120,
    },
    {
      title: '清洗日期',
      dataIndex: 'washDate',
      key: 'washDate',
      width: 120,
      sorter: (a: WashRecord, b: WashRecord) =>
        a.washDate.localeCompare(b.washDate),
    },
    {
      title: '预计归还日期',
      dataIndex: 'expectedReturnDate',
      key: 'expectedReturnDate',
      width: 140,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<
          string,
          { text: string; color: string }
        > = {
          pending: { text: '待处理', color: 'default' },
          in_progress: { text: '进行中', color: 'processing' },
          completed: { text: '已完成', color: 'success' },
          delayed: { text: '延迟', color: 'error' },
        };
        const info =
          statusMap[status] || { text: status, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
  ];

  // 改衣记录表
  const alterationColumns = [
    {
      title: '条码',
      dataIndex: 'barcode',
      key: 'barcode',
      width: 120,
    },
    {
      title: '改动类型',
      dataIndex: 'changeType',
      key: 'changeType',
    },
    {
      title: '当前尺码',
      dataIndex: 'currentSize',
      key: 'currentSize',
      width: 100,
    },
    {
      title: '目标尺码',
      dataIndex: 'targetSize',
      key: 'targetSize',
      width: 100,
    },
    {
      title: '申请日期',
      dataIndex: 'requestDate',
      key: 'requestDate',
      width: 120,
    },
    {
      title: '预计完成日期',
      dataIndex: 'expectedCompletion',
      key: 'expectedCompletion',
      width: 140,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<
          string,
          { text: string; color: string }
        > = {
          pending: { text: '待处理', color: 'default' },
          in_progress: { text: '进行中', color: 'processing' },
          completed: { text: '已完成', color: 'success' },
          delayed: { text: '延迟', color: 'error' },
        };
        const info =
          statusMap[status] || { text: status, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '已确认',
      dataIndex: 'isConfirmed',
      key: 'isConfirmed',
      width: 80,
      render: (confirmed: boolean) => (
        <Tag color={confirmed ? 'success' : 'warning'}>
          {confirmed ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
  ];

  // 照片表
  const photoColumns = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      ellipsis: true,
    },
    {
      title: '场次',
      dataIndex: 'sceneNumber',
      key: 'sceneNumber',
      width: 80,
    },
    {
      title: '角色',
      dataIndex: 'character',
      key: 'character',
      width: 100,
    },
    {
      title: '条码',
      dataIndex: 'barcode',
      key: 'barcode',
      width: 120,
    },
    {
      title: '照片类型',
      dataIndex: 'photoType',
      key: 'photoType',
      width: 100,
      render: (type: string) => {
        const typeMap: Record<string, { text: string; color: string }> = {
          continuity: { text: '连续性', color: 'blue' },
          detail: { text: '细节', color: 'purple' },
          fit: { text: '试穿', color: 'green' },
        };
        const info = typeMap[type] || { text: type, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '拍摄日期',
      dataIndex: 'takenDate',
      key: 'takenDate',
      width: 120,
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
  ];

  const tabItems = [
    {
      key: 'scenes',
      label: (
        <Space>
          <CalendarOutlined />
          场次通告
          <Tag color="blue">{scenes.length}</Tag>
        </Space>
      ),
      children: (
        <Table
          dataSource={scenes}
          columns={sceneColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1000 }}
          locale={{
            emptyText: <Empty description="暂无场次数据" />,
          }}
        />
      ),
    },
    {
      key: 'costumes',
      label: (
        <Space>
          <ShoppingOutlined />
          服装清单
          <Tag color="green">{costumes.length}</Tag>
        </Space>
      ),
      children: (
        <Table
          dataSource={costumes}
          columns={costumeColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: <Empty description="暂无服装数据" />,
          }}
        />
      ),
    },
    {
      key: 'wash',
      label: (
        <Space>
          <FileTextOutlined />
          清洗记录
          <Tag color="cyan">{washRecords.length}</Tag>
        </Space>
      ),
      children: (
        <Table
          dataSource={washRecords}
          columns={washColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
          locale={{
            emptyText: <Empty description="暂无清洗记录" />,
          }}
        />
      ),
    },
    {
      key: 'alteration',
      label: (
        <Space>
          <FileTextOutlined />
          改衣记录
          <Tag color="purple">{alterationRecords.length}</Tag>
        </Space>
      ),
      children: (
        <Table
          dataSource={alterationRecords}
          columns={alterationColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1000 }}
          locale={{
            emptyText: <Empty description="暂无改衣记录" />,
          }}
        />
      ),
    },
    {
      key: 'photos',
      label: (
        <Space>
          <PictureOutlined />
          参考照片
          <Tag color="magenta">{photos.length}</Tag>
        </Space>
      ),
      children: (
        <Table
          dataSource={photos}
          columns={photoColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
          locale={{
            emptyText: <Empty description="暂无照片数据" />,
          }}
        />
      ),
    },
  ];

  return (
    <div>
      <Card className="panel-card">
        <Title level={4}>数据浏览</Title>
        
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="搜索场次、服装、条码..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
        </Row>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>
    </div>
  );
};

export default DataView;
