import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  FileQuestion, 
  BookOpen,
  Image as ImageIcon,
  Edit3,
  CheckCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { FlagType, EvidenceType, StatusType } from '@/types';

export default function TracePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentPack, analysisResults } = useStore();

  if (!currentPack) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-medium text-slate-600">暂无数据</h2>
          <p className="text-slate-500 mt-2">请先导入材料包</p>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary mt-6"
          >
            前往导入
          </button>
        </div>
      </div>
    );
  }

  const record = currentPack.records.find(r => r.id === id);
  const analysis = analysisResults.find(a => a.recordId === id);

  if (!record) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-medium text-slate-600">记录不存在</h2>
          <p className="text-slate-500 mt-2">找不到指定的错题记录</p>
          <button
            onClick={() => navigate('/matrix')}
            className="btn btn-primary mt-6"
          >
            返回矩阵
          </button>
        </div>
      </div>
    );
  }

  const getFlagLabel = (type: FlagType) => {
    switch (type) {
      case 'equivalent_answer_mismatch': return '等价答案误判';
      case 'empty_set_boundary': return '空集边界混淆';
      case 'step_scoring_bias': return '分步得分偏差';
    }
  };

  const getEvidenceIcon = (type: EvidenceType) => {
    switch (type) {
      case 'student_answer': return User;
      case 'standard_answer': return BookOpen;
      case 'screenshot': return ImageIcon;
      case 'correction_note': return Edit3;
    }
  };

  const getEvidenceLabel = (type: EvidenceType) => {
    switch (type) {
      case 'student_answer': return '学生答案';
      case 'standard_answer': return '标准答案';
      case 'screenshot': return '附件截图';
      case 'correction_note': return '人工更正';
    }
  };

  const getStatusLabel = (status: StatusType) => {
    switch (status) {
      case 'normal': return '正常';
      case 'pending': return '待确认';
      case 'warning': return '异常';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/matrix')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回矩阵
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="font-medium">基本信息</h3>
            </div>
            <div className="card-body space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-lg">{record.studentName}</p>
                  <p className="text-sm text-slate-500">学号: {record.studentId}</p>
                </div>
                {analysis && (
                  <span className={`ml-auto badge badge-${analysis.status}`}>
                    {getStatusLabel(analysis.status)}
                  </span>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-start gap-3">
                  <FileQuestion className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">题目</p>
                    <p className="font-medium mt-1">{record.questionTitle}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-sm text-slate-500">知识点</p>
                  <p className="font-medium mt-1">{record.knowledgePoint}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">得分</p>
                  <p className="font-medium mt-1">
                    <span className="text-2xl text-primary-600">{record.score}</span>
                    <span className="text-slate-400"> / {record.fullScore}</span>
                  </p>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-100">
                {record.isDuplicate && (
                  <span className="badge badge-duplicate">
                    重复项
                  </span>
                )}
                {record.source === 'late' && (
                  <span className="badge badge-late">
                    <Clock className="w-3 h-3 mr-1" />
                    晚到附件
                  </span>
                )}
                {record.source === 'correction' && (
                  <span className="badge badge-warning">
                    <Edit3 className="w-3 h-3 mr-1" />
                    人工更正来源
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-medium">答案对比</h3>
            </div>
            <div className="card-body space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-500 mb-2">学生答案</p>
                <p className="font-medium text-slate-800">{record.studentAnswer}</p>
              </div>
              <div className="p-4 bg-success-50 rounded-xl border border-success-200">
                <p className="text-sm text-success-600 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  标准答案
                </p>
                <p className="font-medium text-success-800">{record.standardAnswer}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-medium">证据链 - 时间线</h3>
            </div>
            <div className="card-body">
              {analysis ? (
                <div className="space-y-0">
                  {analysis.evidenceChain.map((item, index) => {
                    const Icon = getEvidenceIcon(item.type);
                    return (
                      <div key={item.id} className="evidence-timeline-item">
                        <div className={`evidence-timeline-dot ${
                          item.type === 'standard_answer' ? 'bg-success-500' :
                          item.type === 'correction_note' ? 'bg-pending-500' :
                          item.type === 'screenshot' ? 'bg-primary-500' :
                          'bg-slate-400'
                        }`} />
                        <div className="bg-slate-50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={`w-4 h-4 ${
                              item.type === 'standard_answer' ? 'text-success-600' :
                              item.type === 'correction_note' ? 'text-pending-600' :
                              item.type === 'screenshot' ? 'text-primary-600' :
                              'text-slate-500'
                            }`} />
                            <span className="text-sm font-medium text-slate-700">
                              {getEvidenceLabel(item.type)}
                            </span>
                            <span className="text-xs text-slate-400 ml-auto">
                              {item.timestamp}
                            </span>
                          </div>
                          {item.type === 'screenshot' && item.url ? (
                            <div>
                              <p className="text-sm text-slate-600 mb-2">{item.content}</p>
                              <img 
                                src={item.url} 
                                alt={item.content}
                                className="rounded-lg max-w-full h-auto border border-slate-200"
                              />
                            </div>
                          ) : (
                            <p className="text-slate-700">{item.content}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">暂无证据链数据</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {analysis && analysis.flags.length > 0 && (
            <div className="card border-pending-200 bg-pending-50/50">
              <div className="card-header border-pending-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-pending-600" />
                  <h3 className="font-medium text-pending-800">待确认标记</h3>
                </div>
              </div>
              <div className="card-body space-y-3">
                {analysis.flags.map((flag, index) => (
                  <div key={index} className="p-3 bg-white rounded-lg border border-pending-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-pending-700 bg-pending-100 px-2 py-0.5 rounded">
                        {getFlagLabel(flag.type)}
                      </span>
                      <span className="text-xs text-slate-500 ml-auto">
                        置信度 {Math.round(flag.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{flag.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.corrections.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-medium">人工更正历史</h3>
              </div>
              <div className="card-body space-y-3">
                {record.corrections.map(corr => (
                  <div key={corr.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Edit3 className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium">{corr.operator}</span>
                      <span className="text-xs text-slate-400 ml-auto">
                        {corr.timestamp}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">{corr.field}</span>: 
                      <span className="text-warning-600 line-through mx-2">{corr.before}</span>
                      → 
                      <span className="text-success-600 mx-2">{corr.after}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">原因: {corr.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.attachments.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-medium">附件列表</h3>
              </div>
              <div className="card-body space-y-2">
                {record.attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <ImageIcon className="w-5 h-5 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.name}</p>
                      <p className="text-xs text-slate-500">{att.timestamp}</p>
                    </div>
                    {att.isLate && (
                      <span className="badge badge-late text-xs">晚到</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h3 className="font-medium">快速操作</h3>
            </div>
            <div className="card-body space-y-2">
              <Link
                to="/matrix"
                className="block w-full px-4 py-2 text-center bg-slate-100 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
              >
                返回矩阵视图
              </Link>
              <button className="w-full px-4 py-2 text-center bg-primary-50 rounded-lg text-sm font-medium text-primary-700 hover:bg-primary-100 transition-colors">
                标记为已确认
              </button>
              <button className="w-full px-4 py-2 text-center bg-pending-50 rounded-lg text-sm font-medium text-pending-700 hover:bg-pending-100 transition-colors">
                添加备注
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
