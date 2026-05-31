import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import CoordinatePlot from '../components/CoordinatePlot';
import ChangeTypeBadge from '../components/ChangeTypeBadge';
import {
  Settings as SettingsIcon,
  MapPin,
  FlipHorizontal,
  List,
  Save,
  RefreshCw,
  Eye,
  FileDown,
  CheckCircle,
} from 'lucide-react';
import type { ChangeType } from '../../../shared/types';

export default function Settings() {
  const {
    settings,
    loading,
    error,
    fetchSettings,
    updateSettings,
  } = useStore();

  const [routeDescription, setRouteDescription] = useState('');
  const [deviationThreshold, setDeviationThreshold] = useState(0.03);
  const [defaultFlipType, setDefaultFlipType] = useState<'x' | 'y' | 'origin'>('origin');
  const [routeEnabled, setRouteEnabled] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setRouteDescription(settings.routeExample.description);
      setDeviationThreshold(settings.flipRules.deviationThreshold);
      setDefaultFlipType(settings.flipRules.defaultFlipType);
      setRouteEnabled(settings.routeExample.enabled);
    }
  }, [settings]);

  useEffect(() => {
    if (settings) {
      setHasChanges(
        routeDescription !== settings.routeExample.description ||
        deviationThreshold !== settings.flipRules.deviationThreshold ||
        defaultFlipType !== settings.flipRules.defaultFlipType ||
        routeEnabled !== settings.routeExample.enabled
      );
    }
  }, [routeDescription, deviationThreshold, defaultFlipType, routeEnabled, settings]);

  const handleSave = async () => {
    await updateSettings({
      routeExample: {
        ...settings.routeExample,
        description: routeDescription,
        enabled: routeEnabled,
      },
      flipRules: {
        deviationThreshold,
        defaultFlipType,
      },
    });
    setHasChanges(false);
  };

  const handleReset = () => {
    if (settings) {
      setRouteDescription(settings.routeExample.description);
      setDeviationThreshold(settings.flipRules.deviationThreshold);
      setDefaultFlipType(settings.flipRules.defaultFlipType);
      setRouteEnabled(settings.routeExample.enabled);
    }
  };

  const flipTypeLabels: Record<'x' | 'y' | 'origin', string> = {
    x: 'X轴翻转',
    y: 'Y轴翻转',
    origin: '原点翻转',
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">系统配置</h1>
          <p className="text-slate-600 mt-1">配置讲解路线样例、坐标轴翻转规则和变更类型定义</p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm text-amber-600 flex items-center gap-1">
              <RefreshCw size={14} />
              有未保存的更改
            </span>
          )}
          <button
            onClick={handleReset}
            disabled={loading || !hasChanges}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded border-2 border-slate-200 hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
          >
            重置
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !hasChanges}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded border-2 border-primary-700 hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            保存配置
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border-2 border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b-2 border-slate-100 flex items-center gap-2">
            <MapPin size={20} className="text-primary-600" />
            <h3 className="text-sm font-semibold text-slate-700">讲解路线样例</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="routeEnabled"
                checked={routeEnabled}
                onChange={(e) => setRouteEnabled(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="routeEnabled" className="text-sm text-slate-700">
                启用讲解路线样例
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                路线描述
              </label>
              <textarea
                value={routeDescription}
                onChange={(e) => setRouteDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                placeholder="输入标准讲解路线描述..."
              />
            </div>

            {settings.routeExample.coordinates && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  标准路线坐标图
                </label>
                <CoordinatePlot
                  coordinates={settings.routeExample.coordinates}
                  width={360}
                  height={240}
                  title="标准讲解路线"
                />
              </div>
            )}

            <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-primary-800 mb-1 flex items-center gap-1">
                <Eye size={12} />
                项目经理操作说明
              </h4>
              <p className="text-xs text-primary-700">
                <strong>放讲解路线样例：</strong>在本页面配置标准讲解路线的坐标和描述，配置后将在检查详情页作为参考标准显示。如需修改坐标点位，请联系系统管理员。
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b-2 border-slate-100 flex items-center gap-2">
            <FlipHorizontal size={20} className="text-primary-600" />
            <h3 className="text-sm font-semibold text-slate-700">坐标轴翻转规则</h3>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                默认翻转方式
              </label>
              <div className="flex gap-2">
                {(['x', 'y', 'origin'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDefaultFlipType(type)}
                    className={`flex-1 py-2 px-3 rounded border-2 text-sm font-medium transition-colors ${
                      defaultFlipType === type
                        ? 'bg-primary-50 border-primary-300 text-primary-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {flipTypeLabels[type]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                偏差阈值：{(deviationThreshold * 100).toFixed(1)}%
              </label>
              <input
                type="range"
                min="0.01"
                max="0.1"
                step="0.005"
                value={deviationThreshold}
                onChange={(e) => setDeviationThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1%</span>
                <span>5%</span>
                <span>10%</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                当翻转偏差超过此阈值时，状态将自动标记为「有异常」需人工确认
              </p>
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
                <Eye size={12} />
                查看坐标轴翻转
              </h4>
              <p className="text-xs text-amber-700">
                <strong>去哪看坐标轴翻转：</strong>在「检查工作台」点击记录的「查看」按钮进入详情页，在「翻转对比」面板可查看翻转前后的坐标对比图、偏差值计算结果，以及是否超过阈值的异常提示。
              </p>
            </div>

            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-green-800 mb-1 flex items-center gap-1">
                <FileDown size={12} />
                导出前复核
              </h4>
              <p className="text-xs text-green-700">
                <strong>导出巡检单前怎么复核：</strong>①在工作台勾选记录后点击「批量导出」②在导出管理页选择模板③点击「执行一致性校验」④确认校验通过后再点击「生成导出」⑤在导出历史中下载文件。校验不通过时需根据问题列表修正对应记录。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white border-2 border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b-2 border-slate-100 flex items-center gap-2">
          <List size={20} className="text-primary-600" />
          <h3 className="text-sm font-semibold text-slate-700">变更类型定义</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {settings.changeTypeDefinitions.map((def) => (
              <div
                key={def.type}
                className="border-2 border-slate-200 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <ChangeTypeBadge type={def.type as ChangeType} />
                  {def.affectsConclusionByDefault ? (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                      改结论
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-medium">
                      补材料
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-700 font-medium">{def.label}</div>
                <div className="text-xs text-slate-500 mt-1">
                  默认{def.affectsConclusionByDefault ? '影响' : '不影响'}检查结论
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
              <CheckCircle size={12} className="text-green-600" />
              变更类型说明
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
              <div>• <strong>讲解路线早到：</strong>布展提前导入讲解路线数据，仅补材料不影响结论</div>
              <div>• <strong>设备备注晚补：</strong>讲解员补充设备备注信息，仅补材料不影响结论</div>
              <div>• <strong>CAD点位改动：</strong>工程师手工调整CAD坐标点位，直接影响检查结论</div>
              <div>• <strong>坐标轴翻转：</strong>执行坐标翻转操作，根据偏差值判断是否影响结论</div>
              <div>• <strong>导出记录：</strong>导出巡检单操作，仅记录操作轨迹不影响结论</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-slate-50 border-2 border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
          <SettingsIcon size={16} />
          展厅项目经理快速指南
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div className="bg-white rounded p-3 border border-slate-200">
            <div className="font-semibold text-slate-800 mb-1">📌 放置讲解路线样例</div>
            <p>在本页面「讲解路线样例」板块配置标准路线描述，启用后将在所有检查详情页显示，作为讲解路线的参考标准。</p>
          </div>
          <div className="bg-white rounded p-3 border border-slate-200">
            <div className="font-semibold text-slate-800 mb-1">🔄 查看坐标轴翻转</div>
            <p>进入「检查工作台」→ 点击记录「查看」→ 在「翻转对比」面板查看翻转前后坐标图、偏差值、是否超阈值等详细信息。</p>
          </div>
          <div className="bg-white rounded p-3 border border-slate-200">
            <div className="font-semibold text-slate-800 mb-1">✅ 导出前复核</div>
            <p>选择记录 → 批量导出 → 执行一致性校验 → 修正问题（如有）→ 生成导出 → 下载文件。每步都有明确提示，确保导出数据准确。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
