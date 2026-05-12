import React, { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, User, Clock } from 'lucide-react';
import { shiftApi, violationApi } from '../services/api';
import { formatDateTime } from '../utils/format';

interface MatchShiftModalProps {
  violationId: string;
  plateNumber: string;
  onClose: () => void;
}

const MatchShiftModal: React.FC<MatchShiftModalProps> = ({ violationId, plateNumber, onClose }) => {
  const [shifts, setShifts] = useState<any[]>([]);
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    try {
      const response = await shiftApi.getAll();
      setShifts(response.data || []);
    } catch (error) {
      console.error('加载班次失败:', error);
    }
  };

  const handleMatch = async () => {
    if (!selectedShift) {
      alert('请选择要匹配的班次');
      return;
    }
    setLoading(true);
    try {
      await violationApi.matchShift(violationId, selectedShift);
      onClose();
    } catch (error: any) {
      alert(error.message || '匹配失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="bg-yellow-100 p-2 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">匹配班次</h2>
              <p className="text-sm text-gray-500">{plateNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">可匹配的班次：</h3>
          
          {shifts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>暂无班次记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {shifts.map((shift) => (
                <label
                  key={shift.id}
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedShift === shift.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="shift"
                    value={shift.id}
                    checked={selectedShift === shift.id}
                    onChange={() => setSelectedShift(shift.id)}
                    className="mr-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-900">
                        {shift.driverId} {/* 实际项目中需要关联显示司机名 */}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {formatDateTime(shift.startTime)} ~ {formatDateTime(shift.endTime)}
                    </div>
                    {shift.notes && (
                      <div className="mt-1 text-xs text-gray-400">{shift.notes}</div>
                    )}
                  </div>
                  {selectedShift === shift.id && (
                    <Check className="w-5 h-5 text-blue-500 ml-2" />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleMatch}
            disabled={loading || shifts.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            确认匹配
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchShiftModal;
