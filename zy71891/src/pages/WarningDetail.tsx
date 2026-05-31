import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, User, FileText } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import VibrationChart from '../components/warning/VibrationChart';
import ThresholdTable from '../components/warning/ThresholdTable';
import JudgmentCard from '../components/warning/JudgmentCard';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useWarningStore } from '../store/useWarningStore';
import { exportReport } from '../services/reportExport';
import { saveChartRange, getChartRange } from '../utils/viewState';

export default function WarningDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'detail' | 'foreman'>('detail');

  const { warningDetail, loading, fetchWarningDetail, selectWarning } = useWarningStore();

  useEffect(() => {
    if (id) {
      fetchWarningDetail(id);
      selectWarning(id);
    }
    return () => selectWarning(null);
  }, [id, fetchWarningDetail, selectWarning]);

  useEffect(() => {
    if (warningDetail) {
      const vibrationData = warningDetail.vibrationData;
      if (vibrationData.length > 0) {
        const start = vibrationData[0].timestamp;
        const end = vibrationData[vibrationData.length - 1].timestamp;
        saveChartRange('detail', start, end);
      }
    }
  }, [warningDetail]);

  const handleExport = () => {
    if (warningDetail) {
      const chartRange = getChartRange('detail');
      saveChartRange('detail', chartRange.start, chartRange.end);
      exportReport(warningDetail, 'csv');
    }
  };

  const handleRefresh = () => {
    if (id) {
      fetchWarningDetail(id);
    }
  };

  if (loading && !warningDetail) {
    return (
      <div className="flex min-h-screen bg-[#0f1219]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" text="加载中..." />
        </div>
      </div>
    );
  }

  if (!warningDetail) {
    return (
      <div className="flex min-h-screen bg-[#0f1219]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p>未找到预警记录</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              返回列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0f1219]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={`预警详情 - ${warningDetail.deviceName}`}
          subtitle={`设备编号: ${warningDetail.deviceId}`}
          onRefresh={handleRefresh}
          onExport={handleExport}
        />

        <main className="flex-1 p-6">
          <div className="mb-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              返回列表
            </button>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <StatusBadge status={warningDetail.status} />
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <User className="w-4 h-4" />
                <span>创建时间: {new Date(warningDetail.createdAt).toLocaleString('zh-CN')}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('detail')}
                className={`px-4 py-2 rounded text-sm transition-colors ${
                  activeTab === 'detail'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                技术视图
              </button>
              <Link
                to={`/warning/${warningDetail.id}/foreman`}
                className="px-4 py-2 rounded text-sm transition-colors bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                值班长视图
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <JudgmentCard judgment={warningDetail.faultJudgment} />

            <VibrationChart data={warningDetail.vibrationData} threshold={8.0} />

            <ThresholdTable thresholds={warningDetail.thresholds} />
          </div>
        </main>
      </div>
    </div>
  );
}
