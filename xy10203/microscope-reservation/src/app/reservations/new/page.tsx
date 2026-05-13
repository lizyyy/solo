'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Microscope,
  Clock,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Search,
  X
} from 'lucide-react';
import { Microscope as MicroscopeType, Accessory, User, ResearchGroup, ConflictDetail } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { getAccessoryTypeLabel } from '@/lib/client-utils';

interface MicroscopeWithAccessories extends MicroscopeType {
  accessories: Accessory[];
}

export default function NewReservationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [microscopes, setMicroscopes] = useState<MicroscopeWithAccessories[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<ResearchGroup[]>([]);

  const [selectedMicroscope, setSelectedMicroscope] = useState<MicroscopeWithAccessories | null>(null);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');

  const [conflicts, setConflicts] = useState<ConflictDetail[]>([]);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadResources();
  }, []);

  async function loadResources() {
    setLoading(true);
    try {
      const [microscopesRes, resourcesRes] = await Promise.all([
        fetch('/api/resources?type=microscopes'),
        fetch('/api/resources')
      ]);

      const microscopesData = await microscopesRes.json();
      const resourcesData = await resourcesRes.json();

      setMicroscopes(microscopesData);
      setUsers(resourcesData.users || []);
      setGroups(resourcesData.groups || []);

      if (resourcesData.users?.length > 0) {
        setSelectedUser(resourcesData.users[0].id);
      }
      if (resourcesData.groups?.length > 0) {
        setSelectedGroup(resourcesData.groups[0].id);
      }
    } catch (error) {
      console.error('加载资源失败:', error);
      setError('加载资源失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  }

  const checkConflicts = useCallback(async () => {
    if (!selectedMicroscope || !startTime || !endTime) {
      return;
    }

    setCheckingConflict(true);
    setConflicts([]);

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check-conflict',
          microscopeId: selectedMicroscope.id,
          accessoryIds: selectedAccessories,
          startTime,
          endTime
        })
      });

      const result = await response.json();
      setConflicts(result.conflicts || []);
      setLastCheckTime(new Date().toLocaleTimeString('zh-CN'));
    } catch (error) {
      console.error('冲突检测失败:', error);
    } finally {
      setCheckingConflict(false);
    }
  }, [selectedMicroscope, selectedAccessories, startTime, endTime]);

  useEffect(() => {
    if (selectedMicroscope && startTime && endTime) {
      const timer = setTimeout(() => {
        checkConflicts();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [checkConflicts, selectedMicroscope, startTime, endTime]);

  function toggleAccessory(accessoryId: string) {
    setSelectedAccessories(prev => {
      if (prev.includes(accessoryId)) {
        return prev.filter(id => id !== accessoryId);
      } else {
        return [...prev, accessoryId];
      }
    });
  }

  function filteredUsers() {
    if (!selectedGroup) return users;
    return users.filter(u => u.group_id === selectedGroup);
  }

  function getAccessoryTypeColor(type: string) {
    switch (type) {
      case 'magnification': return 'bg-purple-100 text-purple-800';
      case 'sample_stage': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  async function handleSubmit() {
    if (!selectedMicroscope) {
      setError('请选择显微镜');
      return;
    }
    if (!selectedUser) {
      setError('请选择预约人');
      return;
    }
    if (!selectedGroup) {
      setError('请选择课题组');
      return;
    }
    if (!startTime || !endTime) {
      setError('请设置预约时间');
      return;
    }
    if (!purpose.trim()) {
      setError('请填写实验目的');
      return;
    }

    if (conflicts.length > 0) {
      setError('存在资源冲突，请调整预约时间或附件');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          microscopeId: selectedMicroscope.id,
          userId: selectedUser,
          groupId: selectedGroup,
          startTime,
          endTime,
          purpose: purpose.trim(),
          accessoryIds: selectedAccessories
        })
      });

      if (response.ok) {
        const reservation = await response.json();
        setToast({ type: 'success', message: '预约创建成功！已提交审批' });
        setTimeout(() => {
          router.push(`/reservations/${reservation.id}`);
        }, 1500);
      } else {
        const errorData = await response.json();
        if (errorData.errorType === 'ConflictError') {
          setConflicts(errorData.conflicts || []);
          setError(errorData.error);
        } else {
          setError(errorData.error || '创建预约失败');
        }
      }
    } catch (error) {
      console.error('提交失败:', error);
      setError('网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">正在加载资源...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`toast flex items-center p-4 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <AlertTriangle className="h-5 w-5 mr-2" />
            )}
            {toast.message}
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
              <ArrowLeft className="h-5 w-5 mr-2" />
              返回
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">新建预约</h1>
              <p className="text-sm text-gray-500">选择设备和附件，设置时间段，系统将自动检测冲突</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 font-medium">{error}</p>
                </div>
                <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <div className="flex items-center">
                  <Microscope className="h-5 w-5 text-blue-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">选择显微镜</h2>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {microscopes.map((scope) => (
                    <div
                      key={scope.id}
                      onClick={() => {
                        setSelectedMicroscope(scope);
                        setSelectedAccessories([]);
                      }}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedMicroscope?.id === scope.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{scope.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{scope.model}</p>
                          <p className="text-xs text-gray-400 mt-1">{scope.location}</p>
                          <div className="flex items-center mt-2 text-xs text-gray-500">
                            <span className="mr-3">{scope.accessories.filter(a => a.type === 'magnification').length} 个倍率模块</span>
                            <span>{scope.accessories.filter(a => a.type === 'sample_stage').length} 个样品台</span>
                          </div>
                        </div>
                        {selectedMicroscope?.id === scope.id && (
                          <CheckCircle className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selectedMicroscope && (
              <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Search className="h-5 w-5 text-blue-600 mr-2" />
                      <h2 className="text-lg font-semibold text-gray-900">选择附件</h2>
                    </div>
                    <span className="text-sm text-gray-500">
                      已选 {selectedAccessories.length} 个
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {['magnification', 'sample_stage'].map((type) => {
                      const accessories = selectedMicroscope.accessories.filter(a => a.type === type);
                      if (accessories.length === 0) return null;

                      return (
                        <div key={type}>
                          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium mr-2 ${getAccessoryTypeColor(type)}`}>
                              {getAccessoryTypeLabel(type)}
                            </span>
                            选择需要的{getAccessoryTypeLabel(type)}
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {accessories.map((acc) => (
                              <div
                                key={acc.id}
                                onClick={() => toggleAccessory(acc.id)}
                                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  selectedAccessories.includes(acc.id)
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-blue-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-900">{acc.name}</span>
                                  {selectedAccessories.includes(acc.id) && (
                                    <CheckCircle className="h-4 w-4 text-blue-600" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-blue-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">设置时间</h2>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">开始时间</label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">结束时间</label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      min={startTime}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                  <p>📌 预约规则：</p>
                  <ul className="mt-1 space-y-1 text-gray-500">
                    <li>• 单次预约最短 30 分钟，最长 24 小时</li>
                    <li>• 选择的显微镜和附件将在预约期间被锁定</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-blue-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">预约信息</h2>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">课题组</label>
                    <select
                      value={selectedGroup}
                      onChange={(e) => {
                        setSelectedGroup(e.target.value);
                        const filtered = users.filter(u => u.group_id === e.target.value);
                        if (filtered.length > 0 && !filtered.find(u => u.id === selectedUser)) {
                          setSelectedUser(filtered[0].id);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">请选择课题组</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">预约人</label>
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">请选择预约人</option>
                      {filteredUsers().map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">实验目的</label>
                  <textarea
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows={3}
                    placeholder="请简要描述实验目的，例如：观察细胞凋亡过程中的形态变化"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">{purpose.length} 字符</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border sticky top-6">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">冲突检测</h2>
                  {checkingConflict && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  )}
                </div>
                {lastCheckTime && (
                  <p className="text-xs text-gray-500 mt-1">上次检测：{lastCheckTime}</p>
                )}
              </div>
              <div className="p-6">
                {conflicts.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center text-red-600">
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      <span className="font-medium">发现 {conflicts.length} 个冲突</span>
                    </div>
                    <div className="space-y-3">
                      {conflicts.map((conflict, index) => (
                        <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              conflict.type === 'microscope' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                              {conflict.type === 'microscope' ? '显微镜' : '附件'}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-2">{conflict.resourceName}</p>
                          <p className="text-xs text-gray-600 mt-1">冲突预约：{conflict.conflictingReservationTitle}</p>
                          <p className="text-xs text-red-600 mt-1">
                            重叠时间：{formatDateTime(conflict.overlappingTime.start)} - {formatDateTime(conflict.overlappingTime.end)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : selectedMicroscope && startTime && endTime ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    <span className="font-medium">当前选择无冲突</span>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">选择显微镜和时间段后自动检测</p>
                )}
              </div>

              {selectedMicroscope && (
                <div className="p-6 border-t bg-gray-50">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">预约摘要</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">显微镜</span>
                      <span className="font-medium text-gray-900">{selectedMicroscope.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">附件数量</span>
                      <span className="font-medium text-gray-900">{selectedAccessories.length}</span>
                    </div>
                    {startTime && endTime && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">总时长</span>
                        <span className="font-medium text-gray-900">
                          {Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)} 分钟
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-6 border-t">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || conflicts.length > 0 || !selectedMicroscope}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    submitting || conflicts.length > 0 || !selectedMicroscope
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      提交中...
                    </span>
                  ) : conflicts.length > 0 ? (
                    '请先解决资源冲突'
                  ) : (
                    '提交预约申请'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
