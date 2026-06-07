import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Package, ArrowRight, FileText, MessageSquare, Edit3, Check, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatDate } from '../utils/formatters';
import { NextOwner } from '../types';

const ownerColors: Record<NextOwner, { bg: string; text: string; border: string }> = {
  '运营复核人': { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
  '模型评测小孟': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
};

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sample = useAppStore((state) => state.getSampleById(id || ''));
  const updateReview = useAppStore((state) => state.updateReview);

  const [isEditing, setIsEditing] = useState(false);
  const [editExplanation, setEditExplanation] = useState('');
  const [editMissing, setEditMissing] = useState('');
  const [editOwner, setEditOwner] = useState<NextOwner>('模型评测小孟');

  if (!sample) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-500">样本不存在</p>
        <Link to="/" className="text-amber-600 hover:text-amber-700 mt-4 inline-block">返回首页</Link>
      </div>
    );
  }

  const review = sample.review || {
    explanation: '暂无复盘说明',
    missingMaterials: [],
    nextOwner: '模型评测小孟' as NextOwner,
    updatedAt: sample.createdAt,
  };

  const startEdit = () => {
    setEditExplanation(review.explanation);
    setEditMissing(review.missingMaterials.join('、'));
    setEditOwner(review.nextOwner);
    setIsEditing(true);
  };

  const saveEdit = () => {
    updateReview(sample.id, {
      explanation: editExplanation,
      missingMaterials: editMissing.split(/[、,，]/).map(s => s.trim()).filter(Boolean),
      nextOwner: editOwner,
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-stone-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-stone-800">产品复盘 · {sample.sampleNo}</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            最后更新：{formatDate(review.updatedAt)}
          </p>
        </div>
        <Link
          to={`/sample/${sample.id}`}
          className="inline-flex items-center gap-2 px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          看标注留言
        </Link>
      </div>

      <div className="bg-gradient-to-br from-stone-50 to-amber-50/30 rounded-xl border border-stone-200 p-8 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-amber-700" />
              <h2 className="text-lg font-semibold text-stone-800">这条为什么被留下？</h2>
            </div>
            <p className="text-sm text-stone-500">用小孟和运营复核人能听懂的话解释</p>
          </div>
          {!isEditing && (
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              <Edit3 className="w-4 h-4" />
              编辑
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <textarea
              value={editExplanation}
              onChange={(e) => setEditExplanation(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none h-32"
              placeholder="说明这条样本为什么需要留下来..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-stone-600 hover:text-stone-800 text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={saveEdit}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Check className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border-l-4 border-amber-400 p-5 shadow-sm">
            <p className="text-stone-700 leading-relaxed whitespace-pre-wrap">{review.explanation}</p>
            <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-2 text-xs text-stone-500">
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">小孟说</span>
              以上解释基于标注员留言和模型版本对比
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-stone-600" />
            <h3 className="font-semibold text-stone-800">材料清单</h3>
          </div>

          {isEditing ? (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">还缺什么（用顿号分隔）</label>
              <input
                type="text"
                value={editMissing}
                onChange={(e) => setEditMissing(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                placeholder="素材原图、标注员操作日志、..."
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-emerald-700 mb-2">✓ 已有材料</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Check className="w-4 h-4 text-emerald-500" />
                    模型版本预测结果（{sample.versions.length} 个版本）
                  </div>
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Check className="w-4 h-4 text-emerald-500" />
                    标注员留言（{sample.comments.length} 条）
                  </div>
                </div>
              </div>

              {review.missingMaterials.length > 0 && (
                <div className="pt-3 border-t border-stone-100">
                  <p className="text-sm font-medium text-amber-700 mb-2">还缺什么</p>
                  <div className="space-y-1.5">
                    {review.missingMaterials.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-stone-600">
                        <X className="w-4 h-4 text-amber-500" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {review.missingMaterials.length === 0 && (
                <div className="pt-3 border-t border-stone-100">
                  <p className="text-sm text-emerald-600 font-medium">✓ 材料齐全，无需补充</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-stone-600" />
            <h3 className="font-semibold text-stone-800">下一步该找谁？</h3>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              {(['运营复核人', '模型评测小孟'] as NextOwner[]).map((owner) => (
                <button
                  key={owner}
                  onClick={() => setEditOwner(owner)}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    editOwner === owner
                      ? `${ownerColors[owner].border} ${ownerColors[owner].bg} ring-2 ring-offset-1 ring-amber-300`
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <p className="font-medium text-stone-800">{owner}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {owner === '运营复核人' ? '确认素材是否一致，做最终判断' : '补充标注员留言，核实模型预测'}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className={`p-5 rounded-xl border ${ownerColors[review.nextOwner].border} ${ownerColors[review.nextOwner].bg}`}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-xl shadow-sm">
                  <ArrowRight className={`w-5 h-5 ${ownerColors[review.nextOwner].text}`} />
                </div>
                <div>
                  <p className={`font-bold ${ownerColors[review.nextOwner].text}`}>{review.nextOwner}</p>
                  <p className="text-xs text-stone-600 mt-0.5">
                    {review.nextOwner === '运营复核人'
                      ? '请运营复核人确认素材一致性'
                      : '请小孟补充标注留言或核实模型'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h3 className="font-semibold text-stone-800 mb-4">操作流水</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2" />
            <div>
              <p className="text-sm text-stone-800">样本导入 · 灰度批次</p>
              <p className="text-xs text-stone-500">{formatDate(sample.createdAt)}</p>
            </div>
          </div>
          {sample.comments.map((c, i) => (
            <div key={c.id} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500 mt-2" />
              <div>
                <p className="text-sm text-stone-800">{c.author} 补录了留言</p>
                <p className="text-xs text-stone-500">{formatDate(c.timestamp)}</p>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-sky-500 mt-2" />
            <div>
              <p className="text-sm text-stone-800">复盘页更新</p>
              <p className="text-xs text-stone-500">{formatDate(review.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
