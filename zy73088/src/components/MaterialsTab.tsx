import { useState, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Upload,
  MessageSquare,
  AlertTriangle,
  Image as ImageIcon,
  Plus,
  History,
  Send,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useWorkbenchStore } from '@/store';
import type { MaterialReviewItem, CollisionPoint } from '@/shared/types';

const SEVERITY_STYLES: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  low: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const SEVERITY_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

function CollisionCard({
  collision,
  itemId,
}: {
  collision: CollisionPoint;
  itemId: string;
}) {
  const selectCollision = useWorkbenchStore((s) => s.selectCollision);
  const selectedId = useWorkbenchStore((s) => s.selectedCollisionId);
  const replaceScreenshot = useWorkbenchStore((s) => s.replaceScreenshot);
  const [appendOld, setAppendOld] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSelected = selectedId === collision.collision_id;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSubmitError('请选择图片文件');
      return;
    }
    setSubmitError('');
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
    };
    reader.onerror = () => {
      setSubmitError('图片读取失败');
    };
    reader.readAsDataURL(file);
  };

  const handleReplace = async () => {
    if (!imageUrl.trim() || uploading) return;
    setUploading(true);
    setSubmitError('');
    try {
      await replaceScreenshot(itemId, collision.collision_id, {
        image_url: imageUrl.trim(),
        append: appendOld,
      });
      setImageUrl('');
      setImgError(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: any) {
      setSubmitError(e?.message || '替换失败');
    } finally {
      setUploading(false);
    }
  };

  const hasScreenshot = collision.screenshot_path && !imgError;

  return (
    <div
      className={`rounded-lg border p-4 cursor-pointer transition-all ${
        isSelected
          ? 'bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10'
          : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'
      }`}
      onClick={() => selectCollision(collision.collision_id)}
    >
      <div className="flex gap-4">
        <div className="w-32 h-24 rounded-md overflow-hidden bg-slate-800 border border-slate-600 flex-shrink-0 relative">
          {hasScreenshot ? (
            <img
              src={collision.screenshot_path}
              alt={collision.description}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-500">
              {imgError ? (
                <>
                  <XCircle size={20} className="text-red-400" />
                  <span className="text-[10px] text-red-400">图片加载失败</span>
                </>
              ) : (
                <>
                  <ImageIcon size={20} />
                  <span className="text-[10px]">暂无截图</span>
                </>
              )}
            </div>
          )}
          {collision.historical_screenshots.length > 0 && (
            <div className="absolute bottom-1 left-1 bg-slate-900/80 text-slate-300 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
              <History size={10} />
              {collision.historical_screenshots.length}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="text-white text-sm font-medium">
                {collision.collision_id}
              </div>
              <div className="text-slate-400 text-xs mt-0.5">
                {collision.element_id}
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-xs border flex items-center gap-1 ${
                SEVERITY_STYLES[collision.severity]
              }`}
            >
              <AlertTriangle size={10} />
              {SEVERITY_LABELS[collision.severity]}
            </span>
          </div>
          <p className="text-slate-300 text-xs line-clamp-2 mb-2">
            {collision.description}
          </p>

          <div
            className="space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="截图 URL 或上传本地图片..."
                value={imageUrl.startsWith('data:image') ? '[本地图片] ' + imageUrl.length + ' bytes' : imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setSubmitError('');
                }}
                className="flex-1 bg-slate-800 border border-slate-600 text-white text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500 placeholder-slate-500 font-mono"
              />
              <label className="px-2 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded cursor-pointer flex items-center gap-1 transition-colors flex-shrink-0">
                <Upload size={12} />
                上传
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>
            </div>
            {submitError && (
              <div className="text-red-400 text-[10px] flex items-center gap-1">
                <XCircle size={10} />
                {submitError}
              </div>
            )}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={appendOld}
                  onChange={(e) => setAppendOld(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800"
                />
                追加旧版到历史
              </label>
              <button
                onClick={handleReplace}
                disabled={!imageUrl.trim() || uploading}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-xs rounded transition-colors flex items-center gap-1"
              >
                {uploading ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    替换中
                  </>
                ) : (
                  '替换截图'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MaterialRow({
  item,
  index,
}: {
  item: MaterialReviewItem;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const addRemark = useWorkbenchStore((s) => s.addRemark);
  const [newRemark, setNewRemark] = useState('');

  const isZebra = index % 2 === 1;

  const handleSaveRemark = () => {
    if (!newRemark.trim()) return;
    addRemark(item.item_id, newRemark.trim());
    setNewRemark('');
  };

  return (
    <div className={`border-b border-slate-700 ${isZebra ? 'bg-slate-800/30' : ''}`}>
      <div
        className="flex items-center px-4 py-3 cursor-pointer hover:bg-slate-700/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-6 text-slate-500 mr-2">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
        <div className="flex-1 grid grid-cols-7 gap-3 text-sm">
          <div className="text-white font-medium truncate">
            {item.material_name}
          </div>
          <div className="text-slate-400 truncate">{item.specification}</div>
          <div className="text-slate-400 truncate font-mono text-xs">
            {item.batch_no}
          </div>
          <div className="text-slate-300">
            {item.quantity}
            <span className="text-slate-500 text-xs ml-1">{item.unit}</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle size={12} className="text-red-400" />
            <span className="text-red-400 font-medium">
              {item.collision_points.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare size={12} className="text-blue-400" />
            <span className="text-blue-400 font-medium">{item.remarks.length}</span>
          </div>
          <div className="text-slate-500 text-xs">
            {new Date(item.created_at).toLocaleDateString('zh-CN')}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 bg-slate-900/20">
          <div className="pt-4">
            <div className="text-slate-400 text-xs font-medium mb-3 flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-red-400" />
              碰撞点 ({item.collision_points.length})
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {item.collision_points.map((col) => (
                <CollisionCard
                  key={col.collision_id}
                  collision={col}
                  itemId={item.item_id}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="text-slate-400 text-xs font-medium mb-3 flex items-center gap-1.5">
              <MessageSquare size={12} className="text-blue-400" />
              备注时间轴
            </div>
            <div className="relative pl-6 space-y-3">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-700" />
              {item.remarks.length === 0 ? (
                <div className="text-slate-500 text-xs italic">暂无备注</div>
              ) : (
                item.remarks.map((r, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-900" />
                    <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-blue-400 font-medium">
                          {r.operator}
                        </span>
                        <span className="text-slate-500">
                          {new Date(r.timestamp).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm">{r.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="补录备注内容..."
              value={newRemark}
              onChange={(e) => setNewRemark(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRemark()}
              className="flex-1 bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-blue-500 placeholder-slate-500"
            />
            <button
              onClick={handleSaveRemark}
              disabled={!newRemark.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Send size={14} />
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MaterialsTab() {
  const record = useWorkbenchStore((s) => s.record);
  const addMaterial = useWorkbenchStore((s) => s.addMaterial);

  const handleAddDemoMaterial = () => {
    addMaterial({
      material_name: '示例材料',
      specification: 'C30 标准',
      supplier: '示例供应商',
      batch_no: `BATCH-${Date.now().toString().slice(-6)}`,
      quantity: 100,
      unit: '㎡',
    });
  };

  if (!record) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800/50">
        <span className="text-xs text-slate-400">
          共 {record.materials.length} 条材料送审记录
        </span>
        <button
          onClick={handleAddDemoMaterial}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-md flex items-center gap-1 transition-colors"
        >
          <Plus size={12} />
          追加材料
        </button>
      </div>

      <div className="flex items-center px-4 py-2 bg-slate-800/30 border-b border-slate-700 text-xs text-slate-500 font-medium">
        <div className="w-8" />
        <div className="flex-1 grid grid-cols-7 gap-3">
          <span>名称</span>
          <span>规格</span>
          <span>批号</span>
          <span>数量</span>
          <span>碰撞点</span>
          <span>备注数</span>
          <span>创建时间</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {record.materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <MessageSquare size={48} className="mb-3 opacity-30" />
            <p>暂无材料送审记录</p>
          </div>
        ) : (
          record.materials.map((item, index) => (
            <MaterialRow key={item.item_id} item={item} index={index} />
          ))
        )}
      </div>
    </div>
  );
}
