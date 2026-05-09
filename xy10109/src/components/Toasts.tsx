import { useAppContext } from '../context';

export function Toasts() {
  const { toasts, dismissToast } = useAppContext();

  const getStyles = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-400 text-green-800';
      case 'error': return 'bg-red-50 border-red-400 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-400 text-yellow-800';
      case 'info': return 'bg-blue-50 border-blue-400 text-blue-800';
      default: return 'bg-gray-50 border-gray-400 text-gray-800';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✗';
      case 'warning': return '!';
      case 'info': return 'i';
      default: return '•';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 border-l-4 rounded shadow-lg min-w-[280px] max-w-[400px] animate-slide-in ${getStyles(toast.type)}`}
        >
          <span className="font-bold text-lg">{getIcon(toast.type)}</span>
          <p className="flex-1 text-sm">{toast.message}</p>
          <button
            onClick={() => dismissToast(toast.id)}
            className="text-gray-400 hover:text-gray-600 font-bold"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
