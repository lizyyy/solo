import { NavLink, useLocation } from 'react-router-dom'
import { Lightbulb } from 'lucide-react'
import { ONBOARDING_STEPS } from '../utils/helpers'

export default function OnboardingSidebar() {
  const location = useLocation()

  const currentIndex = ONBOARDING_STEPS.findIndex((step) => {
    if (step.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(step.to)
  })

  return (
    <div className="space-y-3">
      <h3 className="font-serif text-base font-semibold text-warm-800 flex items-center gap-2">
        <Lightbulb size={16} className="text-brand-600" />
        接班人操作顺序
      </h3>
      <div className="space-y-2">
        {ONBOARDING_STEPS.map((step, idx) => {
          const isActive = idx === currentIndex
          const isPast = idx < currentIndex
          return (
            <NavLink
              key={step.id}
              to={step.to}
              className={`block p-3 rounded-xl border transition-all ${
                isActive
                  ? 'border-brand-300 bg-brand-50 shadow-sm'
                  : 'border-warm-200 hover:border-warm-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`step-num ${isActive ? 'step-num-active' : isPast ? 'bg-success-100 text-success-700' : ''}`}
                >
                  {step.id}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      isActive ? 'text-brand-700' : 'text-warm-700'
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-warm-500 mt-0.5 leading-relaxed">
                    {step.description}
                  </p>
                  <p className="text-xs text-brand-600 mt-1.5 flex items-center gap-1">
                    → {step.actionLabel}
                  </p>
                  <p className="text-xs text-warm-400 mt-1.5 bg-warm-50 rounded-md px-2 py-1 leading-relaxed">
                    💡 {step.tip}
                  </p>
                </div>
              </div>
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}
