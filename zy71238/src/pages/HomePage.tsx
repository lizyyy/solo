import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Upload, FileText, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import { FileUpload } from '../components/common/FileUpload';
import { parseIndexCsv } from '../utils/csvParser';
import { sampleIndexComponents } from '../data/sampleIndex';
import { useGameStore } from '../store/gameStore';
import type { IndexComponent } from '../types';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const initializeGame = useGameStore(state => state.initializeGame);
  const [importedComponents, setImportedComponents] = useState<IndexComponent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    try {
      setError(null);
      const components = await parseIndexCsv(file);
      if (components.length === 0) {
        setError('未能解析到有效的指数成分数据，请检查CSV格式');
        return;
      }
      setImportedComponents(components);
    } catch (e) {
      setError('文件解析失败，请检查文件格式');
    }
  };

  const handleStartGame = (useSample: boolean) => {
    if (useSample) {
      initializeGame(sampleIndexComponents);
    } else if (importedComponents) {
      initializeGame(importedComponents);
    }
    navigate('/game');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            📊 指数基金复制挑战
          </h1>
          <p className="text-xl text-slate-300">
            在模拟环境中学习指数基金管理，掌握现金管理、停牌替代和误差控制
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="text-green-400" size={24} />
            </div>
            <h3 className="text-white font-semibold mb-2">跟踪误差控制</h3>
            <p className="text-slate-400 text-sm">
              学习如何调整持仓，将跟踪误差控制在合理范围内
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-yellow-400" size={24} />
            </div>
            <h3 className="text-white font-semibold mb-2">停牌股票处理</h3>
            <p className="text-slate-400 text-sm">
              面对股票停牌，学会用替代股票维持指数跟踪效果
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="text-blue-400" size={24} />
            </div>
            <h3 className="text-white font-semibold mb-2">事件应对</h3>
            <p className="text-slate-400 text-sm">
              处理申购赎回、市场波动等突发情况
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">开始游戏</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <FileText size={48} className="mx-auto mb-4 text-slate-400" />
              <h3 className="font-semibold text-slate-800 mb-2">使用示例数据</h3>
              <p className="text-sm text-gray-500 mb-4">
                使用预设的20只成分股指数开始游戏
              </p>
              <button
                onClick={() => handleStartGame(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
              >
                <Play size={18} />
                快速开始
              </button>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload size={48} className="mx-auto mb-4 text-slate-400" />
              <h3 className="font-semibold text-slate-800 mb-2">导入指数成分</h3>
              <p className="text-sm text-gray-500 mb-4">
                上传CSV文件自定义指数成分
              </p>
              <FileUpload
                onFileSelect={handleFileUpload}
                label="上传CSV文件"
              />
              {importedComponents && (
                <div className="mt-3 text-sm text-green-600">
                  ✓ 已导入 {importedComponents.length} 只成分股
                </div>
              )}
              {error && (
                <div className="mt-3 text-sm text-red-500">{error}</div>
              )}
              {importedComponents && (
                <button
                  onClick={() => handleStartGame(false)}
                  className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                >
                  <Play size={18} />
                  开始游戏
                </button>
              )}
            </div>
          </div>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-slate-700 mb-2">CSV 文件格式说明：</h4>
            <p className="text-sm text-gray-600 mb-2">文件应包含以下列：code(股票代码), name(股票名称), weight(权重%), price(价格), isSuspended(是否停牌)</p>
            <code className="block text-xs bg-gray-100 p-3 rounded font-mono overflow-x-auto">
              code,name,weight,price,isSuspended<br/>
              600519,贵州茅台,15.5,1800.00,false<br/>
              601318,中国平安,8.2,45.50,false
            </code>
          </div>
        </div>

        <div className="mt-8 text-center text-slate-400 text-sm">
          游戏规则：完成10个回合的操作，控制跟踪误差在最小范围内
        </div>
      </div>
    </div>
  );
};
