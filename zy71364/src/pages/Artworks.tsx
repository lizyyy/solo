import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useStore } from "@/store/useStore";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";
import type { Artwork } from "../../shared/types";
import { ARTWORK_STATUS_LABELS } from "../../shared/types";

export default function Artworks() {
  const { artworks, fetchArtworks, createArtwork, loading } = useStore();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    era: "",
    material: "",
    dimensions: "",
    accessionNumber: "",
  });

  useEffect(() => {
    fetchArtworks({ status: statusFilter || undefined, keyword: keyword || undefined });
  }, [statusFilter, keyword, fetchArtworks]);

  const handleCreate = async () => {
    try {
      const artwork = await createArtwork(form);
      setShowCreate(false);
      setForm({ name: "", era: "", material: "", dimensions: "", accessionNumber: "" });
      navigate(`/artworks/${artwork.id}`);
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-bold text-primary-800">作品档案</h2>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          新建作品
        </button>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Search size={16} className="text-primary-300" />
            <input
              type="text"
              placeholder="搜索作品名称、编号..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="input-field max-w-xs"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-40"
          >
            <option value="">全部状态</option>
            {Object.entries(ARTWORK_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {artworks.length === 0 && !loading ? (
        <div className="card p-12 text-center">
          <p className="text-primary-300">暂无作品记录，点击"新建作品"添加</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {artworks.map((artwork) => (
            <Link
              key={artwork.id}
              to={`/artworks/${artwork.id}`}
              className="card p-5 hover:shadow-md hover:border-amber-200 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-serif text-base font-semibold text-primary-800 line-clamp-1">{artwork.name}</h3>
                <StatusBadge status={artwork.status} />
              </div>
              <div className="space-y-1.5 text-sm text-primary-500">
                <p>年代：{artwork.era}</p>
                <p>材质：{artwork.material}</p>
                <p>编号：{artwork.accessionNumber}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="新建作品">
        <div className="space-y-4">
          <div>
            <label className="label-field">作品名称</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="输入作品名称"
            />
          </div>
          <div>
            <label className="label-field">年代</label>
            <input
              type="text"
              value={form.era}
              onChange={(e) => setForm({ ...form, era: e.target.value })}
              className="input-field"
              placeholder="如：明代"
            />
          </div>
          <div>
            <label className="label-field">材质</label>
            <input
              type="text"
              value={form.material}
              onChange={(e) => setForm({ ...form, material: e.target.value })}
              className="input-field"
              placeholder="如：绢本设色"
            />
          </div>
          <div>
            <label className="label-field">尺寸</label>
            <input
              type="text"
              value={form.dimensions}
              onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
              className="input-field"
              placeholder="如：120×50cm"
            />
          </div>
          <div>
            <label className="label-field">馆藏编号</label>
            <input
              type="text"
              value={form.accessionNumber}
              onChange={(e) => setForm({ ...form, accessionNumber: e.target.value })}
              className="input-field"
              placeholder="如：ART-2024-001"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">取消</button>
            <button onClick={handleCreate} className="btn-primary" disabled={!form.name || !form.accessionNumber}>
              创建
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
