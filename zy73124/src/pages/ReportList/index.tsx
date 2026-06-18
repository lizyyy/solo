import { useState, useMemo, useEffect } from 'react';
import { Tabs, Button, Space, Card, Statistic, Row, Col } from 'antd';
import {
  FileDown,
  Plus,
  AlertTriangle,
  FileText,
  FlaskConical,
  CheckCircle,
  Clock,
} from 'lucide-react';
import useReportStore from '@/store/useReportStore';
import FilterBar from '@/components/FilterBar';
import ReportTable from '@/components/ReportTable';
import { exportReportListCSV } from '@/utils/csvExport';
import { abnormalTypeLabels } from '@/utils/abnormalDetector';

const { TabPane } = Tabs;

export default function ReportList() {
  const {
    reports,
    abnormals,
    filters,
    setFilters,
    resetFilters,
    initData,
  } = useReportStore();

  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    initData();
  }, [initData]);

  const filteredReports = useMemo(() => {
    const { keyword, seaArea, status, dateRange, onlyAbnormal } = filters;

    return reports.filter((report) => {
      if (keyword && !report.reportNo.toLowerCase().includes(keyword.toLowerCase())) {
        return false;
      }

      if (seaArea && report.seaArea !== seaArea) {
        return false;
      }

      if (status && report.status !== status) {
        return false;
      }

      if (dateRange && dateRange[0] && dateRange[1]) {
        const reportDate = new Date(report.samplingTime).getTime();
        const startDate = new Date(dateRange[0]).getTime();
        const endDate = new Date(dateRange[1]).getTime() + 24 * 60 * 60 * 1000 - 1;
        if (reportDate < startDate || reportDate > endDate) {
          return false;
        }
      }

      if (onlyAbnormal) {
        const hasAbnormal = abnormals.some(
          (a) => a.reportId === report.id && a.status !== 'resolved'
        );
        if (!hasAbnormal) return false;
      }

      return true;
    });
  }, [reports, filters, abnormals]);

  const seaAreas = useMemo(() => {
    return Array.from(new Set(reports.map((r) => r.seaArea)));
  }, [reports]);

  const abnormalMap = useMemo(() => {
    const map: Record<string, number> = {};
    abnormals
      .filter((a) => a.status !== 'resolved')
      .forEach((a) => {
        map[a.reportId] = (map[a.reportId] || 0) + 1;
      });
    return map;
  }, [abnormals]);

  const abnormalDetailMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    abnormals
      .filter((a) => a.status !== 'resolved')
      .forEach((a) => {
        if (!map[a.reportId]) {
          map[a.reportId] = [];
        }
        if (!map[a.reportId].includes(a.abnormalType)) {
          map[a.reportId].push(a.abnormalType);
        }
      });
    return map;
  }, [abnormals]);

  const abnormalCount = useMemo(() => {
    return Object.keys(abnormalMap).length;
  }, [abnormalMap]);

  const stats = useMemo(() => {
    return {
      total: reports.length,
      complete: reports.filter((r) => r.status === 'complete').length,
      partial: reports.filter((r) => r.status === 'partial').length,
      abnormal: reports.filter((r) => r.status === 'abnormal').length,
    };
  }, [reports]);

  const handleExportCSV = () => {
    exportReportListCSV(filteredReports, abnormalMap);
  };

  const displayReports = useMemo(() => {
    if (activeTab === 'abnormal') {
      return filteredReports.filter((r) => abnormalMap[r.id] && abnormalMap[r.id] > 0);
    }
    return filteredReports;
  }, [activeTab, filteredReports, abnormalMap]);

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card className="border-l-4 border-l-blue-500">
            <Statistic
              title={
                <span className="text-slate-500 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  报告总数
                </span>
              }
              value={stats.total}
              suffix="份"
              valueStyle={{ color: '#1e3a5f', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="border-l-4 border-l-green-500">
            <Statistic
              title={
                <span className="text-slate-500 text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  已完成
                </span>
              }
              value={stats.complete}
              suffix="份"
              valueStyle={{ color: '#10b981', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="border-l-4 border-l-blue-400">
            <Statistic
              title={
                <span className="text-slate-500 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  部分完成
                </span>
              }
              value={stats.partial}
              suffix="份"
              valueStyle={{ color: '#3b82f6', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="border-l-4 border-l-orange-500">
            <Statistic
              title={
                <span className="text-slate-500 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  异常报告
                </span>
              }
              value={stats.abnormal}
              suffix="份"
              valueStyle={{ color: '#f59e0b', fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选栏 */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        seaAreas={seaAreas}
        abnormalCount={abnormalCount}
      />

      {/* 主内容区 */}
      <Card
        tabBarExtraContent={
          <Space>
            <Button
              icon={<FileDown className="w-4 h-4" />}
              onClick={handleExportCSV}
              type="primary"
            >
              导出CSV
            </Button>
            <Button icon={<Plus className="w-4 h-4" />} disabled>
              新增报告
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'all',
              label: (
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  全部报告
                  <span className="text-xs text-slate-500">({filteredReports.length})</span>
                </span>
              ),
            },
            {
              key: 'abnormal',
              label: (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  异常专区
                  <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full">
                    {abnormalCount}
                  </span>
                </span>
              ),
            },
          ]}
        />

        <div className="pt-2">
          <ReportTable
            reports={displayReports}
            abnormalMap={abnormalMap}
            abnormalDetailMap={abnormalDetailMap}
          />
        </div>
      </Card>

      {/* CSV说明提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileDown className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <div className="font-medium mb-1">CSV导出说明</div>
            <ul className="list-disc list-inside space-y-0.5 text-blue-600">
              <li>导出的CSV文件与当前屏幕显示的筛选结果完全一致</li>
              <li>场景标注、侧边说明等文案与页面展示口径统一</li>
              <li>数据包含报告编号、采样时间、海区、潮位、采样瓶数量等全部字段</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 异常类型说明 */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-orange-700">
            <div className="font-medium mb-1">异常出口说明</div>
            <ul className="list-disc list-inside space-y-0.5 text-orange-600">
              <li>
                <span className="font-medium">{abnormalTypeLabels.tide_unit_mixed}：</span>
                潮位单位混写，数据中存在多种不同单位
              </li>
              <li>
                <span className="font-medium">{abnormalTypeLabels.time_mismatch}：</span>
                采样时间与报告时间偏差过大
              </li>
              <li>
                <span className="font-medium">{abnormalTypeLabels.result_mismatch}：</span>
                实验结果与预期不符
              </li>
              <li>异常记录不会自动覆盖正常结果，需人工核实处理</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
