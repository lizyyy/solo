import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Eye,
  Filter
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { knowledgePoints, errorTypes } from '@/data/mockData';
import { MatrixCell, StatusType } from '@/types';

export default function MatrixPage() {
  const navigate = useNavigate();
  const { matrix, currentPack, analysisResults, isAnalyzing } = useStore();
  const [selectedCell, setSelectedCell] = useState<MatrixCell | null>(null);
  const [hoveredCell, setHoveredCell] = useState<MatrixCell | null>(null);
  const [filterStatus, setFilterStatus] = useState<StatusType | 'all'>('all');

  if (!currentPack) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-medium text-slate-600">暂无数据</h2>
          <p className="text-slate-500 mt-2">请先导入材料包</p>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary mt-6"
          >
            前往导入
          </button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: StatusType) => {
    switch (status) {
      case 'normal': return 'normal';
      case 'pending': return 'pending';
      case 'warning': return 'warning';
    }
  };

  const getStatusLabel = (status: StatusType) => {
    switch (status) {
      case 'normal': return '正常';
      case 'pending': return '待确认';
      case 'warning': return '异常';
    }
  };

  const getCellRecords = (cell: MatrixCell) => {
    return currentPack.records.filter(r => cell.recordIds.includes(r.id));
  };

  const getCellAnalysis = (cell: MatrixCell) => {
    return analysisResults.filter(a => cell.recordIds.includes(a.recordId));
  };

  const stats = {
    total: analysisResults.length,
    normal: analysisResults.filter(a => a.status === 'normal').length,
    pending: analysisResults.filter(a => a.status === 'pending').length,
    warning: analysisResults.filter(a => a.status === 'warning').length,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">矩阵分析</h1>
        <p className="text-slate-500 mt-1">知识点 × 错误类型 二维矩阵分析视图</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="card-body flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
              <Filter className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              <p className="text-sm text-slate-500">总分析数</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-success-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success-600">{stats.normal}</p>
              <p className="text-sm text-slate-500">正常记录</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-pending-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-pending-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-pending-600">{stats.pending}</p>
              <p className="text-sm text-slate-500">待确认</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-warning-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-warning-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-warning-600">{stats.warning}</p>
              <p className="text-sm text-slate-500">异常记录</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filterStatus === 'all'
              ? 'bg-slate-800 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          全部
        </button>
        <button
          onClick={() => setFilterStatus('normal')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filterStatus === 'normal'
              ? 'bg-success-500 text-white'
              : 'bg-success-50 text-success-700 hover:bg-success-100'
          }`}
        >
          正常
        </button>
        <button
          onClick={() => setFilterStatus('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filterStatus === 'pending'
              ? 'bg-pending-500 text-white'
              : 'bg-pending-50 text-pending-700 hover:bg-pending-100'
          }`}
        >
          待确认
        </button>
        <button
          onClick={() => setFilterStatus('warning')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filterStatus === 'warning'
              ? 'bg-warning-500 text-white'
              : 'bg-warning-50 text-warning-700 hover:bg-warning-100'
          }`}
        >
          异常
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-medium">错题矩阵热力图</h3>
        </div>
        <div className="card-body overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="flex">
              <div className="w-32 flex-shrink-0" />
              <div className="flex-1 grid grid-cols-5 gap-2">
                {errorTypes.map(et => (
                  <div key={et} className="text-center text-xs font-medium text-slate-500 py-2">
                    {et}
                  </div>
                ))}
              </div>
            </div>

            {knowledgePoints.map((kp, kpIndex) => (
              <div key={kp} className="flex mt-2">
                <div className="w-32 flex-shrink-0 pr-3 flex items-center">
                  <span className="text-sm text-slate-600 truncate" title={kp}>
                    {kp}
                  </span>
                </div>
                <div className="flex-1 grid grid-cols-5 gap-2">
                  {errorTypes.map((et, etIndex) => {
                    const cell = matrix[kpIndex]?.[etIndex];
                    if (!cell || cell.count === 0) {
                      return (
                        <div
                          key={et}
                          className="matrix-cell h-16 bg-slate-50"
                        >
                          <span className="text-xs text-slate-300">-</span>
                        </div>
                      );
                    }

                    if (filterStatus !== 'all' && cell.status !== filterStatus) {
                      return (
                        <div
                          key={et}
                          className="matrix-cell h-16 bg-slate-100 opacity-30"
                        >
                          <span className="text-xs text-slate-400">{cell.count}</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={et}
                        className={`matrix-cell h-16 matrix-cell-${getStatusColor(cell.status)}`}
                        onClick={() => setSelectedCell(cell)}
                        onMouseEnter={() => setHoveredCell(cell)}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <span className="text-lg font-bold text-slate-700">
                          {cell.count}
                        </span>
                        {cell.status !== 'normal' && (
                          <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                            cell.status === 'pending' ? 'bg-pending-500' : 'bg-warning-500'
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-6 mt-6 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary-500/20" />
              <span className="text-sm text-slate-600">正常</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-pending-500/30" />
              <span className="text-sm text-slate-600">待确认</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-warning-500/30" />
              <span className="text-sm text-slate-600">异常</span>
            </div>
          </div>
        </div>
      </div>

      {hoveredCell && (
        <div className="fixed bottom-8 right-8 card w-72 shadow-xl z-50">
          <div className="card-body">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium">{hoveredCell.knowledgePoint}</span>
              <span className={`badge badge-${getStatusColor(hoveredCell.status)}`}>
                {getStatusLabel(hoveredCell.status)}
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-2">
              错误类型: {hoveredCell.errorType}
            </p>
            <p className="text-sm text-slate-500">
              涉及 {hoveredCell.count} 条记录
            </p>
          </div>
        </div>
      )}

      {selectedCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {selectedCell.knowledgePoint}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedCell.errorType} · {selectedCell.count} 条记录
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCell(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <AlertCircle className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-3">
                {getCellRecords(selectedCell).map(record => {
                  const analysis = getCellAnalysis(selectedCell).find(a => a.recordId === record.id);
                  return (
                    <div
                      key={record.id}
                      className="p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/trace/${record.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-800">{record.studentName}</p>
                            {record.isDuplicate && (
                              <span className="badge badge-duplicate">重复</span>
                            )}
                            {record.source === 'late' && (
                              <span className="badge badge-late">晚到</span>
                            )}
                            {analysis && analysis.status !== 'normal' && (
                              <span className={`badge badge-${getStatusColor(analysis.status)}`}>
                                {getStatusLabel(analysis.status)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                            {record.questionTitle}
                          </p>
                          {analysis && analysis.flags.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {analysis.flags.map((flag, i) => (
                                <p key={i} className="text-xs text-pending-600">
                                  ⚠️ {flag.description}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <Eye className="w-5 h-5 text-slate-400 group-hover:text-primary-500 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-slate-600">正在分析...</p>
          </div>
        </div>
      )}
    </div>
  );
}
