import { useEffect, useRef, useCallback } from 'react'
import { Camera, Eye, RotateCcw } from 'lucide-react'
import { useClassroomStore } from '@/store'
import { generateSampleData } from '@/utils/sampleData'
import Skeleton3D from '@/components/Skeleton3D'
import Timeline from '@/components/Timeline'
import Layout from '@/components/Layout'

export default function ClassroomPage() {
  const {
    projectId,
    skeletonDefinition,
    appState,
    clips,
    keyframes,
    updateAppState,
    setProject,
    addClip,
    addKeyframe,
    getActiveClip,
    getCurrentFrame,
  } = useClassroomStore()

  const frameRef = useRef(0)

  useEffect(() => {
    if (!projectId || clips.length === 0) {
      const { clip, projectId: newProjectId } = generateSampleData()
      setProject(newProjectId, '人体动作关节角课堂 - 演示')
      addClip(clip)
      updateAppState({ activeClipId: clip.id })
    }
  }, [projectId, clips.length, setProject, addClip, updateAppState])

  const clip = getActiveClip()
  const currentFrame = getCurrentFrame()
  const clipKeyframes = keyframes.filter((k) => k.clipId === clip?.id)
  const keyframeIndices = clipKeyframes.map((k) => k.frameIndex)

  useEffect(() => {
    if (!appState.isPlaying || !clip) return
    const interval = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % clip.frames.length
      updateAppState({ currentFrame: frameRef.current })
    }, 1000 / 30)
    return () => clearInterval(interval)
  }, [appState.isPlaying, clip, updateAppState])

  const handleFrameChange = useCallback(
    (frame: number) => {
      frameRef.current = frame
      updateAppState({ currentFrame: frame })
    },
    [updateAppState]
  )

  const handlePlayToggle = useCallback(() => {
    updateAppState({ isPlaying: !appState.isPlaying })
  }, [appState.isPlaying, updateAppState])

  const handleAddKeyframe = useCallback(() => {
    if (!clip) return
    addKeyframe({
      id: `kf-${Date.now()}`,
      clipId: clip.id,
      frameIndex: frameRef.current,
      label: `关键帧 #${frameRef.current + 1}`,
      source: 'manual',
    })
  }, [clip, addKeyframe])

  const handleJointClick = useCallback(
    (jointName: string) => {
      const selected = appState.selectedJoints.includes(jointName)
        ? appState.selectedJoints.filter((j) => j !== jointName)
        : [...appState.selectedJoints, jointName]
      updateAppState({ selectedJoints: selected })
    },
    [appState.selectedJoints, updateAppState]
  )

  if (!clip || !currentFrame) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full text-gray-500">加载中...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <div className="flex-1 flex">
          <div className="flex-1 relative">
            <Skeleton3D
              joints={currentFrame.joints}
              bones={skeletonDefinition.bones}
              angleJoints={skeletonDefinition.angleJoints}
              angleResults={clip.angleResults}
              currentFrame={frameRef.current}
              selectedJoints={appState.selectedJoints}
              cameraPreset={appState.cameraPreset}
              onJointClick={handleJointClick}
            />
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <div className="bg-gray-800/80 backdrop-blur rounded-lg p-3 space-y-2">
                <div className="text-xs font-medium text-gray-400 mb-2">视角</div>
                {(['front', 'side', 'top', 'free'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => updateAppState({ cameraPreset: preset })}
                    className={`w-full px-3 py-1.5 rounded text-xs flex items-center gap-2 ${
                      appState.cameraPreset === preset
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {preset === 'front' && <Eye size={12} />}
                    {preset === 'side' && <Camera size={12} />}
                    {preset === 'top' && <RotateCcw size={12} />}
                    {preset === 'free' && '✋'}
                    <span>
                      {preset === 'front' ? '正面' : preset === 'side' ? '侧面' : preset === 'top' ? '俯视' : '自由'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="absolute top-4 left-4 bg-gray-800/80 backdrop-blur rounded-lg p-3 max-w-xs">
              <div className="text-xs font-medium text-gray-400 mb-1">关节角（°）</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {skeletonDefinition.angleJoints.map((def) => {
                  const result = clip.angleResults.find(
                    (r) => r.frameIndex === frameRef.current && r.jointName === def.name
                  )
                  return (
                    <div key={def.name} className="flex justify-between text-xs">
                      <span className={result?.isAnomaly ? 'text-red-400' : 'text-gray-400'}>{def.label}</span>
                      <span className={`font-mono ${result?.isAnomaly ? 'text-red-400' : 'text-gray-200'}`}>
                        {result?.angle.toFixed(1) ?? '-'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="w-80 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-300 mb-3">选中关节</h3>
            <div className="space-y-2 mb-6">
              {skeletonDefinition.angleJoints.map((def) => (
                <label key={def.name} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={appState.selectedJoints.includes(def.name)}
                    onChange={() => handleJointClick(def.name)}
                    className="rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-300">{def.label}</span>
                </label>
              ))}
            </div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">异常日志</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {clip.anomalyLog.length === 0 ? (
                <div className="text-xs text-gray-500">暂无异常</div>
              ) : (
                clip.anomalyLog.slice(0, 10).map((entry, i) => (
                  <div key={i} className="text-xs p-2 rounded bg-gray-800 border-l-2 border-orange-500">
                    <div className="text-gray-400">帧 #{entry.frameIndex + 1}</div>
                    <div className={entry.type === 'misconnect' ? 'text-teal-400' : 'text-orange-400'}>
                      {entry.detail}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <Timeline
          currentFrame={frameRef.current}
          totalFrames={clip.frames.length}
          isPlaying={appState.isPlaying}
          keyframeIndices={keyframeIndices}
          onFrameChange={handleFrameChange}
          onPlayToggle={handlePlayToggle}
          onAddKeyframe={handleAddKeyframe}
        />
      </div>
    </Layout>
  )
}
