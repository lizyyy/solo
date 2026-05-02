import React, { useState, useRef } from 'react'
import {
  Upload,
  Download,
  Play,
  AlertTriangle,
  Settings,
  FileText,
  Database,
  Trash2,
  Check,
  Plus,
  ChevronRight,
  ChevronDown,
  Save,
  RefreshCw
} from 'lucide-react'
import { useScene } from '@/store/sceneStore'
import {
  parseSegmentsCSV,
  parseObstaclesCSV,
  parseTidalWindowsCSV,
  parseCraneCSV
} from '@/parsers/csvParser'
import {
  downloadMarkdown,
  downloadRiskCSV,
  downloadSceneJSON
} from '@/io/exporter'
import { downloadSampleCSV } from '@/data/sampleData'
import { getCollisionTypeName, getSeverityColor } from '@/engine/collisionEngine'
import { localStorageService } from '@/storage/localStorage'

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-gray-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-gray-200">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export const Sidebar: React.FC = () => {
  const {
    scene,
    setSegments,
    setObstacles,
    setTidalWindows,
    setCrane,
    runCollisionCheck,
    addKeyframe,
    resetScene,
    updateSceneName
  } = useScene()

  const [sceneName, setSceneName] = useState(scene.name)
  const [importingType, setImportingType] = useState<
    'segments' | 'obstacles' | 'tidal' | 'crane' | null
  >(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const criticalCount = scene.collisionResults.filter((c) => c.severity === 'critical').length
  const warningCount = scene.collisionResults.filter((c) => c.severity === 'warning').length

  const handleFileSelect = async (type: 'segments' | 'obstacles' | 'tidal' | 'crane') => {
    setImportingType(type)
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !importingType) return

    try {
      switch (importingType) {
        case 'segments': {
          const result = await parseSegmentsCSV(file)
          if (result.data.length > 0) {
            setSegments(result.data)
          }
          if (result.errors.length > 0) {
            alert(`解析错误: ${result.errors.map((e) => e.message).join('\n')}`)
          }
          break
        }
        case 'obstacles': {
          const result = await parseObstaclesCSV(file)
          if (result.data.length > 0) {
            setObstacles(result.data)
          }
          break
        }
        case 'tidal': {
          const result = await parseTidalWindowsCSV(file)
          if (result.data.length > 0) {
            setTidalWindows(result.data)
          }
          break
        }
        case 'crane': {
          const result = await parseCraneCSV(file)
          if (result.data.length > 0) {
            setCrane(result.data[0])
          }
          break
        }
      }
    } catch (error) {
      alert('文件解析失败，请检查格式')
    }

    setImportingType(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleNameBlur = () => {
    if (sceneName.trim()) {
      updateSceneName(sceneName.trim())
    } else {
      setSceneName(scene.name)
    }
  }

  const handleAddCurrentKeyframe = () => {
    const segment = scene.segments[0]
    if (segment) {
      const position =
        scene.keyframes.length > 0
          ? scene.keyframes[scene.keyframes.length - 1].position
          : segment.initialPosition
      addKeyframe(position, { x: 0, y: 0, z: 0 }, position.y + segment.dimensions.height + 10)
    }
  }

  const handleExport = (type: 'markdown' | 'risk' | 'scene') => {
    switch (type) {
      case 'markdown':
        downloadMarkdown(scene)
        break
      case 'risk':
        downloadRiskCSV(scene)
        break
      case 'scene':
        downloadSceneJSON(scene)
        break
    }
  }

  const handleSaveToLocal = () => {
    localStorageService.saveScene(scene)
    alert('场景已保存到本地存储')
  }

  return (
    <div className="w-80 bg-gray-800 h-full flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-gray-700">
        <input
          type="text"
          value={sceneName}
          onChange={(e) => setSceneName(e.target.value)}
          onBlur={handleNameBlur}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="方案名称"
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSaveToLocal}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm text-white transition-colors"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
          <button
            onClick={resetScene}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm text-white transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            重置
          </button>
        </div>
      </div>

      <div className="flex-1">
        <CollapsibleSection
          title="数据导入"
          icon={<Database className="w-4 h-4 text-blue-400" />}
          defaultOpen={true}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">分段数据</span>
              <div className="flex gap-1">
                <button
                  onClick={() => downloadSampleCSV('segments')}
                  className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs text-gray-200"
                >
                  示例
                </button>
                <button
                  onClick={() => handleFileSelect('segments')}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  导入
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">障碍物数据</span>
              <div className="flex gap-1">
                <button
                  onClick={() => downloadSampleCSV('obstacles')}
                  className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs text-gray-200"
                >
                  示例
                </button>
                <button
                  onClick={() => handleFileSelect('obstacles')}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  导入
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">潮位窗口</span>
              <div className="flex gap-1">
                <button
                  onClick={() => downloadSampleCSV('tidal')}
                  className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs text-gray-200"
                >
                  示例
                </button>
                <button
                  onClick={() => handleFileSelect('tidal')}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  导入
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">吊车参数</span>
              <div className="flex gap-1">
                <button
                  onClick={() => downloadSampleCSV('crane')}
                  className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs text-gray-200"
                >
                  示例
                </button>
                <button
                  onClick={() => handleFileSelect('crane')}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  导入
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-600">
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div>分段: {scene.segments.length}</div>
              <div>障碍物: {scene.obstacles.length}</div>
              <div>潮位窗口: {scene.tidalWindows.length}</div>
              <div>关键帧: {scene.keyframes.length}</div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="碰撞检测"
          icon={
            <AlertTriangle
              className={`w-4 h-4 ${
                criticalCount > 0
                  ? 'text-red-400'
                  : warningCount > 0
                  ? 'text-orange-400'
                  : 'text-green-400'
              }`}
            />
          }
        >
          <button
            onClick={runCollisionCheck}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded text-sm text-white transition-colors mb-3"
          >
            <RefreshCw className="w-4 h-4" />
            运行检测
          </button>

          {scene.collisionResults.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  严重: {criticalCount}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                  警告: {warningCount}
                </span>
              </div>

              {scene.collisionResults.map((result) => (
                <div
                  key={result.id}
                  className="p-2 rounded text-xs"
                  style={{
                    backgroundColor:
                      result.severity === 'critical'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : result.severity === 'warning'
                        ? 'rgba(249, 115, 22, 0.2)'
                        : 'rgba(59, 130, 246, 0.2)',
                    borderLeft: `3px solid ${getSeverityColor(result.severity)}`
                  }}
                >
                  <div className="font-medium text-gray-200">
                    {getCollisionTypeName(result.type)}
                  </div>
                  <div className="text-gray-400 mt-1">{result.message}</div>
                  {result.recommendedAction && (
                    <div className="text-blue-400 mt-1 flex items-start gap-1">
                      <Check className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {result.recommendedAction}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm py-4">
              点击上方按钮运行碰撞检测
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="关键帧控制"
          icon={<Play className="w-4 h-4 text-green-400" />}
        >
          <button
            onClick={handleAddCurrentKeyframe}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm text-white transition-colors mb-3"
          >
            <Plus className="w-4 h-4" />
            添加关键帧
          </button>

          {scene.keyframes.length > 0 ? (
            <div className="space-y-2">
              {scene.keyframes.map((kf, index) => (
                <div
                  key={kf.id}
                  className={`p-2 rounded text-xs ${
                    index === scene.currentKeyframeIndex
                      ? 'bg-blue-600 bg-opacity-30 border border-blue-500'
                      : 'bg-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-200">
                      {kf.label || `关键帧 ${index + 1}`}
                    </span>
                    <span className="text-gray-400">
                      R: {kf.radius.toFixed(1)}m
                    </span>
                  </div>
                  <div className="text-gray-400 mt-1">
                    位置: ({kf.position.x.toFixed(1)}, {kf.position.y.toFixed(1)}, {kf.position.z.toFixed(1)})
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm py-4">
              暂无关键帧，点击上方按钮添加
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="导出方案"
          icon={<Download className="w-4 h-4 text-purple-400" />}
        >
          <div className="space-y-2">
            <button
              onClick={() => handleExport('markdown')}
              className="w-full flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm text-white transition-colors"
            >
              <FileText className="w-4 h-4" />
              导出 Markdown 方案
            </button>
            <button
              onClick={() => handleExport('risk')}
              className="w-full flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm text-white transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              导出 CSV 风险清单
            </button>
            <button
              onClick={() => handleExport('scene')}
              className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white transition-colors"
            >
              <Database className="w-4 h-4" />
              导出 JSON 场景包
            </button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="设置"
          icon={<Settings className="w-4 h-4 text-gray-400" />}
        >
          <div className="text-xs text-gray-400">
            <div className="mb-2">
              <span className="text-gray-200">吊车: </span>
              {scene.crane.name}
            </div>
            <div className="mb-2">
              <span className="text-gray-200">最大半径: </span>
              {scene.crane.maxRadius}m
            </div>
            <div className="mb-2">
              <span className="text-gray-200">最大起重量: </span>
              {scene.crane.maxLiftCapacity}t
            </div>
            <div className="mb-2">
              <span className="text-gray-200">创建时间: </span>
              {scene.createdAt.toLocaleString()}
            </div>
            <div>
              <span className="text-gray-200">更新时间: </span>
              {scene.updatedAt.toLocaleString()}
            </div>
          </div>
        </CollapsibleSection>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
