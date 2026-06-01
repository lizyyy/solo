import { useState } from 'react';
import { Settings, CheckCircle, AlertTriangle, Clock, GitCompare, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

export function Params() {
  const paramVersions = useAppStore((state) => state.paramVersions);
  const [selectedVersion1, setSelectedVersion1] = useState<string>(paramVersions[0]?.id || '');
  const [selectedVersion2, setSelectedVersion2] = useState<string>(paramVersions[1]?.id || '');
  const [expandedParams, setExpandedParams] = useState<Set<string>>(new Set(['threshold', 'minCommunitySize']));

  const v1 = paramVersions.find((v) => v.id === selectedVersion1);
  const v2 = paramVersions.find((v) => v.id === selectedVersion2);

  const toggleParam = (key: string) => {
    const newSet = new Set(expandedParams);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedParams(newSet);
  };

  const getAllParamKeys = new Set([
    ...Object.keys(v1?.parameters || {}),
    ...Object.keys(v2?.parameters || {}),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">参数管理</h1>
        <p className="text-slate-500 mt-1">管理图神经网络社区解释算法参数版本</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">参数版本对比</h3>
            <p className="text-sm text-slate-500">对比不同版本参数差异</p>
          </div>
        </div>

        <div className="flex gap-6 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">版本 1</label>
            <select
              value={selectedVersion1}
              onChange={(e) => setSelectedVersion1(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {paramVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version} - {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">版本 2</label>
            <select
              value={selectedVersion2}
              onChange={(e) => setSelectedVersion2(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {paramVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version} - {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {v1 && v2 && (
          <div className="space-y-3">
            {Array.from(getAllParamKeys).map((key) => {
              const p1 = v1.parameters[key];
              const p2 = v2.parameters[key];
              const hasDiff = p1?.value !== p2?.value || p1?.unit !== p2?.unit;
              const isExpanded = expandedParams.has(key);

              return (
                <div
                  key={key}
                  className={`rounded-xl border transition-all ${
                    hasDiff ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => toggleParam(key)}
                  >
                    <div className="flex items-center gap-3">
                      {hasDiff ? (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      )}
                      <div>
                        <span className="font-medium text-slate-800">{key}</span>
                        {hasDiff && <span className="ml-2 text-xs text-amber-600">存在差异</span>}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-slate-500">{v1.version}</span>
                            <span className="text-xs text-slate-400">|</span>
                            <span className="text-xs text-slate-500">{p1?.description || '参数描述'}</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-800">{p1?.value ?? '-'}</span>
                            <span className="text-sm text-slate-500">{p1?.unit}</span>
                          </div>
                        </div>
                        <div className={`bg-white rounded-lg p-4 ${hasDiff ? 'border-2 border-amber-300' : ''}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-slate-500">{v2.version}</span>
                            <span className="text-xs text-slate-400">|</span>
                            <span className="text-xs text-slate-500">{p2?.description || '参数描述'}</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-800">{p2?.value ?? '-'}</span>
                            <span className="text-sm text-slate-500">{p2?.unit}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">版本历史</h3>
            <p className="text-sm text-slate-500">所有参数版本变更记录</p>
          </div>
        </div>

        <div className="space-y-4">
          {paramVersions.map((version, index) => (
            <div
              key={version.id}
              className="flex items-start gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0"
            >
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm font-bold text-slate-600">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{version.version}</span>
                  <span className="text-slate-500">-</span>
                  <span className="text-slate-600">{version.name}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  创建时间：{new Date(version.createdAt).toLocaleString('zh-CN')}
                </p>
                <p className="text-sm text-slate-500">创建者：{version.createdBy}</p>
                <div className="flex gap-2 mt-2">
                  {Object.keys(version.parameters).map((key) => (
                    <span
                      key={key}
                      className="px-2 py-1 bg-slate-100 text-xs text-slate-600 rounded"
                    >
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-6 border border-cyan-100">
        <div className="flex items-start gap-4">
          <GitCompare className="w-8 h-8 text-cyan-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-bold text-slate-800 mb-2">单位校验提醒</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              参数单位不一致是导致计算结果偏差的常见原因。请确保：
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              <li>• 同一维度参数使用统一单位</li>
              <li>• 计算公式中明确标注单位转换</li>
              <li>• 输出结果单位与预期一致</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
