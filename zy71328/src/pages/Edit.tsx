import { useState } from 'react'
import {
  ArrowLeft,
  Save,
  RotateCcw,
  Play,
  Volume2,
  Zap,
  Shield,
  AlertTriangle,
  Sliders,
} from 'lucide-react'
import { useConfigStore } from '@/store/useConfigStore'
import { useHistoryStore } from '@/store/useHistoryStore'
import { useAudioStore } from '@/store/useAudioStore'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Slider from '@/components/forms/Slider'
import Toggle from '@/components/forms/Toggle'
import Input from '@/components/forms/Input'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  icon: React.ReactNode
  title: string
  description?: string
}

function SectionHeader({ icon, title, description }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-lg bg-accent-cyan/10 text-accent-cyan">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        {description && (
          <p className="text-xs text-text-muted">{description}</p>
        )}
      </div>
    </div>
  )
}

const lufsPresets = [
  { value: -16, label: '-16 LUFS', desc: '播客/Spotify' },
  { value: -18, label: '-18 LUFS', desc: 'Apple Podcasts' },
  { value: -23, label: '-23 LUFS', desc: '广播标准' },
  { value: 0, label: '自定义', desc: '自定义设置' },
]

export default function Edit() {
  const config = useConfigStore((state) => state.processConfig)
  const updateConfig = useConfigStore((state) => state.updateConfig)
  const resetConfig = useConfigStore((state) => state.resetConfig)
  const addHistoryRecord = useHistoryStore((state) => state.addHistoryRecord)
  const currentAudioId = useAudioStore((state) => state.currentAudioId)

  const [selectedPreset, setSelectedPreset] = useState<number>(
    config.targetLufs)
  const [customLufs, setCustomLufs] = useState(config.targetLufs)
  const [clipThreshold, setClipThreshold] = useState(-2)
  const [clipSensitivity, setClipSensitivity] = useState(80)
  const [autoFixClipping, setAutoFixClipping] = useState(true)

  const handlePresetChange = (value: number) => {
    setSelectedPreset(value)
    if (value !== 0) {
      updateConfig({ targetLufs: value })
    }
  }

  const handleSave = () => {
    if (currentAudioId) {
      addHistoryRecord(currentAudioId, config, '更新处理参数')
    }
    console.log('Config saved:', config)
  }

  const handleReset = () => {
    resetConfig()
    setSelectedPreset(-16)
    setCustomLufs(-16)
  }

  const handlePreview = () => {
    console.log('Preview with current config')
  }

  return (
    <div className="flex flex-col h-full gap-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => console.log('Go back')}
          >
            返回
          </Button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">参数编辑</h1>
            <p className="text-sm text-text-muted">
              调整音频处理参数，实时预览效果</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Play className="w-4 h-4" />}
            onClick={handlePreview}
          >
            预览试听
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RotateCcw className="w-4 h-4" />}
            onClick={handleReset}
          >
            重置
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Save className="w-4 h-4" />}
            onClick={handleSave}
          >
            保存
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeader
            icon={<Volume2 className="w-5 h-5" />}
            title="响度配置"
            description="设置目标响度和容差范围"
          />

          <div className="space-y-4">
            <div>
              <label className="text-sm text-text-secondary mb-2 block">
                目标 LUFS</label>
              <div className="grid grid-cols-4 gap-2">
                {lufsPresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handlePresetChange(preset.value)}
                    className={cn(
                      'p-3 rounded-lg border transition-all text-left',
                      selectedPreset === preset.value
                        ? 'border-accent-cyan bg-accent-cyan/20 text-accent-cyan'
                        : 'border-border-default bg-bg-tertiary/50 text-text-secondary hover:border-border-default/80'
                    )}
                  >
                    <div className="text-sm font-medium">{preset.label}</div>
                    <div className="text-xs opacity-70">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {selectedPreset === 0 && (
              <Input
                label="自定义 LUFS"
                type="number"
                value={customLufs}
                onChange={(e) => {
                  const num = Number(e.target.value)
                  setCustomLufs(num)
                  updateConfig({ targetLufs: num })
                }}
                min={-40}
                max={-10}
                step={0.1}
                suffix="LUFS"
              />
            )}

            <Slider
              label="容差"
              value={config.lufsTolerance}
              onChange={(val) => updateConfig({ lufsTolerance: val })}
              min={0.5}
              max={3}
              step={0.1}
              unit="LU"
            />

            <Toggle
              label="启用自动增益"
              checked={config.enableAutoGain}
              onChange={(checked) => updateConfig({ enableAutoGain: checked })}
            />
          </div>
        </Card>

        <Card>
          <SectionHeader
            icon={<Zap className="w-5 h-5" />}
            title="峰值限制"
            description="控制峰值和压缩器参数"
          />

          <div className="space-y-4">
            <Slider
              label="True Peak 阈值"
              value={config.truePeakLimit}
              onChange={(val) => updateConfig({ truePeakLimit: val })}
              min={-6}
              max={0}
              step={0.1}
              unit="dBTP"
            />

            <Slider
              label="压缩器阈值"
              value={config.compressorThreshold}
              onChange={(val) => updateConfig({ compressorThreshold: val })}
              min={-30}
              max={-10}
              step={0.5}
              unit="dB"
            />

            <Slider
              label="压缩比率"
              value={config.compressorRatio}
              onChange={(val) => updateConfig({ compressorRatio: val })}
              min={1}
              max={10}
              step={0.5}
              unit=":1"
            />

            <div className="grid grid-cols-2 gap-4">
              <Slider
                label="启动时间"
                value={config.attackTime}
                onChange={(val) => updateConfig({ attackTime: val })}
                min={1}
                max={30}
                step={1}
                unit="ms"
              />

              <Slider
                label="释放时间"
                value={config.releaseTime}
                onChange={(val) => updateConfig({ releaseTime: val })}
                min={10}
                max={500}
                step={10}
                unit="ms"
              />
            </div>

            <Toggle
              label="启用峰值限制器"
              checked={config.enablePeakLimiter}
              onChange={(checked) => updateConfig({ enablePeakLimiter: checked })}
            />
          </div>
        </Card>

        <Card>
          <SectionHeader
            icon={<Shield className="w-5 h-5" />}
            title="区间保护"
            description="保护片头片尾不被修改"
          />

          <div className="space-y-4">
            <Toggle
              label="保护片头"
              checked={config.protectIntro}
              onChange={(checked) => updateConfig({ protectIntro: checked })}
            />

            {config.protectIntro && (
              <div className="grid grid-cols-2 gap-4">
                <Slider
                  label="片时时长"
                  value={config.introDuration}
                  onChange={(val) => updateConfig({ introDuration: val })}
                  min={0}
                  max={30}
                  step={0.5}
                  unit="秒"
                />
                <Slider
                  label="淡入时长"
                  value={config.fadeInDuration}
                  onChange={(val) => updateConfig({ fadeInDuration: val })}
                  min={0}
                  max={5}
                  step={0.1}
                  unit="秒"
                />
              </div>
            )}

            <Toggle
              label="保护片尾"
              checked={config.protectOutro}
              onChange={(checked) => updateConfig({ protectOutro: checked })}
            />

            {config.protectOutro && (
              <div className="grid grid-cols-2 gap-4">
                <Slider
                  label="片尾时长"
                  value={config.outroDuration}
                  onChange={(val) => updateConfig({ outroDuration: val })}
                  min={0}
                  max={30}
                  step={0.5}
                  unit="秒"
                />
                <Slider
                  label="淡出时长"
                  value={config.fadeOutDuration}
                  onChange={(val) => updateConfig({ fadeOutDuration: val })}
                  min={0}
                  max={5}
                  step={0.1}
                  unit="秒"
                />
              </div>
            )}
          </div>
        </Card>

        <Card>
          <SectionHeader
            icon={<AlertTriangle className="w-5 h-5" />}
            title="爆音检测"
            description="检测和修复爆音问题"
          />

          <div className="space-y-4">
            <Slider
              label="爆音阈值"
              value={clipThreshold}
              onChange={setClipThreshold}
              min={-6}
              max={0}
              step={0.1}
              unit="dB"
            />

            <Slider
              label="检测灵敏度"
              value={clipSensitivity}
              onChange={setClipSensitivity}
              min={50}
              max={100}
              step={1}
              unit="%"
            />

            <Toggle
              label="自动修复爆音"
              checked={autoFixClipping}
              onChange={setAutoFixClipping}
            />

            {autoFixClipping && (
              <div className="p-3 rounded-lg bg-accent-green/10 border border-accent-green/30">
              <p className="text-xs text-text-secondary">
                <AlertTriangle className="w-4 h-4 inline mr-2 text-accent-green" />
                启用后将自动修复检测到的爆音问题
              </p>
            </div>
            )}
          </div>
        </Card>
      </div>

      <div className="sticky bottom-0 pt-4 border-t border-border-default bg-bg-primary/95 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-bg-secondary border border-border-default">
              <Sliders className="w-5 h-5 text-accent-purple" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">当前配置</p>
              <p className="text-xs text-text-muted">
                目标响度: {config.targetLufs} LUFS · 峰值限制: {config.truePeakLimit} dBTP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Play className="w-4 h-4" />}
              onClick={handlePreview}
            >
              预览试听
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw className="w-4 h-4" />}
              onClick={handleReset}
            >
              重置
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Save className="w-4 h-4" />}
              onClick={handleSave}
            >
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
