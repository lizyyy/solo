import { useEffect, useState } from 'react';
import { Plus, LogOut, Users, FileText, History, Download, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import BillModal from '../components/BillModal';
import GroupModal from '../components/GroupModal';
import AddMemberModal from '../components/AddMemberModal';
import { Bill } from '../types';

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const {
    groups,
    selectedGroup,
    bills,
    members,
    statistics,
    auditLogs,
    loading,
    error,
    loadGroups,
    selectGroup,
    exportReport,
    clearError,
  } = useAppStore();

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleEditBill = (bill: Bill) => {
    setEditingBill(bill);
    setShowBillModal(true);
  };

  const handleCloseBillModal = () => {
    setShowBillModal(false);
    setEditingBill(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const getMemberName = (userId: string) => {
    const member = members.find((m) => m.id === userId);
    return member?.displayName || member?.username || userId;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create: '创建',
      update: '更新',
      delete: '删除',
      settle: '结算',
      join: '加入',
      leave: '离开',
      export: '导出',
    };
    return labels[action] || action;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">账单分摊系统</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                {user?.displayName || user?.username}
              </span>
              <button
                onClick={logout}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {error}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center">
                  <Users className="mr-2" size={18} />
                  分组
                </h2>
                <button
                  onClick={() => setShowGroupModal(true)}
                  className="p-1 text-indigo-600 hover:text-indigo-800"
                >
                  <Plus size={20} />
                </button>
              </div>
              <div className="space-y-2">
                {groups.length === 0 ? (
                  <p className="text-gray-500 text-sm">暂无分组，点击右上角创建</p>
                ) : (
                  groups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => selectGroup(group)}
                      className={`w-full text-left px-3 py-2 rounded-lg ${
                        selectedGroup?.id === group.id
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="font-medium truncate">{group.name}</div>
                      <div className="text-xs text-gray-500">
                        {group.members?.length || 0} 个成员
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="col-span-9">
            {selectedGroup ? (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {selectedGroup.name}
                      </h2>
                      {selectedGroup.description && (
                        <p className="text-gray-600 text-sm mt-1">
                          {selectedGroup.description}
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {selectedGroup.ownerId === user?.id && (
                        <button
                          onClick={() => setShowAddMemberModal(true)}
                          className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Plus size={16} className="mr-1" />
                          添加成员
                        </button>
                      )}
                      <button
                        onClick={() => exportReport(selectedGroup.id)}
                        className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Download size={16} className="mr-1" />
                        导出报告
                      </button>
                      <button
                        onClick={() => setShowBillModal(true)}
                        className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                      >
                        <Plus size={16} className="mr-1" />
                        新建账单
                      </button>
                    </div>
                  </div>
                </div>

                {statistics && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow p-4">
                      <div className="text-sm text-gray-500">总账单数</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {statistics.totalBills}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                      <div className="text-sm text-gray-500">已结算金额</div>
                      <div className="text-2xl font-bold text-green-600">
                        ¥{statistics.totalAmount.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                      <div className="text-sm text-gray-500">我已付款</div>
                      <div className="text-2xl font-bold text-blue-600">
                        ¥{statistics.myPaid.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                      <div className="text-sm text-gray-500">净余额</div>
                      <div
                        className={`text-2xl font-bold ${
                          statistics.netBalance >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {statistics.netBalance >= 0 ? '+' : ''}¥
                        {statistics.netBalance.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-lg shadow">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <FileText className="mr-2" size={18} />
                      账单列表
                    </h3>
                  </div>
                  {bills.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      暂无账单，点击"新建账单"开始记录
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {bills.map((bill) => (
                        <div
                          key={bill.id}
                          className="px-4 py-4 hover:bg-gray-50"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h4 className="font-medium text-gray-900">
                                  {bill.title}
                                </h4>
                                <span
                                  className={`px-2 py-0.5 text-xs rounded-full ${
                                    bill.status === 'settled'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {bill.status === 'settled' ? '已结算' : '待结算'}
                                </span>
                                <span className="text-xs text-gray-400">
                                  v{bill.version}
                                </span>
                              </div>
                              {bill.description && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {bill.description}
                                </p>
                              )}
                              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                                <span>日期: {formatDate(bill.date)}</span>
                                <span>
                                  付款人: {getMemberName(bill.paidByUserId)}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {bill.shares.map((share) => (
                                  <span
                                    key={share.id}
                                    className="text-xs bg-gray-100 px-2 py-1 rounded"
                                  >
                                    {getMemberName(share.userId)}: ¥
                                    {Number(share.amount).toFixed(2)}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-xl font-bold text-gray-900">
                                ¥{Number(bill.amount).toFixed(2)}
                              </div>
                              <div className="mt-2 space-x-1">
                                {bill.status !== 'settled' && (
                                  <>
                                    <button
                                      onClick={() => handleEditBill(bill)}
                                      className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                                    >
                                      编辑
                                    </button>
                                    <button
                                      onClick={() =>
                                        useAppStore.getState().settleBill(bill.id)
                                      }
                                      className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded"
                                    >
                                      结算
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg shadow">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <History className="mr-2" size={18} />
                      操作历史
                    </h3>
                  </div>
                  {auditLogs.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      暂无操作记录
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                      {auditLogs.slice(0, 20).map((log) => (
                        <div
                          key={log.id}
                          className="px-4 py-3 text-sm"
                        >
                          <div className="flex justify-between">
                            <span>
                              <span
                                className={`px-1.5 py-0.5 text-xs rounded mr-2 ${
                                  log.action === 'delete'
                                    ? 'bg-red-100 text-red-800'
                                    : log.action === 'create'
                                    ? 'bg-blue-100 text-blue-800'
                                    : log.action === 'settle'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {getActionLabel(log.action)}
                              </span>
                              {log.entityType === 'bill'
                                ? '账单'
                                : log.entityType === 'group'
                                ? '分组'
                                : log.entityType}
                            </span>
                            <span className="text-gray-400 text-xs">
                              {new Date(log.createdAt).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          {log.newValue?.title && (
                            <div className="text-gray-600 mt-1">
                              {log.newValue.title}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Users className="mx-auto text-gray-400" size={48} />
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  选择一个分组开始
                </h3>
                <p className="mt-2 text-gray-500">
                  从左侧选择一个分组，或创建新分组
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showGroupModal && (
        <GroupModal onClose={() => setShowGroupModal(false)} />
      )}

      {showAddMemberModal && selectedGroup && (
        <AddMemberModal
          groupId={selectedGroup.id}
          onClose={() => setShowAddMemberModal(false)}
        />
      )}

      {showBillModal && selectedGroup && (
        <BillModal
          groupId={selectedGroup.id}
          members={members}
          currentUserId={user?.id || ''}
          editingBill={editingBill}
          onClose={handleCloseBillModal}
        />
      )}

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center">
            <RefreshCw className="animate-spin mr-3" />
            <span>处理中...</span>
          </div>
        </div>
      )}
    </div>
  );
}
