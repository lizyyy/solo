package simulator

import (
	"fmt"
	"math"
	"math/rand"
	"sort"
	"sync"
	"time"

	"queue-analyzer/pkg/analyzer"
	"queue-analyzer/pkg/models"
)

type Simulator struct {
	rng *rand.Rand
}

func NewSimulator() *Simulator {
	return &Simulator{
		rng: rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (s *Simulator) Simulate(
	baseJobs []*models.Job,
	simConfig *models.SimulationConfig,
) (*models.SimulationResult, error) {
	startTime := time.Now()

	result := &models.SimulationResult{
		Name:           "queue-simulation",
		ConfigName:     simConfig.Name,
		SimulationTime: time.Now(),
		Config:         simConfig,
		Issues:         make([]models.SimulationIssue, 0),
	}

	simJobs := s.cloneJobs(baseJobs)

	eventQueue := s.buildInitialEventQueue(simJobs)

	totalConcurrency := s.calculateTotalConcurrency(simConfig)
	workerPools := s.initializeWorkerPools(simConfig)

	currentTime := time.Time{}
	if len(simJobs) > 0 {
		currentTime = simJobs[0].EnqueueTime
	}

	jobByID := make(map[string]*simJob)
	for _, job := range simJobs {
		jobByID[job.ID] = job
	}

	activeJobs := make([]*simJob, 0)
	retryQueue := make([]*retryEntry, 0)
	backlogSamples := make([]models.QueueDepthSample, 0)
	events := make([]*models.QueueEvent, 0)

	for eventQueue.Len() > 0 || len(activeJobs) > 0 || len(retryQueue) > 0 {
		if eventQueue.Len() > 0 {
			nextEvent := eventQueue.Peek()
			if nextEvent.Time.Before(currentTime) || currentTime.IsZero() {
				currentTime = nextEvent.Time
			}
		}

		for len(retryQueue) > 0 && !retryQueue[0].ScheduledTime.After(currentTime) {
			entry := retryQueue[0]
			retryQueue = retryQueue[1:]

			job := jobByID[entry.JobID]
			job.RetryCount++
			job.Status = models.JobStatusPending

			enqueueEvent := &models.QueueEvent{
				ID:         entry.JobID + "-retry-" + string(rune(job.RetryCount)),
				JobID:      entry.JobID,
				EventType:  models.EventTypeRetry,
				Timestamp:  currentTime,
				JobType:    job.Type,
				Priority:   job.Priority,
				RetryCount: job.RetryCount,
			}
			events = append(events, enqueueEvent)

			eventQueue.Push(&simEvent{
				Time: currentTime,
				Type: eventTypeEnqueue,
				Job:  job,
			})
		}

		for len(activeJobs) > 0 {
			earliestComplete := time.Time{}
			earliestIdx := -1

			for i, job := range activeJobs {
				completeTime := job.StartTime.Add(time.Duration(job.ExecutionTimeMs) * time.Millisecond)
				if completeTime.Before(currentTime) || completeTime.Equal(currentTime) {
					if earliestComplete.IsZero() || completeTime.Before(earliestComplete) {
						earliestComplete = completeTime
						earliestIdx = i
					}
				}
			}

			if earliestIdx == -1 {
				break
			}

			completedJob := activeJobs[earliestIdx]
			activeJobs = append(activeJobs[:earliestIdx], activeJobs[earliestIdx+1:]...)

			if completedJob.Status == models.JobStatusFailed || completedJob.Status == models.JobStatusDeadLetter {
				continue
			}

			completeEvent := &models.QueueEvent{
				ID:            completedJob.ID + "-complete",
				JobID:         completedJob.ID,
				EventType:     models.EventTypeComplete,
				Timestamp:     earliestComplete,
				JobType:       completedJob.Type,
				Priority:      completedJob.Priority,
				ExecutionTime: completedJob.ExecutionTimeMs,
			}
			events = append(events, completeEvent)

			completedJob.Status = models.JobStatusSucceeded
			endTime := earliestComplete
			completedJob.EndTime = &endTime
		}

		for eventQueue.Len() > 0 {
			evt := eventQueue.Peek()
			if evt.Time.After(currentTime) {
				break
			}

			eventQueue.Pop()

			switch evt.Type {
			case eventTypeEnqueue:
				evt.Job.Status = models.JobStatusPending
				evt.Job.EnqueueTime = evt.Time

				enqueueEvent := &models.QueueEvent{
					ID:        evt.Job.ID + "-enqueue",
					JobID:     evt.Job.ID,
					EventType: models.EventTypeEnqueue,
					Timestamp: evt.Time,
					JobType:   evt.Job.Type,
					Priority:  evt.Job.Priority,
				}
				events = append(events, enqueueEvent)

			case eventTypeFail:
				job := evt.Job
				job.Status = models.JobStatusFailed

				failEvent := &models.QueueEvent{
					ID:           job.ID + "-fail-" + string(rune(job.RetryCount)),
					JobID:        job.ID,
					EventType:    models.EventTypeFail,
					Timestamp:    evt.Time,
					JobType:      job.Type,
					Priority:     job.Priority,
					RetryCount:   job.RetryCount,
					ErrorMessage: job.FailReason,
				}
				events = append(events, failEvent)

				if job.RetryCount < job.MaxRetries {
					retryDelay := s.calculateRetryDelay(job, simConfig)
					scheduledTime := evt.Time.Add(retryDelay)

					retryQueue = append(retryQueue, &retryEntry{
						JobID:         job.ID,
						ScheduledTime: scheduledTime,
						RetryCount:    job.RetryCount + 1,
					})
				} else {
					job.Status = models.JobStatusDeadLetter
					dlqTime := evt.Time
					job.EndTime = &dlqTime
					dlqEvent := &models.QueueEvent{
						ID:           job.ID + "-dlq",
						JobID:        job.ID,
						EventType:    models.EventTypeDeadLetter,
						Timestamp:    evt.Time,
						JobType:      job.Type,
						Priority:     job.Priority,
						ErrorMessage: job.FailReason,
					}
					events = append(events, dlqEvent)
				}
			}
		}

		availableSlots := totalConcurrency - len(activeJobs)
		if availableSlots > 0 {
			pendingJobs := s.getPendingJobsByPriority(jobByID)

			for availableSlots > 0 && len(pendingJobs) > 0 {
				job := pendingJobs[0]
				pendingJobs = pendingJobs[1:]

				startTime := currentTime
				job.StartTime = &startTime
				job.Status = models.JobStatusRunning
				job.WaitTimeMs = startTime.Sub(job.EnqueueTime).Milliseconds()

				startEvent := &models.QueueEvent{
					ID:        job.ID + "-start",
					JobID:     job.ID,
					EventType: models.EventTypeStart,
					Timestamp: startTime,
					JobType:   job.Type,
					Priority:  job.Priority,
				}
				events = append(events, startEvent)

				if s.shouldSimulateFailure(job, simConfig) {
					if job.FailReason == "" {
						job.FailReason = s.getRandomFailReason()
					}
					activeJobs = append(activeJobs, job)

					failTime := startTime.Add(time.Duration(job.ExecutionTimeMs/2) * time.Millisecond)
					eventQueue.Push(&simEvent{
						Time: failTime,
						Type: eventTypeFail,
						Job:  job,
					})
				} else {
					activeJobs = append(activeJobs, job)
				}

				availableSlots--
			}
		}

		if eventQueue.Len() > 0 {
			nextEventTime := eventQueue.Peek().Time
			if nextEventTime.After(currentTime) {
				currentTime = nextEventTime
			}
		} else if len(activeJobs) > 0 {
			earliestComplete := time.Time{}
			for _, job := range activeJobs {
				completeTime := job.StartTime.Add(time.Duration(job.ExecutionTimeMs) * time.Millisecond)
				if earliestComplete.IsZero() || completeTime.Before(earliestComplete) {
					earliestComplete = completeTime
				}
			}
			if !earliestComplete.IsZero() {
				currentTime = earliestComplete
			}
		} else if len(retryQueue) > 0 {
			currentTime = retryQueue[0].ScheduledTime
		}

		if s.shouldTakeBacklogSample(currentTime) {
			backlogCount := int64(0)
			for _, job := range jobByID {
				if job.Status == models.JobStatusPending || job.Status == models.JobStatusRetrying {
					backlogCount++
				}
			}

			backlogSamples = append(backlogSamples, models.QueueDepthSample{
				Timestamp: currentTime,
				Depth:     backlogCount,
			})
		}
	}

	processedJobs := make([]*models.Job, 0)
	for _, job := range simJobs {
		processedJobs = append(processedJobs, &job.Job)
	}

	analyzer := NewSimAnalyzer()
	analysisResult, err := analyzer.Analyze(
		&models.ImportedData{
			Jobs:   processedJobs,
			Events: events,
		},
		nil,
	)
	if err != nil {
		return nil, err
	}

	result.JobStats = analysisResult.JobStats
	result.BacklogAnalysis = analysisResult.BacklogAnalysis
	result.RetryAnalysis = analysisResult.RetryAnalysis
	result.DeadLetterAnalysis = analysisResult.DeadLetterAnalysis

	result.WorkerStats = s.buildWorkerStats(simConfig, workerPools)
	result.Metrics = s.buildSimulationMetrics(events, backlogSamples)
	result.Summary = s.buildSimulationSummary(processedJobs, result.JobStats, result.BacklogAnalysis, startTime, simConfig)

	result.Issues = s.detectSimulationIssues(processedJobs, events, result)

	return result, nil
}

func (s *Simulator) cloneJobs(jobs []*models.Job) []*simJob {
	cloned := make([]*simJob, len(jobs))
	for i, job := range jobs {
		cloned[i] = &simJob{
			Job: *job,
		}
	}
	return cloned
}

func (s *Simulator) buildInitialEventQueue(jobs []*simJob) *priorityQueue {
	queue := &priorityQueue{}

	for _, job := range jobs {
		queue.Push(&simEvent{
			Time: job.EnqueueTime,
			Type: eventTypeEnqueue,
			Job:  job,
		})
	}

	return queue
}

func (s *Simulator) calculateTotalConcurrency(config *models.SimulationConfig) int {
	total := 0

	if config.GlobalConcurrency > 0 {
		return config.GlobalConcurrency
	}

	for _, pool := range config.WorkerPools {
		total += pool.WorkerCount * pool.ConcurrencyPerWorker
	}

	for _, q := range config.Queues {
		total += q.WorkerConcurrency
	}

	if total == 0 {
		total = 10
	}

	return total
}

func (s *Simulator) initializeWorkerPools(config *models.SimulationConfig) map[string]*workerPool {
	pools := make(map[string]*workerPool)

	for _, poolConfig := range config.WorkerPools {
		pool := &workerPool{
			Name:         poolConfig.Name,
			WorkerCount:  poolConfig.WorkerCount,
			Concurrency:  poolConfig.ConcurrencyPerWorker * poolConfig.WorkerCount,
			BatchSize:    poolConfig.BatchSize,
			PollInterval: poolConfig.PollInterval,
			ActiveSlots:  0,
		}
		pools[poolConfig.Name] = pool
	}

	return pools
}

func (s *Simulator) calculateRetryDelay(job *simJob, config *models.SimulationConfig) time.Duration {
	var policy *models.RetryPolicy
	if config.DefaultRetryPolicy != nil {
		policy = config.DefaultRetryPolicy
	} else {
		policy = &models.RetryPolicy{
			Strategy:     "exponential",
			InitialDelay: 1 * time.Second,
			MaxDelay:     5 * time.Minute,
			Multiplier:   2.0,
			Jitter:       0.1,
		}
	}

	var delay time.Duration

	switch policy.Strategy {
	case "fixed":
		delay = policy.InitialDelay
	case "exponential":
		delay = policy.InitialDelay
		for i := 0; i < job.RetryCount; i++ {
			delay = time.Duration(float64(delay) * policy.Multiplier)
			if delay > policy.MaxDelay {
				delay = policy.MaxDelay
				break
			}
		}
	case "linear":
		delay = time.Duration(float64(policy.InitialDelay) * float64(job.RetryCount+1))
		if delay > policy.MaxDelay {
			delay = policy.MaxDelay
		}
	default:
		delay = policy.InitialDelay
	}

	if policy.Jitter > 0 {
		jitterAmount := float64(delay) * policy.Jitter
		delay = time.Duration(float64(delay) + (s.rng.Float64()*2-1)*jitterAmount)
	}

	return delay
}

func (s *Simulator) shouldSimulateFailure(job *simJob, config *models.SimulationConfig) bool {
	if job.FailReason != "" {
		return true
	}

	if job.RetryCount >= job.MaxRetries {
		return false
	}

	return false
}

func (s *Simulator) getRandomFailReason() string {
	reasons := []string{
		"network_error",
		"service_unavailable",
		"database_timeout",
		"rate_limited",
		"payload_validation_error",
	}
	return reasons[s.rng.Intn(len(reasons))]
}

func (s *Simulator) getPendingJobsByPriority(jobByID map[string]*simJob) []*simJob {
	jobs := make([]*simJob, 0)

	for _, job := range jobByID {
		if job.Status == models.JobStatusPending || job.Status == models.JobStatusRetrying {
			jobs = append(jobs, job)
		}
	}

	sort.Slice(jobs, func(i, j int) bool {
		if jobs[i].Priority != jobs[j].Priority {
			return jobs[i].Priority > jobs[j].Priority
		}
		return jobs[i].EnqueueTime.Before(jobs[j].EnqueueTime)
	})

	return jobs
}

func (s *Simulator) shouldTakeBacklogSample(t time.Time) bool {
	return true
}

func (s *Simulator) buildWorkerStats(
	config *models.SimulationConfig,
	pools map[string]*workerPool,
) *models.WorkerSimulationStats {
	stats := &models.WorkerSimulationStats{
		ByPool:            make(map[string]models.WorkerPoolStats),
		WorkerUtilization: make(map[string]models.WorkerUtilization),
	}

	totalConcurrency := 0
	for _, poolConfig := range config.WorkerPools {
		concurrency := poolConfig.WorkerCount * poolConfig.ConcurrencyPerWorker
		totalConcurrency += concurrency

		stats.ByPool[poolConfig.Name] = models.WorkerPoolStats{
			WorkerCount:        poolConfig.WorkerCount,
			Concurrency:        concurrency,
			AvgUtilizationRate: 0.8,
			AvgBatchSize:       float64(poolConfig.BatchSize),
		}
	}

	for _, q := range config.Queues {
		totalConcurrency += q.WorkerConcurrency
	}

	stats.TotalWorkers = len(config.WorkerPools) * 2
	stats.TotalConcurrency = totalConcurrency
	stats.AvgUtilizationRate = 0.75

	return stats
}

func (s *Simulator) buildSimulationMetrics(
	events []*models.QueueEvent,
	backlogSamples []models.QueueDepthSample,
) *models.SimulationMetrics {
	metrics := &models.SimulationMetrics{}

	for _, event := range events {
		switch event.EventType {
		case models.EventTypeEnqueue:
			metrics.TotalEnqueueEvents++
		case models.EventTypeStart:
			metrics.TotalDequeueEvents++
		case models.EventTypeComplete:
			metrics.TotalCompleteEvents++
		case models.EventTypeFail:
			metrics.TotalFailEvents++
		case models.EventTypeRetry:
			metrics.TotalRetryEvents++
		case models.EventTypeTimeout:
			metrics.TotalTimeoutEvents++
		case models.EventTypeDeadLetter:
			metrics.TotalDLQEvents++
		}
	}

	metrics.QueueDepthOverTime = backlogSamples

	return metrics
}

func (s *Simulator) buildSimulationSummary(
	jobs []*models.Job,
	jobStats *models.JobStatistics,
	backlog *models.BacklogAnalysis,
	startTime time.Time,
	config *models.SimulationConfig,
) models.SimulationSummary {
	summary := models.SimulationSummary{
		TotalJobs:         jobStats.TotalJobs,
		ProcessedJobs:     jobStats.TotalJobs - jobStats.DeadLetterCount,
		SuccessRate:       jobStats.SuccessRate,
		PeakBacklog:       backlog.PeakBacklog,
		MaxBacklog:        backlog.PeakBacklog,
		RealDurationMs:    time.Since(startTime).Milliseconds(),
		AvgWaitTimeMs:     jobStats.AvgWaitTimeMs,
		P95WaitTimeMs:     jobStats.P95WaitTimeMs,
		P99WaitTimeMs:     jobStats.P99WaitTimeMs,
		MaxWaitTimeMs:     int64(jobStats.P99WaitTimeMs),
		DeadLetterJobs:    jobStats.DeadLetterCount,
		WorkerUtilization: 0.75,
	}

	if len(jobs) > 0 {
		var earliest, latest time.Time
		var totalRetries int64
		for _, job := range jobs {
			if earliest.IsZero() || job.EnqueueTime.Before(earliest) {
				earliest = job.EnqueueTime
			}
			endTime := job.EnqueueTime
			if job.EndTime != nil {
				endTime = *job.EndTime
			}
			if latest.IsZero() || endTime.After(latest) {
				latest = endTime
			}
			if job.RetryCount > 0 {
				totalRetries += int64(job.RetryCount)
			}
		}

		summary.SimulationDuration = latest.Sub(earliest)
		summary.TotalRetries = totalRetries

		if summary.SimulationDuration.Seconds() > 0 {
			summary.ThroughputPerSecond = float64(summary.ProcessedJobs) / summary.SimulationDuration.Seconds()
		}
	}

	return summary
}

func (s *Simulator) detectSimulationIssues(
	jobs []*models.Job,
	events []*models.QueueEvent,
	result *models.SimulationResult,
) []models.SimulationIssue {
	issues := make([]models.SimulationIssue, 0)
	issueID := 1

	if result.BacklogAnalysis != nil && result.BacklogAnalysis.PeakBacklog > 200 {
		issues = append(issues, models.SimulationIssue{
			ID:          fmt.Sprintf("ISSUE-%03d", issueID),
			Type:        "backlog_spike",
			Severity:    "high",
			Timestamp:   result.BacklogAnalysis.PeakTime,
			Description: "模拟中检测到严重队列积压",
			Details:     fmt.Sprintf("峰值积压达到 %d，可能导致系统不稳定", result.BacklogAnalysis.PeakBacklog),
		})
		issueID++
	}

	if result.RetryAnalysis != nil && len(result.RetryAnalysis.RetryStormIndicators) > 0 {
		for _, storm := range result.RetryAnalysis.RetryStormIndicators {
			issues = append(issues, models.SimulationIssue{
				ID:          fmt.Sprintf("ISSUE-%03d", issueID),
				Type:        "retry_storm",
				Severity:    storm.Severity,
				Timestamp:   storm.StartTime,
				Description: "模拟中检测到重试风暴",
				Details:     fmt.Sprintf("%s 级重试风暴：%d 次重试事件影响 %d 个任务", storm.Severity, storm.RetryCount, storm.AffectedJobs),
			})
			issueID++
		}
	}

	if result.DeadLetterAnalysis != nil && result.DeadLetterAnalysis.TotalDeadLetterJobs > 0 {
		issues = append(issues, models.SimulationIssue{
			ID:          fmt.Sprintf("ISSUE-%03d", issueID),
			Type:        "dead_letter",
			Severity:    "medium",
			Timestamp:   time.Now(),
			Description: "模拟中有任务进入死信队列",
			Details:     fmt.Sprintf("共有 %d 个任务进入死信队列，死信率 %.2f%%", result.DeadLetterAnalysis.TotalDeadLetterJobs, result.DeadLetterAnalysis.DeadLetterRate*100),
		})
		issueID++
	}

	return issues
}

func (s *Simulator) Compare(
	baseResult *models.SimulationResult,
	otherResults []*models.SimulationResult,
) (*models.ComparisonResult, error) {
	result := &models.ComparisonResult{
		Name:                "simulation-comparison",
		ComparisonTime:      time.Now(),
		BaseConfigName:      baseResult.ConfigName,
		ComparedConfigNames: make([]string, 0),
		Recommendations:     make([]models.Recommendation, 0),
	}

	allResults := []*models.SimulationResult{baseResult}
	allResults = append(allResults, otherResults...)

	for _, r := range otherResults {
		result.ComparedConfigNames = append(result.ComparedConfigNames, r.ConfigName)
	}

	result.Summary = s.calculateComparisonSummary(allResults)
	result.DetailedComparison = s.buildDetailedComparison(baseResult, otherResults)
	result.Recommendations = s.generateComparisonRecommendations(result)

	return result, nil
}

func (s *Simulator) calculateComparisonSummary(results []*models.SimulationResult) models.ComparisonSummary {
	summary := models.ComparisonSummary{
		TotalSimulations: len(results),
	}

	bestSuccessRate := 0.0
	bestThroughput := 0.0
	bestMaxWaitTime := int64(math.MaxInt64)
	bestPeakBacklog := int64(math.MaxInt64)
	bestUtilization := 0.0

	worstSuccessRate := 1.0
	worstThroughput := math.MaxFloat64
	worstMaxWaitTime := int64(0)
	worstPeakBacklog := int64(0)
	worstUtilization := 1.0

	for _, result := range results {
		successRate := result.Summary.SuccessRate
		throughput := result.Summary.ThroughputPerSecond
		maxWait := result.Summary.MaxWaitTimeMs
		peakBacklog := result.Summary.PeakBacklog

		utilization := 0.0
		if result.WorkerStats != nil {
			utilization = result.WorkerStats.AvgUtilizationRate
		} else if result.Summary.WorkerUtilization > 0 {
			utilization = result.Summary.WorkerUtilization
		}

		if successRate > bestSuccessRate {
			bestSuccessRate = successRate
			summary.BestConfigName = result.ConfigName
		}
		if throughput > bestThroughput {
			bestThroughput = throughput
		}
		if maxWait < bestMaxWaitTime {
			bestMaxWaitTime = maxWait
		}
		if peakBacklog < bestPeakBacklog {
			bestPeakBacklog = peakBacklog
		}
		if utilization > bestUtilization {
			bestUtilization = utilization
		}

		if successRate < worstSuccessRate {
			worstSuccessRate = successRate
			summary.WorstConfigName = result.ConfigName
		}
		if throughput < worstThroughput {
			worstThroughput = throughput
		}
		if maxWait > worstMaxWaitTime {
			worstMaxWaitTime = maxWait
		}
		if peakBacklog > worstPeakBacklog {
			worstPeakBacklog = peakBacklog
		}
		if utilization < worstUtilization {
			worstUtilization = utilization
		}
	}

	summary.BestSuccessRate = bestSuccessRate
	summary.BestThroughput = bestThroughput
	summary.BestMaxWaitTime = bestMaxWaitTime
	summary.BestPeakBacklog = bestPeakBacklog
	summary.BestUtilization = bestUtilization

	return summary
}

func (s *Simulator) buildDetailedComparison(
	base *models.SimulationResult,
	others []*models.SimulationResult,
) models.DetailedComparison {
	comparison := models.DetailedComparison{
		ByConfig:  make(map[string]models.ConfigComparison),
		ByMetric:  make(map[string]models.MetricComparison),
		Tradeoffs: make([]models.Tradeoff, 0),
	}

	allResults := []*models.SimulationResult{base}
	allResults = append(allResults, others...)

	for _, result := range allResults {
		isBase := result.ConfigName == base.ConfigName

		avgWaitTimeMs := result.Summary.AvgWaitTimeMs
		if result.JobStats != nil {
			avgWaitTimeMs = result.JobStats.AvgWaitTimeMs
		}

		baseAvgWaitTimeMs := base.Summary.AvgWaitTimeMs
		if base.JobStats != nil {
			baseAvgWaitTimeMs = base.JobStats.AvgWaitTimeMs
		}

		utilizationRate := result.Summary.WorkerUtilization
		if result.WorkerStats != nil {
			utilizationRate = result.WorkerStats.AvgUtilizationRate
		}

		baseUtilizationRate := base.Summary.WorkerUtilization
		if base.WorkerStats != nil {
			baseUtilizationRate = base.WorkerStats.AvgUtilizationRate
		}

		retryRate := 0.0
		if result.RetryAnalysis != nil {
			retryRate = result.RetryAnalysis.RetryRate
		}

		baseRetryRate := 0.0
		if base.RetryAnalysis != nil {
			baseRetryRate = base.RetryAnalysis.RetryRate
		}

		dlqRate := 0.0
		if result.DeadLetterAnalysis != nil {
			dlqRate = result.DeadLetterAnalysis.DeadLetterRate
		}

		baseDLQRate := 0.0
		if base.DeadLetterAnalysis != nil {
			baseDLQRate = base.DeadLetterAnalysis.DeadLetterRate
		}

		comp := models.ConfigComparison{
			ConfigName:      result.ConfigName,
			IsBase:          isBase,
			SuccessRate:     result.Summary.SuccessRate,
			SuccessRateDiff: result.Summary.SuccessRate - base.Summary.SuccessRate,
			Throughput:      result.Summary.ThroughputPerSecond,
			ThroughputDiff:  result.Summary.ThroughputPerSecond - base.Summary.ThroughputPerSecond,
			AvgWaitTimeMs:   avgWaitTimeMs,
			WaitTimeDiff:    avgWaitTimeMs - baseAvgWaitTimeMs,
			MaxWaitTimeMs:   result.Summary.MaxWaitTimeMs,
			PeakBacklog:     result.Summary.PeakBacklog,
			BacklogDiff:     result.Summary.PeakBacklog - base.Summary.PeakBacklog,
			UtilizationRate: utilizationRate,
			UtilizationDiff: utilizationRate - baseUtilizationRate,
			RetryRate:       retryRate,
			RetryRateDiff:   retryRate - baseRetryRate,
			DLQRate:         dlqRate,
			DLQRateDiff:     dlqRate - baseDLQRate,
		}

		comp.Score = s.calculateConfigScore(comp)
		comparison.ByConfig[result.ConfigName] = comp
	}

	configList := make([]models.ConfigComparison, 0)
	for _, c := range comparison.ByConfig {
		configList = append(configList, c)
	}

	sort.Slice(configList, func(i, j int) bool {
		return configList[i].Score > configList[j].Score
	})

	for i, c := range configList {
		comp := comparison.ByConfig[c.ConfigName]
		comp.Rank = i + 1
		comparison.ByConfig[c.ConfigName] = comp
	}

	metricNames := []string{"success_rate", "throughput", "avg_wait_time", "max_wait_time", "peak_backlog", "utilization", "retry_rate", "dlq_rate"}
	for _, metricName := range metricNames {
		metricComp := models.MetricComparison{
			MetricName: metricName,
			ByConfig:   make(map[string]float64),
		}

		switch metricName {
		case "success_rate":
			metricComp.BaseValue = base.Summary.SuccessRate
			metricComp.HigherIsBetter = true
		case "throughput":
			metricComp.BaseValue = base.Summary.ThroughputPerSecond
			metricComp.HigherIsBetter = true
		case "avg_wait_time":
			if base.JobStats != nil {
				metricComp.BaseValue = base.JobStats.AvgWaitTimeMs
			} else {
				metricComp.BaseValue = base.Summary.AvgWaitTimeMs
			}
			metricComp.HigherIsBetter = false
		case "max_wait_time":
			metricComp.BaseValue = float64(base.Summary.MaxWaitTimeMs)
			metricComp.HigherIsBetter = false
		case "peak_backlog":
			metricComp.BaseValue = float64(base.Summary.PeakBacklog)
			metricComp.HigherIsBetter = false
		case "utilization":
			if base.WorkerStats != nil {
				metricComp.BaseValue = base.WorkerStats.AvgUtilizationRate
			} else {
				metricComp.BaseValue = base.Summary.WorkerUtilization
			}
			metricComp.HigherIsBetter = true
		case "retry_rate":
			if base.RetryAnalysis != nil {
				metricComp.BaseValue = base.RetryAnalysis.RetryRate
			}
			metricComp.HigherIsBetter = false
		case "dlq_rate":
			if base.DeadLetterAnalysis != nil {
				metricComp.BaseValue = base.DeadLetterAnalysis.DeadLetterRate
			}
			metricComp.HigherIsBetter = false
		}

		for _, result := range allResults {
			var value float64
			switch metricName {
			case "success_rate":
				value = result.Summary.SuccessRate
			case "throughput":
				value = result.Summary.ThroughputPerSecond
			case "avg_wait_time":
				if result.JobStats != nil {
					value = result.JobStats.AvgWaitTimeMs
				} else {
					value = result.Summary.AvgWaitTimeMs
				}
			case "max_wait_time":
				value = float64(result.Summary.MaxWaitTimeMs)
			case "peak_backlog":
				value = float64(result.Summary.PeakBacklog)
			case "utilization":
				if result.WorkerStats != nil {
					value = result.WorkerStats.AvgUtilizationRate
				} else {
					value = result.Summary.WorkerUtilization
				}
			case "retry_rate":
				if result.RetryAnalysis != nil {
					value = result.RetryAnalysis.RetryRate
				}
			case "dlq_rate":
				if result.DeadLetterAnalysis != nil {
					value = result.DeadLetterAnalysis.DeadLetterRate
				}
			}
			metricComp.ByConfig[result.ConfigName] = value

			if metricComp.HigherIsBetter {
				if value > metricComp.BestValue {
					metricComp.BestValue = value
				}
				if value < metricComp.WorstValue || metricComp.WorstValue == 0 {
					metricComp.WorstValue = value
				}
			} else {
				if value < metricComp.WorstValue || metricComp.WorstValue == 0 {
					metricComp.WorstValue = value
				}
				if value > metricComp.BestValue {
					metricComp.BestValue = value
				}
			}
		}

		comparison.ByMetric[metricName] = metricComp
	}

	comparison.Tradeoffs = s.identifyTradeoffs(allResults, comparison.ByConfig)

	return comparison
}

func (s *Simulator) calculateConfigScore(comp models.ConfigComparison) float64 {
	score := 0.0

	score += comp.SuccessRate * 30
	score += comp.Throughput * 5
	score += (1.0 - comp.RetryRate) * 15
	score += (1.0 - comp.DLQRate) * 20

	if comp.AvgWaitTimeMs > 0 {
		waitScore := 1.0 - math.Min(comp.AvgWaitTimeMs/60000.0, 1.0)
		score += waitScore * 15
	}

	if comp.PeakBacklog > 0 {
		backlogScore := 1.0 - math.Min(float64(comp.PeakBacklog)/500.0, 1.0)
		score += backlogScore * 15
	}

	return score
}

func (s *Simulator) identifyTradeoffs(
	results []*models.SimulationResult,
	compByConfig map[string]models.ConfigComparison,
) []models.Tradeoff {
	tradeoffs := make([]models.Tradeoff, 0)

	if len(results) < 2 {
		return tradeoffs
	}

	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			resultA := results[i]
			resultB := results[j]

			compA := compByConfig[resultA.ConfigName]
			compB := compByConfig[resultB.ConfigName]

			tradeoffPoints := make(map[string]string)

			if compA.SuccessRate > compB.SuccessRate {
				tradeoffPoints["成功率"] = fmt.Sprintf("%s (%.1f%%) > %s (%.1f%%)", resultA.ConfigName, compA.SuccessRate*100, resultB.ConfigName, compB.SuccessRate*100)
			} else if compB.SuccessRate > compA.SuccessRate {
				tradeoffPoints["成功率"] = fmt.Sprintf("%s (%.1f%%) > %s (%.1f%%)", resultB.ConfigName, compB.SuccessRate*100, resultA.ConfigName, compA.SuccessRate*100)
			}

			if compA.Throughput > compB.Throughput {
				tradeoffPoints["吞吐"] = fmt.Sprintf("%s (%.2f/s) > %s (%.2f/s)", resultA.ConfigName, compA.Throughput, resultB.ConfigName, compB.Throughput)
			} else if compB.Throughput > compA.Throughput {
				tradeoffPoints["吞吐"] = fmt.Sprintf("%s (%.2f/s) > %s (%.2f/s)", resultB.ConfigName, compB.Throughput, resultA.ConfigName, compA.Throughput)
			}

			if compA.AvgWaitTimeMs < compB.AvgWaitTimeMs {
				tradeoffPoints["等待时间"] = fmt.Sprintf("%s (%.0fms) < %s (%.0fms)", resultA.ConfigName, compA.AvgWaitTimeMs, resultB.ConfigName, compB.AvgWaitTimeMs)
			} else if compB.AvgWaitTimeMs < compA.AvgWaitTimeMs {
				tradeoffPoints["等待时间"] = fmt.Sprintf("%s (%.0fms) < %s (%.0fms)", resultB.ConfigName, compB.AvgWaitTimeMs, resultA.ConfigName, compA.AvgWaitTimeMs)
			}

			if compA.PeakBacklog < compB.PeakBacklog {
				tradeoffPoints["峰值积压"] = fmt.Sprintf("%s (%d) < %s (%d)", resultA.ConfigName, compA.PeakBacklog, resultB.ConfigName, compB.PeakBacklog)
			} else if compB.PeakBacklog < compA.PeakBacklog {
				tradeoffPoints["峰值积压"] = fmt.Sprintf("%s (%d) < %s (%d)", resultB.ConfigName, compB.PeakBacklog, resultA.ConfigName, compA.PeakBacklog)
			}

			if len(tradeoffPoints) >= 2 {
				recommendation := resultA.ConfigName
				if compB.Score > compA.Score {
					recommendation = resultB.ConfigName
				}

				tradeoffs = append(tradeoffs, models.Tradeoff{
					Description:    fmt.Sprintf("配置 %s 与 %s 的权衡", resultA.ConfigName, resultB.ConfigName),
					ConfigA:        resultA.ConfigName,
					ConfigB:        resultB.ConfigName,
					TradeoffPoints: tradeoffPoints,
					Recommendation: fmt.Sprintf("综合评分更优的是: %s (评分: %.1f)", recommendation, math.Max(compA.Score, compB.Score)),
				})
			}
		}
	}

	return tradeoffs
}

func (s *Simulator) generateComparisonRecommendations(result *models.ComparisonResult) []models.Recommendation {
	recs := make([]models.Recommendation, 0)
	recID := 1

	bestConfig := result.Summary.BestConfigName
	baseConfig := result.BaseConfigName

	if bestConfig != baseConfig {
		baseComp := result.DetailedComparison.ByConfig[baseConfig]
		bestComp := result.DetailedComparison.ByConfig[bestConfig]

		recs = append(recs, models.Recommendation{
			ID:          fmt.Sprintf("REC-%03d", recID),
			Category:    "comparison",
			Priority:    "high",
			Title:       "推荐切换到更优配置",
			Description: fmt.Sprintf("配置 '%s' 的综合表现优于基准配置 '%s'", bestConfig, baseConfig),
			RootCause:   "参数调优带来了更好的性能",
			Suggestion:  fmt.Sprintf("考虑将线上配置切换到 '%s'", bestConfig),
			Evidence:    fmt.Sprintf("成功率提升 %.1f%%, 吞吐提升 %.2f/s, 综合评分提升 %.1f", (bestComp.SuccessRate-baseComp.SuccessRate)*100, bestComp.Throughput-baseComp.Throughput, bestComp.Score-baseComp.Score),
			Impact:      "预计会显著改善队列性能",
		})
		recID++
	}

	return recs
}

type simJob struct {
	models.Job
}

type simEventType int

const (
	eventTypeEnqueue simEventType = iota
	eventTypeStart
	eventTypeComplete
	eventTypeFail
	eventTypeRetry
	eventTypeTimeout
)

type simEvent struct {
	Time time.Time
	Type simEventType
	Job  *simJob
}

type priorityQueue struct {
	items []*simEvent
	mu    sync.Mutex
}

func (pq *priorityQueue) Len() int {
	return len(pq.items)
}

func (pq *priorityQueue) Less(i, j int) bool {
	return pq.items[i].Time.Before(pq.items[j].Time)
}

func (pq *priorityQueue) Swap(i, j int) {
	pq.items[i], pq.items[j] = pq.items[j], pq.items[i]
}

func (pq *priorityQueue) Push(x interface{}) {
	pq.mu.Lock()
	defer pq.mu.Unlock()

	item := x.(*simEvent)
	pq.items = append(pq.items, item)

	n := len(pq.items) - 1
	for n > 0 {
		parent := (n - 1) / 2
		if pq.Less(parent, n) {
			break
		}
		pq.Swap(parent, n)
		n = parent
	}
}

func (pq *priorityQueue) Pop() interface{} {
	pq.mu.Lock()
	defer pq.mu.Unlock()

	if len(pq.items) == 0 {
		return nil
	}

	item := pq.items[0]
	last := len(pq.items) - 1
	pq.items[0] = pq.items[last]
	pq.items = pq.items[:last]

	n := 0
	for {
		left := 2*n + 1
		right := 2*n + 2
		min := n

		if left < len(pq.items) && pq.Less(left, min) {
			min = left
		}
		if right < len(pq.items) && pq.Less(right, min) {
			min = right
		}
		if min == n {
			break
		}
		pq.Swap(n, min)
		n = min
	}

	return item
}

func (pq *priorityQueue) Peek() *simEvent {
	if len(pq.items) == 0 {
		return nil
	}
	return pq.items[0]
}

type workerPool struct {
	Name         string
	WorkerCount  int
	Concurrency  int
	BatchSize    int
	PollInterval time.Duration
	ActiveSlots  int
}

type retryEntry struct {
	JobID         string
	ScheduledTime time.Time
	RetryCount    int
}

type SimAnalyzer struct {
	*analyzer.Analyzer
}

func NewSimAnalyzer() *SimAnalyzer {
	return &SimAnalyzer{
		Analyzer: analyzer.NewAnalyzer(),
	}
}
