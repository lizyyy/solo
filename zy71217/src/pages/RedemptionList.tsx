import React, { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Dropdown,
  MenuProps,
  Modal,
  message,
  Checkbox
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ExportOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  CopyOutlined,
  LockOutlined,
  UnlockOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { detectAnomalies, generateProcessingConclusion } from '../services/validationService';
import { exportToExcel, exportToCSV } from '../services/exportService';
import { getStatusColor, getStatusText, formatCurrency } from '../utils/helpers';
import { Redemption, RedemptionStatus } from '../types';
import ProcessingConclusion from '../components/ProcessingConclusion';

const { Search } = Input;
const { Option } = Select;

const RedemptionList: React.FC = () => {
  const navigate = useNavigate();
  const { redemptions, batches, updateRedemption, deleteRedemption, addOperationLog, currentUser } = useAppStore();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [showErrorOnly, setShowErrorOnly] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const filteredData = useMemo(() => {
    let result = [...redemptions];

    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      result = result.filter(r =>
        r.cardNumber.toLowerCase().includes(lowerSearch) ||
        r.cardHolderName.toLowerCase().includes(lowerSearch) ||
        r.phone.includes(lowerSearch)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }

    if (batchFilter !== 'all') {
      result = result.filter(r => r.batchId === batchFilter);
    }

    if (showErrorOnly) {
      result = result.filter(r => {
        const validation = detectAnomalies(r, redemptions);
        return !validation.isValid || validation.warnings.length > 0;
      });
    }

    return result;
  }, [redemptions, searchText, statusFilter, batchFilter, showErrorOnly]);

  const stats = useMemo(() => {
    const totalAmount = redemptions.reduce((sum, r) => sum + Math.max(0, r.currentBalance), 0);
    const errorCount = redemptions.filter(r => r.currentBalance < 0).length;
    const disputeCount = redemptions.filter(r => r.hasDispute).length;
    const completedCount = redemptions.filter(r => r.status === 'completed').length;

    return { total: redemptions.length, totalAmount, errorCount, disputeCount, completedCount };
  }, [redemptions]);

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条兑付记录吗？此操作不可撤销。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        deleteRedemption(id);
        message.success('删除成功');
      }
    });
  };

  const handleFreeze = (record: Redemption, frozen: boolean) => {
    const beforeData = JSON.stringify({ isFrozen: record.isFrozen, status: record.status });
    updateRedemption(record.id, {
      isFrozen: frozen,
      status: frozen ? 'frozen' as RedemptionStatus : 'pending' as RedemptionStatus
    });
    addOperationLog({
      id: Date.now().toString(),
      redemptionId: record.id,
      operationType: frozen ? 'freeze' : 'unfreeze',
      operator: currentUser,
      operateTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
      beforeData,
      afterData: JSON.stringify({ isFrozen: frozen, status: frozen ? 'frozen' : 'pending' }),
      remark: frozen ? '冻结兑付' : '解冻兑付'
    });
    message.success(frozen ? '已冻结' : '已解冻');
  };

  const handleExportExcel = () => {
    exportToExcel(filteredData, '兑付清单');
    message.success('Excel导出成功');
  };

  const handleExportCSV = () => {
    exportToCSV(filteredData, '兑付清单');
    message.success('CSV导出成功');
  };

  const exportMenuItems: MenuProps['items'] = [
    { key: 'excel', label: '导出 Excel', icon: <ExportOutlined />, onClick: handleExportExcel },
    { key: 'csv', label: '导出 CSV', icon: <ExportOutlined />, onClick: handleExportCSV }
  ];

  const getRowClassName = (record: Redemption) => {
    const validation = detectAnomalies(record, redemptions);
    if (validation.errors.length > 0) {
      return 'row-error-flash';
    }
    if (record.hasDispute && !record.isFrozen) {
      return 'border-warning-pulse';
    }
    return '';
  };

  const columns = [
    {
      title: '卡号',
      dataIndex: 'cardNumber',
      key: 'cardNumber',
      width: 140,
      render: (text: string, record: Redemption) => {
        const validation = detectAnomalies(record, redemptions);
        const hasDuplicate = validation.errors.some(e => e.code === 'DUPLICATE_REGISTRATION');
        return (
          <div className="flex items-center gap-1">
            <span className="font-mono">{text}</span>
            {hasDuplicate && <CopyOutlined className="text-yellow-500" title="重复登记" />}
          </div>
        );
      }
    },
    {
      title: '持卡人',
      dataIndex: 'cardHolderName',
      key: 'cardHolderName',
      width: 100
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 130
    },
    {
      title: '初始余额',
      dataIndex: 'initialBalance',
      key: 'initialBalance',
      width: 120,
      align: 'right' as const,
      render: (val: number) => <span className="font-mono">¥{formatCurrency(val)}</span>
    },
    {
      title: '当前余额',
      dataIndex: 'currentBalance',
      key: 'currentBalance',
      width: 120,
      align: 'right' as const,
      render: (val: number, record: Redemption) => {
        const isNegative = val < 0;
        return (
          <span className={`font-mono font-semibold ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
            {isNegative && <ExclamationCircleOutlined className="mr-1" />}
            ¥{formatCurrency(val)}
          </span>
        );
      },
      sorter: (a: Redemption, b: Redemption) => a.currentBalance - b.currentBalance
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: RedemptionStatus, record: Redemption) => (
        <Space direction="vertical" size="small">
          <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
          <Space>
            {record.hasDispute && <Tag color="red" icon={<WarningOutlined />}>争议</Tag>}
            {record.isFrozen && <Tag color="orange" icon={<LockOutlined />}>冻结</Tag>}
          </Space>
        </Space>
      )
    },
    {
      title: '批次',
      dataIndex: 'batchId',
      key: 'batchId',
      width: 100,
      render: (batchId: string) => batchId || '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      sorter: (a: Redemption, b: Redemption) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Redemption) => {
        const validation = detectAnomalies(record, redemptions);
        const hasIssues = !validation.isValid || validation.warnings.length > 0;

        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/redemption/${record.id}`)}
            >
              详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/redemption/${record.id}/edit`)}
            >
              编辑
            </Button>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'freeze',
                    label: record.isFrozen ? '解除冻结' : '冻结',
                    icon: record.isFrozen ? <UnlockOutlined /> : <LockOutlined />,
                    onClick: () => handleFreeze(record, !record.isFrozen)
                  },
                  { type: 'divider' },
                  {
                    key: 'delete',
                    label: '删除',
                    icon: <DeleteOutlined />,
                    danger: true,
                    onClick: () => handleDelete(record.id)
                  }
                ]
              }}
            >
              <Button type="link" size="small">更多</Button>
            </Dropdown>
          </Space>
        );
      }
    }
  ];

  const hasGlobalIssues = useMemo(() => {
    return redemptions.some(r => {
      const v = detectAnomalies(r, redemptions);
      return !v.isValid || v.warnings.length > 0;
    });
  }, [redemptions]);

  const globalConclusion = useMemo(() => {
    const allIssues = redemptions.flatMap(r => {
      const v = detectAnomalies(r, redemptions);
      return [...v.errors, ...v.warnings];
    });
    return generateProcessingConclusion({
      isValid: allIssues.filter(i => i.severity === 'error').length === 0,
      errors: allIssues.filter(i => i.severity === 'error'),
      warnings: allIssues.filter(i => i.severity === 'warning') as any
    });
  }, [redemptions]);

  return (
    <div className="space-y-6">
      {hasGlobalIssues && (
        <ProcessingConclusion conclusion={globalConclusion} showDetails={false} />
      )}

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="总登记数" value={stats.total} suffix="笔" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="兑付总金额"
              value={stats.totalAmount}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#00B42A' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="异常记录"
              value={stats.errorCount}
              suffix="笔"
              valueStyle={{ color: '#F53F3F' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completedCount}
              suffix="笔"
              valueStyle={{ color: '#165DFF' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <Space size="middle">
            <Search
              placeholder="搜索卡号、姓名、电话"
              allowClear
              style={{ width: 280 }}
              onChange={e => setSearchText(e.target.value)}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 140 }}
            >
              <Option value="all">全部状态</Option>
              <Option value="pending">待处理</Option>
              <Option value="processing">处理中</Option>
              <Option value="completed">已完成</Option>
              <Option value="frozen">已冻结</Option>
              <Option value="disputed">有争议</Option>
            </Select>
            <Select
              value={batchFilter}
              onChange={setBatchFilter}
              style={{ width: 160 }}
            >
              <Option value="all">全部批次</Option>
              {batches.map(b => (
                <Option key={b.id} value={b.id}>{b.batchNo}</Option>
              ))}
            </Select>
            <Checkbox
              checked={showErrorOnly}
              onChange={e => setShowErrorOnly(e.target.checked)}
            >
              只看异常
            </Checkbox>
          </Space>
          <Space>
            <Dropdown menu={{ items: exportMenuItems }}>
              <Button icon={<ExportOutlined />}>导出</Button>
            </Dropdown>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/redemption/new')}
            >
              新增登记
            </Button>
          </Space>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          rowClassName={getRowClassName}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: total => `共 ${total} 条记录`
          }}
          scroll={{ x: 1300 }}
        />
      </Card>
    </div>
  );
};

export default RedemptionList;
