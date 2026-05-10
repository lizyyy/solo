import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Phone, Mail, Calendar, AlertTriangle, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import api, { handleApiError } from '../api/client';
import { Member } from '../types';
import Modal from '../components/Modal';
import { ToastItem } from '../App';

interface MemberListProps {
  addToast: (message: string, type: ToastItem['type']) => void;
}

const MemberList: React.FC<MemberListProps> = ({ addToast }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/members');
      setMembers(response.data.data || []);
    } catch (err: any) {
      addToast(handleApiError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMember = async () => {
    if (!newMember.name || !newMember.phone) {
      addToast('姓名和手机号不能为空', 'warning');
      return;
    }

    try {
      const response = await api.post('/members', newMember);
      addToast(response.data.message || '会员创建成功', 'success');
      setShowCreateModal(false);
      setNewMember({ name: '', phone: '', email: '' });
      fetchMembers();
    } catch (err: any) {
      addToast(handleApiError(err), 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">会员管理</h1>
          <p className="text-gray-600 mt-1">管理会员信息、体测数据和训练计划</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          新增会员
        </button>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无会员</h3>
          <p className="text-gray-500 mb-6">点击右上角按钮添加第一个会员开始</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-5 h-5" />
            新增会员
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((member) => (
            <Link
              key={member.id}
              to={`/members/${member.id}`}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-indigo-600 font-bold text-lg">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{member.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Phone className="w-3 h-3" />
                      {member.phone}
                    </div>
                  </div>
                </div>
                {member.activeInjuries.length > 0 && (
                  <div className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    伤病
                  </div>
                )}
              </div>

              {member.email && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                  <Mail className="w-4 h-4" />
                  {member.email}
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <Calendar className="w-4 h-4" />
                入会：{format(new Date(member.joinDate), 'yyyy年MM月dd日', { locale: zhCN })}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm text-gray-600">剩余课时</span>
                  </div>
                  <span
                    className={`font-semibold ${
                      member.hasLowSessions ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {member.remainingSessions} 节
                  </span>
                </div>

                {member.latestMeasurement && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">最新体测</span>
                      <span className="text-gray-700">
                        {member.latestMeasurement.bmi
                          ? `BMI ${member.latestMeasurement.bmi}`
                          : '未测量'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {member.hasLowSessions && (
                <div className="mt-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                  课时不足，请注意提醒续课
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="新增会员"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newMember.name}
              onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="请输入姓名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              手机号 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={newMember.phone}
              onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="请输入手机号"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
            <input
              type="email"
              value={newMember.email}
              onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="请输入邮箱（可选）"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleCreateMember}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              创建
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MemberList;
