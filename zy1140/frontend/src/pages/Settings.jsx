import { useEffect, useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Save, 
  RefreshCw,
  Moon,
  Heart,
  Footprints,
  Activity,
  TrendingUp,
  Info
} from 'lucide-react';
import useStore from '../store';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { LoadingOverlay, EmptyState } from '../components/ui/Loading';
import { Tabs } from '../components/ui/Tabs';
import { cn } from '../utils/cn';

const categories = [
  { value: 'sleep', label: '睡眠', icon: Moon },
  { value: 'heartRate', label: '心率', icon: Heart },
  { value: 'steps', label: '步数', icon: Footprints },
  { value: 'workout', label: '运动', icon: Activity },
  { value: 'recovery', label: '恢复', icon: TrendingUp },
];

const categoryLabels = {
  sleep: '睡眠',
  heartRate: '心率',
  steps: '步数',
  workout: '运动',
  recovery: '恢复',
  general: '通用',
};

const thresholdDescriptions = {
  minSleepHours: { label: '最小睡眠时长', desc: '低于此值视为睡眠不足', unit: '小时' },
  idealSleepHours: { label: '理想睡眠时长', desc: '每日理想的睡眠时长', unit: '小时' },
  maxRestingHR: { label: '静息心率上限', desc: '超过此值视为静息心率偏高', unit: 'bpm' },
  minRestingHR: { label: '静息心率下限', desc: '低于此值视为静息心率偏低', unit: 'bpm' },
  minHRV: { label: 'HRV 下限', desc: '低于此值视为心率变异性偏低', unit: 'ms' },
  minDailySteps: { label: '每日最少步数', desc: '低于此值视为活动量不足', unit: '步' },
  dailyStepsGoal: { label: '每日步数目标', desc: '每日期望达到的步数', unit: '步' },
  workoutSpikeThreshold: { label: '运动量突增比例', desc: '超过此比例视为运动量突增', unit: '%' },
  maxSleepDebtHours: { label: '最大可接受睡眠债', desc: '超过此值视为睡眠债累积风险', unit: '小时' },
  consecutivePoorSleepDays: { label: '连续睡眠不足天数', desc: '连续此天数睡眠不足触发警告', unit: '天' },
  dataMissingThreshold: { label: '数据缺失阈值', desc: '连续此天数无数据视为缺失', unit: '天' },
};

const Settings = () => {
  const { 
    thresholds, 
    thresholdsLoading, 
    fetchThresholds,
    saveThresholds,
    resetThresholds,
    showNotification,
  } = useStore();
  
  const [activeCategory, setActiveCategory] = useState('sleep');
  const [editingThresholds, setEditingThresholds] = useState({});
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    fetchThresholds();
  }, []);
  
  useEffect(() => {
    if (thresholds && thresholds.length > 0) {
      const map = {};
      thresholds.forEach(t => {
        const key = `${t.category}_${t.key}`;
        map[key] = t.value;
      });
      setEditingThresholds(map);
    }
  }, [thresholds]);
  
  const groupedThresholds = thresholds.reduce((acc, t) => {
    const cat = t.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});
  
  const displayThresholds = groupedThresholds[activeCategory] || [];
  
  const handleValueChange = (category, key, value) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) || value === '') {
      setEditingThresholds(prev => ({
        ...prev,
        [`${category}_${key}`]: isNaN(numValue) ? '' : numValue,
      }));
    }
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const toUpdate = [];
      
      thresholds.forEach(t => {
        const key = `${t.category}_${t.key}`;
        if (editingThresholds[key] !== undefined && editingThresholds[key] !== t.value) {
          toUpdate.push({
            category: t.category,
            key: t.key,
            value: editingThresholds[key],
          });
        }
      });
      
      if (toUpdate.length > 0) {
        await saveThresholds(toUpdate);
        showNotification('阈值已保存', 'success');
      } else {
        showNotification('没有需要保存的更改', 'info');
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };
  
  const handleReset = async (category) => {
    try {
      await resetThresholds([category]);
      showNotification('阈值已重置为默认值', 'success');
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };
  
  const handleResetAll = async () => {
    try {
      await resetThresholds(Object.keys(groupedThresholds));
      showNotification('所有阈值已重置为默认值', 'success');
    } catch (err) {
      console.error('Reset all failed:', err);
    }
  };
  
  if (thresholdsLoading && (!thresholds || thresholds.length === 0)) {
    return <LoadingOverlay message="加载阈值配置..." />;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">阈值设置</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleResetAll}>
            重置全部
          </Button>
          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4 mr-2" />
            保存更改
          </Button>
        </div>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <Tabs
            tabs={categories.map(c => ({
              value: c.value,
              label: c.label,
              icon: <c.icon className="w-4 h-4" />,
            }))}
            activeTab={activeCategory}
            onChange={setActiveCategory}
            className="border-b border-gray-200 dark:border-gray-700 rounded-none"
          />
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        {displayThresholds.length === 0 ? (
          <EmptyState
            icon={SettingsIcon}
            title="暂无阈值配置"
            description={`${categoryLabels[activeCategory] || activeCategory}分类暂无阈值设置`}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {categoryLabels[activeCategory] || activeCategory}阈值
              </h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleReset(activeCategory)}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重置此分类
              </Button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {displayThresholds.map((threshold) => {
                const key = `${threshold.category}_${threshold.key}`;
                const info = thresholdDescriptions[threshold.key] || {};
                const value = editingThresholds[key] !== undefined 
                  ? editingThresholds[key] 
                  : threshold.value;
                
                return (
                  <Card key={key}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {info.label || threshold.key}
                            </h3>
                            {threshold.unit && (
                              <Badge variant="default">{threshold.unit}</Badge>
                            )}
                          </div>
                          {info.desc && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {info.desc}
                            </p>
                          )}
                        </div>
                        <div className="w-32">
                          <Input
                            type="number"
                            value={value}
                            onChange={(e) => handleValueChange(threshold.category, threshold.key, e.target.value)}
                            className={cn(
                              'text-center',
                              value !== threshold.value && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            )}
                          />
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>
                            默认值: {threshold.defaultValue ?? '未设置'}
                            {threshold.defaultValueUnit || ''}
                          </span>
                          {threshold.min !== undefined && (
                            <span>最小值: {threshold.min}</span>
                          )}
                          {threshold.max !== undefined && (
                            <span>最大值: {threshold.max}</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">关于阈值</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-gray-600 dark:text-gray-400">
              阈值设置用于异常检测算法，调整这些值可以让异常检测更符合您的个人情况。
            </p>
            <ul className="text-gray-600 dark:text-gray-400 space-y-1 mt-4">
              <li>• <strong>睡眠阈值</strong>：影响"睡眠不足"和"睡眠债累积"的异常检测</li>
              <li>• <strong>心率阈值</strong>：影响"静息心率偏高/偏低"的异常检测</li>
              <li>• <strong>步数阈值</strong>：影响"活动量过低"的异常检测</li>
              <li>• <strong>运动阈值</strong>：影响"运动量突增"的异常检测</li>
              <li>• <strong>恢复阈值</strong>：影响"恢复不足警告"的异常检测</li>
            </ul>
            <p className="text-gray-600 dark:text-gray-400 mt-4">
              修改阈值后，建议重新运行异常检测以获得更新后的结果。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
