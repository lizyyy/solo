import { memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Check, AlertTriangle, Scale, Ban, Calendar, Clock, Trash2 } from 'lucide-react';
import type { Medicine, MedicineCheckResult } from '@/types';
import { getMedicineById } from '@/data/medicines';
import { cn } from '@/lib/utils';
import { MedicineCard } from './MedicineCard';

interface DispensingTableProps {
  placedMedicineIds: string[];
  checkResults: MedicineCheckResult[];
  onDrop: (medicineId: string) => void;
  onRemove: (medicineId: string) => void;
  onCheckDosage: (medicineId: string) => void;
  onCheckContraindication: (medicineId: string) => void;
  onCheckBatch: (medicineId: string) => void;
  disabled?: boolean;
  prescriptionMedicineIds: string[];
}

interface CheckButtonProps {
  label: string;
  icon: React.ReactNode;
  status: 'pending' | 'correct' | 'incorrect' | 'unchecked';
  onClick: () => void;
  disabled?: boolean;
  color: string;
}

const CheckButton = memo(function CheckButton({
  label,
  icon,
  status,
  onClick,
  disabled = false,
  color
}: CheckButtonProps) {
  const statusStyles = {
    pending: 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200',
    correct: 'bg-green-100 text-green-700 border-green-400',
    incorrect: 'bg-red-100 text-red-700 border-red-400',
    unchecked: 'bg-gray-50 text-gray-400 border-gray-200'
  };

  const StatusIcon = () => {
    if (status === 'correct') return <Check size={14} className="text-green-600" />;
    if (status === 'incorrect') return <X size={14} className="text-red-600" />;
    return null;
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || (status !== 'pending' && status !== 'unchecked')}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
        statusStyles[status],
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && status === 'pending' && 'cursor-pointer hover:shadow-md'
      )}
    >
      <span className={cn('w-5 h-5 rounded-full flex items-center justify-center', `text-${color}-600`)}>
        {icon}
      </span>
      <span>{label}</span>
      <StatusIcon />
    </button>
  );
});

interface PlacedMedicineCardProps {
  medicine: Medicine;
  checkResult: MedicineCheckResult | undefined;
  onRemove: () => void;
  onCheckDosage: () => void;
  onCheckContraindication: () => void;
  onCheckBatch: () => void;
  disabled?: boolean;
}

const PlacedMedicineCard = memo(function PlacedMedicineCard({
  medicine,
  checkResult,
  onRemove,
  onCheckDosage,
  onCheckContraindication,
  onCheckBatch,
  disabled = false
}: PlacedMedicineCardProps) {
  const allChecked = checkResult && 
    checkResult.dosage !== 'pending' && 
    checkResult.contraindication !== 'pending' && 
    checkResult.batch !== 'pending';
  
  const allCorrect = checkResult && 
    checkResult.dosage === 'correct' && 
    checkResult.contraindication === 'correct' && 
    checkResult.batch === 'correct';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        'p-4 rounded-2xl border-2 bg-white shadow-lg transition-all',
        allCorrect ? 'border-green-400 bg-green-50/50' : 'border-gray-200'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shadow',
            allCorrect ? 'bg-green-500' : 'bg-gradient-to-br from-blue-500 to-blue-600'
          )}>
            {allCorrect ? <Check className="text-white" size={24} /> : <Plus className="text-white" size={24} />}
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{medicine.name}</h3>
            <p className="text-sm text-gray-500 font-mono">{medicine.specification}</p>
          </div>
        </div>
        
        {!disabled && (
          <button
            onClick={onRemove}
            className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
            title="移除药品"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <CheckButton
          label="剂量"
          icon={<Scale size={14} />}
          status={checkResult?.dosage || 'pending'}
          onClick={onCheckDosage}
          disabled={disabled}
          color="blue"
        />
        <CheckButton
          label="禁忌"
          icon={<Ban size={14} />}
          status={checkResult?.contraindication || 'pending'}
          onClick={onCheckContraindication}
          disabled={disabled}
          color="red"
        />
        <CheckButton
          label="批号"
          icon={<Calendar size={14} />}
          status={checkResult?.batch || 'pending'}
          onClick={onCheckBatch}
          disabled={disabled}
          color="yellow"
        />
      </div>
      
      {allCorrect && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-2 bg-green-100 rounded-lg flex items-center gap-2 text-green-700 text-sm"
        >
          <Check size={16} />
          <span className="font-medium">该药品核对完成，全部正确</span>
        </motion.div>
      )}
      
      {allChecked && !allCorrect && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-2 bg-yellow-100 rounded-lg flex items-center gap-2 text-yellow-700 text-sm"
        >
          <AlertTriangle size={16} />
          <span className="font-medium">发现处方存在问题，请在下方选择"拒绝配药"</span>
        </motion.div>
      )}
    </motion.div>
  );
});

export const DispensingTable = memo(function DispensingTable({
  placedMedicineIds,
  checkResults,
  onDrop,
  onRemove,
  onCheckDosage,
  onCheckContraindication,
  onCheckBatch,
  disabled = false,
  prescriptionMedicineIds
}: DispensingTableProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const medicineId = e.dataTransfer.getData('medicineId');
    if (medicineId) {
      onDrop(medicineId);
    }
  }, [disabled, onDrop]);

  const missingMedicineIds = prescriptionMedicineIds.filter(
    id => !placedMedicineIds.includes(id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="text-blue-500" size={24} />
          配药台
        </h2>
        <div className="text-sm text-gray-500">
          已放置 <span className="font-bold text-blue-600">{placedMedicineIds.length}</span> / 
          <span className="font-bold"> {prescriptionMedicineIds.length}</span> 种药品
        </div>
      </div>
      
      {missingMedicineIds.length > 0 && placedMedicineIds.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700 text-sm">
          <AlertTriangle size={16} className="inline mr-2" />
          还需放置: {missingMedicineIds.map(id => getMedicineById(id)?.name).join('、')}
        </div>
      )}
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'min-h-48 p-6 rounded-2xl border-3 border-dashed transition-all duration-200',
          isDragOver 
            ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' 
            : 'border-gray-300 bg-gray-50/50',
          disabled && 'opacity-60 cursor-not-allowed'
        )}
      >
        {placedMedicineIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Plus size={48} className="mb-3 opacity-50" />
            <p className="text-lg font-medium">将药品拖拽到此处</p>
            <p className="text-sm mt-1">从左侧药品架选择处方所需药品</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {placedMedicineIds.map((medicineId, index) => {
              const medicine = getMedicineById(medicineId);
              const checkResult = checkResults.find(cr => cr.medicineId === medicineId);
              
              if (!medicine) return null;
              
              return (
                <PlacedMedicineCard
                  key={medicineId}
                  medicine={medicine}
                  checkResult={checkResult}
                  onRemove={() => onRemove(medicineId)}
                  onCheckDosage={() => onCheckDosage(medicineId)}
                  onCheckContraindication={() => onCheckContraindication(medicineId)}
                  onCheckBatch={() => onCheckBatch(medicineId)}
                  disabled={disabled}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
