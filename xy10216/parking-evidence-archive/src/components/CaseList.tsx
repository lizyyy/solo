import React from 'react';
import type { ParkingCase } from '../types';
import { getStatusLabel, getStatusColor, formatCurrency, formatDateTime } from '../utils/helpers';

interface CaseListProps {
  cases: ParkingCase[];
  selectedCase: ParkingCase | null;
  onSelectCase: (caseData: ParkingCase) => void;
  onAddCase: () => void;
}

const CaseList: React.FC<CaseListProps> = ({ cases, selectedCase, onSelectCase, onAddCase }) => {
  const stats = {
    total: cases.length,
    pendingReview: cases.filter(c => c.status === 'pending_review').length,
    paymentPending: cases.filter(c => c.status === 'payment_pending').length,
    completed: cases.filter(c => c.status === 'payment_completed' || c.status === 'exported').length,
  };

  return (
    <div className="w-full md:w-80 lg:w-96 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">逃费证据归档台</h1>
          <button
            onClick={onAddCase}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + 新增案件
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
            <div className="text-xs text-gray-500">总案件数</div>
          </div>
          <div className="p-3 bg-yellow-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-yellow-700">{stats.pendingReview}</div>
            <div className="text-xs text-gray-500">待复核</div>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-orange-700">{stats.paymentPending}</div>
            <div className="text-xs text-gray-500">待补缴</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
            <div className="text-xs text-gray-500">已完成</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="text-5xl mb-4">📁</div>
            <p>暂无案件记录</p>
            <p className="text-sm">点击上方按钮新增案件</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {cases.map(caseData => (
              <div
                key={caseData.id}
                onClick={() => onSelectCase(caseData)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedCase?.id === caseData.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-lg text-gray-800">{caseData.plateNumber}</div>
                    <div className="text-xs text-gray-500">{caseData.id}</div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(caseData.status)}`}>
                    {getStatusLabel(caseData.status)}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs">停车时长</div>
                    <div className="font-medium">{caseData.duration}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">欠费金额</div>
                    <div className="font-medium text-red-600">
                      {formatCurrency(caseData.feeAmount - caseData.paidAmount)}
                    </div>
                  </div>
                </div>
                
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>入场: {formatDateTime(caseData.entryTime)}</span>
                  <span>证据: {caseData.evidences.filter(e => !e.placeholder).length}/{caseData.evidences.length}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseList;
