import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FileText, User, Calendar, Save, ArrowLeft, 
  Plus, CheckCircle, Clock, Diff
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

export function SupplementPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { currentGame, supplements, loadGame, loadSupplements, addSupplement, initMaterials } = useGameStore();
  
  const [notes, setNotes] = useState('');
  const [supplementedBy, setSupplementedBy] = useState('课程助教小何');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    initMaterials();
  }, [initMaterials]);

  useEffect(() => {
    if (gameId) {
      loadGame(gameId);
      loadSupplements(gameId);
    }
  }, [gameId, loadGame, loadSupplements]);

  const gameSupplements = gameId ? supplements[gameId] || [] : [];

  const handleSubmit = () => {
    if (!gameId || !notes.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      addSupplement(gameId, notes.trim(), supplementedBy.trim());
      setIsSubmitting(false);
      setShowSuccess(true);
      setNotes('');

      setTimeout(() => setShowSuccess(false), 3000);
    }, 500);
  };

  if (!currentGame) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-slate-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(`/result/${gameId}`)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          返回结算页面
        </button>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-slate-800 mb-2">📝 助教补录</h1>
          <p className="text-slate-600">为游戏记录添加备注和说明，系统将保留完整审计追踪</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              游戏信息
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">材料包</span>
                <span className="font-medium text-slate-700">{currentGame.materialName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">游戏ID</span>
                <span className="font-mono text-slate-700 text-xs">{currentGame.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">最终得分</span>
                <span className="font-bold text-slate-700">{currentGame.score}分</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">游戏状态</span>
                <span className={`font-medium ${
                  currentGame.status === 'completed' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {currentGame.status === 'completed' ? '已完成' : '失败'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">开始时间</span>
                <span className="text-slate-700">
                  {new Date(currentGame.startTime).toLocaleString('zh-CN')}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              添加备注
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  补录人
                </label>
                <input
                  type="text"
                  value={supplementedBy}
                  onChange={(e) => setSupplementedBy(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                  placeholder="输入您的姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  备注内容
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all resize-none"
                  placeholder="请输入备注说明，例如：
- 该学生在高峰期调度部分理解有误
- 建议加强应急预案的学习
- 此成绩可作为平时分参考"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!notes.trim() || isSubmitting}
                className={`
                  w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all
                  ${notes.trim() && !isSubmitting
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }
                `}
              >
                <Save className="w-5 h-5" />
                {isSubmitting ? '保存中...' : '保存备注'}
              </button>
            </div>

            {showSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700"
              >
                <CheckCircle className="w-5 h-5" />
                备注保存成功！
              </motion.div>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 bg-white rounded-2xl shadow-lg p-6"
        >
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Diff className="w-5 h-5" />
            补录历史 ({gameSupplements.length})
          </h2>

          {gameSupplements.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无补录记录</p>
            </div>
          ) : (
            <div className="space-y-4">
              {gameSupplements.map((supplement, index) => (
                <div key={index} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">{supplement.supplementedBy}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(supplement.supplementedAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm rounded-full">
                      补录 #{gameSupplements.length - index}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-slate-700 whitespace-pre-wrap">{supplement.notes}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2">差异记录</p>
                      {supplement.adjustments.map((adj, adjIndex) => (
                        <div key={adjIndex} className="flex items-center gap-2 text-sm">
                          <span className="text-slate-600">{adj.reason}:</span>
                          <span className="text-slate-400 line-through">{String(adj.oldValue) || '(空)'}</span>
                          <span className="text-slate-500">→</span>
                          <span className="text-green-600 font-medium">{String(adj.newValue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 p-5 bg-amber-50 border border-amber-200 rounded-xl"
        >
          <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            审计追踪说明
          </h3>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• 所有补录记录将永久保存，不可删除或修改</li>
            <li>• 系统会记录补录人、补录时间和原始分数</li>
            <li>• 其他老师接手时可完整查看判分依据</li>
            <li>• 补录内容不影响原始游戏得分</li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
