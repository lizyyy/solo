import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Check,
  Sparkles,
  Heart,
  Activity,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { mockTests } from '../data/mockData';
import { TestResult } from '../types';

export default function TestResultPage() {
  const navigate = useNavigate();
  const { resultId } = useParams<{ resultId: string }>();
  const { state } = useApp();

  const result = state.testResults.find(r => r.id === resultId);
  const test = result ? mockTests.find(t => t.id === result.testId) : undefined;

  if (!result) {
    return (
      <div className="fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/emotion-tools')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-semibold">测试结果</h1>
        </div>
        <div className="empty-state">
          <Activity size={64} className="text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">未找到测试结果</h3>
          <p className="text-gray-500 text-center mb-4">该测试结果不存在或已被删除</p>
          <button
            onClick={() => navigate('/emotion-tools')}
            className="btn btn-primary"
          >
            返回心理工具
          </button>
        </div>
      </div>
    );
  }

  const levelInfo = {
    mild: {
      icon: '😊',
      label: '状态良好',
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    moderate: {
      icon: '😐',
      label: '需要关注',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    severe: {
      icon: '😔',
      label: '建议寻求帮助',
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    }
  };

  const currentLevel = levelInfo[result.level];

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fade-in">
      {/* 头部 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/emotion-tools')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-lg font-semibold">{test?.title || '心理测试结果'}</h1>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Calendar size={14} />
            {formatDate(result.timestamp)}
          </p>
        </div>
      </div>

      {/* 结果概览卡片 */}
      <div className={`card mb-6 ${currentLevel.bgColor} ${currentLevel.borderColor} border-2`}>
        <div className="text-center">
          <div className={`text-6xl mb-4 ${currentLevel.color}`}>
            {currentLevel.icon}
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${currentLevel.color}`}>
            {currentLevel.label}
          </h2>
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <span className="text-lg font-semibold">总分：</span>
            <span className={`text-3xl font-bold ${currentLevel.color}`}>
              {result.totalScore}
            </span>
            <span className="text-gray-400">分</span>
          </div>
        </div>
      </div>

      {/* 得分区间说明 */}
      <div className="card mb-6">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Activity size={20} className="text-amber-500" />
          得分区间说明
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <span className="text-2xl">😊</span>
            <div className="flex-1">
              <p className="font-medium text-green-700">状态良好 (0-5分)</p>
              <p className="text-xs text-green-600">情绪状态整体良好，继续保持积极的生活态度</p>
            </div>
            {result.level === 'mild' && (
              <Check size={20} className="text-green-500" />
            )}
          </div>
          <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
            <span className="text-2xl">😐</span>
            <div className="flex-1">
              <p className="font-medium text-yellow-700">需要关注 (6-10分)</p>
              <p className="text-xs text-yellow-600">可能正在经历一些情绪困扰，建议适当调整生活节奏</p>
            </div>
            {result.level === 'moderate' && (
              <Check size={20} className="text-yellow-500" />
            )}
          </div>
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
            <span className="text-2xl">😔</span>
            <div className="flex-1">
              <p className="font-medium text-red-700">建议寻求帮助 (11-15分)</p>
              <p className="text-xs text-red-600">情绪状态需要关注，建议尽快寻求专业帮助</p>
            </div>
            {result.level === 'severe' && (
              <Check size={20} className="text-red-500" />
            )}
          </div>
        </div>
      </div>

      {/* 结果描述 */}
      <div className="card mb-6">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Sparkles size={20} className="text-amber-500" />
          结果解读
        </h3>
        <p className="text-gray-700 leading-relaxed">
          {result.description}
        </p>
      </div>

      {/* 建议 */}
      <div className="card mb-6">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Heart size={20} className="text-pink-500" />
          温馨建议
        </h3>
        <ul className="space-y-3">
          {result.suggestions.map((suggestion, index) => (
            <li key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-amber-600">{index + 1}</span>
              </div>
              <p className="text-gray-700">{suggestion}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* 重要提示 */}
      <div className="card mb-6 bg-amber-50 border-amber-200 border-2">
        <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
          <Sparkles size={18} />
          重要提示
        </h4>
        <div className="space-y-2 text-sm text-amber-700">
          <p>⚠️ 此测试仅供自我参考，不能替代专业诊断。</p>
          <p>⚠️ 心理测试结果只是一个参考指标，不能作为确诊依据。</p>
          <p>⚠️ 如果你持续感到情绪困扰，请务必寻求专业心理帮助。</p>
          <p>⚠️ 记住：寻求帮助是勇敢的表现，你并不孤单。</p>
        </div>
      </div>

      {/* 推荐行动 */}
      <div className="card mb-6">
        <h3 className="section-title mb-4">可以尝试的疗愈方式</h3>
        <div className="grid grid-cols-2 gap-3">
          <div 
            className="p-4 bg-amber-50 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors"
            onClick={() => navigate('/music-therapy')}
          >
            <span className="text-3xl mb-2 block">🎵</span>
            <p className="font-medium text-gray-800 text-sm">音乐疗愈</p>
            <p className="text-xs text-gray-500">用音乐放松心情</p>
          </div>
          <div 
            className="p-4 bg-green-50 rounded-xl cursor-pointer hover:bg-green-100 transition-colors"
            onClick={() => navigate('/meditation')}
          >
            <span className="text-3xl mb-2 block">🧘</span>
            <p className="font-medium text-gray-800 text-sm">冥想练习</p>
            <p className="text-xs text-gray-500">平静内心世界</p>
          </div>
          <div 
            className="p-4 bg-purple-50 rounded-xl cursor-pointer hover:bg-purple-100 transition-colors"
            onClick={() => navigate('/painting-therapy')}
          >
            <span className="text-3xl mb-2 block">🎨</span>
            <p className="font-medium text-gray-800 text-sm">绘画疗愈</p>
            <p className="text-xs text-gray-500">用色彩表达情绪</p>
          </div>
          <div 
            className="p-4 bg-pink-50 rounded-xl cursor-pointer hover:bg-pink-100 transition-colors"
            onClick={() => navigate('/diary')}
          >
            <span className="text-3xl mb-2 block">📔</span>
            <p className="font-medium text-gray-800 text-sm">写日记</p>
            <p className="text-xs text-gray-500">记录内心感受</p>
          </div>
        </div>
      </div>

      {/* 返回按钮 */}
      <button
        onClick={() => navigate('/emotion-tools')}
        className="w-full btn btn-secondary mb-6"
      >
        <ChevronLeft size={20} />
        返回心理工具
      </button>

      {/* 底部空间 */}
      <div className="h-4" />
    </div>
  );
}
