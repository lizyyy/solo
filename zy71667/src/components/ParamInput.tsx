import { useDrumStore } from '../store/useDrumStore';
import { MATERIALS, COMMON_DIAMETERS_INCH, type DiameterUnit, type TensionUnit, type MaterialKey } from '../utils/constants';
import { Calculator, Ruler, Weight, Target, FileText } from 'lucide-react';

export default function ParamInput() {
  const {
    params, setDiameter, setDiameterUnit, setTension, setTensionUnit,
    setMaterial, setCustomDensity, setTargetFreq, setTargetNote, setNotes,
    calculate, saveToHistory, loadDemoData,
    showOverwriteWarning, dismissOverwriteWarning, confirmOverwrite,
  } = useDrumStore();

  return (
    <div className="space-y-5">
      <div className="bg-drum-card rounded-xl border border-drum-border p-5 space-y-4">
        <div className="flex items-center gap-2 text-drum-copper font-semibold">
          <Ruler className="w-4 h-4" />
          鼓皮直径
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={params.diameter || ''}
            onChange={e => setDiameter(parseFloat(e.target.value) || 0)}
            className="flex-1 bg-drum-bg border border-drum-border rounded-lg px-3 py-2 text-drum-text text-sm focus:outline-none focus:border-drum-copper transition-colors"
            placeholder="输入直径"
            min="0"
            step="0.1"
          />
          <select
            value={params.diameterUnit}
            onChange={e => setDiameterUnit(e.target.value as DiameterUnit)}
            className="bg-drum-bg border border-drum-border rounded-lg px-3 py-2 text-drum-text text-sm focus:outline-none focus:border-drum-copper"
          >
            <option value="inch">英寸 (in)</option>
            <option value="cm">厘米 (cm)</option>
          </select>
        </div>
        {params.diameterUnit === 'inch' && (
          <div className="flex flex-wrap gap-1.5">
            {COMMON_DIAMETERS_INCH.map(d => (
              <button
                key={d}
                onClick={() => setDiameter(d)}
                className={`px-2.5 py-1 rounded text-xs transition-all ${
                  params.diameter === d
                    ? 'bg-drum-copper/20 text-drum-copper border border-drum-copper/40'
                    : 'bg-drum-bg text-drum-textMuted border border-drum-border hover:border-drum-borderLight hover:text-drum-text'
                }`}
              >
                {d}"
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-drum-card rounded-xl border border-drum-border p-5 space-y-4">
        <div className="flex items-center gap-2 text-drum-copper font-semibold">
          <Weight className="w-4 h-4" />
          张力读数
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={params.tension || ''}
            onChange={e => setTension(parseFloat(e.target.value) || 0)}
            className="flex-1 bg-drum-bg border border-drum-border rounded-lg px-3 py-2 text-drum-text text-sm focus:outline-none focus:border-drum-copper transition-colors"
            placeholder="输入张力"
            min="0"
            step="1"
          />
          <select
            value={params.tensionUnit}
            onChange={e => setTensionUnit(e.target.value as TensionUnit)}
            className="bg-drum-bg border border-drum-border rounded-lg px-3 py-2 text-drum-text text-sm focus:outline-none focus:border-drum-copper"
          >
            <option value="N/m">N/m</option>
            <option value="lbf/in">lbf/in</option>
            <option value="kgf/cm">kgf/cm</option>
          </select>
        </div>
      </div>

      <div className="bg-drum-card rounded-xl border border-drum-border p-5 space-y-4">
        <div className="flex items-center gap-2 text-drum-copper font-semibold">
          <FileText className="w-4 h-4" />
          鼓皮材质
        </div>
        <div className="space-y-2">
          {(Object.keys(MATERIALS) as MaterialKey[]).map(key => {
            const mat = MATERIALS[key];
            return (
              <button
                key={key}
                onClick={() => setMaterial(key)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                  params.material === key
                    ? 'bg-drum-copper/15 border-drum-copper/40 text-drum-copper'
                    : 'bg-drum-bg border-drum-border text-drum-textMuted hover:border-drum-borderLight hover:text-drum-text'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{mat.label}</span>
                  <span className="text-xs opacity-60">{mat.density} kg/m²</span>
                </div>
                <p className="text-xs mt-0.5 opacity-50">{mat.description}</p>
              </button>
            );
          })}
        </div>
        {params.material === 'custom' && (
          <div className="pt-2">
            <label className="text-xs text-drum-textMuted mb-1 block">自定义面密度 (kg/m²)</label>
            <input
              type="number"
              value={params.customDensity || ''}
              onChange={e => setCustomDensity(parseFloat(e.target.value) || 0)}
              className="w-full bg-drum-bg border border-drum-border rounded-lg px-3 py-2 text-drum-text text-sm focus:outline-none focus:border-drum-copper transition-colors"
              placeholder="0.19"
              min="0"
              step="0.01"
            />
          </div>
        )}
      </div>

      <div className="bg-drum-card rounded-xl border border-drum-border p-5 space-y-4">
        <div className="flex items-center gap-2 text-drum-copper font-semibold">
          <Target className="w-4 h-4" />
          目标频率（可选）
        </div>
        <div className="space-y-2">
          <input
            type="number"
            value={params.targetFreq || ''}
            onChange={e => setTargetFreq(parseFloat(e.target.value) || 0)}
            className="w-full bg-drum-bg border border-drum-border rounded-lg px-3 py-2 text-drum-text text-sm focus:outline-none focus:border-drum-copper transition-colors"
            placeholder="输入目标频率 (Hz)"
            min="0"
            step="0.1"
          />
          <input
            type="text"
            value={params.targetNote}
            onChange={e => setTargetNote(e.target.value)}
            className="w-full bg-drum-bg border border-drum-border rounded-lg px-3 py-2 text-drum-text text-sm focus:outline-none focus:border-drum-copper transition-colors"
            placeholder="目标音名，如 B3、A4"
          />
        </div>
      </div>

      <div className="bg-drum-card rounded-xl border border-drum-border p-5 space-y-4">
        <label className="text-drum-copper font-semibold text-sm">调试备注</label>
        <textarea
          value={params.notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full bg-drum-bg border border-drum-border rounded-lg px-3 py-2 text-drum-text text-sm focus:outline-none focus:border-drum-copper transition-colors resize-none"
          rows={3}
          placeholder="记录调试情况、环境温湿度等..."
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={calculate}
          className="flex-1 flex items-center justify-center gap-2 bg-drum-copper hover:bg-drum-copperLight text-drum-bg font-semibold py-2.5 rounded-lg transition-all hover:shadow-lg hover:shadow-drum-copper/20"
        >
          <Calculator className="w-4 h-4" />
          换算
        </button>
        <button
          onClick={saveToHistory}
          className="px-4 py-2.5 bg-drum-card border border-drum-border text-drum-textMuted hover:text-drum-text hover:border-drum-copper/40 rounded-lg transition-all text-sm"
        >
          保存
        </button>
      </div>

      {showOverwriteWarning && (
        <div className="bg-drum-amber/10 border border-drum-amber/30 rounded-lg p-4 animate-fade-in">
          <p className="text-drum-amber text-sm mb-3">
            已存在参数相近的记录，是否覆盖？
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmOverwrite}
              className="px-3 py-1.5 bg-drum-amber/20 text-drum-amber rounded text-sm hover:bg-drum-amber/30 transition-colors"
            >
              覆盖
            </button>
            <button
              onClick={dismissOverwriteWarning}
              className="px-3 py-1.5 bg-drum-card text-drum-textMuted rounded text-sm hover:text-drum-text transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="bg-drum-card rounded-xl border border-drum-border p-5 space-y-3">
        <div className="text-drum-textDim text-xs font-semibold uppercase tracking-wider">演示数据</div>
        <div className="space-y-2">
          <button
            onClick={() => loadDemoData(0)}
            className="w-full text-left px-3 py-2 rounded-lg bg-drum-bg border border-drum-border hover:border-drum-copper/30 transition-all"
          >
            <span className="text-drum-text text-sm">14" 军鼓 Mylar</span>
            <span className="block text-xs text-drum-textDim">顺利流程</span>
          </button>
          <button
            onClick={() => loadDemoData(1)}
            className="w-full text-left px-3 py-2 rounded-lg bg-drum-bg border border-drum-border hover:border-drum-amber/30 transition-all"
          >
            <span className="text-drum-text text-sm">6" piccolo Kevlar</span>
            <span className="block text-xs text-drum-textDim">边界情况</span>
          </button>
          <button
            onClick={() => loadDemoData(2)}
            className="w-full text-left px-3 py-2 rounded-lg bg-drum-bg border border-drum-border hover:border-drum-red/30 transition-all"
          >
            <span className="text-drum-text text-sm">14" 老化小牛皮</span>
            <span className="block text-xs text-drum-textDim">现实例外</span>
          </button>
        </div>
      </div>
    </div>
  );
}
