import React, { useMemo, useState } from 'react';
import { Card, List, Tag, Button, Timeline, Collapse, Typography, Input, Select, DatePicker, Divider, Modal } from 'antd';
import {
  History,
  User,
  Edit3,
  Plus,
  Trash2,
  Upload,
  AlertTriangle,
  FileText,
  Search,
  GitBranch,
  Receipt,
  Eye,
  Download,
  Clock,
} from 'lucide-react';
import { useContractStore } from '@/store';
import { HistoryRecord, FieldChange } from '@/types';
import {
  formatDateTime,
  formatAmount,
  formatRate,
} from '@/utils/formatters';
import { OPERATION_TYPE_LABELS } from '@/utils/constants';
import dayjs, { Dayjs } from 'dayjs';

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const operationIcons: Record<string, React.ReactNode> = {
  create: <Plus size={14} />,
  update: <Edit3 size={14} />,
  delete: <Trash2 size={14} />,
  manual_correct: <Edit3 size={14} />,
  supplement: <Upload size={14} />,
};

const operationColors: Record<string, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  manual_correct: 'orange',
  supplement: 'cyan',
};

const HistoryPage: React.FC = () => {
  const { history, contracts, payments, rolloverApps } = useContractStore();

  const [filterContractNo, setFilterContractNo] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterDateRange, setFilterDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const operators = useMemo(() => {
    const set = new Set(history.map((h) => h.operator));
    return Array.from(set);
  }, [history]);

  const filteredHistory = useMemo(() => {
    let result = [...history];

    if (filterContractNo) {
      result = result.filter((h) => {
        if (h.contractId) {
          const contract = contracts.find((c) => c.id === h.contractId);
          return contract?.contractNo
            .toLowerCase()
            .includes(filterContractNo.toLowerCase());
        }
        if (h.applicationId) {
          const app = rolloverApps.find((a) => a.id === h.applicationId);
          const contract = app
            ? contracts.find((c) => c.id === app.originalContractId)
            : null;
          return contract?.contractNo
            .toLowerCase()
            .includes(filterContractNo.toLowerCase());
        }
        if (h.paymentId) {
          const payment = payments.find((p) => p.id === h.paymentId);
          const contract = payment
            ? contracts.find((c) => c.id === payment.contractId)
            : null;
          return contract?.contractNo
            .toLowerCase()
            .includes(filterContractNo.toLowerCase());
        }
        return false;
      });
    }

    if (filterOperator) {
      result = result.filter((h) => h.operator === filterOperator);
    }

    if (filterType) {
      result = result.filter((h) => h.operationType === filterType);
    }

    if (filterDateRange && filterDateRange[0] && filterDateRange[1]) {
      result = result.filter((h) => {
        const ts = dayjs(h.timestamp);
        return ts.isAfter(filterDateRange[0]!) && ts.isBefore(filterDateRange[1]!);
      });
    }

    return result;
  }, [history, filterContractNo, filterOperator, filterType, filterDateRange, contracts, payments, rolloverApps]);

  const getRelatedObjectInfo = (record: HistoryRecord) => {
    if (record.contractId) {
      const contract = contracts.find((c) => c.id === record.contractId);
      return {
        type: '合约',
        icon: <GitBranch size={14} />,
        name: contract?.contractNo || record.contractId,
      };
    }
    if (record.applicationId) {
      const app = rolloverApps.find((a) => a.id === record.applicationId);
      return {
        type: '展期申请',
        icon: <FileText size={14} />,
        name: app?.applicationNo || record.applicationId,
      };
    }
    if (record.paymentId) {
      const payment = payments.find((p) => p.id === record.paymentId);
      return {
        type: '收付记录',
        icon: <Receipt size={14} />,
        name: payment?.voucherNo || record.paymentId,
      };
    }
    return null;
  };

  const formatFieldValue = (fieldName: string, value: any): string => {
    if (value === null || value === undefined) return '-';
    if (fieldName.includes('Date') || fieldName.includes('At')) {
      return formatDateTime(value);
    }
    if (fieldName === 'notionalAmount') {
      return formatAmount(value);
    }
    if (fieldName === 'forwardRate' || fieldName === 'spotRate' || fieldName === 'swapPoints' || fieldName === 'rolloverPoints') {
      return formatRate(value);
    }
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    return String(value);
  };

  const renderFieldChanges = (changes: FieldChange[]) => {
    return (
      <div className="space-y-2">
        {changes.map((change, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg border ${
              change.isManuallyModified
                ? 'bg-amber-50 border-amber-200'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Text type="secondary" className="text-sm">
                  字段：
                </Text>
                <Text code className="font-mono text-sm">
                  {change.fieldName}
                </Text>
                {change.isManuallyModified && (
                  <Tag color="orange" className="m-0 text-[10px]">
                    人工修正
                  </Tag>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Text type="secondary" className="text-xs">
                  修改前：
                </Text>
                <div className="font-mono text-error line-through">
                  {formatFieldValue(change.fieldName, change.oldValue)}
                </div>
              </div>
              <div>
                <Text type="secondary" className="text-xs">
                  修改后：
                </Text>
                <div className="font-mono text-success font-medium">
                  {formatFieldValue(change.fieldName, change.newValue)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const handleViewDetail = (record: HistoryRecord) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  const stats = {
    total: history.length,
    manualCorrect: history.filter((h) => h.operationType === 'manual_correct').length,
    supplement: history.filter((h) => h.operationType === 'supplement').length,
    update: history.filter((h) => h.operationType === 'update').length,
    create: history.filter((h) => h.operationType === 'create').length,
  };

  return (
    <div className="space-y-6">
      <Card
        title={
          <div className="flex items-center gap-3">
            <History size={20} className="text-primary-700" />
            <span className="font-semibold">操作历史</span>
          </div>
        }
        className="shadow-sm"
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-primary-700">{stats.total}</div>
            <div className="text-sm text-gray-600">总操作数</div>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-warning">{stats.manualCorrect}</div>
            <div className="text-sm text-gray-600">人工修正</div>
          </div>
          <div className="p-4 bg-cyan-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-cyan-600">{stats.supplement}</div>
            <div className="text-sm text-gray-600">补录材料</div>
          </div>
          <div className="p-4 bg-indigo-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-indigo-600">{stats.update}</div>
            <div className="text-sm text-gray-600">更新操作</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-success">{stats.create}</div>
            <div className="text-sm text-gray-600">新建操作</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">合约编号</label>
            <Input
              placeholder="请输入合约编号"
              prefix={<Search size={14} />}
              value={filterContractNo}
              onChange={(e) => setFilterContractNo(e.target.value)}
              allowClear
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">操作人</label>
            <Select
              placeholder="请选择操作人"
              value={filterOperator || undefined}
              onChange={setFilterOperator}
              allowClear
              style={{ width: '100%' }}
              options={operators.map((o) => ({ label: o, value: o }))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">操作类型</label>
            <Select
              placeholder="请选择操作类型"
              value={filterType || undefined}
              onChange={setFilterType}
              allowClear
              style={{ width: '100%' }}
              options={Object.entries(OPERATION_TYPE_LABELS).map(([key, label]) => ({
                label,
                value: key,
              }))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">操作时间</label>
            <RangePicker
              style={{ width: '100%' }}
              value={filterDateRange}
              onChange={setFilterDateRange}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-shrink-0 w-2 pt-2">
            <Timeline
              mode="left"
              items={filteredHistory.slice(0, 10).map((record) => ({
                color: operationColors[record.operationType] || 'blue',
                dot: operationIcons[record.operationType],
                children: <div className="h-16" />,
              }))}
            />
          </div>

          <div className="flex-1">
            <List
              dataSource={filteredHistory}
              loading={false}
              renderItem={(record) => {
                const relatedInfo = getRelatedObjectInfo(record);
                return (
                  <List.Item
                    className="mb-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                    actions={[
                      <Button
                        key="view"
                        type="link"
                        size="small"
                        icon={<Eye size={14} />}
                        onClick={() => handleViewDetail(record)}
                      >
                        详情
                      </Button>,
                      <Button
                        key="export"
                        type="link"
                        size="small"
                        icon={<Download size={14} />}
                      >
                        导出
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <div className="flex items-center gap-2 flex-wrap">
                          <Tag
                            color={operationColors[record.operationType]}
                            icon={operationIcons[record.operationType]}
                            className="m-0"
                          >
                            {OPERATION_TYPE_LABELS[record.operationType]}
                          </Tag>
                          {relatedInfo && (
                            <Tag className="m-0">
                              {relatedInfo.icon}
                              <span className="ml-1">{relatedInfo.name}</span>
                            </Tag>
                          )}
                          {record.batchNo && (
                            <Tag color="purple" className="m-0">
                              {record.batchNo}
                            </Tag>
                          )}
                          <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
                            <Clock size={12} />
                            {formatDateTime(record.timestamp)}
                          </span>
                        </div>
                      }
                      description={
                        <div className="mt-2">
                          <div className="flex items-center gap-4 text-sm mb-2">
                            <span className="flex items-center gap-1 text-gray-500">
                              <User size={12} />
                              {record.operator}
                            </span>
                            {record.reason && (
                              <span className="text-gray-600">
                                原因：{record.reason}
                              </span>
                            )}
                          </div>
                          <Collapse
                            ghost
                            size="small"
                            items={[
                              {
                                key: 'changes',
                                label: (
                                  <span className="text-sm text-gray-500">
                                    字段变更（{record.fieldChanges.length} 项）
                                  </span>
                                ),
                                children: renderFieldChanges(record.fieldChanges),
                              },
                            ]}
                          />
                        </div>
                      }
                    />
                  </List.Item>
                );
              }}
              pagination={{
                pageSize: 5,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          </div>
        </div>
      </Card>

      <Card
        title={
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" />
            <span className="font-semibold">操作规范说明</span>
          </div>
        }
        size="small"
        className="shadow-sm"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-amber-50 rounded border border-amber-200">
            <div className="font-medium text-amber-800 mb-1">人工修正</div>
            <div className="text-amber-700">
              必须填写修改原因，系统将永久记录修改人、修改时间、修改前后对比
            </div>
          </div>
          <div className="p-3 bg-cyan-50 rounded border border-cyan-200">
            <div className="font-medium text-cyan-800 mb-1">材料补录</div>
            <div className="text-cyan-700">
              补录数据不会覆盖历史判断，新旧判断将同时显示并明确标识
            </div>
          </div>
        </div>
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <Eye size={18} />
            操作详情
          </div>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text type="secondary" className="text-sm">
                  操作类型
                </Text>
                <div>
                  <Tag
                    color={operationColors[selectedRecord.operationType]}
                    icon={operationIcons[selectedRecord.operationType]}
                    className="m-0 mt-1"
                  >
                    {OPERATION_TYPE_LABELS[selectedRecord.operationType]}
                  </Tag>
                </div>
              </div>
              <div>
                <Text type="secondary" className="text-sm">
                  操作时间
                </Text>
                <div className="font-mono mt-1">
                  {formatDateTime(selectedRecord.timestamp)}
                </div>
              </div>
              <div>
                <Text type="secondary" className="text-sm">
                  操作人
                </Text>
                <div className="mt-1">{selectedRecord.operator}</div>
              </div>
              {selectedRecord.batchNo && (
                <div>
                  <Text type="secondary" className="text-sm">
                    所属批次
                  </Text>
                  <div className="mt-1">
                    <Tag color="purple">{selectedRecord.batchNo}</Tag>
                  </div>
                </div>
              )}
            </div>

            {getRelatedObjectInfo(selectedRecord) && (
              <>
                <Divider orientation="left">操作对象</Divider>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {getRelatedObjectInfo(selectedRecord)?.icon}
                    <span className="font-medium">
                      {getRelatedObjectInfo(selectedRecord)?.type}
                    </span>
                    <span className="font-mono text-primary-700">
                      {getRelatedObjectInfo(selectedRecord)?.name}
                    </span>
                  </div>
                </div>
              </>
            )}

            <Divider orientation="left">修改原因</Divider>
            <Paragraph className="text-gray-700">
              {selectedRecord.reason}
            </Paragraph>

            <Divider orientation="left">字段变更详情</Divider>
            {renderFieldChanges(selectedRecord.fieldChanges)}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HistoryPage;
