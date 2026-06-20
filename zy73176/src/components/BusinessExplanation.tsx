import type { BoundaryRecord, Material, CaliberVersion, ReviewSummary } from '../types';

interface BusinessExplanationProps {
  records: BoundaryRecord[];
  material: Material | null;
  caliber: CaliberVersion;
  summary: ReviewSummary;
}

export function BusinessExplanation({
  records,
  material,
  caliber,
  summary
}: BusinessExplanationProps) {
  if (!material || records.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="text-4xl mb-2">📋</div>
        <p>选择材料并完成复核后查看业务解释</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">业务解释报告</h2>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          月底封账专用
        </span>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-100">
        <h3 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
          <span>📊</span> 复核结果概览
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="总记录数"
            value={summary.totalRecords.toString()}
            color="blue"
          />
          <StatCard
            label="正常通过"
            value={`${summary.withinBounds} (${((summary.withinBounds / summary.totalRecords) * 100).toFixed(0)}%)`}
            color="green"
          />
          <StatCard
            label="需要关注"
            value={`${summary.warnings} 项`}
            color="yellow"
          />
          <StatCard
            label="存在问题"
            value={`${summary.errors} 项`}
            color="red"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-medium text-gray-800 flex items-center gap-2">
            <span>📁</span> 材料基本信息
          </h3>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <InfoRow label="材料名称" value={material.title} />
          <InfoRow 
            label="数据来源" 
            value={material.materials.map(m => m.name).join('、')} 
          />
          <InfoRow label="数据项数" value={`${material.items.length} 项`} />
          <InfoRow label="上传时间" value={new Date(material.createdAt).toLocaleString('zh-CN')} />
          {material.scoreRemark && (
            <InfoRow label="评分备注" value={material.scoreRemark} highlight />
          )}
          {material.oralNote && (
            <InfoRow label="口头说明" value={material.oralNote} highlight purple />
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-medium text-gray-800 flex items-center gap-2">
            <span>📏</span> 复核标准说明
          </h3>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <InfoRow label="使用口径" value={`${caliber.version}版 - ${caliber.name}`} />
          <InfoRow label="口径说明" value={caliber.description} />
          <InfoRow label="发布时间" value={new Date(caliber.createdAt).toLocaleString('zh-CN')} />
          
          <div className="mt-4">
            <h4 className="font-medium text-gray-700 mb-2">阈值定义：</h4>
            <div className="space-y-2">
              {caliber.thresholds.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-700">{t.name}</span>
                  <span className="font-mono text-blue-600">
                    [{t.minValue}, {t.maxValue}] {t.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-medium text-gray-800 flex items-center gap-2">
            <span>🔍</span> 数字来源线索
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">序号</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">指标名称</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">输入值</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">数据来源</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">计算公式</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">结果</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.map((record, idx) => {
                const source = material.materials[record.inputValue ? 0 : 0]?.name || '未知来源';
                const formula = record.calculationTrace.find(t => t.source === 'probability_calculation')?.formula || '标准公式';
                
                return (
                  <tr key={record.id} className={record.isWithinBounds ? '' : 'bg-red-50'}>
                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{record.canonicalName}</div>
                      {record.objectName !== record.canonicalName && (
                        <div className="text-xs text-gray-500">
                          （原始名称：{record.objectName}）
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-800">
                      {record.inputValue}{record.inputUnit}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">
                      {source}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-purple-600">
                      {formula}
                    </td>
                    <td className="px-4 py-3">
                      <span className={record.isWithinBounds ? 'text-green-600' : 'text-red-600'}>
                        {record.isWithinBounds ? '✅ 界内' : '❌ 界外'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {summary.errors > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-red-100 border-b border-red-200">
            <h3 className="font-medium text-red-800 flex items-center gap-2">
              <span>🚨</span> 异常详情说明
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {records.filter(r => r.status === 'error').map((record) => {
              const mainError = record.anomalies.find(a => a.severity === 'error');
              return (
                <div key={record.id} className="p-3 bg-white rounded-lg border border-red-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-red-800">{record.canonicalName}</span>
                    <span className="font-mono text-red-600">
                      {record.inputValue}{record.inputUnit}
                    </span>
                  </div>
                  <p className="text-sm text-red-700">{mainError?.message || '未知错误'}</p>
                  <p className="text-xs text-red-600 mt-1">
                    💡 建议：请核查数据准确性，必要时人工复核
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {summary.extrapolations > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-yellow-100 border-b border-yellow-200">
            <h3 className="font-medium text-yellow-800 flex items-center gap-2">
              <span>📈</span> 外推情况说明
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {records.filter(r => r.extrapolation).map((record) => (
              <div key={record.id} className="p-3 bg-white rounded-lg border border-yellow-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-yellow-800">{record.canonicalName}</span>
                  <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">
                    {record.extrapolation!.direction === 'up' ? '向上外推' : '向下外推'}
                  </span>
                </div>
                <div className="text-sm text-yellow-700 mb-2">
                  <span className="font-medium">影响范围：</span>
                  {record.extrapolation!.impactScope.join(' → ')}
                </div>
                <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded whitespace-pre-line">
                  {record.extrapolation!.suggestion}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.aliasResolved > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-blue-100 border-b border-blue-200">
            <h3 className="font-medium text-blue-800 flex items-center gap-2">
              <span>🔄</span> 别名解析记录
            </h3>
          </div>
          <div className="p-4">
            <p className="text-sm text-blue-700">
              本次复核共识别并标准化了 <span className="font-bold">{summary.aliasResolved}</span> 个对象名称，
              确保同一对象在不同材料中的称呼统一。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: 'blue' | 'green' | 'yellow' | 'red' }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red: 'bg-red-100 text-red-700'
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function InfoRow({ 
  label, 
  value, 
  highlight = false, 
  purple = false 
}: { 
  label: string; 
  value: string; 
  highlight?: boolean; 
  purple?: boolean;
}) {
  return (
    <div className="flex gap-4">
      <span className="text-gray-500 w-24 flex-shrink-0">{label}：</span>
      <span className={`flex-1 ${
        highlight 
          ? purple 
            ? 'text-purple-700 bg-purple-50 px-2 py-1 rounded' 
            : 'text-blue-700 bg-blue-50 px-2 py-1 rounded'
          : 'text-gray-800'
      }`}>
        {value}
      </span>
    </div>
  );
}
