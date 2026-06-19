import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { getBatchTypeName, formatDateTime, formatTemperature, detectTemperatureMixing } from "@/utils";
import type { TemperatureUnit } from "@/types";
import { FileText, Thermometer, Clock, User, ChevronRight, AlertTriangle, CheckCircle, Image as ImageIcon, Upload, X, Plus } from "lucide-react";

export default function InspectionNote() {
  const navigate = useNavigate();
  const { 
    currentBatchType, 
    inspectionNotes,
    addInspectionNote,
    getWorkPhotosByBatch,
    getNotesForPhoto,
    setCurrentStep
  } = useAppStore();

  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [inspectorName, setInspectorName] = useState("老岑");
  const [content, setContent] = useState("");
  const [temperature, setTemperature] = useState("");
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>("C");
  const [inspectionTime, setInspectionTime] = useState(new Date().toISOString().slice(0, 16));
  const [noteFileName, setNoteFileName] = useState("");
  const [notePreviewUrl, setNotePreviewUrl] = useState<string | null>(null);

  const batchPhotos = getWorkPhotosByBatch(currentBatchType);
  const selectedPhoto = batchPhotos.find(p => p.id === selectedPhotoId);
  const existingNotes = selectedPhotoId ? getNotesForPhoto(selectedPhotoId) : [];

  const { mixed, details: mixingDetails } = detectTemperatureMixing(
    selectedPhoto ? [selectedPhoto] : [],
    selectedPhotoId ? getNotesForPhoto(selectedPhotoId) : []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPhotoId || !inspectorName || !content || !inspectionTime) return;

    addInspectionNote({
      workPhotoId: selectedPhotoId,
      inspectorName,
      content,
      temperature: temperature ? parseFloat(temperature) : undefined,
      temperatureUnit: temperature ? temperatureUnit : undefined,
      inspectionTime: new Date(inspectionTime).toISOString(),
      noteImageUrl: notePreviewUrl || undefined
    });

    setContent("");
    setTemperature("");
    setTemperatureUnit("C");
    setInspectionTime(new Date().toISOString().slice(0, 16));
    setNoteFileName("");
    setNotePreviewUrl(null);
  };

  const handleNextStep = () => {
    setCurrentStep(3);
    navigate("/conflict");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">第二步：手写巡检备注补录</h2>
          <p className="text-sm text-slate-500 mt-1">维修师傅老岑补看手写巡检备注，系统自动检测温度单位混用</p>
        </div>
        <span className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded">
          {getBatchTypeName(currentBatchType)}
        </span>
      </div>

      {mixed && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-sm font-medium text-amber-800">检测到摄氏度/开尔文混用</p>
              <p className="text-xs text-amber-700 mt-1">
                {mixingDetails.join("；")}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ 系统不会自动归一化，已标记待复核，留给训练教练处理
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-medium text-slate-800 mb-3">选择工况记录</h3>
          {batchPhotos.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <FileText size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无记录，请先导入数据</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {batchPhotos.map((photo) => {
                const notes = getNotesForPhoto(photo.id);
                const hasMixing = detectTemperatureMixing([photo], notes).mixed;
                return (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhotoId(photo.id)}
                    className={`w-full text-left p-3 rounded transition-colors ${
                      selectedPhotoId === photo.id
                        ? "bg-[#0F4C81]/10 border border-[#0F4C81]"
                        : "bg-slate-50 border border-transparent hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{photo.deviceNo}</span>
                      <div className="flex items-center gap-1">
                        {hasMixing && (
                          <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                            单位混用
                          </span>
                        )}
                        {notes.length > 0 && (
                          <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-0.5">
                            <CheckCircle size={10} />
                            {notes.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{formatDateTime(photo.recordTime)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      溶氧 {photo.dissolvedOxygen}mg/L · {formatTemperature(photo.temperature, photo.temperatureUnit)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selectedPhoto ? (
            <>
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                <h3 className="text-sm font-medium text-slate-800 mb-3">工况照片信息</h3>
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-slate-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {selectedPhoto.imageUrl ? (
                      <img src={selectedPhoto.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={28} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-500">设备编号：</span>
                      <span className="font-medium">{selectedPhoto.deviceNo}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">溶氧值：</span>
                      <span className="font-medium">{selectedPhoto.dissolvedOxygen} mg/L</span>
                    </div>
                    <div>
                      <span className="text-slate-500">水温：</span>
                      <span className={`font-medium ${selectedPhoto.temperatureUnit === 'K' ? 'text-amber-600' : ''}`}>
                        {formatTemperature(selectedPhoto.temperature, selectedPhoto.temperatureUnit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">记录时间：</span>
                      <span className="font-medium">{formatDateTime(selectedPhoto.recordTime)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {existingNotes.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                  <h3 className="text-sm font-medium text-slate-800 mb-3">已有备注</h3>
                  <div className="space-y-3">
                    {existingNotes.map((note) => (
                      <div key={note.id} className="p-3 bg-slate-50 rounded border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700">{note.inspectorName}</span>
                          <span className="text-xs text-slate-500">{formatDateTime(note.inspectionTime)}</span>
                        </div>
                        <p className="text-sm text-slate-600">{note.content}</p>
                        {note.temperature !== undefined && (
                          <p className={`text-xs mt-2 ${note.temperatureUnit === 'K' ? 'text-amber-600' : 'text-slate-500'}`}>
                            备注温度：{formatTemperature(note.temperature, note.temperatureUnit!)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                <h3 className="text-sm font-medium text-slate-800 mb-3">添加巡检备注</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        <User size={14} className="inline mr-1" />
                        巡检人
                      </label>
                      <input
                        type="text"
                        value={inspectorName}
                        onChange={(e) => setInspectorName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        <Clock size={14} className="inline mr-1" />
                        巡检时间
                      </label>
                      <input
                        type="datetime-local"
                        value={inspectionTime}
                        onChange={(e) => setInspectionTime(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <FileText size={14} className="inline mr-1" />
                      备注内容
                    </label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={3}
                      placeholder="输入手写巡检备注内容..."
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81] resize-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <Thermometer size={14} className="inline mr-1" />
                      现场实测温度（选填）
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(e.target.value)}
                        placeholder="温度值"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
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
                      <Upload size={14} className="inline mr-1" />
                      备注照片（选填）
                    </label>
                    {notePreviewUrl ? (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded">
                        <img src={notePreviewUrl} alt="备注预览" className="w-16 h-16 object-cover rounded" />
                        <span className="text-sm text-slate-600 flex-1">{noteFileName}</span>
                        <button
                          type="button"
                          onClick={() => { setNotePreviewUrl(null); setNoteFileName(""); }}
                          className="text-red-500 hover:text-red-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="block w-full p-4 border-2 border-dashed border-slate-300 rounded text-center cursor-pointer hover:border-[#0F4C81] hover:bg-slate-50 transition-colors">
                        <Upload size={20} className="mx-auto text-slate-400 mb-1" />
                        <span className="text-sm text-slate-500">点击上传备注照片</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setNoteFileName(file.name);
                              setNotePreviewUrl(URL.createObjectURL(file));
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 text-sm bg-[#0F4C81] text-white rounded hover:bg-[#0a3a65] transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus size={16} />
                    添加备注
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
              <FileText size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">请从左侧选择一条工况记录</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          已录入备注：<span className="font-medium text-slate-700">{inspectionNotes.filter(n => batchPhotos.some(p => p.id === n.workPhotoId)).length}</span> 条
        </p>
        <button
          onClick={handleNextStep}
          className="px-6 py-2.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors flex items-center gap-1"
        >
          下一步：冲突处理
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
