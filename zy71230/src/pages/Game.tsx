import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, DollarSign, Users, Music, AlertCircle, Shield, X } from 'lucide-react';
import { useGameEngine } from '../hooks/useGameEngine';
import { useGameStore } from '../store/useGameStore';
import { NeonButton, NeonCard, GaugeMeter, RiskBadge } from '../components/ui';
import { RiskEventCard, TourMap, CashFlowPanel, InventoryPanel } from '../components/game';
import type { DisposalOption, RiskEvent } from '../types/tour';

export default function Game() {
  const navigate = useNavigate();
  const {
    currentTour,
    currentStop,
    stops,
    merchItems,
    currentStopIndex,
    currentStopPhase,
    cashFlow,
    totalRevenue,
    totalExpense,
    riskIndex,
    riskEvents,
    decisions,
    isGameOver,
    processCurrentStop,
    checkPreShowRisks,
    applyDisposalOption,
    dismissRiskEvent,
    getDisposalOptions,
    goToPhase,
    setCurrentStopPhase,
  } = useGameEngine();

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeRiskEvent, setActiveRiskEvent] = useState<RiskEvent | null>(null);
  const [riskCheckDone, setRiskCheckDone] = useState(false);

  useEffect(() => {
    if (isGameOver) {
      goToPhase('review');
      navigate('/review');
    }
  }, [isGameOver, navigate, goToPhase]);

  useEffect(() => {
    if (!currentTour) {
      navigate('/import');
    }
  }, [currentTour, navigate]);

  useEffect(() => {
    if (!currentStop || currentStopPhase !== 'risk_check' || riskCheckDone) return;

    const existingRisks = riskEvents.filter(
      (r) => r.stopId === currentStop.id && !r.resolvedAt && !r.dismissed
    );
    if (existingRisks.length > 0) {
      setRiskCheckDone(true);
      return;
    }

    const detectedRisks = checkPreShowRisks(currentStop);
    if (detectedRisks.length > 0) {
      const store = useGameStore.getState();
      detectedRisks.forEach((risk) => {
        const alreadyExists = store.riskEvents.some(
          (r) => r.stopId === risk.stopId && r.type === risk.type && r.description === risk.description
        );
        if (!alreadyExists) {
          store.recordRiskEvent(risk);
        }
      });
    }
    setRiskCheckDone(true);
  }, [currentStop, currentStopPhase, riskCheckDone, checkPreShowRisks, riskEvents]);

  useEffect(() => {
    setRiskCheckDone(false);
  }, [currentStopIndex]);

  const unresolvedRisks = useMemo(() => {
    if (!currentStop) return [];
    return riskEvents.filter(
      (r) => r.stopId === currentStop.id && !r.resolvedAt && !r.dismissed
    );
  }, [riskEvents, currentStop]);

  const resolvedRisks = useMemo(() => {
    if (!currentStop) return [];
    return riskEvents.filter(
      (r) => r.stopId === currentStop.id && !!r.resolvedAt
    );
  }, [riskEvents, currentStop]);

  const currentStopDecisions = useMemo(() => {
    if (!currentStop) return [];
    return decisions.filter((d) => d.stopId === currentStop.id);
  }, [decisions, currentStop]);

  const currentRiskOptions = useMemo(() => {
    if (!activeRiskEvent) return [];
    return getDisposalOptions(activeRiskEvent.type, activeRiskEvent.level);
  }, [activeRiskEvent, getDisposalOptions]);

  const canStartShow = useMemo(() => {
    return unresolvedRisks.length === 0 && currentStopPhase === 'risk_check' && riskCheckDone;
  }, [unresolvedRisks, currentStopPhase, riskCheckDone]);

  const handleStartShow = async () => {
    if (!currentStop || !canStartShow) return;

    setIsProcessing(true);
    try {
      setCurrentStopPhase('show');
      const result = processCurrentStop();
      if (result) {
        goToPhase('settlement');
        navigate(`/settlement/${currentStop.id}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRiskOptionSelect = (option: DisposalOption) => {
    if (!activeRiskEvent) return;
    applyDisposalOption(activeRiskEvent, option);
    setActiveRiskEvent(null);
  };

  const handleRiskDismiss = (risk: RiskEvent) => {
    dismissRiskEvent(risk);
    setActiveRiskEvent(null);
  };

  const handleRiskClose = () => {
    setActiveRiskEvent(null);
  };

  const handleStopClick = (stop: typeof stops[0]) => {
    if (stop.status === 'completed') {
      navigate(`/settlement/${stop.id}`);
    }
  };

  if (!currentTour || !currentStop) {
    return null;
  }

  const netProfit = totalRevenue - totalExpense;
  const progress = ((currentStopIndex) / stops.length) * 100;

  return (
    <div className="min-h-screen bg-rock-darker p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <NeonCard borderColor="neon-pink">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-neon-pink/20">
                <Music className="w-8 h-8 text-neon-pink" />
              </div>
              <div>
                <h1 className="text-2xl font-rock text-white tracking-wider">
                  {currentTour.name}
                </h1>
                {currentTour.bandName && (
                  <p className="text-rock-light text-sm">{currentTour.bandName}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-xs text-rock-light mb-1">巡演进度</div>
                <div className="text-lg font-bold text-neon-cyan font-mono">
                  {currentStopIndex + 1} / {stops.length}
                </div>
                <div className="w-32 h-1.5 bg-rock-gray rounded-full mt-1 overflow-hidden">
                  <motion.div
                    className="h-full bg-neon-cyan rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <GaugeMeter
                  value={riskIndex}
                  label="风险指数"
                  unit="%"
                  size="sm"
                />
              </div>

              {unresolvedRisks.length > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-2 px-3 py-2 bg-danger-red/20 border border-danger-red rounded-lg"
                >
                  <AlertCircle className="w-5 h-5 text-danger-red animate-pulse" />
                  <span className="text-danger-red font-bold text-sm">
                    {unresolvedRisks.length} 个待处理风险
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        </NeonCard>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <TourMap
            stops={stops}
            currentStopIndex={currentStopIndex}
            onStopClick={handleStopClick}
          />
        </motion.div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <CashFlowPanel
              currentBalance={cashFlow}
              totalRevenue={totalRevenue}
              totalExpense={totalExpense}
              netProfit={netProfit}
              riskIndex={riskIndex}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <InventoryPanel items={merchItems} />
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <NeonCard borderColor="neon-cyan">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-start gap-6 flex-1">
              <div className="p-4 rounded-full bg-neon-cyan/20">
                <MapPin className="w-10 h-10 text-neon-cyan" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-rock text-white">
                    第 {currentStopIndex + 1} 站 · {currentStop.city}
                  </h2>
                  <RiskBadge
                    level={
                      riskIndex >= 70 ? 'high' :
                      riskIndex >= 40 ? 'medium' : 'low'
                    }
                    size="sm"
                  />
                  {unresolvedRisks.length > 0 && (
                    <span className="text-xs px-2 py-1 bg-danger-red/20 text-danger-red rounded-full animate-pulse">
                      风险检查中
                    </span>
                  )}
                  {resolvedRisks.length > 0 && unresolvedRisks.length === 0 && riskCheckDone && (
                    <span className="text-xs px-2 py-1 bg-success-green/20 text-success-green rounded-full">
                      风险已处置
                    </span>
                  )}
                </div>
                <p className="text-rock-light mb-3">{currentStop.venue}</p>
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-rock-light" />
                    <span className="text-rock-light">
                      {new Date(currentStop.date).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-rock-light" />
                    <span className="text-rock-light">
                      预计观众: <span className="text-neon-cyan font-mono">{currentStop.predictedAttendance.toLocaleString()}</span> 人
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-rock-light" />
                    <span className="text-rock-light">
                      票价: <span className="text-success-green font-mono">¥{currentStop.ticketPrice}</span>
                    </span>
                  </div>
                </div>

                {currentStopDecisions.length > 0 && (
                  <div className="mt-4 p-3 bg-rock-darker/50 border border-rock-light/50 rounded-lg">
                    <div className="text-xs text-rock-light mb-2">本站已处理决策</div>
                    <div className="flex flex-wrap gap-2">
                      {currentStopDecisions.map((decision) => (
                        <span
                          key={decision.id}
                          className="text-xs px-2 py-1 bg-neon-purple/20 text-neon-purple rounded-full"
                        >
                          {decision.chosenOption.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="text-right">
                <div className="text-xs text-rock-light mb-1">本场预计支出</div>
                <div className="text-xl font-bold font-mono text-danger-red">
                  ¥{(currentStop.venueRent + currentStop.transportCost).toLocaleString()}
                </div>
              </div>
              <NeonButton
                variant="primary"
                size="lg"
                onClick={handleStartShow}
                disabled={!canStartShow || isProcessing}
                loading={isProcessing}
              >
                {!riskCheckDone
                  ? '风险检查中...'
                  : unresolvedRisks.length > 0
                  ? '请先处理风险事件'
                  : isProcessing
                  ? '演出进行中...'
                  : '开始本站演出'}
              </NeonButton>
            </div>
          </div>
        </NeonCard>
      </motion.div>

      <AnimatePresence>
        {unresolvedRisks.length > 0 && !activeRiskEvent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-6"
          >
            <NeonCard borderColor="danger-red">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-danger-red" />
                <h3 className="text-lg font-rock text-white">风险预警 — 处置后方可开演</h3>
                <span className="text-xs text-rock-light ml-auto">
                  点击风险卡片查看处置方案，或直接忽略（将自动扣除惩罚成本）
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unresolvedRisks.map((risk) => (
                  <motion.div
                    key={risk.id}
                    className="p-4 bg-rock-darker/50 border border-rock-light rounded-lg"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <RiskBadge level={risk.level} size="sm" showLabel={false} />
                      <span className="text-xs px-2 py-0.5 rounded-full bg-danger-red/20 text-danger-red">
                        {risk.severity === 'critical' ? '严重' : '警告'}
                      </span>
                    </div>
                    <p className="text-sm text-white mb-3 line-clamp-3">{risk.description}</p>
                    <div className="text-xs text-rock-light mb-3">
                      预计影响: <span className="text-danger-red font-mono">¥{Math.abs(risk.impact).toLocaleString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => setActiveRiskEvent(risk)}
                        className="flex-1 px-3 py-2 text-sm font-bold rounded-lg bg-neon-pink/20 text-neon-pink border border-neon-pink/30 hover:bg-neon-pink/30 transition-all"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Shield className="w-3 h-3 inline mr-1" />
                        处置
                      </motion.button>
                      <motion.button
                        onClick={() => handleRiskDismiss(risk)}
                        className="px-3 py-2 text-sm rounded-lg bg-rock-gray/50 text-rock-light border border-rock-light/30 hover:bg-danger-red/20 hover:text-danger-red hover:border-danger-red/30 transition-all"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <X className="w-3 h-3 inline mr-1" />
                        忽略
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </NeonCard>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeRiskEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-rock-darker/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <RiskEventCard
              event={activeRiskEvent}
              options={currentRiskOptions}
              onOptionSelect={handleRiskOptionSelect}
              onClose={handleRiskClose}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
