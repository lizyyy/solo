import { useEffect, useState } from "react";
import { Star, Trophy, Save, Settings } from "lucide-react";
import { useStore } from "../store/useStore";
import { api } from "../api/client";
import type { RewardRule } from "../../shared/types";

export default function Rewards() {
  const {
    students,
    transactions,
    rewardRules,
    fetchStudents,
    fetchTransactions,
    fetchRewardRules,
  } = useStore();

  const [summary, setSummary] = useState<
    {
      student_id: number;
      student_name: string;
      total_stars: number;
      rank: number;
    }[]
  >([]);
  const [editingRules, setEditingRules] = useState<RewardRule[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStudent, setFilterStudent] = useState<number | "all">("all");

  useEffect(() => {
    fetchStudents();
    fetchTransactions();
    fetchRewardRules();
    loadSummary();
  }, [fetchStudents, fetchTransactions, fetchRewardRules]);

  useEffect(() => {
    setEditingRules(rewardRules);
  }, [rewardRules]);

  const loadSummary = async () => {
    const data = await api.rewards.getSummary();
    setSummary(data);
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      const rulesToUpdate = editingRules.map((r) => ({
        rule_key: r.rule_key,
        rule_value: r.rule_value,
      }));
      await api.rewards.updateRules(rulesToUpdate);
      await fetchRewardRules();
      setShowRules(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingRules(false);
    }
  };

  const handleFilter = () => {
    const options: { student_id?: number; type?: string } = {};
    if (filterStudent !== "all") options.student_id = filterStudent;
    if (filterType !== "all") options.type = filterType;
    fetchTransactions(options);
  };

  useEffect(() => {
    handleFilter();
  }, [filterType, filterStudent]);

  const getTypeLabel = (type: string) => {
    const labels: Record<string, { label: string; color: string; icon: string }> = {
      checkin_earn: { label: "打卡获得", color: "text-mint bg-mint/10", icon: "✅" },
      leave_deduct: { label: "请假扣除", color: "text-coral bg-coral/10", icon: "🏖️" },
      makeup_return: { label: "补练返还", color: "text-blue-600 bg-blue-50", icon: "🔄" },
      manual_adjust: { label: "手动调整", color: "text-gray-600 bg-gray-100", icon: "✏️" },
    };
    return labels[type] || { label: type, color: "text-gray-600 bg-gray-100", icon: "📝" };
  };

  const getRuleDescription = (key: string) => {
    const descriptions: Record<string, string> = {
      stars_per_minute: "每练琴1分钟获得星星数",
      leave_deduction: "请假一次扣除星星数",
      makeup_return_rate: "补练返还倍率",
      abnormal_threshold: "时长异常阈值（分钟）",
    };
    return descriptions[key] || key;
  };

  const top3 = summary.slice(0, 3);
  const rest = summary.slice(3);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display text-secondary mb-2">奖励星榜</h1>
          <p className="text-gray-500">查看星星排行、奖励规则和流水记录</p>
        </div>
        <button
          onClick={() => setShowRules(true)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Settings size={18} />
          配置规则
        </button>
      </div>

      <div className="bg-gradient-to-br from-gold/10 to-amber-100 rounded-2xl p-6 mb-8">
        <h2 className="font-display text-xl text-secondary mb-6 flex items-center gap-2">
          <Trophy className="text-gold" size={24} />
          星星排行榜
        </h2>

        {top3.length > 0 && (
          <div className="flex items-end justify-center gap-4 mb-8">
            {top3.length >= 2 && (
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-white shadow-md flex items-center justify-center mb-2 mx-auto">
                  <span className="text-3xl">🥈</span>
                </div>
                <p className="font-medium">{top3[1]?.student_name}</p>
                <p className="text-2xl font-bold text-gold">
                  {top3[1]?.total_stars} ⭐
                </p>
                <div className="h-16 bg-silver/20 mt-2 rounded-t-lg border-2 border-gray-300 flex items-center justify-center">
                  <span className="font-bold text-gray-500">2</span>
                </div>
              </div>
            )}

            {top3.length >= 1 && (
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-white shadow-lg flex items-center justify-center mb-2 mx-auto">
                  <span className="text-4xl">🥇</span>
                </div>
                <p className="font-medium text-lg">{top3[0]?.student_name}</p>
                <p className="text-3xl font-bold text-gold">
                  {top3[0]?.total_stars} ⭐
                </p>
                <div className="h-24 bg-gold/20 mt-2 rounded-t-lg border-2 border-gold flex items-center justify-center">
                  <span className="font-bold text-gold">1</span>
                </div>
              </div>
            )}

            {top3.length >= 3 && (
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-white shadow-md flex items-center justify-center mb-2 mx-auto">
                  <span className="text-3xl">🥉</span>
                </div>
                <p className="font-medium">{top3[2]?.student_name}</p>
                <p className="text-2xl font-bold text-gold">
                  {top3[2]?.total_stars} ⭐
                </p>
                <div className="h-12 bg-amber-700/20 mt-2 rounded-t-lg border-2 border-amber-700/50 flex items-center justify-center">
                  <span className="font-bold text-amber-700/70">3</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl overflow-hidden">
          {rest.map((item) => (
            <div
              key={item.student_id}
              className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0"
            >
              <span className="w-8 text-center font-bold text-gray-400">
                {item.rank}
              </span>
              <span className="flex-1 font-medium">{item.student_name}</span>
              <span className="font-bold text-gold">
                {item.total_stars} ⭐
              </span>
            </div>
          ))}
          {summary.length === 0 && (
            <div className="p-8 text-center text-gray-400">暂无排行数据</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">学生</label>
            <select
              value={filterStudent}
              onChange={(e) =>
                setFilterStudent(
                  e.target.value === "all" ? "all" : parseInt(e.target.value)
                )
              }
              className="px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
            >
              <option value="all">全部学生</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">类型</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50"
            >
              <option value="all">全部类型</option>
              <option value="checkin_earn">打卡获得</option>
              <option value="leave_deduct">请假扣除</option>
              <option value="makeup_return">补练返还</option>
              <option value="manual_adjust">手动调整</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-medium">星星流水记录</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {transactions.length === 0 ? (
            <div className="p-12 text-center text-gray-400">暂无流水记录</div>
          ) : (
            transactions.map((tx) => {
              const typeInfo = getTypeLabel(tx.type);
              const student = students.find((s) => s.id === tx.student_id);
              return (
                <div key={tx.id} className="p-4 flex items-center gap-4">
                  <span className="text-2xl">{typeInfo.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium">{student?.name}</p>
                    <p className="text-sm text-gray-500">
                      {tx.note}
                    </p>
                    <p className="text-xs text-gray-400">{tx.created_at}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${typeInfo.color}`}
                    >
                      {typeInfo.label}
                    </span>
                    <p
                      className={`text-lg font-bold ${
                        tx.amount > 0 ? "text-mint" : "text-coral"
                      }`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount} ⭐
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showRules && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="font-display text-xl text-secondary mb-4 flex items-center gap-2">
              <Star className="text-gold" size={24} />
              奖励规则配置
            </h2>

            <div className="space-y-4 mb-6">
              {editingRules.map((rule) => (
                <div key={rule.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getRuleDescription(rule.rule_key)}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={rule.rule_value}
                    onChange={(e) => {
                      setEditingRules(
                        editingRules.map((r) =>
                          r.id === rule.id
                            ? { ...r, rule_value: parseFloat(e.target.value) || 0 }
                            : r
                        )
                      );
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
                  />
                </div>
              ))}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h4 className="font-medium text-blue-800 mb-2 text-sm">📋 业务规则说明</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• <strong>打卡归集：</strong>练琴时长 × 每分钟星数 = 当日获得星星</li>
                <li>• <strong>请假扣分：</strong>请假当日扣除固定星星，扣分记录始终保留</li>
                <li>• <strong>补练返还：</strong>补练时长 × 返还倍率 × 每分钟星数 = 返还星星</li>
                <li>• <strong>规则修改：</strong>只影响后续记录，已生成的流水不会回算</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRules(false);
                  setEditingRules(rewardRules);
                }}
                className="flex-1 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveRules}
                disabled={savingRules}
                className="flex-1 py-2 bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save size={16} />
                {savingRules ? "保存中..." : "保存规则"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
