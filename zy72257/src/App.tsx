import React, { useReducer } from 'react'
import { AppContext, appReducer, initialState, useAppState } from './store'
import type { WorkflowStep } from './types'
import Step1Import from './components/Step1Import'
import Step2Origin from './components/Step2Origin'
import Step3View from './components/Step3View'

const STEP_LABELS: Record<WorkflowStep, { title: string; label: string }> = {
  1: { title: '导入安全半径表', label: '安全半径表' },
  2: { title: '补看坐标原点说明', label: '坐标原点说明' },
  3: { title: '三维标注视图', label: '三维标注' },
}

function StepNav({ currentStep }: { currentStep: WorkflowStep }) {
  const { dispatch } = useAppState()

  return (
    <nav className="step-nav">
      {([1, 2, 3] as WorkflowStep[]).map(step => (
        <button
          key={step}
          className={`step-nav-item ${step === currentStep ? 'active' : ''} ${step < currentStep ? 'completed' : ''}`}
          onClick={() => dispatch({ type: 'SET_STEP', step })}
        >
          <span className="step-num">{step < currentStep ? '✓' : step}</span>
          <span className="step-label">{STEP_LABELS[step].label}</span>
        </button>
      ))}
    </nav>
  )
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState)

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="app-layout">
        <header className="app-header">
          <div>
            <h1>风机检修爬梯路径</h1>
            <div className="subtitle">
              安全半径表 × 坐标原点说明 → 合并证据 · 自检 · 三维标注
            </div>
          </div>
        </header>

        <StepNav currentStep={state.currentStep} />

        {state.currentStep === 1 && <Step1Import />}
        {state.currentStep === 2 && <Step2Origin />}
        {state.currentStep === 3 && <Step3View />}
      </div>
    </AppContext.Provider>
  )
}

export default App
