package services

import (
	"context"
	"fmt"
	"math/rand"
	"performance-tracker/internal/models"
	"performance-tracker/internal/repository"
	"performance-tracker/pkg/logger"
	"performance-tracker/pkg/utils"
	"sync"
	"sync/atomic"
	"time"
)

type RunService struct {
	repo            *repository.Repository
	runningTasks    map[uint]*runningTask
	runningTasksMux sync.RWMutex
}

type runningTask struct {
	run          *models.Run
	cancelFunc   context.CancelFunc
	latencies    []float64
	totalRequests int64
	successCount int64
	failCount    int64
	timeoutCount int64
	responseSizes int64
}

func NewRunService(repo *repository.Repository) *RunService {
	return &RunService{
		repo:         repo,
		runningTasks: make(map[uint]*runningTask),
	}
}

func (s *RunService) CreateRun(ctx context.Context, run *models.Run) error {
	// 验证项目是否存在
	_, err := s.repo.GetProjectByID(ctx, run.ProjectID)
	if err != nil {
		return fmt.Errorf("project not found: %w", err)
	}

	// 验证运行配置
	if err := utils.ValidateRunConfig(run.Config); err != nil {
		return err
	}

	// 生成运行名称
	if run.Name == "" {
		run.Name = utils.GenerateRunName()
	}

	// 设置初始状态
	run.Status = models.RunStatusPending

	return s.repo.CreateRun(ctx, run)
}

func (s *RunService) GetRunByID(ctx context.Context, id uint) (*models.Run, error) {
	return s.repo.GetRunByID(ctx, id)
}

func (s *RunService) GetRunsByProjectID(ctx context.Context, projectID uint) ([]models.Run, error) {
	return s.repo.GetRunsByProjectID(ctx, projectID)
}

func (s *RunService) UpdateRun(ctx context.Context, run *models.Run) error {
	return s.repo.UpdateRun(ctx, run)
}

func (s *RunService) DeleteRun(ctx context.Context, id uint) error {
	// 检查是否正在运行
	s.runningTasksMux.RLock()
	_, isRunning := s.runningTasks[id]
	s.runningTasksMux.RUnlock()

	if isRunning {
		return fmt.Errorf("cannot delete running task, please stop it first")
	}

	return s.repo.DeleteRun(ctx, id)
}

func (s *RunService) StartRun(ctx context.Context, runID uint) error {
	// 检查运行是否存在
	run, err := s.repo.GetRunByID(ctx, runID)
	if err != nil {
		return fmt.Errorf("run not found: %w", err)
	}

	// 检查运行状态
	if run.Status == models.RunStatusRunning {
		return fmt.Errorf("run is already running")
	}

	if run.Status == models.RunStatusCompleted {
		return fmt.Errorf("run has already been completed")
	}

	// 获取样本数据
	samples, err := s.repo.GetSamplesByProjectID(ctx, run.ProjectID)
	if err != nil {
		return fmt.Errorf("failed to get samples: %w", err)
	}

	if len(samples) == 0 {
		return fmt.Errorf("no samples found for project, please import samples first")
	}

	// 创建运行任务上下文
	taskCtx, cancel := context.WithCancel(context.Background())

	// 更新运行状态
	now := time.Now()
	run.Status = models.RunStatusRunning
	run.StartedAt = &now
	if err := s.repo.UpdateRun(ctx, run); err != nil {
		cancel()
		return fmt.Errorf("failed to update run status: %w", err)
	}

	// 创建运行任务
	task := &runningTask{
		run:          run,
		cancelFunc:   cancel,
		latencies:    make([]float64, 0),
		totalRequests: 0,
		successCount: 0,
		failCount:    0,
		timeoutCount: 0,
		responseSizes: 0,
	}

	// 存储运行任务
	s.runningTasksMux.Lock()
	s.runningTasks[runID] = task
	s.runningTasksMux.Unlock()

	// 启动后台任务
	go s.executeRun(taskCtx, task, samples)

	logger.Infof("Run started: ID %d, Name: %s", runID, run.Name)
	return nil
}

func (s *RunService) StopRun(ctx context.Context, runID uint) error {
	// 检查运行是否存在
	run, err := s.repo.GetRunByID(ctx, runID)
	if err != nil {
		return fmt.Errorf("run not found: %w", err)
	}

	// 检查运行状态
	if run.Status != models.RunStatusRunning {
		return fmt.Errorf("run is not running")
	}

	// 获取运行任务
	s.runningTasksMux.Lock()
	task, exists := s.runningTasks[runID]
	s.runningTasksMux.Unlock()

	if !exists {
		// 任务不存在但状态是 running，更新状态
		run.Status = models.RunStatusStopped
		now := time.Now()
		run.EndedAt = &now
		s.repo.UpdateRun(ctx, run)
		return fmt.Errorf("run task not found, status updated to stopped")
	}

	// 取消任务
	task.cancelFunc()

	// 等待任务完成
	time.Sleep(1 * time.Second)

	// 清理运行任务
	s.runningTasksMux.Lock()
	delete(s.runningTasks, runID)
	s.runningTasksMux.Unlock()

	// 更新运行状态
	run.Status = models.RunStatusStopped
	now := time.Now()
	run.EndedAt = &now
	s.repo.UpdateRun(ctx, run)

	logger.Infof("Run stopped: ID %d, Name: %s", runID, run.Name)
	return nil
}

func (s *RunService) GetRunStatus(ctx context.Context, runID uint) (map[string]interface{}, error) {
	// 检查运行是否存在
	run, err := s.repo.GetRunByID(ctx, runID)
	if err != nil {
		return nil, fmt.Errorf("run not found: %w", err)
	}

	// 构建状态响应
	status := map[string]interface{}{
		"run_id":    run.ID,
		"name":      run.Name,
		"status":    run.Status,
		"config":    run.Config,
		"metrics":   run.Metrics,
		"created_at": run.CreatedAt,
		"started_at": run.StartedAt,
		"ended_at":  run.EndedAt,
	}

	// 如果正在运行，添加实时统计
	s.runningTasksMux.RLock()
	task, isRunning := s.runningTasks[runID]
	s.runningTasksMux.RUnlock()

	if isRunning {
		status["realtime_stats"] = map[string]interface{}{
			"total_requests":   atomic.LoadInt64(&task.totalRequests),
			"success_count":    atomic.LoadInt64(&task.successCount),
			"fail_count":       atomic.LoadInt64(&task.failCount),
			"timeout_count":    atomic.LoadInt64(&task.timeoutCount),
			"current_latencies": len(task.latencies),
		}
	}

	return status, nil
}

func (s *RunService) executeRun(ctx context.Context, task *runningTask, samples []models.Sample) {
	run := task.run
	config := run.Config

	// 创建请求通道
	requestChan := make(chan struct{}, config.Concurrency*2)

	// 创建等待组
	var wg sync.WaitGroup

	// 启动工作 goroutine
	for i := 0; i < config.Concurrency; i++ {
		wg.Add(1)
		go s.worker(ctx, task, samples, &wg, requestChan)
	}

	// 计算请求生成逻辑
	var requestCount int64 = 0
	var startTime = time.Now()

	// 确定是否有时间限制或请求数限制
	hasDurationLimit := config.DurationSeconds > 0
	hasRequestLimit := config.TotalRequests > 0

	// 计算请求间隔（如果有目标 RPS）
	var requestInterval time.Duration
	if config.TargetRPS > 0 {
		requestInterval = time.Duration(1e6 / config.TargetRPS) * time.Microsecond
	}

	// 主循环：生成请求
	ticker := time.NewTicker(1 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			// 上下文被取消，停止生成请求
			logger.Infof("Run cancelled: ID %d", run.ID)
			close(requestChan)
			wg.Wait()
			s.finalizeRun(task, models.RunStatusStopped)
			return

		case <-ticker.C:
			// 检查是否达到时间限制
			if hasDurationLimit {
				elapsed := time.Since(startTime).Seconds()
				if elapsed >= float64(config.DurationSeconds) {
					logger.Infof("Run duration limit reached: ID %d", run.ID)
					close(requestChan)
					wg.Wait()
					s.finalizeRun(task, models.RunStatusCompleted)
					return
				}
			}

			// 检查是否达到请求数限制
			if hasRequestLimit {
				if requestCount >= int64(config.TotalRequests) {
					logger.Infof("Run request limit reached: ID %d", run.ID)
					close(requestChan)
					wg.Wait()
					s.finalizeRun(task, models.RunStatusCompleted)
					return
				}
			}

			// 发送请求
			select {
			case requestChan <- struct{}{}:
				requestCount++
			default:
				// 通道已满，跳过此次请求
			}

			// 如果有目标 RPS，调整 ticker 间隔
			if config.TargetRPS > 0 && requestInterval > 0 {
				ticker.Reset(requestInterval)
			}
		}
	}
}

func (s *RunService) worker(ctx context.Context, task *runningTask, samples []models.Sample, wg *sync.WaitGroup, requestChan <-chan struct{}) {
	defer wg.Done()

	for range requestChan {
		select {
		case <-ctx.Done():
			return
		default:
			// 选择样本
			var sample models.Sample
			if task.run.Config.UseWeighted && len(samples) > 0 {
				sample = s.selectWeightedSample(samples)
			} else if len(samples) > 0 {
				sample = samples[rand.Intn(len(samples))]
			}

			// 执行模拟请求
			result := s.simulateRequest(sample, task.run.Config)

			// 更新统计
			atomic.AddInt64(&task.totalRequests, 1)

			if result.isTimeout {
				atomic.AddInt64(&task.timeoutCount, 1)
				atomic.AddInt64(&task.failCount, 1)
			} else if result.isError {
				atomic.AddInt64(&task.failCount, 1)
			} else {
				atomic.AddInt64(&task.successCount, 1)
			}

			// 记录延迟
			s.runningTasksMux.Lock()
			task.latencies = append(task.latencies, result.latencyMs)
			task.responseSizes += result.responseSize
			s.runningTasksMux.Unlock()
		}
	}
}

type requestResult struct {
	latencyMs    float64
	responseSize int64
	isTimeout    bool
	isError      bool
}

func (s *RunService) simulateRequest(sample models.Sample, config models.RunConfig) requestResult {
	// 模拟请求延迟（基于路径和方法的特征）
	baseLatency := s.calculateBaseLatency(sample)

	// 添加随机变化
	variation := rand.Float64() * 0.3 // 30% 变化
	latencyMs := baseLatency * (1 + variation - 0.15) // ±15% 变化

	// 模拟超时
	timeoutMs := float64(config.TimeoutMs)
	isTimeout := latencyMs > timeoutMs

	if isTimeout {
		return requestResult{
			latencyMs:    float64(config.TimeoutMs),
			responseSize: 0,
			isTimeout:    true,
			isError:      true,
		}
	}

	// 模拟错误率（5% 错误率）
	isError := rand.Float64() < 0.05

	// 模拟响应大小
	responseSize := int64(rand.Intn(10000) + 1000) // 1KB-11KB

	return requestResult{
		latencyMs:    latencyMs,
		responseSize: responseSize,
		isTimeout:    false,
		isError:      isError,
	}
}

func (s *RunService) calculateBaseLatency(sample models.Sample) float64 {
	// 基于路径特征计算基础延迟
	path := sample.Path
	method := sample.Method

	// 默认延迟
	baseLatency := 100.0

	// 基于路径特征调整
	if containsSubstring(path, "search") || containsSubstring(path, "query") {
		baseLatency *= 2.5 // 搜索/查询通常更慢
	} else if containsSubstring(path, "upload") || containsSubstring(path, "import") {
		baseLatency *= 3.0 // 上传/导入更慢
	} else if containsSubstring(path, "report") || containsSubstring(path, "analytics") {
		baseLatency *= 4.0 // 报告/分析更慢
	} else if containsSubstring(path, "list") || containsSubstring(path, "index") {
		baseLatency *= 1.5 // 列表操作稍慢
	}

	// 基于方法调整
	if method == "POST" || method == "PUT" || method == "DELETE" {
		baseLatency *= 1.3 // 写操作稍慢
	}

	return baseLatency
}

func (s *RunService) selectWeightedSample(samples []models.Sample) models.Sample {
	if len(samples) == 0 {
		return models.Sample{}
	}

	// 计算总权重
	totalWeight := 0.0
	for _, sample := range samples {
		totalWeight += sample.Weight
	}

	if totalWeight == 0 {
		// 如果所有权重都为 0，随机选择
		return samples[rand.Intn(len(samples))]
	}

	// 基于权重选择
	randomValue := rand.Float64() * totalWeight
	currentWeight := 0.0

	for _, sample := range samples {
		currentWeight += sample.Weight
		if currentWeight >= randomValue {
			return sample
		}
	}

	// 默认返回最后一个
	return samples[len(samples)-1]
}

func (s *RunService) finalizeRun(task *runningTask, status string) {
	run := task.run

	// 计算最终指标
	totalRequests := atomic.LoadInt64(&task.totalRequests)
	successCount := atomic.LoadInt64(&task.successCount)
	failCount := atomic.LoadInt64(&task.failCount)
	timeoutCount := atomic.LoadInt64(&task.timeoutCount)

	// 计算延迟百分位数
	s.runningTasksMux.RLock()
	latencies := make([]float64, len(task.latencies))
	copy(latencies, task.latencies)
	responseSizes := task.responseSizes
	s.runningTasksMux.RUnlock()

	p50, p95, p99 := utils.CalculatePercentiles(latencies)

	// 计算吞吐率
	var throughput float64
	if run.StartedAt != nil {
		elapsed := time.Since(*run.StartedAt).Seconds()
		if elapsed > 0 {
			throughput = float64(totalRequests) / elapsed
		}
	}

	// 计算错误率和超时率
	var errorRate, timeoutRate float64
	if totalRequests > 0 {
		errorRate = float64(failCount) / float64(totalRequests)
		timeoutRate = float64(timeoutCount) / float64(totalRequests)
	}

	// 计算平均响应大小
	var avgResponseSize int64
	if totalRequests > 0 {
		avgResponseSize = responseSizes / totalRequests
	}

	// 更新运行指标
	run.Metrics = models.RunMetrics{
		TotalRequests:      totalRequests,
		SuccessfulRequests: successCount,
		FailedRequests:     failCount,
		TimeoutRequests:    timeoutCount,
		Throughput:         throughput,
		P50Ms:              p50,
		P95Ms:              p95,
		P99Ms:              p99,
		ErrorRate:          errorRate,
		TimeoutRate:        timeoutRate,
		AvgResponseSize:    avgResponseSize,
	}

	// 更新运行状态
	run.Status = status
	now := time.Now()
	run.EndedAt = &now

	// 保存到数据库
	ctx := context.Background()
	if err := s.repo.UpdateRun(ctx, run); err != nil {
		logger.Errorf("Failed to finalize run: %v", err)
	}

	// 清理运行任务
	s.runningTasksMux.Lock()
	delete(s.runningTasks, run.ID)
	s.runningTasksMux.Unlock()

	logger.Infof("Run finalized: ID %d, Status: %s, Total Requests: %d, P95: %.2fms",
		run.ID, status, totalRequests, p95)
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
