import { useEffect, useRef } from 'react';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { mockCalculationRules } from '@/data/mockData';
import { Calculator, Link2, BookOpen, ArrowRight } from 'lucide-react';

export default function CalcFormulaPanel() {
  const scrollTarget = usePlaybackStore((s) => s.scrollTarget);
  const setScrollTarget = usePlaybackStore((s) => s.setScrollTarget);
  const sectionRef = useRef<HTMLDivElement>(null);
  const setScrollTargetStore = usePlaybackStore((s) => s.setScrollTarget);

  useEffect(() => {
    if (scrollTarget === 'calc-section') {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => setScrollTarget(null), 600);
    }
  }, [scrollTarget, setScrollTarget]);

  const handleJumpToSpareParts = () => {
    setScrollTargetStore('spare-parts-section');
  };

  return (
    <div id="calc-section" ref={sectionRef} className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">
          <Calculator className="w-4 h-4" />
          计算口径 · 判定规则依据
        </h2>
        <button
          onClick={handleJumpToSpareParts}
          className="text-xs text-navy-500 font-medium hover:underline inline-flex items-center gap-1"
        >
          回到备件清单 <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {mockCalculationRules.map((rule, idx) => (
          <div
            key={rule.id}
            className="rounded-md border border-coolgray-200 bg-white p-4 hover:border-navy-200 hover:bg-navy-50/30 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 rounded-sm bg-navy-500 text-white flex items-center justify-center font-bold text-sm shadow-inner">
                {String(idx + 1).padStart(2, '0')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-coolgray-800 flex items-center gap-2">
                  {rule.name}
                </div>
                <p className="text-xs text-coolgray-600 mt-1.5 leading-relaxed">{rule.description}</p>
                <div className="mt-3 font-mono text-[11px] bg-coolgray-800 text-coolgray-100 rounded-sm px-3 py-2 overflow-x-auto">
                  <span className="text-jade-300">{rule.formula}</span>
                </div>
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-navy-500">
                  <Link2 className="w-3 h-3 mt-0.5 shrink-0" />
                  <button
                    onClick={handleJumpToSpareParts}
                    className="text-left hover:underline font-medium"
                  >
                    <BookOpen className="w-3 h-3 inline mr-0.5" />
                    来源：{rule.sourceRef}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-sm bg-navy-50 border border-navy-200 flex items-start gap-3">
        <div className="shrink-0 text-navy-500">
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="text-xs text-navy-700 leading-relaxed">
          <span className="font-bold">说明：</span>
          所有异常判定均依据以上规则自动计算，点击任一规则末尾的「来源」可跳转至对应的数据表字段。如需修改计算规则，请联系设备工程师在后台配置。
        </div>
      </div>
    </div>
  );
}
