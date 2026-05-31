import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import Timeline from '@/components/Timeline';
import StatusBadge from '@/components/StatusBadge';
import DifficultyBadge from '@/components/DifficultyBadge';
import ImageViewer from '@/components/ImageViewer';
import { ArrowLeft, User, FileText, Image, Edit3, MessageSquare, Eye, AlertCircle } from 'lucide-react';

const EvidencePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const chains = useStore(state => state.chains);
  const getMistakeById = useStore(state => state.getMistakeById);
  const getSnapshotByQuestionId = useStore(state => state.getSnapshotByQuestionId);
  const getCorrectionsByMistakeId = useStore(state => state.getCorrectionsByMistakeId);
  const getCommentaryByMistakeId = useStore(state => state.getCommentaryByMistakeId);
  const loadFromStorage = useStore(state => state.loadFromStorage);

  const [viewerImage, setViewerImage] = useState<{ src: string; alt: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'details'>('timeline');

  useEffect(() => {
    if (chains.length === 0) {
      loadFromStorage();
    }
  }, [chains.length, loadFromStorage]);

  const chain = chains.find(c => c.id === id);
  
  if (!chain) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-primary-800 mb-2">未找到记录</h3>
        <p className="text-primary-600 mb-6">该证据链不存在或已被删除</p>
        <button
          onClick={() => navigate('/overview')}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回总览</span>
        </button>
      </div>
    );
  }

  const mistake = getMistakeById(chain.mistakeId);
  const snapshot = mistake ? getSnapshotByQuestionId(mistake.questionId) : undefined;
  const corrections = getCorrectionsByMistakeId(chain.mistakeId);
  const commentary = getCommentaryByMistakeId(chain.mistakeId);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/overview')}
          className="p-2 hover:bg-primary-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-primary-600" />
        </button>
        <div>
          <h2 className="text-3xl font-serif font-bold text-primary-800">证据链详情</h2>
          <p className="text-primary-600">
            {mistake?.studentName} - {mistake?.questionId}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-primary-100 shadow-sm overflow-hidden">
            <div className="border-b border-primary-100">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`flex-1 px-6 py-4 font-medium transition-colors ${
                    activeTab === 'timeline'
                      ? 'text-primary-800 border-b-2 border-primary-600 bg-primary-50'
                      : 'text-primary-500 hover:text-primary-700'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>时间线视图</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex-1 px-6 py-4 font-medium transition-colors ${
                    activeTab === 'details'
                      ? 'text-primary-800 border-b-2 border-primary-600 bg-primary-50'
                      : 'text-primary-500 hover:text-primary-700'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Eye className="w-5 h-5" />
                    <span>证据对比</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'timeline' ? (
                <Timeline nodes={chain.timeline} />
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-primary-800 mb-3 flex items-center space-x-2">
                        <Image className="w-5 h-5 text-blue-500" />
                        <span>学生错题原图</span>
                      </h4>
                      {mistake ? (
                        <div 
                          className="aspect-video bg-primary-100 rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setViewerImage({ src: mistake.originalImage, alt: '学生错题' })}
                        >
                          <img 
                            src={mistake.originalImage} 
                            alt="学生错题" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video bg-primary-100 rounded-xl flex items-center justify-center">
                          <span className="text-primary-500">暂无图片</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-semibold text-primary-800 mb-3 flex items-center space-x-2">
                        <Image className="w-5 h-5 text-green-500" />
                        <span>讲义截图</span>
                        {snapshot?.isLate && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            晚到附件
                          </span>
                        )}
                      </h4>
                      {snapshot ? (
                        <div 
                          className="aspect-video bg-primary-100 rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setViewerImage({ src: snapshot.imageUrl, alt: '讲义截图' })}
                        >
                          <img 
                            src={snapshot.imageUrl} 
                            alt="讲义截图" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl flex flex-col items-center justify-center">
                          <span className="text-amber-600 font-medium">缺少讲义截图</span>
                          <span className="text-amber-500 text-sm mt-1">请补充上传相关材料</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {corrections.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-primary-800 mb-3 flex items-center space-x-2">
                        <Edit3 className="w-5 h-5 text-amber-500" />
                        <span>人工更正记录</span>
                      </h4>
                      <div className="space-y-3">
                        {corrections.map((correction, idx) => (
                          <div key={idx} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <span className="text-sm font-medium text-amber-800">
                                    {correction.operator}
                                  </span>
                                  <span className="text-xs text-amber-600">
                                    {formatTime(correction.correctedAt)}
                                  </span>
                                </div>
                                <p className="text-sm text-amber-700 mb-2">
                                  原因：{correction.reason}
                                </p>
                                <div className="flex items-center space-x-3 text-sm">
                                  <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded">
                                    {correction.beforeValue}
                                  </span>
                                  <span className="text-amber-500">→</span>
                                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                                    {correction.afterValue}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {commentary && (
                    <div>
                      <h4 className="font-semibold text-primary-800 mb-3 flex items-center space-x-2">
                        <MessageSquare className="w-5 h-5 text-purple-500" />
                        <span>讲评稿</span>
                      </h4>
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                        <div className="flex items-center space-x-3 mb-3">
                          <span className="text-sm font-medium text-purple-800">
                            {commentary.author}
                          </span>
                          <span className="text-xs text-purple-600">
                            {formatTime(commentary.createdAt)}
                          </span>
                        </div>
                        <p className="text-purple-700 leading-relaxed">
                          {commentary.content}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
            <h3 className="font-semibold text-primary-800 mb-4">基本信息</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-primary-100">
                <span className="text-primary-500 flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>学生姓名</span>
                </span>
                <span className="font-medium text-primary-800">{mistake?.studentName}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-primary-100">
                <span className="text-primary-500 flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>题目编号</span>
                </span>
                <span className="font-mono text-primary-800">{mistake?.questionId}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-primary-100">
                <span className="text-primary-500">难度等级</span>
                {mistake && <DifficultyBadge difficulty={mistake.difficulty} />}
              </div>
              <div className="flex items-center justify-between py-2 border-b border-primary-100">
                <span className="text-primary-500">处理状态</span>
                <StatusBadge status={chain.status} />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-primary-100">
                <span className="text-primary-500">数据来源</span>
                <span className={`text-sm font-medium ${
                  mistake?.source === 'normal' ? 'text-green-600' :
                  mistake?.source === 'late' ? 'text-amber-600' : 'text-purple-600'
                }`}>
                  {mistake?.source === 'normal' ? '正常录入' :
                   mistake?.source === 'late' ? '晚到附件' : '人工录入'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-primary-500">最后更新</span>
                <span className="text-sm text-primary-600">{formatTime(chain.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
            <h3 className="font-semibold text-primary-800 mb-4">当前结论</h3>
            <div className={`p-4 rounded-xl ${
              chain.status === 'confirmed' ? 'bg-green-50 border border-green-200' :
              chain.status === 'pending' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <p className={`${
                chain.status === 'confirmed' ? 'text-green-700' :
                chain.status === 'pending' ? 'text-yellow-700' : 'text-red-700'
              }`}>
                {chain.currentConclusion}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
            <h3 className="font-semibold text-primary-800 mb-4">特殊标记</h3>
            <div className="space-y-3">
              {chain.hasDuplicate ? (
                <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                  <span className="p-1.5 bg-yellow-200 rounded">
                    <FileText className="w-4 h-4 text-yellow-700" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">存在重复记录</p>
                    <p className="text-xs text-yellow-600">同一学生同一题目多次录入</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                  <span className="p-1.5 bg-green-200 rounded">
                    <FileText className="w-4 h-4 text-green-700" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-green-800">无重复记录</p>
                  </div>
                </div>
              )}
              
              {chain.missingSnapshot ? (
                <div className="flex items-center space-x-3 p-3 bg-amber-50 rounded-lg">
                  <span className="p-1.5 bg-amber-200 rounded">
                    <Image className="w-4 h-4 text-amber-700" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-amber-800">缺少讲义截图</p>
                    <p className="text-xs text-amber-600">请补充上传相关材料</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                  <span className="p-1.5 bg-green-200 rounded">
                    <Image className="w-4 h-4 text-green-700" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-green-800">讲义截图齐全</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewerImage && (
        <ImageViewer
          src={viewerImage.src}
          alt={viewerImage.alt}
          isOpen={true}
          onClose={() => setViewerImage(null)}
        />
      )}
    </div>
  );
};

export default EvidencePage;
