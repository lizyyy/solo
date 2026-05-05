package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"concurrency-inspector/internal/storage"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v2"
)

func SeedCommand(s *storage.SQLiteStorage) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "seed [type]",
		Short: "生成示例数据或坏样例",
		Long: `seed 命令用于生成示例数据和坏样例。
支持的类型:
  - good: 生成良好的并发设计示例
  - bad: 生成有问题的并发设计示例(用于学习识别问题)
  - all: 生成所有示例`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			seedType := args[0]
			return runSeed(cmd, seedType, s)
		},
	}

	cmd.Flags().StringP("dir", "d", ".", "输出目录路径")
	cmd.Flags().BoolP("force", "f", false, "强制覆盖现有文件")

	return cmd
}

func runSeed(cmd *cobra.Command, seedType string, s *storage.SQLiteStorage) error {
	dir, _ := cmd.Flags().GetString("dir")
	force, _ := cmd.Flags().GetBool("force")

	fmt.Printf("生成 seed 数据，类型: %s\n", seedType)
	fmt.Printf("目录: %s\n\n", dir)

	switch seedType {
	case "good":
		return createGoodExample(dir, force)
	case "bad":
		return createBadExample(dir, force)
	case "all":
		if err := createGoodExample(dir, force); err != nil {
			return err
		}
		return createBadExample(dir, force)
	default:
		return fmt.Errorf("unknown seed type: %s. Use 'good', 'bad', or 'all'", seedType)
	}
}

func createGoodExample(dir string, force bool) error {
	projectDir := filepath.Join(dir, "example-good-worker-pool")
	snippetsDir := filepath.Join(projectDir, "snippets")

	if err := os.MkdirAll(snippetsDir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	goodConfig := map[string]interface{}{
		"name":        "good-worker-pool-example",
		"description": "一个良好的 Worker Pool 并发设计示例",
		"version":     "1.0.0",
		"concurrency": map[string]interface{}{
			"patterns":    []string{"worker-pool"},
			"max_workers": 10,
			"rate_limit": map[string]interface{}{
				"type":       "token-bucket",
				"requests":   100,
				"per_second": 1,
				"burst":      50,
			},
		},
		"queues": []map[string]interface{}{
			{
				"name":        "task-queue",
				"type":        "channel",
				"capacity":    100,
				"priority":    false,
				"description": "任务输入队列，容量充足",
			},
			{
				"name":        "result-queue",
				"type":        "channel",
				"capacity":    100,
				"priority":    false,
				"description": "结果输出队列",
			},
			{
				"name":        "error-queue",
				"type":        "channel",
				"capacity":    50,
				"priority":    false,
				"description": "错误处理队列",
			},
		},
		"goroutines": []map[string]interface{}{
			{
				"name":          "dispatcher",
				"type":          "dispatcher",
				"output_queues": []string{"task-queue"},
				"workers":       1,
				"timeout":       "10s",
			},
			{
				"name":         "worker",
				"type":         "worker",
				"input_queues": []string{"task-queue"},
				"output_queues": []string{"result-queue", "error-queue"},
				"workers":      8,
				"timeout":      "30s",
				"retry_count":  3,
			},
			{
				"name":         "result-collector",
				"type":         "collector",
				"input_queues": []string{"result-queue"},
				"workers":      2,
				"timeout":      "15s",
			},
			{
				"name":         "error-handler",
				"type":         "handler",
				"input_queues": []string{"error-queue"},
				"workers":      1,
				"timeout":      "10s",
			},
		},
		"timeout": map[string]interface{}{
			"default":          "30s",
			"startup":          "10s",
			"shutdown":         "15s",
			"operation":        "30s",
			"cancel_propagate": true,
		},
		"error": map[string]interface{}{
			"strategy":      "continue-on-error",
			"max_retries":   3,
			"retry_backoff": "1s",
			"error_queue":   "error-queue",
			"panic_handler": true,
		},
		"shutdown": map[string]interface{}{
			"graceful":     true,
			"order":        []string{"dispatcher", "worker", "result-collector", "error-handler"},
			"wait_timeout": "10s",
			"force_kill":   true,
		},
	}

	yamlData, err := yaml.Marshal(goodConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	configPath := filepath.Join(projectDir, "design.yaml")
	if !force {
		if _, err := os.Stat(configPath); err == nil {
			return fmt.Errorf("file already exists: %s (use --force to overwrite)", configPath)
		}
	}

	if err := os.WriteFile(configPath, yamlData, 0644); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	eventsPath := filepath.Join(projectDir, "events.jsonl")
	eventsContent := `{"timestamp":"2024-01-15T10:00:00Z","type":"start","goroutine_id":"dispatcher-1","message":"dispatcher started"}
{"timestamp":"2024-01-15T10:00:01Z","type":"task_submit","goroutine_id":"dispatcher-1","queue_name":"task-queue","message":"task #1 submitted"}
{"timestamp":"2024-01-15T10:00:01Z","type":"worker_start","goroutine_id":"worker-1","message":"worker started"}
{"timestamp":"2024-01-15T10:00:01Z","type":"worker_start","goroutine_id":"worker-2","message":"worker started"}
{"timestamp":"2024-01-15T10:00:02Z","type":"task_process","goroutine_id":"worker-1","queue_name":"task-queue","duration":"500ms"}
{"timestamp":"2024-01-15T10:00:02Z","type":"result_emit","goroutine_id":"worker-1","queue_name":"result-queue"}
{"timestamp":"2024-01-15T10:00:05Z","type":"shutdown","goroutine_id":"dispatcher-1","message":"dispatcher shutting down"}
`
	if err := os.WriteFile(eventsPath, []byte(eventsContent), 0644); err != nil {
		return fmt.Errorf("failed to write events: %w", err)
	}

	goodSnippet := `package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type Task struct {
	ID       int
	Data     string
	Priority int
}

type Result struct {
	TaskID int
	Output string
	Err    error
}

type WorkerPool struct {
	taskChan   chan Task
	resultChan chan Result
	errorChan  chan error
	wg         sync.WaitGroup
	workers    int
}

func NewWorkerPool(workers int, queueSize int) *WorkerPool {
	return &WorkerPool{
		taskChan:   make(chan Task, queueSize),
		resultChan: make(chan Result, queueSize),
		errorChan:  make(chan error, queueSize/2),
		workers:    workers,
	}
}

func (wp *WorkerPool) Start(ctx context.Context) {
	for i := 0; i < wp.workers; i++ {
		wp.wg.Add(1)
		go wp.worker(ctx, i+1)
	}

	go func() {
		wp.wg.Wait()
		close(wp.resultChan)
		close(wp.errorChan)
	}()
}

func (wp *WorkerPool) worker(ctx context.Context, id int) {
	defer wp.wg.Done()
	defer func() {
		if r := recover(); r != nil {
			select {
			case wp.errorChan <- fmt.Errorf("worker %d panicked: %v", id, r):
			case <-ctx.Done():
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			fmt.Printf("Worker %d: shutting down (context cancelled)\n", id)
			return
		case task, ok := <-wp.taskChan:
			if !ok {
				fmt.Printf("Worker %d: task channel closed\n", id)
				return
			}

			result := wp.processTaskWithRetry(ctx, task, 3)
			
			select {
			case wp.resultChan <- result:
			case <-ctx.Done():
				return
			}
		}
	}
}

func (wp *WorkerPool) processTaskWithRetry(ctx context.Context, task Task, maxRetries int) Result {
	var lastErr error
	
	for attempt := 0; attempt <= maxRetries; attempt++ {
		select {
		case <-ctx.Done():
			return Result{TaskID: task.ID, Err: ctx.Err()}
		default:
		}

		if attempt > 0 {
			backoff := time.Duration(attempt) * time.Second
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return Result{TaskID: task.ID, Err: ctx.Err()}
			}
		}

		result, err := wp.processTask(ctx, task)
		if err == nil {
			return Result{TaskID: task.ID, Output: result}
		}
		lastErr = err
	}

	return Result{TaskID: task.ID, Err: lastErr}
}

func (wp *WorkerPool) processTask(ctx context.Context, task Task) (string, error) {
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case <-time.After(100 * time.Millisecond):
	}

	return fmt.Sprintf("processed task #%d: %s", task.ID, task.Data), nil
}

func (wp *WorkerPool) Submit(ctx context.Context, task Task) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case wp.taskChan <- task:
		return nil
	}
}

func (wp *WorkerPool) Shutdown(ctx context.Context) {
	close(wp.taskChan)
	
	done := make(chan struct{})
	go func() {
		wp.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		fmt.Println("All workers shut down gracefully")
	case <-ctx.Done():
		fmt.Println("Shutdown timeout reached")
	}
}

func (wp *WorkerPool) Results() <-chan Result {
	return wp.resultChan
}

func (wp *WorkerPool) Errors() <-chan error {
	return wp.errorChan
}
`

	snippetPath := filepath.Join(snippetsDir, "worker_pool_good.go")
	if err := os.WriteFile(snippetPath, []byte(goodSnippet), 0644); err != nil {
		return fmt.Errorf("failed to write snippet: %w", err)
	}

	fmt.Println("✓ 已创建良好示例: example-good-worker-pool")
	fmt.Println("  特点:")
	fmt.Println("    - 有界队列 (容量 100)")
	fmt.Println("    - 正确的 context 取消传播")
	fmt.Println("    - Panic recovery 机制")
	fmt.Println("    - 带退避的重试策略")
	fmt.Println("    - 优雅关闭和超时控制")
	fmt.Println("    - 单独的错误处理队列")

	return nil
}

func createBadExample(dir string, force bool) error {
	projectDir := filepath.Join(dir, "example-bad-worker-pool")
	snippetsDir := filepath.Join(projectDir, "snippets")

	if err := os.MkdirAll(snippetsDir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	badConfig := map[string]interface{}{
		"name":        "bad-worker-pool-example",
		"description": "一个有问题的 Worker Pool 并发设计示例",
		"version":     "1.0.0",
		"concurrency": map[string]interface{}{
			"patterns":    []string{"worker-pool"},
			"max_workers": 100,
		},
		"queues": []map[string]interface{}{
			{
				"name":        "task-queue",
				"type":        "channel",
				"capacity":    0,
				"priority":    false,
				"description": "无界任务队列 - 危险!",
			},
			{
				"name":        "result-queue",
				"type":        "channel",
				"capacity":    0,
				"priority":    false,
				"description": "无界结果队列 - 危险!",
			},
		},
		"goroutines": []map[string]interface{}{
			{
				"name":          "dispatcher",
				"type":          "dispatcher",
				"output_queues": []string{"task-queue"},
				"workers":       10,
			},
			{
				"name":         "worker",
				"type":         "worker",
				"input_queues": []string{"task-queue"},
				"output_queues": []string{"result-queue"},
				"workers":      100,
			},
		},
		"timeout": map[string]interface{}{
			"default":          "",
			"cancel_propagate": false,
		},
		"error": map[string]interface{}{
			"strategy":      "fail-fast",
			"panic_handler": false,
		},
		"shutdown": map[string]interface{}{
			"graceful":     false,
			"order":        []string{},
			"wait_timeout": "",
			"force_kill":   false,
		},
	}

	yamlData, err := yaml.Marshal(badConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	configPath := filepath.Join(projectDir, "design.yaml")
	if !force {
		if _, err := os.Stat(configPath); err == nil {
			return fmt.Errorf("file already exists: %s (use --force to overwrite)", configPath)
		}
	}

	if err := os.WriteFile(configPath, yamlData, 0644); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	eventsPath := filepath.Join(projectDir, "events.jsonl")
	if err := os.WriteFile(eventsPath, []byte(""), 0644); err != nil {
		return fmt.Errorf("failed to write events: %w", err)
	}

	badSnippet := `package main

import (
	"fmt"
	"sync"
)

type Task struct {
	ID   int
	Data string
}

type BadWorkerPool struct {
	taskChan   chan Task
	resultChan chan string
	wg         sync.WaitGroup
}

func NewBadWorkerPool() *BadWorkerPool {
	return &BadWorkerPool{
		taskChan:   make(chan Task),
		resultChan: make(chan string),
	}
}

func (bwp *BadWorkerPool) Start(workers int) {
	for i := 0; i < workers; i++ {
		bwp.wg.Add(1)
		go bwp.worker(i + 1)
	}
}

func (bwp *BadWorkerPool) worker(id int) {
	defer bwp.wg.Done()

	for task := range bwp.taskChan {
		result := bwp.processTask(task)
		
		bwp.resultChan <- result
	}
}

func (bwp *BadWorkerPool) processTask(task Task) string {
	if task.Data == "error" {
		panic(fmt.Sprintf("task #%d failed!", task.ID))
	}
	
	return fmt.Sprintf("processed: %s", task.Data)
}

func (bwp *BadWorkerPool) Submit(task Task) {
	bwp.taskChan <- task
}

func (bwp *BadWorkerPool) Shutdown() {
	close(bwp.taskChan)
	bwp.wg.Wait()
}

func main() {
	pool := NewBadWorkerPool()
	pool.Start(5)

	go func() {
		for i := 0; i < 1000000; i++ {
			pool.Submit(Task{ID: i, Data: fmt.Sprintf("data-%d", i)})
		}
	}()

	for {
		select {}
	}
}
`

	snippetPath := filepath.Join(snippetsDir, "worker_pool_bad.go")
	if err := os.WriteFile(snippetPath, []byte(badSnippet), 0644); err != nil {
		return fmt.Errorf("failed to write snippet: %w", err)
	}

	fmt.Println("✓ 已创建坏样例: example-bad-worker-pool")
	fmt.Println("  存在的问题:")
	fmt.Println("    - 无界队列 (容量 0) - 可能导致内存无限增长")
	fmt.Println("    - 无 context 取消传播 - goroutine 泄漏风险")
	fmt.Println("    - 无 Panic recovery - 一个错误会导致整个程序崩溃")
	fmt.Println("    - 无超时控制 - 可能永久阻塞")
	fmt.Println("    - 无优雅关闭 - 正在处理的任务会丢失")
	fmt.Println("    - 无错误队列 - 错误无法被处理")
	fmt.Println("    - 代码中: 无限循环 + 阻塞 select = 死锁")
	fmt.Println("    - 代码中: 无缓冲 channel 发送可能导致阻塞")

	return nil
}
