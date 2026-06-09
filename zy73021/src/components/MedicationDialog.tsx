import { useState } from 'react';
import { X, AlertTriangle, ShieldCheck, Phone, CalendarCheck, Pill } from 'lucide-react';
import type { AbnormalAlert } from '@/types';

interface Props {
  alert: AbnormalAlert;
  onClose: () => void;
  onConfirm: (change: {
    drugName: string;
    oldDosage: string;
    newDosage: string;
    guidanceNote: string;
  }) => void;
}

export default function MedicationDialog({ alert, onClose, onConfirm }: Props) {
  const current = alert.currentMedication;
  const [drugName, setDrugName] = useState(current?.drugName ?? '');
  const [oldDosage, setOldDosage] = useState(current?.dosage ?? '');
  const [newDosage, setNewDosage] = useState('');
  const [extraNote, setExtraNote] = useState('');

  const buildGuidance = () => {
    const steps = [
      `1. 【短期观察】剂量调整后 24-72 小时内密切观察 ${alert.pet?.name ?? '宠物'} 状态：食欲、饮水、精神、呕吐/腹泻等，如有异常立即停药就诊；`,
      `2. 【中期回访】7±2 天内回电主人，重点询问体重变化趋势、服药依从性和药物反应；`,
      `3. 【长期复核】30 天内安排复称+相关指标复查，同步写入时间线并重跑异常判断。`,
    ];
    if (extraNote.trim()) steps.push(`4. 【补充说明】${extraNote.trim()}`);
    return steps.join('\n');
  };

  const canSubmit = drugName.trim() && oldDosage.trim() && newDosage.trim() && newDosage !== oldDosage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-panel overflow-hidden animate-scale-in">
        <div className="bg-gradient-to-r from-amber-50 to-rose-50 p-4 border-b border-amber-100">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-warn/15 flex items-center justify-center text-warn shrink-0 ring-4 ring-white shadow-card">
              <AlertTriangle size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl font-bold text-slate-800">用药剂量调整警告</h3>
                <button onClick={onClose} className="btn-ghost !p-1.5">
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                剂量变更会影响体重判断逻辑，下方处理指引将<strong className="text-amber-700">永久写入时间线</strong>供接手人查看。
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">药品名称</label>
              <input className="input" value={drugName} onChange={(e) => setDrugName(e.target.value)} placeholder="如：曲洛斯坦" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">原剂量</label>
                <input className="input bg-slate-50 text-slate-500" value={oldDosage} onChange={(e) => setOldDosage(e.target.value)} placeholder="30mg qd" />
              </div>
              <div>
                <label className="label text-amber-700">新剂量 *</label>
                <input
                  className="input border-amber-300 focus:border-amber-400 focus:ring-amber-100"
                  value={newDosage}
                  onChange={(e) => setNewDosage(e.target.value)}
                  placeholder="调整后剂量"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label">补充说明（可选，会附加到处理指引）</label>
            <textarea
              className="input min-h-[60px] resize-y"
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              placeholder="如：需结合SDMA监测、需配合低脂饮食..."
            />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-center gap-2 mb-2 font-semibold text-amber-800">
              <ShieldCheck size={15} />
              📋 接手人标准处理指引（将写入时间线）
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-start gap-2">
                <Phone size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <p><strong className="text-amber-800">72h 短期观察：</strong>剂量调整后 24-72 小时观察食欲/饮水/精神/呕吐腹泻，异常立即停药就诊。</p>
              </div>
              <div className="flex items-start gap-2">
                <Pill size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <p><strong className="text-amber-800">7 天回访：</strong>电联主人确认依从性，记录体重趋势与药物反应，追加备注到时间线。</p>
              </div>
              <div className="flex items-start gap-2">
                <CalendarCheck size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <p><strong className="text-amber-800">30 天复核：</strong>安排复称+相关指标（肝肾/激素）复查，补录后务必<strong>重跑异常判断</strong>校验历史连续。</p>
              </div>
              {extraNote.trim() && (
                <div className="pt-2 mt-2 border-t border-amber-200/80 text-xs italic text-slate-600">
                  补充说明：{extraNote.trim()}
                </div>
              )}
            </div>
          </div>

          {newDosage && newDosage === oldDosage && (
            <p className="text-xs text-rose-600">新旧剂量相同，请调整新剂量后再确认。</p>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button
            className="btn btn-danger"
            disabled={!canSubmit}
            onClick={() =>
              onConfirm({
                drugName: drugName.trim(),
                oldDosage: oldDosage.trim(),
                newDosage: newDosage.trim(),
                guidanceNote: buildGuidance(),
              })
            }
          >
            <AlertTriangle size={14} />
            我已知悉，确认变更
          </button>
        </div>
      </div>
    </div>
  );
}
