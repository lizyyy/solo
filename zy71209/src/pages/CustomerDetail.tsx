import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Clock, FileText, Phone, Mail, MessageSquare, CheckCircle, XCircle } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Container } from '../components/layout/Container';
import { CustomerInfoCard } from '../components/cards/CustomerInfoCard';
import { CalculationCard } from '../components/cards/CalculationCard';
import { EventTimeline } from '../components/timeline/EventTimeline';
import { StatusBadge } from '../components/common/StatusBadge';
import { SpecialFlagsList } from '../components/common/SpecialFlagBadge';
import { ProgressBar } from '../components/common/ProgressBar';
import { SupplementForm } from '../components/forms/SupplementForm';
import { ExtensionForm } from '../components/forms/ExtensionForm';
import { DisposalForm } from '../components/forms/DisposalForm';
import { ImportWizard } from '../components/import/ImportWizard';
import { useAppStore } from '../store/useAppStore';
import { formatCurrencyFull } from '../utils/calculator';
import type { SupplementRecord, ExtensionRecord } from '../types';

export default function CustomerDetail() {
  const { pledgeId } = useParams<{ pledgeId: string }>();
  const navigate = useNavigate();

  const {
    init,
    pledges,
    calculatePledge,
    getPledgeCustomer,
    getTimelineEvents,
    supplements,
    extensions,
    disposals,
    updateSupplementStatus,
    updateExtensionStatus,
    sendMarginCall,
  } = useAppStore();

  const [showSupplementForm, setShowSupplementForm] = useState(false);
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [showDisposalForm, setShowDisposalForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [notificationResult, setNotificationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  const pledge = pledges.find((p) => p.id === pledgeId);
  const customer = pledgeId ? getPledgeCustomer(pledgeId) : undefined;
  const calculation = pledgeId ? calculatePledge(pledgeId) : null;
  const timelineEvents = pledgeId ? getTimelineEvents(pledgeId) : [];

  const pledgeSupplements = supplements.filter((s) => s.pledgeId === pledgeId);
  const pledgeExtensions = extensions.filter((e) => e.pledgeId === pledgeId);
  const pledgeDisposals = disposals.filter((d) => d.pledgeId === pledgeId);

  if (!pledge || !customer || !calculation) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header activePage="warning" onImportClick={() => setShowImport(true)} />
        <Container>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">找不到对应的质押记录</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#1e3a5f]/90 transition-colors"
            >
              返回预警名单
            </button>
          </div>
        </Container>
      </div>
    );
  }

  const handleSendNotification = (method: 'sms' | 'email' | 'phone') => {
    if (!pledgeId) return;
    const result = sendMarginCall(pledgeId, method);
    setNotificationResult({
      success: result.success,
      message: result.message || '',
    });
    setTimeout(() => setNotificationResult(null), 3000);
  };

  const handleSupplementStatusUpdate = (supplementId: string, status: SupplementRecord['status']) => {
    updateSupplementStatus(supplementId, status);
  };

  const handleExtensionStatusUpdate = (extensionId: string, status: ExtensionRecord['status']) => {
    updateExtensionStatus(extensionId, status);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header activePage="warning" onImportClick={() => setShowImport(true)} />

      <Container>
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-[#1e3a5f] hover:underline mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            返回预警名单
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                {customer.customerName} - {pledge.stockName}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-gray-600">账户：{customer.accountNo}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">股票代码：{pledge.stockCode}</span>
                <StatusBadge status={pledge.status} />
                <SpecialFlagsList flags={pledge.specialFlags} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSendNotification('sms')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="发送短信通知"
              >
                <MessageSquare className="w-4 h-4" />
                短信
              </button>
              <button
                onClick={() => handleSendNotification('email')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="发送邮件通知"
              >
                <Mail className="w-4 h-4" />
                邮件
              </button>
              <button
                onClick={() => handleSendNotification('phone')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="电话通知"
              >
                <Phone className="w-4 h-4" />
                电话
              </button>
            </div>
          </div>
        </div>

        {notificationResult && (
          <div
            className={`mb-4 p-3 rounded-lg border ${
              notificationResult.success
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}
          >
            {notificationResult.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">质押率监控</h2>
              <ProgressBar
                value={calculation.pledgeRatio}
                warningThreshold={calculation.effectiveWarningLine}
                dangerThreshold={pledge.closeLine}
              />
              <div className="grid grid-cols-4 gap-4 mt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    {calculation.pledgeRatio.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">当前质押率</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    {calculation.effectiveWarningLine.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">警戒线</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    {pledge.closeLine.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">平仓线</div>
                </div>
                <div className="text-center">
                  <div
                    className={`text-2xl font-bold ${
                      calculation.warningBuffer < 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  >
                    {calculation.warningBuffer >= 0 ? '+' : ''}
                    {calculation.warningBuffer.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">距警戒线</div>
                </div>
              </div>
            </div>

            <CalculationCard calculation={calculation} />

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">快捷操作</h2>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => setShowSupplementForm(true)}
                  className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <span className="font-medium text-gray-900 group-hover:text-green-600">登记补仓</span>
                  <span className="text-xs text-gray-500">记录客户补仓信息</span>
                </button>

                <button
                  onClick={() => setShowExtensionForm(true)}
                  className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                  <span className="font-medium text-gray-900 group-hover:text-purple-600">申请展期</span>
                  <span className="text-xs text-gray-500">延长合约到期时间</span>
                </button>

                <button
                  onClick={() => setShowDisposalForm(true)}
                  className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                    <FileText className="w-6 h-6 text-red-600" />
                  </div>
                  <span className="font-medium text-gray-900 group-hover:text-red-600">处置报告</span>
                  <span className="text-xs text-gray-500">提交平仓处置方案</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">补仓记录</h2>
              {pledgeSupplements.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暂无补仓记录</p>
              ) : (
                <div className="space-y-3">
                  {pledgeSupplements.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            s.status === 'received'
                              ? 'bg-green-100'
                              : s.status === 'cancelled'
                              ? 'bg-gray-100'
                              : 'bg-orange-100'
                          }`}
                        >
                          <DollarSign
                            className={`w-5 h-5 ${
                              s.status === 'received'
                                ? 'text-green-600'
                                : s.status === 'cancelled'
                                ? 'text-gray-600'
                                : 'text-orange-600'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            ¥{formatCurrencyFull(s.amount)}
                          </div>
                          <div className="text-xs text-gray-500">
                            预计到账：{s.expectedDate}
                            {s.actualDate && ` · 实际到账：${s.actualDate}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={s.status} type="supplement" />
                        {s.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleSupplementStatusUpdate(s.id, 'received')}
                              className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                              title="标记为已到账"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSupplementStatusUpdate(s.id, 'cancelled')}
                              className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors"
                              title="取消补仓"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">展期记录</h2>
              {pledgeExtensions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暂无展期记录</p>
              ) : (
                <div className="space-y-3">
                  {pledgeExtensions.map((e) => (
                    <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            e.status === 'approved'
                              ? 'bg-green-100'
                              : e.status === 'rejected'
                              ? 'bg-red-100'
                              : 'bg-purple-100'
                          }`}
                        >
                          <Clock
                            className={`w-5 h-5 ${
                              e.status === 'approved'
                                ? 'text-green-600'
                                : e.status === 'rejected'
                                ? 'text-red-600'
                                : 'text-purple-600'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            展期至 {e.newEndDate}
                          </div>
                          <div className="text-xs text-gray-500">
                            新警戒线：{e.newWarningLine.toFixed(2)}% · 申请日期：{e.applyDate}
                            {e.approveDate && ` · 审批日期：${e.approveDate}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={e.status} type="extension" />
                        {e.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleExtensionStatusUpdate(e.id, 'approved')}
                              className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                              title="通过展期"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleExtensionStatusUpdate(e.id, 'rejected')}
                              className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors"
                              title="拒绝展期"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">处置报告</h2>
              {pledgeDisposals.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暂无处置报告</p>
              ) : (
                <div className="space-y-3">
                  {pledgeDisposals.map((d) => (
                    <div key={d.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-red-600" />
                          <span className="text-sm text-gray-500">{d.reportDate}</span>
                        </div>
                        <StatusBadge status={d.status} type="disposal" />
                      </div>
                      <p className="text-sm text-gray-700">{d.reportContent}</p>
                      <p className="text-xs text-gray-500 mt-2">操作人：{d.operator}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <CustomerInfoCard customer={customer} pledge={pledge} calculation={calculation} />
            <EventTimeline events={timelineEvents} />
          </div>
        </div>
      </Container>

      {showSupplementForm && pledgeId && (
        <SupplementForm
          pledgeId={pledgeId}
          onClose={() => setShowSupplementForm(false)}
          onSuccess={() => setShowSupplementForm(false)}
        />
      )}

      {showExtensionForm && pledgeId && (
        <ExtensionForm
          pledgeId={pledgeId}
          pledge={pledge}
          onClose={() => setShowExtensionForm(false)}
          onSuccess={() => setShowExtensionForm(false)}
        />
      )}

      {showDisposalForm && pledgeId && (
        <DisposalForm
          pledgeId={pledgeId}
          onClose={() => setShowDisposalForm(false)}
          onSuccess={() => setShowDisposalForm(false)}
        />
      )}

      {showImport && (
        <ImportWizard
          onClose={() => setShowImport(false)}
          onSuccess={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
