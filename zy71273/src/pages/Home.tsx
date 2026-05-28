import React, { useState, useEffect } from 'react';
import { ColorSpaceScene } from '../components/ColorSpace3D/ColorSpaceScene';
import { ArtworkDetail } from '../components/InfoPanel/ArtworkDetail';
import { ClassFilter } from '../components/FilterBar/ClassFilter';
import { ViewControls } from '../components/Toolbar/ViewControls';
import { ExportButton } from '../components/Toolbar/ExportButton';
import { QualityAlertPanel } from '../components/Alerts/QualityAlertPanel';
import { GlassCard } from '../components/common/GlassCard';
import { useArtworkStore } from '../store/useArtworkStore';
import { useFilteredArtworks } from '../hooks/useFilteredArtworks';
import { useClusters } from '../hooks/useClusters';
import { useSceneStore } from '../store/useSceneStore';

export default function Home() {
  const { selectedArtworkId, artworks, loadDemoData, selectArtwork, getArtworkAlerts } = useArtworkStore();
  const { settings } = useSceneStore();
  const { filteredArtworks, stats } = useFilteredArtworks();
  const { clusters, getClusterColor } = useClusters();

  useEffect(() => {
    loadDemoData();
  }, [loadDemoData]);

  const [showFilterPanel, setShowFilterPanel] = useState(true);
  const [showInfoPanel, setShowInfoPanel] = useState(true);

  const selectedArtwork = artworks.find((a) => a.id === selectedArtworkId);
  const selectedArtworkAlerts = selectedArtwork ? getArtworkAlerts(selectedArtwork.id) : [];

  return (
    <div id="main-container" className="w-full h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <GlassCard className="px-6 py-3">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                ✨ 美术色彩空间星图
              </h1>
              <p className="text-xs text-gray-400 mt-1">HSL 3D 数据可视化 · 评审专用</p>
            </GlassCard>

            <GlassCard className="px-4 py-2">
              <div className="text-sm">
                <span className="text-gray-400">显示作品：</span>
                <span className="text-cyan-400 font-bold ml-1">
                  {filteredArtworks.length}
                </span>
                <span className="text-gray-500 mx-2">/</span>
                <span className="text-gray-400">总计 {artworks.length}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                已选 {Object.keys(stats.byClass).length} 个班级
              </div>
            </GlassCard>
          </div>

          <div className="flex items-center gap-3">
            <ViewControls />
            <ExportButton />
          </div>
        </div>
      </div>

      {showFilterPanel && (
        <div className="absolute left-4 top-28 bottom-4 w-72 z-10 overflow-hidden">
          <GlassCard className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <span>🎯</span> 筛选控制
              </h2>
              <button
                onClick={() => setShowFilterPanel(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <QualityAlertPanel />
              <div className="mt-4">
                <ClassFilter />
              </div>

              {clusters.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <span>📊</span> 聚类分布
                  </h3>
                  <div className="space-y-2">
                    {clusters.map((cluster, idx) => (
                      <div
                        key={cluster.clusterId}
                        className="flex items-center justify-between p-2 rounded-lg bg-black/20"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: getClusterColor(cluster),
                              boxShadow: `0 0 8px ${getClusterColor(cluster)}`,
                            }}
                          />
                          <span className="text-sm text-gray-300">
                            {cluster.className || `聚类 ${idx + 1}`}
                          </span>
                        </div>
                        <span className="text-xs text-cyan-400 font-bold">
                          {cluster.members.length} 件
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {!showFilterPanel && (
        <button
          onClick={() => setShowFilterPanel(true)}
          className="absolute left-4 top-28 z-10"
        >
          <GlassCard className="p-3 hover:bg-white/10 transition-colors cursor-pointer">
            <span className="text-xl">🎯</span>
          </GlassCard>
        </button>
      )}

      <div className="absolute inset-0">
        <ColorSpaceScene
          artworks={filteredArtworks}
          selectedArtworkId={selectedArtworkId}
          onSelectArtwork={selectArtwork}
        />
      </div>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <GlassCard className="px-6 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">旋转：</span>
            <span className={settings.autoRotate ? 'text-green-400' : 'text-gray-500'}>
              {settings.autoRotate ? '开启' : '关闭'}
            </span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="text-sm text-gray-400">
            <span className="text-cyan-400">左键拖拽</span> 旋转 ·
            <span className="text-purple-400"> 滚轮</span> 缩放 ·
            <span className="text-pink-400"> 右键</span> 平移
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="text-sm text-gray-400">
            <span className="text-yellow-400">点击星点</span> 查看详情
          </div>
        </GlassCard>
      </div>

      {showInfoPanel && selectedArtwork && (
        <div className="absolute right-4 top-28 bottom-4 w-96 z-10 overflow-hidden">
          <ArtworkDetail
            artwork={selectedArtwork}
            alerts={selectedArtworkAlerts}
            onClose={() => selectArtwork(null)}
          />
        </div>
      )}

      {showInfoPanel && !selectedArtwork && (
        <div className="absolute right-4 top-28 z-10">
          <GlassCard className="p-6 w-80">
            <div className="text-center">
              <div className="text-4xl mb-3">🌟</div>
              <h3 className="font-bold text-white mb-2">选择作品</h3>
              <p className="text-sm text-gray-400">
                点击3D空间中的任意星点查看作品详情
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20">
                <span className="text-xl">🎨</span>
                <div>
                  <p className="text-sm font-medium text-white">色相环分布</p>
                  <p className="text-xs text-gray-500">360° 环绕球体</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20">
                <span className="text-xl">⬆️</span>
                <div>
                  <p className="text-sm font-medium text-white">明度层级</p>
                  <p className="text-xs text-gray-500">顶部亮、底部暗</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20">
                <span className="text-xl">💫</span>
                <div>
                  <p className="text-sm font-medium text-white">饱和度径向</p>
                  <p className="text-xs text-gray-500">中心灰、边缘艳</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowInfoPanel(false)}
              className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              收起面板
            </button>
          </GlassCard>
        </div>
      )}

      {!showInfoPanel && (
        <button
          onClick={() => setShowInfoPanel(true)}
          className="absolute right-4 top-28 z-10"
        >
          <GlassCard className="p-3 hover:bg-white/10 transition-colors cursor-pointer">
            <span className="text-xl">📋</span>
          </GlassCard>
        </button>
      )}
    </div>
  );
}
