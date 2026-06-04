import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  User, 
  Clock, 
  AlertTriangle,
  Play
} from 'lucide-react';
import { format } from 'date-fns';
import { useDiagnosisStore } from '../store/useDiagnosisStore';
import { StepProgress } from '../components/StepProgress';
import { TemperatureUnitDetector, formatTemperature } from '../services/temperatureService';
import type { StepInfo, SensorData } from '../types';

export function Review() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { getCurrentTask, addCorrection, rerunDiagnosis, setCurrentTask } = useDiagnosisStore();

  const task = getCurrentTask();
  const [selectedRow, setSelectedRow] = useState<SensorData | null>(null);
  const [newValue, setNewValue] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  const steps: StepInfo[] = [
    { step: 1, title: '数据导入', description: '导入传感器数据', status: 'completed' },
    { step: 2, title: '照片补录', description: '补录工况照片', status: 'completed' },
    { step: 3, title: '生成报告', description: '生成交接报告', status: 'active' },
  ];

  const handleCorrect = () => {
    if (taskId && selectedRow && newValue) {
      addCorrection(taskId, {
        field: 'temperature',
        oldValue: `${selectedRow.temperature}${selectedRow.temperatureUnit === 'K' ? 'K' : '°C'}`,
        newValue: `${newValue}°C`,
        reason: correctionReason || '开尔文转摄氏度，统一单位便于分析',
        correctedBy: '训练教练老唐',
        correctedAt: new Date().toISOString(),
      });
      setSelectedRow(null);
      setNewValue('');
      setCorrectionReason('');
    }
  };

  const handleRerun = () => {
    if (taskId) {
      rerunDiagnosis(taskId);
    }
  };

  const handleNext = () => {
    if (taskId) {
      setCurrentTask(taskId);
      navigate(`/diagnosis/${taskId}/report`);
    }
  };

  const handleBack = () => {
    if (taskId) {
      navigate(`/diagnosis/${taskId}/photos`);
    }
  };

  const needsReviewData = task?.sensorData.filter(d => d.needsReview) || [];

  return (
    <div className="space-y-8">
      <div className="card">
        <StepProgress steps={steps} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-industrial-900 mb-4">
            第三步：训练教练老唐人工复核
          </h2>
          <p className="text-sm text-industrial-500 mb-6">
            传感器编号里的结论不能直接照抄，碰到摄氏度和开尔文混用时别急着归正常，留给训练教练复核
          </p>

          {needsReviewData.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-warning-700">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">待复核数据 ({needsReviewData.length} 条)</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-industrial-50">
                    <th className="table-header">传感器编号</th>
                    <th className="table-header">温度</th>
                    <th className="table-header">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {needsReviewData.map(row => (
                    <tr
                      key={row.id}
                      className={`cursor-pointer hover:bg-industrial-50 ${
                        selectedRow?.id === row.id ? 'bg-warning-50' : ''
                      }`}
                      onClick={() => {
                        setSelectedRow(row);
                        setNewValue(TemperatureUnitDetector.kelvinToCelsius(row.temperature).toString());
                      }}
                    >
                      <td className="table-cell font-mono">{row.sensorNo}</td>
                      <td className="table-cell">
                        <span className="text-warning-700 font-mono">
                          {formatTemperature(row.temperature, row.temperatureUnit)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <button className="text-industrial-600 hover:text-industrial-800 text-sm">
                          修正
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedRow && (
              <div className="border border-industrial-200 rounded-lg p-4 space-y-4">
                <h3 className="font-medium text-industrial-800">
                  修正 {selectedRow.sensorNo}
                </h3>
                <div>
                  <label className="block text-sm text-industrial-600 mb-1">
                    原始值 (K → 建议值 (°C)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-industrial-500">
                      {selectedRow.temperature}K →
                    </span>
                    <input
                      type="number"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="input-field w-24"
                    />
                    <span>°C</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-industrial-600 mb-1">
                    修正原因
                  </label>
                  <input
                    type="text"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="开尔文转摄氏度"
                    className="input-field"
                  />
                </div>
                <button
                  onClick={handleCorrect}
                  className="btn-warning w-full"
                >
                  确认修正
                </button>
              </div>
            )}
          </div>
        ) : (
            <div className="text-center py-8 text-industrial-500">
              <Check className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
              <p>所有数据已复核完成</p>
            </div>
          )}
      </div>

      <div className="space-y-6">
        <div className="card">
          <h3 className="font-semibold text-industrial-900 mb-4">
            修正记录
          </h3>
          {task?.corrections && task.corrections.length > 0 ? (
            <div className="space-y-3">
              {task.corrections.map(correction => (
                <div
                  key={correction.id}
                  className="border-l-4 border-alert-orange bg-orange-50 p-3 rounded"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-industrial-800">
                      {correction.field}
                    </span>
                    <span className="text-sm text-industrial-500">
                      {correction.oldValue} → {correction.newValue}
                    </span>
                  </div>
                  <p className="text-sm text-industrial-600 mt-1">
                    {correction.reason}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-industrial-400">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {correction.correctedBy}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(correction.correctedAt), 'HH:mm')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-industrial-400 text-center py-4">暂无修正记录</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-industrial-900 mb-4">
            重跑诊断
          </h3>
          <p className="text-sm text-industrial-500 mb-4">
            人工修正后重新运行诊断算法
          </p>
          <button
            onClick={handleRerun}
            className="btn-success w-full flex items-center justify-center gap-2"
            disabled={task?.status === 'completed'}
          >
            <Play className="w-4 h-4" />
            {task?.status === 'completed' ? '已重跑完成' : '重跑诊断'}
          </button>
          {task?.status === 'completed' && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-700">
                <Check className="w-5 h-5" />
                <span className="font-medium">诊断完成</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      <div className="flex items-center justify-between">
        <button onClick={handleBack} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          上一步
        </button>
        <button
          onClick={handleNext}
          className="btn-primary flex items-center gap-2"
          disabled={task?.status !== 'completed'}
        >
          查看交接报告
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
