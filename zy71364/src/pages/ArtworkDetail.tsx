import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Edit, Plus } from "lucide-react";
import { useStore } from "@/store/useStore";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";
import type { Artwork, Restoration } from "../../shared/types";

export default function ArtworkDetail() {
  const { id } = useParams<{ id: string }>();
  const {
    artworks,
    restorations,
    fetchArtwork,
    updateArtwork,
    fetchRestorations,
    createRestoration,
  } = useStore();

  const artwork = artworks.find((a) => a.id === id);

  const [showEdit, setShowEdit] = useState(false);
  const [showCreateRestoration, setShowCreateRestoration] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Artwork>>({});
  const [restorationForm, setRestorationForm] = useState({
    restorerName: "",
    startDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (id) {
      fetchArtwork(id);
      fetchRestorations();
    }
  }, [id, fetchArtwork, fetchRestorations]);

  useEffect(() => {
    if (artwork) {
      setEditForm({
        name: artwork.name,
        era: artwork.era,
        material: artwork.material,
        dimensions: artwork.dimensions,
        accessionNumber: artwork.accessionNumber,
        status: artwork.status,
      });
    }
  }, [artwork]);

  if (!artwork) {
    return <div className="text-center py-20 text-primary-300">加载中...</div>;
  }

  const artworkRestorations = restorations.filter((r) => r.artworkId === id);

  const handleEdit = async () => {
    if (!id) return;
    try {
      await updateArtwork(id, editForm);
      setShowEdit(false);
    } catch {}
  };

  const handleCreateRestoration = async () => {
    if (!id) return;
    try {
      await createRestoration({
        artworkId: id,
        restorerName: restorationForm.restorerName,
        startDate: restorationForm.startDate,
        status: "draft",
      });
      setShowCreateRestoration(false);
      setRestorationForm({ restorerName: "", startDate: new Date().toISOString().split("T")[0] });
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-serif text-2xl font-bold text-primary-800">{artwork.name}</h2>
          <button onClick={() => setShowEdit(true)} className="btn-secondary flex items-center gap-2">
            <Edit size={14} />
            编辑
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-primary-400">年代</p>
            <p className="text-primary-800 font-medium mt-0.5">{artwork.era}</p>
          </div>
          <div>
            <p className="text-primary-400">材质</p>
            <p className="text-primary-800 font-medium mt-0.5">{artwork.material}</p>
          </div>
          <div>
            <p className="text-primary-400">尺寸</p>
            <p className="text-primary-800 font-medium mt-0.5">{artwork.dimensions}</p>
          </div>
          <div>
            <p className="text-primary-400">馆藏编号</p>
            <p className="text-primary-800 font-medium mt-0.5">{artwork.accessionNumber}</p>
          </div>
          <div>
            <p className="text-primary-400">状态</p>
            <div className="mt-0.5"><StatusBadge status={artwork.status} /></div>
          </div>
          <div>
            <p className="text-primary-400">创建时间</p>
            <p className="text-primary-800 font-medium mt-0.5">
              {new Date(artwork.createdAt).toLocaleDateString("zh-CN")}
            </p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg font-semibold text-primary-800">修复记录</h3>
          <button
            onClick={() => setShowCreateRestoration(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            新建修复记录
          </button>
        </div>

        {artworkRestorations.length === 0 ? (
          <p className="text-sm text-primary-300 py-8 text-center">暂无修复记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100">
                  <th className="text-left py-3 px-4 text-primary-400 font-medium">修复师</th>
                  <th className="text-left py-3 px-4 text-primary-400 font-medium">开始日期</th>
                  <th className="text-left py-3 px-4 text-primary-400 font-medium">状态</th>
                  <th className="text-left py-3 px-4 text-primary-400 font-medium">更新时间</th>
                  <th className="text-left py-3 px-4 text-primary-400 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {artworkRestorations.map((r) => (
                  <tr key={r.id} className="border-b border-primary-50 hover:bg-ivory-200">
                    <td className="py-3 px-4 text-primary-800">{r.restorerName}</td>
                    <td className="py-3 px-4 text-primary-600">
                      {new Date(r.startDate).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                    <td className="py-3 px-4 text-primary-600">
                      {new Date(r.updatedAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        to={`/restorations/${r.id}`}
                        className="text-amber hover:text-primary transition-colors font-medium"
                      >
                        查看详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="编辑作品">
        <div className="space-y-4">
          <div>
            <label className="label-field">作品名称</label>
            <input type="text" value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">年代</label>
            <input type="text" value={editForm.era || ""} onChange={(e) => setEditForm({ ...editForm, era: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">材质</label>
            <input type="text" value={editForm.material || ""} onChange={(e) => setEditForm({ ...editForm, material: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">尺寸</label>
            <input type="text" value={editForm.dimensions || ""} onChange={(e) => setEditForm({ ...editForm, dimensions: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">状态</label>
            <select value={editForm.status || ""} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Artwork["status"] })} className="input-field">
              <option value="pending">待处理</option>
              <option value="in_progress">修复中</option>
              <option value="completed">已完成</option>
              <option value="archived">已归档</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowEdit(false)} className="btn-secondary">取消</button>
            <button onClick={handleEdit} className="btn-primary">保存</button>
          </div>
        </div>
      </Modal>

      <Modal open={showCreateRestoration} onClose={() => setShowCreateRestoration(false)} title="新建修复记录">
        <div className="space-y-4">
          <div>
            <label className="label-field">修复师姓名</label>
            <input
              type="text"
              value={restorationForm.restorerName}
              onChange={(e) => setRestorationForm({ ...restorationForm, restorerName: e.target.value })}
              className="input-field"
              placeholder="输入修复师姓名"
            />
          </div>
          <div>
            <label className="label-field">开始日期</label>
            <input
              type="date"
              value={restorationForm.startDate}
              onChange={(e) => setRestorationForm({ ...restorationForm, startDate: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreateRestoration(false)} className="btn-secondary">取消</button>
            <button onClick={handleCreateRestoration} className="btn-primary" disabled={!restorationForm.restorerName}>
              创建
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
