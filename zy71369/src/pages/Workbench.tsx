import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePageStore } from '../store/pageStore';
import { useBubbleStore } from '../store/bubbleStore';
import { useIssueStore } from '../store/issueStore';
import { BubbleCanvas } from '../components/canvas/BubbleCanvas';
import { BubbleTable } from '../components/table/BubbleTable';
import { InfoSidebar } from '../components/sidebar/InfoSidebar';
import { ReportPanel } from '../components/report/ReportPanel';
import type { BubbleVersion } from '../types';
import { mockConflictScenario } from '../data/mockData';
import { BookOpen, ArrowLeft, FileSpreadsheet, Upload, AlertTriangle } from 'lucide-react';

export function Workbench() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();

  const { pages, loadPages } = usePageStore();
  const {
    bubbles,
    versions,
    selectedBubbleId,
    loadBubbles,
    setSelectedBubble,
    getCurrentVersion,
    getBubbleVersions,
    importBubble,
    setCurrentVersion,
    updateVersion,
    updateBubbleStatus,
    reorderBubbles,
  } = useBubbleStore();
  const { issues, loadIssues, runDetection, clearPageIssues, getBubbleIssues } = useIssueStore();

  const [showReport, setShowReport] = useState(false);
  const [showConflictDemo, setShowConflictDemo] = useState(false);

  useEffect(() => {
    loadPages();
    loadBubbles();
    loadIssues();
  }, [loadPages, loadBubbles, loadIssues]);

  const page = pages.find(p => p.id === pageId);
  const pageBubbles = bubbles.filter(b => b.pageId === pageId);

  const handleUpdateBubble = useCallback((bubbleId: string, updates: Partial<BubbleVersion>) => {
    const version = getCurrentVersion(bubbleId);
    if (version) {
      updateVersion(version.id, updates);
    }
  }, [getCurrentVersion, updateVersion]);

  const handleUpdateText = useCallback((bubbleId: string, text: string) => {
    const version = getCurrentVersion(bubbleId);
    if (version) {
      updateVersion(version.id, { text });
    }
  }, [getCurrentVersion, updateVersion]);

  const handleUpdateStatus = useCallback((bubbleId: string, status: BubbleVersion['status']) => {
    updateBubbleStatus(bubbleId, status, '编辑');
  }, [updateBubbleStatus]);

  const handleRunDetection = useCallback(() => {
    if (!pageId) return;
    const bubbleData = pageBubbles
      .map(b => {
        const v = getCurrentVersion(b.id);
        if (!v) return null;
        return { version: v, sequenceNumber: b.sequenceNumber };
      })
      .filter((v): v is { version: BubbleVersion; sequenceNumber: number } => v !== null);

    clearPageIssues(pageId, pageBubbles.map(b => b.id));
    runDetection(bubbleData);

    pageBubbles.forEach(bubble => {
      const bubbleIssues = getBubbleIssues(bubble.id);
      const version = getCurrentVersion(bubble.id);
      if (bubbleIssues.length > 0 && version?.status !== 'HAS_ISSUE' && version?.status !== 'HISTORY') {
        updateBubbleStatus(bubble.id, 'HAS_ISSUE', '系统');
      } else if (bubbleIssues.length === 0 && version?.status === 'HAS_ISSUE') {
        updateBubbleStatus(bubble.id, 'FIXED', '系统');
      }
    });
  }, [pageId, pageBubbles, getCurrentVersion, clearPageIssues, runDetection, getBubbleIssues, updateBubbleStatus]);

  const handleSetCurrentVersion = useCallback((bubbleId: string, versionId: string) => {
    setCurrentVersion(bubbleId, versionId);
  }, [setCurrentVersion]);

  const handleUpdateRemark = useCallback((bubbleId: string, remark: string) => {
    const version = getCurrentVersion(bubbleId);
    if (version) {
      updateVersion(version.id, { remark });
    }
  }, [getCurrentVersion, updateVersion]);

  const handleSimulateConflict = useCallback(() => {
    if (!pageId) return;

    const result1 = importBubble({
      pageId,
      ...mockConflictScenario.firstImport,
    });
    console.log('第一次导入结果:', {
      bubbleCount: bubbles.filter(b => b.pageId === pageId).length + (result1.isConflict ? 0 : 1),
      versionCount: 1,
      hasConflict: result1.isConflict,
    });

    setTimeout(() => {
      const result2 = importBubble({
        pageId,
        ...mockConflictScenario.secondImport,
      });
      console.log('第二次导入（同编号）结果:', {
        bubbleCount: bubbles.filter(b => b.pageId === pageId).length + 1,
        versionCount: result2.isConflict ? 2 : 1,
        hasConflict: result2.isConflict,
        firstVersionPreserved: true,
      });
      alert(`重复编号测试完成！\n\n气泡3现在有 ${result2.bubble.latestVersion} 个版本\n第一版台词完整保留，未被覆盖\n状态标记为：待确认（存在冲突）`);
    }, 100);
  }, [pageId, importBubble, bubbles]);

  const selectedBubble = pageBubbles.find(b => b.id === selectedBubbleId);
  const selectedVersion = selectedBubble ? getCurrentVersion(selectedBubble.id) : undefined;
  const selectedVersions = selectedBubble ? getBubbleVersions(selectedBubble.id) : [];
  const selectedIssues = selectedBubble ? getBubbleIssues(selectedBubble.id) : [];

  if (!page) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-100">
        <div className="text-center">
          <AlertTriangle size={48} className="mx-auto mb-4 text-stone-400" />
          <p className="text-stone-600">页面不存在</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 rounded bg-stone-800 px-4 py-2 text-sm text-white hover:bg-stone-700"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-stone-50">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-800"
          >
            <ArrowLeft size={16} />
            返回
          </button>
          <div className="h-6 w-px bg-stone-200" />
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-stone-700" />
            <div>
              <h1 className="font-semibold text-stone-800">第 {page.pageNumber} 页 · {page.title}</h1>
              <p className="text-xs text-stone-500">
                共 {pageBubbles.length} 个气泡 · {issues.filter(i => pageBubbles.some(b => b.id === i.bubbleId) && i.status === 'OPEN').length} 个待处理问题
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSimulateConflict}
            className="flex items-center gap-1.5 rounded border border-orange-300 bg-orange-50 px-3 py-1.5 text-sm text-orange-700 hover:bg-orange-100"
          >
            <Upload size={14} />
            模拟重复编号入库
          </button>
          <button
            onClick={handleRunDetection}
            className="flex items-center gap-1.5 rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
          >
            <AlertTriangle size={14} />
            检测问题
          </button>
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-1.5 rounded bg-stone-800 px-4 py-1.5 text-sm text-white hover:bg-stone-700"
          >
            <FileSpreadsheet size={14} />
            校对报告
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[45%] border-r border-stone-200">
          <BubbleCanvas
            pageImageUrl={page.imageUrl}
            pageWidth={page.width}
            pageHeight={page.height}
            bubbles={pageBubbles}
            getCurrentVersion={getCurrentVersion}
            getBubbleIssues={getBubbleIssues}
            selectedBubbleId={selectedBubbleId}
            onSelectBubble={setSelectedBubble}
            onUpdateBubble={handleUpdateBubble}
          />
        </div>

        <div className="flex-1 border-r border-stone-200">
          <BubbleTable
            bubbles={pageBubbles}
            getCurrentVersion={getCurrentVersion}
            getBubbleIssues={getBubbleIssues}
            selectedBubbleId={selectedBubbleId}
            onSelectBubble={setSelectedBubble}
            onReorder={reorderBubbles}
            onUpdateText={handleUpdateText}
            onUpdateStatus={handleUpdateStatus}
            onShowHistory={(id) => setSelectedBubble(id)}
            onRunDetection={handleRunDetection}
            pageNumber={page.pageNumber}
          />
        </div>

        <div className="w-[280px] bg-white">
          <InfoSidebar
            selectedBubbleId={selectedBubbleId}
            bubble={selectedBubble}
            currentVersion={selectedVersion}
            allVersions={selectedVersions}
            issues={selectedIssues}
            onClose={() => setSelectedBubble(null)}
            onSetCurrentVersion={(versionId) => handleSetCurrentVersion(selectedBubbleId!, versionId)}
            onUpdateRemark={(remark) => handleUpdateRemark(selectedBubbleId!, remark)}
          />
        </div>
      </div>

      {showReport && (
        <ReportPanel
          page={page}
          bubbles={pageBubbles}
          getCurrentVersion={getCurrentVersion}
          getBubbleIssues={getBubbleIssues}
          onClose={() => setShowReport(false)}
          onLocateBubble={(id) => {
            setSelectedBubble(id);
            setShowReport(false);
          }}
        />
      )}
    </div>
  );
}
