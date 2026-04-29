import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/common';
import { constitutionResults } from '@/data/mockData';
import { storage } from '@/utils/storage';
import {
  User,
  Calendar,
  Heart,
  BookOpen,
  HelpCircle,
  ChevronRight,
  Edit3,
  Trash2,
  AlertCircle
} from 'lucide-react';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const { userProfile, diaryEntries, checkIns, painRecords, diarySettings } = state;

  const [showEditModal, setShowEditModal] = useState(false);
  const [showCycleSettings, setShowCycleSettings] = useState(false);
  const [showClearData, setShowClearData] = useState(false);
  const [editName, setEditName] = useState(userProfile.name);
  const [editCycleLength, setEditCycleLength] = useState(userProfile.averageCycleLength.toString());
  const [editPeriodLength, setEditPeriodLength] = useState(userProfile.averagePeriodLength.toString());

  const constitutionInfo = userProfile.constitutionType !== 'unknown'
    ? constitutionResults[userProfile.constitutionType]
    : null;

  const totalCheckIns = checkIns.filter(c => c.completed).length;
  const totalDiaries = diaryEntries.length;
  const totalPainRecords = painRecords.length;

  const menuItems = [
    {
      icon: <Calendar size={20} />,
      label: '周期设置',
      description: `周期 ${userProfile.averageCycleLength} 天 / 经期 ${userProfile.averagePeriodLength} 天`,
      onClick: () => setShowCycleSettings(true)
    },
    {
      icon: <Heart size={20} />,
      label: '体质测试',
      description: userProfile.constitutionTestCompleted
        ? constitutionInfo?.name || '已完成'
        : '未测试',
      onClick: () => navigate('/constitution')
    },
    {
      icon: <BookOpen size={20} />,
      label: '日记设置',
      description: diarySettings.enabled ? '密码保护已开启' : '未设置密码',
      onClick: () => navigate('/diary')
    },
    {
      icon: <HelpCircle size={20} />,
      label: '使用帮助',
      description: '了解如何使用应用',
      onClick: () => alert('帮助功能开发中')
    }
  ];

  const handleSaveName = () => {
    if (editName.trim()) {
      dispatch({ type: 'SET_USER_PROFILE', payload: { name: editName.trim() } });
      setShowEditModal(false);
    }
  };

  const handleSaveCycleSettings = () => {
    const cycleLength = parseInt(editCycleLength);
    const periodLength = parseInt(editPeriodLength);

    if (cycleLength >= 21 && cycleLength <= 45 && periodLength >= 2 && periodLength <= 10) {
      dispatch({
        type: 'SET_USER_PROFILE',
        payload: {
          averageCycleLength: cycleLength,
          averagePeriodLength: periodLength
        }
      });
      setShowCycleSettings(false);
    } else {
      alert('请输入有效的周期天数（21-45天）和经期天数（2-10天）');
    }
  };

  const handleClearData = () => {
    storage.clear();
    window.location.reload();
  };

  return (
    <div className="safe-area">
      <Header title="我的" />
      
      <div className="screen-container">
        {/* 用户信息卡片 */}
        <div className="card bg-gradient-to-br from-pink-400 to-pink-500 text-white mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <User size={32} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{userProfile.name}</h2>
              <p className="text-pink-100 text-sm mt-1">
                {constitutionInfo ? constitutionInfo.name : '体质待测试'}
              </p>
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <Edit3 size={18} />
            </button>
          </div>

          {/* 统计数据 */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold">{totalCheckIns}</div>
              <div className="text-xs text-pink-100">打卡次数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{totalDiaries}</div>
              <div className="text-xs text-pink-100">日记数量</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{totalPainRecords}</div>
              <div className="text-xs text-pink-100">疼痛记录</div>
            </div>
          </div>
        </div>

        {/* 菜单列表 */}
        <div className="card overflow-hidden">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                index < menuItems.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center text-primary">
                  {item.icon}
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-800">{item.label}</p>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-300" />
            </button>
          ))}
        </div>

        {/* 清除数据按钮 */}
        <button
          onClick={() => setShowClearData(true)}
          className="w-full mt-6 p-4 card flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={18} />
          <span className="font-medium">清除所有数据</span>
        </button>

        {/* 版本信息 */}
        <div className="text-center mt-8 pb-4">
          <p className="text-xs text-gray-400">经期养生 v1.0.0</p>
          <p className="text-xs text-gray-300 mt-1">❤️ 呵护你的每一天</p>
        </div>
      </div>

      {/* 编辑名字弹窗 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">编辑昵称</h3>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="输入昵称"
              className="input-field mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditName(userProfile.name);
                  setShowEditModal(false);
                }}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSaveName}
                className="flex-1 py-2 rounded-xl bg-primary text-white font-medium"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 周期设置弹窗 */}
      {showCycleSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">周期设置</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  平均周期（天）
                  <span className="text-gray-400 text-xs ml-1">（21-45天）</span>
                </label>
                <input
                  type="number"
                  value={editCycleLength}
                  onChange={e => setEditCycleLength(e.target.value)}
                  className="input-field"
                  min={21}
                  max={45}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  平均经期（天）
                  <span className="text-gray-400 text-xs ml-1">（2-10天）</span>
                </label>
                <input
                  type="number"
                  value={editPeriodLength}
                  onChange={e => setEditPeriodLength(e.target.value)}
                  className="input-field"
                  min={2}
                  max={10}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setEditCycleLength(userProfile.averageCycleLength.toString());
                  setEditPeriodLength(userProfile.averagePeriodLength.toString());
                  setShowCycleSettings(false);
                }}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSaveCycleSettings}
                className="flex-1 py-2 rounded-xl bg-primary text-white font-medium"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 清除数据确认弹窗 */}
      {showClearData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">确认清除数据</h3>
                <p className="text-sm text-gray-500">此操作不可恢复</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-6">
              清除后将删除所有记录，包括：日记、打卡记录、疼痛记录、周期数据等。确定要继续吗？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearData(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleClearData}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white font-medium"
              >
                确认清除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
