import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  History,
  CheckCircle2,
  Clock,
  Ban,
  Save,
  RefreshCw,
  FileText,
  DollarSign,
  Truck,
  Shield,
  AlertTriangle,
  FileBarChart,
  GitCompare,
  Calculator,
} from 'lucide-react';
import { useArtworkStore } from '../store/artworkStore';
import { useUIStore } from '../store/uiStore';
import { StatusBadge, CurrencyBadge, TransportStatusBadge } from '../components/StatusBadge';
import { FormField, Input, Textarea, Select } from '../components/FormFields';
import { TransportTimeline } from '../components/TransportTimeline';
import { GapAlertList } from '../components/GapAlertList';
import { ChangeLogDrawer } from '../components/ChangeLogDrawer';
import { CURRENCY_SYMBOLS } from '../../shared/types';
import type { RecordStatus, Currency, TransportStatus, NodeType } from '../../shared/types';
import {
  valuationApi,
  contractApi,
  transportApi,
  insuranceApi,
  currencyApi,
} from '../services/api';
import { cn } from '../lib/utils';

type TabType = 'info' | 'valuation' | 'contract' | 'transport' | 'insurance' | 'gaps';

const currencyOptions = [
  { value: 'CNY', label: '人民币 (CNY)' },
  { value: 'USD', label: '美元 (USD)' },
  { value: 'EUR', label: '欧元 (EUR)' },
  { value: 'GBP', label: '英镑 (GBP)' },
  { value: 'JPY', label: '日元 (JPY)' },
];

const transportStatusOptions = [
  { value: 'pending', label: '待运输' },
  { value: 'in_transit', label: '运输中' },
  { value: 'arrived', label: '已到达' },
  { value: 'delivered', label: '已签收' },
];

const nodeTypeOptions = [
  { value: 'origin', label: '起运地' },
  { value: 'transit', label: '中转节点' },
  { value: 'destination', label: '目的地' },
];

export default function ArtworkDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { artworkDetail, loading, fetchArtworkDetail, updateArtworkStatus, clearDetail } =
    useArtworkStore();
  const { openChangeLogDrawer, showToast, openConfirmDialog, setLoadingOverlay } = useUIStore();
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [saving, setSaving] = useState(false);
  const [convertResult, setConvertResult] = useState<{ original: number; originalCurrency: Currency; converted: number; targetCurrency: Currency } | null>(null);

  const [valuationForm, setValuationForm] = useState({
    amount: '',
    currency: 'CNY' as Currency,
    valuationDate: '',
    institution: '',
    valuer: '',
    remarks: '',
    convertedCurrency: 'CNY' as Currency,
  });

  const [contractForm, setContractForm] = useState({
    version: '',
    lender: '',
    lenderContact: '',
    startDate: '',
    endDate: '',
    specialTerms: '',
    signedDate: '',
  });

  const [transportForm, setTransportForm] = useState({
    nodeType: 'origin' as NodeType,
    location: '',
    status: 'pending' as TransportStatus,
    handler: '',
    remarks: '',
    timestamp: '',
  });

  const [insuranceForm, setInsuranceForm] = useState({
    policyType: '',
    coverageAmount: '',
    currency: 'CNY' as Currency,
    deductible: '',
    effectiveDate: '',
    expiryDate: '',
    specialClauses: '',
    insurer: '',
    policyNo: '',
  });

  useEffect(() => {
    if (id) {
      fetchArtworkDetail(id);
    }
    return () => {
      clearDetail();
    };
  }, [id, fetchArtworkDetail, clearDetail]);

  useEffect(() => {
    if (artworkDetail) {
      const valuation = artworkDetail.valuations[artworkDetail.valuations.length - 1];
      if (valuation) {
        setValuationForm({
          amount: valuation.amount.toString(),
          currency: valuation.currency,
          valuationDate: valuation.valuationDate,
          institution: valuation.institution,
          valuer: valuation.valuer,
          remarks: valuation.remarks || '',
          convertedCurrency: valuation.convertedCurrency,
        });
      }

      const contract = artworkDetail.contracts.find(c => c.isLatest) || artworkDetail.contracts[artworkDetail.contracts.length - 1];
      if (contract) {
        setContractForm({
          version: contract.version,
          lender: contract.lender,
          lenderContact: contract.lenderContact,
          startDate: contract.startDate,
          endDate: contract.endDate,
          specialTerms: contract.specialTerms || '',
          signedDate: contract.signedDate || '',
        });
      }

      const insurance = artworkDetail.insuranceClauses[artworkDetail.insuranceClauses.length - 1];
      if (insurance) {
        setInsuranceForm({
          policyType: insurance.policyType,
          coverageAmount: insurance.coverageAmount.toString(),
          currency: insurance.currency,
          deductible: insurance.deductible.toString(),
          effectiveDate: insurance.effectiveDate,
          expiryDate: insurance.expiryDate,
          specialClauses: insurance.specialClauses || '',
          insurer: insurance.insurer,
          policyNo: insurance.policyNo || '',
        });
      }
    }
  }, [artworkDetail]);

  const handleCurrencyConvert = async () => {
    if (!valuationForm.amount || !valuationForm.currency) return;
    try {
      const response = await currencyApi.convert(
        parseFloat(valuationForm.amount),
        valuationForm.currency,
        valuationForm.convertedCurrency
      );
      if (response.success && response.data) {
        setConvertResult({
          original: response.data.originalAmount,
          originalCurrency: response.data.originalCurrency,
          converted: response.data.convertedAmount,
          targetCurrency: response.data.targetCurrency,
        });
        showToast('币种换算完成', 'success');
      }
    } catch (err) {
      showToast('换算失败', 'error');
    }
  };

  const handleSaveValuation = async () => {
    if (!artworkDetail) return;
    setSaving(true);
    try {
      const response = await valuationApi.upsert({
        artworkId: artworkDetail.id,
        amount: parseFloat(valuationForm.amount),
        currency: valuationForm.currency,
        valuationDate: valuationForm.valuationDate,
        institution: valuationForm.institution,
        valuer: valuationForm.valuer,
        remarks: valuationForm.remarks,
        convertedCurrency: valuationForm.convertedCurrency,
        operator: '策展助理-李娜',
      });
      if (response.success) {
        showToast('估值信息保存成功', 'success');
        fetchArtworkDetail(artworkDetail.id);
      }
    } catch (err) {
      showToast('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContract = async () => {
    if (!artworkDetail) return;
    setSaving(true);
    try {
      const response = await contractApi.addVersion({
        artworkId: artworkDetail.id,
        ...contractForm,
        operator: '策展助理-李娜',
      });
      if (response.success) {
        showToast('合同版本保存成功', 'success');
        fetchArtworkDetail(artworkDetail.id);
      }
    } catch (err) {
      showToast('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTransport = async () => {
    if (!artworkDetail) return;
    setSaving(true);
    try {
      const response = await transportApi.upsertNode({
        artworkId: artworkDetail.id,
        ...transportForm,
        operator: '策展助理-李娜',
      });
      if (response.success) {
        showToast('运输节点保存成功', 'success');
        fetchArtworkDetail(artworkDetail.id);
      }
    } catch (err) {
      showToast('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInsurance = async () => {
    if (!artworkDetail) return;
    setSaving(true);
    try {
      const response = await insuranceApi.upsert({
        artworkId: artworkDetail.id,
        policyType: insuranceForm.policyType,
        coverageAmount: parseFloat(insuranceForm.coverageAmount),
        currency: insuranceForm.currency,
        deductible: parseFloat(insuranceForm.deductible) || 0,
        effectiveDate: insuranceForm.effectiveDate,
        expiryDate: insuranceForm.expiryDate,
        specialClauses: insuranceForm.specialClauses,
        insurer: insuranceForm.insurer,
        policyNo: insuranceForm.policyNo,
        operator: '策展助理-李娜',
      });
      if (response.success) {
        showToast('保险条款保存成功', 'success');
        fetchArtworkDetail(artworkDetail.id);
      }
    } catch (err) {
      showToast('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (status: RecordStatus, reason: string) => {
    if (!artworkDetail) return;
    openConfirmDialog({
      title: `确认${status === 'processed' ? '标记为已处理' : status === 'pending' ? '标记为待确认' : '退回补材料'}`,
      message: reason,
      confirmText: '确认',
      variant: status === 'rejected' ? 'danger' : status === 'processed' ? 'default' : 'warning',
      onConfirm: async () => {
        const success = await updateArtworkStatus(artworkDetail.id, status, reason);
        if (success) {
          showToast(`状态更新成功`, 'success');
        }
      },
    });
  };

  const handleFieldFix = (field: string) => {
    if (field.includes('valuation')) {
      setActiveTab('valuation');
    } else if (field.includes('contract')) {
      setActiveTab('contract');
    } else if (field.includes('transport')) {
      setActiveTab('transport');
    } else if (field.includes('insurance')) {
      setActiveTab('insurance');
    }
  };

  const tabs = [
    { id: 'info' as TabType, label: '基本信息', icon: FileText, count: 0 },
    { id: 'valuation' as TabType, label: '估值管理', icon: DollarSign, count: artworkDetail?.valuations.length || 0 },
    { id: 'contract' as TabType, label: '借展合同', icon: FileBarChart, count: artworkDetail?.contracts.length || 0 },
    { id: 'transport' as TabType, label: '运输追踪', icon: Truck, count: artworkDetail?.transportNodes.length || 0 },
    { id: 'insurance' as TabType, label: '保险条款', icon: Shield, count: artworkDetail?.insuranceClauses.length || 0 },
    {
      id: 'gaps' as TabType,
      label: '缺口提示',
      icon: AlertTriangle,
      count: artworkDetail?.gapAlerts.filter(g => !g.resolved).length || 0,
    },
  ];

  if (loading && !artworkDetail) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-flex items-center gap-2 text-stone-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  if (!artworkDetail) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-500">作品不存在</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-slate-700 hover:text-slate-900 font-medium"
        >
          返回列表
        </button>
      </div>
    );
  }

  const latestValuation = artworkDetail.valuations[artworkDetail.valuations.length - 1];
  const latestContract = artworkDetail.contracts.find(c => c.isLatest) || artworkDetail.contracts[artworkDetail.contracts.length - 1];
  const latestInsurance = artworkDetail.insuranceClauses[artworkDetail.insuranceClauses.length - 1];
  const errorCount = artworkDetail.gapAlerts.filter(g => !g.resolved && g.severity === 'error').length;
  const warningCount = artworkDetail.gapAlerts.filter(g => !g.resolved && g.severity === 'warning').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-stone-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1
                className="text-2xl font-bold text-stone-900"
                style={{ fontFamily: "'Noto Serif SC', serif" }}
              >
                {artworkDetail.name}
              </h1>
              <StatusBadge status={artworkDetail.status} />
            </div>
            <p className="text-stone-500 mt-1">
              {artworkDetail.artworkNo} · {artworkDetail.artist}
              {artworkDetail.year && ` · ${artworkDetail.year}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(errorCount > 0 || warningCount > 0) && (
            <button
              onClick={() => setActiveTab('gaps')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              {errorCount > 0 && `${errorCount}个错误`}
              {warningCount > 0 && `${warningCount}个警告`}
            </button>
          )}
          <button
            onClick={openChangeLogDrawer}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-stone-600 bg-white border border-stone-300 hover:bg-stone-50 transition-colors shadow-sm"
          >
            <History className="w-4 h-4" />
            变更历史
            {artworkDetail.changeLogs.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-slate-100 rounded-full">
                {artworkDetail.changeLogs.length}
              </span>
            )}
          </button>
          {artworkDetail.status !== 'processed' && (
            <button
              onClick={() => handleStatusChange('processed', '三要素核对无误，保险材料齐全')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              标记已处理
            </button>
          )}
          {artworkDetail.status !== 'pending' && (
            <button
              onClick={() => handleStatusChange('pending', '部分材料待确认')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-sm"
            >
              <Clock className="w-4 h-4" />
              待确认
            </button>
          )}
          {artworkDetail.status !== 'rejected' && (
            <button
              onClick={() => handleStatusChange('rejected', '材料不完整，需要退回补充')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
            >
              <Ban className="w-4 h-4" />
              退回补材料
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="border-b border-stone-200 overflow-x-auto">
          <nav className="flex px-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                  'inline-flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-slate-800 text-slate-800'
                    : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
                )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span
                      className={cn(
                      'px-1.5 py-0.5 text-xs rounded-full',
                      tab.id === 'gaps' && tab.count > 0
                        ? 'bg-red-100 text-red-600'
                        : 'bg-stone-100 text-stone-600'
                    )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">
                  作品信息
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-stone-500">作品编号</label>
                    <p className="font-mono font-medium text-stone-900">{artworkDetail.artworkNo}</p>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500">作品名称</label>
                    <p className="font-medium text-stone-900">{artworkDetail.name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500">艺术家</label>
                    <p className="font-medium text-stone-900">{artworkDetail.artist}</p>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500">年代</label>
                    <p className="font-medium text-stone-900">{artworkDetail.year || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500">材质</label>
                    <p className="font-medium text-stone-900">{artworkDetail.material || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500">尺寸</label>
                    <p className="font-medium text-stone-900">{artworkDetail.size || '-'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">
                  记录信息
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-stone-500">创建时间</label>
                    <p className="font-medium text-stone-900">
                      {new Date(artworkDetail.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500">更新时间</label>
                    <p className="font-medium text-stone-900">
                      {new Date(artworkDetail.updatedAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500">当前状态</label>
                    <p className="mt-1"><StatusBadge status={artworkDetail.status} /></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'valuation' && (
            <div className="space-y-6">
              {latestValuation && (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-stone-700">当前估值</h3>
                    <CurrencyBadge currency={latestValuation.currency} />
                  </div>
                  <p className="text-4xl font-bold text-slate-800 tracking-tight">
                    {CURRENCY_SYMBOLS[latestValuation.currency]}
                    {latestValuation.amount.toLocaleString()}
                  </p>
                  {latestValuation.convertedAmount && (
                    <p className="text-lg text-stone-600 mt-2">
                      ≈ {CURRENCY_SYMBOLS[latestValuation.convertedCurrency]}
                      {latestValuation.convertedAmount.toLocaleString()} {latestValuation.convertedCurrency}
                    </p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200">
                    <div>
                      <label className="text-xs text-stone-500">估值日期</label>
                      <p className="font-medium">{latestValuation.valuationDate}</p>
                    </div>
                    <div>
                      <label className="text-xs text-stone-500">估值机构</label>
                      <p className="font-medium">{latestValuation.institution}</p>
                    </div>
                    <div>
                      <label className="text-xs text-stone-500">估值师</label>
                      <p className="font-medium">{latestValuation.valuer}</p>
                    </div>
                    {latestValuation.remarks && (
                      <div className="col-span-2 md:col-span-1">
                        <label className="text-xs text-stone-500">备注</label>
                        <p className="font-medium">{latestValuation.remarks}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-stone-50 rounded-xl p-5 border border-stone-200">
                <h3 className="text-sm font-bold text-stone-700 mb-4">更新估值信息</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="估值金额" required>
                    <Input
                      type="number"
                      value={valuationForm.amount}
                      onChange={(e) => setValuationForm({ ...valuationForm, amount: e.target.value })}
                      placeholder="请输入估值金额"
                    />
                  </FormField>
                  <FormField label="币种" required>
                    <Select
                      value={valuationForm.currency}
                      onChange={(e) => setValuationForm({ ...valuationForm, currency: e.target.value as Currency })}
                      options={currencyOptions}
                    />
                  </FormField>
                  <FormField label="换算目标币种">
                    <Select
                      value={valuationForm.convertedCurrency}
                      onChange={(e) => setValuationForm({ ...valuationForm, convertedCurrency: e.target.value as Currency })}
                      options={currencyOptions}
                    />
                  </FormField>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={handleCurrencyConvert}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-stone-300 hover:bg-stone-50 transition-colors w-full"
                    >
                      <Calculator className="w-4 h-4" />
                      试算换算
                    </button>
                  </div>
                  {convertResult && (
                    <div className="col-span-full bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        换算结果：{CURRENCY_SYMBOLS[convertResult.originalCurrency]}{convertResult.original.toLocaleString()}
                        {' ≈ '}
                        <span className="font-bold">
                          {CURRENCY_SYMBOLS[convertResult.targetCurrency]}{convertResult.converted.toLocaleString()} {convertResult.targetCurrency}
                        </span>
                      </p>
                    </div>
                  )}
                  <FormField label="估值日期" required>
                    <Input
                      type="date"
                      value={valuationForm.valuationDate}
                      onChange={(e) => setValuationForm({ ...valuationForm, valuationDate: e.target.value })}
                    />
                  </FormField>
                  <FormField label="估值机构" required>
                    <Input
                      value={valuationForm.institution}
                      onChange={(e) => setValuationForm({ ...valuationForm, institution: e.target.value })}
                      placeholder="请输入估值机构"
                    />
                  </FormField>
                  <FormField label="估值师">
                    <Input
                      value={valuationForm.valuer}
                      onChange={(e) => setValuationForm({ ...valuationForm, valuer: e.target.value })}
                      placeholder="请输入估值师"
                    />
                  </FormField>
                  <FormField label="备注">
                    <Input
                      value={valuationForm.remarks}
                      onChange={(e) => setValuationForm({ ...valuationForm, remarks: e.target.value })}
                      placeholder="请输入备注信息"
                    />
                  </FormField>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveValuation}
                    disabled={saving}
                    className={cn(
                    'inline-flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm',
                    saving
                      ? 'bg-stone-400 text-white cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                  )}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? '保存中...' : '保存估值'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contract' && (
            <div className="space-y-6">
              {latestContract && (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-bold text-stone-700">当前合同版本</h3>
                      <span className="px-2 py-0.5 text-xs font-medium bg-slate-800 text-white rounded-full">
                        {latestContract.version}
                      </span>
                      {latestContract.isLatest && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                          最新版本
                        </span>
                      )}
                    </div>
                    {artworkDetail.contracts.length > 1 && (
                      <button
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800"
                      >
                        <GitCompare className="w-3.5 h-3.5" />
                        版本对比
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-stone-500">出借方</label>
                      <p className="font-medium text-stone-900">{latestContract.lender}</p>
                    </div>
                    <div>
                      <label className="text-xs text-stone-500">联系方式</label>
                      <p className="font-medium text-stone-900">{latestContract.lenderContact}</p>
                    </div>
                    <div>
                      <label className="text-xs text-stone-500">出借期限</label>
                      <p className="font-medium text-stone-900">
                        {latestContract.startDate} 至 {latestContract.endDate}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-stone-500">签署日期</label>
                      <p className="font-medium text-stone-900">{latestContract.signedDate || '-'}</p>
                    </div>
                    {latestContract.specialTerms && (
                      <div className="col-span-full">
                        <label className="text-xs text-stone-500">特殊条款</label>
                        <p className="font-medium text-stone-900 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-1">
                          {latestContract.specialTerms}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {artworkDetail.contracts.length > 1 && (
                <div>
                  <h3 className="text-sm font-bold text-stone-700 mb-3">历史版本</h3>
                  <div className="space-y-2">
                    {artworkDetail.contracts
                      .filter(c => !c.isLatest)
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((contract) => (
                        <div
                          key={contract.id}
                          className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200"
                        >
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 text-xs font-medium bg-stone-200 text-stone-700 rounded-full">
                              {contract.version}
                            </span>
                            <span className="text-sm text-stone-600">{contract.lender}</span>
                          </div>
                          <span className="text-xs text-stone-400">
                            {new Date(contract.createdAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="bg-stone-50 rounded-xl p-5 border border-stone-200">
                <h3 className="text-sm font-bold text-stone-700 mb-4">新增合同版本</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="版本号" required>
                    <Input
                      value={contractForm.version}
                      onChange={(e) => setContractForm({ ...contractForm, version: e.target.value })}
                      placeholder="如：v1.0"
                    />
                  </FormField>
                  <FormField label="出借方" required>
                    <Input
                      value={contractForm.lender}
                      onChange={(e) => setContractForm({ ...contractForm, lender: e.target.value })}
                      placeholder="请输入出借方"
                    />
                  </FormField>
                  <FormField label="联系方式" required>
                    <Input
                      value={contractForm.lenderContact}
                      onChange={(e) => setContractForm({ ...contractForm, lenderContact: e.target.value })}
                      placeholder="请输入联系人及电话"
                    />
                  </FormField>
                  <FormField label="签署日期">
                    <Input
                      type="date"
                      value={contractForm.signedDate}
                      onChange={(e) => setContractForm({ ...contractForm, signedDate: e.target.value })}
                    />
                  </FormField>
                  <FormField label="出借开始日期" required>
                    <Input
                      type="date"
                      value={contractForm.startDate}
                      onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                    />
                  </FormField>
                  <FormField label="出借结束日期" required>
                    <Input
                      type="date"
                      value={contractForm.endDate}
                      onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                    />
                  </FormField>
                  <FormField label="特殊条款" className="col-span-full">
                    <Textarea
                      value={contractForm.specialTerms}
                      onChange={(e) => setContractForm({ ...contractForm, specialTerms: e.target.value })}
                      placeholder="请输入特殊条款说明"
                      rows={3}
                    />
                  </FormField>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveContract}
                    disabled={saving}
                    className={cn(
                    'inline-flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm',
                    saving
                      ? 'bg-stone-400 text-white cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                  )}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? '保存中...' : '保存合同版本'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transport' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-stone-700 mb-4">运输追踪</h3>
                <TransportTimeline nodes={artworkDetail.transportNodes} />
              </div>

              <div className="bg-stone-50 rounded-xl p-5 border border-stone-200">
                <h3 className="text-sm font-bold text-stone-700 mb-4">新增/更新运输节点</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="节点类型" required>
                    <Select
                      value={transportForm.nodeType}
                      onChange={(e) => setTransportForm({ ...transportForm, nodeType: e.target.value as NodeType })}
                      options={nodeTypeOptions}
                    />
                  </FormField>
                  <FormField label="状态" required>
                    <Select
                      value={transportForm.status}
                      onChange={(e) => setTransportForm({ ...transportForm, status: e.target.value as TransportStatus })}
                      options={transportStatusOptions}
                    />
                  </FormField>
                  <FormField label="地点" required className="col-span-1 md:col-span-2">
                    <Input
                      value={transportForm.location}
                      onChange={(e) => setTransportForm({ ...transportForm, location: e.target.value })}
                      placeholder="如：北京·故宫博物院"
                    />
                  </FormField>
                  <FormField label="承运方">
                    <Input
                      value={transportForm.handler}
                      onChange={(e) => setTransportForm({ ...transportForm, handler: e.target.value })}
                      placeholder="请输入承运公司"
                    />
                  </FormField>
                  <FormField label="时间戳">
                    <Input
                      type="datetime-local"
                      value={transportForm.timestamp}
                      onChange={(e) => setTransportForm({ ...transportForm, timestamp: e.target.value })}
                    />
                  </FormField>
                  <FormField label="备注" className="col-span-full">
                    <Textarea
                      value={transportForm.remarks}
                      onChange={(e) => setTransportForm({ ...transportForm, remarks: e.target.value })}
                      placeholder="请输入备注信息"
                      rows={2}
                    />
                  </FormField>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveTransport}
                    disabled={saving}
                    className={cn(
                    'inline-flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm',
                    saving
                      ? 'bg-stone-400 text-white cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                  )}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? '保存中...' : '保存运输节点'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'insurance' && (
            <div className="space-y-6">
              {latestInsurance && (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-stone-700">当前保险</h3>
                    <CurrencyBadge currency={latestInsurance.currency} />
                  </div>
                  <div className="mb-4">
                    <p className="text-xs text-stone-500">{latestInsurance.policyType}</p>
                    <p className="text-3xl font-bold text-slate-800 tracking-tight mt-1">
                      {CURRENCY_SYMBOLS[latestInsurance.currency]}
                      {latestInsurance.coverageAmount.toLocaleString()}
                    </p>
                    <p className="text-sm text-stone-600 mt-1">
                      免赔额：{CURRENCY_SYMBOLS[latestInsurance.currency]}{latestInsurance.deductible.toLocaleString()}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
                    <div>
                      <label className="text-xs text-stone-500">保险期限</label>
                      <p className="font-medium">
                        {latestInsurance.effectiveDate} 至 {latestInsurance.expiryDate}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-stone-500">承保机构</label>
                      <p className="font-medium">{latestInsurance.insurer}</p>
                    </div>
                    <div>
                      <label className="text-xs text-stone-500">保单号</label>
                      <p className="font-medium font-mono">{latestInsurance.policyNo || '-'}</p>
                    </div>
                    {latestInsurance.specialClauses && (
                      <div className="col-span-full">
                        <label className="text-xs text-stone-500">特殊条款</label>
                        <p className="font-medium text-stone-900 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-1">
                          {latestInsurance.specialClauses}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-stone-50 rounded-xl p-5 border border-stone-200">
                <h3 className="text-sm font-bold text-stone-700 mb-4">更新保险条款</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="险种" required>
                    <Input
                      value={insuranceForm.policyType}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, policyType: e.target.value })}
                      placeholder="如：艺术品一切险"
                    />
                  </FormField>
                  <FormField label="币种" required>
                    <Select
                      value={insuranceForm.currency}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, currency: e.target.value as Currency })}
                      options={currencyOptions}
                    />
                  </FormField>
                  <FormField label="保额" required>
                    <Input
                      type="number"
                      value={insuranceForm.coverageAmount}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, coverageAmount: e.target.value })}
                      placeholder="请输入保额"
                    />
                  </FormField>
                  <FormField label="免赔额">
                    <Input
                      type="number"
                      value={insuranceForm.deductible}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, deductible: e.target.value })}
                      placeholder="请输入免赔额"
                    />
                  </FormField>
                  <FormField label="生效日期" required>
                    <Input
                      type="date"
                      value={insuranceForm.effectiveDate}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, effectiveDate: e.target.value })}
                    />
                  </FormField>
                  <FormField label="到期日期" required>
                    <Input
                      type="date"
                      value={insuranceForm.expiryDate}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, expiryDate: e.target.value })}
                    />
                  </FormField>
                  <FormField label="承保机构" required>
                    <Input
                      value={insuranceForm.insurer}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, insurer: e.target.value })}
                      placeholder="请输入承保机构"
                    />
                  </FormField>
                  <FormField label="保单号">
                    <Input
                      value={insuranceForm.policyNo}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, policyNo: e.target.value })}
                      placeholder="请输入保单号"
                    />
                  </FormField>
                  <FormField label="特殊条款" className="col-span-full">
                    <Textarea
                      value={insuranceForm.specialClauses}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, specialClauses: e.target.value })}
                      placeholder="请输入特殊条款说明"
                      rows={3}
                    />
                  </FormField>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveInsurance}
                    disabled={saving}
                    className={cn(
                    'inline-flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm',
                    saving
                      ? 'bg-stone-400 text-white cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                  )}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? '保存中...' : '保存保险条款'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gaps' && (
            <div>
              <h3 className="text-sm font-bold text-stone-700 mb-4">数据完整性检查</h3>
              <GapAlertList alerts={artworkDetail.gapAlerts} onFixClick={handleFieldFix} />
            </div>
          )}
        </div>
      </div>

      <ChangeLogDrawer />
    </div>
  );
}
