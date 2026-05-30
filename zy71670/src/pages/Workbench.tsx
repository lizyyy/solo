import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { FormInput } from '../components/FormInput';
import { DataCard } from '../components/DataCard';
import { ErrorBadge } from '../components/ErrorBadge';
import { JudgmentTimeline } from '../components/JudgmentTimeline';
import { STRING_SPECS, PITCH_FREQUENCIES, formatDate } from '../utils/tension';
import { InstrumentType, INSTRUMENT_TYPE_LABELS } from '../types';
import { Plus, RefreshCw, User, Music, FileText, AlertTriangle } from 'lucide-react';

const stringNumberOptions = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `第 ${i + 1} 弦`,
}));

const stringSpecOptions = Object.keys(STRING_SPECS).map((gauge) => ({
  value: gauge,
  label: gauge,
}));

const pitchOptions = Object.keys(PITCH_FREQUENCIES).filter((p) => {
  const octave = parseInt(p.slice(-1));
  return octave >= 1 && octave <= 5;
}).map((pitch) => ({
  value: pitch,
  label: pitch,
}));

const unitOptions = [
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
  { value: 'inch', label: 'inch' },
];

const instrumentTypeOptions = (Object.keys(INSTRUMENT_TYPE_LABELS) as InstrumentType[]).map(
  (type) => ({
    value: type,
    label: INSTRUMENT_TYPE_LABELS[type],
  })
);

export const Workbench: React.FC = () => {
  const {
    records,
    customers,
    instruments,
    currentRecordId,
    addRecord,
    updateRecord,
    setCurrentRecord,
    recalculateRecord,
    addCustomer,
    addInstrument,
    addErrorTag,
    resolveErrorTag,
  } = useStore();

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    instrumentType: 'guitar' as InstrumentType,
    instrumentBrand: '',
    instrumentModel: '',
    stringNumber: '1',
    stringSpec: '0.010',
    pitch: 'E2',
    stringLength: '650',
    lengthUnit: 'mm' as 'mm' | 'cm' | 'inch',
    notes: '',
  });

  const [highlightData, setHighlightData] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  const currentRecord = records.find((r) => r.id === currentRecordId);

  const handleCreateNew = () => {
    setCurrentRecord(null);
    setFormData({
      customerName: '',
      customerPhone: '',
      instrumentType: 'guitar',
      instrumentBrand: '',
      instrumentModel: '',
      stringNumber: '1',
      stringSpec: '0.010',
      pitch: 'E2',
      stringLength: '650',
      lengthUnit: 'mm',
      notes: '',
    });
  };

  const handleCalculate = useCallback(() => {
    if (!formData.customerName || !formData.instrumentBrand) {
      alert('请填写客户名称和乐器品牌');
      return;
    }

    let customer = customers.find(
      (c) => c.name === formData.customerName && c.phone === formData.customerPhone
    );
    if (!customer) {
      const newCustomer = {
        name: formData.customerName,
        phone: formData.customerPhone,
        notes: '',
      };
      addCustomer(newCustomer);
      customer = customers[customers.length - 1];
    }

    let instrument = instruments.find(
      (i) =>
        i.customerId === customer?.id &&
        i.brand === formData.instrumentBrand &&
        i.model === formData.instrumentModel
    );
    if (!instrument) {
      const newInstrument = {
        customerId: customer.id,
        type: formData.instrumentType,
        brand: formData.instrumentBrand,
        model: formData.instrumentModel,
        serialNumber: '',
        stringCount: 6,
      };
      addInstrument(newInstrument);
      instrument = instruments[instruments.length - 1];
    }

    if (!currentRecordId) {
      addRecord({
        instrumentId: instrument.id,
        stringNumber: parseInt(formData.stringNumber),
        stringSpec: formData.stringSpec,
        pitch: formData.pitch,
        stringLength: parseFloat(formData.stringLength) || 0,
        lengthUnit: formData.lengthUnit,
        original: {
          tension: 0,
          riskLevel: 1,
          conclusion: '待计算',
          updatedAt: new Date().toISOString(),
        },
        final: {
          tension: 0,
          riskLevel: 1,
          conclusion: '待计算',
          updatedAt: new Date().toISOString(),
        },
        errorTags: [],
        details: [],
        notes: formData.notes,
      });
    } else {
      updateRecord(currentRecordId, {
        stringNumber: parseInt(formData.stringNumber),
        stringSpec: formData.stringSpec,
        pitch: formData.pitch,
        stringLength: parseFloat(formData.stringLength) || 0,
        lengthUnit: formData.lengthUnit,
        notes: formData.notes,
        errorTags: [],
      });
    }
  }, [formData, currentRecordId, customers, instruments, addCustomer, addInstrument, addRecord, updateRecord]);

  useEffect(() => {
    if (currentRecordId) {
      setTimeout(() => {
        recalculateRecord(currentRecordId);
        setHighlightData(true);
        setTimeout(() => setHighlightData(false), 1000);
      }, 100);
    }
  }, [currentRecordId, recalculateRecord]);

  const handleRecalculate = () => {
    if (currentRecordId) {
      updateRecord(currentRecordId, { errorTags: [], details: [] });
      setTimeout(() => {
        recalculateRecord(currentRecordId);
        setHighlightData(true);
        setTimeout(() => setHighlightData(false), 1000);
      }, 100);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-primary-800 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Music size={28} />
            <div>
              <h1 className="font-serif text-xl font-semibold">弦乐张力断弦预警</h1>
              <p className="text-xs text-primary-200">专业琴弦张力分析与风险评估系统</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleCreateNew} className="btn-primary bg-primary-600 hover:bg-primary-500 flex items-center gap-2">
              <Plus size={16} />
              新建记录
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Parameters */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <User size={18} />
              参数设置
            </h2>
          </div>

          <div className="p-4 flex-1">
            {/* Customer Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">客户信息</h3>
                <button
                  onClick={() => setShowCustomerForm(!showCustomerForm)}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  {showCustomerForm ? '收起' : '展开'}
                </button>
              </div>
              
              {showCustomerForm && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg animate-slide-down">
                  <FormInput
                    label="客户名称"
                    value={formData.customerName}
                    onChange={(v) => setFormData({ ...formData, customerName: v })}
                    placeholder="请输入客户姓名"
                  />
                  <FormInput
                    label="联系电话"
                    value={formData.customerPhone}
                    onChange={(v) => setFormData({ ...formData, customerPhone: v })}
                    placeholder="可选"
                  />
                  <FormInput
                    label="乐器类型"
                    value={formData.instrumentType}
                    onChange={(v) => setFormData({ ...formData, instrumentType: v as InstrumentType })}
                    options={instrumentTypeOptions}
                  />
                  <FormInput
                    label="品牌"
                    value={formData.instrumentBrand}
                    onChange={(v) => setFormData({ ...formData, instrumentBrand: v })}
                    placeholder="如：Fender"
                  />
                  <FormInput
                    label="型号"
                    value={formData.instrumentModel}
                    onChange={(v) => setFormData({ ...formData, instrumentModel: v })}
                    placeholder="可选"
                  />
                </div>
              )}
            </div>

            {/* String Parameters */}
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-gray-700 mb-3">琴弦参数</h3>
              
              <FormInput
                label="弦号"
                value={formData.stringNumber}
                onChange={(v) => setFormData({ ...formData, stringNumber: v })}
                options={stringNumberOptions}
              />

              <FormInput
                label="琴弦规格 (inch)"
                value={formData.stringSpec}
                onChange={(v) => setFormData({ ...formData, stringSpec: v })}
                options={stringSpecOptions}
              />

              <FormInput
                label="目标音高"
                value={formData.pitch}
                onChange={(v) => setFormData({ ...formData, pitch: v })}
                options={pitchOptions}
              />

              <div className="flex gap-2">
                <div className="flex-1">
                  <FormInput
                    label="弦长"
                    value={formData.stringLength}
                    onChange={(v) => setFormData({ ...formData, stringLength: v })}
                    type="number"
                  />
                </div>
                <div className="w-20">
                  <label className="label-base">&nbsp;</label>
                  <select
                    value={formData.lengthUnit}
                    onChange={(e) => setFormData({ ...formData, lengthUnit: e.target.value as 'mm' | 'cm' | 'inch' })}
                    className="input-base"
                  >
                    {unitOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="label-base">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="可添加备注后重新计算"
                  className="input-base h-20 resize-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 mt-6">
              <button
                onClick={handleCalculate}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                {currentRecordId ? '更新并计算' : '创建并计算'}
              </button>
              
              {currentRecordId && (
                <button
                  onClick={handleRecalculate}
                  className="w-full btn-secondary flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} />
                  重新计算
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Middle Panel - Calculation View */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Calculation Display */}
          <div className="flex-1 overflow-y-auto p-6">
            {currentRecord ? (
              <div className="space-y-6">
                {/* Formula Display */}
                <div className="card-base">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FileText size={18} />
                    张力计算公式
                  </h3>
                  <div className="bg-primary-50 rounded-lg p-4 text-center">
                    <p className="font-mono text-lg text-primary-800">
                      T = (f² × 4 × L² × μ) / 9.8
                    </p>
                    <p className="text-xs text-primary-600 mt-2">
                      f: 频率 (Hz), L: 弦长 (m), μ: 线密度 (kg/m)
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-gray-500">频率 f</p>
                      <p className="font-mono font-semibold text-gray-800">
                        {PITCH_FREQUENCIES[formData.pitch]?.toFixed(2) || '-'} Hz
                      </p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-gray-500">弦长 L</p>
                      <p className="font-mono font-semibold text-gray-800">
                        {(parseFloat(formData.stringLength) / 1000).toFixed(4)} m
                      </p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-gray-500">线密度 μ</p>
                      <p className="font-mono font-semibold text-gray-800">
                        {STRING_SPECS[formData.stringSpec]?.linearDensity.toFixed(6) || '-'} kg/m
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error Tags */}
                {currentRecord.errorTags.length > 0 && (
                  <div className="card-base border-danger-200 bg-danger-50">
                    <h3 className="font-semibold text-danger-800 mb-3 flex items-center gap-2">
                      <AlertTriangle size={18} />
                      检测到 {currentRecord.errorTags.length} 个问题
                    </h3>
                    <div className="space-y-2">
                      {currentRecord.errorTags.map((tag) => (
                        <ErrorBadge
                          key={tag.id}
                          tag={tag}
                          onResolve={() => resolveErrorTag(currentRecord.id, tag.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Record Info */}
                <div className="card-base">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800">记录信息</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        第 {currentRecord.stringNumber} 弦 · {formData.instrumentBrand} {formData.instrumentModel}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      <p>创建: {formatDate(currentRecord.createdAt)}</p>
                      <p>更新: {formatDate(currentRecord.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Music size={64} className="mx-auto mb-4 opacity-30" />
                  <p>请填写参数后点击"创建并计算"</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Panel - Judgment Details */}
          <div className="h-72 border-t border-gray-200 bg-white overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">判断明细</h3>
              <span className="text-xs text-gray-500">
                {currentRecord?.details.length || 0} 条记录
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {currentRecord ? (
                <JudgmentTimeline details={currentRecord.details} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  暂无明细数据
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Data Layers */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">数据分层</h2>
          </div>

          <div className="p-4 space-y-4">
            {currentRecord ? (
              <>
                <DataCard
                  type="original"
                  data={currentRecord.original}
                  highlight={highlightData}
                />
                
                {currentRecord.corrected && (
                  <DataCard
                    type="corrected"
                    data={currentRecord.corrected}
                    highlight={highlightData}
                  />
                )}

                <DataCard
                  type="final"
                  data={currentRecord.final}
                  highlight={highlightData}
                />

                {/* Risk Bar */}
                <div className="card-base">
                  <h4 className="font-medium text-gray-700 mb-3">风险分布</h4>
                  <div className="h-3 rounded-full overflow-hidden flex">
                    <div className="bg-success-400 flex-1" style={{ flex: 2 }} />
                    <div className="bg-success-500 flex-1" style={{ flex: 2 }} />
                    <div className="bg-warning-400 flex-1" style={{ flex: 1.5 }} />
                    <div className="bg-warning-500 flex-1" style={{ flex: 1 }} />
                    <div className="bg-danger-500 flex-1" style={{ flex: 0.5 }} />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-500">
                    <span>极低</span>
                    <span>低</span>
                    <span>中</span>
                    <span>高</span>
                    <span>极高</span>
                  </div>
                  
                  {/* Current Position Indicator */}
                  <div className="relative mt-4">
                    <div
                      className="absolute w-3 h-3 bg-primary-800 rounded-full border-2 border-white shadow transform -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${Math.min(100, ((currentRecord.final.riskLevel - 1) / 4) * 100)}%`,
                        top: '50%',
                      }}
                    />
                    <div className="h-1 bg-gray-200 rounded" />
                  </div>
                  <p className="text-center text-xs text-gray-600 mt-2">
                    当前风险等级位置
                  </p>
                </div>

                {/* Notes Display */}
                {currentRecord.notes && (
                  <div className="card-base bg-amber-50 border-amber-200">
                    <h4 className="font-medium text-amber-800 mb-2">备注</h4>
                    <p className="text-sm text-amber-700">{currentRecord.notes}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p className="text-sm">暂无数据</p>
                <p className="text-xs mt-1">创建记录后显示计算结果</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
