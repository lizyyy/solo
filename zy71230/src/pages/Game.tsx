import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, DollarSign, Users, Music, AlertCircle } from 'lucide-react';
import { useGameEngine } from '../hooks/useGameEngine';
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
    cashFlow,
    totalRevenue,
    totalExpense,
    riskIndex,
    riskEvents,
    decisions,
    isGameOver,
    processCurrentStop,
    applyDisposalOption,
    getDisposalOptions,
    goToPhase,
  } = useGameEngine();

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeRiskEvent, setActiveRiskEvent] = useState<RiskEvent | null>(null);

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

  const unresolvedRisks = useMemo(() => {
    if (!currentStop) return [];
    return riskEvents.filter(
      (r) => r.stopId === currentStop.id && !r.resolvedAt
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

  const handleStartShow = async () => {
    if (!currentStop || unresolvedRisks.length > 0) return;

    setIsProcessing(true);
    try {
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
                disabled={unresolvedRisks.length > 0 || isProcessing}
                loading={isProcessing}
              >
                {unresolvedRisks.length > 0
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
            <NeonCard borderColor="danger-red" title="待处理风险事件">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unresolvedRisks.map((risk) => (
                  <motion.button
                    key={risk.id}
                    onClick={() => setActiveRiskEvent(risk)}
                    className="p-4 bg-rock-darker/50 border border-rock-light rounded-lg text-left hover:border-danger-red/50 transition-all duration-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <RiskBadge level={risk.level} size="sm" showLabel={false} />
                      <span className="text-xs px-2 py-0.5 rounded-full bg-danger-red/20 text-danger-red">
                        {risk.severity === 'critical' ? '严重' : '警告'}
                      </span>
                    </div>
                    <p className="text-sm text-white mb-2 line-clamp-2">{risk.description}</p>
                    <div className="text-xs text-rock-light">
                      预计影响: <span className="text-danger-red font-mono">¥{Math.abs(risk.impact).toLocaleString()}</span>
                    </div>
                  </motion.button>
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
