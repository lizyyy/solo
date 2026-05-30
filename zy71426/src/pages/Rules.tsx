import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Shield, FileX, Eye, CheckCircle, XCircle, FileCheck } from 'lucide-react';

const Rules = () => {
  const navigate = useNavigate();

  const rules = [
    {
      icon: Eye,
      title: '仔细审查材料',
      description: '仔细查看事故卡、保单条款和照片证据，不遗漏任何细节。',
      color: 'text-blue-400'
    },
    {
      icon: AlertTriangle,
      title: '标记可疑点',
      description: '发现可疑之处时，先留痕标记，再进行深入分析。',
      color: 'text-amber-400'
    },
    {
      icon: Shield,
      title: '匹配保单条款',
      description: '将发现的疑点与对应的保单条款进行匹配，找到规则依据。',
      color: 'text-emerald-400'
    },
    {
      icon: FileCheck,
      title: '评估风险等级',
      description: '根据疑点数量和严重程度，给出0-100分的风险评分。',
      color: 'text-orange-400'
    },
    {
      icon: CheckCircle,
      title: '做出最终判断',
      description: '综合所有信息，选择正常赔付、拒赔或需要补证。',
      color: 'text-green-400'
    }
  ];

  const commonMistakes = [
    {
      icon: FileX,
      title: '免责条款漏看',
      description: '未注意到保单中的免责条款，导致错误赔付。',
      consequence: '给公司造成经济损失，影响理赔准确性。',
      example: '酒驾、无证驾驶等明确免责的情形未被识别。'
    },
    {
      icon: XCircle,
      title: '旧损当新损',
      description: '将事故前已存在的损伤纳入本次理赔范围。',
      consequence: '扩大赔付范围，滋生保险欺诈风险。',
      example: '保险杠上有锈迹的旧凹陷被当作本次事故损伤。'
    },
    {
      icon: AlertTriangle,
      title: '材料矛盾未识别',
      description: '报案人陈述与证据材料存在矛盾但未被发现。',
      consequence: '无法发现保险欺诈，导致错赔。',
      example: '报案人称"装修刚半年"但实际已使用4年。'
    }
  ];

  const markTypes = [
    { type: 'exemption', label: '免责条款', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { type: 'old_damage', label: '旧损识别', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    { type: 'contradiction', label: '材料矛盾', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { type: 'suspicious', label: '可疑点', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
  ];

  const conclusions = [
    { type: 'approve', label: '正常赔付', color: 'bg-emerald-500/20 text-emerald-400', description: '材料完整，无风险点，按正常流程赔付' },
    { type: 'reject', label: '拒赔', color: 'bg-red-500/20 text-red-400', description: '存在免责情形或欺诈行为，拒绝赔付' },
    { type: 'supplement', label: '需补证', color: 'bg-amber-500/20 text-amber-400', description: '材料不完整或存在疑点，需要补充证明材料' }
  ];

  return (
    <div className="min-h-screen bg-detective-bg p-8">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-detective-accent transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          返回主菜单
        </button>

        <h1 className="font-serif text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-detective-accent to-amber-300">
          调查规则手册
        </h1>
        <p className="text-slate-400 mb-8">掌握这些规则，成为一名出色的理赔侦探</p>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="file-folder animate-slide-in-left">
            <h2 className="text-xl font-bold mb-6 text-detective-accent flex items-center gap-2">
              <Shield className="w-6 h-6" />
              调查流程
            </h2>
            <div className="space-y-6">
              {rules.map((rule, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-detective-bgLighter flex items-center justify-center">
                    <span className="text-detective-accent font-bold">{index + 1}</span>
                  </div>
                  <div>
                    <h3 className={`font-semibold mb-1 flex items-center gap-2 ${rule.color}`}>
                      <rule.icon className="w-5 h-5" />
                      {rule.title}
                    </h3>
                    <p className="text-slate-400 text-sm">{rule.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <div className="file-folder animate-slide-in-right">
              <h2 className="text-xl font-bold mb-6 text-detective-accent flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                标记类型说明
              </h2>
              <div className="space-y-3">
                {markTypes.map((mark) => (
                  <div key={mark.type} className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${mark.color}`}>
                      {mark.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="file-folder animate-slide-in-right" style={{ animationDelay: '100ms' }}>
              <h2 className="text-xl font-bold mb-6 text-detective-accent flex items-center gap-2">
                <CheckCircle className="w-6 h-6" />
                结论类型说明
              </h2>
              <div className="space-y-3">
                {conclusions.map((conclusion) => (
                  <div key={conclusion.type} className="p-3 rounded-lg bg-detective-bgLighter/50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${conclusion.color}`}>
                        {conclusion.label}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm">{conclusion.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="file-folder mt-8 animate-fade-in">
          <h2 className="text-xl font-bold mb-6 text-detective-danger flex items-center gap-2">
            <XCircle className="w-6 h-6" />
            常见错误警示
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {commonMistakes.map((mistake, index) => (
              <div key={index} className="p-5 rounded-lg bg-detective-danger/10 border border-detective-danger/30">
                <mistake.icon className="w-10 h-10 text-detective-danger mb-3" />
                <h3 className="font-bold text-detective-danger mb-2">{mistake.title}</h3>
                <p className="text-slate-300 text-sm mb-3">{mistake.description}</p>
                <div className="text-xs">
                  <p className="text-detective-accent font-semibold mb-1">后果：</p>
                  <p className="text-slate-400 mb-2">{mistake.consequence}</p>
                  <p className="text-detective-accent font-semibold mb-1">示例：</p>
                  <p className="text-slate-400">{mistake.example}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="paper-texture mt-8 animate-fade-in">
          <h3 className="font-bold mb-3 text-detective-bg">评分规则</h3>
          <ul className="text-sm space-y-2 text-detective-bg/80">
            <li>• 正确识别所有关键证据并给出正确结论，得分≥80分</li>
            <li>• 每漏检一个关键证据扣10分，每错误标记一个扣5分</li>
            <li>• 结论判断错误直接判定为不通过</li>
            <li>• 得分≥60分且结论正确即为通过</li>
            <li>• 系统会自动记录所有操作，可随时回放查看</li>
          </ul>
        </div>

        <div className="mt-8 text-center">
          <button onClick={() => navigate('/cases')} className="btn-primary">
            我已了解，开始调查
          </button>
        </div>
      </div>
    </div>
  );
};

export default Rules;
