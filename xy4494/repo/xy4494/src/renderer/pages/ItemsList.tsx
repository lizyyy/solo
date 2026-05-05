import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Input,
  Button,
  Space,
  Tag,
  Popconfirm,
  DatePicker,
  Select,
  Card,
  Row,
  Col,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { LostItem, ItemStatus, ItemCategory } from '../../shared/types';

const { RangePicker } = DatePicker;
const { Search } = Input;

interface ItemsListProps {
  items: LostItem[];
  loading: boolean;
  onRefresh: () => void;
  onOpenDetail: (item: LostItem) => void;
  onDelete: (id: string) => void;
  getStatusLabel: (status: ItemStatus) => string;
  getStatusColor: (status: ItemStatus) => string;
  getCategoryLabel: (category: ItemCategory) => string;
}

const ItemsList: React.FC<ItemsListProps> = ({
  items,
  loading,
  onRefresh,
  onOpenDetail,
  onDelete,
  getStatusLabel,
  getStatusColor,
  getCategoryLabel,
}) => {
  const [searchText, setSearchText] = useState('');
  const [filteredItems, setFilteredItems] = useState<LostItem[]>(items);
  const [filterStations, setFilterStations] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const uniqueStations = Array.from(new Set(items.map((i) => i.station))).sort();
  const uniqueCategories = Array.from(new Set(items.map((i) => i.category))).sort();
  const uniqueStatuses = Array.from(new Set(items.map((i) => i.status))).sort();

  const applyFilters = useCallback(() => {
    let result = [...items];

    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (item) =>
          item.itemCode.toLowerCase().includes(lower) ||
          item.description.toLowerCase().includes(lower) ||
          item.finderName.toLowerCase().includes(lower) ||
          item.foundLocation.toLowerCase().includes(lower) ||
          item.specialMarks?.toLowerCase().includes(lower) ||
          item.photos.some((p) => p.tags.some((t) => t.toLowerCase().includes(lower)))
      );
    }

    if (filterStations.length > 0) {
      result = result.filter((item) => filterStations.includes(item.station));
    }

    if (filterCategories.length > 0) {
      result = result.filter((item) => filterCategories.includes(item.category));
    }

    if (filterStatuses.length > 0) {
      result = result.filter((item) => filterStatuses.includes(item.status));
    }

    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf('day');
      const end = dateRange[1].endOf('day');
      result = result.filter((item) => {
        const itemDate = dayjs(item.foundTime || item.createdAt);
        return itemDate.isAfter(start.subtract(1, 'second')) && itemDate.isBefore(end.add(1, 'second'));
      });
    }

    setFilteredItems(result);
  }, [items, searchText, filterStations, filterCategories, filterStatuses, dateRange]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const clearFilters = () => {
    setSearchText('');
    setFilterStations([]);
    setFilterCategories([]);
    setFilterStatuses([]);
    setDateRange(null);
  };

  const columns = [
    {
      title: '物品编号',
      dataIndex: 'itemCode',
      key: 'itemCode',
      width: 140,
      fixed: 'left' as const,
      render: (code: string, record: LostItem) => (
        <a onClick={() => onOpenDetail(record)}>{code}</a>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      minWidth: 200,
    },
    {
      title: '站点',
      dataIndex: 'station',
      key: 'station',
      width: 100,
      filters: uniqueStations.map((s) => ({ text: s, value: s })),
      onFilter: (value: string | number | boolean, record: LostItem) =>
        record.station === value,
    },
    {
      title: '类型',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: ItemCategory) => getCategoryLabel(category),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: ItemStatus) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: '发现时间',
      dataIndex: 'foundTime',
      key: 'foundTime',
      width: 160,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
      sorter: (a: LostItem, b: LostItem) =>
        dayjs(a.foundTime).unix() - dayjs(b.foundTime).unix(),
    },
    {
      title: '交件人',
      dataIndex: 'finderName',
      key: 'finderName',
      width: 100,
    },
    {
      title: '预估价值',
      dataIndex: 'estimatedValue',
      key: 'estimatedValue',
      width: 100,
      render: (value: number) => (value > 0 ? `¥${value}` : '-'),
    },
    {
      title: '照片数量',
      dataIndex: 'photos',
      key: 'photos',
      width: 90,
      render: (photos: unknown[]) => photos.length,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_: unknown, record: LostItem) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => onOpenDetail(record)}
            title="查看详情"
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => onOpenDetail(record)}
            title="编辑"
          />
          <Popconfirm
            title="确认删除?"
            onConfirm={() => onDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} title="删除" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div className="page-header">
        <h2>失物管理</h2>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
      </div>

      <Card className="filter-section">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="搜索物品编号、描述、交件人、标签..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              mode="multiple"
              placeholder="筛选站点"
              style={{ width: '100%' }}
              value={filterStations}
              onChange={setFilterStations}
              options={uniqueStations.map((s) => ({ label: s, value: s }))}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              mode="multiple"
              placeholder="筛选类型"
              style={{ width: '100%' }}
              value={filterCategories}
              onChange={setFilterCategories}
              options={uniqueCategories.map((c) => ({
                label: getCategoryLabel(c as ItemCategory),
                value: c,
              }))}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              mode="multiple"
              placeholder="筛选状态"
              style={{ width: '100%' }}
              value={filterStatuses}
              onChange={setFilterStatuses}
              options={uniqueStatuses.map((s) => ({
                label: getStatusLabel(s as ItemStatus),
                value: s,
              }))}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={setDateRange}
              placeholder={['开始日期', '结束日期']}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Button onClick={clearFilters}>清除筛选</Button>
          </Col>
        </Row>
      </Card>

      <Card className="data-table-container">
        <Table
          columns={columns}
          dataSource={filteredItems}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            defaultPageSize: 20,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
        />
      </Card>
    </Spin>
  );
};

export default ItemsList;
