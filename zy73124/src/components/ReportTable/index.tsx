import { Table, Badge } from 'antd';
import { useNavigate } from 'react-router-dom';
import { Eye, AlertTriangle } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import type { SeaReport } from '@/types';
import { StatusTag } from '../StatusTags';
import { formatDateTime } from '@/utils/storage';
import { abnormalTypeLabels } from '@/utils/abnormalDetector';

interface ReportTableProps {
  reports: SeaReport[];
  abnormalMap: Record<string, number>;
  abnormalDetailMap: Record<string, string[]>;
  loading?: boolean;
}

export default function ReportTable({
  reports,
  abnormalMap,
  abnormalDetailMap,
  loading,
}: ReportTableProps) {
  const navigate = useNavigate();

  const columns: ColumnsType<SeaReport> = [
    {
      title: '报告编号',
      dataIndex: 'reportNo',
      key: 'reportNo',
      width: 160,
      render: (text: string, record) => (
        <button
          onClick={() => navigate(`/report/${record.id}`)}
          className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
        >
          {text}
        </button>
      ),
    },
    {
      title: '采样时间',
      dataIndex: 'samplingTime',
      key: 'samplingTime',
      width: 170,
      render: (time: string) => formatDateTime(time),
    },
    {
      title: '海区',
      dataIndex: 'seaArea',
      key: 'seaArea',
      width: 100,
    },
    {
      title: '潮位',
      key: 'tide',
      width: 120,
      render: (_, record) => (
        <span className="font-mono">
          {record.tideLevel} {record.tideUnit}
        </span>
      ),
    },
    {
      title: '采样瓶数量',
      dataIndex: 'bottleCount',
      key: 'bottleCount',
      width: 110,
      render: (count: number) => (
        <span className="font-mono">{count} 瓶</span>
      ),
    },
    {
      title: '场景标注',
      dataIndex: 'sceneLabel',
      key: 'sceneLabel',
      width: 120,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: '异常',
      key: 'abnormal',
      width: 180,
      render: (_, record) => {
        const count = abnormalMap[record.id] || 0;
        const details = abnormalDetailMap[record.id] || [];
        if (count === 0) {
          return <span className="text-slate-400 text-sm">无异常</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            <Badge count={count} size="small" offset={[0, 2]}>
              <span className="text-orange-600 text-sm flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                存在异常
              </span>
            </Badge>
            <div className="text-xs text-slate-500">
              {details.slice(0, 2).map((type, idx) => (
                <span key={idx} className="mr-1">
                  {abnormalTypeLabels[type] || type}
                </span>
              ))}
              {details.length > 2 && <span>等{details.length}项</span>}
            </div>
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <button
          onClick={() => navigate(`/report/${record.id}`)}
          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
        >
          <Eye className="w-4 h-4" />
          查看详情
        </button>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={reports}
      rowKey="id"
      loading={loading}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条记录`,
      }}
      scroll={{ x: 1000 }}
      rowClassName={(record) =>
        (abnormalMap[record.id] || 0) > 0 ? 'bg-orange-50/40' : ''
      }
    />
  );
}
