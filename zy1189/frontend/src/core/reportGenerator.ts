import { Event, Task, TaskState, EventType, AnalysisReport, TaskStatistics, EventAnalysis, Anomaly } from '@/types'

export class ReportGenerator {
  static generateReport(
    experimentId: string,
    experimentName: string,
    tasks: Task[],
    events: Event[],
    totalTicks: number
  ): AnalysisReport {
    const taskStats = this.calculateTaskStats(tasks, events)
    const eventAnalysis = this.analyzeEvents(events)
    const anomalies = this.detectAnomalies(tasks, events, totalTicks)
    const summary = this.generateSummary(tasks, events, totalTicks, taskStats)
    
    return {
      experimentId,
      experimentName,
      generatedAt: Date.now(),
      summary,
      taskStats,
      eventAnalysis,
      anomalies,
      recommendations: this.generateRecommendations(anomalies, eventAnalysis)
    }
  }

  private static calculateTaskStats(tasks: Task[], events: Event[]): TaskStatistics[] {
    return tasks.map(task => {
      const stateTransitions = events
        .filter(e => e.taskId === task.id && 
          (e.type === EventType.TASK_START || e.type === EventType.CONTEXT_SWITCH || 
           e.type === EventType.TASK_BLOCK || e.type === EventType.TASK_WAKEUP ||
           e.type === EventType.TASK_TERMINATE))
        .map(e => ({
          from: this.getStateFromEvent(e, true),
          to: this.getStateFromEvent(e, false),
          tick: e.tick
        }))
        .filter(t => t.from !== t.to)
      
      const kernelTime = events
        .filter(e => e.taskId === task.id && e.type === EventType.SYSTEM_CALL)
        .reduce((sum, _e) => sum + 2, 0)
      
      const contextSwitchCount = events.filter(e => 
        e.type === EventType.CONTEXT_SWITCH && 
        (e.fromTaskId === task.id || e.toTaskId === task.id)
      ).length
      
      return {
        taskId: task.id,
        taskName: task.name,
        taskType: task.type,
        stateTransitions,
        cpuTime: task.cpuTimeUsed,
        ioTime: task.ioTimeUsed,
        waitTime: task.totalTime - task.cpuTimeUsed - task.ioTimeUsed,
        executionModeTime: {
          user: Math.max(0, task.cpuTimeUsed - kernelTime),
          kernel: kernelTime
        },
        contextSwitches: contextSwitchCount
      }
    })
  }

  private static getStateFromEvent(event: Event, isFrom: boolean): TaskState {
    if (isFrom && event.details?.fromTask) {
      return event.details.fromTask.state
    }
    if (!isFrom && event.details?.toTask) {
      return event.details.toTask.state
    }
    
    switch (event.type) {
      case EventType.TASK_START:
        return TaskState.RUNNING
      case EventType.IO_START:
      case EventType.TASK_BLOCK:
        return TaskState.BLOCKED
      case EventType.IO_COMPLETE:
      case EventType.TASK_WAKEUP:
        return TaskState.READY
      case EventType.TASK_TERMINATE:
        return TaskState.TERMINATED
      default:
        return TaskState.READY
    }
  }

  private static analyzeEvents(events: Event[]): EventAnalysis {
    const byType: Record<EventType, number> = {} as Record<EventType, number>
    
    Object.values(EventType).forEach(type => {
      byType[type] = events.filter(e => e.type === type).length
    })
    
    const eventsByTick = new Map<number, { count: number; types: EventType[] }>()
    events.forEach(e => {
      const existing = eventsByTick.get(e.tick) || { count: 0, types: [] }
      eventsByTick.set(e.tick, {
        count: existing.count + 1,
        types: [...new Set([...existing.types, e.type])]
      })
    })
    
    const byTick = Array.from(eventsByTick.entries())
      .map(([tick, data]) => ({ tick, ...data }))
      .sort((a, b) => a.tick - b.tick)
    
    const intervals: number[] = []
    for (let i = 1; i < byTick.length; i++) {
      intervals.push(byTick[i].tick - byTick[i - 1].tick)
    }
    const avgInterval = intervals.length > 0 
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length 
      : 0
    
    return { byType, byTick, avgInterval }
  }

  private static detectAnomalies(tasks: Task[], events: Event[], totalTicks: number): Anomaly[] {
    const anomalies: Anomaly[] = []
    
    const contextSwitches = events.filter(e => e.type === EventType.CONTEXT_SWITCH).length
    if (totalTicks > 0 && contextSwitches / totalTicks > 0.3) {
      anomalies.push({
        type: 'high_priority_overtake',
        severity: 'medium',
        description: `上下文切换频率过高 (${contextSwitches}/${totalTicks} ticks)，可能存在高优先级任务抢占问题`,
        affectedTasks: tasks.map(t => t.id),
        detectedAtTick: totalTicks
      })
    }
    
    tasks.forEach(task => {
      const waitRatio = totalTicks > 0 ? (task.totalTime - task.cpuTimeUsed - task.ioTimeUsed) / totalTicks : 0
      
      if (waitRatio > 0.7 && task.state !== TaskState.TERMINATED) {
        anomalies.push({
          type: 'long_wait',
          severity: 'medium',
          description: `任务 ${task.name} 等待时间过长 (${Math.round(waitRatio * 100)}%)`,
          affectedTasks: [task.id],
          detectedAtTick: totalTicks
        })
      }
      
      if (task.cpuTimeUsed === 0 && totalTicks > 10 && task.state !== TaskState.TERMINATED) {
        anomalies.push({
          type: 'starvation',
          severity: 'high',
          description: `任务 ${task.name} 从未获得 CPU 时间，可能存在饥饿问题`,
          affectedTasks: [task.id],
          detectedAtTick: totalTicks
        })
      }
    })
    
    return anomalies
  }

  private static generateSummary(
    tasks: Task[], 
    events: Event[], 
    totalTicks: number,
    taskStats: TaskStatistics[]
  ): AnalysisReport['summary'] {
    const totalCpuTime = taskStats.reduce((sum, s) => sum + s.cpuTime, 0)
    
    return {
      totalTicks,
      totalTasks: tasks.length,
      totalEvents: events.length,
      avgCpuUsage: totalTicks > 0 ? Math.round((totalCpuTime / totalTicks) * 100) : 0,
      contextSwitchCount: events.filter(e => e.type === EventType.CONTEXT_SWITCH).length
    }
  }

  private static generateRecommendations(
    anomalies: Anomaly[],
    eventAnalysis: EventAnalysis
  ): string[] {
    const recommendations: string[] = []
    
    const starvation = anomalies.find(a => a.type === 'starvation')
    if (starvation) {
      recommendations.push('检测到任务饥饿问题，建议检查调度器配置和任务优先级设置')
    }
    
    const highSwitch = anomalies.find(a => a.type === 'high_priority_overtake')
    if (highSwitch) {
      recommendations.push('上下文切换频率过高，建议增加时间片长度或减少任务数量')
    }
    
    const longWait = anomalies.find(a => a.type === 'long_wait')
    if (longWait) {
      recommendations.push('部分任务等待时间过长，建议检查 I/O 配置或调整任务调度策略')
    }
    
    if (eventAnalysis.byType[EventType.IO_START] > 0) {
      recommendations.push('存在 I/O 操作，可观察 I/O 阻塞对系统整体性能的影响')
    }
    
    if (recommendations.length === 0) {
      recommendations.push('系统运行正常，可继续探索不同的调度策略和任务配置')
    }
    
    return recommendations
  }

  static exportToMarkdown(report: AnalysisReport, tasks: Task[]): string {
    const taskMap = new Map(tasks.map(t => [t.id, t]))
    
    let md = `# 操作系统实验分析报告\n\n`
    md += `**实验名称**: ${report.experimentName}\n`
    md += `**生成时间**: ${new Date(report.generatedAt).toLocaleString()}\n\n`
    
    md += `## 执行摘要\n\n`
    md += `| 指标 | 值 |\n`
    md += `|------|-----|\n`
    md += `| 总时钟周期 | ${report.summary.totalTicks} |\n`
    md += `| 任务总数 | ${report.summary.totalTasks} |\n`
    md += `| 事件总数 | ${report.summary.totalEvents} |\n`
    md += `| 平均 CPU 使用率 | ${report.summary.avgCpuUsage}% |\n`
    md += `| 上下文切换次数 | ${report.summary.contextSwitchCount} |\n\n`
    
    md += `## 任务统计\n\n`
    report.taskStats.forEach(stat => {
      const task = taskMap.get(stat.taskId)
      md += `### ${stat.taskName} (${task?.type === 'process' ? '进程' : task?.type === 'thread' ? '线程' : '协程'})\n\n`
      md += `| 指标 | 值 |\n`
      md += `|------|-----|\n`
      md += `| CPU 时间 | ${stat.cpuTime} ticks |\n`
      md += `| I/O 时间 | ${stat.ioTime} ticks |\n`
      md += `| 等待时间 | ${stat.waitTime} ticks |\n`
      md += `| 用户态时间 | ${stat.executionModeTime.user} ticks |\n`
      md += `| 内核态时间 | ${stat.executionModeTime.kernel} ticks |\n`
      md += `| 上下文切换次数 | ${stat.contextSwitches} |\n\n`
    })
    
    if (report.anomalies.length > 0) {
      md += `## 异常检测\n\n`
      report.anomalies.forEach(anomaly => {
        const severityLabel = anomaly.severity === 'high' ? '高' : anomaly.severity === 'medium' ? '中' : '低'
        md += `### [${severityLabel}] ${anomaly.type === 'starvation' ? '饥饿' : anomaly.type === 'long_wait' ? '长时间等待' : anomaly.type === 'deadlock' ? '死锁' : '高优先级抢占'}\n\n`
        md += `**描述**: ${anomaly.description}\n\n`
        md += `**检测时间**: Tick ${anomaly.detectedAtTick}\n\n`
        md += `**受影响任务**: ${anomaly.affectedTasks.map(id => taskMap.get(id)?.name || id).join(', ')}\n\n`
      })
    }
    
    md += `## 建议\n\n`
    report.recommendations.forEach((rec, i) => {
      md += `${i + 1}. ${rec}\n`
    })
    md += `\n`
    
    return md
  }

  static exportToJSON(report: AnalysisReport): string {
    return JSON.stringify(report, null, 2)
  }
}
