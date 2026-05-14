import { useState } from 'react';
import { Table, Tag, Space, Button, Input, Select, DatePicker, Row, Col, Badge, Card } from 'antd';
import { EyeOutlined, SearchOutlined, WarningOutlined, ClockCircleOutlined, DollarOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { BoothApplication, BoothStatus } from '../types';
import { useBoothStore } from '../store/boothStore';
import CreateApplicationModal from './CreateApplicationModal';

const { RangePicker } = DatePicker;

interface ApplicationListProps {
  onViewDetail: (app: BoothApplication) => void;
}

const ApplicationList = ({ onViewDetail }: ApplicationListProps) => {
  const { getFilteredApplications, setFilters, getStatusText, getStatusColor, filters, resetToMockData, isInitialized } = useBoothStore();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<BoothStatus | undefined>();
  const [hasIssues, setHasIssues] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const data = getFilteredApplications();

  const handleSearch = () => {
    setFilters({
      ...filters,
      brandName: searchText || undefined,
      status: statusFilter,
      hasIssues: hasIssues || undefined,
    });
  };

  const handleDateChange = (dates: unknown) => {
    if (dates && Array.isArray(dates) && dates[0] && dates[1]) {
      setFilters({
        ...filters,
        startDate: (dates[0] as { format: (f: string) => string }).format('YYYY-MM-DD'),
        endDate: (dates[1] as { format: (f: string) => string }).format('YYYY-MM-DD'),
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { startDate, endDate, ...rest } = filters;
      setFilters(rest);
    }
  };

  const columns: ColumnsType<BoothApplication> = [
    {
      title: '申请编号',
      dataIndex: 'applicationNo',
      key: 'applicationNo',
      width: 160,
      fixed: 'left',
      render: (text, record) => (
        <Space>
          {text}
          {(record.hasScheduleConflict || record.hasMaterialIssue || record.hasElectricityIssue || record.hasDepositIssue || record.hasTeardownIssue) && (
            <Badge dot status="error" />
          )}
        </Space>
      ),
    },
    {
      title: '品牌',
      dataIndex: 'brandName',
      key: 'brandName',
      width: 100,
    },
    {
      title: '展位',
      dataIndex: 'boothCode',
      key: 'boothCode',
      width: 80,
      render: (code, record) => (
        <Space>
          {code}
          {record.hasScheduleConflict && <Tag color="red" icon={<WarningOutlined />}>档期冲突</Tag>}
        </Space>
      ),
    },
    {
      title: '展位名称',
      dataIndex: 'boothName',
      key: 'boothName',
      width: 120,
    },
    {
      title: '活动日期',
      key: 'date',
      width: 200,
      render: (_, record) => (
        <div>
          <div>{record.startDate} 至</div>
          <div>{record.endDate}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: BoothStatus) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '材料审核',
      key: 'material',
      width: 100,
      render: (_, record) => {
        const allApproved = record.materials.every(m => m.status === 'approved');
        const hasRejected = record.materials.some(m => m.status === 'rejected');
        const hasPending = record.materials.some(m => m.status === 'pending');
        
        if (allApproved) return <Tag color="green">已通过</Tag>;
        if (hasRejected) return <Tag color="red">有问题</Tag>;
        if (hasPending) return <Tag color="orange" icon={<ClockCircleOutlined />}>审核中</Tag>;
        return <Tag color="default">未提交</Tag>;
      },
    },
    {
      title: '电力申请',
      key: 'electricity',
      width: 100,
      render: (_, record) => {
        if (record.electricity.status === 'approved') return <Tag color="green">已通过</Tag>;
        if (record.electricity.status === 'exceeded') return <Tag color="red">超额</Tag>;
        if (record.electricity.status === 'rejected') return <Tag color="red">被拒绝</Tag>;
        return <Tag color="orange" icon={<ClockCircleOutlined />}>审核中</Tag>;
      },
    },
    {
      title: '押金',
      key: 'deposit',
      width: 100,
      render: (_, record) => {
        if (record.deposit.status === 'paid') return <Tag color="green">已缴纳</Tag>;
        if (record.deposit.status === 'refunded') return <Tag color="green">已退还</Tag>;
        if (record.deposit.status === 'refund_pending') return <Tag color="orange">待退款</Tag>;
        return <Tag color="orange" icon={<DollarOutlined />}>未缴纳</Tag>;
      },
    },
    {
      title: '撤场验收',
      key: 'teardown',
      width: 100,
      render: (_, record) => {
        if (record.teardown.status === 'passed') return <Tag color="green">已通过</Tag>;
        if (record.teardown.status === 'failed') return <Tag color="red">未通过</Tag>;
        if (record.teardown.status === 'inspecting') return <Tag color="blue">验收中</Tag>;
        return <Tag color="default">未开始</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => onViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  const statusOptions: { label: string; value: BoothStatus }[] = [
    { label: '待审核', value: 'pending_approval' },
    { label: '材料审核中', value: 'material_review' },
    { label: '电力已审核', value: 'electricity_approved' },
    { label: '押金已缴纳', value: 'deposit_paid' },
    { label: '搭建已确认', value: 'setup_confirmed' },
    { label: '使用中', value: 'in_use' },
    { label: '待撤场验收', value: 'teardown_pending' },
    { label: '已完成', value: 'completed' },
    { label: '已拒绝', value: 'rejected' },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col>
            <Space wrap>
              <Input
                placeholder="搜索品牌"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 200 }}
                prefix={<SearchOutlined />}
              />
              <Select
                placeholder="状态筛选"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                allowClear
                options={statusOptions}
              />
              <RangePicker
                onChange={handleDateChange}
                placeholder={['开始日期', '结束日期']}
              />
              <Select
                placeholder="异常筛选"
                value={hasIssues ? 'yes' : undefined}
                onChange={(v) => setHasIssues(v === 'yes')}
                style={{ width: 150 }}
                allowClear
                options={[{ label: '仅显示异常', value: 'yes' }]}
              />
              <Button type="primary" onClick={handleSearch}>
                搜索
              </Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button onClick={resetToMockData} icon={<ReloadOutlined />}>
                重置数据
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
                新增申请
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          scroll={{ x: 1300 }}
          loading={!isInitialized}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <CreateApplicationModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
};

export default ApplicationList;
