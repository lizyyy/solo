import { useState } from 'react';
import { useAppStore } from '@/store';
import { generateCashFlows } from '@/utils/calculationEngine';
import CashFlowTable from '@/components/CashFlowTable';
import { Decimal } from 'decimal.js';
import type { DayCountConvention } from '@/types';

export default function BondManagement() {
  const { bonds, addBond, updateBond, deleteBond, selectBond, selectedBondId } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editingBond, setEditingBond] = useState<string | null>(null);
  const [previewCashFlows, setPreviewCashFlows] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    faceValue: '100',
    couponRate: '2.85',
    couponFrequency: 2 as 1 | 2 | 4 | 12,
    issueDate: '',
    maturityDate: '',
    firstCouponDate: '',
    dayCountConvention: 'ACT/ACT' as DayCountConvention,
    remarks: '',
  });

  const selectedBond = bonds.find((b) => b.id === selectedBondId);
  const previewCF = selectedBond ? generateCashFlows(selectedBond).cashFlows : [];

  const handleSubmit = () => {
    if (editingBond) {
      updateBond(editingBond, {
        ...formData,
        faceValue: new Decimal(formData.faceValue),
        couponRate: new Decimal(formData.couponRate).div(100),
      });
    } else {
      addBond({
        ...formData,
        faceValue: new Decimal(formData.faceValue),
        couponRate: new Decimal(formData.couponRate).div(100),
      });
    }
    setShowForm(false);
    setEditingBond(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      faceValue: '100',
      couponRate: '2.85',
      couponFrequency: 2,
      issueDate: '',
      maturityDate: '',
      firstCouponDate: '',
      dayCountConvention: 'ACT/ACT',
      remarks: '',
    });
  };

  const handleEdit = (bond: typeof bonds[0]) => {
    setFormData({
      name: bond.name,
      code: bond.code,
      faceValue: bond.faceValue.toString(),
      couponRate: new Decimal(bond.couponRate).mul(100).toString(),
      couponFrequency: bond.couponFrequency,
      issueDate: bond.issueDate,
      maturityDate: bond.maturityDate,
      firstCouponDate: bond.firstCouponDate,
      dayCountConvention: bond.dayCountConvention,
      remarks: bond.remarks,
    });
    setEditingBond(bond.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl font-bold text-navy-800">债券管理</h1>
          <p className="mt-1 text-navy-500 text-sm">管理债券基本信息，生成和预览现金流</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingBond(null);
            resetForm();
          }}
          className="btn-primary"
        >
          + 新增债券
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-serif font-semibold text-navy-800">
              {editingBond ? '编辑债券' : '新增债券'}
            </h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-navy-700 text-sm border-b pb-2">基本信息</h4>
                <div>
                  <label className="block text-sm text-navy-600 mb-1">债券名称</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                    placeholder="如：23国债05"
                  />
                </div>
                <div>
                  <label className="block text-sm text-navy-600 mb-1">债券代码</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                    placeholder="如：019325"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-navy-600 mb-1">面值</label>
                    <input
                      type="number"
                      value={formData.faceValue}
                      onChange={(e) => setFormData({ ...formData, faceValue: e.target.value })}
                      className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-navy-600 mb-1">票息率 (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.couponRate}
                      onChange={(e) => setFormData({ ...formData, couponRate: e.target.value })}
                      className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-navy-600 mb-1">付息频率</label>
                  <select
                    value={formData.couponFrequency}
                    onChange={(e) => setFormData({ ...formData, couponFrequency: parseInt(e.target.value) as 1 | 2 | 4 | 12 })}
                    className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                  >
                    <option value={1}>每年付息一次</option>
                    <option value={2}>每半年付息一次</option>
                    <option value={4}>每季度付息一次</option>
                    <option value={12}>每月付息一次</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-navy-700 text-sm border-b pb-2">日期与规则</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-navy-600 mb-1">发行日</label>
                    <input
                      type="date"
                      value={formData.issueDate}
                      onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-navy-600 mb-1">到期日</label>
                    <input
                      type="date"
                      value={formData.maturityDate}
                      onChange={(e) => setFormData({ ...formData, maturityDate: e.target.value })}
                      className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-navy-600 mb-1">首次付息日</label>
                  <input
                    type="date"
                    value={formData.firstCouponDate}
                    onChange={(e) => setFormData({ ...formData, firstCouponDate: e.target.value })}
                    className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-navy-600 mb-1">计息基准</label>
                  <select
                    value={formData.dayCountConvention}
                    onChange={(e) => setFormData({ ...formData, dayCountConvention: e.target.value as 'ACT/ACT' | 'ACT/365' | '30/360' })}
                    className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                  >
                    <option value="ACT/ACT">ACT/ACT</option>
                    <option value="ACT/365">ACT/365</option>
                    <option value="30/360">30/360</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-navy-600 mb-1">备注</label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingBond(null);
                  resetForm();
                }}
                className="btn-secondary"
              >
                取消
              </button>
              <button onClick={handleSubmit} className="btn-primary">
                {editingBond ? '保存修改' : '创建债券'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="font-serif font-semibold text-navy-800">债券列表</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-200 bg-navy-50">
                <th className="text-left py-3 px-4 font-medium text-navy-600">债券名称</th>
                <th className="text-left py-3 px-4 font-medium text-navy-600">代码</th>
                <th className="text-right py-3 px-4 font-medium text-navy-600">票息率</th>
                <th className="text-center py-3 px-4 font-medium text-navy-600">付息频率</th>
                <th className="text-center py-3 px-4 font-medium text-navy-600">到期日</th>
                <th className="text-center py-3 px-4 font-medium text-navy-600">版本</th>
                <th className="text-center py-3 px-4 font-medium text-navy-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {bonds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-navy-400">
                    暂无债券数据，点击上方按钮新增
                  </td>
                </tr>
              ) : (
                bonds.map((bond) => (
                  <tr 
                    key={bond.id} 
                    className={`border-b border-navy-100 clickable-row ${
                      selectedBondId === bond.id ? 'bg-gold-50' : ''
                    }`}
                    onClick={() => selectBond(selectedBondId === bond.id ? null : bond.id)}
                  >
                    <td className="py-3 px-4 font-medium text-navy-700">{bond.name}</td>
                    <td className="py-3 px-4 text-navy-600 font-mono">{bond.code}</td>
                    <td className="py-3 px-4 text-right text-navy-600">
                      {new Decimal(bond.couponRate).mul(100).toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-center text-navy-600">
                      {bond.couponFrequency === 1 ? '年付' : 
                       bond.couponFrequency === 2 ? '半年付' :
                       bond.couponFrequency === 4 ? '季付' : '月付'}
                    </td>
                    <td className="py-3 px-4 text-center text-navy-600">{bond.maturityDate}</td>
                    <td className="py-3 px-4 text-center text-navy-500 text-xs">v{bond.version}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(bond);
                        }}
                        className="text-navy-500 hover:text-navy-700 text-xs mr-2"
                      >
                        编辑
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBond(bond.id);
                        }}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBond && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-serif font-semibold text-navy-800">
              现金流预览 - {selectedBond.name}
            </h3>
            <button
              onClick={() => setPreviewCashFlows(!previewCashFlows)}
              className="text-sm text-navy-500 hover:text-navy-700"
            >
              {previewCashFlows ? '收起' : '展开'}
            </button>
          </div>
          {previewCashFlows && (
            <div className="card-body">
              <div className="mb-4 flex items-center gap-6 text-sm">
                <div>
                  <span className="text-navy-500">期数:</span>
                  <span className="ml-2 font-medium text-navy-700">{previewCF.length} 期</span>
                </div>
                <div>
                  <span className="text-navy-500">异常项:</span>
                  <span className={`ml-2 font-medium ${previewCF.some(cf => cf.isException) ? 'text-red-600' : 'text-green-600'}`}>
                    {previewCF.filter(cf => cf.isException).length} 项
                  </span>
                </div>
              </div>
              <CashFlowTable cashFlows={previewCF} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
