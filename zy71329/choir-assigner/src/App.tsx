import { useState, useMemo } from 'react';
import { Upload, List, History, FileText, Home } from 'lucide-react';
import { DataImport } from './components/DataImport';
import { AssignmentResult } from './components/AssignmentResult';
import { HistoryPanel } from './components/HistoryPanel';
import { ReportPanel } from './components/ReportPanel';
import type { ImportData, Assignment, AdjustmentRecord, ConflictItem, ConflictType } from './types';
import { assignVoices, recalculateConflicts } from './utils/assignmentAlgorithm';

type TabType = 'import' | 'result' | 'history' | 'report';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('import');
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [globalConflicts, setGlobalConflicts] = useState<ConflictItem[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  const statistics = useMemo(() => {
    if (!importData) return null;

    const partsDistribution: Record<string, number> = {};
    importData.voiceParts.forEach(part => {
      partsDistribution[part.name] = assignments.filter(a => a.partId === part.id).length;
    });

    const conflictCount: Record<ConflictType, number> = {
      OVERCAPACITY: 0,
      UNDERCAPACITY: 0,
      VOICE_MISMATCH: 0,
      ABSENTEEISM: 0,
      PARTNER_SPLIT: 0,
      VETERAN_SHORTAGE: 0,
      MANUAL_OVERRIDE: 0,
    };

    [...globalConflicts, ...assignments.flatMap(a => a.conflicts)].forEach(conflict => {
      conflictCount[conflict.type]++;
    });

    const totalScore = assignments.reduce((sum, a) => sum + a.matchScore, 0);
    const averageMatchScore = assignments.length > 0 ? totalScore / assignments.length : 0;

    return {
      totalMembers: importData.members.length,
      assignedMembers: assignments.length,
      partsDistribution,
      averageMatchScore,
      conflictCount,
    };
  }, [assignments, globalConflicts, importData]);

  const handleDataLoaded = (data: ImportData) => {
    setIsCalculating(true);
    setImportData(data);
    
    setTimeout(() => {
      const result = assignVoices(data.members, data.voiceParts);
      setAssignments(result.assignments);
      setGlobalConflicts(result.conflicts);
      setAdjustments([]);
      setIsCalculating(false);
      setActiveTab('result');
    }, 500);
  };

  const handleReassign = (memberId: string, newPartId: string) => {
    if (!importData) return;

    const assignment = assignments.find(a => a.memberId === memberId);
    const newPart = importData.voiceParts.find(p => p.id === newPartId);
    const oldPart = importData.voiceParts.find(p => p.id === assignment?.partId);
    const member = importData.members.find(m => m.id === memberId);

    if (!assignment || !newPart || !oldPart || !member) return;

    const adjustmentRecord: AdjustmentRecord = {
      id: `adj_${Date.now()}`,
      timestamp: new Date(),
      memberId,
      memberName: member.name,
      oldPartId: oldPart.id,
      oldPartName: oldPart.displayName,
      newPartId: newPart.id,
      newPartName: newPart.displayName,
      reason: '手动调整',
      operator: '当前用户',
    };
    setAdjustments(prev => [adjustmentRecord, ...prev]);

    const updatedAssignments = assignments.map(a => {
      if (a.memberId === memberId) {
        return {
          ...a,
          partId: newPart.id,
          partName: newPart.name,
          isManual: true,
          adjustedAt: new Date(),
          adjustedBy: '当前用户',
        };
      }
      return a;
    });

    const { assignments: recalculatedAssignments, globalConflicts: newGlobalConflicts } = 
      recalculateConflicts(updatedAssignments, importData.voiceParts, importData.members);

    setAssignments(recalculatedAssignments);
    setGlobalConflicts(newGlobalConflicts);
  };

  const handleBackToImport = () => {
    setActiveTab('import');
    setImportData(null);
    setAssignments([]);
    setGlobalConflicts([]);
    setAdjustments([]);
  };

  const tabs = [
    { id: 'import' as TabType, label: '数据导入', icon: Upload },
    { id: 'result' as TabType, label: '分配结果', icon: List },
    { id: 'history' as TabType, label: '调整历史', icon: History },
    { id: 'report' as TabType, label: '导出报告', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {importData && (
        <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between h-16">
              <button
                onClick={handleBackToImport}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <Home className="w-5 h-5" />
                <span className="font-medium">合唱声部分配器</span>
              </button>
              
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isDisabled = tab.id !== 'import' && !importData;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => !isDisabled && setActiveTab(tab.id)}
                      disabled={isDisabled}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                        activeTab === tab.id
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : isDisabled
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                      {tab.id === 'result' && globalConflicts.length > 0 && (
                        <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                          {globalConflicts.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {importData?.songName && (
                <div className="text-sm text-gray-500">
                  {importData.songName}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isCalculating ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">正在进行智能分配...</p>
            <p className="text-gray-400 text-sm mt-1">根据音域、出勤和搭档关系计算最佳方案</p>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'import' && (
            <DataImport onDataLoaded={handleDataLoaded} />
          )}

          {activeTab === 'result' && importData && statistics && (
            <AssignmentResult
              assignments={assignments}
              globalConflicts={globalConflicts}
              members={importData.members}
              voiceParts={importData.voiceParts}
              statistics={statistics}
              songName={importData.songName}
              onReassign={handleReassign}
            />
          )}

          {activeTab === 'history' && (
            <HistoryPanel adjustments={adjustments} />
          )}

          {activeTab === 'report' && importData && statistics && (
            <ReportPanel
              members={importData.members}
              voiceParts={importData.voiceParts}
              assignments={assignments}
              adjustments={adjustments}
              globalConflicts={globalConflicts}
              songName={importData.songName}
              teacherNotes={importData.teacherNotes}
              statistics={statistics}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
