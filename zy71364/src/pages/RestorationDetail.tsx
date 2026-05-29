import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useStore } from "@/store/useStore";
import StatusBadge from "@/components/StatusBadge";
import StepsPanel from "@/components/StepsPanel";
import MaterialsPanel from "@/components/MaterialsPanel";
import PhotosPanel from "@/components/PhotosPanel";
import SignaturePanel from "@/components/SignaturePanel";
import { RESTORATION_STATUS_LABELS } from "../../shared/types";

const tabs = [
  { key: "steps", label: "修复步骤" },
  { key: "materials", label: "材料批次" },
  { key: "photos", label: "照片管理" },
  { key: "sign", label: "签名确认" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function RestorationDetail() {
  const { id } = useParams<{ id: string }>();
  const { restorations, fetchRestoration, fetchSteps, fetchMaterials, fetchPhotos, fetchSignatures, fetchAnomalies } = useStore();

  const [activeTab, setActiveTab] = useState<TabKey>("steps");

  const restoration = restorations.find((r) => r.id === id);

  useEffect(() => {
    if (id) {
      fetchRestoration(id);
      fetchSteps(id);
      fetchMaterials(id);
      fetchPhotos(id);
      fetchSignatures(id);
      fetchAnomalies(id);
    }
  }, [id, fetchRestoration, fetchSteps, fetchMaterials, fetchPhotos, fetchSignatures, fetchAnomalies]);

  if (!restoration) {
    return <div className="text-center py-20 text-primary-300">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="font-serif text-2xl font-bold text-primary-800">修复记录</h2>
              <StatusBadge status={restoration.status} />
            </div>
            <p className="text-sm text-primary-400">
              修复师：{restoration.restorerName}
            </p>
          </div>
          <Link
            to={`/artworks/${restoration.artworkId}`}
            className="text-amber hover:text-primary transition-colors text-sm font-medium"
          >
            返回作品 →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-primary-400">开始日期</p>
            <p className="text-primary-800 font-medium mt-0.5">
              {new Date(restoration.startDate).toLocaleDateString("zh-CN")}
            </p>
          </div>
          <div>
            <p className="text-primary-400">结束日期</p>
            <p className="text-primary-800 font-medium mt-0.5">
              {restoration.endDate ? new Date(restoration.endDate).toLocaleDateString("zh-CN") : "—"}
            </p>
          </div>
          <div>
            <p className="text-primary-400">创建时间</p>
            <p className="text-primary-800 font-medium mt-0.5">
              {new Date(restoration.createdAt).toLocaleDateString("zh-CN")}
            </p>
          </div>
          <div>
            <p className="text-primary-400">最近更新</p>
            <p className="text-primary-800 font-medium mt-0.5">
              {new Date(restoration.updatedAt).toLocaleDateString("zh-CN")}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-primary-100 px-6">
          <nav className="flex gap-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-amber text-primary-800"
                    : "border-transparent text-primary-400 hover:text-primary-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-6">
          {activeTab === "steps" && <StepsPanel restorationId={id!} />}
          {activeTab === "materials" && <MaterialsPanel restorationId={id!} />}
          {activeTab === "photos" && <PhotosPanel restorationId={id!} />}
          {activeTab === "sign" && <SignaturePanel restorationId={id!} />}
        </div>
      </div>
    </div>
  );
}
