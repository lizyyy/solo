import { Workload, TaskType, Instruction } from '@/types'

export const SAMPLE_WORKLOADS: Workload[] = [
  {
    version: '1.0',
    name: '进程上下文切换演示',
    description: '演示两个进程在时间片轮转调度下的上下文切换过程',
    config: {
      timeSlice: 3,
      schedulerType: 'round_robin'
    },
    tasks: [
      {
        name: 'Process-A',
        type: TaskType.PROCESS,
        priority: 1,
        instructions: [
          { type: 'compute', description: '计算 fib(10)', duration: 5 },
          { type: 'compute', description: '计算 fib(15)', duration: 8 },
          { type: 'compute', description: '计算 fib(20)', duration: 12 },
          { type: 'terminate', description: '退出', duration: 1 }
        ]
      },
      {
        name: 'Process-B',
        type: TaskType.PROCESS,
        priority: 1,
        instructions: [
          { type: 'compute', description: '矩阵乘法 2x2', duration: 4 },
          { type: 'compute', description: '矩阵乘法 3x3', duration: 6 },
          { type: 'compute', description: '矩阵乘法 4x4', duration: 10 },
          { type: 'terminate', description: '退出', duration: 1 }
        ]
      }
    ]
  },
  {
    version: '1.0',
    name: 'I/O 阻塞演示',
    description: '演示 I/O 阻塞时的调度行为，展示阻塞态和就绪态的转换',
    config: {
      timeSlice: 5,
      ioLatency: 4,
      schedulerType: 'round_robin'
    },
    tasks: [
      {
        name: 'IO-Task',
        type: TaskType.PROCESS,
        priority: 1,
        instructions: [
          { type: 'compute', description: '准备数据', duration: 2 },
          { type: 'io', description: '读取磁盘文件', duration: 5, details: { ioType: 'disk' } },
          { type: 'compute', description: '处理数据', duration: 3 },
          { type: 'io', description: '写入数据库', duration: 4, details: { ioType: 'database' } },
          { type: 'compute', description: '验证结果', duration: 2 },
          { type: 'terminate', description: '退出', duration: 1 }
        ]
      },
      {
        name: 'CPU-Bound',
        type: TaskType.PROCESS,
        priority: 1,
        instructions: [
          { type: 'compute', description: '复杂计算 A', duration: 8 },
          { type: 'compute', description: '复杂计算 B', duration: 10 },
          { type: 'compute', description: '复杂计算 C', duration: 6 },
          { type: 'terminate', description: '退出', duration: 1 }
        ]
      }
    ]
  },
  {
    version: '1.0',
    name: '系统调用演示',
    description: '演示用户态到内核态的系统调用过程',
    config: {
      timeSlice: 10,
      schedulerType: 'round_robin'
    },
    tasks: [
      {
        name: 'Syscall-Demo',
        type: TaskType.PROCESS,
        priority: 1,
        instructions: [
          { type: 'compute', description: '用户态计算', duration: 3 },
          { type: 'syscall', description: 'open() 系统调用', duration: 2, details: { syscallType: 'open' } },
          { type: 'compute', description: '处理文件描述符', duration: 2 },
          { type: 'syscall', description: 'read() 系统调用', duration: 3, details: { syscallType: 'read' } },
          { type: 'compute', description: '处理读取数据', duration: 3 },
          { type: 'syscall', description: 'close() 系统调用', duration: 2, details: { syscallType: 'close' } },
          { type: 'compute', description: '后续处理', duration: 2 },
          { type: 'terminate', description: '退出', duration: 1 }
        ]
      }
    ]
  },
  {
    version: '1.0',
    name: '协程让出演示',
    description: '演示协程的用户态让出和恢复机制',
    config: {
      timeSlice: 20,
      schedulerType: 'round_robin'
    },
    tasks: [
      {
        name: 'Coroutine-A',
        type: TaskType.COROUTINE,
        priority: 1,
        instructions: [
          { type: 'compute', description: '阶段 1', duration: 2 },
          { type: 'yield', description: '主动让出 CPU', duration: 1, details: { yieldReason: 'cooperative' } },
          { type: 'compute', description: '阶段 2', duration: 2 },
          { type: 'yield', description: '主动让出 CPU', duration: 1, details: { yieldReason: 'cooperative' } },
          { type: 'compute', description: '阶段 3', duration: 2 },
          { type: 'terminate', description: '退出', duration: 1 }
        ]
      },
      {
        name: 'Coroutine-B',
        type: TaskType.COROUTINE,
        priority: 1,
        instructions: [
          { type: 'compute', description: '阶段 1', duration: 3 },
          { type: 'yield', description: '等待 I/O', duration: 1, details: { yieldReason: 'io_wait' } },
          { type: 'compute', description: '阶段 2', duration: 3 },
          { type: 'yield', description: '等待事件', duration: 1, details: { yieldReason: 'event_wait' } },
          { type: 'compute', description: '阶段 3', duration: 3 },
          { type: 'terminate', description: '退出', duration: 1 }
        ]
      }
    ]
  },
  {
    version: '1.0',
    name: '优先级调度演示',
    description: '演示优先级调度器的行为，高优先级任务抢占低优先级任务',
    config: {
      timeSlice: 4,
      schedulerType: 'priority',
      enablePreemption: true
    },
    tasks: [
      {
        name: 'High-Priority',
        type: TaskType.PROCESS,
        priority: 3,
        instructions: [
          { type: 'compute', description: '高优先级任务', duration: 6 },
          { type: 'io', description: '网络请求', duration: 4, details: { ioType: 'network' } },
          { type: 'compute', description: '处理响应', duration: 4 },
          { type: 'terminate', description: '退出', duration: 1 }
        ]
      },
      {
        name: 'Medium-Priority',
        type: TaskType.PROCESS,
        priority: 2,
        instructions: [
          { type: 'compute', description: '中优先级任务', duration: 10 },
          { type: 'compute', description: '继续计算', duration: 8 },
          { type: 'terminate', description: '退出', duration: 1 }
        ]
      },
      {
        name: 'Low-Priority',
        type: TaskType.PROCESS,
        priority: 1,
        instructions: [
          { type: 'compute', description: '低优先级后台任务', duration: 20 },
          { type: 'compute', description: '继续后台处理', duration: 15 },
          { type: 'terminate', description: '退出', duration: 1 }
        ]
      }
    ]
  }
]

export const INSTRUCTION_TEMPLATES: { [key: string]: Omit<Instruction, 'duration'> & { defaultDuration: number } } = {
  compute_simple: {
    type: 'compute',
    description: '简单计算',
    defaultDuration: 2
  },
  compute_complex: {
    type: 'compute',
    description: '复杂计算',
    defaultDuration: 5
  },
  io_disk: {
    type: 'io',
    description: '磁盘 I/O',
    defaultDuration: 4,
    details: { ioType: 'disk' }
  },
  io_network: {
    type: 'io',
    description: '网络 I/O',
    defaultDuration: 6,
    details: { ioType: 'network' }
  },
  io_database: {
    type: 'io',
    description: '数据库操作',
    defaultDuration: 5,
    details: { ioType: 'database' }
  },
  syscall_open: {
    type: 'syscall',
    description: 'open() 系统调用',
    defaultDuration: 2,
    details: { syscallType: 'open' }
  },
  syscall_read: {
    type: 'syscall',
    description: 'read() 系统调用',
    defaultDuration: 3,
    details: { syscallType: 'read' }
  },
  syscall_write: {
    type: 'syscall',
    description: 'write() 系统调用',
    defaultDuration: 3,
    details: { syscallType: 'write' }
  },
  syscall_sleep: {
    type: 'syscall',
    description: 'sleep() 系统调用',
    defaultDuration: 2,
    details: { syscallType: 'sleep' }
  },
  yield_voluntary: {
    type: 'yield',
    description: '主动让出',
    defaultDuration: 1,
    details: { yieldReason: 'voluntary' }
  },
  yield_io: {
    type: 'yield',
    description: '等待 I/O',
    defaultDuration: 1,
    details: { yieldReason: 'io_wait' }
  },
  terminate: {
    type: 'terminate',
    description: '任务退出',
    defaultDuration: 1
  }
}

export const ANOMALY_EXAMPLES = {
  invalid_task_type: {
    description: '无效的任务类型',
    example: '任务类型只能是 "process"、"thread" 或 "coroutine"',
    correct: '"type": "process"'
  },
  invalid_instruction_type: {
    description: '无效的指令类型',
    example: '指令类型只能是 "compute"、"io"、"syscall"、"yield" 或 "terminate"',
    correct: '"type": "compute"'
  },
  negative_duration: {
    description: '负的执行时长',
    example: 'duration 必须是正整数',
    correct: '"duration": 3'
  },
  missing_instructions: {
    description: '缺少指令列表',
    example: '每个任务必须包含至少一条指令',
    correct: '"instructions": [{"type": "compute", "description": "测试", "duration": 1}]'
  },
  invalid_priority: {
    description: '无效的优先级',
    example: '优先级必须是大于 0 的整数',
    correct: '"priority": 1'
  },
  invalid_timeslice: {
    description: '无效的时间片',
    example: '时间片必须是 1-20 之间的整数',
    correct: '"timeSlice": 5'
  }
}
