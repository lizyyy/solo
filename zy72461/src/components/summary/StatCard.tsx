import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: number
  icon: LucideIcon
  color: string
  bgColor: string
}

export default function StatCard({ title, value, icon: Icon, color, bgColor }: StatCardProps) {
  return (
    <div className={`${bgColor} rounded-lg p-5 border border-gray-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full ${color} bg-opacity-10 flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  )
}
