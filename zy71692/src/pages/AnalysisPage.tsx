import { useCallback, useEffect } from 'react'
import { Trash2, Flag } from 'lucide-react'
import { useClassroomStore } from '@/store'
import { generateSampleData } from '@/utils/sampleData'
import AngleChart from '@/components/AngleChart'
import Layout from '@/components/Layout'

export default function AnalysisPage() {
  const {
    projectId,
    skeletonDefinition,
    appState,
    clips,
    keyframes,
    comments,
    updateAppState,
    setProject,
    addClip,
    addKeyframe,
    removeKeyframe,
    removeComment,
    getActiveClip,
  } = useClassroomStore()

  useEffect(() => {
    if (!projectId || clips.length === 0) {
      const { clip, projectId: newProjectId } = generateSampleData()
      setProject(newProjectId, '人体动作关节角课堂 - 演示')
      addClip(clip)
      updateAppState({ activeClipId: clip.id })
    }
  }, [projectId, clips.length, setProject, addClip, updateAppState])

  const clip = getActiveClip()
  const clipKeyframes = keyframes.filter((k) => k.clipId === clip?.id).sort((a, b) => a.frameIndex - b.frameIndex)
  const clipComments = comments.filter((c) => c.clipId === clip?.id).sort((a, b) => a.frameIndex - b.frameIndex)

  const handleFrameClick = useCallback(
    (frame: number) => {
      updateAppState({ currentFrame: frame })
    },
    [updateAppState]
  )

  const handleAddKeyframe = useCallback(
    (frameIndex: number) => {
      if (!clip) return
      addKeyframe({
        id: `kf-${Date.now()}`,
        clipId: clip.id,
        frameIndex,
        label: `关键帧 #${frameIndex + 1}`,
        source: 'manual',
      })
    },
    [clip, addKeyframe]
  )

  if (!clip) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full text-gray-500">加载中...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="h-full p-6 overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-100 mb-6">角度分析</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-gray-300">关节角度时序曲线</h3>
                <div className="flex gap-2">
                  <span className="text-xs text-gray-500">跳变阈值</span>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={appState.jumpThreshold}
                    onChange={(e) => updateAppState({ jumpThreshold: Number(e.target.value) })}
                    className="w-16 px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200"
                  />
                  <span className="text-xs text-gray-500">°</span>
                </div>
              </div>
              <div className="h-64">
                <AngleChart
                  angleResults={clip.angleResults}
                  selectedJoints={appState.selectedJoints}
                  currentFrame={appState.currentFrame}
                  jumpThreshold={appState.jumpThreshold}
                  onFrameClick={handleFrameClick}
                />
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium text-gray-300">关键帧</h3>
              <span className="text-xs text-gray-500">{clipKeyframes.length} 个</span>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {clipKeyframes.length === 0 ? (
                <div className="text-xs text-gray-500">暂无关键帧</div>
              ) : (
                clipKeyframes.map((kf) => (
                  <div
                    key={kf.id}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                      appState.currentFrame === kf.frameIndex ? 'bg-teal-900/30' : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                    onClick={() => handleFrameClick(kf.frameIndex)}
                  >
                    <div className="flex items-center gap-2">
                      <Flag size={12} className={kf.source === 'auto' ? 'text-red-400' : 'text-orange-400'} />
                      <span className="text-sm text-gray-200">{kf.label}</span>
                      <span className="text-xs text-gray-500">帧 #{kf.frameIndex + 1}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeKeyframe(kf.id)
                      }}
                      className="p-1 text-gray-500 hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-4">角度统计</h3>
            <div className="space-y-3">
              {skeletonDefinition.angleJoints.map((def) => {
                const results = clip.angleResults.filter((r) => r.jointName === def.name)
                const angles = results.map((r) => r.angle)
                const anomalies = results.filter((r) => r.isAnomaly).length
                if (angles.length === 0) return null
                const min = Math.min(...angles)
                const max = Math.max(...angles)
                const avg = angles.reduce((s, v) => s + v, 0) / angles.length
                return (
                  <div key={def.name} className="p-3 rounded bg-gray-800">
                    <div className="text-sm font-medium text-gray-300 mb-2">{def.label}</div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <div className="text-gray-500">最小</div>
                        <div className="font-mono text-gray-200">{min.toFixed(1)}°</div>
                      </div>
                      <div>
                        <div className="text-gray-500">最大</div>
                        <div className="font-mono text-gray-200">{max.toFixed(1)}°</div>
                      </div>
                      <div>
                        <div className="text-gray-500">平均</div>
                        <div className="font-mono text-gray-200">{avg.toFixed(1)}°</div>
                      </div>
                      <div>
                        <div className="text-gray-500">异常</div>
                        <div className={`font-mono ${anomalies > 0 ? 'text-red-400' : 'text-gray-200'}`}>{anomalies}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="col-span-2">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-4">教师点评</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {clipComments.length === 0 ? (
                  <div className="text-xs text-gray-500">暂无点评</div>
                ) : (
                  clipComments.map((c) => (
                    <div key={c.id} className="flex justify-between items-start p-2 rounded bg-gray-800">
                      <div>
                        <span className="text-xs text-orange-400 font-mono">帧 #{c.frameIndex + 1}</span>
                        <p className="text-sm text-gray-300 mt-1">{c.content}</p>
                      </div>
                      <button
                        onClick={() => removeComment(c.id)}
                        className="p-1 text-gray-500 hover:text-red-400 shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
