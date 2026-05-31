import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Monitor } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import ReasonCard from '../components/foreman/ReasonCard';
import NextStepsList from '../components/foreman/NextStepsList';
import OperationTimeline from '../components/history/OperationTimeline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useWarningStore } from '../store/useWarningStore';
import { exportReport } from '../services/reportExport';
import { saveChartRange, getChartRange } from '../utils/viewState';

export default function ForemanView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { warningDetail, loading, fetchWarningDetail, selectWarning, updateNextStep } =
    useWarningStore();

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
        saveChartRange('foreman', start, end);
      }
    }
  }, [warningDetail]);

  const handleExport = () => {
    if (warningDetail) {
      const chartRange = getChartRange('foreman');
      saveChartRange('foreman', chartRange.start, chartRange.end);
      exportReport(warningDetail, 'csv');
    }
  };

  const handleRefresh = () => {
    if (id) {
      fetchWarningDetail(id);
    }
  };

  const handleToggleStep = (stepId: string, completed: boolean) => {
    if (warningDetail) {
      updateNextStep(warningDetail.id, stepId, completed);
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
          title={`值班长视图 - ${warningDetail.deviceName}`}
          subtitle="清晰展示故障原因和下一步操作建议"
          onRefresh={handleRefresh}
          onExport={handleExport}
        />

        <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
          <div className="mb-4">
            <button
              onClick={() => navigate(`/warning/${warningDetail.id}`)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              返回技术视图
            </button>
          </div>

          <div className="flex items-center justify-end mb-6">
            <div className="flex items-center gap-2">
              <Link
                to={`/warning/${warningDetail.id}`}
                className="px-4 py-2 rounded text-sm transition-colors bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white flex items-center gap-2"
              >
                <Monitor className="w-4 h-4" />
                技术视图
              </Link>
              <button
                onClick={() => {}}
                className="px-4 py-2 rounded text-sm transition-colors bg-blue-600 text-white flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                值班长视图
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <ReasonCard data={warningDetail.foremanData} />

            <NextStepsList
              warningId={warningDetail.id}
              steps={warningDetail.foremanData.nextSteps}
              onToggleStep={handleToggleStep}
            />

            <OperationTimeline logs={warningDetail.operationLogs} />
          </div>
        </main>
      </div>
    </div>
  );
}
