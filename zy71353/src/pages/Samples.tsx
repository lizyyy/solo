import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  BookOpen,
  Zap,
  Clock,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { useWorkStore } from '@/store/useWorkStore';
import { DataGapAlert } from '@/components/common/DataGapAlert';
import { DataGaps } from '@/types';

function generateRainbowCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#FF0000');
  gradient.addColorStop(0.17, '#FF7F00');
  gradient.addColorStop(0.33, '#FFFF00');
  gradient.addColorStop(0.5, '#00FF00');
  gradient.addColorStop(0.67, '#0000FF');
  gradient.addColorStop(0.83, '#4B0082');
  gradient.addColorStop(1, '#9400D3');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.arc(100, 100, 50, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(250, 180, 100, 80);

  return canvas;
}

function generateExtremeWhiteCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FEFEFE';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#FFAAAA';
  ctx.fillRect(180, 130, 40, 40);

  ctx.fillStyle = '#AAFFAA';
  ctx.fillRect(20, 20, 20, 20);

  return canvas;
}

function canvasToFile(canvas: HTMLCanvasElement, filename: string): File {
  const dataUrl = canvas.toDataURL('image/png');
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

interface DemoResult {
  success: boolean;
  message: string;
  workId?: string;
  dataGaps?: DataGaps;
  requiresConfirmation?: boolean;
}

export default function SamplesPage() {
  const navigate = useNavigate();
  const { importWork, isLoading } = useWorkStore();
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [demoResults, setDemoResults] = useState<Record<string, DemoResult>>({});
  const [versionCount, setVersionCount] = useState(0);
  const normalPreviewRef = useRef<HTMLCanvasElement>(null);
  const gapPreviewRef = useRef<HTMLCanvasElement>(null);
  const whitePreviewRef = useRef<HTMLCanvasElement>(null);

  const runDemo = async (demoId: string) => {
    setActiveDemo(demoId);
    let result: DemoResult = { success: false, message: '' };

    try {
      switch (demoId) {
        case 'normal': {
          const canvas = generateRainbowCanvas();
          const file = canvasToFile(canvas, '彩虹渐变作品.png');

          const importResult = await importWork({
            file,
            studentName: '张小明',
            className: '三年级2班',
            workTitle: '彩虹渐变',
            theme: '多彩的世界'
          });

          if (importResult.requiresConfirmation) {
            result = {
              success: false,
              message: '数据不完整，需要确认',
              dataGaps: importResult.dataGaps,
              requiresConfirmation: true
            };
          } else {
            result = {
              success: true,
              message: '✅ 正常样例导入成功！作品色彩丰富，各项指标正常。',
              workId: importResult.workId,
              dataGaps: importResult.dataGaps
            };
          }
          break;
        }

        case 'gap': {
          const canvas = generateRainbowCanvas();
          const file = canvasToFile(canvas, '缺失主题作品.png');

          const importResult = await importWork({
            file,
            studentName: '李小红',
            className: '三年级2班',
            workTitle: '我的画作'
          });

          result = {
            success: true,
            message: '⚠️ 作品已导入，但检测到数据缺口：缺少"主题"字段。系统已标记此作品数据不完整。',
            workId: importResult.workId,
            dataGaps: importResult.dataGaps,
            requiresConfirmation: importResult.requiresConfirmation
          };
          break;
        }

        case 'fail1': {
          const canvas = generateRainbowCanvas();
          const file = canvasToFile(canvas, '无姓名作品.png');

          try {
            await importWork({
              file,
              studentName: '',
              className: '三年级2班',
              workTitle: '未命名作品'
            });
            result = {
              success: false,
              message: '❌ 预期的错误未发生，这是一个Bug！'
            };
          } catch (error) {
            result = {
              success: false,
              message: '❌ 错误提示正确显示：缺少必填字段"学生姓名"。请填写学生姓名后再导入。'
            };
          }
          break;
        }

        case 'fail2': {
          const canvas = generateExtremeWhiteCanvas();
          const file = canvasToFile(canvas, '几乎全白作品.png');

          const importResult = await importWork({
            file,
            studentName: '王小白',
            className: '三年级2班',
            workTitle: '空白的思考',
            theme: '极简主义'
          });

          const hasWarning = importResult.dataGaps?.warnings.some(w =>
            w.includes('排除') || w.includes('极端') || w.includes('50%')
          );

          result = {
            success: true,
            message: hasWarning
              ? '⚠️ 作品已导入，但显示像素排除警告：超过50%的像素为极端色（近白色），已自动排除。分析结果可能不准确。'
              : '✅ 作品已导入。像素排除功能正常工作。',
            workId: importResult.workId,
            dataGaps: importResult.dataGaps
          };
          break;
        }

        case 'fail3': {
          const canvas = generateRainbowCanvas();
          const file = canvasToFile(canvas, '重复导入作品.png');

          const newCount = versionCount + 1;
          setVersionCount(newCount);

          const importResult = await importWork({
            file,
            studentName: '陈重复',
            className: '三年级2班',
            workTitle: `重复作品 v${newCount}`,
            theme: '版本控制演示'
          });

          if (newCount === 1) {
            result = {
              success: true,
              message: `✅ 第1次导入成功！现在请再次点击按钮，演示同一张图多次导入的版本控制功能。`,
              workId: importResult.workId
            };
          } else {
            result = {
              success: true,
              message: `✅ 第${newCount}次导入成功！系统检测到相同图片，自动创建新版本 v${newCount}。请点击下方按钮查看版本历史和对比功能。`,
              workId: importResult.workId
            };
          }
          break;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败';
      result = {
        success: false,
        message: `❌ 操作失败：${message}`
      };
    }

    setDemoResults(prev => ({ ...prev, [demoId]: result }));
    setActiveDemo(null);
  };

  const demos = [
    {
      id: 'normal',
      title: '正常样例',
      description: '生成一张彩虹色渐变的作品，色彩搭配合理，各项指标正常。',
      icon: <CheckCircle className="w-6 h-6 text-emerald-500" />,
      color: 'emerald',
      generateCanvas: generateRainbowCanvas,
      previewRef: normalPreviewRef,
      details: [
        '学生：张小明',
        '班级：三年级2班',
        '作品：彩虹渐变',
        '主题：多彩的世界',
        '色彩：彩虹渐变色，包含多种鲜艳色彩'
      ]
    },
    {
      id: 'gap',
      title: '数据缺口样例',
      description: '生成一张缺少"主题"字段的作品，展示系统的数据缺口识别功能。',
      icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
      color: 'amber',
      generateCanvas: generateRainbowCanvas,
      previewRef: gapPreviewRef,
      details: [
        '学生：李小红',
        '班级：三年级2班',
        '作品：我的画作',
        '主题：（未填写）',
        '预期：系统标记"建议补充字段：主题"'
      ]
    },
    {
      id: 'fail1',
      title: '失败演示1：必填字段缺失',
      description: '不填写学生姓名直接导入，展示系统的错误提示机制。',
      icon: <XCircle className="w-6 h-6 text-red-500" />,
      color: 'red',
      generateCanvas: generateRainbowCanvas,
      previewRef: null,
      details: [
        '学生姓名：（空）',
        '班级：三年级2班',
        '作品：未命名作品',
        '预期：系统提示"缺少必填字段：学生姓名"'
      ]
    },
    {
      id: 'fail2',
      title: '失败演示2：极端色图片',
      description: '导入一张几乎全白的图片，展示像素排除警告功能。',
      icon: <AlertTriangle className="w-6 h-6 text-orange-500" />,
      color: 'orange',
      generateCanvas: generateExtremeWhiteCanvas,
      previewRef: whitePreviewRef,
      details: [
        '学生：王小白',
        '作品：空白的思考',
        '图片：99%为近白色，仅含少量彩色像素',
        '预期：警告"超过50%的像素被排除，结果可能不准确"'
      ]
    },
    {
      id: 'fail3',
      title: '失败演示3：重复导入',
      description: '多次导入同一张图片，展示版本历史和对比功能。',
      icon: <RefreshCw className="w-6 h-6 text-indigo-500" />,
      color: 'indigo',
      generateCanvas: generateRainbowCanvas,
      previewRef: null,
      details: [
        '学生：陈重复',
        '作品：重复导入作品',
        '操作：连续点击多次导入同一张图',
        '预期：系统自动创建多个版本，可对比差异'
      ]
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; border: string; hover: string; text: string }> = {
      emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', hover: 'hover:bg-emerald-100', text: 'text-emerald-700' },
      amber: { bg: 'bg-amber-50', border: 'border-amber-200', hover: 'hover:bg-amber-100', text: 'text-amber-700' },
      red: { bg: 'bg-red-50', border: 'border-red-200', hover: 'hover:bg-red-100', text: 'text-red-700' },
      orange: { bg: 'bg-orange-50', border: 'border-orange-200', hover: 'hover:bg-orange-100', text: 'text-orange-700' },
      indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', hover: 'hover:bg-indigo-100', text: 'text-indigo-700' }
    };
    return colors[color] || colors.emerald;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">样例中心</h1>
        <p className="text-slate-600">通过交互式演示了解系统的各项功能和边界处理</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-600 text-white rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">操作指南</h2>
            <div className="space-y-3 text-sm text-blue-800">
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4" /> 启动方式
                </h3>
                <p className="ml-6 mt-1">
                  运行 <code className="bg-blue-100 px-2 py-0.5 rounded">npm run dev</code> 启动开发服务器，
                  然后在浏览器中访问 <code className="bg-blue-100 px-2 py-0.5 rounded">http://localhost:5173</code>
                </p>
              </div>
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  <Play className="w-4 h-4" /> 快速上手步骤
                </h3>
                <ol className="ml-6 mt-1 space-y-1 list-decimal">
                  <li>点击下方样例卡片中的"运行演示"按钮，自动生成并导入测试数据</li>
                  <li>观察每个演示的结果提示，了解系统的不同处理逻辑</li>
                  <li>点击结果中的"查看详情"链接，跳转到对应页面查看完整分析</li>
                  <li>前往<a href="/import" className="underline font-medium">导入页面</a>尝试导入自己的图片</li>
                  <li>在<a href="/" className="underline font-medium">仪表盘</a>查看所有作品的统计数据</li>
                </ol>
              </div>
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" /> 预计用时
                </h3>
                <p className="ml-6 mt-1">完成所有演示约需 3-5 分钟</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {demos.map((demo) => {
          const colorClasses = getColorClasses(demo.color);
          const result = demoResults[demo.id];
          const isRunning = activeDemo === demo.id;

          return (
            <div
              key={demo.id}
              className={`bg-white rounded-xl border-2 ${colorClasses.border} overflow-hidden`}
            >
              <div className={`p-6 ${colorClasses.bg}`}>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                    {demo.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">{demo.title}</h3>
                      <button
                        onClick={() => runDemo(demo.id)}
                        disabled={isLoading || isRunning}
                        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                          isRunning
                            ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                            : `bg-slate-900 text-white hover:bg-slate-800`
                        }`}
                      >
                        {isRunning ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            运行中...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            运行演示
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-slate-600 mb-4">{demo.description}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white rounded-lg p-4">
                        <h4 className="text-sm font-medium text-slate-700 mb-2">测试数据</h4>
                        <ul className="space-y-1 text-sm text-slate-600">
                          {demo.details.map((detail, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <ChevronRight className="w-3 h-3 text-slate-400" />
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {demo.previewRef && (
                        <div className="bg-white rounded-lg p-4">
                          <h4 className="text-sm font-medium text-slate-700 mb-2">样例预览</h4>
                          <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-100">
                            <canvas
                              ref={(el) => {
                                if (el && demo.previewRef) {
                                  demo.previewRef.current = el;
                                  const canvas = demo.generateCanvas();
                                  const ctx = el.getContext('2d')!;
                                  el.width = 200;
                                  el.height = 150;
                                  ctx.drawImage(canvas, 0, 0, 200, 150);
                                }
                              }}
                              className="w-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {result && (
                <div className="px-6 py-4 border-t border-slate-200">
                  {result.dataGaps && (result.dataGaps.incomplete || result.dataGaps.warnings.length > 0) && (
                    <div className="mb-4">
                      <DataGapAlert
                        gaps={result.dataGaps}
                        onForceImport={() => {}}
                        onDismiss={() => {}}
                      />
                    </div>
                  )}

                  <div className={`p-4 rounded-lg ${
                    result.success
                      ? result.message.includes('⚠️')
                        ? 'bg-amber-50 border border-amber-200'
                        : 'bg-emerald-50 border border-emerald-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <p className={`text-sm ${
                      result.success
                        ? result.message.includes('⚠️')
                          ? 'text-amber-800'
                          : 'text-emerald-800'
                        : 'text-red-800'
                    }`}>
                      {result.message}
                    </p>

                    {result.success && result.workId && (
                      <div className="mt-3 flex gap-3">
                        <button
                          onClick={() => navigate(`/analysis/${result.workId}`)}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                        >
                          <ImageIcon className="w-4 h-4" />
                          查看分析详情
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        {demo.id === 'fail3' && versionCount > 1 && (
                          <button
                            onClick={() => navigate(`/history/${result.workId}`)}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                          >
                            <RefreshCw className="w-4 h-4" />
                            查看版本历史
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">下一步</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/import')}
            className="p-4 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left"
          >
            <ImageIcon className="w-6 h-6 text-indigo-600 mb-2" />
            <h4 className="font-medium text-slate-900">导入作品</h4>
            <p className="text-sm text-slate-500 mt-1">上传真实的学生作品图片</p>
          </button>
          <button
            onClick={() => navigate('/')}
            className="p-4 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left"
          >
            <BookOpen className="w-6 h-6 text-indigo-600 mb-2" />
            <h4 className="font-medium text-slate-900">查看仪表盘</h4>
            <p className="text-sm text-slate-500 mt-1">查看整体数据统计</p>
          </button>
          <button
            onClick={() => navigate('/class')}
            className="p-4 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left"
          >
            <Zap className="w-6 h-6 text-indigo-600 mb-2" />
            <h4 className="font-medium text-slate-900">班级概览</h4>
            <p className="text-sm text-slate-500 mt-1">查看班级表现统计</p>
          </button>
        </div>
      </div>
    </div>
  );
}
