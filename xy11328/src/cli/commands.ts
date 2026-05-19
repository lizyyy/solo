import { Command } from 'commander'
import chalk from 'chalk'
import { v4 as uuidv4 } from 'uuid'
import { TaskPriority, TaskStatus, Patient } from '../models/types'
import { taskService } from '../services/taskService'
import { escortService } from '../services/escortService'
import { storage } from '../services/storage'
import { maskTask, maskTaskList, maskEscortList } from '../utils/sensitiveMask'

const program = new Command()

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

export function printTask(task: any, showSensitive: boolean = false): void {
  const displayTask = showSensitive ? task : maskTask(task)
  console.log('\n' + chalk.cyan('='.repeat(60)))
  console.log(chalk.yellow.bold(`任务ID: ${displayTask.id}`))
  console.log(chalk.cyan('='.repeat(60)))
  console.log(`状态: ${getStatusColor(displayTask.status)}`)
  console.log(`优先级: ${getPriorityColor(displayTask.priority)}`)
  console.log(`检查类型: ${displayTask.checkType}`)
  console.log(`检查地点: ${displayTask.checkLocation}`)
  console.log(`创建时间: ${formatDate(displayTask.createdAt)}`)
  
  if (displayTask.patient) {
    console.log('\n' + chalk.magenta.bold('患者信息:'))
    console.log(`  姓名: ${displayTask.patient.name}`)
    console.log(`  身份证: ${displayTask.patient.idCard}`)
    console.log(`  电话: ${displayTask.patient.phone}`)
    console.log(`  科室: ${displayTask.patient.room}`)
    if (displayTask.patient.bedNumber) {
      console.log(`  床号: ${displayTask.patient.bedNumber}`)
    }
  }

  if (displayTask.escort) {
    console.log('\n' + chalk.magenta.bold('陪检员信息:'))
    console.log(`  姓名: ${displayTask.escort.name}`)
    console.log(`  电话: ${displayTask.escort.phone}`)
    console.log(`  工号: ${displayTask.escort.employeeId}`)
  }

  if (displayTask.waitTimeMinutes !== undefined) {
    console.log(`\n等候时间: ${displayTask.waitTimeMinutes} 分钟`)
  }
  if (displayTask.serviceTimeMinutes !== undefined) {
    console.log(`服务时长: ${displayTask.serviceTimeMinutes} 分钟`)
  }

  if (displayTask.remarks) {
    console.log(`\n备注: ${displayTask.remarks}`)
  }

  if (displayTask.transferHistory && displayTask.transferHistory.length > 0) {
    console.log('\n' + chalk.magenta.bold('转派记录:'))
    displayTask.transferHistory.forEach((record: any, index: number) => {
      console.log(`  ${index + 1}. ${formatDate(record.transferredAt)}`)
      console.log(`     从陪检员 ${record.fromEscortId} 转派到 ${record.toEscortId}`)
      console.log(`     原因: ${record.reason}`)
      console.log(`     操作人: ${record.operator}`)
    })
  }
  console.log(chalk.cyan('='.repeat(60)) + '\n')
}

export function getStatusColor(status: string): string {
  const colors: Record<string, chalk.Chalk> = {
    [TaskStatus.PENDING]: chalk.yellow,
    [TaskStatus.ASSIGNED]: chalk.blue,
    [TaskStatus.IN_PROGRESS]: chalk.magenta,
    [TaskStatus.COMPLETED]: chalk.green,
    [TaskStatus.CANCELLED]: chalk.gray,
    [TaskStatus.TIMEOUT]: chalk.red
  }
  return (colors[status] || chalk.white)(status)
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, chalk.Chalk> = {
    [TaskPriority.NORMAL]: chalk.green,
    [TaskPriority.URGENT]: chalk.yellow,
    [TaskPriority.EMERGENCY]: chalk.red
  }
  return (colors[priority] || chalk.white)(priority)
}

export function printTaskList(tasks: any[], showSensitive: boolean = false): void {
  const displayTasks = showSensitive ? tasks : maskTaskList(tasks)
  
  if (displayTasks.length === 0) {
    console.log(chalk.yellow('暂无任务记录'))
    return
  }

  console.log('\n' + chalk.cyan('='.repeat(100)))
  console.log(
    chalk.white.bold(
      'ID'.padEnd(10) +
      '状态'.padEnd(10) +
      '优先级'.padEnd(10) +
      '患者'.padEnd(12) +
      '检查类型'.padEnd(15) +
      '陪检员'.padEnd(12) +
      '等候时间'.padEnd(10) +
      '创建时间'
    )
  )
  console.log(chalk.cyan('-'.repeat(100)))

  displayTasks.forEach(task => {
    const patientName = task.patient?.name || '-'
    const escortName = task.escort?.name || '-'
    const waitTime = task.waitTimeMinutes !== undefined ? `${task.waitTimeMinutes}分钟` : '-'
    
    console.log(
      task.id.slice(0, 8).padEnd(10) +
      task.status.padEnd(10) +
      task.priority.padEnd(10) +
      patientName.padEnd(12) +
      task.checkType.padEnd(15) +
      escortName.padEnd(12) +
      waitTime.padEnd(10) +
      formatDate(task.createdAt)
    )
  })

  console.log(chalk.cyan('='.repeat(100)))
  console.log(chalk.green(`共 ${displayTasks.length} 条记录\n`))
}

export function printEscortList(escorts: any[], showSensitive: boolean = false): void {
  const displayEscorts = showSensitive ? escorts : maskEscortList(escorts)
  
  if (displayEscorts.length === 0) {
    console.log(chalk.yellow('暂无陪检员记录'))
    return
  }

  console.log('\n' + chalk.cyan('='.repeat(80)))
  console.log(
    chalk.white.bold(
      'ID'.padEnd(10) +
      '姓名'.padEnd(12) +
      '电话'.padEnd(15) +
      '工号'.padEnd(12) +
      '状态'.padEnd(10) +
      '当前任务'
    )
  )
  console.log(chalk.cyan('-'.repeat(80)))

  displayEscorts.forEach(escort => {
    const statusColor = escort.status === 'available' ? chalk.green : 
                        escort.status === 'busy' ? chalk.yellow : chalk.gray
    console.log(
      escort.id.slice(0, 8).padEnd(10) +
      escort.name.padEnd(12) +
      escort.phone.padEnd(15) +
      escort.employeeId.padEnd(12) +
      statusColor(escort.status.padEnd(10)) +
      (escort.currentTaskId ? escort.currentTaskId.slice(0, 8) : '-')
    )
  })

  console.log(chalk.cyan('='.repeat(80)))
  console.log(chalk.green(`共 ${displayEscorts.length} 条记录\n`))
}

export function printStats(stats: any): void {
  console.log('\n' + chalk.cyan('='.repeat(60)))
  console.log(chalk.yellow.bold('               陪检任务统计'))
  console.log(chalk.cyan('='.repeat(60)))
  
  console.log(`总任务数: ${chalk.white.bold(stats.totalTasks)}`)
  console.log(`待分配: ${chalk.yellow(stats.pendingTasks)}  |  ` +
              `进行中: ${chalk.magenta(stats.inProgressTasks)}  |  ` +
              `已完成: ${chalk.green(stats.completedTasks)}`)
  console.log(`已取消: ${chalk.gray(stats.cancelledTasks)}  |  ` +
              `已超时: ${chalk.red(stats.timeoutTasks)}`)
  
  console.log('\n' + chalk.magenta.bold('时间统计:'))
  console.log(`  平均等候时间: ${chalk.cyan(stats.avgWaitTimeMinutes)} 分钟`)
  console.log(`  平均服务时长: ${chalk.cyan(stats.avgServiceTimeMinutes)} 分钟`)
  console.log(`  最长等候时间: ${chalk.red(stats.maxWaitTimeMinutes)} 分钟`)
  
  console.log('\n' + chalk.magenta.bold('优先级分布:'))
  console.log(`  普通: ${stats.tasksByPriority.normal}  |  ` +
              `紧急: ${stats.tasksByPriority.urgent}  |  ` +
              `特急: ${stats.tasksByPriority.emergency}`)
  
  if (Object.keys(stats.tasksByEscort).length > 0) {
    console.log('\n' + chalk.magenta.bold('陪检员工作量:'))
    for (const [escortId, data] of Object.entries(stats.tasksByEscort) as any) {
      console.log(`  ${data.name}: 已完成 ${chalk.green(data.completed)}  |  进行中 ${chalk.yellow(data.inProgress)}`)
    }
  }
  
  console.log(chalk.cyan('='.repeat(60)) + '\n')
}

export function setupCommands(): Command {
  program
    .name('escort')
    .description('门诊陪检员管理系统 CLI')
    .version('1.0.0')

  program
    .option('--show-sensitive', '显示敏感信息（姓名、电话、身份证等）')

  const taskCmd = program.command('task').description('任务管理')

  taskCmd
    .command('create')
    .description('创建任务')
    .requiredOption('-n, --name <name>', '患者姓名')
    .requiredOption('-i, --id-card <idCard>', '患者身份证号')
    .requiredOption('-p, --phone <phone>', '患者电话')
    .requiredOption('-r, --room <room>', '科室')
    .option('-b, --bed <bedNumber>', '床号')
    .requiredOption('-t, --type <checkType>', '检查类型')
    .requiredOption('-l, --location <checkLocation>', '检查地点')
    .option('--priority <priority>', '优先级 (normal/urgent/emergency)', 'normal')
    .option('--remarks <remarks>', '备注')
    .option('--idempotency-key <key>', '幂等键，用于防止重复提交')
    .action((options) => {
      try {
        const patient: Patient = {
          id: uuidv4(),
          name: options.name,
          idCard: options.idCard,
          phone: options.phone,
          room: options.room,
          bedNumber: options.bed
        }
        const priority = options.priority as TaskPriority
        const task = taskService.createTask(
          patient,
          options.type,
          options.location,
          priority,
          options.remarks,
          options.idempotencyKey
        )
        console.log(chalk.green('任务创建成功！'))
        printTask(task, program.opts().showSensitive)
      } catch (error: any) {
        console.error(chalk.red('创建任务失败:', error.message))
        process.exit(1)
      }
    })

  taskCmd
    .command('assign <taskId> <escortId> <operator>')
    .description('派单')
    .option('--idempotency-key <key>', '幂等键')
    .action((taskId, escortId, operator, options) => {
      try {
        const task = taskService.assignTask(taskId, escortId, operator, options.idempotencyKey)
        console.log(chalk.green('派单成功！'))
        printTask(task, program.opts().showSensitive)
      } catch (error: any) {
        console.error(chalk.red('派单失败:', error.message))
        process.exit(1)
      }
    })

  taskCmd
    .command('accept <taskId> <escortId>')
    .description('接单')
    .option('--idempotency-key <key>', '幂等键')
    .action((taskId, escortId, options) => {
      try {
        const task = taskService.acceptTask(taskId, escortId, options.idempotencyKey)
        console.log(chalk.green('接单成功！'))
        printTask(task, program.opts().showSensitive)
      } catch (error: any) {
        console.error(chalk.red('接单失败:', error.message))
        process.exit(1)
      }
    })

  taskCmd
    .command('transfer')
    .description('转派任务')
    .requiredOption('--task-id <taskId>', '任务ID')
    .requiredOption('--from <fromEscortId>', '原陪检员ID')
    .requiredOption('--to <toEscortId>', '目标陪检员ID')
    .requiredOption('--reason <reason>', '转派原因')
    .requiredOption('--operator <operator>', '操作人')
    .option('--idempotency-key <key>', '幂等键')
    .action((options) => {
      try {
        const task = taskService.transferTask(
          options.taskId,
          options.from,
          options.to,
          options.reason,
          options.operator,
          options.idempotencyKey
        )
        console.log(chalk.green('转派成功！'))
        printTask(task, program.opts().showSensitive)
      } catch (error: any) {
        console.error(chalk.red('转派失败:', error.message))
        process.exit(1)
      }
    })

  taskCmd
    .command('complete <taskId> <escortId>')
    .description('完成任务')
    .option('--idempotency-key <key>', '幂等键')
    .action((taskId, escortId, options) => {
      try {
        const task = taskService.completeTask(taskId, escortId, options.idempotencyKey)
        console.log(chalk.green('任务已完成！'))
        printTask(task, program.opts().showSensitive)
      } catch (error: any) {
        console.error(chalk.red('完成任务失败:', error.message))
        process.exit(1)
      }
    })

  taskCmd
    .command('cancel <taskId> <reason> <operator>')
    .description('取消任务')
    .option('--idempotency-key <key>', '幂等键')
    .action((taskId, reason, operator, options) => {
      try {
        const task = taskService.cancelTask(taskId, reason, operator, options.idempotencyKey)
        console.log(chalk.green('任务已取消！'))
        printTask(task, program.opts().showSensitive)
      } catch (error: any) {
        console.error(chalk.red('取消任务失败:', error.message))
        process.exit(1)
      }
    })

  taskCmd
    .command('timeout <taskId>')
    .description('标记任务超时')
    .option('--idempotency-key <key>', '幂等键')
    .action((taskId, options) => {
      try {
        const task = taskService.timeoutTask(taskId, options.idempotencyKey)
        console.log(chalk.yellow('任务已标记为超时！'))
        printTask(task, program.opts().showSensitive)
      } catch (error: any) {
        console.error(chalk.red('标记超时失败:', error.message))
        process.exit(1)
      }
    })

  taskCmd
    .command('list')
    .description('列出所有任务')
    .option('--status <status>', '按状态筛选 (pending/assigned/in_progress/completed/cancelled/timeout)')
    .option('--escort <escortId>', '按陪检员筛选')
    .action((options) => {
      try {
        let tasks = taskService.getAllTasks()
        
        if (options.status) {
          tasks = tasks.filter(t => t.status === options.status)
        }
        if (options.escort) {
          tasks = tasks.filter(t => t.escortId === options.escort)
        }
        
        printTaskList(tasks, program.opts().showSensitive)
      } catch (error: any) {
        console.error(chalk.red('查询失败:', error.message))
        process.exit(1)
      }
    })

  taskCmd
    .command('get <taskId>')
    .description('查看任务详情')
    .action((taskId) => {
      try {
        const task = taskService.getTaskById(taskId)
        if (!task) {
          console.error(chalk.red('任务不存在'))
          process.exit(1)
        }
        printTask(task, program.opts().showSensitive)
      } catch (error: any) {
        console.error(chalk.red('查询失败:', error.message))
        process.exit(1)
      }
    })

  const escortCmd = program.command('escort').description('陪检员管理')

  escortCmd
    .command('create')
    .description('创建陪检员')
    .requiredOption('-n, --name <name>', '姓名')
    .requiredOption('-p, --phone <phone>', '电话')
    .requiredOption('-e, --employee-id <employeeId>', '工号')
    .action((options) => {
      try {
        const escort = escortService.createEscort(options.name, options.phone, options.employeeId)
        console.log(chalk.green('陪检员创建成功！'))
        printEscortList([escort], program.opts().showSensitive)
      } catch (error: any) {
        console.error(chalk.red('创建失败:', error.message))
        process.exit(1)
      }
    })

  escortCmd
    .command('list')
    .description('列出所有陪检员')
    .option('--available', '只显示可用陪检员')
    .action((options) => {
      try {
        const escorts = options.available 
          ? escortService.getAvailableEscorts() 
          : escortService.getAllEscorts()
        printEscortList(escorts, program.opts().showSensitive)
      } catch (error: any) {
        console.error(chalk.red('查询失败:', error.message))
        process.exit(1)
      }
    })

  escortCmd
    .command('get <escortId>')
    .description('查看陪检员详情')
    .action((escortId) => {
      try {
        const escort = escortService.getEscortById(escortId)
        if (!escort) {
          console.error(chalk.red('陪检员不存在'))
          process.exit(1)
        }
        printEscortList([escort], program.opts().showSensitive)
      } catch (error: any) {
        console.error(chalk.red('查询失败:', error.message))
        process.exit(1)
      }
    })

  escortCmd
    .command('update <escortId>')
    .description('更新陪检员信息')
    .option('-n, --name <name>', '姓名')
    .option('-p, --phone <phone>', '电话')
    .option('-s, --status <status>', '状态 (available/busy/offline)')
    .action((escortId, options) => {
      try {
        const updates: any = {}
        if (options.name) updates.name = options.name
        if (options.phone) updates.phone = options.phone
        if (options.status) updates.status = options.status
        
        const escort = escortService.updateEscort(escortId, updates)
        console.log(chalk.green('陪检员信息已更新！'))
        printEscortList([escort], program.opts().showSensitive)
      } catch (error: any) {
        console.error(chalk.red('更新失败:', error.message))
        process.exit(1)
      }
    })

  const statsCmd = program.command('stats').description('统计分析')

  statsCmd
    .command('show')
    .description('显示统计信息')
    .option('--start <startTime>', '开始时间 (时间戳)')
    .option('--end <endTime>', '结束时间 (时间戳)')
    .action((options) => {
      try {
        const stats = taskService.getStatistics(
          options.start ? parseInt(options.start) : undefined,
          options.end ? parseInt(options.end) : undefined
        )
        printStats(stats)
      } catch (error: any) {
        console.error(chalk.red('统计失败:', error.message))
        process.exit(1)
      }
    })

  const dataCmd = program.command('data').description('数据管理')

  dataCmd
    .command('export <filePath>')
    .description('导出数据到JSON文件')
    .option('--include-sensitive', '包含敏感信息（明文）')
    .action((filePath, options) => {
      try {
        storage.exportData(filePath, options.includeSensitive || false)
        console.log(chalk.green(`数据已导出到: ${filePath}`))
        if (!options.includeSensitive) {
          console.log(chalk.yellow('提示: 默认导出已脱敏敏感信息，如需明文导出请添加 --include-sensitive 参数'))
        }
      } catch (error: any) {
        console.error(chalk.red('导出失败:', error.message))
        process.exit(1)
      }
    })

  dataCmd
    .command('import <filePath>')
    .description('从JSON文件导入数据')
    .action((filePath) => {
      try {
        storage.importData(filePath)
        console.log(chalk.green('数据导入成功！'))
      } catch (error: any) {
        console.error(chalk.red('导入失败:', error.message))
        process.exit(1)
      }
    })

  dataCmd
    .command('path')
    .description('显示数据文件路径')
    .action(() => {
      console.log(chalk.cyan('数据文件路径:'), storage.getDbPath())
    })

  dataCmd
    .command('cleanup-idempotency')
    .description('清理过期的幂等记录')
    .action(() => {
      try {
        const count = taskService.cleanupExpiredIdempotencyRecords()
        console.log(chalk.green(`已清理 ${count} 条过期的幂等记录`))
      } catch (error: any) {
        console.error(chalk.red('清理失败:', error.message))
        process.exit(1)
      }
    })

  return program
}
