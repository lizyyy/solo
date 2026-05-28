import { useState } from 'react';
import { Plus, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useGameStore } from '@/store/gameStore';
import { StatusBadge } from './StatusBadge';
import type { PolicyType, PolicyDirection, PolicyAction } from '@/types/game';
import { validatePolicyAction } from '@/lib/gameEngine';
import { cn } from '@/lib/utils';

const policySchema = z.object({
  type: z.enum(['reverse_repo', 'mlf']),
  direction: z.enum(['inject', 'withdraw']),
  amount: z.number().min(1, '金额必须大于0').max(5000, '单次操作不能超过5000亿'),
  term: z.number().min(1, '期限必须大于0'),
});

type PolicyFormData = z.infer<typeof policySchema>;

interface PolicyPanelProps {
  gameId: string;
  currentRound: number;
  disabled?: boolean;
}

export function PolicyPanel({ gameId, currentRound, disabled }: PolicyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  
  const gameState = useGameStore((state) => state.gameStates[gameId]);
  const addPolicyAction = useGameStore((state) => state.addPolicyAction);
  const setActionStatus = useGameStore((state) => state.setActionStatus);
  const removePolicyAction = useGameStore((state) => state.removePolicyAction);

  const { register, handleSubmit, reset, formState: { errors: formErrors } } = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      type: 'reverse_repo',
      direction: 'inject',
      amount: 500,
      term: 7,
    },
  });

  const roundActions = gameState?.policyActions.filter(
    (a) => a.roundNumber === currentRound
  ) || [];

  const onSubmit = (data: PolicyFormData) => {
    const validation = validatePolicyAction(data);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    
    addPolicyAction(gameId, {
      ...data,
      status: 'tentative',
    });
    setErrors([]);
    reset();
  };

  const handleConfirm = (actionId: string) => {
    setActionStatus(gameId, actionId, 'confirmed');
  };

  const handleDelete = (actionId: string, status: string) => {
    if (status === 'confirmed') {
      return;
    }
    removePolicyAction(gameId, actionId);
  };

  const getTypeLabel = (type: PolicyType) => {
    return type === 'reverse_repo' ? '逆回购' : 'MLF';
  };

  const getDirectionLabel = (direction: PolicyDirection) => {
    return direction === 'inject' ? '投放' : '回笼';
  };

  return (
    <div className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-navy-700/30 transition-colors"
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gold-400">政策工具箱</span>
          <span className="text-xs text-navy-400">
            本轮 {roundActions.length} 项操作
          </span>
        </div>
        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-navy-600">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-navy-300 mb-1">工具类型</label>
                    <select
                      {...register('type')}
                      className="w-full bg-navy-900/50 border border-navy-600 rounded-lg px-3 py-2 text-sm input-focus"
                      disabled={disabled}
                    >
                      <option value="reverse_repo">逆回购</option>
                      <option value="mlf">MLF</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-navy-300 mb-1">操作方向</label>
                    <select
                      {...register('direction')}
                      className="w-full bg-navy-900/50 border border-navy-600 rounded-lg px-3 py-2 text-sm input-focus"
                      disabled={disabled}
                    >
                      <option value="inject">投放流动性</option>
                      <option value="withdraw">回笼流动性</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-navy-300 mb-1">金额 (亿元)</label>
                    <input
                      type="number"
                      {...register('amount', { valueAsNumber: true })}
                      className="w-full bg-navy-900/50 border border-navy-600 rounded-lg px-3 py-2 text-sm input-focus font-mono"
                      disabled={disabled}
                    />
                    {formErrors.amount && (
                      <p className="text-xs text-liquidity-danger mt-1">{formErrors.amount.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-navy-300 mb-1">期限 (天)</label>
                    <select
                      {...register('term', { valueAsNumber: true })}
                      className="w-full bg-navy-900/50 border border-navy-600 rounded-lg px-3 py-2 text-sm input-focus"
                      disabled={disabled}
                    >
                      <option value={7}>7天</option>
                      <option value={14}>14天</option>
                      <option value={28}>28天</option>
                      <option value={182}>6个月 (MLF)</option>
                      <option value={365}>1年 (MLF)</option>
                    </select>
                  </div>
                </div>

                {errors.length > 0 && (
                  <div className="bg-liquidity-danger/10 border border-liquidity-danger/30 rounded-lg p-2">
                    {errors.map((err, i) => (
                      <p key={i} className="text-xs text-liquidity-danger">{err}</p>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={disabled}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-all',
                    disabled
                      ? 'bg-navy-700 text-navy-500 cursor-not-allowed'
                      : 'bg-gold-500 hover:bg-gold-400 text-navy-900 font-medium'
                  )}
                >
                  <Plus size={18} />
                  添加操作
                </button>
              </form>

              {roundActions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-navy-400">本轮操作列表</p>
                  {roundActions.map((action) => (
                    <ActionItem
                      key={action.id}
                      action={action}
                      onConfirm={() => handleConfirm(action.id)}
                      onDelete={() => handleDelete(action.id, action.status)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ActionItemProps {
  action: PolicyAction;
  onConfirm: () => void;
  onDelete: () => void;
}

function ActionItem({ action, onConfirm, onDelete }: ActionItemProps) {
  const isConfirmed = action.status === 'confirmed';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'p-3 rounded-lg border',
        isConfirmed ? 'confirmed-border bg-gold-500/5' : 'tentative-bg'
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn('font-mono text-sm', isConfirmed ? '' : 'tentative-text')}>
          <span className="text-gold-400">{getTypeLabel(action.type)}</span>
          <span className="mx-2">·</span>
          <span className={action.direction === 'inject' ? 'text-liquidity-good' : 'text-liquidity-danger'}>
            {getDirectionLabel(action.direction)}
          </span>
          <span className="mx-2">·</span>
          <span>{action.amount.toLocaleString()}亿</span>
          <span className="mx-2">·</span>
          <span>{action.term}天</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge type="action" status={action.status} />
          {!isConfirmed && (
            <>
              <button
                onClick={onConfirm}
                className="p-1 rounded hover:bg-liquidity-good/20 text-liquidity-good transition-colors"
                title="确认"
              >
                <Check size={14} />
              </button>
              <button
                onClick={onDelete}
                className="p-1 rounded hover:bg-liquidity-danger/20 text-liquidity-danger transition-colors"
                title="删除"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function getTypeLabel(type: PolicyType) {
  return type === 'reverse_repo' ? '逆回购' : 'MLF';
}

function getDirectionLabel(direction: PolicyDirection) {
  return direction === 'inject' ? '投放' : '回笼';
}
