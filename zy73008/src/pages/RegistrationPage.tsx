import { useDogStore } from '@/store/dogStore';
import { Plus, Trash2, Send, RotateCcw, MessageCircle, User, FileText, AlertTriangle, Weight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { weightUnitLabel } from '@/utils/dataUtils';
import type { WeightUnit, Operator, Conclusion } from '@/types';

export default function RegistrationPage() {
  const { draft, updateDraft, addDraftVaccine, removeDraftVaccine, updateDraftVaccine, addDraftSupplement, submitDraft, resetDraft } = useDogStore();
  const [supplementText, setSupplementText] = useState('');
  const [supplementOp, setSupplementOp] = useState<Operator>('小温');
  const navigate = useNavigate();
  const [toast, setToast] = useState<string | null>(null);

  const handleSubmit = () => {
    const rec = submitDraft();
    if (rec) {
      setToast(`已生成报告「${rec.current.dogName}」，共 ${rec.versionHistory.length} 个版本历史快照`);
      setTimeout(() => {
        setToast(null);
        navigate('/reports');
      }, 1800);
    } else {
      setToast('请至少填写犬只姓名和品种');
      setTimeout(() => setToast(null), 2200);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 animate-fade-in-up">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 card px-5 py-3 border-brand-300 shadow-card-hover text-brand-800 font-medium text-sm">
          {toast}
        </div>
      )}

      <section className="mb-6">
        <h2 className="font-serif text-2xl font-bold text-brand-800 mb-1">寄养登记表</h2>
        <p className="text-sm text-brand-500">前台小温日常录入入口。支持后续追加补录，系统会自动保留每个版本快照。</p>
      </section>

      {/* 基本信息 */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <h3 className="font-serif font-bold text-brand-800">犬只与主人基本信息</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="field-label">犬只姓名 *</label>
            <input className="field-input" placeholder="例：豆豆"
              value={draft.dogName} onChange={(e) => updateDraft({ dogName: e.target.value })} />
          </div>
          <div>
            <label className="field-label">品种 *</label>
            <input className="field-input" placeholder="例：金毛寻回犬"
              value={draft.breed} onChange={(e) => updateDraft({ breed: e.target.value })} />
          </div>
          <div>
            <label className="field-label">性别</label>
            <select className="field-select" value={draft.gender}
              onChange={(e) => updateDraft({ gender: e.target.value as '公' | '母' | '' })}>
              <option value="公">公</option>
              <option value="母">母</option>
            </select>
          </div>
          <div>
            <label className="field-label">年龄</label>
            <input className="field-input" placeholder="例：3岁 / 6个月"
              value={draft.age} onChange={(e) => updateDraft({ age: e.target.value })} />
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-3">
            <div>
              <label className="field-label flex items-center gap-1">
                <Weight className="w-3 h-3" /> 体重数值
              </label>
              <input type="number" step="0.1" className="field-input" placeholder="例：28.5"
                value={draft.weight} onChange={(e) => updateDraft({ weight: e.target.value })} />
            </div>
            <div>
              <label className="field-label">体重单位（混写会触发异常标注）</label>
              <select className="field-select" value={draft.weightUnit}
                onChange={(e) => updateDraft({ weightUnit: e.target.value as WeightUnit })}>
                <option value="kg">{weightUnitLabel.kg}</option>
                <option value="jin">{weightUnitLabel.jin}</option>
                <option value="lb">{weightUnitLabel.lb}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="field-label">主人姓名</label>
            <input className="field-input" placeholder="例：李明"
              value={draft.ownerName} onChange={(e) => updateDraft({ ownerName: e.target.value })} />
          </div>
          <div>
            <label className="field-label">联系电话</label>
            <input className="field-input" placeholder="例：138****2345"
              value={draft.ownerPhone} onChange={(e) => updateDraft({ ownerPhone: e.target.value })} />
          </div>
          <div>
            <label className="field-label">初始结论判定</label>
            <select className="field-select" value={draft.conclusion}
              onChange={(e) => updateDraft({ conclusion: e.target.value as Conclusion })}>
              <option value="待审核">待审核</option>
              <option value="疫苗合格 可寄养">疫苗合格 可寄养</option>
              <option value="疫苗缺失 需补打">疫苗缺失 需补打</option>
              <option value="资料不全 暂缓">资料不全 暂缓</option>
            </select>
          </div>
        </div>
      </div>

      {/* 疫苗记录 */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="font-serif font-bold text-brand-800">疫苗记录（多针次 + 附件）</h3>
          </div>
          <button className="btn-ghost text-xs" onClick={addDraftVaccine}>
            <Plus className="w-4 h-4" /> 添加针次
          </button>
        </div>

        <div className="space-y-4">
          {draft.vaccines.map((v, idx) => (
            <div key={idx} className="rounded-xl border border-brand-100 p-4 bg-brand-50/30">
              <div className="flex items-center justify-between mb-3">
                <span className="chip chip-normal">第 {idx + 1} 针</span>
                {draft.vaccines.length > 1 && (
                  <button className="text-brand-400 hover:text-red-500 text-xs inline-flex items-center gap-1"
                    onClick={() => removeDraftVaccine(idx)}>
                    <Trash2 className="w-3.5 h-3.5" /> 删除
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="field-label">疫苗名称</label>
                  <input className="field-input" value={v.name} placeholder="狂犬疫苗 / 犬四联…"
                    onChange={(e) => updateDraftVaccine(idx, { name: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">接种日期</label>
                  <input type="date" className="field-input" value={v.date}
                    onChange={(e) => updateDraftVaccine(idx, { date: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">有效期至</label>
                  <input type="date" className="field-input" value={v.expireDate}
                    onChange={(e) => updateDraftVaccine(idx, { expireDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="field-label">附件名称</label>
                  <input className="field-input" value={v.attachmentName || ''} placeholder="例：狂犬扫描页.jpg"
                    onChange={(e) => updateDraftVaccine(idx, { attachmentName: e.target.value, attachmentUrl: `#/att/new-${idx}` })} />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-xs text-anomaly-600 cursor-pointer select-none">
                    <input type="checkbox" checked={!!v.attachmentArrivedLate}
                      onChange={(e) => updateDraftVaccine(idx, { attachmentArrivedLate: e.target.checked })} />
                    <span className="font-medium">附件晚到（登记后补发）</span>
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </label>
                </div>
              </div>
              {v.attachmentArrivedLate && (
                <div className="mt-3 p-3 rounded-lg bg-anomaly-50 border border-anomaly-100 text-xs text-anomaly-700">
                  <strong>提示：</strong>勾选后，提交时系统将在版本历史中标注「晚到附件」异常，报告导出时会解释其对结论的影响。
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 补录备注 */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-brand-800">追加式补录备注</h3>
            <p className="text-xs text-brand-500 mt-0.5">主人临时补充的信息、旧版本截图说明等，提交后不可删除，将保留在历史版本中。</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="field-label">备注内容</label>
            <textarea rows={2} className="field-input resize-none" placeholder="例：主人微信补发狂犬页，章印清晰…"
              value={supplementText} onChange={(e) => setSupplementText(e.target.value)} />
          </div>
          <div>
            <label className="field-label">操作人</label>
            <select className="field-select w-40" value={supplementOp}
              onChange={(e) => setSupplementOp(e.target.value as Operator)}>
              <option value="小温">前台 · 小温</option>
              <option value="主人补录">主人补录</option>
              <option value="现场老师">现场老师</option>
              <option value="系统自动">系统自动</option>
            </select>
          </div>
          <button className="btn-ghost"
            onClick={() => { addDraftSupplement(supplementText, supplementOp); setSupplementText(''); }}
            disabled={!supplementText.trim()}>
            <Plus className="w-4 h-4" /> 追加备注
          </button>
        </div>

        {draft.supplements.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-auto scrollbar-thin">
            {draft.supplements.map((s, i) => (
              <div key={i} className={cn('flex gap-3', s.operator === '小温' ? 'justify-start' : 'justify-end')}>
                <div className={cn('max-w-[80%]', s.operator === '小温' ? 'bubble-left' : 'bubble-right')}>
                  <div className="text-[11px] opacity-75 mb-1 flex items-center gap-2">
                    <User className="w-3 h-3" /> {s.operator}
                  </div>
                  <div className="whitespace-pre-wrap">{s.content}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {draft.supplements.length === 0 && (
          <div className="text-xs text-brand-400 italic">暂无补录备注，可通过上方输入框追加。</div>
        )}
      </div>

      {/* 操作栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="btn-ghost" onClick={resetDraft}>
          <RotateCcw className="w-4 h-4" /> 清空表单
        </button>
        <button className="btn-primary" onClick={handleSubmit}>
          <Send className="w-4 h-4" /> 提交并生成疫苗报告导出
        </button>
      </div>
    </div>
  );
}
