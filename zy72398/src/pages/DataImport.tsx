import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { getBatchTypeName, formatDateTime, formatTemperature } from "@/utils";
import type { BatchType, TemperatureUnit } from "@/types";
import { Upload, Plus, Image as ImageIcon, Thermometer, Droplets, Hash, Clock, ChevronRight, Trash2 } from "lucide-react";

export default function DataImport() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    currentBatchType, 
    setCurrentBatchType,
    addWorkPhoto, 
    getWorkPhotosByBatch,
    clearBatchData,
    setCurrentStep
  } = useAppStore();
  
  const [deviceNo, setDeviceNo] = useState("");
  const [dissolvedOxygen, setDissolvedOxygen] = useState("");
  const [temperature, setTemperature] = useState("");
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>("C");
  const [recordTime, setRecordTime] = useState(new Date().toISOString().slice(0, 16));
  const [selectedFileName, setSelectedFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const batchPhotos = getWorkPhotosByBatch(currentBatchType);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceNo || !dissolvedOxygen || !temperature || !recordTime) return;

    addWorkPhoto({
      batchType: currentBatchType,
      deviceNo,
      dissolvedOxygen: parseFloat(dissolvedOxygen),
      temperature: parseFloat(temperature),
      temperatureUnit,
      recordTime: new Date(recordTime).toISOString(),
      imageName: selectedFileName || undefined,
      imageUrl: previewUrl || undefined
    });

    setDeviceNo("");
    setDissolvedOxygen("");
    setTemperature("");
    setTemperatureUnit("C");
    setRecordTime(new Date().toISOString().slice(0, 16));
    setSelectedFileName("");
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleNextStep = () => {
    setCurrentStep(2);
    navigate("/inspection");
  };

  const handleClearBatch = () => {
    if (confirm(`确定清空${getBatchTypeName(currentBatchType)}的所有数据吗？`)) {
      clearBatchData(currentBatchType);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">第一步：工况照片导入</h2>
          <p className="text-sm text-slate-500 mt-1">上传工况照片，录入溶氧数据和温度信息</p>
        </div>
        <div className="flex gap-2">
          {(["normal", "wrong_caliber", "supplementary"] as BatchType[]).map((type) => (
            <button
              key={type}
              onClick={() => setCurrentBatchType(type)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                currentBatchType === type
                  ? "bg-[#0F4C81] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {getBatchTypeName(type)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-medium text-slate-800 mb-4">录入数据</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <ImageIcon size={14} className="inline mr-1" />
                工况照片
              </label>
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  previewUrl ? "border-[#0F4C81] bg-blue-50" : "border-slate-300 hover:border-[#0F4C81] hover:bg-slate-50"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                {previewUrl ? (
                  <div className="space-y-2">
                    <img src={previewUrl} alt="预览" className="max-h-32 mx-auto rounded" />
                    <p className="text-sm text-slate-600">{selectedFileName}</p>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewUrl(null);
                        setSelectedFileName("");
                      }}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      移除
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload size={32} className="mx-auto text-slate-400" />
                    <p className="text-sm text-slate-600">点击上传工况照片</p>
                    <p className="text-xs text-slate-400">支持 JPG、PNG 格式</p>
                  </div>
                )}
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileSelect}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <Hash size={14} className="inline mr-1" />
                  设备编号
                </label>
                <input
                  type="text"
                  value={deviceNo}
                  onChange={(e) => setDeviceNo(e.target.value)}
                  placeholder="如：DEV-001"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <Droplets size={14} className="inline mr-1" />
                  溶氧值 (mg/L)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={dissolvedOxygen}
                  onChange={(e) => setDissolvedOxygen(e.target.value)}
                  placeholder="如：6.5"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Thermometer size={14} className="inline mr-1" />
                水温
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="温度值"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
                  required
                />
                <select
                  value={temperatureUnit}
                  onChange={(e) => setTemperatureUnit(e.target.value as TemperatureUnit)}
                  className="px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
                >
                  <option value="C">摄氏度 (°C)</option>
                  <option value="K">开尔文 (K)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Clock size={14} className="inline mr-1" />
                记录时间
              </label>
              <input
                type="datetime-local"
                value={recordTime}
                onChange={(e) => setRecordTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 text-sm bg-[#0F4C81] text-white rounded hover:bg-[#0a3a65] transition-colors flex items-center justify-center gap-1"
              >
                <Plus size={16} />
                添加记录
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-slate-800">
              已录入记录 <span className="text-[#0F4C81]">({batchPhotos.length})</span>
            </h3>
            {batchPhotos.length > 0 && (
              <button
                onClick={handleClearBatch}
                className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 size={14} />
                清空批次
              </button>
            )}
          </div>
          
          {batchPhotos.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <ImageIcon size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无记录，请在左侧录入</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {batchPhotos.map((photo, index) => (
                <div 
                  key={photo.id} 
                  className="p-3 bg-slate-50 rounded border border-slate-100 hover:border-slate-200 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {photo.imageUrl ? (
                        <img src={photo.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={20} className="text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{photo.deviceNo}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">#{index + 1}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>溶氧: {photo.dissolvedOxygen} mg/L</span>
                        <span className={temperatureUnit === 'K' ? 'text-amber-600 font-medium' : ''}>
                          温度: {formatTemperature(photo.temperature, photo.temperatureUnit)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{formatDateTime(photo.recordTime)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          当前批次：<span className="font-medium text-slate-700">{getBatchTypeName(currentBatchType)}</span>
        </p>
        <button
          onClick={handleNextStep}
          disabled={batchPhotos.length === 0}
          className="px-6 py-2.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一步：巡检备注补录
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
