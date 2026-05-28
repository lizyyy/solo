import { useEffect } from 'react'
import { StageScene } from '@/components/three/StageScene'
import { LeftPanel } from '@/components/ui/LeftPanel'
import { RightPanel } from '@/components/ui/RightPanel'
import { ControlBar } from '@/components/ui/ControlBar'
import { useProjectStore } from '@/store'
import { detectOcclusions, checkActorLighting } from '@/utils/collisionDetection'

export default function Home() {
  const {
    lights, props, actors, trajectories, playback, setOcclusionResults, setActorLightStatus,
  } = useProjectStore()

  useEffect(() => {
    const occlusions = detectOcclusions(lights, props)
    setOcclusionResults(occlusions)

    const lightStatus = checkActorLighting(actors, lights, trajectories, playback.currentTime)
    setActorLightStatus(lightStatus)
  }, [lights, props, actors, trajectories, playback.currentTime, setOcclusionResults, setActorLightStatus])

  const handleScreenshot = () => {
    const canvas = document.querySelector('canvas')
    if (canvas) {
      const link = document.createElement('a')
      link.download = `stage-preview-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0d0d1a] overflow-hidden">
      <header className="h-12 bg-[#1a1a2e] border-b border-[#2c2c3e] flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            舞台灯光锥预演
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-400">
            灯光: {lights.length} · 演员: {actors.length} · 道具: {props.length}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <LeftPanel />

        <div className="flex-1 relative">
          <StageScene />

          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <div className="bg-[#1a1a2e]/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-300">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                左键拖拽: 旋转视角
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                右键拖拽: 平移
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                滚轮: 缩放
              </div>
            </div>
          </div>

          <div className="absolute top-4 right-4">
            <div className="bg-[#1a1a2e]/80 backdrop-blur-sm rounded-lg px-3 py-2">
              <div className="text-xs text-gray-400 mb-1">时间</div>
              <div className="text-lg font-mono text-cyan-400">
                {Math.floor(playback.currentTime / 60)
                  .toString()
                  .padStart(2, '0')}
                :{Math.floor(playback.currentTime % 60)
                  .toString()
                  .padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>

        <RightPanel />
      </div>

      <ControlBar onScreenshot={handleScreenshot} />
    </div>
  )
}
