import { useEffect, useState } from 'react';
import {
  Plane,
  Upload,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Battery,
  User,
  LayoutGrid,
  Box,
  SplitSquareVertical,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
} from 'lucide-react';
import { useRecordsStore } from '../store/useRecordsStore';
import { useUiStore } from '../store/useUiStore';
import { AirspaceScene } from '../components/three/AirspaceScene';
import { RecordList } from '../components/records/RecordList';
import { RecordDetail } from '../components/records/RecordDetail';
import { StatCard } from '../components/ui/StatCard';
import { ImportModal } from '../components/modals/ImportModal';
import { ExportModal } from '../components/modals/ExportModal';
import { IssueModal } from '../components/modals/IssueModal';
import { RouteModifyModal } from '../components/modals/RouteModifyModal';
import { cn } from '../lib/utils';

export default function Home() {
  const { initData, resetData, loading, error, getStats, selectedRecordId } = useRecordsStore();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const {
    currentUser,
    sidebarOpen,
    detailPanelOpen,
    viewMode,
    activeModal,
    toggleSidebar,
    setDetailPanelOpen,
    setViewMode,
    openModal,
  } = useUiStore();

  const stats = getStats();

  useEffect(() => {
    initData();
  }, [initData]);

  if (loading && !useRecordsStore.getState().initialized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">正在加载数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <p className="text-lg font-medium text-red-400">加载失败</p>
          <p className="text-sm mt-2 text-slate-400">{error}</p>
          <button
            onClick={resetData}
            className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            重置数据
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* 顶部导航栏 */}
      <header className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200"
          >
            {sidebarOpen ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold">赛事空域协同</h1>
              <p className="text-xs text-slate-500">本地版本 · IndexedDB</p>
            </div>
          </div>
        </div>

        {/* 视图切换 */}
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'p-2 rounded-md transition-colors',
              viewMode === 'list'
                ? 'bg-orange-500/20 text-orange-400'
                : 'text-slate-400 hover:text-slate-200'
            )}
            title="列表视图"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('3d')}
            className={cn(
              'p-2 rounded-md transition-colors',
              viewMode === '3d'
                ? 'bg-orange-500/20 text-orange-400'
                : 'text-slate-400 hover:text-slate-200'
            )}
            title="3D视图"
          >
            <Box className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={cn(
              'p-2 rounded-md transition-colors',
              viewMode === 'split'
                ? 'bg-orange-500/20 text-orange-400'
                : 'text-slate-400 hover:text-slate-200'
            )}
            title="分屏视图"
          >
            <SplitSquareVertical className="w-4 h-4" />
          </button>
        </div>

        {/* 操作按钮和用户 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
            title="重置数据"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => openModal('import')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>导入</span>
          </button>
          <button
            onClick={() => openModal('export')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>导出</span>
          </button>
          <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="text-sm">
              <p className="font-medium">{currentUser}</p>
              <p className="text-xs text-slate-500">在线</p>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧边栏 - 记录列表 */}
        <aside
          className={cn(
            'bg-slate-900/50 border-r border-slate-800 flex flex-col transition-all duration-300 flex-shrink-0',
            sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
          )}
        >
          {/* 统计卡片 */}
          <div className="p-4 border-b border-slate-800/50">
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                title="待复核"
                value={stats.pendingReview}
                icon={<Clock className="w-5 h-5" />}
                color="yellow"
              />
              <StatCard
                title="已复核"
                value={stats.reviewed}
                icon={<CheckCircle className="w-5 h-5" />}
                color="green"
              />
              <StatCard
                title="待处理"
                value={stats.pendingProcessing}
                icon={<AlertTriangle className="w-5 h-5" />}
                color="orange"
              />
              <StatCard
                title="待解决问题"
                value={stats.issues}
                icon={<FileText className="w-5 h-5" />}
                color="red"
              />
            </div>
            <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Battery className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-400">累计电池循环</span>
                </div>
                <span className="text-lg font-bold text-blue-300 font-mono">
                  {stats.totalBatteryCycles}
                </span>
              </div>
            </div>
          </div>

          {/* 记录列表 */}
          <div className="flex-1 overflow-hidden">
            <RecordList />
          </div>
        </aside>

        {/* 中间主区域 */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {viewMode !== '3d' && sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-slate-800/90 border border-slate-700 border-l-0 rounded-r-lg p-1 hover:bg-slate-700 transition-colors"
              title="收起侧边栏"
            >
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>
          )}
          {viewMode !== '3d' && !sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-slate-800/90 border border-slate-700 border-l-0 rounded-r-lg p-1 hover:bg-slate-700 transition-colors"
              title="展开侧边栏"
            >
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          )}

          {viewMode !== 'list' && detailPanelOpen && (
            <button
              onClick={() => setDetailPanelOpen(false)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-slate-800/90 border border-slate-700 border-r-0 rounded-l-lg p-1 hover:bg-slate-700 transition-colors"
              title="收起详情面板"
            >
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          )}
          {viewMode !== 'list' && !detailPanelOpen && selectedRecordId && (
            <button
              onClick={() => setDetailPanelOpen(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-slate-800/90 border border-slate-700 border-r-0 rounded-l-lg p-1 hover:bg-slate-700 transition-colors"
              title="展开详情面板"
            >
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>
          )}

          {/* 内容区域 */}
          <div className="flex-1 flex overflow-hidden">
            {/* 3D 场景或列表 */}
            <div
              className={cn(
                'relative bg-slate-950',
                viewMode === 'split' ? 'flex-1' : 'w-full'
              )}
            >
              {viewMode !== 'list' ? (
                <div className="absolute inset-0">
                  <AirspaceScene />
                  {/* 3D 场景提示 */}
                  <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-400 border border-slate-700/50">
                    <p>🖱️ 左键拖拽旋转 · 滚轮缩放 · 右键平移</p>
                  </div>
                </div>
              ) : (
                <div className="h-full p-6">
                  <div className="max-w-7xl mx-auto">
                    <RecordList />
                  </div>
                </div>
              )}
            </div>

            {/* 右侧详情面板 */}
            {viewMode !== '3d' && detailPanelOpen && selectedRecordId && (
              <div className="w-96 border-l border-slate-800 bg-slate-900/50 flex-shrink-0 overflow-hidden">
                <RecordDetail />
              </div>
            )}

            {viewMode !== '3d' && !selectedRecordId && detailPanelOpen && (
              <div className="w-96 border-l border-slate-800 bg-slate-900/50 flex-shrink-0 flex items-center justify-center">
                <div className="text-center text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>选择一条记录查看详情</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 弹窗 */}
      {activeModal === 'import' && <ImportModal />}
      {activeModal === 'export' && <ExportModal />}
      {activeModal === 'issue' && <IssueModal />}
      {activeModal === 'routeModify' && <RouteModifyModal />}

      {/* 重置确认弹窗 */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4 animate-fade-in">
            <h3 className="text-lg font-semibold text-slate-100 mb-2">确认重置数据</h3>
            <p className="text-slate-400 text-sm mb-6">
              此操作将清除所有本地数据并重新初始化示例数据。此操作不可撤销。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  await resetData();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
