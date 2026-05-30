import { useState, useEffect } from 'react';
import { Camera, HelpCircle, Maximize2, Minimize2, Info } from 'lucide-react';
import { Scene } from '../components/3d/Scene';
import { ControlPanel } from '../components/ui/ControlPanel';
import { DetailPanel } from '../components/ui/DetailPanel';
import { ScreenshotModal } from '../components/ui/ScreenshotModal';
import { useAppStore } from '../store/useAppStore';
import type { SelectableObject, LightRay, Star, SimulationParameters } from '../types';

export default function Home() {
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    blackHole,
    lightRays,
    starField,
    viewpoints,
    qualityReport,
    visibility,
    selectedObject,
    parameters,
    cameraPosition,
    cameraTarget,
    setBlackHoleMass,
    setRayCount,
    setObserverDistance,
    setStarDensity,
    setLensStrength,
    setVisibility,
    setSelectedObject,
    saveViewpoint,
    restoreViewpoint,
    deleteViewpoint,
    runQualityCheck,
    updateCamera,
    recalculateRays,
    regenerateStarField,
  } = useAppStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      runQualityCheck();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleParameterChange = (key: keyof SimulationParameters, value: number) => {
    switch (key) {
      case 'blackHoleMass':
        setBlackHoleMass(value);
        break;
      case 'rayCount':
        setRayCount(value);
        break;
      case 'observerDistance':
        setObserverDistance(value);
        break;
      case 'starDensity':
        setStarDensity(value);
        break;
      case 'lensStrength':
        setLensStrength(value);
        break;
      case 'showEventHorizon':
      case 'showPhotonSphere':
        useAppStore.setState(state => ({
          parameters: {
            ...state.parameters,
            [key]: value > 0.5,
          },
        }));
        break;
    }
  };

  const handleBlackHoleClick = () => {
    setSelectedObject(blackHole);
  };

  const handleRayClick = (ray: LightRay) => {
    setSelectedObject(ray);
  };

  const handleStarClick = (star: Star) => {
    setSelectedObject(star);
  };

  const handleAffectedClick = (id: string) => {
    const ray = lightRays.find(r => r.id === id);
    if (ray) {
      setSelectedObject(ray);
      return;
    }
    const star = starField.stars.find(s => s.id === id);
    if (star) {
      setSelectedObject(star);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a1a] overflow-hidden">
      <header className="h-14 bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-black" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-orange-400 font-['Orbitron'] tracking-wider leading-none">
              黑洞引力透镜教具
            </h1>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Black Hole Gravitational Lensing Simulator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-gray-800/50 rounded-lg text-xs text-gray-400">
            <Info className="w-3 h-3 mr-1" />
            <span>拖拽旋转 · 滚轮缩放 · 右键平移</span>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="帮助"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowScreenshot(true)}
            className="p-2 text-gray-400 hover:text-orange-400 hover:bg-gray-800 rounded-lg transition-colors"
            title="截图"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="全屏"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <ControlPanel
          parameters={parameters}
          visibility={visibility}
          viewpoints={viewpoints}
          blackHoleMass={blackHole.mass}
          onParameterChange={handleParameterChange}
          onVisibilityChange={setVisibility}
          onSaveViewpoint={saveViewpoint}
          onRestoreViewpoint={restoreViewpoint}
          onDeleteViewpoint={deleteViewpoint}
          onRecalculateRays={recalculateRays}
          onRegenerateStars={regenerateStarField}
          onRunQualityCheck={runQualityCheck}
          qualityStatus={qualityReport?.overallStatus || null}
        />

        <main className="flex-1 relative" id="main-canvas">
          <Scene
            blackHole={blackHole}
            lightRays={lightRays}
            starField={starField}
            visibility={visibility}
            showEventHorizon={parameters.showEventHorizon}
            showPhotonSphere={parameters.showPhotonSphere}
            onBlackHoleClick={handleBlackHoleClick}
            onRayClick={handleRayClick}
            onStarClick={handleStarClick}
            selectedObject={selectedObject}
            cameraPosition={cameraPosition}
            cameraTarget={cameraTarget}
            onCameraUpdate={updateCamera}
          />

          <div className="absolute bottom-4 left-4 flex flex-col gap-2">
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs">
              <div className="text-gray-400 mb-1">图例</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-blue-400" />
                  <span className="text-gray-300">正常偏折光线</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-yellow-400" />
                  <span className="text-gray-300">临界光线</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-red-400" />
                  <span className="text-gray-300">被捕获光线</span>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 right-4 bg-gray-900/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs font-mono">
            <div className="text-gray-400">相机位置</div>
            <div className="text-gray-300">
              ({cameraPosition.map(v => v.toFixed(1)).join(', ')})
            </div>
          </div>
        </main>

        <DetailPanel
          selectedObject={selectedObject}
          qualityReport={selectedObject ? null : qualityReport}
          onClose={() => setSelectedObject(null)}
          onAffectedClick={handleAffectedClick}
        />
      </div>

      <ScreenshotModal
        isOpen={showScreenshot}
        onClose={() => setShowScreenshot(false)}
        parameters={parameters}
        blackHoleMass={blackHole.mass}
        qualityStatus={qualityReport?.overallStatus || null}
      />

      {showHelp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-xl font-bold text-orange-400 font-['Orbitron'] mb-4">
              使用说明
            </h3>
            <div className="space-y-4 text-sm text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-1">3D场景操作</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>鼠标左键拖拽：旋转视角</li>
                  <li>鼠标滚轮：缩放</li>
                  <li>鼠标右键拖拽：平移</li>
                  <li>点击场景中的对象：查看详细信息</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">物理参数调节</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>黑洞质量：控制引力强度和史瓦西半径</li>
                  <li>光线数量：显示的光线路径条数</li>
                  <li>恒星密度：背景星场的密集程度</li>
                  <li>透镜强度：引力透镜效应的可视化强度</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">质量检查</h4>
                <p className="text-gray-400">
                  系统会自动检测尺度一致性、光线穿模和恒星遮挡问题，并给出人性化的解释说明。
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
