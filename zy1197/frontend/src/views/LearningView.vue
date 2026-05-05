<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">学习资源</h1>
      <p class="text-gray-500 mt-1">了解 Reactor 和 Proactor 两种网络模型的工作原理</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="card border-t-4 border-t-accent-reactor">
        <div class="flex items-center space-x-3 mb-4">
          <span class="w-4 h-4 bg-accent-reactor rounded-full"></span>
          <h2 class="text-xl font-semibold text-gray-900">Reactor 模型</h2>
        </div>
        
        <div class="space-y-4">
          <div>
            <h3 class="font-medium text-gray-900 mb-2">核心概念</h3>
            <p class="text-sm text-gray-600 leading-relaxed">
              Reactor 模式使用同步 I/O，通过事件就绪通知机制工作。当某个 I/O 操作就绪时（如 socket 可读），事件循环会通知应用程序，由应用程序主动执行读写操作。
            </p>
          </div>
          
          <div>
            <h3 class="font-medium text-gray-900 mb-2">工作流程</h3>
            <ol class="space-y-2">
              <li class="flex items-start space-x-2 text-sm text-gray-600">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium">1</span>
                <span>应用程序向事件分离器注册感兴趣的事件类型</span>
              </li>
              <li class="flex items-start space-x-2 text-sm text-gray-600">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium">2</span>
                <span>事件分离器等待事件就绪（如 epoll_wait、kqueue）</span>
              </li>
              <li class="flex items-start space-x-2 text-sm text-gray-600">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium">3</span>
                <span>事件就绪时，分离器通知应用程序</span>
              </li>
              <li class="flex items-start space-x-2 text-sm text-gray-600">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium">4</span>
                <span>应用程序主动执行 I/O 操作（读/写）</span>
              </li>
              <li class="flex items-start space-x-2 text-sm text-gray-600">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium">5</span>
                <span>处理完成后，继续等待下一个事件</span>
              </li>
            </ol>
          </div>
          
          <div>
            <h3 class="font-medium text-gray-900 mb-2">特点</h3>
            <ul class="space-y-1">
              <li class="flex items-center space-x-2 text-sm text-gray-600">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>单线程事件循环，模型简单</span>
              </li>
              <li class="flex items-center space-x-2 text-sm text-gray-600">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>应用程序控制 I/O 时序</span>
              </li>
              <li class="flex items-center space-x-2 text-sm text-gray-600">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>跨平台兼容性好</span>
              </li>
              <li class="flex items-center space-x-2 text-sm text-gray-600">
                <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <span>同步 I/O 可能阻塞</span>
              </li>
            </ul>
          </div>
          
          <div class="p-3 bg-purple-50 rounded-lg">
            <p class="text-sm text-purple-700">
              <strong>适用场景：</strong>短连接、高并发、CPU 密集型任务。例如：Redis、Nginx（部分模块）
            </p>
          </div>
        </div>
      </div>

      <div class="card border-t-4 border-t-accent-proactor">
        <div class="flex items-center space-x-3 mb-4">
          <span class="w-4 h-4 bg-accent-proactor rounded-full"></span>
          <h2 class="text-xl font-semibold text-gray-900">Proactor 模型</h2>
        </div>
        
        <div class="space-y-4">
          <div>
            <h3 class="font-medium text-gray-900 mb-2">核心概念</h3>
            <p class="text-sm text-gray-600 leading-relaxed">
              Proactor 模式使用异步 I/O，通过完成事件通知机制工作。应用程序发起异步 I/O 请求后立即返回，操作系统在后台完成实际的 I/O 操作，完成后通过完成端口通知应用程序。
            </p>
          </div>
          
          <div>
            <h3 class="font-medium text-gray-900 mb-2">工作流程</h3>
            <ol class="space-y-2">
              <li class="flex items-start space-x-2 text-sm text-gray-600">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-medium">1</span>
                <span>应用程序向操作系统发起异步 I/O 请求</span>
              </li>
              <li class="flex items-start space-x-2 text-sm text-gray-600">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-medium">2</span>
                <span>操作系统在后台执行实际的 I/O 操作</span>
              </li>
              <li class="flex items-start space-x-2 text-sm text-gray-600">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-medium">3</span>
                <span>I/O 完成后，操作系统将结果放入完成端口</span>
              </li>
              <li class="flex items-start space-x-2 text-sm text-gray-600">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-medium">4</span>
                <span>应用程序从完成端口获取完成事件</span>
              </li>
              <li class="flex items-start space-x-2 text-sm text-gray-600">
                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-medium">5</span>
                <span>调用预注册的回调函数处理结果</span>
              </li>
            </ol>
          </div>
          
          <div>
            <h3 class="font-medium text-gray-900 mb-2">特点</h3>
            <ul class="space-y-1">
              <li class="flex items-center space-x-2 text-sm text-gray-600">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>真正的异步 I/O，非阻塞</span>
              </li>
              <li class="flex items-center space-x-2 text-sm text-gray-600">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>操作系统负责 I/O 调度</span>
              </li>
              <li class="flex items-center space-x-2 text-sm text-gray-600">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>高吞吐，适合 I/O 密集型</span>
              </li>
              <li class="flex items-center space-x-2 text-sm text-gray-600">
                <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <span>跨平台支持相对复杂</span>
              </li>
            </ul>
          </div>
          
          <div class="p-3 bg-amber-50 rounded-lg">
            <p class="text-sm text-amber-700">
              <strong>适用场景：</strong>长连接、高吞吐、I/O 密集型任务。例如：Windows IOCP、Boost.Asio、Web 服务器
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">两种模型对比</h2>
      
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">对比项</th>
              <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                <span class="inline-flex items-center space-x-1">
                  <span class="w-2 h-2 bg-accent-reactor rounded-full"></span>
                  <span>Reactor</span>
                </span>
              </th>
              <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                <span class="inline-flex items-center space-x-1">
                  <span class="w-2 h-2 bg-accent-proactor rounded-full"></span>
                  <span>Proactor</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">I/O 类型</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">同步 I/O</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">异步 I/O</td>
            </tr>
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">通知时机</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">I/O 就绪时</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">I/O 完成时</td>
            </tr>
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">I/O 执行主体</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">应用程序</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">操作系统</td>
            </tr>
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">线程模型</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">单线程事件循环</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">线程池处理回调</td>
            </tr>
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">回调执行</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">同步执行，可能阻塞</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">异步回调，非阻塞</td>
            </tr>
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">实现复杂度</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">较低</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">较高</td>
            </tr>
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">跨平台</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">好（epoll/kqueue/poll）</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">一般（IOCP/epoll 异步）</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">快速开始</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors">
          <div class="flex items-center space-x-2 mb-3">
            <span class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">1</span>
            <h3 class="font-medium text-gray-900">创建实验</h3>
          </div>
          <p class="text-sm text-gray-600">
            配置连接数、事件数、回调耗时等参数，或使用预设配置。
          </p>
        </div>
        
        <div class="p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors">
          <div class="flex items-center space-x-2 mb-3">
            <span class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">2</span>
            <h3 class="font-medium text-gray-900">运行对比</h3>
          </div>
          <p class="text-sm text-gray-600">
            系统会依次运行 Reactor 和 Proactor 模型，记录事件时间线。
          </p>
        </div>
        
        <div class="p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors">
          <div class="flex items-center space-x-2 mb-3">
            <span class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">3</span>
            <h3 class="font-medium text-gray-900">分析结果</h3>
          </div>
          <p class="text-sm text-gray-600">
            查看对比结果、事件时间线，导出 JSON 或 Markdown 报告。
          </p>
        </div>
      </div>
      
      <div class="mt-6 flex justify-center">
        <router-link to="/create" class="btn-primary">
          创建第一个实验
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
</script>
