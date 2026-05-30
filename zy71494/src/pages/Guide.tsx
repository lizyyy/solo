import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, Upload, Zap, Clock, BarChart3, ArrowRight, Check, Play, Download } from 'lucide-react';

const Guide: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      icon: Upload,
      title: '1. 导入音频',
      description: '点击「导入音频」按钮，选择你要分析的歌曲文件。系统支持 MP3、WAV、FLAC 等常见音频格式。',
      details: [
        '支持批量导入多首歌曲',
        '自动提取文件名作为歌曲名称',
        '自动检测音频时长',
        '数据安全存储在浏览器本地',
      ],
      tip: '建议使用无损格式（WAV/FLAC）以获得更准确的BPM检测结果。',
    },
    {
      icon: Zap,
      title: '2. 核对BPM',
      description: '系统会自动检测BPM。仔细核对是否有半速/倍速误判，如有问题点击「÷2 半速」或「×2 倍速」修正。',
      details: [
        '自动检测BPM并标注可信度',
        '一键修正半速/倍速误判',
        '支持手动输入精确BPM值',
        '所有调整自动记录到证据链',
      ],
      tip: '电子音乐常见BPM范围：House 120-130，Techno 120-140，Drum & Bass 170-180。',
    },
    {
      icon: Clock,
      title: '3. 标注拍点',
      description: '听音乐的同时在波形图上点击添加手动拍点。重点标注Intro开始、Drop开始、Outro结束等关键位置。',
      details: [
        '点击波形任意位置添加拍点',
        '青色竖线=手动拍点，灰色=自动拍点',
        '可将任意拍点设为最佳入点/出点',
        '支持备注拍点漂移情况',
      ],
      tip: '最佳入点通常在Intro的第一个重拍，最佳出点通常在Outro的最后一个重拍。',
    },
    {
      icon: BarChart3,
      title: '4. 标注段落',
      description: '将歌曲划分为Intro、Verse、Build、Drop、Breakdown、Outro等段落，便于后续匹配过渡。',
      details: [
        '支持7种标准段落类型',
        '可添加自定义标签如「主Drop」',
        '自动版本号管理',
        '保留历史版本便于回溯',
      ],
      tip: 'Intro和Outro段落越长，过渡时的操作空间越大。',
    },
    {
      icon: ArrowRight,
      title: '5. 过渡评分',
      description: '选择要衔接的下一首歌，系统会基于BPM匹配度、拍点对齐度、段落适配度给出综合评分。',
      details: [
        'BPM匹配度（权重40%）',
        '拍点对齐度（权重30%）',
        '段落适配度（权重30%）',
        '智能给出过渡建议',
      ],
      tip: '评分80分以上的过渡通常现场表现良好，60分以下需要谨慎处理。',
    },
    {
      icon: Download,
      title: '6. 导出结果',
      description: '完成分析后，导出JSON或CSV格式的数据，方便团队共享和现场参考。',
      details: [
        'JSON格式：完整数据，支持重新导入',
        'CSV格式：表格化，方便打印查看',
        '包含完整操作历史和证据链',
        '支持批量导出所有歌曲',
      ],
      tip: '建议演出前打印一份纸质版作为备份，以防设备故障。',
    },
  ];

  const evidenceFeatures = [
    {
      title: 'BPM调整记录',
      description: '每次BPM变更都会记录原始值、调整后的值、调整原因，以及是否为半速/倍速修正。',
    },
    {
      title: '拍点漂移备注',
      description: '手动添加的拍点可以备注漂移情况，帮助后续DJ理解为什么这个位置需要特别注意。',
    },
    {
      title: '段落版本历史',
      description: '每次修改段落标注都会递增版本号，并保留上一版的值，不用担心被新版本覆盖。',
    },
    {
      title: '完整操作日志',
      description: '从导入到导出的每一步操作都有时间戳和操作人记录，复盘时能清楚看到当时的决策过程。',
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-cyan/20 rounded-full mb-4">
          <HelpCircle size={32} className="text-accent-cyan" />
        </div>
        <h1 className="text-3xl font-bold mb-2">🚀 5分钟快速上手</h1>
        <p className="text-text-secondary max-w-xl mx-auto">
          按照以下步骤操作，你就能快速完成一首歌曲的过渡拍点分析。
          所有操作都会被自动记录，确保交接和复盘时数据链路完整。
        </p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="flex gap-2">
          {steps.map((step, index) => (
            <button
              key={index}
              onClick={() => setActiveStep(index)}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                activeStep === index
                  ? 'bg-accent-cyan text-bg-primary shadow-glow'
                  : activeStep > index
                  ? 'bg-accent-green text-bg-primary'
                  : 'bg-bg-tertiary text-text-muted hover:bg-bg-secondary'
              }`}
            >
              {activeStep > index ? <Check size={18} /> : index + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="card mb-8 animate-fadeIn">
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 bg-accent-cyan/20 rounded-xl flex items-center justify-center flex-shrink-0">
            {(() => {
              const StepIcon = steps[activeStep].icon;
              return <StepIcon size={32} className="text-accent-cyan" />;
            })()}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">{steps[activeStep].title}</h2>
            <p className="text-text-secondary mb-6">{steps[activeStep].description}</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {steps[activeStep].details.map((detail, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Check size={16} className="text-accent-green mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-text-secondary">{detail}</span>
                </div>
              ))}
            </div>

            <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg p-4">
              <p className="text-sm">
                <span className="text-accent-yellow font-medium">💡 小贴士：</span>
                {steps[activeStep].tip}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-bg-tertiary">
          <button
            onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
            disabled={activeStep === 0}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一步
          </button>
          <div className="text-sm text-text-muted">
            {activeStep + 1} / {steps.length}
          </div>
          {activeStep < steps.length - 1 ? (
            <button
              onClick={() => setActiveStep(activeStep + 1)}
              className="btn-primary flex items-center gap-2"
            >
              下一步 <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="btn-primary flex items-center gap-2"
            >
              <Play size={16} /> 开始使用
            </button>
          )}
        </div>
      </div>

      <div className="card mb-8">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="text-accent-yellow">🔗</span>
          证据链设计说明
        </h3>
        <p className="text-text-secondary mb-6">
          本系统的核心设计目标之一是<strong className="text-text-primary">保留完整证据链</strong>，
          解决人工核对时凭印象、交接时信息丢失、复盘时不知道当时为什么这么处理的问题。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {evidenceFeatures.map((feature, idx) => (
            <div key={idx} className="p-4 bg-bg-primary/50 rounded-lg border border-bg-tertiary">
              <h4 className="font-semibold mb-2 text-accent-cyan">{feature.title}</h4>
              <p className="text-sm text-text-secondary">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card bg-gradient-to-br from-accent-cyan/10 to-accent-magenta/10 border-accent-cyan/30">
        <h3 className="text-xl font-bold mb-4">🎯 核心价值总结</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl mb-2">📥</div>
            <h4 className="font-semibold mb-1">导入即分析</h4>
            <p className="text-sm text-text-secondary">导入音频后自动检测BPM和拍点，无需手动从零开始</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">👁️</div>
            <h4 className="font-semibold mb-1">所见即所得</h4>
            <p className="text-sm text-text-secondary">波形图上直观展示拍点和段落，点击即可编辑</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">🔗</div>
            <h4 className="font-semibold mb-1">链路完整</h4>
            <p className="text-sm text-text-secondary">从摘要到明细数据不中断，交接复盘清晰高效</p>
          </div>
        </div>
      </div>

      <div className="text-center mt-8">
        <button
          onClick={() => navigate('/')}
          className="btn-primary text-lg px-8 py-3 inline-flex items-center gap-2"
        >
          <Play size={20} fill="currentColor" />
          开始使用 DJ过渡拍点助手
        </button>
      </div>
    </div>
  );
};

export default Guide;
