import { useGameStore } from '@/stores/gameStore'
import ActionToast from './ActionToast'

export default function ToastContainer() {
  const toasts = useGameStore(s => s.toasts)

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <ActionToast key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
