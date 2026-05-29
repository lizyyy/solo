import { useState, useCallback } from 'react';
import { Upload, FileText, Search, CheckCircle, AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react';
import { useStore } from '../store';
import { Card, CardHeader, CardContent, CardFooter } from '../components/Card';
import { Button } from '../components/Button';
import { StepTimeline } from '../components/StepTimeline';
import { StatusBadge } from '../components/StatusBadge';
import { RiskBadge } from '../components/RiskBadge';
import type { FontFile, AuditStep, AuditStepType, Project } from '../types';
import { fontApi, licenseApi, riskApi, channelApi } from '../services/api';

const stepTypes: AuditStepType[] = ['upload', 'recognize', 'match', 'validate', 'analyze', 'report'];

export function AuditWorkbench() {
  const {
    audit,
    projects,
    channels,
    setAuditStep,
    setUploadedFile,
    setRecognizedFonts,
    setMatchedLicense,
    setValidatedChannel,
    addAuditStep,
    setAuditRisks,
    setSelectedProject,
    resetAudit,
    generateReport,
    loadProjects,
    loadChannels
  } = useStore();

  const [isDragging, setIsDragging] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [generatedReportId, setGeneratedReportId] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (isProcessing) return;
    setIsProcessing(true);

    setUploadedFile(file);
    const startTime = new Date().toISOString();

    const uploadStep: AuditStep = {
      id: `step-upload-${Date.now()}`,
      type: 'upload',
      name: '文件上传',
      status: 'running',
      startTime,
      input: { fileName: file.name, fileSize: file.size, fileType: file.type },
      output: {}
    };
    addAuditStep(uploadStep);
    setCurrentStepIndex(0);
    setAuditStep('upload');

    await new Promise(resolve => setTimeout(resolve, 800));

    uploadStep.status = 'completed';
    uploadStep.endTime = new Date().toISOString();
    uploadStep.output = { fileId: `file-${Date.now()}`, uploaded: true };

    setCurrentStepIndex(1);
    setAuditStep('recognize');

    const recognizeStep: AuditStep = {
      id: `step-recognize-${Date.now()}`,
      type: 'recognize',
      name: '字体识别',
      status: 'running',
      startTime: new Date().toISOString(),
      input: { fileId: uploadStep.output.fileId, fileName: file.name },
      output: {}
    };
    addAuditStep(recognizeStep);

    const result = await fontApi.recognizeFonts(file.name);
    setConfidence(result.confidence);
    setRecognizedFonts(result.fontCandidates);

    recognizeStep.status = 'completed';
    recognizeStep.endTime = new Date().toISOString();
    recognizeStep.output = {
      fonts: result.fontCandidates.map(f => ({ fontId: f.id, name: f.name, confidence: result.confidence })),
      overallConfidence: result.confidence
    };

    setCurrentStepIndex(2);
    setAuditStep('match');

    const matchStep: AuditStep = {
      id: `step-match-${Date.now()}`,
      type: 'match',
      name: '授权匹配',
      status: 'running',
      startTime: new Date().toISOString(),
      input: {
        fontIds: result.fontCandidates.map(f => f.id),
        projectId: selectedProjectId
      },
      output: {}
    };
    addAuditStep(matchStep);

    const matchResults: Record<string, any> = {};
    for (const font of result.fontCandidates) {
      const matchResult = await licenseApi.matchLicense(font.id, selectedProjectId);
      setMatchedLicense(font.id, matchResult.license || null);
      matchResults[font.id] = matchResult;
    }

    matchStep.status = 'completed';
    matchStep.endTime = new Date().toISOString();
    matchStep.output = matchResults;

    setCurrentStepIndex(3);
    setAuditStep('validate');

    const validateStep: AuditStep = {
      id: `step-validate-${Date.now()}`,
      type: 'validate',
      name: '渠道校验',
      status: 'running',
      startTime: new Date().toISOString(),
      input: {
        licenseIds: Object.values(matchResults).filter((r: any) => r.license).map((r: any) => r.license.id),
        projectId: selectedProjectId
      },
      output: {}
    };
    addAuditStep(validateStep);

    const project = projects.find(p => p.id === selectedProjectId);
    const channelIdsToCheck = project?.channelIds || channels.slice(0, 3).map(c => c.id);
    
    const validateResults: Record<string, any> = {};
    for (const [fontId, matchResult] of Object.entries(matchResults)) {
      if ((matchResult as any).license) {
        const validateResult = await licenseApi.validateChannels(
          (matchResult as any).license.id,
          channelIdsToCheck
        );
        channelIdsToCheck.forEach(chId => {
          setValidatedChannel(chId, validateResult.valid || !validateResult.invalidChannels.includes(chId));
        });
        validateResults[fontId] = validateResult;
      }
    }

    validateStep.status = 'completed';
    validateStep.endTime = new Date().toISOString();
    validateStep.output = validateResults;

    setCurrentStepIndex(4);
    setAuditStep('analyze');

    const analyzeStep: AuditStep = {
      id: `step-analyze-${Date.now()}`,
      type: 'analyze',
      name: '风险分析',
      status: 'running',
      startTime: new Date().toISOString(),
      input: {
        fonts: result.fontCandidates.map(f => f.id),
        licenses: Object.values(matchResults).map((r: any) => r.license?.id || null),
        projectId: selectedProjectId
      },
      output: {}
    };
    addAuditStep(analyzeStep);

    const allRisks = [];
    const channelsToCheck = channels.filter(c => channelIdsToCheck.includes(c.id));
    
    for (const font of result.fontCandidates) {
      const license = matchResults[font.id]?.license;
      const riskResult = await riskApi.analyzeRisks({
        font,
        license,
        channels: channelsToCheck,
        project
      });
      allRisks.push(...riskResult.risks);
    }

    setAuditRisks(allRisks);

    analyzeStep.status = 'completed';
    analyzeStep.endTime = new Date().toISOString();
    analyzeStep.output = {
      risks: allRisks,
      overallRisk: allRisks.length > 0 
        ? allRisks.reduce((acc, r) => {
            const order = ['low', 'medium', 'high', 'pending'];
            return order.indexOf(r.level) > order.indexOf(acc) ? r.level : acc;
          }, 'low' as any)
        : 'low'
    };

    setCurrentStepIndex(5);
    setAuditStep('report');

    const reportStep: AuditStep = {
      id: `step-report-${Date.now()}`,
      type: 'report',
      name: '生成报告',
      status: 'running',
      startTime: new Date().toISOString(),
      input: {
        steps: audit.steps.concat([uploadStep, recognizeStep, matchStep, validateStep, analyzeStep]),
        risks: allRisks
      },
      output: {}
    };
    addAuditStep(reportStep);

    const report = await generateReport({
      projectId: selectedProjectId,
      steps: audit.steps.concat([uploadStep, recognizeStep, matchStep, validateStep, analyzeStep, reportStep]),
      risks: allRisks,
      sampleFileName: file.name
    });

    setGeneratedReportId(report.id);

    reportStep.status = 'completed';
    reportStep.endTime = new Date().toISOString();
    reportStep.output = { reportId: report.id, generated: true };

    setIsProcessing(false);
  };

  const handleReset = () => {
    resetAudit();
    setCurrentStepIndex(0);
    setIsProcessing(false);
    setGeneratedReportId(null);
    setConfidence(0);
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">字体授权审计</h3>
              <p className="text-sm text-slate-400 mt-1">拖拽设计稿或字体文件，自动完成授权审计</p>
            </div>
            <div className="relative">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowProjectDropdown(!showProjectDropdown);
                  if (!projects.length) loadProjects();
                  if (!channels.length) loadChannels();
                }}
              >
                <FileText className="w-4 h-4" />
                {selectedProject ? selectedProject.name : '选择关联项目（可选）'}
                <ChevronDown className="w-4 h-4" />
              </Button>
              {showProjectDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-800 rounded-xl border border-slate-700 shadow-xl z-50 overflow-hidden">
                  <div className="p-2">
                    <div className="text-xs text-slate-400 px-3 py-2">可用项目</div>
                    {projects.map((p: Project) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                        onClick={() => {
                          setSelectedProjectId(p.id);
                          setSelectedProject(p.id);
                          setShowProjectDropdown(false);
                        }}
                      >
                        <div className="font-medium text-sm">{p.name}</div>
                        <div className="text-xs text-slate-400">{p.clientName} · {p.channelNames.join('、')}</div>
                      </button>
                    ))}
                    <button
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400"
                      onClick={() => {
                        setSelectedProjectId(undefined);
                        setSelectedProject(undefined);
                        setShowProjectDropdown(false);
                      }}
                    >
                      不关联项目
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-8 px-8">
            <StepTimeline steps={audit.steps} currentStep={currentStepIndex} />
          </div>

          {currentStepIndex === 0 && !isProcessing && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer
                ${isDragging
                  ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                  : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/30'
                }
              `}
            >
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileInput}
                accept=".psd,.ai,.pdf,.ttf,.otf,.woff,.woff2"
              />
              <div className={`
                w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-all duration-300
                ${isDragging ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50 text-slate-400'}
              `}>
                <Upload className={`w-10 h-10 transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`} />
              </div>
              <h4 className="text-lg font-semibold mb-2">
                {isDragging ? '释放文件开始审计' : '拖拽文件到此处'}
              </h4>
              <p className="text-sm text-slate-400 mb-4">
                或点击选择文件，支持 PSD、AI、PDF、TTF、OTF、WOFF 等格式
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-[#43A047]" />
                  自动识别字体
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-[#43A047]" />
                  智能匹配授权
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-[#43A047]" />
                  风险分层分析
                </span>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full animate-pulse opacity-30" />
                <div className="absolute inset-1 bg-slate-900 rounded-full flex items-center justify-center">
                  <Search className="w-7 h-7 text-cyan-400 animate-pulse" />
                </div>
              </div>
              <h4 className="text-lg font-semibold mb-2">正在分析文件...</h4>
              <p className="text-sm text-slate-400">
                {stepTypes[currentStepIndex] === 'upload' && '正在上传文件'}
                {stepTypes[currentStepIndex] === 'recognize' && '正在识别字体'}
                {stepTypes[currentStepIndex] === 'match' && '正在匹配授权库'}
                {stepTypes[currentStepIndex] === 'validate' && '正在校验渠道范围'}
                {stepTypes[currentStepIndex] === 'analyze' && '正在分析授权风险'}
                {stepTypes[currentStepIndex] === 'report' && '正在生成审计报告'}
              </p>
            </div>
          )}

          {currentStepIndex >= 5 && !isProcessing && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="text-sm text-slate-400 mb-1">识别字体数</div>
                  <div className="text-3xl font-bold text-cyan-400">{audit.recognizedFonts.length}</div>
                  <div className="text-xs text-slate-500 mt-1">置信度 {(confidence * 100).toFixed(1)}%</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-slate-400 mb-1">匹配授权</div>
                  <div className="text-3xl font-bold text-[#43A047]">
                    {Object.values(audit.matchedLicenses).filter(Boolean).length}/{audit.recognizedFonts.length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">授权匹配率</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-slate-400 mb-1">风险项</div>
                  <div className="text-3xl font-bold text-[#E53935]">{audit.risks.length}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {audit.risks.filter(r => r.level === 'high').length} 项高风险
                  </div>
                </Card>
              </div>

              {audit.recognizedFonts.length > 0 && (
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">识别字体详情</h4>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {audit.recognizedFonts.map((font: FontFile) => {
                      const license = audit.matchedLicenses[font.id];
                      return (
                        <div key={font.id} className="flex items-start justify-between p-4 bg-slate-800/30 rounded-xl">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="font-medium">{font.name}</span>
                              <StatusBadge status={font.status} size="sm" />
                            </div>
                            <div className="text-sm text-slate-400 mt-1">
                              {font.familyName} · {font.weight} · 版本 {font.version}
                            </div>
                            {font.aliases.length > 0 && (
                              <div className="text-xs text-slate-500 mt-1">
                                别名: {font.aliases.join('、')}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            {license ? (
                              <div>
                                <div className="text-sm font-medium text-[#43A047]">授权已匹配</div>
                                <div className="text-xs text-slate-500">
                                  {license.licensor} · 有效期至 {license.endDate}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-sm font-medium text-[#E53935] flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  未找到授权
                                </div>
                                <div className="text-xs text-slate-500">请补充授权证书</div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {audit.risks.length > 0 && (
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-[#E53935]" />
                      风险分析结果
                    </h4>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {audit.risks.map((risk: any) => (
                      <div key={risk.id} className="flex items-start gap-4 p-4 bg-slate-800/30 rounded-xl">
                        <RiskBadge level={risk.level} />
                        <div className="flex-1">
                          <div className="font-medium">{risk.fontName}</div>
                          <div className="text-sm text-slate-400 mt-1">{risk.description}</div>
                          <div className="text-sm text-cyan-400 mt-2">建议: {risk.suggestion}</div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <h4 className="font-semibold">审计链路追溯</h4>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {audit.steps.map((step: AuditStep) => (
                      <div key={step.id} className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-[#43A047] flex-shrink-0" />
                        <span className="font-medium">{step.name}</span>
                        <span className="text-xs text-slate-500 ml-auto">
                          {step.startTime && new Date(step.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          {' - '}
                          {step.endTime && new Date(step.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>

        {currentStepIndex >= 5 && !isProcessing && (
          <CardFooter className="flex justify-between">
            <Button variant="secondary" onClick={handleReset}>
              <RefreshCw className="w-4 h-4" />
              重新审计
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary">
                查看报告详情
              </Button>
              <Button>
                导出审计报告
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

export default AuditWorkbench;
