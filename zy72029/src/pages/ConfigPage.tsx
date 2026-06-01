import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { validateMaterialPack, validateGameConfig, formatConfigErrors, tryParseJSON } from '@/utils/validation'
import { mockMaterialPack } from '@/data/mockMaterials'
import { ArrowLeft, Upload, AlertTriangle, CheckCircle, FileJson, Settings, Save } from 'lucide-react'
import type { ConfigError, MaterialPack } from '@/types'

export default function ConfigPage() {
  const navigate = useNavigate()
  const { loadState, materialPack: currentPack, riskThreshold, totalTime } = useGameStore()
  const [configErrors, setConfigErrors] = useState<ConfigError[]>([])
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  const [localConfig, setLocalConfig] = useState({
    riskThreshold: riskThreshold,
    totalTime: totalTime,
    materialPack: JSON.stringify(currentPack, null, 2),
  })

  const handleValidate = () => {
    const allErrors: ConfigError[] = []

    const packResult = tryParseJSON(localConfig.materialPack)
    if (!packResult.success) {
      allErrors.push({
        field: 'materialPack',
        technicalMessage: 'JSON parse error',
        userMessage: packResult.error || '材料包JSON格式错误',
      })
    } else {
      const packValidation = validateMaterialPack(packResult.data)
      allErrors.push(...packValidation.errors)
    }

    const configValidation = validateGameConfig({
      riskThreshold: localConfig.riskThreshold,
      totalTime: localConfig.totalTime,
    })
    allErrors.push(...configValidation.errors)

    setConfigErrors(allErrors)
    return allErrors.length === 0
  }

  const handleSave = () => {
    const isValid = handleValidate()
    if (!isValid) return

    const packResult = tryParseJSON(localConfig.materialPack)
    if (packResult.success && packResult.data) {
      loadState({
        riskThreshold: localConfig.riskThreshold,
        timeRemaining: localConfig.totalTime,
        totalTime: localConfig.totalTime,
        materialPack: packResult.data as MaterialPack,
        materials: (packResult.data as MaterialPack).materials,
        slots: (packResult.data as MaterialPack).slots,
      })

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  const handleRestoreDefault = () => {
    setLocalConfig({
      riskThreshold: 50,
      totalTime: 300,
      materialPack: JSON.stringify(mockMaterialPack, null, 2),
    })
    setConfigErrors([])
  }

  const handleImport = () => {
    const packResult = tryParseJSON(importText)
    if (!packResult.success) {
      setConfigErrors([{
        field: 'import',
        technicalMessage: 'Import JSON parse error',
        userMessage: packResult.error || '导入的JSON格式错误',
      }])
      return
    }

    const validation = validateMaterialPack(packResult.data)
    if (!validation.valid) {
      setConfigErrors(validation.errors)
      return
    }

    setLocalConfig(prev => ({
      ...prev,
      materialPack: JSON.stringify(packResult.data, null, 2),
    }))
    setConfigErrors([])
    setShowImport(false)
    setImportText('')
  }

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/60 hover:text-paper-cream transition-colors"
          >
            <ArrowLeft size={18} />
            返回游戏
          </button>

          {saveSuccess && (
            <span className="text-success-green font-mono text-sm flex items-center gap-2">
              <CheckCircle size={16} />
              配置已保存
            </span>
          )}
        </div>

        <div className="mb-8">
          <h1 className="font-mono text-2xl font-bold text-paper-cream mb-2 flex items-center gap-3">
            <Settings size={24} className="text-calm-blue" />
            材料与规则配置
          </h1>
          <p className="text-white/50 text-sm">
            配置保险理赔逃脱屋的材料包和游戏规则。配置错误会给出友好提示，不会直接白屏。
          </p>
        </div>

        {configErrors.length > 0 && (
          <div className="bg-danger-red/10 border border-danger-red/30 p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-danger-red flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="font-mono font-bold text-danger-red mb-2">
                  配置验证失败（{configErrors.length} 个问题）
                </h3>
                <pre className="text-sm text-white/80 whitespace-pre-wrap font-mono bg-black/20 p-3">
                  {formatConfigErrors(configErrors)}
                </pre>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 p-6">
            <h2 className="font-mono font-bold text-lg text-paper-cream mb-4">
              游戏规则配置
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-white/70 mb-2">
                  风险阈值
                  <span className="text-white/40 ml-2">（超过此值判定为规则理解错误）</span>
                </label>
                <input
                  type="number"
                  value={localConfig.riskThreshold}
                  onChange={e => setLocalConfig(prev => ({ ...prev, riskThreshold: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 text-paper-cream 
                    font-mono focus:outline-none focus:border-calm-blue transition-colors"
                  min="1"
                  max="200"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">
                  游戏时长（秒）
                  <span className="text-white/40 ml-2">（时间耗尽判定为操作超时）</span>
                </label>
                <input
                  type="number"
                  value={localConfig.totalTime}
                  onChange={e => setLocalConfig(prev => ({ ...prev, totalTime: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 text-paper-cream 
                    font-mono focus:outline-none focus:border-calm-blue transition-colors"
                  min="30"
                  max="3600"
                />
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono font-bold text-lg text-paper-cream flex items-center gap-2">
                <FileJson size={18} className="text-calm-blue" />
                材料包配置（JSON）
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 text-paper-cream 
                    font-mono text-sm hover:bg-white/20 transition-colors"
                >
                  <Upload size={14} />
                  导入材料包
                </button>
                <button
                  onClick={handleRestoreDefault}
                  className="px-4 py-2 bg-white/10 text-paper-cream font-mono text-sm 
                    hover:bg-white/20 transition-colors"
                >
                  恢复默认
                </button>
              </div>
            </div>

            <textarea
              value={localConfig.materialPack}
              onChange={e => setLocalConfig(prev => ({ ...prev, materialPack: e.target.value }))}
              rows={20}
              className="w-full px-4 py-3 bg-black/30 border border-white/20 text-paper-cream 
                font-mono text-xs focus:outline-none focus:border-calm-blue transition-colors
                resize-none"
              spellCheck={false}
            />
            <p className="text-xs text-white/40 mt-2">
              提示：材料包包含 materials（材料列表）和 slots（匹配槽位）两部分。每份材料必须配置 correctSlot 指向正确的槽位ID。
            </p>
          </div>

          <div className="flex gap-4 justify-end">
            <button
              onClick={handleValidate}
              className="px-6 py-3 bg-white/10 text-paper-cream font-mono 
                hover:bg-white/20 transition-colors"
            >
              验证配置
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-3 bg-calm-blue text-charcoal font-mono font-bold 
                hover:bg-calm-blue/90 transition-colors flex items-center gap-2"
            >
              <Save size={18} />
              保存并返回
            </button>
          </div>
        </div>

        {showImport && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowImport(false)}>
            <div 
              className="bg-paper-cream text-charcoal p-6 w-full max-w-2xl mx-4 border-2 border-calm-blue"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-mono text-xl font-bold mb-4 flex items-center gap-2">
                <Upload size={20} />
                导入材料包 JSON
              </h3>
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                rows={15}
                placeholder="粘贴材料包 JSON 内容..."
                className="w-full px-4 py-3 bg-white border-2 border-charcoal/20 text-charcoal 
                  font-mono text-xs focus:outline-none focus:border-calm-blue resize-none"
                autoFocus
              />
              <div className="flex gap-3 justify-end mt-4">
                <button
                  onClick={() => setShowImport(false)}
                  className="px-4 py-2 text-sm font-mono border-2 border-charcoal/30 
                    hover:bg-charcoal/10 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleImport}
                  className="px-6 py-2 text-sm font-mono bg-charcoal text-paper-cream 
                    hover:bg-charcoal/90 transition-colors"
                >
                  导入并验证
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
