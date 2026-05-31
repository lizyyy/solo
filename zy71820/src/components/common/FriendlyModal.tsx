import { useUIStore } from '@/store/useUIStore';
import { X, AlertCircle, Phone, Lightbulb } from 'lucide-react';

export function FriendlyModal() {
  const { showModal, modalContent, closeModal } = useUIStore();

  if (!showModal || !modalContent) return null;

  const { title, error, onConfirm, onCancel, confirmText = '确定', cancelText = '取消' } = modalContent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={closeModal}
      />
      <div className="relative w-full max-w-md animate-slide-up">
        <div className="bg-night-surface rounded-2xl border border-neon-orange/30 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-night-card">
            <h3 className="font-display text-xl text-neon-orange">{title}</h3>
            <button
              onClick={closeModal}
              className="p-1 hover:bg-night-card rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <>
                <div className="flex items-start gap-3 p-4 bg-neon-pink/10 rounded-xl border border-neon-pink/30">
                  <AlertCircle size={24} className="text-neon-pink flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-body text-white font-medium">{error.message}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-neon-yellow/10 rounded-xl border border-neon-yellow/30">
                  <Lightbulb size={24} className="text-neon-yellow flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-neon-yellow font-medium mb-1">💡 建议</p>
                    <p className="font-body text-gray-300 text-sm">{error.suggestion}</p>
                  </div>
                </div>

                {error.contact && (
                  <div className="flex items-start gap-3 p-4 bg-neon-green/10 rounded-xl border border-neon-green/30">
                    <Phone size={24} className="text-neon-green flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-neon-green font-medium mb-1">📞 需要帮助？</p>
                      <p className="font-body text-gray-300 text-sm">{error.contact}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {!error && modalContent.children && (
              <div className="text-gray-300">{modalContent.children as React.ReactNode}</div>
            )}
          </div>

          <div className="flex gap-3 p-4 border-t border-night-card bg-night-card/50">
            {onCancel && (
              <button
                onClick={() => {
                  onCancel();
                  closeModal();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl font-body text-gray-400 hover:bg-night-surface transition-colors"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={() => {
                if (onConfirm) onConfirm();
                closeModal();
              }}
              className="flex-1 py-2.5 px-4 rounded-xl font-body bg-neon-orange text-white hover:bg-neon-orange/90 transition-colors shadow-neon-orange"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
