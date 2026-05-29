import { useEffect, useState } from 'react'
import { Mic, AlertTriangle, Activity } from 'lucide-react'
import { channelApi } from '../services/api'
import { ChannelStatus } from '../types'
import { timeAgo } from '../utils/format'

interface ChannelStatusPanelProps {
  onChannelClick?: (channel: number) => void
  selectedChannel?: number | null
}

export default function ChannelStatusPanel({ onChannelClick, selectedChannel }: ChannelStatusPanelProps) {
  const [channels, setChannels] = useState<ChannelStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChannelStatus()
  }, [])

  const loadChannelStatus = async () => {
    try {
      const data = await channelApi.getStatus()
      setChannels(data)
    } catch (error) {
      console.error('Failed to load channel status:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusDotClass = (status: ChannelStatus['status']) => {
    switch (status) {
      case 'normal':
        return 'bg-accent-green shadow-glow-green'
      case 'pending':
        return 'bg-accent-amber shadow-glow-amber'
      case 'in_progress':
        return 'bg-accent-yellow animate-pulse'
      default:
        return 'bg-stage-border'
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-stage-blue rounded" />
          ))}
        </div>
      </div>
    )
  }

  const activeChannels = channels.filter(c => c.status !== 'normal')
  const normalChannels = channels.filter(c => c.status === 'normal')

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-green" />
          监听通道状态
        </h3>
        <span className="text-xs text-slate-400">
          {activeChannels.length} 个通道待处理
        </span>
      </div>

      <div className="space-y-1 max-h-96 overflow-y-auto scrollbar-thin">
        {activeChannels.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-accent-amber mb-2 px-1">待处理通道</p>
            <div className="grid grid-cols-4 gap-1">
              {activeChannels.map((channel) => (
                <button
                  key={channel.channel}
                  onClick={() => onChannelClick?.(channel.channel)}
                  className={`p-2 rounded text-center transition-all duration-200 ${
                    selectedChannel === channel.channel
                      ? 'bg-accent-amber text-stage-darker'
                      : 'bg-stage-blue hover:bg-stage-border'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className={`w-2 h-2 rounded-full ${getStatusDotClass(channel.status)}`} />
                    <span className="text-xs font-bold">{channel.channel}</span>
                  </div>
                  {channel.musicianName && (
                    <p className="text-[10px] truncate">
                      {channel.musicianName}
                    </p>
                  )}
                  {channel.activeProblems > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent-red/20 text-accent-red text-[10px] font-bold mt-1">
                      {channel.activeProblems}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs text-slate-500 mb-2 px-1">全部通道 (1-32)</p>
          <div className="grid grid-cols-8 gap-1">
            {channels.map((channel) => (
              <button
                key={channel.channel}
                onClick={() => onChannelClick?.(channel.channel)}
                className={`p-1.5 rounded text-center transition-all duration-200 hover:bg-stage-border ${
                  selectedChannel === channel.channel
                    ? 'ring-1 ring-accent-amber bg-stage-blue'
                    : ''
                }`}
                title={`通道 ${channel.channel}${channel.musicianName ? ` - ${channel.musicianName}` : ''}`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotClass(channel.status)}`} />
                  <span className="text-[10px] font-mono">{channel.channel}</span>
                </div>
                {channel.activeProblems > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent-red text-[8px] flex items-center justify-center">
                    {channel.activeProblems}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
