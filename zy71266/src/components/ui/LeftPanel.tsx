import { useState, useRef } from 'react'
import { Upload, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight, Lightbulb, User, Box, Route } from 'lucide-react'
import { useProjectStore } from '@/store'
import { parseDataFile } from '@/utils/dataImporter'
import type { ValidationResult, ValidationSeverity } from '@/types'

export function LeftPanel() {
  const {
    validationResults,
    filters,
    setFilters,
    addLights,
    addActors,
    addProps,
    addTrajectories,
    setValidationResults,
    addImportedFile,
    importedFiles,
    lights,
    actors,
    props,
    trajectories,
    selectedElement,
    setSelectedElement,
  } = useProjectStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    validation: true,
    lights: true,
    actors: true,
    props: true,
    trajectories: true,
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        const parsed = parseDataFile(content, file.name)

        if (parsed.lights.length > 0) addLights(parsed.lights)
        if (parsed.actors.length > 0) addActors(parsed.actors)
        if (parsed.props.length > 0) addProps(parsed.props)
        if (parsed.trajectories.length > 0) addTrajectories(parsed.trajectories)

        setValidationResults([...validationResults, ...parsed.validations])
        addImportedFile(file.name)
      }
      reader.readAsText(file)
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const getSeverityIcon = (severity: ValidationSeverity) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />
      case 'info':
        return <Info className="w-4 h-4 text-blue-400" />
    }
  }

  const getSeverityColor = (severity: ValidationSeverity) => {
    switch (severity) {
      case 'error':
        return 'border-l-red-500 bg-red-500/10'
      case 'warning':
        return 'border-l-amber-500 bg-amber-500/10'
      case 'info':
        return 'border-l-blue-400 bg-blue-400/10'
    }
  }

  const errorCount = validationResults.filter((v) => v.severity === 'error').length
  const warningCount = validationResults.filter((v) => v.severity === 'warning').length

  return (
    <div className="w-80 bg-[#1a1a2e] border-r border-[#2c2c3e] flex flex-col h-full">
      <div className="p-4 border-b border-[#2c2c3e]">
        <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          数据导入
        </h2>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-cyan-400 bg-cyan-400/10' : 'border-[#4a4a5e] hover:border-[#6a6a7e]'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-400">拖拽文件到此处</p>
          <p className="text-xs text-gray-500 mt-1">或点击选择文件</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".json,.txt,.csv"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
        </div>
        {importedFiles.length > 0 && (
          <div className="mt-3 text-xs text-gray-400">
            已导入: {importedFiles.join(', ')}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-[#2c2c3e]">
          <button
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#252540] text-left"
            onClick={() => toggleSection('validation')}
          >
            <div className="flex items-center gap-2">
              {expandedSections.validation ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-sm font-medium text-white">检测报告</span>
              {errorCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                  {errorCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                  {warningCount}
                </span>
              )}
            </div>
          </button>
          {expandedSections.validation && validationResults.length > 0 && (
            <div className="px-4 pb-3 space-y-2 max-h-48 overflow-y-auto">
              {validationResults.slice(0, 10).map((result) => (
                <div
                  key={result.id}
                  className={`p-2 rounded border-l-2 text-xs ${getSeverityColor(result.severity)}`}
                >
                  <div className="flex items-start gap-2">
                    {getSeverityIcon(result.severity)}
                    <span className="text-gray-300 flex-1">{result.message}</span>
                  </div>
                  {result.sourceFile && (
                    <div className="mt-1 text-gray-500">
                      {result.sourceFile}
                      {result.sourceLine && `: 第 ${result.sourceLine} 行`}
                    </div>
                  )}
                </div>
              ))}
              {validationResults.length > 10 && (
                <div className="text-xs text-gray-500 text-center">
                  还有 {validationResults.length - 10} 条...
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-b border-[#2c2c3e]">
          <button
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#252540] text-left"
            onClick={() => toggleSection('lights')}
          >
            <div className="flex items-center gap-2">
              {expandedSections.lights ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-white">灯光 ({lights.length})</span>
            </div>
            <input
              type="checkbox"
              checked={filters.lights}
              onChange={(e) => setFilters({ lights: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 bg-[#2c2c3e] text-cyan-500 focus:ring-cyan-500"
              onClick={(e) => e.stopPropagation()}
            />
          </button>
          {expandedSections.lights && (
            <div className="pb-2">
              {lights.map((light) => (
                <div
                  key={light.id}
                  className={`px-6 py-2 text-sm cursor-pointer hover:bg-[#252540] ${
                    selectedElement?.type === 'light' && selectedElement.id === light.id
                      ? 'bg-cyan-500/20'
                      : ''
                  }`}
                  onClick={() =>
                    setSelectedElement({
                      type: 'light',
                      id: light.id,
                    })
                  }
                >
                  <div className="text-gray-300">{light.name}</div>
                  <div className="text-xs text-gray-500">
                    {light.colorTemp}K · {light.angle}°
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-b border-[#2c2c3e]">
          <button
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#252540] text-left"
            onClick={() => toggleSection('actors')}
          >
            <div className="flex items-center gap-2">
              {expandedSections.actors ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <User className="w-4 h-4 text-pink-400" />
              <span className="text-sm font-medium text-white">演员 ({actors.length})</span>
            </div>
            <input
              type="checkbox"
              checked={filters.actors}
              onChange={(e) => setFilters({ actors: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 bg-[#2c2c3e] text-cyan-500 focus:ring-cyan-500"
              onClick={(e) => e.stopPropagation()}
            />
          </button>
          {expandedSections.actors && (
            <div className="pb-2">
              {actors.map((actor) => (
                <div
                  key={actor.id}
                  className={`px-6 py-2 text-sm cursor-pointer hover:bg-[#252540] ${
                    selectedElement?.type === 'actor' && selectedElement.id === actor.id
                      ? 'bg-cyan-500/20'
                      : ''
                  }`}
                  onClick={() =>
                    setSelectedElement({
                      type: 'actor',
                      id: actor.id,
                    })
                  }
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: actor.color }} />
                    <span className="text-gray-300">{actor.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 ml-5">{actor.height}m</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-b border-[#2c2c3e]">
          <button
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#252540] text-left"
            onClick={() => toggleSection('props')}
          >
            <div className="flex items-center gap-2">
              {expandedSections.props ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <Box className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">道具 ({props.length})</span>
            </div>
            <input
              type="checkbox"
              checked={filters.props}
              onChange={(e) => setFilters({ props: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 bg-[#2c2c3e] text-cyan-500 focus:ring-cyan-500"
              onClick={(e) => e.stopPropagation()}
            />
          </button>
          {expandedSections.props && (
            <div className="pb-2">
              {props.map((prop) => (
                <div
                  key={prop.id}
                  className={`px-6 py-2 text-sm cursor-pointer hover:bg-[#252540] ${
                    selectedElement?.type === 'prop' && selectedElement.id === prop.id
                      ? 'bg-cyan-500/20'
                      : ''
                  }`}
                  onClick={() =>
                    setSelectedElement({
                      type: 'prop',
                      id: prop.id,
                    })
                  }
                >
                  <div className="text-gray-300">{prop.name}</div>
                  <div className="text-xs text-gray-500">
                    {prop.type}
                    {prop.occluder && ' · 遮挡物'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <button
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#252540] text-left"
            onClick={() => toggleSection('trajectories')}
          >
            <div className="flex items-center gap-2">
              {expandedSections.trajectories ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <Route className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-white">轨迹 ({trajectories.length})</span>
            </div>
            <input
              type="checkbox"
              checked={filters.trajectories}
              onChange={(e) => setFilters({ trajectories: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 bg-[#2c2c3e] text-cyan-500 focus:ring-cyan-500"
              onClick={(e) => e.stopPropagation()}
            />
          </button>
          {expandedSections.trajectories && (
            <div className="pb-2">
              {trajectories.map((traj) => (
                <div
                  key={traj.id}
                  className={`px-6 py-2 text-sm cursor-pointer hover:bg-[#252540] ${
                    selectedElement?.type === 'trajectory' && selectedElement.id === traj.id
                      ? 'bg-cyan-500/20'
                      : ''
                  }`}
                  onClick={() =>
                    setSelectedElement({
                      type: 'trajectory',
                      id: traj.id,
                    })
                  }
                >
                  <div className="text-gray-300">
                    {actors.find((a) => a.id === traj.actorId)?.name || traj.actorId || '轨迹'}
                  </div>
                  <div className="text-xs text-gray-500">{traj.waypoints?.length || 0} 个路径点</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
