import { useState, useMemo } from 'react'
import { Activity, Plus, Trash2, Link, Unlink, Settings, Zap, AlertTriangle } from 'lucide-react'
import { useMidiStore } from '@/store/useMidiStore'
import type { ControllerEvent, SoundParameter, MappingEntry } from '@/types/midi'
import { detectConflicts } from '@/engine/conflictDetector'
import { cn } from '@/lib/utils'

export default function Workbench() {
  const {
    controllerEvents, soundParameters, mappings, conflicts: storeConflicts,
    isLearning, startLearning, stopLearning,
    createMapping, updateMapping, deleteMapping,
    addControllerEvent, removeControllerEvent,
    addSoundParameter, removeSoundParameter,
  } = useMidiStore()

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [showAddParam, setShowAddParam] = useState(false)
  const [newEventType, setNewEventType] = useState<ControllerEvent['type']>('cc')
  const [newEventChannel, setNewEventChannel] = useState(1)
  const [newEventCcNumber, setNewEventCcNumber] = useState(1)
  const [newParamName, setNewParamName] = useState('')
  const [newParamType, setNewParamType] = useState<SoundParameter['type']>('continuous')
  const [newParamCategory, setNewParamCategory] = useState('')

  const mappedEventIds = useMemo(() => new Set(mappings.map(m => m.controllerEventId)), [mappings])
  const mappedParamIds = useMemo(() => new Set(mappings.map(m => m.soundParameterId)), [mappings])
  const conflicts = useMemo(
    () => detectConflicts(mappings, controllerEvents, soundParameters, storeConflicts),
    [mappings, controllerEvents, soundParameters, storeConflicts],
  )
  const conflictMappingIds = useMemo(() => new Set(conflicts.flatMap(c => c.mappingIds)), [conflicts])
  const unresolvedCount = conflicts.filter(c => !c.resolvedAt).length

  const handleToggleLearning = () => isLearning ? stopLearning() : startLearning()

  const handleSelectEvent = (id: string) => {
    if (mappedEventIds.has(id)) return
    setSelectedEventId(prev => prev === id ? null : id)
  }

  const handleSelectParam = (paramId: string) => {
    if (!selectedEventId || mappedParamIds.has(paramId)) return
    createMapping(selectedEventId, paramId)
    setSelectedEventId(null)
  }

  const handleAddEvent = () => {
    const id = crypto.randomUUID()
    const label = newEventType === 'cc'
      ? `CC${newEventCcNumber} Ch${newEventChannel}`
      : `${newEventType.toUpperCase()} Ch${newEventChannel}`
    addControllerEvent({
      id, type: newEventType, channel: newEventChannel,
      ccNumber: newEventType === 'cc' ? newEventCcNumber : undefined,
      valueRange: [0, 127], timestamp: Date.now(), label,
    })
    setShowAddEvent(false)
    setNewEventType('cc')
    setNewEventChannel(1)
    setNewEventCcNumber(1)
  }

  const handleAddParam = () => {
    if (!newParamName || !newParamCategory) return
    addSoundParameter({
      id: crypto.randomUUID(), name: newParamName, type: newParamType,
      valueRange: newParamType === 'toggle' ? [0, 1] : [0, 127],
      category: newParamCategory,
    })
    setShowAddParam(false)
    setNewParamName('')
    setNewParamType('continuous')
    setNewParamCategory('')
  }

  const getEventLabel = (e: ControllerEvent) =>
    e.label ?? `${e.type.toUpperCase()}${e.ccNumber != null ? ` CC${e.ccNumber}` : ''} Ch${e.channel}`

  const getParamRangeLabel = (p: SoundParameter) => {
    if (typeof p.valueRange[0] === 'string') return (p.valueRange as string[]).join(' / ')
    const [min, max] = p.valueRange as [number, number]
    return `${min}–${max}`
  }

  return (
    <div className="min-h-screen bg-dark text-zinc-100 font-sans">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h1 className="text-xl font-bold tracking-wide">MIDI控制器映射工作台</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleLearning}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300',
              isLearning
                ? 'bg-neon/20 text-neon border border-neon/50 animate-glow-pulse'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-500',
            )}
          >
            <Zap className={cn('w-4 h-4', isLearning && 'animate-pulse')} />
            {isLearning ? 'Learning ON' : 'MIDI Learn'}
          </button>
          {unresolvedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-critical/10 border border-critical/30 text-critical text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              {unresolvedCount} Conflict{unresolvedCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4 p-4 h-[calc(100vh-73px)]">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-neon" />
              <span className="text-sm font-semibold">Controller Events</span>
            </div>
            <button onClick={() => setShowAddEvent(!showAddEvent)}
              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-neon transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {showAddEvent && (
              <div className="p-3 border-b border-zinc-800 bg-zinc-800/30 space-y-2">
                <div className="flex gap-2">
                  <select value={newEventType}
                    onChange={e => setNewEventType(e.target.value as ControllerEvent['type'])}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs font-mono">
                    <option value="cc">CC</option>
                    <option value="note">Note</option>
                    <option value="pitchbend">Pitch Bend</option>
                    <option value="aftertouch">Aftertouch</option>
                  </select>
                  <input type="number" min={1} max={16} value={newEventChannel}
                    onChange={e => setNewEventChannel(Number(e.target.value))}
                    placeholder="Ch"
                    className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-center font-mono" />
                </div>
                {newEventType === 'cc' && (
                  <input type="number" min={0} max={127} value={newEventCcNumber}
                    onChange={e => setNewEventCcNumber(Number(e.target.value))}
                    placeholder="CC#"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs font-mono" />
                )}
                <button onClick={handleAddEvent}
                  className="w-full py-1.5 rounded bg-neon/20 text-neon text-xs font-medium hover:bg-neon/30 transition-colors">
                  Add Event
                </button>
              </div>
            )}
            {controllerEvents.map(event => {
              const isMapped = mappedEventIds.has(event.id)
              const isSelected = selectedEventId === event.id
              return (
                <div key={event.id} onClick={() => handleSelectEvent(event.id)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/50 transition-all duration-200',
                    isSelected && 'bg-neon/10 border-l-2 border-l-neon',
                    !isMapped && !isSelected && 'cursor-pointer hover:bg-zinc-800/50',
                    isMapped && !isSelected && 'opacity-60 cursor-default',
                  )}>
                  <div className={cn(
                    'w-2 h-2 rounded-full shrink-0 transition-colors',
                    isMapped ? 'bg-neon' : 'bg-zinc-600',
                    isLearning && !isMapped && 'animate-pulse !bg-amber',
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{getEventLabel(event)}</div>
                    <div className="text-xs text-zinc-500 font-mono">
                      {event.type.toUpperCase()} · Ch{event.channel}
                      {event.ccNumber != null ? ` · CC${event.ccNumber}` : ''}
                      {' · '}{event.valueRange[0]}–{event.valueRange[1]}
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeControllerEvent(event.id) }}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-600 hover:text-critical transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Link className="w-4 h-4 text-neon" />
              <span className="text-sm font-semibold">Mapping Bindings</span>
            </div>
            <span className="text-xs text-zinc-500 font-mono">
              {mappings.length} mapping{mappings.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {mappings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2">
                <Unlink className="w-8 h-8" />
                <span className="text-sm">No mappings yet</span>
                <span className="text-xs text-zinc-700">Select a controller event, then a sound parameter</span>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                    <th className="text-left px-4 py-2 font-medium">Controller → Parameter</th>
                    <th className="text-left px-2 py-2 font-medium">Transform</th>
                    <th className="text-left px-2 py-2 font-medium">Polarity</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {mappings.map(mapping => {
                    const event = controllerEvents.find(e => e.id === mapping.controllerEventId)
                    const param = soundParameters.find(p => p.id === mapping.soundParameterId)
                    const hasConflict = conflictMappingIds.has(mapping.id)
                    return (
                      <tr key={mapping.id}
                        className={cn(
                          'border-b border-zinc-800/50 transition-colors',
                          hasConflict ? 'bg-critical/5' : 'hover:bg-zinc-800/30',
                        )}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {hasConflict && <AlertTriangle className="w-3.5 h-3.5 text-amber shrink-0" />}
                            <div>
                              <div className="text-sm">{event ? getEventLabel(event) : '—'}</div>
                              <div className="text-xs text-neon">{param?.name ?? '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5">
                          <select value={mapping.transform}
                            onChange={e => updateMapping(mapping.id, { transform: e.target.value as MappingEntry['transform'] })}
                            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs font-mono">
                            <option value="linear">Linear</option>
                            <option value="inverse">Inverse</option>
                            <option value="logarithmic">Log</option>
                          </select>
                        </td>
                        <td className="px-2 py-2.5">
                          <button onClick={() => updateMapping(mapping.id, {
                            polarity: mapping.polarity === 'normal' ? 'reversed' : 'normal',
                          })} className={cn(
                            'px-2.5 py-1 rounded text-xs font-medium font-mono transition-colors',
                            mapping.polarity === 'normal'
                              ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              : 'bg-amber/20 text-amber border border-amber/40',
                          )}>
                            {mapping.polarity === 'normal' ? 'NORM' : 'REV'}
                          </button>
                        </td>
                        <td className="px-2 py-2.5">
                          <button onClick={() => deleteMapping(mapping.id)}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-600 hover:text-critical transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-neon" />
              <span className="text-sm font-semibold">Sound Parameters</span>
            </div>
            <button onClick={() => setShowAddParam(!showAddParam)}
              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-neon transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {showAddParam && (
              <div className="p-3 border-b border-zinc-800 bg-zinc-800/30 space-y-2">
                <input type="text" value={newParamName}
                  onChange={e => setNewParamName(e.target.value)}
                  placeholder="Parameter name"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" />
                <div className="flex gap-2">
                  <select value={newParamType}
                    onChange={e => setNewParamType(e.target.value as SoundParameter['type'])}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs font-mono">
                    <option value="continuous">Continuous</option>
                    <option value="toggle">Toggle</option>
                    <option value="enum">Enum</option>
                  </select>
                  <input type="text" value={newParamCategory}
                    onChange={e => setNewParamCategory(e.target.value)}
                    placeholder="Category"
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" />
                </div>
                <button onClick={handleAddParam}
                  className="w-full py-1.5 rounded bg-neon/20 text-neon text-xs font-medium hover:bg-neon/30 transition-colors">
                  Add Parameter
                </button>
              </div>
            )}
            {soundParameters.map(param => {
              const isMapped = mappedParamIds.has(param.id)
              return (
                <div key={param.id} onClick={() => handleSelectParam(param.id)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/50 transition-all duration-200',
                    selectedEventId && !isMapped && 'cursor-pointer hover:bg-neon/5',
                    isMapped && 'opacity-60 cursor-default',
                    !selectedEventId && !isMapped && 'opacity-80',
                  )}>
                  <div className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    isMapped ? 'bg-neon' : 'bg-zinc-600',
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{param.name}</div>
                    <div className="text-xs text-zinc-500 font-mono">
                      {param.type} · {param.category} · {getParamRangeLabel(param)}
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeSoundParameter(param.id) }}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-600 hover:text-critical transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
