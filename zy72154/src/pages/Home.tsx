import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Upload, GitMerge, FileCheck, Download, Database, AlertTriangle } from 'lucide-react';
import { db } from '@/db';
import { loadSampleData } from '@/utils/sampleData';
import { getMatchResults } from '@/utils/mergeData';
import { MatchResult } from '@/types';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    gis: 0,
    feedback: 0,
    inspection: 0,
    merged: 0,
    anomalies: 0
  });
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const gis = await db.gisPoints.count();
    const feedback = await db.residentFeedbacks.count();
    const inspection = await db.inspectionRecords.count();
    const merged = await db.mergedRecords.count();
    const anomalies = await db.anomalies.count();
    const results = await getMatchResults();
    
    setStats({ gis, feedback, inspection, merged, anomalies });
    setMatchResults(results);
  }

  async function handleLoadSample() {
    setLoading(true);
    try {
      await loadSampleData();
      await loadStats();
    } catch (error) {
      console.error('加载样例数据失败', error);
    }
    setLoading(false);
  }

  const statusCounts = {
    pending: matchResults.filter(r => r.mergedRecord.review_status === 'pending').length,
    confirmed: matchResults.filter(r => r.mergedRecord.review_status === 'confirmed').length,
    need_verify: matchResults.filter(r => r.mergedRecord.review_status === 'need_verify').length,
    on_site: matchResults.filter(r => r.mergedRecord.review_status === 'on_site').length,
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">城市照明能耗巡检工具</h2>
            <p className="text-gray-300 text-sm max-w-xl">
              归集GIS点位、居民反馈、巡检记录等多源数据，实现自动归并匹配、人工复核、异常检测与分类导出。
              保留原始数据，不清洗居民备注。
            </p>
          </div>
          <button
            onClick={handleLoadSample}
            disabled={loading}
            className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-500 px-4 py-2 rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            <span>{loading ? '加载中...' : '加载样例数据'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">GIS点位</p>
              <p className="text-2xl font-bold text-slate-800">{stats.gis}</p>
            </div>
            <Database className="w-10 h-10 text-blue-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">居民反馈</p>
              <p className="text-2xl font-bold text-slate-800">{stats.feedback}</p>
            </div>
            <Upload className="w-10 h-10 text-green-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">巡检记录</p>
              <p className="text-2xl font-bold text-slate-800">{stats.inspection}</p>
            </div>
            <FileCheck className="w-10 h-10 text-purple-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">异常项</p>
              <p className="text-2xl font-bold text-orange-600">{stats.anomalies}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-orange-500 opacity-20" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">复核状态统计</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-600">{statusCounts.pending}</p>
            <p className="text-sm text-gray-500">待复核</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">{statusCounts.confirmed}</p>
            <p className="text-sm text-gray-500">已处理</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-3xl font-bold text-yellow-600">{statusCounts.need_verify}</p>
            <p className="text-sm text-gray-500">待核实</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-3xl font-bold text-red-600">{statusCounts.on_site}</p>
            <p className="text-sm text-gray-500">需现场复看</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Link to="/import" className="block">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer h-full">
            <Upload className="w-8 h-8 text-blue-500 mb-3" />
            <h4 className="font-semibold text-gray-800 mb-2">第一步：导入数据</h4>
            <p className="text-sm text-gray-500">上传GIS点位、居民反馈、巡检记录等多源数据，保留原始格式不清洗。</p>
          </div>
        </Link>
        <Link to="/merge" className="block">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer h-full">
            <GitMerge className="w-8 h-8 text-purple-500 mb-3" />
            <h4 className="font-semibold text-gray-800 mb-2">第二步：数据归并</h4>
            <p className="text-sm text-gray-500">基于路灯编号、地址、坐标自动匹配，查看匹配结果和置信度。</p>
          </div>
        </Link>
        <Link to="/review" className="block">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer h-full">
            <FileCheck className="w-8 h-8 text-green-500 mb-3" />
            <h4 className="font-semibold text-gray-800 mb-2">第三步：人工复核</h4>
            <p className="text-sm text-gray-500">逐条审核记录，标记状态（已处理/待核实/需现场复看），添加备注。</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Link to="/anomalies" className="block">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer h-full">
            <AlertTriangle className="w-8 h-8 text-orange-500 mb-3" />
            <h4 className="font-semibold text-gray-800 mb-2">异常检测</h4>
            <p className="text-sm text-gray-500">查看容量超限、时间段冲突、空值缺失、重复项等异常，附人话解释。</p>
          </div>
        </Link>
        <Link to="/export" className="block">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer h-full">
            <Download className="w-8 h-8 text-teal-500 mb-3" />
            <h4 className="font-semibold text-gray-800 mb-2">公示导出</h4>
            <p className="text-sm text-gray-500">按处理状态分类导出Excel，生成巡检简报，月底复盘直接用。</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
