import React, { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, User, Clock } from 'lucide-react';
import { Shift, ViolationRecord } from '../types';
import { getShifts, getVehicles, getViolations, matchShift, getDriverName } from '../services/violationService';
import { formatDateTime } from '../utils/format';

interface MatchShiftModalProps {
  violationId: string;
  onClose: () => void;
}

const MatchShiftModal: React.FC<MatchShiftModalProps> = ({ violationId, onClose }) => {
  const [violation, setViolation] = useState<ViolationRecord | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [violationId]);

  const loadData = () => {
    const violations = getViolations();
    const v = violations.find((v) => v.id === violationId);
    setViolation(v || null);

    if (v) {
      const vehicles = getVehicles();
      const vehicle = vehicles.find((veh) => veh.plateNumber === v.plateNumber);
      if (vehicle) {
        const allShifts = getShifts();
        const vehicleShifts = allShifts.filter((s) => s.vehicleId === vehicle.id);
        setShifts(vehicleShifts);
      }
    }
  };

  const handleMatch = () => {
    if (!selectedShift) {
      alert('请选择要匹配的班次');
      return;
    }
    matchShift(violationId, selectedShift, '张三', 'admin');
    onClose();
  };

  if (!violation) return null;

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
              <p className="text-sm text-gray-500">{violation.plateNumber} - {formatDateTime(violation.violationTime)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              违章信息：{violation.location} - {violation.description}
            </p>
          </div>

          <h3 className="text-sm font-medium text-gray-700 mb-3">可匹配的班次：</h3>
          
          {shifts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>该车暂无班次记录</p>
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-900">
                          {getDriverName(shift.driverId)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {shift.notes || '常规班次'}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {formatDateTime(shift.startTime)} ~ {formatDateTime(shift.endTime)}
                    </div>
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
            disabled={shifts.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认匹配
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchShiftModal;
