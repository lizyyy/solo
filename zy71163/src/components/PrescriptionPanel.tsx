import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, User, Calendar, Stethoscope, 
  AlertCircle, Clock, Pill, ChevronRight 
} from 'lucide-react';
import type { Prescription } from '@/types';
import { cn } from '@/lib/utils';

interface PrescriptionPanelProps {
  prescription: Prescription | null;
  isReading?: boolean;
  readingTimeRemaining?: number;
  currentIndex?: number;
  totalCount?: number;
}

export const PrescriptionPanel = memo(function PrescriptionPanel({
  prescription,
  isReading = false,
  readingTimeRemaining = 0,
  currentIndex = 1,
  totalCount = 1
}: PrescriptionPanelProps) {
  if (!prescription) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <FileText className="text-gray-400" size={20} />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">处方信息</h2>
            <p className="text-xs text-gray-500">等待加载处方...</p>
          </div>
        </div>
        <div className="text-center py-8 text-gray-400">
          <FileText size={48} className="mx-auto mb-2 opacity-50" />
          <p>暂无处方信息</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
    >
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FileText className="text-white" size={20} />
            </div>
            <div>
              <h2 className="font-bold text-white">处方信息</h2>
              <p className="text-xs text-blue-100">处方 {currentIndex} / {totalCount}</p>
            </div>
          </div>
          
          <AnimatePresence>
            {isReading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl"
              >
                <Clock className="text-yellow-300" size={16} />
                <span className="font-mono font-bold text-white text-lg">
                  {readingTimeRemaining}s
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-2">
            <User size={16} className="text-blue-500" />
            <span className="text-sm text-gray-500">患者:</span>
            <span className="font-semibold text-gray-900">{prescription.patientName}</span>
            <span className="text-xs text-gray-400">
              ({prescription.patientAge}岁 {prescription.patientGender})
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-blue-500" />
            <span className="text-sm text-gray-500">日期:</span>
            <span className="font-mono text-gray-900">{prescription.date}</span>
          </div>
          
          <div className="col-span-2 flex items-start gap-2">
            <Stethoscope size={16} className="text-blue-500 mt-0.5" />
            <span className="text-sm text-gray-500">诊断:</span>
            <span className="font-medium text-gray-900">{prescription.diagnosis}</span>
          </div>
          
          {prescription.allergies.length > 0 && (
            <div className="col-span-2">
              <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-red-700">过敏史:</span>
                  <span className="ml-2 text-sm text-red-600">
                    {prescription.allergies.join('、')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="border-t border-gray-200 pt-4">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Pill size={18} className="text-blue-500" />
            用药明细
          </h3>
          
          <div className="space-y-3">
            {prescription.items.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'p-4 rounded-xl border-2 transition-all',
                  'bg-gradient-to-r from-gray-50 to-white',
                  item.hasDosageError && 'border-orange-300 bg-orange-50/50',
                  item.hasContraindication && 'border-red-300 bg-red-50/50',
                  item.hasBatchError && 'border-yellow-300 bg-yellow-50/50',
                  !item.hasDosageError && !item.hasContraindication && !item.hasBatchError && 'border-gray-200'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm',
                      item.hasDosageError || item.hasContraindication || item.hasBatchError
                        ? 'bg-red-500'
                        : 'bg-blue-500'
                    )}>
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{item.medicineName}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm">
                          <span className="text-gray-500">剂量:</span>
                          <span className={cn(
                            'font-mono font-bold ml-1',
                            item.hasDosageError ? 'text-red-600' : 'text-blue-600'
                          )}>
                            {item.dosage}{item.unit}
                          </span>
                        </span>
                        <span className="text-sm text-gray-600">
                          <span className="text-gray-500">用法:</span>
                          <span className="ml-1">{item.frequency}</span>
                        </span>
                        <span className="text-sm text-gray-600">
                          <span className="text-gray-500">疗程:</span>
                          <span className="ml-1">{item.duration}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    {item.hasDosageError && (
                      <span className="text-xs text-orange-600 font-medium flex items-center gap-1">
                        <AlertCircle size={12} />
                        剂量异常
                      </span>
                    )}
                    {item.hasContraindication && (
                      <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                        <AlertCircle size={12} />
                        禁忌风险
                      </span>
                    )}
                    {item.hasBatchError && (
                      <span className="text-xs text-yellow-600 font-medium flex items-center gap-1">
                        <AlertCircle size={12} />
                        批号可疑
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            医师: <span className="font-medium text-gray-700">{prescription.doctorName}</span>
          </p>
          <p className="text-xs text-gray-400 font-mono">
            处方编号: {prescription.id}
          </p>
        </div>
      </div>
      
      {isReading && (
        <div className="px-6 pb-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-2 p-3 bg-blue-50 rounded-xl text-blue-700"
          >
            <Clock size={18} className="animate-pulse" />
            <span className="font-medium">请仔细阅读处方，{readingTimeRemaining}秒后开始配药</span>
            <ChevronRight size={18} />
          </motion.div>
        </div>
      )}
    </motion.div>
  );
});
