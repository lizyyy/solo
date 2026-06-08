import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileCheck,
  Upload,
  User,
  Calendar,
  FileText,
  Save,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { useClearingStore } from '@/store/useClearingStore';
import { api } from '@/services/api';
import StatusBadge from '@/components/common/StatusBadge';
import AmountDisplay from '@/components/common/AmountDisplay';
import type { CustodyConfirmation } from '@shared/types';

export default function CustodyConfirm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const adjustmentIdFromQuery = searchParams.get('adjustmentId');
  const navigate = useNavigate();
  const {
    getCustodyById,
    getAdjustmentById,
    applyCustodyCreateResult,
    updateCustody,
    currentUser,
    currentRole,
  } = useClearingStore();

  const existingCustody = id ? getCustodyById(id) : undefined;
  const adjustmentId = existingCustody?.adjustmentId || adjustmentIdFromQuery || '';
  const adjustment = getAdjustmentById(adjustmentId);

  const [formData, setFormData] = useState({
    voucherNo: '',
    custodyDate: '',
    amount: '',
    custodian: '上海碳交易所托管部',
    handler: '',
    hasScannedCopy: false,
    supplementaryFields: {} as Record<string, string>,
    extraFieldKey: '',
    extraFieldValue: '',
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (existingCustody) {
      setFormData({
        voucherNo: existingCustody.voucherNo,
        custodyDate: existingCustody.custodyDate,
        amount: existingCustody.amount.toString(),
        custodian: existingCustody.custodian,
        handler: existingCustody.handler,
        hasScannedCopy: existingCustody.hasScannedCopy,
        supplementaryFields: existingCustody.supplementaryFields,
        extraFieldKey: '',
        extraFieldValue: '',
      });
    } else if (adjustment) {
      const date = new Date();
      const voucherNo = `CUST-${adjustment.tradeDate.replace(/-/g, '')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      setFormData((prev) => ({
        ...prev,
        voucherNo,
        custodyDate: adjustment.tradeDate,
        amount: '0',
      }));
    }
  }, [existingCustody, adjustment]);

  if (!adjustment) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-warning-orange mx-auto mb-4" />
          <h2 className="text-xl font-bold text-carbon-800 mb-2">未找到关联记录</h2>
          <p className="text-carbon-500 mb-4">请从调整详情页进入补录托管信息</p>
          <button
            onClick={() => navigate('/adjustments')}
            className="px-4 py-2 bg-carbon-600 text-white rounded-lg hover:bg-carbon-700 transition-colors"
          >
            返回调整列表
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!formData.voucherNo || !formData.custodyDate || !formData.handler) {
      alert('请填写完整的托管信息');
      return;
    }

    setSaving(true);
    try {
      const custodyBase = {
        adjustmentId,
        voucherNo: formData.voucherNo,
        custodyDate: formData.custodyDate,
        amount: parseFloat(formData.amount) || 0,
        custodian: formData.custodian,
        handler: formData.handler,
        hasScannedCopy: formData.hasScannedCopy,
        supplementaryFields: formData.supplementaryFields,
      };

      if (existingCustody) {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const updateData: CustodyConfirmation = {
          ...custodyBase,
          id: existingCustody.id,
          createTime: existingCustody.createTime,
          updateTime: now,
        };
        const savedCustody = await api.updateCustody(updateData);
        updateCustody(savedCustody);
      } else {
        const result = await api.createCustody({
          ...custodyBase,
          operator: currentUser || '小周',
        });
        applyCustodyCreateResult(result);
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const addExtraField = () => {
    if (formData.extraFieldKey && formData.extraFieldValue) {
      setFormData((prev) => ({
        ...prev,
        supplementaryFields: {
          ...prev.supplementaryFields,
          [prev.extraFieldKey]: prev.extraFieldValue,
        },
        extraFieldKey: '',
        extraFieldValue: '',
      }));
    }
  };

  const removeExtraField = (key: string) => {
    setFormData((prev) => {
      const newFields = { ...prev.supplementaryFields };
      delete newFields[key];
      return { ...prev, supplementaryFields: newFields };
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/adjustments/${adjustmentId}`)}
          className="p-2 hover:bg-carbon-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-carbon-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-carbon-800">托管确认页</h1>
          <p className="text-carbon-500 mt-1">
            关联调整单：{adjustment.adjustmentNo}
          </p>
        </div>
        <div className="ml-auto">
          <StatusBadge
            status={adjustment.status}
            amount={adjustment.amount}
            remark={adjustment.remark}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-card overflow-hidden">
            <div className="bg-gradient-to-r from-custody-blue to-custody-blue-hover p-4 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">托管确认凭证</h2>
                  <p className="text-custody-blue-light text-sm">上海碳交易所 · 托管业务专用</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-carbon-700 mb-2">
                    凭证编号 <span className="text-risk-red">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.voucherNo}
                    onChange={(e) => setFormData({ ...formData, voucherNo: e.target.value })}
                    className="w-full px-4 py-2 border border-carbon-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-custody-blue/30 focus:border-custody-blue font-mono"
                    placeholder="CUST-YYYYMMDD-XXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-carbon-700 mb-2">
                    托管日期 <span className="text-risk-red">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-carbon-400" />
                    <input
                      type="date"
                      value={formData.custodyDate}
                      onChange={(e) => setFormData({ ...formData, custodyDate: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-carbon-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-custody-blue/30 focus:border-custody-blue"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-carbon-700 mb-2">
                    托管金额
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-carbon-400 font-mono">¥</span>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full pl-8 pr-4 py-2 border border-carbon-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-custody-blue/30 focus:border-custody-blue font-mono"
                      step="0.01"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-carbon-700 mb-2">
                    托管机构
                  </label>
                  <input
                    type="text"
                    value={formData.custodian}
                    onChange={(e) => setFormData({ ...formData, custodian: e.target.value })}
                    className="w-full px-4 py-2 border border-carbon-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-custody-blue/30 focus:border-custody-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-carbon-700 mb-2">
                  经办人 <span className="text-risk-red">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-carbon-400" />
                  <input
                    type="text"
                    value={formData.handler}
                    onChange={(e) => setFormData({ ...formData, handler: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-carbon-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-custody-blue/30 focus:border-custody-blue"
                    placeholder="请输入经办人姓名"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="hasScannedCopy"
                  checked={formData.hasScannedCopy}
                  onChange={(e) => setFormData({ ...formData, hasScannedCopy: e.target.checked })}
                  className="w-4 h-4 text-custody-blue rounded focus:ring-custody-blue"
                />
                <label htmlFor="hasScannedCopy" className="text-sm text-carbon-700">
                  已上传凭证扫描件
                </label>
                {!formData.hasScannedCopy && (
                  <button className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 text-sm text-custody-blue border border-custody-blue/30 rounded-lg hover:bg-custody-blue-light/30 transition-colors">
                    <Upload className="w-4 h-4" />
                    上传扫描件
                  </button>
                )}
                {formData.hasScannedCopy && (
                  <span className="ml-auto text-sm text-finance-green flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    已上传
                  </span>
                )}
              </div>

              <div className="border-t border-carbon-100 pt-6">
                <h3 className="font-semibold text-carbon-800 mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-custody-blue" />
                  补充信息
                </h3>
                <div className="space-y-3">
                  {Object.entries(formData.supplementaryFields).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-32 text-sm text-carbon-500 flex-shrink-0">{key}</span>
                      <span className="flex-1 text-carbon-800">{value}</span>
                      <button
                        onClick={() => removeExtraField(key)}
                        className="text-carbon-400 hover:text-risk-red transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="text"
                      placeholder="字段名"
                      value={formData.extraFieldKey}
                      onChange={(e) => setFormData({ ...formData, extraFieldKey: e.target.value })}
                      className="w-32 px-3 py-1.5 text-sm border border-carbon-200 rounded focus:outline-none focus:ring-2 focus:ring-custody-blue/30 focus:border-custody-blue"
                    />
                    <input
                      type="text"
                      placeholder="字段值"
                      value={formData.extraFieldValue}
                      onChange={(e) => setFormData({ ...formData, extraFieldValue: e.target.value })}
                      className="flex-1 px-3 py-1.5 text-sm border border-carbon-200 rounded focus:outline-none focus:ring-2 focus:ring-custody-blue/30 focus:border-custody-blue"
                    />
                    <button
                      onClick={addExtraField}
                      disabled={!formData.extraFieldKey || !formData.extraFieldValue}
                      className="px-3 py-1.5 text-sm bg-custody-blue text-white rounded hover:bg-custody-blue-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      添加
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-carbon-50 p-4 border-t border-carbon-100 flex items-center justify-between">
              <div className="text-sm text-carbon-500">
                {existingCustody ? (
                  <span>最后更新：{existingCustody.updateTime}</span>
                ) : (
                  <span>补录完成后将自动提交风控复核</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {saved && (
                  <span className="text-finance-green text-sm flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    保存成功
                  </span>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-custody-blue text-white rounded-lg hover:bg-custody-blue-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      保存托管信息
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-card">
            <h3 className="font-semibold text-carbon-800 mb-4">关联调整单信息</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-carbon-400">调整单号</span>
                <span className="font-mono text-carbon-800">{adjustment.adjustmentNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-carbon-400">交易日期</span>
                <span className="text-carbon-800">{adjustment.tradeDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-carbon-400">调整金额</span>
                <AmountDisplay amount={adjustment.amount} />
              </div>
              <div className="pt-3 border-t border-carbon-100">
                <p className="text-carbon-600">{adjustment.remark}</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/adjustments/${adjustmentId}`)}
              className="w-full mt-4 py-2 border border-carbon-200 text-carbon-600 rounded-lg hover:bg-carbon-50 transition-colors text-sm"
            >
              查看调整详情
            </button>
          </div>

          {adjustment.status === 'pending_review' && (
            <div className="bg-gradient-to-br from-risk-red-light to-warning-orange-light/30 rounded-xl p-6 border border-risk-red/20">
              <h3 className="font-semibold text-carbon-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-risk-red" />
                风控复核提示
              </h3>
              <p className="text-sm text-carbon-600 mb-4">
                托管信息已补录完成，该记录已自动提交风控复核。请提醒风控同事及时处理。
              </p>
              <button
                onClick={() => navigate('/review')}
                className="w-full py-2 bg-risk-red text-white rounded-lg hover:bg-risk-red-hover transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                前往复核工作台
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl p-6 shadow-card">
            <h3 className="font-semibold text-carbon-800 mb-3">📝 填写说明</h3>
            <ul className="space-y-2 text-sm text-carbon-600">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-custody-blue rounded-full mt-1.5 flex-shrink-0" />
                <span>凭证编号由系统自动生成，也可手动修改</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-custody-blue rounded-full mt-1.5 flex-shrink-0" />
                <span>托管日期应与实际交易日期一致</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-finance-green rounded-full mt-1.5 flex-shrink-0" />
                <span>请务必上传凭证扫描件，便于后续审计</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-warning-orange rounded-full mt-1.5 flex-shrink-0" />
                <span>保存后状态将自动变更为"待风控复核"</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
