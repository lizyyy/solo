import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Plus,
  FileCheck,
  X,
} from 'lucide-react';
import { useThresholdStore } from '../store/thresholdStore';

const Reports = () => {
  const navigate = useNavigate();
  const { reports, thresholds, getDeviceById, generateReport, currentRole } = useThresholdStore();
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedThreshold, setSelectedThreshold] = useState('');
  const [formData, setFormData] = useState({
    content: '',
    retentionReason: '',
    missingMaterials: '',
    nextAction: '',
    assigneeRole: 'engineer' as 'engineer' | 'coach',
  });

  const thresholdsWithoutReport = thresholds.filter(
    (t) => !reports.some((r) => r.thresholdId === t.id)
  );

  const handleGenerate = () => {
    if (!selectedThreshold) return;

    generateReport(selectedThreshold, {
      ...formData,
      missingMaterials: formData.missingMaterials.split('\n').filter(Boolean),
    });

    setShowGenerator(false);
    setSelectedThreshold('');
    setFormData({
      content: '',
      retentionReason: '',
      missingMaterials: '',
      nextAction: '',
      assigneeRole: 'engineer',
    });
  };

  const ReportCard = ({ report }: { report: typeof reports[0] }) => {
    const threshold = thresholds.find((t) => t.id === report.thresholdId);
    const device = threshold ? getDeviceById(threshold.deviceId) : undefined;

    return (
      <div className="bg-industrial-600 rounded-xl border border-industrial-500 overflow-hidden hover:border-primary-500/50 transition-all">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold text-lg">{threshold?.name}</h3>
              <p className="text-industrial-400 text-sm">{device?.name}</p>
            </div>
            <div className="bg-success-500/20 p-2 rounded-lg">
              <FileCheck className="w-5 h-5 text-success-400" />
            </div>
          </div>

          <p className="text-white mb-4">{report.content}</p>

          <div className="space-y-3">
            <div>
              <p className="text-industrial-400 text-xs mb-1">留存原因</p>
              <p className="text-white text-sm bg-industrial-700/50 rounded-lg p-3">
                {report.retentionReason}
              </p>
            </div>

            {report.missingMaterials.length > 0 && (
              <div>
                <p className="text-industrial-400 text-xs mb-2">缺少材料</p>
                <ul className="space-y-1">
                  {report.missingMaterials.map((m, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-warning-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-3 border-t border-industrial-500">
              <p className="text-industrial-400 text-xs mb-1">下一步行动</p>
              <p className="text-white text-sm">{report.nextAction}</p>
              <p className="text-primary-400 text-xs mt-1">
                对接人：{report.assigneeRole === 'engineer' ? '设备工程师 何工' : '训练教练'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-industrial-700/50 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-industrial-300">
              <User className="w-4 h-4" />
              {report.createdBy}
            </div>
            <div className="flex items-center gap-1.5 text-industrial-400">
              <Clock className="w-4 h-4" />
              {new Date(report.createdAt).toLocaleDateString('zh-CN')}
            </div>
          </div>
          <button
            onClick={() => navigate(`/threshold/${report.thresholdId}`)}
            className="flex items-center gap-1 text-primary-400 hover:text-primary-300 text-sm"
          >
            查看阈值
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">交接报告</h1>
          <p className="text-industrial-300">
            当前角色：<span className="text-primary-400 font-medium">{currentRole === 'engineer' ? '设备工程师 何工' : '训练教练'}</span>
          </p>
        </div>
        {currentRole === 'coach' && (
          <button
            onClick={() => setShowGenerator(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-all shadow-lg shadow-primary-500/30"
          >
            <Plus className="w-5 h-5" />
            生成报告
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-success-500/20 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white font-mono">{reports.length}</p>
              <p className="text-industrial-400">已生成报告</p>
            </div>
          </div>
        </div>
        <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-warning-500/20 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-warning-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white font-mono">{thresholdsWithoutReport.length}</p>
              <p className="text-industrial-400">待生成报告</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>

      {reports.length === 0 && (
        <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-16 text-center">
          <FileText className="w-16 h-16 text-industrial-400 mx-auto mb-4" />
          <p className="text-industrial-300 text-lg">暂无交接报告</p>
          <p className="text-industrial-400 mt-1">训练教练可在审核通过后生成交接报告</p>
        </div>
      )}

      {showGenerator && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-industrial-600 rounded-xl w-full max-w-2xl mx-4 shadow-2xl border border-industrial-500 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-industrial-500">
              <h3 className="text-xl font-semibold text-white">生成交接报告</h3>
              <button
                onClick={() => setShowGenerator(false)}
                className="text-industrial-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-industrial-200 text-sm block mb-2">选择阈值</label>
                <select
                  value={selectedThreshold}
                  onChange={(e) => setSelectedThreshold(e.target.value)}
                  className="w-full bg-industrial-700 border border-industrial-500 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500"
                >
                  <option value="">请选择...</option>
                  {thresholdsWithoutReport.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} - {getDeviceById(t.deviceId)?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-industrial-200 text-sm block mb-2">报告内容</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full bg-industrial-700 border border-industrial-500 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500"
                  rows={3}
                  placeholder="描述阈值设置的整体情况..."
                />
              </div>

              <div>
                <label className="text-industrial-200 text-sm block mb-2">留存原因</label>
                <textarea
                  value={formData.retentionReason}
                  onChange={(e) => setFormData({ ...formData, retentionReason: e.target.value })}
                  className="w-full bg-industrial-700 border border-industrial-500 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500"
                  rows={2}
                  placeholder="说明为什么要保留这条阈值记录..."
                />
              </div>

              <div>
                <label className="text-industrial-200 text-sm block mb-2">缺少材料（每行一项）</label>
                <textarea
                  value={formData.missingMaterials}
                  onChange={(e) => setFormData({ ...formData, missingMaterials: e.target.value })}
                  className="w-full bg-industrial-700 border border-industrial-500 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500"
                  rows={3}
                  placeholder="设备运行周报&#10;环境温度记录表..."
                />
              </div>

              <div>
                <label className="text-industrial-200 text-sm block mb-2">下一步行动</label>
                <textarea
                  value={formData.nextAction}
                  onChange={(e) => setFormData({ ...formData, nextAction: e.target.value })}
                  className="w-full bg-industrial-700 border border-industrial-500 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500"
                  rows={2}
                  placeholder="说明接下来需要做什么..."
                />
              </div>

              <div>
                <label className="text-industrial-200 text-sm block mb-2">对接人</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setFormData({ ...formData, assigneeRole: 'engineer' })}
                    className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                      formData.assigneeRole === 'engineer'
                        ? 'bg-primary-500 text-white'
                        : 'bg-industrial-700 text-industrial-300 hover:bg-industrial-500'
                    }`}
                  >
                    设备工程师 何工
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, assigneeRole: 'coach' })}
                    className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                      formData.assigneeRole === 'coach'
                        ? 'bg-success-500 text-white'
                        : 'bg-industrial-700 text-industrial-300 hover:bg-industrial-500'
                    }`}
                  >
                    训练教练
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-industrial-500 flex gap-3">
              <button
                onClick={() => setShowGenerator(false)}
                className="flex-1 py-3 bg-industrial-700 hover:bg-industrial-500 text-white rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleGenerate}
                disabled={!selectedThreshold}
                className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                生成报告
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
