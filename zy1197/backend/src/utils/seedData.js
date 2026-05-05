const seedExperiments = [
  {
    name: "基础对比实验 - 小负载",
    description: "用于展示 Reactor 和 Proactor 在轻负载下的基本行为差异",
    seed: 12345,
    connections: 5,
    readEvents: 50,
    writeEvents: 25,
    callbackDelay: 10,
    readTimeout: 5000,
    writeTimeout: 5000,
    failureRate: 0,
    threadPoolSize: 4,
    handlers: [
      { name: "默认读处理器", eventType: "read_ready" },
      { name: "默认写处理器", eventType: "write_ready" }
    ]
  },
  {
    name: "中等负载对比实验",
    description: "测试中等负载下的性能表现",
    seed: 23456,
    connections: 20,
    readEvents: 200,
    writeEvents: 100,
    callbackDelay: 15,
    readTimeout: 10000,
    writeTimeout: 10000,
    failureRate: 0.01,
    threadPoolSize: 8,
    handlers: [
      { name: "连接处理器", eventType: "connection_accepted" },
      { name: "读完成处理器", eventType: "read_completed" },
      { name: "写完成处理器", eventType: "write_completed" }
    ]
  },
  {
    name: "高失败率压力测试",
    description: "测试在高失败率场景下两种模型的异常处理能力",
    seed: 34567,
    connections: 10,
    readEvents: 100,
    writeEvents: 50,
    callbackDelay: 5,
    readTimeout: 3000,
    writeTimeout: 3000,
    failureRate: 0.3,
    threadPoolSize: 4,
    handlers: [
      { name: "错误处理器", eventType: "error" },
      { name: "超时处理器", eventType: "read_timeout" }
    ]
  },
  {
    name: "线程池大小对比测试",
    description: "测试 Proactor 在不同线程池大小下的表现",
    seed: 45678,
    connections: 30,
    readEvents: 300,
    writeEvents: 150,
    callbackDelay: 20,
    readTimeout: 15000,
    writeTimeout: 15000,
    failureRate: 0,
    threadPoolSize: 16,
    handlers: [
      { name: "高性能读处理器", eventType: "read_completed" },
      { name: "高性能写处理器", eventType: "write_completed" }
    ]
  },
  {
    name: "超时场景测试",
    description: "测试两种模型在超时场景下的行为差异",
    seed: 56789,
    connections: 15,
    readEvents: 75,
    writeEvents: 40,
    callbackDelay: 100,
    readTimeout: 500,
    writeTimeout: 500,
    failureRate: 0.05,
    threadPoolSize: 4,
    handlers: [
      { name: "读超时处理器", eventType: "read_timeout" },
      { name: "写超时处理器", eventType: "write_timeout" }
    ]
  }
];

const quickStartConfigs = [
  {
    name: "新手入门 - 最小配置",
    description: "最简单的配置，快速了解实验流程",
    connections: 2,
    readEvents: 10,
    writeEvents: 5,
    callbackDelay: 5,
    failureRate: 0,
    threadPoolSize: 2,
    difficulty: "beginner",
    estimatedTime: "30秒"
  },
  {
    name: "标准对比测试",
    description: "推荐的标准配置，适合教学演示",
    connections: 10,
    readEvents: 100,
    writeEvents: 50,
    callbackDelay: 10,
    failureRate: 0.01,
    threadPoolSize: 4,
    difficulty: "intermediate",
    estimatedTime: "1-2分钟"
  },
  {
    name: "性能压力测试",
    description: "高负载配置，用于性能对比",
    connections: 50,
    readEvents: 500,
    writeEvents: 250,
    callbackDelay: 8,
    failureRate: 0.02,
    threadPoolSize: 8,
    difficulty: "advanced",
    estimatedTime: "3-5分钟"
  }
];

const learningExamples = [
  {
    title: "Reactor 模型工作原理",
    description: "Reactor 使用同步 I/O，通过事件就绪通知机制工作。应用程序需要主动进行读写操作。",
    keyPoints: [
      "事件就绪通知（如 epoll、kqueue）",
      "应用程序主动执行读写",
      "单线程事件循环",
      "同步 I/O 操作"
    ],
    recommendedConfig: {
      connections: 5,
      readEvents: 50,
      writeEvents: 25,
      callbackDelay: 10
    }
  },
  {
    title: "Proactor 模型工作原理",
    description: "Proactor 使用异步 I/O，通过完成事件通知机制工作。操作系统完成 I/O 后通知应用程序。",
    keyPoints: [
      "异步 I/O 操作（如 IOCP、epoll 异步模式）",
      "操作系统执行实际读写",
      "完成事件回调",
      "通常需要线程池处理回调"
    ],
    recommendedConfig: {
      connections: 5,
      readEvents: 50,
      writeEvents: 25,
      callbackDelay: 10,
      threadPoolSize: 4
    }
  },
  {
    title: "两种模型对比",
    description: "理解两种模型在不同场景下的优劣选择。",
    comparison: {
      "事件通知时机": {
        Reactor: "I/O 就绪时通知",
        Proactor: "I/O 完成时通知"
      },
      "I/O 执行主体": {
        Reactor: "应用程序",
        Proactor: "操作系统"
      },
      "线程模型": {
        Reactor: "单线程事件循环",
        Proactor: "线程池处理回调"
      },
      "适用场景": {
        Reactor: "短连接、高并发、CPU 密集型",
        Proactor: "长连接、高吞吐、I/O 密集型"
      }
    }
  }
];

function getSeedExperiments() {
  return [...seedExperiments];
}

function getQuickStartConfigs() {
  return [...quickStartConfigs];
}

function getLearningExamples() {
  return [...learningExamples];
}

function getExperimentBySeed(seed) {
  return seedExperiments.find(exp => exp.seed === seed);
}

module.exports = {
  seedExperiments,
  quickStartConfigs,
  learningExamples,
  getSeedExperiments,
  getQuickStartConfigs,
  getLearningExamples,
  getExperimentBySeed
};
