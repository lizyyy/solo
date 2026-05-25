import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Building2, Car, Camera, RotateCcw, Eye, FileDown, Upload, Plus, Minus, Ruler, Filter, Move3D } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { mockGarages, mockVehicles, cameraPresets } from '../../data/mockGarages';
import { LABELS } from '../../utils/constants';
import { HeightChecker } from '../../engine/HeightChecker';
import { generateHeightReport, exportReportToPDF } from '../../utils/reportGenerator';
import { Garage, Unit } from '../../types';

export function ControlPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    garage: true,
    vehicle: true,
    camera: true,
    display: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    selectedGarage,
    selectedVehicle,
    customVehicleHeight,
    customVehicleUnit,
    useCustomHeight,
    filteredEntrances,
    vehicleDragEnabled,
    setSelectedGarage,
    setSelectedVehicle,
    setCustomVehicleHeight,
    setCustomVehicleUnit,
    setUseCustomHeight,
    setFilteredEntrances,
    setVehicleDragEnabled,
    setRiskPoints,
    setCurrentReport,
    resetAll,
    getEffectiveVehicle,
  } = useAppStore();

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleRunCheck = () => {
    const effectiveVehicle = getEffectiveVehicle();
    const checker = new HeightChecker(selectedGarage, effectiveVehicle);
    const result = checker.runFullCheck();
    setRiskPoints(result.riskPoints);
    const report = generateHeightReport(selectedGarage, effectiveVehicle, result);
    setCurrentReport(report);
  };

  const handleExportReport = () => {
    const effectiveVehicle = getEffectiveVehicle();
    const checker = new HeightChecker(selectedGarage, effectiveVehicle);
    const result = checker.runFullCheck();
    const report = generateHeightReport(selectedGarage, effectiveVehicle, result);
    exportReportToPDF(report, selectedGarage.name, effectiveVehicle.name);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as Garage;
          setSelectedGarage(data);
        } catch {
          alert('文件格式错误，请导入有效的JSON文件');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleHeightChange = (delta: number) => {
    const newHeight = Math.max(1, Math.min(5, customVehicleHeight + delta));
    setCustomVehicleHeight(Math.round(newHeight * 100) / 100);
  };

  const toggleEntranceFilter = (entranceId: string) => {
    if (filteredEntrances.includes(entranceId)) {
      setFilteredEntrances(filteredEntrances.filter((id) => id !== entranceId));
    } else {
      setFilteredEntrances([...filteredEntrances, entranceId]);
    }
  };

  const effectiveVehicle = getEffectiveVehicle();

  return (
    <div
      className={`fixed left-0 top-0 h-full z-20 transition-all duration-300 ${
        isOpen ? 'w-72' : 'w-12'
      }`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute right-0 top-4 translate-x-full bg-white shadow-lg rounded-r-lg p-2 hover:bg-gray-50 transition-colors z-10"
      >
        {isOpen ? (
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-600" />
        )}
      </button>

      {isOpen && (
        <div className="h-full bg-white shadow-xl overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h1 className="text-lg font-bold text-gray-800">净高检查系统</h1>
            <p className="text-xs text-gray-500 mt-1">停车库坡道净高检查工具</p>
          </div>

          <div className="p-4 space-y-4">
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('garage')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">车库选择</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    expandedSections.garage ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {expandedSections.garage && (
                <div className="p-3 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    导入样例JSON
                  </button>
                  <div className="text-xs text-gray-400 font-medium mt-2 mb-1">预设样例</div>
                  {mockGarages.map((garage) => (
                    <button
                      key={garage.id}
                      onClick={() => setSelectedGarage(garage)}
                      className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                        selectedGarage.id === garage.id
                          ? 'bg-blue-50 border border-blue-200 text-blue-700'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="font-medium">{garage.name}</div>
                      <div className="text-xs text-gray-500">
                        {garage.entrances.length}个入口 | {garage.ramps.length}条坡道
                      </div>
                    </button>
                  ))}

                  <div className="text-xs text-gray-400 font-medium mt-3 mb-1 flex items-center gap-1">
                    <Filter className="w-3 h-3" />
                    入口筛选
                  </div>
                  {selectedGarage.entrances.map((entrance) => (
                    <label
                      key={entrance.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={filteredEntrances.includes(entrance.id)}
                        onChange={() => toggleEntranceFilter(entrance.id)}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm text-gray-700">{entrance.name}</span>
                      {!entrance.hasSign && (
                        <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">
                          无标识
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('vehicle')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">车辆设置</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    expandedSections.vehicle ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {expandedSections.vehicle && (
                <div className="p-3 space-y-3">
                  {mockVehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      onClick={() => setSelectedVehicle(vehicle)}
                      className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                        selectedVehicle.id === vehicle.id && !useCustomHeight
                          ? 'bg-green-50 border border-green-200 text-green-700'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{vehicle.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-200">
                          {LABELS.VEHICLE_TYPE[vehicle.type]}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        高度: {vehicle.height}m | 宽度: {vehicle.width}m
                      </div>
                    </button>
                  ))}

                  <div className="border-t border-gray-200 pt-3">
                    <label className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Ruler className="w-4 h-4" />
                        自定义高度
                      </span>
                      <button
                        onClick={() => setUseCustomHeight(!useCustomHeight)}
                        className={`w-10 h-5 rounded-full transition-colors ${
                          useCustomHeight ? 'bg-green-500' : 'bg-gray-300'
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
                            className="p-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <div className="flex-1 text-center">
                            <input
                              type="number"
                              value={customVehicleHeight}
                              onChange={(e) => setCustomVehicleHeight(parseFloat(e.target.value) || 0)}
                              step="0.1"
                              min="1"
                              max="5"
                              className="w-full text-center text-lg font-bold text-blue-600 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
                            />
                          </div>
                          <button
                            onClick={() => handleHeightChange(0.1)}
                            className="p-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          {(['m', 'cm'] as Unit[]).map((unit) => (
                            <button
                              key={unit}
                              onClick={() => setCustomVehicleUnit(unit)}
                              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                                customVehicleUnit === unit
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {unit === 'm' ? '米 (m)' : '厘米 (cm)'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="flex items-center justify-between cursor-pointer pt-2">
                    <span className="text-sm text-gray-700 flex items-center gap-1">
                      <Move3D className="w-4 h-4" />
                      启用车辆拖拽
                    </span>
                    <button
                      onClick={() => setVehicleDragEnabled(!vehicleDragEnabled)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        vehicleDragEnabled ? 'bg-purple-500' : 'bg-gray-300'
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
              )}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('camera')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">视角切换</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    expandedSections.camera ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {expandedSections.camera && (
                <div className="p-3 grid grid-cols-2 gap-2">
                  {cameraPresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => useAppStore.getState().setCameraPreset(preset.id)}
                      className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                        useAppStore.getState().cameraPreset === preset.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('display')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">显示选项</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    expandedSections.display ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {expandedSections.display && (
                <div className="p-3 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-700">显示风险标记</span>
                    <button
                      onClick={() => useAppStore.getState().setShowRiskMarkers(!useAppStore.getState().showRiskMarkers)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        useAppStore.getState().showRiskMarkers ? 'bg-red-500' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          useAppStore.getState().showRiskMarkers ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-700">显示测量线</span>
                    <button
                      onClick={() => useAppStore.getState().setShowMeasurements(!useAppStore.getState().showMeasurements)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        useAppStore.getState().showMeasurements ? 'bg-yellow-500' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          useAppStore.getState().showMeasurements ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">当前配置</div>
              <div className="text-sm font-medium text-gray-800">{effectiveVehicle.name}</div>
              <div className="text-xs text-gray-600">
                车高: {effectiveVehicle.height} {effectiveVehicle.unit === 'm' ? '米' : '厘米'}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleRunCheck}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                执行净高校验
              </button>
              <button
                onClick={handleExportReport}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <FileDown className="w-4 h-4" />
                导出检查报告
              </button>
              <button
                onClick={resetAll}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                重置状态
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
