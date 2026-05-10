import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  FileText,
  Download,
  Calendar,
  Clock,
  Activity,
  Target,
  Lightbulb,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import api, { handleApiError } from '../api/client';
import {
  MemberDetail,
  TrainingPlan,
  TrainingSession,
  PlanExercise,
  TrainingAdvice,
  BodyMeasurement,
} from '../types';
import { ToastItem } from '../App';
import Modal from '../components/Modal';
import RiskAlert from '../components/RiskAlert';

interface MemberDetailProps {
  addToast: (message: string, type: ToastItem['type']) => void;
}

const MemberDetailPage: React.FC<MemberDetailProps> = ({ addToast }) => {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'sessions' | 'history'>('overview');

  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [showInjuryModal, setShowInjuryModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const [newMeasurement, setNewMeasurement] = useState({
    weight: '',
    height: '',
    bodyFat: '',
    muscleMass: '',
    flexibility: '3',
    strength: '3',
    endurance: '3',
    cardio: '3',
    notes: '',
  });

  const [newInjury, setNewInjury] = useState({
    bodyPart: '',
    severity: '中',
    description: '',
    restrictedActions: '',
  });

  const [newPlan, setNewPlan] = useState({
    name: '',
    description: '',
    exercises: [{ name: '', sets: 3, reps: 12, weight: '', notes: '' }] as PlanExerciseForm[],
  });

  const [newSession, setNewSession] = useState({
    planId: '',
    sessionDate: format(new Date(), 'yyyy-MM-dd'),
    durationMinutes: 60,
  });

  const [newPayment, setNewPayment] = useState({
    totalSessions: 12,
    note: '',
  });

  const [exportData, setExportData] = useState<any>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [planHistory, setPlanHistory] = useState<TrainingPlan[]>([]);

  useEffect(() => {
    if (id) {
      fetchMemberDetail();
    }
  }, [id]);

  const fetchMemberDetail = async () => {
    setLoading(true);
    try {
      const [memberRes, sessionsRes, plansRes] = await Promise.all([
        api.get(`/members/${id}`),
        api.get(`/sessions?memberId=${id}`),
        api.get(`/plans/history?memberId=${id}`),
      ]);

      setMember(memberRes.data.data);
      setSessions(sessionsRes.data.data || []);
      setPlanHistory(plansRes.data.data || []);
    } catch (err: any) {
      addToast(handleApiError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMeasurement = async () => {
    try {
      const data = {
        memberId: id,
        weight: newMeasurement.weight ? parseFloat(newMeasurement.weight) : undefined,
        height: newMeasurement.height ? parseFloat(newMeasurement.height) : undefined,
        bodyFat: newMeasurement.bodyFat ? parseFloat(newMeasurement.bodyFat) : undefined,
        muscleMass: newMeasurement.muscleMass ? parseFloat(newMeasurement.muscleMass) : undefined,
        flexibility: parseInt(newMeasurement.flexibility),
        strength: parseInt(newMeasurement.strength),
        endurance: parseInt(newMeasurement.endurance),
        cardio: parseInt(newMeasurement.cardio),
        notes: newMeasurement.notes,
      };

      const response = await api.post('/measurements', data);
      addToast(response.data.message || '体测数据已保存', 'success');
      setShowMeasurementModal(false);
      fetchMemberDetail();
    } catch (err: any) {
      addToast(handleApiError(err), 'error');
    }
  };

  const handleAddInjury = async () => {
    if (!newInjury.bodyPart) {
      addToast('请填写伤病部位', 'warning');
      return;
    }

    try {
      const data = {
        memberId: id,
        bodyPart: newInjury.bodyPart,
        severity: newInjury.severity,
        description: newInjury.description,
        restrictedActions: newInjury.restrictedActions
          .split(/[,，、\s]+/)
          .filter(Boolean),
      };

      const response = await api.post('/injuries', data);
      addToast(response.data.message || '伤病记录已保存', 'success');
      setShowInjuryModal(false);
      setNewInjury({ bodyPart: '', severity: '中', description: '', restrictedActions: '' });
      fetchMemberDetail();
    } catch (err: any) {
      addToast(handleApiError(err), 'error');
    }
  };

  const handleAddPlan = async () => {
    if (!newPlan.name) {
      addToast('请填写计划名称', 'warning');
      return;
    }

    const validExercises = newPlan.exercises.filter((e) => e.name.trim());
    if (validExercises.length === 0) {
      addToast('请至少添加一个训练动作', 'warning');
      return;
    }

    try {
      const data = {
        memberId: id,
        name: newPlan.name,
        description: newPlan.description,
        exercises: validExercises.map((e) => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          weight: e.weight ? parseFloat(e.weight) : undefined,
          notes: e.notes,
        })),
      };

      const response = await api.post('/plans', data);
      addToast(response.data.message || '训练计划已创建', 'success');
      setShowPlanModal(false);
      setNewPlan({
        name: '',
        description: '',
        exercises: [{ name: '', sets: 3, reps: 12, weight: '', notes: '' }],
      });
      fetchMemberDetail();
    } catch (err: any) {
      addToast(handleApiError(err), 'error');
    }
  };

  const handleAddSession = async () => {
    if (!newSession.sessionDate) {
      addToast('请选择训练日期', 'warning');
      return;
    }

    try {
      const data = {
        memberId: id,
        planId: newSession.planId || undefined,
        sessionDate: newSession.sessionDate,
        durationMinutes: newSession.durationMinutes,
      };

      const response = await api.post('/sessions', data);
      addToast(response.data.message || '训练记录已创建', 'success');
      if (response.data.warning) {
        addToast(response.data.warning, 'warning');
      }
      setShowSessionModal(false);
      fetchMemberDetail();
    } catch (err: any) {
      addToast(handleApiError(err), 'error');
    }
  };

  const handleAddPayment = async () => {
    if (newPayment.totalSessions <= 0) {
      addToast('课时数量必须大于0', 'warning');
      return;
    }

    try {
      const data = {
        memberId: id,
        totalSessions: newPayment.totalSessions,
        note: newPayment.note,
      };

      const response = await api.post('/payments', data);
      addToast(response.data.message || '课时已添加', 'success');
      setShowPaymentModal(false);
      fetchMemberDetail();
    } catch (err: any) {
      addToast(handleApiError(err), 'error');
    }
  };

  const handleResolveInjury = async (injuryId: string) => {
    try {
      const response = await api.put(`/injuries/${injuryId}`, {
        isActive: false,
        endDate: new Date().toISOString(),
      });
      addToast(response.data.message || '伤病已标记为康复', 'success');
      fetchMemberDetail();
    } catch (err: any) {
      addToast(handleApiError(err), 'error');
    }
  };

  const handleCompleteSession = async (sessionId: string) => {
    try {
      const response = await api.post(`/sessions/${sessionId}/complete`, {});
      addToast(response.data.message || '训练已完成', 'success');
      fetchMemberDetail();
    } catch (err: any) {
      addToast(handleApiError(err), 'error');
    }
  };

  const handleExportPlan = async (planId: string) => {
    try {
      const response = await api.get(`/export/plan?memberId=${id}&planId=${planId}`);
      setExportData(response.data.data);
      setShowExportModal(true);
    } catch (err: any) {
      addToast(handleApiError(err), 'error');
    }
  };

  const addExerciseToPlan = () => {
    setNewPlan({
      ...newPlan,
      exercises: [
        ...newPlan.exercises,
        { name: '', sets: 3, reps: 12, weight: '', notes: '' },
      ],
    });
  };

  const updatePlanExercise = (index: number, field: keyof PlanExerciseForm, value: any) => {
    const exercises = [...newPlan.exercises];
    (exercises[index] as any)[field] = value;
    setNewPlan({ ...newPlan, exercises });
  };

  const removePlanExercise = (index: number) => {
    const exercises = newPlan.exercises.filter((_, i) => i !== index);
    setNewPlan({
      ...newPlan,
      exercises: exercises.length === 0
        ? [{ name: '', sets: 3, reps: 12, weight: '', notes: '' }]
        : exercises,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">会员不存在</h2>
        <Link to="/" className="text-indigo-600 hover:underline">
          返回会员列表
        </Link>
      </div>
    );
  }

  const activePlans = planHistory.filter((p) => p.isActive);
  const pendingSessions = sessions.filter((s) => !s.isCompleted);
  const completedSessions = sessions.filter((s) => s.isCompleted);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          返回列表
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 font-bold text-2xl">
                {member.name.charAt(0)}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
              <p className="text-gray-500">{member.phone}</p>
              <p className="text-sm text-gray-400">
                入会时间：{format(new Date(member.joinDate), 'yyyy年MM月dd日', { locale: zhCN })}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">
              {member.sessionSummary.remaining}
            </div>
            <div className="text-sm text-gray-500">剩余课时</div>
            <div className="text-xs text-gray-400">
              已用 {member.sessionSummary.used} / 总共 {member.sessionSummary.total}
            </div>
          </div>
        </div>
      </div>

      {(member.activeInjuries?.length > 0 || member.sessionSummary.hasLowSessions) && (
        <div className="mb-6">
          <RiskAlert
            injuries={member.injuries}
            remainingSessions={member.sessionSummary.remaining}
            hasLowSessions={member.sessionSummary.hasLowSessions}
          />
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'overview', label: '总览' },
          { key: 'plans', label: '训练计划' },
          { key: 'sessions', label: '训练记录' },
          { key: 'history', label: '历史版本' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {member.trainingAdvice && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-indigo-900">训练建议（基于体测数据）</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-indigo-700 mb-2">
                    <Target className="w-4 h-4 inline mr-1" />
                    重点训练方向
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {member.trainingAdvice.focusAreas.map((area, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <h4 className="text-sm font-medium text-indigo-700 mb-2">
                    <Activity className="w-4 h-4 inline mr-1" />
                    建议动作
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {member.trainingAdvice.exercises.map((ex, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-white text-indigo-600 text-xs rounded border border-indigo-200"
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-indigo-200">
                <h4 className="text-sm font-medium text-indigo-700 mb-2">详细建议</h4>
                <ul className="text-sm text-indigo-800 space-y-1">
                  {member.trainingAdvice.recommendations.map((rec, i) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">体测数据</h3>
                <button
                  onClick={() => setShowMeasurementModal(true)}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  新增体测
                </button>
              </div>

              {member.latestMeasurement ? (
                <div className="space-y-3">
                  <div className="text-xs text-gray-500 mb-2">
                    测量时间：{format(new Date(member.latestMeasurement.measuredAt), 'yyyy年MM月dd日', { locale: zhCN })}
                  </div>
                  <MeasurementDisplay label="身高" value={member.latestMeasurement.height} unit="cm" />
                  <MeasurementDisplay label="体重" value={member.latestMeasurement.weight} unit="kg" />
                  <MeasurementDisplay
                    label="BMI"
                    value={member.latestMeasurement.bmi}
                    highlight={
                      member.latestMeasurement.bmi !== undefined
                        ? member.latestMeasurement.bmi >= 28
                          ? 'text-red-600'
                          : member.latestMeasurement.bmi < 18.5
                          ? 'text-yellow-600'
                          : 'text-green-600'
                        : undefined
                    }
                  />
                  <MeasurementDisplay label="体脂率" value={member.latestMeasurement.bodyFat} unit="%" />
                  <MeasurementDisplay label="肌肉量" value={member.latestMeasurement.muscleMass} unit="kg" />

                  <div className="pt-3 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-3">
                      <CapabilityBar
                        label="柔韧性"
                        value={member.latestMeasurement.flexibility}
                      />
                      <CapabilityBar
                        label="力量"
                        value={member.latestMeasurement.strength}
                      />
                      <CapabilityBar
                        label="耐力"
                        value={member.latestMeasurement.endurance}
                      />
                      <CapabilityBar
                        label="心肺"
                        value={member.latestMeasurement.cardio}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>暂无体测数据</p>
                  <p className="text-sm">点击上方按钮添加首次体测</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">伤病记录</h3>
                <button
                  onClick={() => setShowInjuryModal(true)}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  记录伤病
                </button>
              </div>

              {member.injuries && member.injuries.length > 0 ? (
                <div className="space-y-3">
                  {member.injuries.map((injury) => (
                    <div
                      key={injury.id}
                      className={`p-3 rounded-lg border ${
                        injury.isActive
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {injury.bodyPart}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${
                              injury.severity === '重'
                                ? 'bg-red-100 text-red-700'
                                : injury.severity === '中'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {injury.severity}度
                          </span>
                          {!injury.isActive && (
                            <span className="text-xs text-gray-500">已康复</span>
                          )}
                        </div>
                        {injury.isActive && (
                          <button
                            onClick={() => handleResolveInjury(injury.id)}
                            className="text-xs text-green-600 hover:text-green-700"
                          >
                            标记康复
                          </button>
                        )}
                      </div>
                      {injury.description && (
                        <p className="text-sm text-gray-600 mt-1">{injury.description}</p>
                      )}
                      {injury.restrictedActions.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          限制动作：{injury.restrictedActions.join('、')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="w-12 h-12 mx-auto mb-2 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-bold">✓</span>
                  </div>
                  <p>暂无伤病记录</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">课时管理</h3>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  续课
                </button>
              </div>

              <div className="text-center">
                <div
                  className={`text-4xl font-bold ${
                    member.sessionSummary.hasLowSessions
                      ? 'text-red-600'
                      : 'text-gray-900'
                  }`}
                >
                  {member.sessionSummary.remaining}
                </div>
                <div className="text-sm text-gray-500 mt-1">剩余课时</div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">已用</span>
                  <span className="font-medium">{member.sessionSummary.used} 节</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">总共</span>
                  <span className="font-medium">{member.sessionSummary.total} 节</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">待完成训练</h3>
                <button
                  onClick={() => setShowSessionModal(true)}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  预约
                </button>
              </div>

              {pendingSessions.length > 0 ? (
                <div className="space-y-2">
                  {pendingSessions.slice(0, 3).map((session) => (
                    <div
                      key={session.id}
                      className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {format(new Date(session.sessionDate), 'MM月dd日', { locale: zhCN })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {session.durationMinutes} 分钟
                          {session.plan && ` · ${session.plan.name}`}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCompleteSession(session.id)}
                        className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        完成
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">暂无待完成训练</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">训练计划</h3>
                <button
                  onClick={() => setShowPlanModal(true)}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  新建
                </button>
              </div>

              {activePlans.length > 0 ? (
                <div className="space-y-2">
                  {activePlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="p-3 bg-indigo-50 rounded-lg border border-indigo-100"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {plan.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            v{plan.version} · {plan.exercises.length} 个动作
                          </div>
                        </div>
                        <button
                          onClick={() => handleExportPlan(plan.id)}
                          className="p-1 hover:bg-indigo-100 rounded"
                          title="导出方案"
                        >
                          <Download className="w-4 h-4 text-indigo-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">暂无训练计划</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'plans' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">训练计划</h2>
            <button
              onClick={() => setShowPlanModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              新建计划
            </button>
          </div>

          {activePlans.length > 0 ? (
            <div className="space-y-4">
              {activePlans.map((plan) => (
                <div
                  key={plan.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                      <p className="text-sm text-gray-500">
                        版本 v{plan.version} · 创建于{' '}
                        {format(new Date(plan.createdAt), 'yyyy年MM月dd日', { locale: zhCN })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExportPlan(plan.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      >
                        <Download className="w-4 h-4" />
                        导出方案
                      </button>
                    </div>
                  </div>
                  {plan.description && (
                    <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600">
                      {plan.description}
                    </div>
                  )}
                  <div className="divide-y divide-gray-100">
                    {plan.exercises.map((exercise, idx) => (
                      <div
                        key={exercise.id}
                        className="px-4 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-medium text-gray-900">
                              {exercise.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {exercise.sets} 组 × {exercise.reps} 次
                              {exercise.weight && ` · ${exercise.weight}kg`}
                            </div>
                          </div>
                        </div>
                        {exercise.notes && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {exercise.notes}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无训练计划</h3>
              <p className="text-gray-500 mb-6">为会员创建第一个训练计划</p>
              <button
                onClick={() => setShowPlanModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5" />
                新建计划
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sessions' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">训练记录</h2>
            <button
              onClick={() => setShowSessionModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              预约训练
            </button>
          </div>

          {pendingSessions.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-medium text-gray-500 mb-3">待完成</h3>
              <div className="space-y-3">
                {pendingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-white rounded-lg border border-blue-200 p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {format(new Date(session.sessionDate), 'yyyy年MM月dd日', { locale: zhCN })}
                        </div>
                        <div className="text-sm text-gray-500">
                          {session.durationMinutes} 分钟
                          {session.plan && ` · ${session.plan.name}`}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCompleteSession(session.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      标记完成
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedSessions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">已完成</h3>
              <div className="space-y-3">
                {completedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-white rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                          <span className="text-green-600 font-bold">✓</span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {format(new Date(session.sessionDate), 'yyyy年MM月dd日', { locale: zhCN })}
                          </div>
                          <div className="text-sm text-gray-500">
                            {session.durationMinutes} 分钟
                            {session.plan && ` · ${session.plan.name}`}
                          </div>
                        </div>
                      </div>
                      {session.rating && (
                        <div className="text-yellow-500">
                          {'★'.repeat(session.rating)}
                          {'☆'.repeat(5 - session.rating)}
                        </div>
                      )}
                    </div>
                    {session.feedback && (
                      <div className="ml-16 mt-2 p-3 bg-gray-50 rounded text-sm text-gray-600">
                        {session.feedback}
                      </div>
                    )}
                    {session.exercises.length > 0 && (
                      <div className="ml-16 mt-3">
                        <div className="text-xs text-gray-500 mb-2">完成动作：</div>
                        <div className="flex flex-wrap gap-2">
                          {session.exercises.map((ex, i) => (
                            <span
                              key={i}
                              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                            >
                              {ex.exerciseName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sessions.length === 0 && (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
              <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无训练记录</h3>
              <p className="text-gray-500 mb-6">预约第一次训练开始记录</p>
              <button
                onClick={() => setShowSessionModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5" />
                预约训练
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">计划历史版本</h2>

          {planHistory.length > 0 ? (
            <div className="space-y-4">
              {planHistory.map((plan) => (
                <div
                  key={plan.id}
                  className={`bg-white rounded-xl border ${
                    plan.isActive
                      ? 'border-indigo-200 bg-indigo-50/30'
                      : 'border-gray-200'
                  } overflow-hidden`}
                >
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            plan.isActive
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {plan.isActive ? '当前版本' : '历史版本'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        v{plan.version} · 创建于{' '}
                        {format(new Date(plan.createdAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleExportPlan(plan.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    >
                      <Download className="w-4 h-4" />
                      导出
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {plan.exercises.map((exercise, idx) => (
                      <div
                        key={exercise.id}
                        className="px-4 py-2 flex items-center gap-4 text-sm"
                      >
                        <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                          {idx + 1}
                        </span>
                        <span className="font-medium">{exercise.name}</span>
                        <span className="text-gray-500">
                          {exercise.sets}×{exercise.reps}
                          {exercise.weight && ` · ${exercise.weight}kg`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
              <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无历史版本</h3>
              <p className="text-gray-500">修改计划后会自动保存历史版本</p>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={showMeasurementModal}
        onClose={() => setShowMeasurementModal(false)}
        title="新增体测数据"
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              身高 (cm)
            </label>
            <input
              type="number"
              value={newMeasurement.height}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, height: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="170"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              体重 (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={newMeasurement.weight}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, weight: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="65.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              体脂率 (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={newMeasurement.bodyFat}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, bodyFat: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="22"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              肌肉量 (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={newMeasurement.muscleMass}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, muscleMass: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="35"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              柔韧性 (1-5)
            </label>
            <select
              value={newMeasurement.flexibility}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, flexibility: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v} - {v <= 2 ? '较差' : v === 3 ? '一般' : v === 4 ? '良好' : '优秀'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              力量 (1-5)
            </label>
            <select
              value={newMeasurement.strength}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, strength: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v} - {v <= 2 ? '较差' : v === 3 ? '一般' : v === 4 ? '良好' : '优秀'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              耐力 (1-5)
            </label>
            <select
              value={newMeasurement.endurance}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, endurance: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v} - {v <= 2 ? '较差' : v === 3 ? '一般' : v === 4 ? '良好' : '优秀'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              心肺 (1-5)
            </label>
            <select
              value={newMeasurement.cardio}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, cardio: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v} - {v <= 2 ? '较差' : v === 3 ? '一般' : v === 4 ? '良好' : '优秀'}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              value={newMeasurement.notes}
              onChange={(e) => setNewMeasurement({ ...newMeasurement, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="其他备注信息..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowMeasurementModal(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleAddMeasurement}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            保存
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showInjuryModal}
        onClose={() => setShowInjuryModal(false)}
        title="记录伤病"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              伤病部位 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newInjury.bodyPart}
              onChange={(e) => setNewInjury({ ...newInjury, bodyPart: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="如：膝、腰、肩"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">严重程度</label>
            <select
              value={newInjury.severity}
              onChange={(e) => setNewInjury({ ...newInjury, severity: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="轻">轻度</option>
              <option value="中">中度</option>
              <option value="重">重度</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={newInjury.description}
              onChange={(e) => setNewInjury({ ...newInjury, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="伤病详细描述..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              限制动作
              <span className="text-xs text-gray-500 ml-1">
                （用逗号或空格分隔多个动作）
              </span>
            </label>
            <input
              type="text"
              value={newInjury.restrictedActions}
              onChange={(e) => setNewInjury({ ...newInjury, restrictedActions: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="深蹲, 跑步, 跳跃"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowInjuryModal(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleAddInjury}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            保存
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        title="新建训练计划"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              计划名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newPlan.name}
              onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="如：减脂计划、增肌计划"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={newPlan.description}
              onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="计划目标和说明..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">训练动作</label>
              <button
                onClick={addExerciseToPlan}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                + 添加动作
              </button>
            </div>
            <div className="space-y-3">
              {newPlan.exercises.map((exercise, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">
                      动作 {idx + 1}
                    </span>
                    {newPlan.exercises.length > 1 && (
                      <button
                        onClick={() => removePlanExercise(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <input
                      type="text"
                      value={exercise.name}
                      onChange={(e) =>
                        updatePlanExercise(idx, 'name', e.target.value)
                      }
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="动作名称"
                    />
                    <input
                      type="number"
                      value={exercise.sets}
                      onChange={(e) =>
                        updatePlanExercise(idx, 'sets', parseInt(e.target.value) || 0)
                      }
                      className="px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="组数"
                    />
                    <input
                      type="number"
                      value={exercise.reps}
                      onChange={(e) =>
                        updatePlanExercise(idx, 'reps', parseInt(e.target.value) || 0)
                      }
                      className="px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="次数"
                    />
                    <input
                      type="text"
                      value={exercise.weight}
                      onChange={(e) =>
                        updatePlanExercise(idx, 'weight', e.target.value)
                      }
                      className="px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="重量kg"
                    />
                  </div>
                  <input
                    type="text"
                    value={exercise.notes}
                    onChange={(e) =>
                      updatePlanExercise(idx, 'notes', e.target.value)
                    }
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="备注（可选）"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowPlanModal(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleAddPlan}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            创建计划
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        title="预约训练"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              训练日期 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={newSession.sessionDate}
              onChange={(e) => setNewSession({ ...newSession, sessionDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">训练时长（分钟）</label>
            <input
              type="number"
              value={newSession.durationMinutes}
              onChange={(e) =>
                setNewSession({ ...newSession, durationMinutes: parseInt(e.target.value) || 60 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">关联计划</label>
            <select
              value={newSession.planId}
              onChange={(e) => setNewSession({ ...newSession, planId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">不关联计划</option>
              {activePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} (v{plan.version})
                </option>
              ))}
            </select>
          </div>

          {member.sessionSummary.hasLowSessions && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              注意：会员剩余课时不足（剩余 {member.sessionSummary.remaining} 节）
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowSessionModal(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleAddSession}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            确认预约
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="续课"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              购买课时 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={newPayment.totalSessions}
              onChange={(e) =>
                setNewPayment({ ...newPayment, totalSessions: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              value={newPayment.note}
              onChange={(e) => setNewPayment({ ...newPayment, note: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="购课备注..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowPaymentModal(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleAddPayment}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            确认
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="训练方案"
        size="xl"
      >
        {exportData && (
          <div className="space-y-6">
            <div className="text-center pb-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">个人训练方案</h2>
              <p className="text-sm text-gray-500 mt-1">
                {exportData.member.name} ·{' '}
                {format(new Date(exportData.exportDate), 'yyyy年MM月dd日', { locale: zhCN })}
              </p>
            </div>

            {exportData.latestMeasurement && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">体测数据</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {exportData.latestMeasurement.bmi || '-'}
                    </div>
                    <div className="text-xs text-gray-500">BMI</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {exportData.latestMeasurement.weight || '-'}
                    </div>
                    <div className="text-xs text-gray-500">体重(kg)</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {exportData.latestMeasurement.bodyFat || '-'}
                    </div>
                    <div className="text-xs text-gray-500">体脂率(%)</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {exportData.latestMeasurement.muscleMass || '-'}
                    </div>
                    <div className="text-xs text-gray-500">肌肉量(kg)</div>
                  </div>
                </div>
              </div>
            )}

            {exportData.activeInjuries.length > 0 && (
              <div>
                <h3 className="font-semibold text-red-700 mb-3">伤病注意</h3>
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  {exportData.activeInjuries.map((injury: any, i: number) => (
                    <div key={i} className="text-sm text-red-800">
                      <span className="font-medium">{injury.bodyPart} ({injury.severity}度)</span>
                      {injury.description && ` - ${injury.description}`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {exportData.trainingAdvice && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">训练建议</h3>
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {exportData.trainingAdvice.focusAreas.map((area: string, i: number) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-full"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                  <ul className="text-sm text-indigo-800 space-y-1">
                    {exportData.trainingAdvice.recommendations.map(
                      (rec: string, i: number) => (
                        <li key={i}>• {rec}</li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                训练计划 - {exportData.trainingPlan.name}{' '}
                <span className="text-sm font-normal text-gray-500">
                  (v{exportData.trainingPlan.version})
                </span>
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">顺序</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">动作</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">组数</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">次数</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">重量</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">备注</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {exportData.trainingPlan.exercises.map(
                      (ex: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-gray-500">{idx + 1}</td>
                          <td className="px-4 py-2 text-sm font-medium">{ex.name}</td>
                          <td className="px-4 py-2 text-sm">{ex.sets}</td>
                          <td className="px-4 py-2 text-sm">{ex.reps}</td>
                          <td className="px-4 py-2 text-sm">
                            {ex.weight ? `${ex.weight}kg` : '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {ex.notes || '-'}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-4 border-t flex items-center justify-between">
              <div className="text-sm text-gray-500">
                课时信息：剩余 {exportData.sessionInfo.remaining} 节 / 总共{' '}
                {exportData.sessionInfo.total} 节
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const blob = new Blob(
                      [JSON.stringify(exportData, null, 2)],
                      { type: 'application/json' }
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${exportData.member.name}-训练方案.json`;
                    a.click();
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                >
                  <Download className="w-4 h-4" />
                  下载JSON
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

interface PlanExerciseForm {
  name: string;
  sets: number;
  reps: number;
  weight: string;
  notes: string;
}

function MeasurementDisplay({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value?: number;
  unit?: string;
  highlight?: string;
}) {
  if (value === undefined) return null;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`font-medium ${highlight || 'text-gray-900'}`}>
        {value}
        {unit}
      </span>
    </div>
  );
}

function CapabilityBar({ label, value }: { label: string; value?: number }) {
  const v = value || 0;
  const percentage = (v / 5) * 100;
  const color =
    v <= 2
      ? 'bg-red-500'
      : v === 3
      ? 'bg-yellow-500'
      : v === 4
      ? 'bg-blue-500'
      : 'bg-green-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs font-medium text-gray-700">{v}/5</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

export default MemberDetailPage;
