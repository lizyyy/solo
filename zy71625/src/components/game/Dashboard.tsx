import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { getQualityScoreColor, getPatienceColor, formatTime } from '../../utils/exportUtils';
import { Heart, Music, Package, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
export const Dashboard = () => {
 const { qualityScore, customerPatience, inventory, errorTracking, repairSteps, currentRecord, } = useGameStore();
 const scoreHistory = repairSteps.slice(-10).map((step, index) => ({
 name: `步${index + 1}`,
 score: step.snapshot.qualityScore || qualityScore,
 }));
 const errorData = [
 { name: '划痕误判', value: errorTracking.scratchMisjudgment, color: '#C0392B' },
 { name: '清洗过度', value: errorTracking.overCleaning, color: '#E67E22' },
 { name: '试听漏记录', value: errorTracking.missingListeningRecord, color: '#8E44AD' },
 ];
 const inventoryData = [
 { name: 'A型', value: inventory.cleanerA, color: '#4CAF50' },
 { name: 'B型', value: inventory.cleanerB, color: '#FF9800' },
 { name: 'C型', value: inventory.cleanerC, color: '#F44336' },
 ];
 const renderGauge = (value: number, label: string, color: string, icon: React.ReactNode) => {
 const radius = 60;
 const strokeWidth = 12;
 const circumference = 2 * Math.PI * radius;
 const offset = circumference - (value / 100) * circumference;
 return (<div className="flex flex-col items-center">
 <div className="relative w-[140px] h-[70px] overflow-hidden">
 <svg width="140" height="140" viewBox="0 0 140" className="transform -rotate-90">
 <circle cx="70" cy="70" r={radius} fill="none" stroke="#333" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={circumference / 2} strokeLinecap="round" className="opacity-30"/>
 <motion.circle cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset + circumference / 2} strokeLinecap="round" initial={{ strokeDashoffset: circumference + circumference / 2 }} animate={{ strokeDashoffset: offset + circumference / 2 }} transition={{ duration: 1, ease: 'easeOut' }} style={{
 filter: `drop-shadow(0 0 10px ${color}40`,
 }}/>
 </svg>
 <div className="absolute bottom-0 left-0 right-0 text-center">
 <span className="text-2xl font-serif" style={{ color }}>
 {value.toFixed(0)}
 </span>
 </div>
        </div>
        <div className="flex items-center gap-1 mt-2" style={{ color }}>
          {icon}
          <span className="text-xs font-serif">{label}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6 space-y-6">
 <h3 className="text-[#D4A574] font-serif text-lg">状态仪表盘</h3>

 <div className="grid grid-cols-2 gap-4">
 {renderGauge(customerPatience, '顾客耐心', getPatienceColor(customerPatience), <Heart size={14}/>)}
 {renderGauge(qualityScore, '音质评分', getQualityScoreColor(qualityScore), <Music size={14}/>)}
 </div>

 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-white/80 text-sm font-serif flex items-center gap-2">
 <Package size={16} className="text-[#D4A574]" />
 库存状态
 </span>
 </div>

 <div className="space-y-2">
 {inventoryData.map((item) => (<div key={item.name} className="flex items-center gap-2">
 <span className="text-xs text-white/60 w-8">{item.name}</span>
 <div className="flex-1 h-3 bg-black/50 rounded-full overflow-hidden">
 <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${(item.value / 20) * 100}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ backgroundColor: item.color,
 }}/>
 </div>
 <span className="text-xs text-white/70 w-8 text-right">{item.value}</span>
 </div>))}
 </div>

 <div className="flex gap-2 text-xs text-white/50">
 <span>标准唱针: {inventory.stylusNormal}</span>
 <span>精密唱针: {inventory.stylusPrecision}</span>
 </div>
 </div>

 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-white/80 text-sm font-serif flex items-center gap-2">
 <AlertTriangle size={16} className="text-red-400"/>
 错误统计
 </span>
 </div>

 <div className="grid grid-cols-3 gap-2">
 {errorData.map((item) => (<motion.div key={item.name} className="text-center p-2 rounded-lg bg-black/30 border border-white/5" whileHover={{ scale: 1.05 }}>
 <div className="text-2xl font-serif" style={{ color: item.color }}>
 {item.value}
 </div>
 <div className="text-[10px] text-white/50 mt-1">
 {item.name}
 </div>
 </motion.div>))}
 </div>

 {repairSteps.length > 0 && (<div className="h-24 mt-4">
 <p className="text-xs text-white/50 mb-2">评分趋势</p>
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={scoreHistory}>
 <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false}/>
 <YAxis domain={[0, 100]} tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false}/>
 <Tooltip contentStyle={{
 backgroundColor: '#1a1a1a',
 border: '1px solid #D4A574/30',
 borderRadius: '8px',
 fontSize: '12px',
 }} labelStyle={{ color: '#D4A574' }}/>
 <Line type="monotone" dataKey="score" stroke="#D4A574" strokeWidth={2} dot={{ fill: '#D4A574', r: 3 }}/>
 </LineChart>
 </ResponsiveContainer>
 </div>)}
 </div>

 {currentRecord && (<div className="pt-4 border-t border-[#D4A574]/20 space-y-2">
 <p className="text-xs text-white/50">
 <span className="text-[#D4A574]">当前唱片:</span> {currentRecord.title}
 </p>
 <p className="text-xs text-white/50">
 <span className="text-[#D4A574]">操作步骤:</span> {repairSteps.length} 步
 </p>
 {repairSteps.length > 0 && (<p className="text-xs text-white/50">
 <span className="text-[#D4A574]">最后操作:</span> {formatTime(repairSteps[repairSteps.length - 1].timestamp)}
 </p>)}
      </div>)}
    </div>
  );
};
