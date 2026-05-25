import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { GarageScene } from '../scenes/GarageScene';
import { ControlPanel } from '../components/ControlPanel';
import { Timeline } from '../components/Timeline';
import { InfoPanel } from '../components/InfoPanel';
import { mockGarages, mockVehicles, cameraPresets } from '../data/mockGarages';
import { HeightChecker } from '../engine/HeightChecker';
import { generateHeightReport, exportReportToPDF } from '../utils/reportGenerator';
import { Unit } from '../types';
import { Building2, Camera, FileText, Settings, ChevronDown, Upload, Ruler, Eye, FileDown, RotateCcw, Move3D, Car } from 'lucide-react';

export default function Home() {
  const {
    selectedGarage,
    selectedVehicle,
    customVehicleHeight,
    customVehicleUnit,
    useCustomHeight,
    vehicleDragEnabled,
    riskPoints,
    cameraPreset,
    showRiskMarkers,
    showMeasurements,
    simulation,
    currentReport,
    togglePlay,
    setSelectedGarage,
    setSelectedVehicle,
    setCustomVehicleHeight,
    setCustomVehicleUnit,
    setUseCustomHeight,
    setVehicleDragEnabled,
    setCameraPreset,
    setShowRiskMarkers,
    setShowMeasurements,
    setCurrentReport,
    setRiskPoints,
    setProgress,
    resetAll,
    getEffectiveVehicle,
  } = useAppStore();

  const effectiveVehicle = getEffectiveVehicle();
  const [isMobile, setIsMobile] = useState(false);
  const [activeMobilePanel, setActiveMobilePanel] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMobilePanelToggle = (panel: string) => {
    setActiveMobilePanel(activeMobilePanel === panel ? null : panel);
  };

  const handleRunCheck = () => {
    const effectiveVeh = getEffectiveVehicle();
    const checker = new HeightChecker(selectedGarage, effectiveVeh);
    const result = checker.runFullCheck();
    setRiskPoints(result.riskPoints);
    const report = generateHeightReport(selectedGarage, effectiveVeh, result);
    setCurrentReport(report);
  };

  const handleExportReport = () => {
    const effectiveVeh = getEffectiveVehicle();
    const checker = new HeightChecker(selectedGarage, effectiveVeh);
    const result = checker.runFullCheck();
    const report = generateHeightReport(selectedGarage, effectiveVeh, result);
    exportReportToPDF(report, selectedGarage.name, effectiveVeh.name);
  };

  const handleHeightChange = (delta: number) => {
    const newHeight = Math.max(1, Math.min(5, customVehicleHeight + delta));
    setCustomVehicleHeight(Math.round(newHeight * 100) / 100);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          setSelectedGarage(data);
        } catch {
          alert('文件格式错误，请导入有效的JSON文件');
        }
      };
      reader.readAsText(file);
    }
  };

  const MobilePanel = ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div className="absolute bottom-24 left-2 right-2 z-30 bg-gray-800 rounded-xl shadow-2xl overflow-hidden max-h-[60vh] flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h3 className="text-white font-medium">{title}</h3>
        <button
          onClick={() => setActiveMobilePanel(null)}
          className="p-1 text-gray-400 hover:text-white"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 relative">
      <div
        className={`absolute inset-0 transition-all duration-300 ${
          isMobile ? 'pb-0' : 'pb-16'
        }`}
      >
        <GarageScene
          garage={selectedGarage}
          riskPoints={riskPoints}
          cameraPreset={cameraPreset}
          showRiskMarkers={showRiskMarkers}
          showMeasurements={showMeasurements}
        />
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs sm:text-sm font-medium flex items-center gap-2 sm:gap-3">
          <span className="text-gray-300">{selectedGarage.name}</span>
          <span className="w-px h-4 bg-gray-600 hidden sm:block" />
          <span className="text-gray-300 hidden sm:block">{effectiveVehicle.name}</span>
          <span className="w-px h-4 bg-gray-600 hidden sm:block" />
          <span className="text-blue-300">
            车高: {effectiveVehicle.height}
            {effectiveVehicle.unit}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              simulation.isPlaying ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
            }`}
          />
        </div>
      </div>

      {!isMobile && (
        <>
          <ControlPanel />
          <InfoPanel />
          <Timeline />
        </>
      )}

      {isMobile && (
        <>
          {activeMobilePanel === 'garage' && (
            <MobilePanel title="车库设置">
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 border-2 border-dashed border-gray-600 rounded-lg text-sm text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  导入样例JSON
                </button>

                <div className="text-xs text-gray-500 font-medium">预设样例</div>
                {mockGarages.map((garage) => (
                  <button
                    key={garage.id}
                    onClick={() => {
                      setSelectedGarage(garage);
                      setActiveMobilePanel(null);
                    }}
                    className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                      selectedGarage.id === garage.id
                        ? 'bg-blue-900/50 border border-blue-500 text-blue-300'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <div className="font-medium flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {garage.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {garage.entrances.length}个入口 | {garage.ramps.length}条坡道
                    </div>
                  </button>
                ))}

                <div className="text-xs text-gray-500 font-medium mt-3">入口筛选</div>
                {selectedGarage.entrances.map((entrance) => (
                  <label
                    key={entrance.id}
                    className="flex items-center gap-2 p-2 bg-gray-700/50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="rounded text-blue-600"
                      defaultChecked
                    />
                    <span className="text-sm text-gray-300">{entrance.name}</span>
                    {!entrance.hasSign && (
                      <span className="text-xs px-1.5 py-0.5 bg-orange-900/50 text-orange-400 rounded">
                        无标识
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </MobilePanel>
          )}

          {activeMobilePanel === 'camera' && (
            <MobilePanel title="视角切换">
              <div className="grid grid-cols-2 gap-2">
                {cameraPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setCameraPreset(preset.id);
                      setActiveMobilePanel(null);
                    }}
                    className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                      cameraPreset === preset.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <Camera className="w-5 h-5 mx-auto mb-1" />
                    {preset.name}
                  </button>
                ))}
              </div>
            </MobilePanel>
          )}

          {activeMobilePanel === 'report' && (
            <MobilePanel title="检查报告">
              <div className="space-y-3">
                {currentReport ? (
                  <>
                    <div
                      className={`p-4 rounded-lg text-center ${
                        currentReport.overallResult === 'pass'
                          ? 'bg-green-900/30 border border-green-700'
                          : currentReport.overallResult === 'warning'
                          ? 'bg-orange-900/30 border border-orange-700'
                          : 'bg-red-900/30 border border-red-700'
                      }`}
                    >
                      <div
                        className={`text-2xl font-bold ${
                          currentReport.overallResult === 'pass'
                            ? 'text-green-400'
                            : currentReport.overallResult === 'warning'
                            ? 'text-orange-400'
                            : 'text-red-400'
                        }`}
                      >
                        {currentReport.overallResult === 'pass'
                          ? '✓ 通过'
                          : currentReport.overallResult === 'warning'
                          ? '⚠ 警告'
                          : '✗ 不通过'}
                      </div>
                    </div>

                    {currentReport.riskPoints.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 font-medium mb-2">风险点</div>
                        {currentReport.riskPoints.slice(0, 3).map((risk) => (
                          <div
                            key={risk.id}
                            className={`p-2 rounded mb-2 ${
                              risk.level === 'danger'
                                ? 'bg-red-900/30'
                                : 'bg-orange-900/30'
                            }`}
                          >
                            <div className="text-sm text-gray-300">{risk.location}</div>
                            <div className="text-xs text-gray-500">
                              净空: {risk.clearHeight.toFixed(2)}m | 间隙:{' '}
                              {risk.delta.toFixed(2)}m
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={handleExportReport}
                      className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                    >
                      <FileDown className="w-4 h-4" />
                      导出PDF报告
                    </button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">暂无检查报告</p>
                    <button
                      onClick={() => {
                        handleRunCheck();
                      }}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                    >
                      执行净高校验
                    </button>
                  </div>
                )}
              </div>
            </MobilePanel>
          )}

          {activeMobilePanel === 'settings' && (
            <MobilePanel title="设置">
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1">
                    <Car className="w-3 h-3" />
                    车辆选择
                  </div>
                  {mockVehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      onClick={() => setSelectedVehicle(vehicle)}
                      className={`w-full text-left p-2 rounded mb-1 text-sm transition-colors ${
                        selectedVehicle.id === vehicle.id && !useCustomHeight
                          ? 'bg-green-900/50 text-green-300'
                          : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {vehicle.name} - {vehicle.height}m
                    </button>
                  ))}
                </div>

                <div className="border-t border-gray-700 pt-3">
                  <label className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300 flex items-center gap-1">
                      <Ruler className="w-4 h-4" />
                      自定义高度
                    </span>
                    <button
                      onClick={() => setUseCustomHeight(!useCustomHeight)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        useCustomHeight ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          useCustomHeight ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>
                  {useCustomHeight && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleHeightChange(-0.1)}
                          className="p-2 bg-gray-700 rounded hover:bg-gray-600"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          value={customVehicleHeight}
                          onChange={(e) =>
                            setCustomVehicleHeight(parseFloat(e.target.value) || 0)
                          }
                          step="0.1"
                          min="1"
                          max="5"
                          className="flex-1 text-center py-1 bg-gray-700 rounded text-lg font-bold text-blue-400"
                        />
                        <button
                          onClick={() => handleHeightChange(0.1)}
                          className="p-2 bg-gray-700 rounded hover:bg-gray-600"
                        >
                          <ChevronDown className="w-4 h-4 rotate-180" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        {(['m', 'cm'] as Unit[]).map((unit) => (
                          <button
                            key={unit}
                            onClick={() => setCustomVehicleUnit(unit)}
                            className={`flex-1 py-1.5 text-xs font-medium rounded ${
                              customVehicleUnit === unit
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-gray-400'
                            }`}
                          >
                            {unit === 'm' ? '米' : '厘米'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-700 pt-3">
                  <label className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300 flex items-center gap-1">
                      <Move3D className="w-4 h-4" />
                      启用车辆拖拽
                    </span>
                    <button
                      onClick={() => setVehicleDragEnabled(!vehicleDragEnabled)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        vehicleDragEnabled ? 'bg-purple-500' : 'bg-gray-600'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          vehicleDragEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>
                </div>

                <div className="border-t border-gray-700 pt-3">
                  <div className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    显示选项
                  </div>
                  <label className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">显示风险标记</span>
                    <button
                      onClick={() => setShowRiskMarkers(!showRiskMarkers)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        showRiskMarkers ? 'bg-red-500' : 'bg-gray-600'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          showRiskMarkers ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">显示测量线</span>
                    <button
                      onClick={() => setShowMeasurements(!showMeasurements)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        showMeasurements ? 'bg-yellow-500' : 'bg-gray-600'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          showMeasurements ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>
                </div>

                <button
                  onClick={() => {
                    resetAll();
                    setActiveMobilePanel(null);
                  }}
                  className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  重置状态
                </button>
              </div>
            </MobilePanel>
          )}

          <div className="absolute bottom-0 left-0 right-0 z-20">
            <div className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 p-3">
              <div className="flex items-center justify-around mb-3">
                <button
                  onClick={() => handleMobilePanelToggle('garage')}
                  className={`flex flex-col items-center gap-1 ${
                    activeMobilePanel === 'garage' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      activeMobilePanel === 'garage' ? 'bg-blue-900/50' : 'bg-gray-800'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs">车库</span>
                </button>
                <button
                  onClick={() => handleMobilePanelToggle('camera')}
                  className={`flex flex-col items-center gap-1 ${
                    activeMobilePanel === 'camera' ? 'text-purple-400' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      activeMobilePanel === 'camera' ? 'bg-purple-900/50' : 'bg-gray-800'
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs">视角</span>
                </button>
                <button
                  onClick={togglePlay}
                  className={`flex flex-col items-center gap-1 ${
                    simulation.isPlaying ? 'text-blue-400' : 'text-green-400'
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center ${
                      simulation.isPlaying ? 'bg-blue-600' : 'bg-green-600'
                    }`}
                  >
                    {simulation.isPlaying ? (
                      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs">{simulation.isPlaying ? '暂停' : '播放'}</span>
                </button>
                <button
                  onClick={() => handleMobilePanelToggle('report')}
                  className={`flex flex-col items-center gap-1 ${
                    activeMobilePanel === 'report' ? 'text-green-400' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      activeMobilePanel === 'report' ? 'bg-green-900/50' : 'bg-gray-800'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-xs">报告</span>
                </button>
                <button
                  onClick={() => handleMobilePanelToggle('settings')}
                  className={`flex flex-col items-center gap-1 ${
                    activeMobilePanel === 'settings' ? 'text-orange-400' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      activeMobilePanel === 'settings' ? 'bg-orange-900/50' : 'bg-gray-800'
                    }`}
                  >
                    <Settings className="w-5 h-5" />
                  </div>
                  <span className="text-xs">设置</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.001"
                  value={simulation.progress}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  onChange={(e) => setProgress(parseFloat(e.target.value))}
                />
                <div
                  className="absolute top-0 left-0 h-2 bg-gradient-to-r from-blue-500 to-blue-400 rounded-lg pointer-events-none"
                  style={{ width: `${simulation.progress * 100}%` }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      <div className="absolute bottom-20 left-4 z-10 hidden md:block">
        <div className="bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-blue-500" />
            <span>鼠标拖拽: 旋转视角</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-green-500" />
            <span>滚轮: 缩放</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-yellow-500" />
            <span>双击: 重置视角</span>
          </div>
        </div>
      </div>
    </div>
  );
}
