import { useState } from 'react';
import { ChevronLeft, ChevronRight, Building2, Car, Camera, RotateCcw, Eye, EyeOff, Upload, FileDown } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { mockGarages, mockVehicles, cameraPresets } from '../../data/mockGarages';
import { LABELS } from '../../utils/constants';
import { HeightChecker } from '../../engine/HeightChecker';
import { generateHeightReport, exportReportToPDF } from '../../utils/reportGenerator';

export function ControlPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    garage: true,
    vehicle: true,
    camera: true,
    display: true,
  });

  const {
    selectedGarage,
    selectedVehicle,
    setSelectedGarage,
    setSelectedVehicle,
    cameraPreset,
    setCameraPreset,
    showRiskMarkers,
    setShowRiskMarkers,
    showMeasurements,
    setShowMeasurements,
    setRiskPoints,
    setCurrentReport,
    resetAll,
  } = useAppStore();

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleRunCheck = () => {
    const checker = new HeightChecker(selectedGarage, selectedVehicle);
    const result = checker.runFullCheck();
    setRiskPoints(result.riskPoints);
    const report = generateHeightReport(selectedGarage, selectedVehicle, result);
    setCurrentReport(report);
  };

  const handleExportReport = () => {
    const checker = new HeightChecker(selectedGarage, selectedVehicle);
    const result = checker.runFullCheck();
    const report = generateHeightReport(selectedGarage, selectedVehicle, result);
    exportReportToPDF(report, selectedGarage.name, selectedVehicle.name);
  };

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
                  <span className="text-sm font-medium text-gray-700">车辆选择</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    expandedSections.vehicle ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {expandedSections.vehicle && (
                <div className="p-3 space-y-2">
                  {mockVehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      onClick={() => setSelectedVehicle(vehicle)}
                      className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                        selectedVehicle.id === vehicle.id
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
                      onClick={() => setCameraPreset(preset.id)}
                      className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                        cameraPreset === preset.id
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
                      onClick={() => setShowRiskMarkers(!showRiskMarkers)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        showRiskMarkers ? 'bg-red-500' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          showRiskMarkers ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-700">显示测量线</span>
                    <button
                      onClick={() => setShowMeasurements(!showMeasurements)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        showMeasurements ? 'bg-yellow-500' : 'bg-gray-300'
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
              )}
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
