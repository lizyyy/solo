import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { validateAll } from '@/utils/validation';

export function useValidation() {
  const currentQ = useAppStore((s) => s.currentQuaternion);
  const targetQ = useAppStore((s) => s.targetQuaternion);
  const euler = useAppStore((s) => s.eulerAngles);
  const setResults = useAppStore((s) => s.setCurrentQuaternion);

  useEffect(() => {
    const results = validateAll(currentQ, euler, targetQ);
    // We don't re-dispatch through setCurrentQuaternion as that would loop.
    // Instead, we directly update validationResults via zustand.
    useAppStore.setState({ validationResults: results });
  }, [currentQ, targetQ, euler]);
}
