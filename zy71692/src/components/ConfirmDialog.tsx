interface ConfirmDialogProps {
  title: string
  message: string
  options: Array<{ label: string; value: string; variant: 'primary' | 'danger' | 'ghost' }>
  onSelect: (value: string) => void
}

export default function ConfirmDialog({ title, message, options, onSelect }: ConfirmDialogProps) {
  const variantClasses = {
    primary: 'bg-teal-600 hover:bg-teal-500 text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    ghost: 'bg-gray-700 hover:bg-gray-600 text-gray-200',
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-700">
        <h3 className="text-lg font-semibold text-gray-100 mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${variantClasses[opt.variant]}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
