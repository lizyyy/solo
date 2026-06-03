import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileJson, Play, Database } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { sampleProjects, samplePoints, sampleRoutes, sampleObstacles } from '../data/sampleData';

export function ImportPage() {
  const navigate = useNavigate();
  const { importProjectData } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'sample' | 'json'>('sample');
  const [jsonInput, setJsonInput] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const quickSamples = [
    {
      id: 'demo-1',
      name: '车展主舞台吊点系统',
      description: '完整正常项目，无问题路线',
      status: 'normal'
    },
    {
      id: 'demo-2',
      name: '新品发布会舞台',
      description: '含补录路线未计算问题，标准演示用例',
      status: 'warning'
    },
    {
      id: 'demo-3',
      name: '颁奖典礼多楼层舞台',
      description: '多楼层复杂吊点系统，多个待处理问题',
      status: 'pending_review'
    }
  ];

  const handleLoadSample = (sampleId: string) => {
    const sampleProject = sampleProjects.find(p => p.id === sampleId);
    if (!sampleProject) return;

    const points = samplePoints[sampleId] || [];
    const routes = sampleRoutes[sampleId] || [];
    const obstacles = sampleObstacles[sampleId]?.map(o => ({
      routeId: o.routeId,
      content: o.content,
      imageUrl: o.imageUrl,
      createdBy: o.createdBy
    })) || [];

    importProjectData({
      project: {
        name: sampleProject.name,
        description: sampleProject.description,
        status: sampleProject.status,
        stage: sampleProject.stage
      },
      points,
      routes,
      obstacles
    });

    setImportStatus('success');
    setTimeout(() => {
      navigate('/');
    }, 1000);
  };

  const handleJsonImport = () => {
    try {
      const data = JSON.parse(jsonInput);
      
      if (!data.project || !data.points || !data.routes) {
        throw new Error('数据格式不正确，需要包含 project、points、routes');
      }

      importProjectData({
        project: {
          name: data.project.name || '未命名项目',
          description: data.project.description || '',
          status: data.project.status || 'warning',
          stage: data.project.stage || 'detection'
        },
        points: data.points,
        routes: data.routes,
        obstacles: data.obstacles
      });

      setImportStatus('success');
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (e) {
      setImportStatus('error');
    }
  };

  const loadAllSamples = () => {
    sampleProjects.forEach((project, index) => {
      setTimeout(() => {
        const points = samplePoints[project.id] || [];
        const routes = sampleRoutes[project.id] || [];
        const obstacles = sampleObstacles[project.id]?.map(o => ({
          routeId: o.routeId,
          content: o.content,
          imageUrl: o.imageUrl,
          createdBy: o.createdBy
        })) || [];

        importProjectData({
          project: {
            name: project.name,
            description: project.description,
            status: project.status,
            stage: project.stage
          },
          points,
          routes,
          obstacles
        });

        if (index === sampleProjects.length - 1) {
          setImportStatus('success');
          setTimeout(() => navigate('/'), 1000);
        }
      }, index * 100);
    });
  };

  const sampleJsonTemplate = JSON.stringify({
    project: {
      name: "示例项目",
      description: "项目描述",
      status: "warning",
      stage: "detection"
    },
    points: [
      { id: "P1", name: "吊点1", x: -4, y: 0, z: 3, load: 500, status: "normal" },
      { id: "P2", name: "吊点2", x: 0, y: 0, z: 3.5, load: 800, status: "normal" }
    ],
    routes: [
      {
        id: "R1",
        name: "补录路线-1",
        fromPoint: "P1",
        toPoint: "P2",
        length: 4.03,
        calculatedLength: 5.02,
        isSupplementary: true,
        recalculated: false,
        hasWarning: true
      }
    ],
    obstacles: [
      {
        routeId: "R1",
        content: "现场发现障碍物，需调整路线",
        createdBy: "designer"
      }
    ]
  }, null, 2);

  return (
    <div className="min-h-screen bg-industrial-50">
      <header className="bg-white border-b border-industrial-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-industrial-50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-industrial-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-industrial-600">数据导入</h1>
              <p className="text-sm text-industrial-400">导入路线数据和障碍物备注</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {importStatus === 'success' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            ✓ 导入成功，正在跳转...
          </div>
        )}

        {importStatus === 'error' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            ✗ 导入失败，请检查JSON格式
          </div>
        )}

        <div className="bg-white rounded-xl shadow-card border border-industrial-100 overflow-hidden mb-6">
          <div className="flex border-b border-industrial-100">
            <button
              onClick={() => setActiveTab('sample')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'sample'
                  ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50'
                  : 'text-industrial-400 hover:text-industrial-600'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Play className="w-4 h-4" />
                快速加载样例
              </div>
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'json'
                  ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50'
                  : 'text-industrial-400 hover:text-industrial-600'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FileJson className="w-4 h-4" />
                JSON 数据导入
              </div>
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'sample' ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-industrial-400">选择一个样例项目快速体验完整流程</p>
                  <button
                    onClick={loadAllSamples}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors text-sm"
                  >
                    <Database className="w-4 h-4" />
                    加载全部样例
                  </button>
                </div>

                <div className="grid gap-4">
                  {quickSamples.map((sample) => (
                    <div
                      key={sample.id}
                      className="flex items-center justify-between p-4 bg-industrial-50 rounded-lg hover:bg-industrial-100 transition-colors cursor-pointer group"
                      onClick={() => handleLoadSample(sample.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                          <Play className="w-6 h-6 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-industrial-600">{sample.name}</h3>
                          <p className="text-sm text-industrial-400">{sample.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-3 py-1 rounded-full ${
                          sample.status === 'normal' ? 'bg-green-50 text-success-500' :
                          sample.status === 'warning' ? 'bg-warning-50 text-warning-500' :
                          'bg-primary-50 text-primary-600'
                        }`}>
                          {sample.status === 'normal' ? '正常' : sample.status === 'warning' ? '含问题' : '待复核'}
                        </span>
                        <Upload className="w-5 h-5 text-industrial-300 group-hover:text-primary-500 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-primary-50 rounded-lg">
                  <h4 className="text-sm font-medium text-primary-600 mb-2">💡 推荐体验流程</h4>
                  <ol className="text-sm text-primary-700 space-y-1">
                    <li>1. 加载「新品发布会舞台」样例（含标准问题场景）</li>
                    <li>2. 进入项目查看3D视图和检测到的问题</li>
                    <li>3. 点击「补录楼层剖面草图」补充材料</li>
                    <li>4. 以展陈客户身份复核确认解决</li>
                    <li>5. 导出带完整说明的报告截图</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-industrial-400">粘贴JSON格式的项目数据进行导入</p>
                
                <div>
                  <label className="block text-sm font-medium text-industrial-500 mb-2">JSON 数据</label>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder={sampleJsonTemplate}
                    className="w-full h-64 px-4 py-3 font-mono text-sm border border-industrial-200 rounded-lg focus:outline-none focus:border-primary-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setJsonInput(sampleJsonTemplate)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    填入示例模板
                  </button>
                  <button
                    onClick={handleJsonImport}
                    disabled={!jsonInput.trim()}
                    className="flex items-center gap-2 px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    导入数据
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
