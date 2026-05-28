import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin,
  Calendar,
  Users,
  Ticket,
  ShoppingBag,
  Building,
  Bus,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Trophy,
} from 'lucide-react';
import { useGameEngine } from '../hooks/useGameEngine';
import { NeonButton, NeonCard, RiskBadge } from '../components/ui';

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1500,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = value * easeProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  const formattedValue = useMemo(() => {
    return displayValue.toLocaleString('zh-CN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }, [displayValue, decimals]);

  return (
    <span className={className}>
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
}

export default function Settlement() {
  const { stopId } = useParams<{ stopId: string }>();
  const navigate = useNavigate();
  const {
    currentTour,
    stops,
    currentStopIndex,
    stopResults,
    cashFlow,
    isGameOver,
    goToPhase,
  } = useGameEngine();

  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowDetails(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const currentStop = useMemo(() => {
    return stops.find((s) => s.id === stopId) || null;
  }, [stops, stopId]);

  const stopResult = useMemo(() => {
    return stopResults.find((r) => r.stopId === stopId) || null;
  }, [stopResults, stopId]);

  const isLastStop = useMemo(() => {
    if (!currentStop) return false;
    return currentStopIndex >= stops.length;
  }, [currentStop, currentStopIndex, stops.length]);

  const previousCashFlow = useMemo(() => {
    if (!stopResult) return cashFlow;
    return cashFlow - stopResult.netProfit;
  }, [stopResult, cashFlow]);

  useEffect(() => {
    if (!currentTour || !stopId) {
      navigate('/import');
      return;
    }

    if (!stopResult && currentStop?.status !== 'completed') {
      navigate('/game');
    }
  }, [currentTour, stopId, stopResult, currentStop, navigate]);

  const handleContinue = () => {
    if (isLastStop || isGameOver) {
      goToPhase('review');
      navigate('/review');
    } else {
      goToPhase('playing');
      navigate('/game');
    }
  };

  if (!currentTour || !currentStop || !stopResult) {
    return null;
  }

  const completionRate = Math.round(
    (stopResult.actualAttendance / currentStop.predictedAttendance) * 100
  );

  return (
    <div className="min-h-screen bg-rock-darker p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success-green/20 mb-4"
          >
            <CheckCircle2 className="w-12 h-12 text-success-green" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-rock text-white tracking-wider mb-2"
          >
            本站演出完成
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-rock-light"
          >
            {currentTour.name} · 第 {stops.findIndex((s) => s.id === stopId) + 1} 站
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <NeonCard borderColor="neon-cyan">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-neon-cyan/20">
                  <MapPin className="w-8 h-8 text-neon-cyan" />
                </div>
                <div>
                  <h2 className="text-2xl font-rock text-white">{currentStop.city}</h2>
                  <p className="text-rock-light">{currentStop.venue}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-2 text-rock-light text-xs mb-1">
                    <Calendar className="w-3 h-3" />
                    演出日期
                  </div>
                  <div className="text-white font-medium">
                    {new Date(currentStop.date).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-2 text-rock-light text-xs mb-1">
                    <Users className="w-3 h-3" />
                    观众人数
                  </div>
                  <div className="text-neon-cyan font-bold font-mono text-xl">
                    <AnimatedNumber value={stopResult.actualAttendance} suffix=" 人" />
                  </div>
                </div>
              </div>
            </div>
          </NeonCard>
        </motion.div>

        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"
          >
            <NeonCard borderColor="success-green" title="收入明细" className="lg:col-span-1">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-rock-darker/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-success-green" />
                    <span className="text-white">票房收入</span>
                  </div>
                  <span className="text-success-green font-mono font-bold">
                    {formatCurrency(stopResult.ticketRevenue)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-rock-darker/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-success-green" />
                    <span className="text-white">周边收入</span>
                  </div>
                  <span className="text-success-green font-mono font-bold">
                    {formatCurrency(stopResult.merchRevenue)}
                  </span>
                </div>
                <div className="border-t border-rock-light/30 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-rock">总收入</span>
                    <span className="text-success-green font-mono font-bold text-xl">
                      {formatCurrency(stopResult.totalRevenue)}
                    </span>
                  </div>
                </div>
              </div>
            </NeonCard>

            <NeonCard borderColor="danger-red" title="支出明细" className="lg:col-span-1">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-rock-darker/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-danger-red" />
                    <span className="text-white">场地费用</span>
                  </div>
                  <span className="text-danger-red font-mono font-bold">
                    {formatCurrency(stopResult.venueExpense)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-rock-darker/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Bus className="w-5 h-5 text-danger-red" />
                    <span className="text-white">交通费用</span>
                  </div>
                  <span className="text-danger-red font-mono font-bold">
                    {formatCurrency(stopResult.transportExpense)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-rock-darker/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-danger-red" />
                    <span className="text-white">商品成本</span>
                  </div>
                  <span className="text-danger-red font-mono font-bold">
                    {formatCurrency(stopResult.merchCost)}
                  </span>
                </div>
                <div className="border-t border-rock-light/30 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-rock">总支出</span>
                    <span className="text-danger-red font-mono font-bold text-xl">
                      {formatCurrency(stopResult.totalExpense)}
                    </span>
                  </div>
                </div>
              </div>
            </NeonCard>

            <NeonCard
              borderColor={stopResult.netProfit >= 0 ? 'neon-purple' : 'warning-orange'}
              title="本站结果"
              className="lg:col-span-1"
            >
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-sm text-gray-400 mb-1">本站净利润</div>
                  <div className={`text-4xl font-rock font-mono ${stopResult.netProfit >= 0 ? 'text-success-green' : 'text-danger-red'}`}>
                    {stopResult.netProfit >= 0 ? '+' : ''}
                    {formatCurrency(stopResult.netProfit)}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">观众完成率</span>
                    <span className={`font-mono ${completionRate >= 80 ? 'text-success-green' : completionRate >= 50 ? 'text-warning-orange' : 'text-danger-red'}`}>
                      {completionRate}%
                    </span>
                  </div>
                  <div className="h-2 bg-rock-light/30 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, completionRate)}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className={`h-full rounded-full ${
                        completionRate >= 80 ? 'bg-success-green' :
                        completionRate >= 50 ? 'bg-warning-orange' : 'bg-danger-red'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-rock-light/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">此前现金流</span>
                    <span className="text-white font-mono">{formatCurrency(previousCashFlow)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 flex items-center gap-1">
                      <ChevronRight className="w-4 h-4" />
                      当前现金流
                    </span>
                    <span className={`font-mono font-bold ${cashFlow >= 0 ? 'text-neon-cyan' : 'text-danger-red'}`}>
                      {formatCurrency(cashFlow)}
                    </span>
                  </div>
                </div>
              </div>
            </NeonCard>
          </motion.div>
        )}

        {stopResult.risks.length > 0 && showDetails && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <NeonCard borderColor="warning-orange" title="本站风险事件">
              <div className="space-y-3">
                {stopResult.risks.map((risk, index) => (
                  <motion.div
                    key={risk.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="flex items-start gap-3 p-3 bg-rock-darker/50 rounded-lg border border-warning-orange/30"
                  >
                    <AlertTriangle className="w-5 h-5 text-warning-orange flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <RiskBadge level={risk.level} />
                        <span className="text-white font-medium">{risk.description}</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        预计影响: <span className="text-danger-red font-mono">{formatCurrency(risk.impact)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </NeonCard>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center"
        >
          <NeonButton
            variant="primary"
            size="lg"
            onClick={handleContinue}
            className="gap-2"
          >
            {isLastStop || isGameOver ? (
              <>
                <Trophy className="w-5 h-5" />
                查看复盘报告
              </>
            ) : (
              <>
                <ChevronRight className="w-5 h-5" />
                继续下一站
              </>
            )}
          </NeonButton>
        </motion.div>
      </motion.div>
    </div>
  );
}
