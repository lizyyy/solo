import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Play, ChevronRight, ChevronLeft, Check, Music, Users, Gamepad2, FileText, RotateCcw, Download, Settings, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { importSampleData } from '@/data/sample';
import { useGameStore, initializeGameData } from '@/store/useGameStore';
import { useMaterialStore, initializeMaterialData } from '@/store/useMaterialStore';

const steps = [
  {
    id: 1,
    title: '导入样例数据',
    icon: Settings,
    description: '初始化系统，加载预设的和弦库、乐句库、班级和游戏数据',
    code: `// 入口函数
import { importSampleData } from '@/data/sample';

// 一键导入所有样例数据
importSampleData();

// 数据包含：
// - 12个爵士和弦（Cmaj7, Dm7, G7等）
// - 12个预设乐句（含正确和错误示例）
// - 5个和弦进行（II-V-I, 12小节布鲁斯等）
// - 1个班级（5名学生）+ 班级码 JAZZ2024
// - 3个游戏任务 + 3个完成的会话记录`,
    action: '导入数据',
  },
  {
    id: 2,
    title: '浏览材料库',
    icon: Music,
    description: '查看系统中的和弦、乐句、和弦进行和节奏模式',
    code: `// 材料库访问入口
// 路径: /materials

// 和弦库 - 12个预设爵士和弦
// 每个和弦包含:
// - 和弦内音 (allowedNotes)
// - 经过音 (passingNotes)
// - 和弦类型 (quality)

// 乐句库 - 12个预设乐句
// 包含正确示例和错误示例:
// - phrase-011: 和弦外音示例（数据问题）
// - phrase-012: 超拍示例（规则问题）

// 和弦进行 - 5种经典进行
// 节奏模式 - 5种不同BPM和摇摆系数`,
    action: '查看材料库',
    route: '/materials',
  },
  {
    id: 3,
    title: '查看游戏列表',
    icon: Gamepad2,
    description: '浏览教师发布的即兴游戏任务，了解作业状态',
    code: `// 游戏大厅入口
// 路径: /lobby

// 游戏状态:
// - 待开始: 未到开始时间
// - 进行中: 可以开始作答
// - 已完成: 已提交成绩
// - 已过期: 超过截止日期

// 筛选功能:
// - 全部 / 待完成 / 已完成
// - 按截止日期排序`,
    action: '进入游戏大厅',
    route: '/lobby',
  },
  {
    id: 4,
    title: '开始即兴游戏',
    icon: Play,
    description: '体验核心玩法：为每个和弦小节选择合适的乐句',
    code: `// 游戏主界面入口
// 路径: /game/:gameId

// 核心流程:
// 1. 查看当前小节的和弦（如 Dm7）
// 2. 浏览可用乐句列表
// 3. 选择乐句后查看实时分析:
//    - 和弦匹配度评分
//    - 优点和改进点
//    - 扣分原因预览
// 4. 确认选择，进入下一小节
// 5. 完成所有小节后自动结算

// 核心算法:
// - 和弦评分: 内音100% / 经过音70% / 外音0分
// - 节拍评分: 检查超拍、节拍错位
// - 综合评分: 和弦50% + 节拍50% + 完成度奖励5分`,
    action: '开始游戏',
    route: '/game/game-001',
  },
  {
    id: 5,
    title: '查看结算报告',
    icon: FileText,
    description: '获取完整的评分报告，包含关键选择、扣分原因和改进建议',
    code: `// 结算页面入口
// 路径: /results/:sessionId

// 报告内容:
// 1. 综合评分 + 等级 (S/A/B/C/D/F)
// 2. 分项得分: 和弦得分 / 节拍得分
// 3. 错误分类统计:
//    - 数据问题 (橙色): 和弦外音、音高偏差
//    - 规则问题 (红色): 小节超拍、节拍错位
//    - 材料问题 (紫色): 重复乐句、材料不足
// 4. 扣分详情列表
// 5. 关键选择分析（每个小节的选择）
// 6. 个性化改进建议

// 等级评定:
// S(95+) / A(90+) / B(80+) / C(70+) / D(60+) / F(<60)`,
    action: '查看样例报告',
    route: '/results/session-001',
  },
  {
    id: 6,
    title: '错误回放分析',
    icon: RotateCcw,
    description: '逐小节回放演奏，定位错误位置，理解扣分原因',
    code: `// 错误回放入口
// 路径: /playback/:sessionId

// 功能特性:
// 1. 播放控制: 播放/暂停 / 上/下小节 / 进度拖拽
// 2. 倍速播放: 0.5x / 0.75x / 1x / 1.25x / 1.5x
// 3. 错误筛选: 按数据/规则/材料问题筛选
// 4. 实时高亮: 播放到错误位置时动画提示
// 5. 小节导航: 网格显示所有小节状态
// 6. 错误详情: 每个错误的具体说明和建议`,
    action: '回放样例',
    route: '/playback/session-001',
  },
  {
    id: 7,
    title: '教师控制台',
    icon: Users,
    description: '管理班级、游戏、学生进度，确认成绩',
    code: `// 教师控制台入口
// 路径: /console

// 四大功能模块:
// 1. 概览: 统计卡片 + 等级分布 + 游戏进度
// 2. 游戏管理: 查看每个游戏的完成情况
// 3. 学生进度: 追踪每个学生的学习轨迹
// 4. 待确认: 列出未确认的成绩，一键确认

// 解决痛点:
// - 一目了然谁改过、谁还没确认
// - 避免月底遗漏学生进度
// - 支持批量确认成绩`,
    action: '进入控制台',
    route: '/console',
  },
  {
    id: 8,
    title: '报告中心与导出',
    icon: Download,
    description: '查看所有成绩报告，支持PDF/CSV/JSON格式导出',
    code: `// 报告中心入口
// 路径: /reports

// 功能特性:
// 1. 统计概览: 总报告数 / 平均分 / 优秀率 / 总错误数
// 2. 可视化图表: 等级分布柱状图 / 错误类型饼图
// 3. 成绩列表: 支持搜索、按游戏筛选、按等级筛选
// 4. 导出功能:
//    - PDF: 完整格式报告（评分+错误+建议）
//    - CSV: 表格数据，适合Excel分析
//    - JSON: 结构化数据，适合程序处理

// 导出函数入口:
// import { exportSession, exportClassReport } from '@/utils/export';
// exportSession(session, 'pdf');`,
    action: '进入报告中心',
    route: '/reports',
  },
];

const SampleGuide: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const navigate = useNavigate();
  const { loadGames, loadSessions } = useGameStore();
  const { loadMaterials } = useMaterialStore();

  const handleImportData = () => {
    importSampleData();
    initializeGameData();
    initializeMaterialData();
    setCompletedSteps([...completedSteps, 1]);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAction = () => {
    const step = steps[currentStep];
    if (step.id === 1) {
      handleImportData();
    } else if (step.route) {
      if (!completedSteps.includes(step.id)) {
        setCompletedSteps([...completedSteps, step.id]);
      }
      navigate(step.route);
    }
  };

  const handleMarkComplete = () => {
    const step = steps[currentStep];
    if (!completedSteps.includes(step.id)) {
      setCompletedSteps([...completedSteps, step.id]);
    }
  };

  const step = steps[currentStep];
  const IconComponent = step.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-jazz-bg via-jazz-bg/95 to-jazz-bgDark">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-jazz-gold to-jazz-goldDark flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-jazz-bg" />
            </div>
            <h1 className="font-display text-3xl font-bold text-jazz-gold">
              新人交接样例流程
            </h1>
          </div>
          <p className="text-jazz-textMuted max-w-2xl mx-auto">
            按照以下步骤，从导入数据到生成报告，完整体验系统的核心功能。每个步骤都包含代码入口说明。
          </p>
        </div>

        <div className="flex items-center justify-between mb-8">
          {steps.map((s, idx) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all ${
                    idx < currentStep
                      ? 'bg-jazz-green text-white'
                      : idx === currentStep
                      ? 'bg-jazz-gold text-jazz-bg ring-4 ring-jazz-gold/30'
                      : completedSteps.includes(s.id)
                      ? 'bg-jazz-green/20 text-jazz-green border-2 border-jazz-green'
                      : 'bg-jazz-bg border-2 border-jazz-border text-jazz-textMuted'
                  }`}
                >
                  {completedSteps.includes(s.id) || idx < currentStep ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    s.id
                  )}
                </div>
                <span className={`text-xs mt-2 max-w-[80px] text-center ${
                  idx === currentStep ? 'text-jazz-gold font-medium' : 'text-jazz-textMuted'
                }`}>
                  {s.title}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${
                  idx < currentStep ? 'bg-jazz-green' : 'bg-jazz-border'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          <Card glass className="md:col-span-3 p-6">
            <CardHeader className="flex flex-row items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl bg-jazz-gold/20 flex items-center justify-center">
                <IconComponent className="w-7 h-7 text-jazz-gold" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-2xl text-jazz-gold">
                    步骤 {step.id}: {step.title}
                  </h2>
                  {completedSteps.includes(step.id) && (
                    <Badge variant="success">已完成</Badge>
                  )}
                </div>
                <p className="text-jazz-textMuted mt-1">{step.description}</p>
              </div>
            </CardHeader>

            <CardContent>
              <div className="bg-jazz-bg/80 rounded-xl p-4 border border-jazz-border/50 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono text-jazz-gold px-2 py-1 bg-jazz-gold/10 rounded">
                    代码入口
                  </span>
                </div>
                <pre className="text-sm font-mono text-jazz-text leading-relaxed whitespace-pre-wrap overflow-x-auto">
                  {step.code}
                </pre>
              </div>

              <div className="flex gap-3">
                {step.id === 1 ? (
                  <Button
                    variant="brass"
                    onClick={handleAction}
                    disabled={completedSteps.includes(1)}
                    className="gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    {completedSteps.includes(1) ? '已导入' : step.action}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="brass"
                      onClick={handleAction}
                      className="gap-2"
                    >
                      <ArrowRight className="w-4 h-4" />
                      {step.action}
                    </Button>
                    {!completedSteps.includes(step.id) && (
                      <Button
                        variant="ghost"
                        onClick={handleMarkComplete}
                        className="gap-2"
                      >
                        <Check className="w-4 h-4" />
                        标记为已完成
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card glass className="md:col-span-2 p-6">
            <h3 className="font-display text-lg text-jazz-gold mb-4">进度概览</h3>
            <div className="space-y-2 mb-6">
              {steps.map((s, idx) => {
                const StepIcon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setCurrentStep(idx)}
                    className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-3 ${
                      idx === currentStep
                        ? 'bg-jazz-gold/20 border border-jazz-gold/50'
                        : 'hover:bg-jazz-bg/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      completedSteps.includes(s.id)
                        ? 'bg-jazz-green/20 text-jazz-green'
                        : idx === currentStep
                        ? 'bg-jazz-gold/30 text-jazz-gold'
                        : 'bg-jazz-bg text-jazz-textMuted'
                    }`}>
                      {completedSteps.includes(s.id) ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <StepIcon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${
                        idx === currentStep ? 'text-jazz-gold' : 'text-jazz-text'
                      }`}>
                        {s.title}
                      </p>
                      <p className="text-xs text-jazz-textMuted truncate">
                        {s.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-jazz-border/50">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-jazz-textMuted">完成进度</span>
                <span className="text-jazz-gold font-medium">
                  {completedSteps.length} / {steps.length}
                </span>
              </div>
              <div className="w-full h-2 bg-jazz-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-jazz-gold to-jazz-goldLight transition-all"
                  style={{ width: `${(completedSteps.length / steps.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="flex-1 gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                上一步
              </Button>
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={currentStep === steps.length - 1}
                className="flex-1 gap-2"
              >
                下一步
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-jazz-textMuted text-sm">
            完成所有步骤后，您将了解系统的完整工作流程。返回登录页可切换学生/教师角色进行实际操作。
          </p>
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mt-4 gap-2 text-jazz-gold"
          >
            返回登录页
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SampleGuide;
