import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Plus,
  Trash2,
  Save,
  Image as ImageIcon,
  X,
  Music,
  DollarSign,
  FileText,
  Calendar,
} from 'lucide-react';
import { useAppStore } from '../store';
import { formatCurrency } from '../utils/helpers';

interface TrackForm {
  trackName: string;
  nameType: '现场名' | '版权名' | '未知';
  amount: string;
  remarks: string;
}

export default function ContractImport() {
  const navigate = useNavigate();
  const importContract = useAppStore((s) => s.importContract);

  const [contractNo, setContractNo] = useState('');
  const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0]);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackForm[]>([
    { trackName: '', nameType: '未知', amount: '', remarks: '' },
  ]);

  const totalAmount = tracks.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setScreenshotPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addTrack = () => {
    setTracks([...tracks, { trackName: '', nameType: '未知', amount: '', remarks: '' }]);
  };

  const removeTrack = (idx: number) => {
    if (tracks.length > 1) {
      setTracks(tracks.filter((_, i) => i !== idx));
    }
  };

  const updateTrack = (idx: number, field: keyof TrackForm, value: string) => {
    const newTracks = [...tracks];
    newTracks[idx] = { ...newTracks[idx], [field]: value };
    setTracks(newTracks);
  };

  const handleSubmit = () => {
    if (!contractNo.trim()) {
      alert('请填写合同号');
      return;
    }
    const validTracks = tracks.filter((t) => t.trackName.trim() && t.amount);
    if (validTracks.length === 0) {
      alert('请至少填写一首曲目');
      return;
    }

    importContract(
      {
        contractNo,
        contractDate,
        screenshotUrl: screenshotPreview || undefined,
        totalAmount,
      },
      validTracks.map((t) => ({
        trackName: t.trackName,
        nameType: t.nameType,
        amount: parseFloat(t.amount),
        remarks: t.remarks,
      }))
    );

    alert('合同导入成功！系统已自动检测可能的冲突。');
    navigate('/conflicts');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-600" />
          第一步：合同基本信息
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              合同号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={contractNo}
              onChange={(e) => setContractNo(e.target.value)}
              placeholder="例如：HT-2026-003"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              合同日期
            </label>
            <input
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4" />
            合同页截图
          </label>
          {screenshotPreview ? (
            <div className="relative inline-block">
              <img
                src={screenshotPreview}
                alt="合同截图预览"
                className="max-h-48 rounded-md border border-slate-200"
              />
              <button
                onClick={() => setScreenshotPreview(null)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-md cursor-pointer hover:bg-slate-50 transition-colors">
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
              <span className="text-sm text-slate-500">点击上传合同页截图</span>
              <span className="text-xs text-slate-400 mt-0.5">支持 JPG、PNG 格式</span>
              <input type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" />
            </label>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Music className="w-5 h-5 text-slate-600" />
            曲目明细
          </h3>
          <button
            onClick={addTrack}
            className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            添加曲目
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 font-medium text-slate-600 w-[30%]">曲目名称</th>
                <th className="text-left py-3 px-3 font-medium text-slate-600 w-[15%]">名称类型</th>
                <th className="text-left py-3 px-3 font-medium text-slate-600 w-[15%]">金额 (元)</th>
                <th className="text-left py-3 px-3 font-medium text-slate-600">备注</th>
                <th className="text-center py-3 px-3 font-medium text-slate-600 w-[8%]">操作</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={track.trackName}
                      onChange={(e) => updateTrack(idx, 'trackName', e.target.value)}
                      placeholder="输入曲目名称"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      value={track.nameType}
                      onChange={(e) => updateTrack(idx, 'nameType', e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
                    >
                      <option value="未知">未知</option>
                      <option value="现场名">现场名</option>
                      <option value="版权名">版权名</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="relative">
                      <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="number"
                        value={track.amount}
                        onChange={(e) => updateTrack(idx, 'amount', e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={track.remarks}
                      onChange={(e) => updateTrack(idx, 'remarks', e.target.value)}
                      placeholder="可选备注"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => removeTrack(idx)}
                      disabled={tracks.length === 1}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={2} className="py-3 px-3 text-sm font-medium text-slate-700 text-right">
                  合计：
                </td>
                <td className="py-3 px-3 text-sm font-bold text-slate-800">
                  {formatCurrency(totalAmount)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          className="px-5 py-2 bg-slate-800 text-white text-sm rounded-md hover:bg-slate-700 transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          提交导入
        </button>
      </div>
    </div>
  );
}
