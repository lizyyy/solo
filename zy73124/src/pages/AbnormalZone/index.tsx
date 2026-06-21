import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Tag, Button, Space, Select, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AlertTriangle, Eye, ArrowLeft, FileDown, Filter } from 'lucide-react';
import useReportStore from '@/store/useReportStore';
import { SeverityTag, AbnormalStatusTag } from '@/components/StatusTags';
import { abnormalTypeLabels } from '@/utils/abnormalDetector';
import { formatDateTime } from '@/utils/storage';
import { exportAbnormalRecordsCSV } from '@/utils/csvExport';
import type { AbnormalRecord } from '@/types';
import dayjs from 'dayjs';

export default function AbnormalZone() {
  const navigate = useNavigate();
  const { abnormals, reports, initData } = useReportStore();

  const [filterType, setFilterType] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  useEffect(() => {
    initData();
  }, [initData]);

  const dataSource = useMemo(() => {
    let list = abnormals.map((abnormal) => {
      const report = reports.find((r) => r.id === abnormal.reportId);
      return {
        ...abnormal,
        reportNo: report?.reportNo || '-',
        seaArea: report?.seaArea || '-',
      };
    });

    if (filterType) {
      list = list.filter((a) => a.abnormalType === filterType);
    }
    if (filterSeverity) {
      list = list.filter((a) => a.severity === filterSeverity);
    }
    if (filterStatus) {
      list = list.filter((a) => a.status === filterStatus);
    }
    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf('day').valueOf();
      const end = dateRange[1].endOf('day').valueOf();
      list = list.filter((a) => {
        const t = new Date(a.detectedAt).getTime();
        return t >= start && t <= end;
      });
    }

    return list;
  }, [abnormals, reports, filterType, filterSeverity, filterStatus, dateRange]);

  const pendingCount = useMemo(
    () => abnormals.filter((a) => a.status === 'pending').length,
    [abnormals]
  );

  const handleExport = () => {
    exportAbnormalRecordsCSV(dataSource);
  };

  const handleResetFilters = () => {
    setFilterType('');
    setFilterSeverity('');
    setFilterStatus('');
    setDateRange(null);
  };

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
        <Space wrap>
          <Tag color="red" className="text-base px-3 py-1">
            待处理：{pendingCount} 项
          </Tag>
          <Tag color="blue" className="text-base px-3 py-1">
            总计：{dataSource.length} / {abnormals.length} 项
          </Tag>
          <Button
            type="primary"
            icon={<FileDown className="w-4 h-4" />}
            onClick={handleExport}
          >
            导出CSV
          </Button>
        </Space>
      </div>

      {/* 筛选栏 */}
      <Card size="small" className="bg-slate-50">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-500">筛选：</span>
          <Select
            placeholder="异常类型"
            value={filterType || undefined}
            onChange={setFilterType}
            allowClear
            style={{ width: 140 }}
            options={[
              { value: 'tide_unit_mixed', label: '潮位单位混写' },
              { value: 'time_mismatch', label: '采样时间不符' },
              { value: 'result_mismatch', label: '实验结果不符' },
              { value: 'other', label: '其他异常' },
            ]}
          />
          <Select
            placeholder="严重程度"
            value={filterSeverity || undefined}
            onChange={setFilterSeverity}
            allowClear
            style={{ width: 120 }}
            options={[
              { value: 'high', label: '严重' },
              { value: 'medium', label: '中等' },
              { value: 'low', label: '轻微' },
            ]}
          />
          <Select
            placeholder="处理状态"
            value={filterStatus || undefined}
            onChange={setFilterStatus}
            allowClear
            style={{ width: 120 }}
            options={[
              { value: 'pending', label: '待处理' },
              { value: 'processing', label: '处理中' },
              { value: 'resolved', label: '已解决' },
            ]}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
            placeholder={['开始日期', '结束日期']}
          />
          <Button size="small" onClick={handleResetFilters}>
            重置
          </Button>
          <span className="text-xs text-slate-400 ml-2">
            导出的CSV文件与当前屏幕显示的筛选结果完全一致
          </span>
        </div>
      </Card>

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
