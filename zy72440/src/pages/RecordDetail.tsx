import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Music, 
  Package, 
  MapPin, 
  MessageSquare,
  Users,
  FileText,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Edit3,
  Play
} from 'lucide-react';
import { useInventoryStore } from '@/store/inventoryStore';
import { ProcessStepper } from '@/components/process/ProcessStepper';
import { Timeline } from '@/components/process/Timeline';
import { StatusBadge } from '@/components/common/StatusBadge';

export function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getRecordById, reviewJietlong, markSupplementary, manualCorrect, rerunValidation } = useInventoryStore();
  const record = getRecordById(id || '');
  
  const [showJietlongModal, setShowJietlongModal] = useState(false);
  const [showSupplementaryModal, setShowSupplementaryModal] = useState(false);
  const [showCorrectModal, setShowCorrectModal] = useState(false);
  const [jietlongContent, setJietlongContent] = useState('');
  const [supplementaryNote, setSupplementaryNote] = useState('');
  const [newQuantity, setNewQuantity] = useState(0);

  if (!record) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">记录不存在</p>
        <button
          onClick={() => navigate('/records')}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          返回列表
        </button>
      </div>
    );
  }

  const hasMissingRegion = record.authorizedRegions.some(r => r.isMissing);
  const missingCities = record.authorizedRegions.filter(r => r.isMissing).map(r => r.city);

  const handleReviewJietlong = () => {
    if (jietlongContent.trim() && id) {
      reviewJietlong(id, jietlongContent);
      setShowJietlongModal(false);
      setJietlongContent('');
    }
  };

  const handleMarkSupplementary = () => {
    if (supplementaryNote.trim() && id) {
      markSupplementary(id, supplementaryNote);
      setShowSupplementaryModal(false);
      setSupplementaryNote('');
    }
  };

  const handleManualCorrect = () => {
    if (newQuantity > 0 && id) {
      manualCorrect(id, newQuantity);
      setShowCorrectModal(false);
      setNewQuantity(0);
    }
  };

  const handleRerun = () => {
    if (id) {
      rerunValidation(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/records')}
          className="p-2 hover:bg-white rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">{record.artistName}</h2>
            <StatusBadge status={record.status} />
            {record.isDemo && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                演示数据
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">{record.merchandise}</p>
        </div>
      </div>

      <ProcessStepper currentStep={record.currentStep} hasMissingRegion={hasMissingRegion} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-blue-600" />
              基本信息
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-slate-500 block mb-1">艺人/活动</label>
                <p className="font-medium text-slate-800">{record.artistName}</p>
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">周边商品</label>
                <p className="font-medium text-slate-800">{record.merchandise}</p>
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">数量</label>
                <p className="font-medium text-slate-800 flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  {record.quantity} 件
                </p>
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">创建时间</label>
                <p className="font-medium text-slate-800 font-mono text-sm">{record.createdAt}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              授权地区
            </h3>
            <div className="flex flex-wrap gap-2">
              {record.authorizedRegions.map((region, idx) => (
                <span
                  key={idx}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2
                    ${region.isMissing
                      ? 'bg-amber-50 text-amber-700 border-2 border-amber-300 border-dashed'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}
                  `}
                >
                  {region.isMissing && <AlertTriangle className="w-4 h-4" />}
                  {region.city}
                  {region.isMissing && ' (待补充)'}
                </span>
              ))}
            </div>
            {hasMissingRegion && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-700 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>检测到授权地区不完整</strong>：缺少 {missingCities.join('、')}。
                    系统已自动标记为"待店长复核"，暂不进入下一步流程。请联系店长补充确认。
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              调音师留言
            </h3>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-slate-700">{record.tunerMessage}</p>
            </div>
          </div>

          {record.groupJietlong && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                排练群接龙
              </h3>
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <p className="text-indigo-700">{record.groupJietlong}</p>
              </div>
            </div>
          )}

          {record.hasSupplementary && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-orange-600" />
                补录返工说明
              </h3>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-orange-700">{record.supplementaryNote}</p>
              </div>
            </div>
          )}

          {record.verificationOrder && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                课时核销单
              </h3>
              <div className={`p-4 rounded-lg border ${
                record.verificationOrder.status === 'matched' 
                  ? 'bg-teal-50 border-teal-200' 
                  : record.verificationOrder.status === 'mismatch'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <span className="text-sm text-slate-500">核销单号</span>
                    <p className="font-mono font-medium text-slate-800">{record.verificationOrder.orderNo}</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">状态</span>
                    <p className={`font-medium ${
                      record.verificationOrder.status === 'matched' ? 'text-teal-700' :
                      record.verificationOrder.status === 'mismatch' ? 'text-red-700' : 'text-slate-700'
                    }`}>
                      {record.verificationOrder.status === 'matched' ? '✓ 已对账' :
                       record.verificationOrder.status === 'mismatch' ? '⚠ 存在差异' : '待对账'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">核销数量</span>
                    <p className="font-medium text-slate-800">{record.verificationOrder.quantity} 件</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">核销金额</span>
                    <p className="font-medium text-slate-800">¥ {record.verificationOrder.amount.toLocaleString()}</p>
                  </div>
                </div>
                {record.verificationOrder.mismatchReason && (
                  <p className="text-sm text-red-600 pt-3 border-t border-red-200">
                    差异说明：{record.verificationOrder.mismatchReason}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">操作</h3>
            <div className="space-y-3">
              {!hasMissingRegion && !record.groupJietlong && (record.currentStep === 'import' || record.currentStep === 'review_jietlong') && (
                <button
                  onClick={() => setShowJietlongModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <Users className="w-5 h-5" />
                  补看排练群接龙
                </button>
              )}
              
              {record.groupJietlong && record.status !== 'supplementary' && record.status !== 'completed' && (
                <button
                  onClick={() => setShowSupplementaryModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  标记补录返工
                </button>
              )}
              
              {record.status === 'supplementary' && (
                <>
                  <button
                    onClick={() => {
                      setNewQuantity(record.quantity);
                      setShowCorrectModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                  >
                    <Edit3 className="w-5 h-5" />
                    人工修正
                  </button>
                  <button
                    onClick={handleRerun}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                  >
                    <Play className="w-5 h-5" />
                    重跑校验
                  </button>
                </>
              )}

              {hasMissingRegion && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-700 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>地区信息不完整，请先前往「店长复核」页面补充地区信息</span>
                  </p>
                  <button
                    onClick={() => navigate('/review')}
                    className="mt-3 w-full px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
                  >
                    去店长复核
                  </button>
                </div>
              )}

              {record.status === 'completed' && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-sm text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    流程已完成，所有步骤通过
                  </p>
                </div>
              )}

              {!hasMissingRegion && record.currentStep === 'review_jietlong' && !record.groupJietlong && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 flex items-start gap-2">
                    <Users className="w-5 h-5 flex-shrink-0" />
                    <span>地区已完整，请补看排练群接龙以继续流程</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          <Timeline logs={[...record.operationLogs].reverse()} />
        </div>
      </div>

      {showJietlongModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">补看排练群接龙</h3>
            <textarea
              value={jietlongContent}
              onChange={(e) => setJietlongContent(e.target.value)}
              placeholder="请输入排练群接龙内容..."
              className="w-full h-32 px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowJietlongModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleReviewJietlong}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}

      {showSupplementaryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">标记补录返工</h3>
            <textarea
              value={supplementaryNote}
              onChange={(e) => setSupplementaryNote(e.target.value)}
              placeholder="请说明补录原因..."
              className="w-full h-32 px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowSupplementaryModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleMarkSupplementary}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                确认标记
              </button>
            </div>
          </div>
        </div>
      )}

      {showCorrectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">人工修正数量</h3>
            <label className="text-sm text-slate-500 block mb-2">修正后的数量</label>
            <input
              type="number"
              value={newQuantity}
              onChange={(e) => setNewQuantity(Number(e.target.value))}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowCorrectModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleManualCorrect}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                确认修正
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
