import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Tag, Button, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AlertTriangle, Eye, ArrowLeft } from 'lucide-react';
import useReportStore from '@/store/useReportStore';
import { SeverityTag, AbnormalStatusTag } from '@/components/StatusTags';
import { abnormalTypeLabels } from '@/utils/abnormalDetector';
import { formatDateTime } from '@/utils/storage';
import type { AbnormalRecord } from '@/types';

export default function AbnormalZone() {
  const navigate = useNavigate();
  const { abnormals, reports, initData } = useReportStore();

  useEffect(() => {
    initData();
  }, [initData]);

  const dataSource = useMemo(() => {
    return abnormals.map((abnormal) => {
      const report = reports.find((r) => r.id === abnormal.reportId);
      return {
        ...abnormal,
        reportNo: report?.reportNo || '-',
        seaArea: report?.seaArea || '-',
      };
    });
  }, [abnormals, reports]);

  const pendingCount = useMemo(
    () => abnormals.filter((a) => a.status === 'pending').length,
    [abnormals]
  );

  const columns: ColumnsType<AbnormalRecord & { reportNo: string; seaArea: string }> = [
    {
      title: '异常类型',
      dataIndex: 'abnormalType',
      key: 'abnormalType',
      width: 140,
      render: (type) => (
        <Tag color="orange" className="font-medium">
          {abnormalTypeLabels[type] || type}
        </Tag>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity) => <SeverityTag severity={severity} />,
    },
    {
      title: '处理状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <AbnormalStatusTag status={status} />,
    },
    {
      title: '所属报告',
      dataIndex: 'reportNo',
      key: 'reportNo',
      width: 150,
      render: (text, record) => (
        <button
          onClick={() => navigate(`/report/${record.reportId}`)}
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          {text}
        </button>
      ),
    },
    {
      title: '海区',
      dataIndex: 'seaArea',
      key: 'seaArea',
      width: 100,
    },
    {
      title: '异常描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '发现时间',
      dataIndex: 'detectedAt',
      key: 'detectedAt',
      width: 170,
      render: (time) => formatDateTime(time),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<Eye className="w-4 h-4" />}
          onClick={() => navigate(`/report/${record.reportId}`)}
        >
          查看报告
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* 顶部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/')}
            type="text"
          >
            返回报告列表
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              异常专区
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              集中展示所有异常记录，便于运营主管审核和处理
            </p>
          </div>
        </div>
        <Space>
          <Tag color="red" className="text-base px-3 py-1">
            待处理：{pendingCount} 项
          </Tag>
          <Tag color="blue" className="text-base px-3 py-1">
            总计：{abnormals.length} 项
          </Tag>
        </Space>
      </div>

      {/* 说明卡片 */}
      <Card className="bg-orange-50 border-orange-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-orange-700">
            <div className="font-medium mb-1">异常出口说明</div>
            <p className="text-orange-600 mb-2">
              本专区将所有异常数据从正常报告中单独拎出，避免混入正常结果影响判断。
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/60 rounded p-2">
                <div className="font-medium text-xs mb-1">潮位单位混写</div>
                <div className="text-xs text-orange-600">
                  同一份报告中存在多种潮位单位，需人工核实统一
                </div>
              </div>
              <div className="bg-white/60 rounded p-2">
                <div className="font-medium text-xs mb-1">采样时间不符</div>
                <div className="text-xs text-orange-600">
                  采样瓶采样时间与报告时间偏差超过24小时
                </div>
              </div>
              <div className="bg-white/60 rounded p-2">
                <div className="font-medium text-xs mb-1">实验结果不符</div>
                <div className="text-xs text-orange-600">
                  实验结果与预期范围存在明显差异
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 异常列表 */}
      <Card title="异常记录列表">
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 条异常记录`,
          }}
          scroll={{ x: 1000 }}
          rowClassName={(record) => {
            if (record.status === 'pending') return 'bg-red-50/30';
            if (record.status === 'processing') return 'bg-orange-50/30';
            return '';
          }}
        />
      </Card>
    </div>
  );
}
