import { useState, useEffect, useCallback, useRef } from 'react';
import type { Building, Resident, SignRecord, CostScheme, PublicityComment, BuildingVersion, SignStatus, BusinessPhase } from './types';
import { BuildingApi, ResidentApi, SignRecordApi, VersionApi, CostSchemeApi, CommentApi, StatsApi, ExportApi, AppApi } from './api';
import { StatsPanel } from './components/StatsPanel';
import { BuildingList } from './components/BuildingList';
import { ResidentSignList } from './components/ResidentSignList';
import { VersionHistory } from './components/VersionHistory';
import { CostSchemeManager } from './components/CostSchemeManager';
import { PublicityComments } from './components/PublicityComments';
import { PhaseNavigator } from './components/PhaseNavigator';

function App() {
  const initialized = useRef(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [versions, setVersions] = useState<BuildingVersion[]>([]);
  const [costSchemes, setCostSchemes] = useState<CostScheme[]>([]);
  const [comments, setComments] = useState<PublicityComment[]>([]);
  const [signRecords, setSignRecords] = useState<SignRecord[]>([]);
  const [stats, setStats] = useState({ totalHouseholds: 0, signedCount: 0, agreeCount: 0, disagreeCount: 0, pendingCount: 0, agreeRate: 0, signedRate: 0, objectionCount: 0, unresolvedObjectionCount: 0 });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'signs' | 'versions' | 'scheme' | 'comments'>('signs');
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [newBuilding, setNewBuilding] = useState({ name: '', address: '', units: '1单元,2单元' });

  const refreshData = useCallback(async (buildingId?: string) => {
    setLoading(true);
    try {
      const buildingsRes = await BuildingApi.getAll();
      setBuildings(buildingsRes.data);
      
      const targetId = buildingId || selectedBuilding?.id;
      if (targetId) {
        const [residentsRes, versionsRes, schemesRes, commentsRes, statsRes, signsRes] = await Promise.all([
          ResidentApi.getByBuilding(targetId),
          VersionApi.getByBuilding(targetId),
          CostSchemeApi.getByBuilding(targetId),
          CommentApi.getByBuilding(targetId),
          StatsApi.getProgress(targetId),
          SignRecordApi.getByBuilding(targetId),
        ]);
        setResidents(residentsRes.data);
        setVersions(versionsRes.data);
        setCostSchemes(schemesRes.data);
        setComments(commentsRes.data);
        setStats(statsRes.data);
        setSignRecords(signsRes.data);
      }
    } catch (error) {
      console.error('数据加载失败:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedBuilding]);

  useEffect(() => {
    const init = async () => {
      if (!initialized.current) {
        setLoading(true);
        try {
          await AppApi.initializeDemo();
          const buildingsRes = await BuildingApi.getAll();
          setBuildings(buildingsRes.data);
          initialized.current = true;
        } catch (error) {
          console.error('初始化失败:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    init();
  }, []);

  const handleSelectBuilding = async (building: Building) => {
    setSelectedBuilding(building);
    await refreshData(building.id);
  };

  const handleAddBuilding = async () => {
    if (newBuilding.name.trim()) {
      setLoading(true);
      try {
        const buildingRes = await BuildingApi.create({
          name: newBuilding.name,
          address: newBuilding.address,
          totalHouseholds: 0,
          totalFloors: 6,
          units: newBuilding.units.split(',').map(u => u.trim()),
          currentPhase: 'preparation',
        });
        await VersionApi.create(buildingRes.data.id, '初始版本', '项目启动', '创建楼栋信息', '系统');
        await refreshData();
        setShowAddBuilding(false);
        setNewBuilding({ name: '', address: '', units: '1单元,2单元' });
      } catch (error) {
        console.error('创建楼栋失败:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSign = async (residentId: string, status: SignStatus, objectionReason?: string) => {
    if (!selectedBuilding) return;
    
    const currentVersion = versions.find(v => v.isEffective);
    if (!currentVersion) return;

    setLoading(true);
    try {
      await SignRecordApi.create({
        buildingId: selectedBuilding.id,
        residentId,
        versionId: currentVersion.id,
        status,
        signDate: new Date().toISOString(),
        objectionReason,
        objectionStatus: objectionReason ? 'pending' : undefined,
        handler: '当前用户',
        isDuplicate: false,
        isWithdrawnButCounted: false,
      });
      await refreshData();
    } catch (error) {
      console.error('签字失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (recordId: string, stillCounted: boolean = false) => {
    setLoading(true);
    try {
      await SignRecordApi.withdraw(recordId, '当前用户', stillCounted);
      await refreshData();
    } catch (error) {
      console.error('撤回失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateObjection = async (recordId: string, status: 'processing' | 'resolved' | 'rejected') => {
    setLoading(true);
    try {
      await SignRecordApi.updateObjectionStatus(recordId, status, '当前用户');
      await refreshData();
    } catch (error) {
      console.error('处理异议失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async (name: string, description: string, changeLog: string) => {
    if (!selectedBuilding) return;
    setLoading(true);
    try {
      await VersionApi.create(selectedBuilding.id, name, description, changeLog, '当前用户');
      const updated = await BuildingApi.getById(selectedBuilding.id);
      if (updated.data) setSelectedBuilding(updated.data);
      await refreshData();
    } catch (error) {
      console.error('创建版本失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScheme = async (scheme: Omit<CostScheme, 'id' | 'createdAt'>) => {
    setLoading(true);
    try {
      await CostSchemeApi.create(scheme);
      await refreshData();
    } catch (error) {
      console.error('保存方案失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchemeWithNewVersion = async (
    versionName: string,
    versionDesc: string,
    changeLog: string,
    scheme: Omit<CostScheme, 'id' | 'createdAt'>
  ) => {
    if (!selectedBuilding) return;
    setLoading(true);
    try {
      const newVersionRes = await VersionApi.create(
        selectedBuilding.id,
        versionName,
        versionDesc,
        changeLog,
        '当前用户'
      );
      
      await CostSchemeApi.create({
        ...scheme,
        versionId: newVersionRes.data.id,
      });
      
      const updated = await BuildingApi.getById(selectedBuilding.id);
      if (updated.data) setSelectedBuilding(updated.data);
      await refreshData();
    } catch (error) {
      console.error('创建版本和方案失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (content: string, commenter: string) => {
    if (!selectedBuilding) return;
    const currentVersion = versions.find(v => v.isEffective);
    if (!currentVersion) return;
    
    setLoading(true);
    try {
      await CommentApi.create({
        buildingId: selectedBuilding.id,
        versionId: currentVersion.id,
        content,
        commenter,
        isResolved: false,
      });
      await refreshData();
    } catch (error) {
      console.error('添加评论失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespondComment = async (commentId: string, response: string, responder: string) => {
    setLoading(true);
    try {
      await CommentApi.respond(commentId, response, responder);
      await refreshData();
    } catch (error) {
      console.error('回复评论失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvancePhase = async () => {
    if (!selectedBuilding) return;
    
    const phases: BusinessPhase[] = ['preparation', 'signing', 'publicity', 'implementation', 'completed'];
    const currentIndex = phases.indexOf(selectedBuilding.currentPhase);
    if (currentIndex < phases.length - 1) {
      const nextPhase = phases[currentIndex + 1];
      setLoading(true);
      try {
        const canAdvance = await StatsApi.canAdvancePhase(selectedBuilding.id, nextPhase);
        if (canAdvance.data.can) {
          await BuildingApi.update(selectedBuilding.id, { currentPhase: nextPhase });
          const updated = await BuildingApi.getById(selectedBuilding.id);
          if (updated.data) setSelectedBuilding(updated.data);
          await refreshData();
        } else {
          alert(`无法推进到下一阶段: ${canAdvance.data.reason}`);
        }
      } catch (error) {
        console.error('推进阶段失败:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExport = async () => {
    if (!selectedBuilding) return;
    setLoading(true);
    try {
      const exportRes = await ExportApi.exportData(selectedBuilding.id);
      const blob = new Blob([exportRes.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedBuilding.name}-电梯加装项目数据.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentVersion = versions.find(v => v.isEffective);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">🏢 老楼加装电梯签字管理台</h1>
              <p className="text-sm text-gray-500 mt-1">全流程版本管控，确保每一次签字都有据可查</p>
            </div>
            {selectedBuilding && (
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-sm flex items-center gap-2"
              >
                <span>📥</span>
                导出数据
              </button>
            )}
          </div>
        </div>
      </header>

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 flex items-center gap-3 shadow-lg">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-700 font-medium">加载中...</span>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <BuildingList
              buildings={buildings}
              onSelect={handleSelectBuilding}
              selectedId={selectedBuilding?.id}
              onAddBuilding={() => setShowAddBuilding(true)}
            />
          </div>

          <div className="lg:col-span-2 space-y-6">
            {!selectedBuilding ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <div className="text-6xl mb-4">🏠</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">选择一个楼栋开始管理</h2>
                <p className="text-gray-500">从左侧列表选择楼栋，或点击新增创建新的项目</p>
              </div>
            ) : (
              <>
                <StatsPanel stats={stats} currentPhase={selectedBuilding.currentPhase} />
                <PhaseNavigator
                  currentPhase={selectedBuilding.currentPhase}
                  onAdvance={handleAdvancePhase}
                  canAdvanceToNext={true}
                />

                <div className="bg-white rounded-xl shadow-sm">
                  <div className="flex border-b border-gray-200">
                    {[
                      { key: 'signs', label: '住户签字', icon: '📝' },
                      { key: 'versions', label: '版本历史', icon: '📋' },
                      { key: 'scheme', label: '费用方案', icon: '💰' },
                      { key: 'comments', label: '公示意见', icon: '💬' },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as 'signs' | 'versions' | 'scheme' | 'comments')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                          activeTab === tab.key
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        <span className="mr-1">{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-4">
                    {activeTab === 'signs' && currentVersion && (
                      <ResidentSignList
                        buildingId={selectedBuilding.id}
                        residents={residents}
                        currentVersion={currentVersion}
                        signRecords={signRecords}
                        onSign={handleSign}
                        onWithdraw={handleWithdraw}
                        onUpdateObjection={handleUpdateObjection}
                      />
                    )}
                    {activeTab === 'versions' && (
                      <VersionHistory
                        versions={versions}
                        onCreateVersion={handleCreateVersion}
                      />
                    )}
                    {activeTab === 'scheme' && currentVersion && (
                      <CostSchemeManager
                        schemes={costSchemes}
                        currentVersion={currentVersion}
                        buildingId={selectedBuilding.id}
                        hasScheme={!!costSchemes.find(s => s.versionId === currentVersion.id)}
                        onSave={handleSaveScheme}
                        onCreateNewVersion={handleSaveSchemeWithNewVersion}
                      />
                    )}
                    {activeTab === 'comments' && (
                      <PublicityComments
                        comments={comments}
                        onAddComment={handleAddComment}
                        onRespond={handleRespondComment}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {showAddBuilding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">新增楼栋</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">楼栋名称</label>
                <input
                  type="text"
                  value={newBuilding.name}
                  onChange={(e) => setNewBuilding({ ...newBuilding, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  placeholder="例如: 阳光花园3号楼"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">地址</label>
                <input
                  type="text"
                  value={newBuilding.address}
                  onChange={(e) => setNewBuilding({ ...newBuilding, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  placeholder="详细地址"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">单元列表 (逗号分隔)</label>
                <input
                  type="text"
                  value={newBuilding.units}
                  onChange={(e) => setNewBuilding({ ...newBuilding, units: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  placeholder="1单元,2单元,3单元"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddBuilding(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAddBuilding}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
