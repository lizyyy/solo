import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tabs,
  Button,
  Space,
  Tag,
  Descriptions,
  Alert,
  List,
  Modal,
  message,
} from 'antd';
import type { TabsProps } from 'antd';
import {
  ArrowLeft,
  FlaskConical,
  History,
  AlertTriangle,
  FileDown,
  Plus,
  Edit3,
  Info,
} from 'lucide-react';
import useReportStore from '@/store/useReportStore';
import { StatusTag, SeverityTag, AbnormalStatusTag } from '@/components/StatusTags';
import SampleBottleTimeline from '@/components/SampleBottleTimeline';
import ChangeTimeline from '@/components/ChangeTimeline';
import BatchAddModal from '@/components/BatchAddModal';
import { formatDateTime } from '@/utils/storage';
import { abnormalTypeLabels } from '@/utils/abnormalDetector';
import { exportBottlesCSV } from '@/utils/csvExport';

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    reports,
    bottles: allBottles,
    changeLogs: allChangeLogs,
    abnormals: allAbnormals,
    addSampleBottles,
    resolveAbnormal,
    initData,
  } = useReportStore();

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('bottles');

  useEffect(() => {
    initData();
  }, [initData]);

  const report = useMemo(
    () => reports.find((r) => r.id === id),
    [reports, id]
  );

  const bottles = useMemo(() => {
    if (!id) return [];
    return allBottles
      .filter((b) => b.reportId === id)
      .sort((a, b) => {
        if (a.batchNo !== b.batchNo) return a.batchNo.localeCompare(b.batchNo);
        return a.sequence - b.sequence;
      });
  }, [allBottles, id]);

  const changeLogs = useMemo(() => {
    if (!id) return [];
    return allChangeLogs
      .filter((l) => l.reportId === id)
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  }, [allChangeLogs, id]);

  const abnormals = useMemo(() => {
    if (!id) return [];
    return allAbnormals.filter((a) => a.reportId === id);
  }, [allAbnormals, id]);

  const batches = useMemo(() => {
    return Array.from(new Set(bottles.map((b) => b.batchNo))).sort();
  }, [bottles]);

  const unresolvedAbnormals = useMemo(
    () => abnormals.filter((a) => a.status !== 'resolved'),
    [abnormals]
  );

  const handleBatchAdd = (data: {
    bottles: any[];
    reason: string;
    remark: string;
    operator: string;
  }) => {
    if (!id) return;
    addSampleBottles(id, data.bottles, data.reason, data.remark, data.operator);
    setBatchModalOpen(false);
  };

  const handleResolveAbnormal = (abnormalId: string) => {
    resolveAbnormal(abnormalId);
    setResolveModalOpen(null);
    message.success('异常已标记为已解决');
  };

  const handleExportBottles = () => {
    if (report) {
      exportBottlesCSV(bottles, report.reportNo);
    }
  };

  if (!report) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">报告不存在</p>
        <Button className="mt-4" onClick={() => navigate('/')}>
          返回列表
        </Button>
      </div>
    );
  }

  const tabItems: TabsProps['items'] = [
    {
      key: 'bottles',
      label: (
        <span className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4" />
          采样瓶明细
          <span className="text-xs text-slate-500">({bottles.length})</span>
        </span>
      ),
      children: (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-slate-500">
              共 {bottles.length} 个采样瓶，分 {batches.length} 批次录入
            </div>
            <Button
              size="small"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setBatchModalOpen(true)}
            >
              补录
            </Button>
          </div>
          <SampleBottleTimeline bottles={bottles} />
        </div>
      ),
    },
    {
      key: 'abnormal',
      label: (
        <span className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          异常记录
          {unresolvedAbnormals.length > 0 && (
            <span className="bg-orange-100 text-orange-600 text-xs px-1.5 py-0.5 rounded-full">
              {unresolvedAbnormals.length}
            </span>
          )}
        </span>
      ),
      children: (
        <div className="pt-2">
          {abnormals.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无异常记录</p>
            </div>
          ) : (
            <List
              dataSource={abnormals}
              renderItem={(item) => (
                <List.Item
                  key={item.id}
                  actions={[
                    item.status !== 'resolved' && (
                      <Button
                        key="resolve"
                        type="link"
                        size="small"
                        onClick={() => setResolveModalOpen(item.id)}
                      >
                        标记已解决
                      </Button>
                    ),
                  ].filter(Boolean) as React.ReactNode[]}
                >
                  <List.Item.Meta
                    avatar={
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          item.severity === 'high'
                            ? 'bg-red-100 text-red-600'
                            : item.severity === 'medium'
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}
                      >
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    }
                    title={
                      <div className="flex items-center gap-2">
                        <span>{abnormalTypeLabels[item.abnormalType]}</span>
                        <SeverityTag severity={item.severity} />
                        <AbnormalStatusTag status={item.status} />
                      </div>
                    }
                    description={
                      <div className="text-sm">
                        <p className="text-slate-600">{item.description}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          发现时间：{formatDateTime(item.detectedAt)}
                        </p>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      ),
    },
    {
      key: 'history',
      label: (
        <span className="flex items-center gap-2">
          <History className="w-4 h-4" />
          变更历史
          <span className="text-xs text-slate-500">({changeLogs.length})</span>
        </span>
      ),
      children: (
        <div className="pt-2">
          <ChangeTimeline logs={changeLogs} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/')}
          type="text"
        >
          返回报告列表
        </Button>
        <Space>
          <Button icon={<FileDown className="w-4 h-4" />} onClick={handleExportBottles}>
            导出采样瓶CSV
          </Button>
          <Button
            type="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setBatchModalOpen(true)}
          >
            补录采样瓶
          </Button>
        </Space>
      </div>

      {unresolvedAbnormals.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<AlertTriangle className="w-5 h-5" />}
          message={
            <span className="font-medium">
              存在 {unresolvedAbnormals.length} 项待处理异常
            </span>
          }
          description={
            <ul className="list-disc list-inside text-sm">
              {unresolvedAbnormals.slice(0, 3).map((a) => (
                <li key={a.id}>
                  <SeverityTag severity={a.severity} />
                  <span className="ml-2">{abnormalTypeLabels[a.abnormalType]}</span>
                  <span className="text-slate-500 ml-2">- {a.description}</span>
                </li>
              ))}
            </ul>
          }
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4 min-w-0">
          <Card>
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                <FlaskConical className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-slate-800 truncate">
                  {report.reportNo}
                </h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <StatusTag status={report.status} />
                  <Tag color="blue">{report.seaArea}</Tag>
                  <Tag color="purple">{report.sceneLabel}</Tag>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  更新于 {formatDateTime(report.updatedAt)}
                </div>
              </div>
            </div>

            <Descriptions column={{ xs: 1, sm: 2 }} size="default" bordered>
              <Descriptions.Item label="采样时间">
                {formatDateTime(report.samplingTime)}
              </Descriptions.Item>
              <Descriptions.Item label="海区">{report.seaArea}</Descriptions.Item>
              <Descriptions.Item label="潮位">
                <span className="font-mono font-medium">
                  {report.tideLevel} {report.tideUnit}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="采样瓶数量">
                <span className="font-mono">{report.bottleCount} 瓶</span>
              </Descriptions.Item>
              <Descriptions.Item label="批次数量">{batches.length} 批</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDateTime(report.createdAt)}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={tabItems}
              size="large"
            />
          </Card>
        </div>

        <div className="space-y-4 xl:w-80 xl:sticky xl:top-4 xl:h-fit">
          <Card
            title={
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">说明信息</span>
              </div>
            }
            size="small"
            className="bg-slate-50"
          >
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-slate-500 text-xs mb-1">场景标注</div>
                <Tag color="blue">{report.sceneLabel}</Tag>
              </div>

              <div>
                <div className="text-slate-500 text-xs mb-1">侧边说明</div>
                <p className="text-slate-700 leading-relaxed">{report.sideNote}</p>
              </div>

              <div className="flex gap-4 pt-2 border-t border-slate-200">
                <div>
                  <div className="text-slate-500 text-xs">采样瓶</div>
                  <div className="font-mono font-medium text-slate-700">
                    {report.bottleCount} 瓶
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">异常数</div>
                  <div
                    className={`font-mono font-medium ${
                      unresolvedAbnormals.length > 0 ? 'text-orange-600' : 'text-green-600'
                    }`}
                  >
                    {unresolvedAbnormals.length} 项
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <FileDown className="w-3 h-3" />
                  此说明与CSV导出文件中的备注口径一致
                </div>
              </div>
            </div>
          </Card>

          <Card
            title={
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">快捷操作</span>
              </div>
            }
            size="small"
          >
            <div className="space-y-2">
              <Button
                block
                onClick={() => setBatchModalOpen(true)}
                icon={<Plus className="w-4 h-4" />}
              >
                补录采样瓶
              </Button>
              <Button block icon={<FileDown className="w-4 h-4" />} onClick={handleExportBottles}>
                导出本报告明细
              </Button>
            </div>
          </Card>

          <Card
            className="bg-green-50 border-green-200"
            size="small"
            title={<span className="text-green-700 text-sm">如何读懂本页面</span>}
          >
            <ul className="text-xs text-green-700 space-y-1.5 list-disc list-inside">
              <li>左侧为报告主体，包含基础信息和Tab切换</li>
              <li>采样瓶按批次分组，可展开/收起查看详情</li>
              <li>异常记录在「异常记录」Tab，不混入正常数据</li>
              <li>「变更历史」Tab可查看修改记录和改判原因</li>
              <li>右侧说明与导出文件口径一致</li>
            </ul>
          </Card>
        </div>
      </div>

      <BatchAddModal
        open={batchModalOpen}
        onCancel={() => setBatchModalOpen(false)}
        onConfirm={handleBatchAdd}
        reportNo={report.reportNo}
        existingBatches={batches}
        existingBottleCount={bottles.length}
      />

      <Modal
        title="确认处理异常"
        open={!!resolveModalOpen}
        onOk={() => resolveModalOpen && handleResolveAbnormal(resolveModalOpen)}
        onCancel={() => setResolveModalOpen(null)}
        okText="标记已解决"
        cancelText="取消"
      >
        <p className="text-slate-600">确定将此异常标记为已解决吗？</p>
        <p className="text-xs text-slate-400 mt-2">
          标记后异常不会自动删除，仍可在历史记录中查看。
        </p>
      </Modal>
    </div>
  );
}
