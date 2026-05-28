import React, { useMemo } from 'react';
import {
  Card,
  Descriptions,
  Table,
  Tag,
  Button,
  Space,
  Divider,
  List,
  Avatar,
  Tooltip,
  Collapse,
  Timeline,
  Badge
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  CreditCardOutlined,
  UserOutlined,
  ShopOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LockOutlined,
  WarningOutlined,
  IdcardOutlined,
  CalculatorOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { detectAnomalies, generateProcessingConclusion } from '../services/validationService';
import { recalculateBalance } from '../services/balanceService';
import {
  getStatusColor,
  getStatusText,
  formatCurrency,
  maskIdNumber,
  getDisputeStatusText,
  getDisputeStatusColor,
  getOperationTypeText
} from '../utils/helpers';
import { ConsumptionType } from '../types';
import ProcessingConclusion from '../components/ProcessingConclusion';

const RedemptionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getRedemptionById,
    getConsumptionRecordsByRedemptionId,
    getIdentificationById,
    getDisputeNotesByRedemptionId,
    getBatchById,
    getOperationLogsByRedemptionId,
    redemptions
  } = useAppStore();

  const redemption = useMemo(() => getRedemptionById(id || ''), [id, getRedemptionById]);
  const consumptionRecords = useMemo(() => getConsumptionRecordsByRedemptionId(id || ''), [id, getConsumptionRecordsByRedemptionId]);
  const identification = useMemo(() => getIdentificationById(redemption?.identityId || ''), [redemption, getIdentificationById]);
  const disputeNotes = useMemo(() => getDisputeNotesByRedemptionId(id || ''), [id, getDisputeNotesByRedemptionId]);
  const batch = useMemo(() => getBatchById(redemption?.batchId || ''), [redemption, getBatchById]);
  const operationLogs = useMemo(() => getOperationLogsByRedemptionId(id || ''), [id, getOperationLogsByRedemptionId]);

  const validationResult = useMemo(() => {
    if (!redemption) return null;
    return detectAnomalies(redemption, redemptions);
  }, [redemption, redemptions]);

  const processingConclusion = useMemo(() => {
    if (!validationResult) return null;
    return generateProcessingConclusion(validationResult);
  }, [validationResult]);

  const balanceCalc = useMemo(() => {
    if (!redemption) return null;
    return recalculateBalance(redemption.initialBalance, consumptionRecords);
  }, [redemption, consumptionRecords]);

  if (!redemption) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-gray-500">未找到该兑付记录</p>
          <Button type="primary" onClick={() => navigate('/')} className="mt-4">
            返回列表
          </Button>
        </div>
      </Card>
    );
  }

  const consumptionColumns = [
    {
      title: '时间',
      dataIndex: 'consumeTime',
      key: 'consumeTime',
      width: 180
    },
    {
      title: '门店',
      dataIndex: 'storeName',
      key: 'storeName'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: ConsumptionType) => {
        const colorMap: Record<ConsumptionType, string> = {
          consume: 'red',
          recharge: 'green',
          refund: 'orange'
        };
        const textMap: Record<ConsumptionType, string> = {
          consume: '消费',
          recharge: '充值',
          refund: '退款'
        };
        return <Tag color={colorMap[type]}>{textMap[type]}</Tag>;
      }
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (val: number, record: any) => (
        <span className={`font-mono ${record.type === 'consume' ? 'text-red-600' : 'text-green-600'}`}>
          {record.type === 'consume' ? '-' : '+'}¥{formatCurrency(val)}
        </span>
      )
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (val: string) => val || '-'
    }
  ];

  const collapseItems = [
    {
      key: '1',
      label: (
        <span className="flex items-center gap-2">
          <ShopOutlined />
          消费流水
          <Badge count={consumptionRecords.length} size="small" className="ml-2" />
        </span>
      ),
      children: (
        <div>
          {balanceCalc && (
            <Card size="small" className="mb-4 bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <CalculatorOutlined className="text-blue-500" />
                <span className="font-medium text-blue-700">余额计算过程</span>
              </div>
              <pre className="text-sm text-gray-600 font-mono whitespace-pre-wrap bg-white p-3 rounded">
                {balanceCalc.calculationProcess}
              </pre>
            </Card>
          )}
          <Table
            rowKey="id"
            columns={consumptionColumns}
            dataSource={consumptionRecords}
            pagination={false}
            size="small"
          />
        </div>
      )
    },
    {
      key: '2',
      label: (
        <span className="flex items-center gap-2">
          <IdcardOutlined />
          身份证明
        </span>
      ),
      children: identification ? (
        <Descriptions column={2} size="small">
          <Descriptions.Item label="证件类型">
            {identification.idType === 'id_card' ? '身份证' : identification.idType === 'passport' ? '护照' : '其他'}
          </Descriptions.Item>
          <Descriptions.Item label="证件号码">{maskIdNumber(identification.idNumber)}</Descriptions.Item>
          <Descriptions.Item label="验证状态">
            <Tag color={identification.verificationStatus === 'verified' ? 'green' : identification.verificationStatus === 'rejected' ? 'red' : 'orange'}>
              {identification.verificationStatus === 'verified' ? '已验证' : identification.verificationStatus === 'rejected' ? '验证失败' : '待验证'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <p className="text-gray-500">暂无身份信息</p>
      )
    },
    {
      key: '3',
      label: (
        <span className="flex items-center gap-2">
          <FileTextOutlined />
          争议备注
          {disputeNotes.length > 0 && <Badge count={disputeNotes.length} size="small" className="ml-2" />}
        </span>
      ),
      children: disputeNotes.length > 0 ? (
        <List
          dataSource={disputeNotes}
          renderItem={note => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar icon={<WarningOutlined />} className="bg-orange-500" />}
                title={
                  <div className="flex items-center gap-2">
                    <span>{note.handler}</span>
                    <span className="text-sm text-gray-500">{note.handleTime}</span>
                    <Tag color={getDisputeStatusColor(note.status)}>{getDisputeStatusText(note.status)}</Tag>
                  </div>
                }
                description={note.content}
              />
            </List.Item>
          )}
        />
      ) : (
        <p className="text-gray-500">暂无争议记录</p>
      )
    },
    {
      key: '4',
      label: (
        <span className="flex items-center gap-2">
          <HistoryOutlined />
          操作历史
        </span>
      ),
      children: operationLogs.length > 0 ? (
        <Timeline>
          {[...operationLogs].reverse().map(log => (
            <Timeline.Item key={log.id}>
              <div className="flex items-center gap-2">
                <Tag color="blue">{getOperationTypeText(log.operationType)}</Tag>
                <span className="font-medium">{log.operator}</span>
                <span className="text-sm text-gray-500">{log.operateTime}</span>
              </div>
              {log.remark && <p className="text-gray-600 mt-1">{log.remark}</p>}
            </Timeline.Item>
          ))}
        </Timeline>
      ) : (
        <p className="text-gray-500">暂无操作记录</p>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
        >
          返回列表
        </Button>
        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/redemption/${id}/edit`)}
          >
            编辑
          </Button>
        </Space>
      </div>

      {processingConclusion && (
        <ProcessingConclusion conclusion={processingConclusion} />
      )}

      <Card title={
        <div className="flex items-center gap-3">
          <CreditCardOutlined className="text-blue-500 text-xl" />
          <span style={{ fontFamily: 'Noto Serif SC, serif' }}>兑付详情</span>
          <Space>
            <Tag color={getStatusColor(redemption.status)}>{getStatusText(redemption.status)}</Tag>
            {redemption.hasDispute && <Tag color="red" icon={<WarningOutlined />}>有争议</Tag>}
            {redemption.isFrozen && <Tag color="orange" icon={<LockOutlined />}>已冻结</Tag>}
          </Space>
        </div>
      }>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="卡号" span={1}>
            <span className="font-mono">{redemption.cardNumber}</span>
          </Descriptions.Item>
          <Descriptions.Item label="持卡人" span={1}>
            {redemption.cardHolderName}
          </Descriptions.Item>
          <Descriptions.Item label="联系电话" span={1}>
            {redemption.phone}
          </Descriptions.Item>
          <Descriptions.Item label="所属批次" span={1}>
            {batch ? (
              <Tooltip title={batch.name}>
                <Tag color="blue">{batch.batchNo}</Tag>
              </Tooltip>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="初始余额" span={1}>
            <span className="font-mono text-lg">¥{formatCurrency(redemption.initialBalance)}</span>
          </Descriptions.Item>
          <Descriptions.Item label="当前余额" span={1}>
            <span className={`font-mono text-lg font-bold ${redemption.currentBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
              ¥{formatCurrency(redemption.currentBalance)}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间" span={1}>
            {redemption.createdAt}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间" span={1}>
            {redemption.updatedAt}
          </Descriptions.Item>
          <Descriptions.Item label="创建人" span={1}>
            {redemption.createdBy}
          </Descriptions.Item>
          <Descriptions.Item label="登记编号" span={1}>
            <span className="font-mono text-gray-500">{redemption.id}</span>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Collapse
        items={collapseItems}
        defaultActiveKey={['1']}
        className="bg-white rounded-lg"
      />
    </div>
  );
};

export default RedemptionDetail;
