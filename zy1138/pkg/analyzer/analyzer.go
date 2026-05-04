package analyzer

import (
	"fmt"
	"sort"
	"time"

	"queue-analyzer/pkg/models"
)

type Analyzer struct {
}

func NewAnalyzer() *Analyzer {
	return &Analyzer{}
}

func (a *Analyzer) Analyze(data *models.ImportedData, config *models.AnalysisConfig) (*models.AnalysisResult, error) {
	startTime := time.Now()

	result := &models.AnalysisResult{
		Name:            "queue-analysis",
		AnalysisTime:    time.Now(),
		Recommendations: make([]models.Recommendation, 0),
		Anomalies:       make([]models.Anomaly, 0),
	}

	if config == nil {
		config = &models.AnalysisConfig{
			Percentiles: []float64{50, 95, 99},
		}
	}

	var startAt, endAt time.Time
	if config.StartAt != nil {
		startAt = *config.StartAt
	}
	if config.EndAt != nil {
		endAt = *config.EndAt
	}

	filteredJobs, filteredEvents := a.filterData(data.Jobs, data.Events, startAt, endAt, config.JobTypes)

	timeRange := a.determineTimeRange(filteredJobs, filteredEvents)
	result.TimeRange = timeRange

	jobStats := a.calculateJobStats(filteredJobs, config.Percentiles)
	result.JobStats = jobStats

	workerStats := a.calculateWorkerStats(data.Workers)
	result.WorkerStats = workerStats

	backlogAnalysis := a.analyzeBacklog(filteredJobs, filteredEvents)
	result.BacklogAnalysis = backlogAnalysis

	retryAnalysis := a.analyzeRetries(filteredJobs, filteredEvents)
	result.RetryAnalysis = retryAnalysis

	priorityAnalysis := a.analyzePriority(filteredJobs, filteredEvents)
	result.PriorityAnalysis = priorityAnalysis

	deadLetterAnalysis := a.analyzeDeadLetter(filteredJobs)
	result.DeadLetterAnalysis = deadLetterAnalysis

	timeoutAnalysis := a.analyzeTimeouts(filteredJobs, filteredEvents)
	result.TimeoutAnalysis = timeoutAnalysis

	result.Summary = a.buildSummary(filteredJobs, data.Workers, jobStats, backlogAnalysis, startTime)

	result.Recommendations = a.generateRecommendations(
		jobStats, workerStats, backlogAnalysis, retryAnalysis,
		priorityAnalysis, deadLetterAnalysis, timeoutAnalysis,
	)

	result.Anomalies = a.detectAnomalies(
		filteredJobs, filteredEvents, backlogAnalysis, retryAnalysis,
		priorityAnalysis, timeoutAnalysis,
	)

	return result, nil
}

func (a *Analyzer) filterData(
	jobs []*models.Job,
	events []*models.QueueEvent,
	startAt, endAt time.Time,
	jobTypes []string,
) ([]*models.Job, []*models.QueueEvent) {
	jobTypeSet := make(map[string]struct{})
	for _, jt := range jobTypes {
		jobTypeSet[jt] = struct{}{}
	}

	filteredJobs := make([]*models.Job, 0)
	for _, job := range jobs {
		if len(jobTypes) > 0 {
			if _, ok := jobTypeSet[job.Type]; !ok {
				continue
			}
		}

		if !startAt.IsZero() && job.EnqueueTime.Before(startAt) {
			continue
		}
		if !endAt.IsZero() {
			if job.EndTime != nil && job.EndTime.After(endAt) {
				continue
			}
			if job.EndTime == nil && job.EnqueueTime.After(endAt) {
				continue
			}
		}

		filteredJobs = append(filteredJobs, job)
	}

	filteredEvents := make([]*models.QueueEvent, 0)
	for _, event := range events {
		if !startAt.IsZero() && event.Timestamp.Before(startAt) {
			continue
		}
		if !endAt.IsZero() && event.Timestamp.After(endAt) {
			continue
		}
		filteredEvents = append(filteredEvents, event)
	}

	return filteredJobs, filteredEvents
}

func (a *Analyzer) determineTimeRange(jobs []*models.Job, events []*models.QueueEvent) models.TimeRange {
	var earliest, latest time.Time

	for _, job := range jobs {
		if earliest.IsZero() || job.EnqueueTime.Before(earliest) {
			earliest = job.EnqueueTime
		}
		if job.EndTime != nil {
			if latest.IsZero() || job.EndTime.After(latest) {
				latest = *job.EndTime
			}
		} else {
			if latest.IsZero() || job.EnqueueTime.After(latest) {
				latest = job.EnqueueTime
			}
		}
	}

	for _, event := range events {
		if earliest.IsZero() || event.Timestamp.Before(earliest) {
			earliest = event.Timestamp
		}
		if latest.IsZero() || event.Timestamp.After(latest) {
			latest = event.Timestamp
		}
	}

	if earliest.IsZero() {
		earliest = time.Now().Add(-1 * time.Hour)
	}
	if latest.IsZero() {
		latest = time.Now()
	}

	return models.TimeRange{
		Start: earliest,
		End:   latest,
	}
}

func (a *Analyzer) calculateJobStats(jobs []*models.Job, percentiles []float64) *models.JobStatistics {
	stats := &models.JobStatistics{
		ByType:     make(map[string]int64),
		ByStatus:   make(map[models.JobStatus]int64),
		ByPriority: make(map[int]int64),
	}

	if len(jobs) == 0 {
		return stats
	}

	executionTimes := make([]float64, 0)
	waitTimes := make([]float64, 0)
	retryCounts := make([]int, 0)
	successCount := int64(0)
	totalRetryCount := 0

	for _, job := range jobs {
		stats.TotalJobs++
		stats.ByType[job.Type]++
		stats.ByStatus[job.Status]++
		stats.ByPriority[job.Priority]++

		if job.Status == models.JobStatusSucceeded || job.Status == models.JobStatusCompleted {
			successCount++
		}

		if job.ExecutionTimeMs > 0 {
			executionTimes = append(executionTimes, float64(job.ExecutionTimeMs))
			stats.AvgExecutionTimeMs += float64(job.ExecutionTimeMs)
		}

		if job.WaitTimeMs > 0 {
			waitTimes = append(waitTimes, float64(job.WaitTimeMs))
			stats.AvgWaitTimeMs += float64(job.WaitTimeMs)
		}

		if job.RetryCount > 0 {
			retryCounts = append(retryCounts, job.RetryCount)
			totalRetryCount += job.RetryCount
		}

		if job.RetryCount > stats.MaxRetryCount {
			stats.MaxRetryCount = job.RetryCount
		}

		if job.Status == models.JobStatusDeadLetter {
			stats.DeadLetterCount++
		}

		if job.FailReason == "timeout" || job.ExecutionTimeMs >= job.TimeoutMs {
			stats.TimeoutCount++
		}
	}

	if len(executionTimes) > 0 {
		stats.AvgExecutionTimeMs /= float64(len(executionTimes))
		sort.Float64s(executionTimes)
		stats.P50ExecutionTimeMs = a.percentile(executionTimes, 50)
		stats.P95ExecutionTimeMs = a.percentile(executionTimes, 95)
		stats.P99ExecutionTimeMs = a.percentile(executionTimes, 99)
	}

	if len(waitTimes) > 0 {
		stats.AvgWaitTimeMs /= float64(len(waitTimes))
		sort.Float64s(waitTimes)
		stats.P50WaitTimeMs = a.percentile(waitTimes, 50)
		stats.P95WaitTimeMs = a.percentile(waitTimes, 95)
		stats.P99WaitTimeMs = a.percentile(waitTimes, 99)
	}

	if len(retryCounts) > 0 {
		stats.AvgRetryCount = float64(totalRetryCount) / float64(len(retryCounts))
	}

	if stats.TotalJobs > 0 {
		stats.SuccessRate = float64(successCount) / float64(stats.TotalJobs)
	}

	return stats
}

func (a *Analyzer) calculateWorkerStats(workers []*models.Worker) *models.WorkerStatistics {
	stats := &models.WorkerStatistics{
		ByStatus:    make(map[models.WorkerStatus]int),
		ByQueueType: make(map[string]int),
	}

	if len(workers) == 0 {
		return stats
	}

	stats.TotalWorkers = len(workers)

	for _, worker := range workers {
		stats.ByStatus[worker.Status]++

		for _, qt := range worker.QueueTypes {
			stats.ByQueueType[qt]++
		}

		stats.AvgConcurrency += float64(worker.Concurrency)
		stats.TotalConcurrency += worker.Concurrency
		stats.AvgBatchSize += float64(worker.BatchSize)
		stats.AvgPollIntervalMs += float64(worker.PollInterval.Milliseconds())

		switch worker.Status {
		case models.WorkerStatusIdle:
			stats.IdleWorkers++
		case models.WorkerStatusBusy:
			stats.BusyWorkers++
		case models.WorkerStatusBlocked:
			stats.BlockedWorkers++
		}
	}

	stats.AvgConcurrency /= float64(len(workers))
	stats.AvgBatchSize /= float64(len(workers))
	stats.AvgPollIntervalMs /= float64(len(workers))

	return stats
}

func (a *Analyzer) analyzeBacklog(jobs []*models.Job, events []*models.QueueEvent) *models.BacklogAnalysis {
	analysis := &models.BacklogAnalysis{
		BacklogByPriority: make(map[int]models.BacklogTrend),
		BacklogByQueue:    make(map[string]models.BacklogTrend),
		BacklogByJobType:  make(map[string]models.BacklogTrend),
	}

	if len(jobs) == 0 && len(events) == 0 {
		return analysis
	}

	eventByJob := make(map[string][]*models.QueueEvent)
	for _, event := range events {
		eventByJob[event.JobID] = append(eventByJob[event.JobID], event)
	}

	sortedJobs := make([]*models.Job, len(jobs))
	copy(sortedJobs, jobs)
	sort.Slice(sortedJobs, func(i, j int) bool {
		return sortedJobs[i].EnqueueTime.Before(sortedJobs[j].EnqueueTime)
	})

	var totalBacklog int64
	var maxBacklog int64
	var peakTime time.Time
	backlogSamples := make([]models.BacklogSample, 0)
	backlogByPriority := make(map[int]int64)
	backlogByJobType := make(map[string]int64)

	currentBacklog := int64(0)
	allEvents := make([]struct {
		time time.Time
		job  *models.Job
		typ  string
	}, 0)

	for _, job := range sortedJobs {
		allEvents = append(allEvents, struct {
			time time.Time
			job  *models.Job
			typ  string
		}{job.EnqueueTime, job, "enqueue"})

		if job.EndTime != nil {
			allEvents = append(allEvents, struct {
				time time.Time
				job  *models.Job
				typ  string
			}{*job.EndTime, job, "complete"})
		}
	}

	sort.Slice(allEvents, func(i, j int) bool {
		return allEvents[i].time.Before(allEvents[j].time)
	})

	lastSampleTime := time.Time{}
	sampleInterval := 1 * time.Minute

	for _, evt := range allEvents {
		if evt.typ == "enqueue" {
			currentBacklog++
			backlogByPriority[evt.job.Priority]++
			backlogByJobType[evt.job.Type]++
		} else {
			currentBacklog--
			backlogByPriority[evt.job.Priority]--
			backlogByJobType[evt.job.Type]--
		}

		if currentBacklog > maxBacklog {
			maxBacklog = currentBacklog
			peakTime = evt.time
		}

		totalBacklog += currentBacklog

		if lastSampleTime.IsZero() || evt.time.Sub(lastSampleTime) >= sampleInterval {
			backlogSamples = append(backlogSamples, models.BacklogSample{
				Timestamp: evt.time,
				Count:     currentBacklog,
			})
			lastSampleTime = evt.time
		}
	}

	analysis.PeakBacklog = maxBacklog
	analysis.PeakTime = peakTime

	if len(allEvents) > 0 {
		analysis.AvgBacklog = float64(totalBacklog) / float64(len(allEvents))
	}

	if len(backlogSamples) >= 2 {
		firstSample := backlogSamples[0]
		lastSample := backlogSamples[len(backlogSamples)-1]
		timeDiff := lastSample.Timestamp.Sub(firstSample.Timestamp).Hours()
		if timeDiff > 0 {
			analysis.BacklogGrowthRate = (float64(lastSample.Count) - float64(firstSample.Count)) / timeDiff
		}
	}

	for p, count := range backlogByPriority {
		trend := models.BacklogTrend{
			Peak: count,
			Avg:  float64(count),
		}
		analysis.BacklogByPriority[p] = trend
	}

	for jt, count := range backlogByJobType {
		trend := models.BacklogTrend{
			Peak: count,
			Avg:  float64(count),
		}
		analysis.BacklogByJobType[jt] = trend
	}

	if currentBacklog == 0 && maxBacklog > 0 && !peakTime.IsZero() {
		resolvedTime := allEvents[len(allEvents)-1].time.Sub(peakTime)
		analysis.BacklogResolvedTime = &resolvedTime
	}

	return analysis
}

func (a *Analyzer) analyzeRetries(jobs []*models.Job, events []*models.QueueEvent) *models.RetryAnalysis {
	analysis := &models.RetryAnalysis{
		RetryByReason:  make(map[string]int64),
		RetryByJobType: make(map[string]models.RetryStats),
	}

	if len(jobs) == 0 {
		return analysis
	}

	retryEvents := make([]*models.QueueEvent, 0)
	for _, event := range events {
		if event.EventType == models.EventTypeRetry {
			retryEvents = append(retryEvents, event)
			analysis.TotalRetryEvents++
		}
	}

	jobsWithRetries := 0
	totalRetryCount := 0
	totalRetryInterval := int64(0)
	retryIntervalCount := 0

	jobRetryMap := make(map[string]int)
	jobFailTimeMap := make(map[string]time.Time)

	for _, event := range events {
		switch event.EventType {
		case models.EventTypeFail:
			jobFailTimeMap[event.JobID] = event.Timestamp
			if event.ErrorMessage != "" {
				analysis.RetryByReason[event.ErrorMessage]++
			}
		case models.EventTypeRetry:
			jobRetryMap[event.JobID]++
			if failTime, ok := jobFailTimeMap[event.JobID]; ok {
				interval := event.Timestamp.Sub(failTime).Milliseconds()
				if interval > 0 {
					totalRetryInterval += interval
					retryIntervalCount++
				}
			}
		}
	}

	for _, job := range jobs {
		if job.RetryCount > 0 {
			jobsWithRetries++
			totalRetryCount += job.RetryCount

			if job.RetryCount > analysis.MaxRetryCount {
				analysis.MaxRetryCount = job.RetryCount
			}

			stats := analysis.RetryByJobType[job.Type]
			stats.TotalRetries += int64(job.RetryCount)
			stats.AvgCount = float64(stats.TotalRetries)
			if job.Status == models.JobStatusSucceeded || job.Status == models.JobStatusCompleted {
				stats.SuccessRate++
			}
			analysis.RetryByJobType[job.Type] = stats
		}
	}

	if len(jobs) > 0 {
		analysis.RetryRate = float64(jobsWithRetries) / float64(len(jobs))
	}

	if jobsWithRetries > 0 {
		analysis.AvgRetryCount = float64(totalRetryCount) / float64(jobsWithRetries)
	}

	if retryIntervalCount > 0 {
		analysis.AvgRetryIntervalMs = float64(totalRetryInterval) / float64(retryIntervalCount)
	}

	analysis.RetryStormIndicators = a.detectRetryStorms(events)

	return analysis
}

func (a *Analyzer) detectRetryStorms(events []*models.QueueEvent) []models.RetryStormIndicator {
	indicators := make([]models.RetryStormIndicator, 0)
	if len(events) < 2 {
		return indicators
	}

	retryEvents := make([]*models.QueueEvent, 0)
	for _, event := range events {
		if event.EventType == models.EventTypeRetry || event.EventType == models.EventTypeFail {
			retryEvents = append(retryEvents, event)
		}
	}

	if len(retryEvents) == 0 {
		return indicators
	}

	sort.Slice(retryEvents, func(i, j int) bool {
		return retryEvents[i].Timestamp.Before(retryEvents[j].Timestamp)
	})

	stormThreshold := 10
	timeWindow := 30 * time.Second

	var currentStormStart time.Time
	var currentStormEnd time.Time
	var currentStormCount int64
	affectedJobs := make(map[string]struct{})

	for i, event := range retryEvents {
		if currentStormStart.IsZero() {
			currentStormStart = event.Timestamp
			currentStormCount = 1
			affectedJobs = map[string]struct{}{event.JobID: {}}
			continue
		}

		timeDiff := event.Timestamp.Sub(currentStormStart)
		if timeDiff <= timeWindow {
			currentStormCount++
			affectedJobs[event.JobID] = struct{}{}
			currentStormEnd = event.Timestamp
		} else {
			if currentStormCount >= int64(stormThreshold) {
				severity := "low"
				if currentStormCount >= 50 {
					severity = "high"
				} else if currentStormCount >= 25 {
					severity = "medium"
				}

				indicators = append(indicators, models.RetryStormIndicator{
					StartTime:    currentStormStart,
					EndTime:      currentStormEnd,
					RetryCount:   currentStormCount,
					AffectedJobs: int64(len(affectedJobs)),
					Severity:     severity,
					Reason:       "High concentration of retry/fail events in short time window",
				})
			}

			currentStormStart = event.Timestamp
			currentStormCount = 1
			affectedJobs = map[string]struct{}{event.JobID: {}}
			currentStormEnd = time.Time{}
		}

		if i == len(retryEvents)-1 && currentStormCount >= int64(stormThreshold) {
			severity := "low"
			if currentStormCount >= 50 {
				severity = "high"
			} else if currentStormCount >= 25 {
				severity = "medium"
			}

			indicators = append(indicators, models.RetryStormIndicator{
				StartTime:    currentStormStart,
				EndTime:      currentStormEnd,
				RetryCount:   currentStormCount,
				AffectedJobs: int64(len(affectedJobs)),
				Severity:     severity,
				Reason:       "High concentration of retry/fail events in short time window",
			})
		}
	}

	return indicators
}

func (a *Analyzer) analyzePriority(jobs []*models.Job, events []*models.QueueEvent) *models.PriorityAnalysis {
	analysis := &models.PriorityAnalysis{
		PriorityDistribution: make(map[int]models.PriorityStats),
		WaitTimeByPriority:   make(map[int]models.WaitTimeStats),
	}

	if len(jobs) == 0 {
		return analysis
	}

	priorities := make(map[int]struct{})
	for _, job := range jobs {
		priorities[job.Priority] = struct{}{}
	}

	analysis.HasPrioritySystem = len(priorities) > 1

	waitTimesByPriority := make(map[int][]float64)
	successCountByPriority := make(map[int]int64)
	totalCountByPriority := make(map[int]int64)
	totalWaitTimeByPriority := make(map[int]float64)
	maxWaitTimeByPriority := make(map[int]int64)

	for _, job := range jobs {
		p := job.Priority
		totalCountByPriority[p]++

		if job.Status == models.JobStatusSucceeded || job.Status == models.JobStatusCompleted {
			successCountByPriority[p]++
		}

		if job.WaitTimeMs > 0 {
			waitTimesByPriority[p] = append(waitTimesByPriority[p], float64(job.WaitTimeMs))
			totalWaitTimeByPriority[p] += float64(job.WaitTimeMs)
			if job.WaitTimeMs > maxWaitTimeByPriority[p] {
				maxWaitTimeByPriority[p] = job.WaitTimeMs
			}
		}
	}

	for p, total := range totalCountByPriority {
		stats := models.PriorityStats{
			TotalJobs: total,
		}
		if total > 0 {
			stats.SuccessRate = float64(successCountByPriority[p]) / float64(total)
		}
		if count := len(waitTimesByPriority[p]); count > 0 {
			stats.AvgWaitTimeMs = totalWaitTimeByPriority[p] / float64(count)
		}
		analysis.PriorityDistribution[p] = stats

		waitTimes := waitTimesByPriority[p]
		if len(waitTimes) > 0 {
			sort.Float64s(waitTimes)
			wtStats := models.WaitTimeStats{
				AvgMs: totalWaitTimeByPriority[p] / float64(len(waitTimes)),
				P50Ms: a.percentile(waitTimes, 50),
				P95Ms: a.percentile(waitTimes, 95),
				P99Ms: a.percentile(waitTimes, 99),
				MaxMs: maxWaitTimeByPriority[p],
			}
			analysis.WaitTimeByPriority[p] = wtStats
		}
	}

	analysis.PriorityInversionCases = a.detectPriorityInversion(jobs, events)
	analysis.StarvationIndicators = a.detectStarvation(jobs, events)

	return analysis
}

func (a *Analyzer) detectPriorityInversion(jobs []*models.Job, events []*models.QueueEvent) []models.PriorityInversionCase {
	cases := make([]models.PriorityInversionCase, 0)
	if len(jobs) < 2 {
		return cases
	}

	highPriorityThreshold := 5

	highPriorityJobs := make([]*models.Job, 0)
	lowPriorityJobs := make([]*models.Job, 0)

	for _, job := range jobs {
		if job.Priority >= highPriorityThreshold {
			highPriorityJobs = append(highPriorityJobs, job)
		} else {
			lowPriorityJobs = append(lowPriorityJobs, job)
		}
	}

	for _, hpJob := range highPriorityJobs {
		if hpJob.WaitTimeMs <= 0 {
			continue
		}

		for _, lpJob := range lowPriorityJobs {
			if lpJob.StartTime == nil {
				continue
			}

			hpEnqueue := hpJob.EnqueueTime
			lpStart := *lpJob.StartTime

			if hpEnqueue.Before(lpStart) && hpJob.WaitTimeMs > 10000 {
				if lpJob.ExecutionTimeMs > 5000 {
					severity := "low"
					if hpJob.WaitTimeMs > 60000 {
						severity = "high"
					} else if hpJob.WaitTimeMs > 30000 {
						severity = "medium"
					}

					cases = append(cases, models.PriorityInversionCase{
						Timestamp:          hpEnqueue,
						HighPriorityJobID:  hpJob.ID,
						LowPriorityJobID:   lpJob.ID,
						HighPriority:       hpJob.Priority,
						LowPriority:        lpJob.Priority,
						HighPriorityWaitMs: hpJob.WaitTimeMs,
						LowPriorityExecMs:  lpJob.ExecutionTimeMs,
						Severity:           severity,
					})
				}
			}
		}
	}

	return cases
}

func (a *Analyzer) detectStarvation(jobs []*models.Job, events []*models.QueueEvent) []models.StarvationIndicator {
	indicators := make([]models.StarvationIndicator, 0)
	if len(jobs) == 0 {
		return indicators
	}

	byPriority := make(map[int][]*models.Job)
	for _, job := range jobs {
		byPriority[job.Priority] = append(byPriority[job.Priority], job)
	}

	for p, pJobs := range byPriority {
		if p >= 5 {
			continue
		}

		queuedCount := int64(0)
		processedCount := int64(0)
		maxWaitTime := int64(0)

		for _, job := range pJobs {
			if job.Status == models.JobStatusPending {
				queuedCount++
			} else {
				processedCount++
			}

			if job.WaitTimeMs > maxWaitTime {
				maxWaitTime = job.WaitTimeMs
			}
		}

		if queuedCount > processedCount && maxWaitTime > 60000 {
			indicators = append(indicators, models.StarvationIndicator{
				PriorityLevel:      p,
				WaitTimeMs:         maxWaitTime,
				QueuedJobsCount:    queuedCount,
				ProcessedJobsCount: processedCount,
			})
		}
	}

	return indicators
}

func (a *Analyzer) analyzeDeadLetter(jobs []*models.Job) *models.DeadLetterAnalysis {
	analysis := &models.DeadLetterAnalysis{
		ByReason:   make(map[string]int64),
		ByJobType:  make(map[string]int64),
		ByPriority: make(map[int]int64),
	}

	dlqJobs := make([]*models.Job, 0)
	for _, job := range jobs {
		if job.Status == models.JobStatusDeadLetter {
			analysis.TotalDeadLetterJobs++
			dlqJobs = append(dlqJobs, job)
			analysis.AvgRetryBeforeDLQ += float64(job.RetryCount)

			if job.FailReason != "" {
				analysis.ByReason[job.FailReason]++
			}
			analysis.ByJobType[job.Type]++
			analysis.ByPriority[job.Priority]++
		}
	}

	if analysis.TotalDeadLetterJobs > 0 {
		analysis.AvgRetryBeforeDLQ /= float64(analysis.TotalDeadLetterJobs)
	}

	if len(jobs) > 0 {
		analysis.DeadLetterRate = float64(analysis.TotalDeadLetterJobs) / float64(len(jobs))
	}

	sort.Slice(dlqJobs, func(i, j int) bool {
		if dlqJobs[i].EndTime == nil {
			return false
		}
		if dlqJobs[j].EndTime == nil {
			return true
		}
		return dlqJobs[i].EndTime.After(*dlqJobs[j].EndTime)
	})

	recentCount := min(10, len(dlqJobs))
	analysis.RecentDeadLetters = make([]models.DeadLetterJob, recentCount)
	for i := 0; i < recentCount; i++ {
		job := dlqJobs[i]
		endTime := time.Now()
		if job.EndTime != nil {
			endTime = *job.EndTime
		}
		analysis.RecentDeadLetters[i] = models.DeadLetterJob{
			JobID:          job.ID,
			JobType:        job.Type,
			Priority:       job.Priority,
			FailReason:     job.FailReason,
			RetryCount:     job.RetryCount,
			DeadLetterTime: endTime,
		}
	}

	return analysis
}

func (a *Analyzer) analyzeTimeouts(jobs []*models.Job, events []*models.QueueEvent) *models.TimeoutAnalysis {
	analysis := &models.TimeoutAnalysis{
		ByJobType:          make(map[string]int64),
		ByTimeoutThreshold: make(map[string]models.TimeoutStats),
	}

	if len(jobs) == 0 {
		return analysis
	}

	for _, job := range jobs {
		if job.ExecutionTimeMs >= job.TimeoutMs || job.FailReason == "timeout" {
			analysis.TotalTimeouts++
			analysis.ByJobType[job.Type]++

			key := string(job.Type)
			stats := analysis.ByTimeoutThreshold[key]
			stats.ThresholdMs = job.TimeoutMs
			stats.Count++
			stats.AvgExecMs += float64(job.ExecutionTimeMs)
			analysis.ByTimeoutThreshold[key] = stats
		}
	}

	for key, stats := range analysis.ByTimeoutThreshold {
		if stats.Count > 0 {
			stats.AvgExecMs /= float64(stats.Count)
			analysis.ByTimeoutThreshold[key] = stats
		}
	}

	if len(jobs) > 0 {
		analysis.TimeoutRate = float64(analysis.TotalTimeouts) / float64(len(jobs))
	}

	return analysis
}

func (a *Analyzer) buildSummary(
	jobs []*models.Job,
	workers []*models.Worker,
	jobStats *models.JobStatistics,
	backlog *models.BacklogAnalysis,
	startTime time.Time,
) models.AnalysisSummary {
	summary := models.AnalysisSummary{
		TotalJobs:          jobStats.TotalJobs,
		TotalWorkers:       len(workers),
		SuccessRate:        jobStats.SuccessRate,
		MaxBacklog:         backlog.PeakBacklog,
		AnalysisDurationMs: time.Since(startTime).Milliseconds(),
	}

	summary.MaxWaitTimeMs = int64(jobStats.P99WaitTimeMs)

	if len(jobs) > 0 {
		var earliest, latest time.Time
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
		}

		duration := latest.Sub(earliest)
		if duration.Seconds() > 0 {
			summary.AvgThroughputPerSec = float64(jobStats.TotalJobs) / duration.Seconds()
		}
	}

	return summary
}

func (a *Analyzer) generateRecommendations(
	jobStats *models.JobStatistics,
	workerStats *models.WorkerStatistics,
	backlog *models.BacklogAnalysis,
	retry *models.RetryAnalysis,
	priority *models.PriorityAnalysis,
	deadLetter *models.DeadLetterAnalysis,
	timeout *models.TimeoutAnalysis,
) []models.Recommendation {
	recs := make([]models.Recommendation, 0)
	recID := 1

	if backlog.PeakBacklog > 100 {
		recs = append(recs, models.Recommendation{
			ID:          fmt.Sprintf("REC-%03d", recID),
			Category:    "concurrency",
			Priority:    "high",
			Title:       "考虑增加 Worker 并发数",
			Description: "高峰期队列积压严重，峰值积压超过 100",
			RootCause:   "当前 Worker 并发能力不足以处理峰值流量",
			Suggestion:  fmt.Sprintf("建议将 Worker 并发数增加 50%%-100%%，当前峰值积压: %d", backlog.PeakBacklog),
			Evidence:    fmt.Sprintf("峰值积压 %d 发生在 %s", backlog.PeakBacklog, backlog.PeakTime.Format(time.RFC3339)),
			Impact:      "减少队列等待时间，避免任务堆积",
		})
		recID++
	}

	if jobStats.P99WaitTimeMs > 60000 {
		recs = append(recs, models.Recommendation{
			ID:          fmt.Sprintf("REC-%03d", recID),
			Category:    "latency",
			Priority:    "high",
			Title:       "P99 等待时间过长",
			Description: fmt.Sprintf("P99 等待时间达到 %.0fms，超过 1 分钟阈值", jobStats.P99WaitTimeMs),
			RootCause:   "Worker 处理能力不足或优先级调度不合理",
			Suggestion:  "检查高优先级任务是否被低优先级任务阻塞，考虑增加 Worker 或优化批处理",
			Evidence:    fmt.Sprintf("P99 等待时间: %.0fms, P95: %.0fms, P50: %.0fms", jobStats.P99WaitTimeMs, jobStats.P95WaitTimeMs, jobStats.P50WaitTimeMs),
			Impact:      "严重影响实时性要求高的任务",
		})
		recID++
	}

	if len(retry.RetryStormIndicators) > 0 {
		for _, storm := range retry.RetryStormIndicators {
			recs = append(recs, models.Recommendation{
				ID:          fmt.Sprintf("REC-%03d", recID),
				Category:    "retry",
				Priority:    "high",
				Title:       "检测到重试风暴",
				Description: fmt.Sprintf("%s 级重试风暴：%d 次重试事件影响 %d 个任务", storm.Severity, storm.RetryCount, storm.AffectedJobs),
				RootCause:   "重试间隔太短，或同一批任务同时失败并立即重试",
				Suggestion:  "增加重试间隔，使用指数退避（exponential backoff）+ 抖动（jitter）",
				Evidence:    fmt.Sprintf("时间窗口: %s - %s, 重试次数: %d", storm.StartTime.Format(time.RFC3339), storm.EndTime.Format(time.RFC3339), storm.RetryCount),
				Impact:      "重试风暴会占用大量 Worker 资源，加剧系统负载",
			})
			recID++
		}
	}

	if retry.AvgRetryIntervalMs > 0 && retry.AvgRetryIntervalMs < 1000 {
		recs = append(recs, models.Recommendation{
			ID:          fmt.Sprintf("REC-%03d", recID),
			Category:    "retry",
			Priority:    "medium",
			Title:       "重试间隔过短",
			Description: fmt.Sprintf("平均重试间隔仅 %.0fms，建议至少 1-5 秒", retry.AvgRetryIntervalMs),
			RootCause:   "重试策略配置过于激进",
			Suggestion:  "将初始重试间隔设为 1-5 秒，使用指数退避逐步增加",
			Evidence:    fmt.Sprintf("当前平均重试间隔: %.0fms", retry.AvgRetryIntervalMs),
			Impact:      "短重试间隔可能导致重试风暴",
		})
		recID++
	}

	if len(priority.PriorityInversionCases) > 0 {
		for _, inv := range priority.PriorityInversionCases {
			recs = append(recs, models.Recommendation{
				ID:          fmt.Sprintf("REC-%03d", recID),
				Category:    "priority",
				Priority:    "high",
				Title:       "检测到优先级反转",
				Description: fmt.Sprintf("%s 级优先级反转：高优先级任务等待 %dms，低优先级任务执行 %dms", inv.Severity, inv.HighPriorityWaitMs, inv.LowPriorityExecMs),
				RootCause:   "低优先级长时间任务阻塞了高优先级任务",
				Suggestion:  "考虑将长时间运行的任务拆分，或设置专门的高优先级 Worker 池",
				Evidence:    fmt.Sprintf("高优先级任务 %s (优先级 %d) 等待 %dms，期间低优先级任务 %s (优先级 %d) 在执行", inv.HighPriorityJobID, inv.HighPriority, inv.HighPriorityWaitMs, inv.LowPriorityJobID, inv.LowPriority),
				Impact:      "高优先级任务无法及时处理，影响关键业务",
			})
			recID++
		}
	}

	if len(priority.StarvationIndicators) > 0 {
		for _, starv := range priority.StarvationIndicators {
			recs = append(recs, models.Recommendation{
				ID:          fmt.Sprintf("REC-%03d", recID),
				Category:    "priority",
				Priority:    "medium",
				Title:       "检测到低优先级任务饥饿",
				Description: fmt.Sprintf("优先级 %d 的任务等待时间过长：%dms", starv.PriorityLevel, starv.WaitTimeMs),
				RootCause:   "高优先级任务持续占用 Worker，低优先级任务无法获得处理机会",
				Suggestion:  "设置优先级配额（如高优先级占用 70%% 资源，低优先级 30%%），或定期提升等待太久的任务优先级",
				Evidence:    fmt.Sprintf("优先级 %d: 排队 %d 个，已处理 %d 个，最大等待时间 %dms", starv.PriorityLevel, starv.QueuedJobsCount, starv.ProcessedJobsCount, starv.WaitTimeMs),
				Impact:      "低优先级任务可能永远无法处理，或处理延迟不可接受",
			})
			recID++
		}
	}

	if deadLetter.TotalDeadLetterJobs > 0 {
		recs = append(recs, models.Recommendation{
			ID:          fmt.Sprintf("REC-%03d", recID),
			Category:    "deadletter",
			Priority:    "high",
			Title:       "存在死信任务",
			Description: fmt.Sprintf("共有 %d 个任务进入死信队列，死信率 %.2f%%", deadLetter.TotalDeadLetterJobs, deadLetter.DeadLetterRate*100),
			RootCause:   "任务经过多次重试后仍然失败",
			Suggestion:  "检查死信任务的失败原因，评估是否需要修复代码、增加重试次数或调整超时时间",
			Evidence:    fmt.Sprintf("平均重试次数: %.1f, 主要失败原因: %v", deadLetter.AvgRetryBeforeDLQ, deadLetter.ByReason),
			Impact:      "这些任务没有被正常处理，可能影响业务数据一致性",
		})
		recID++
	}

	if timeout.TotalTimeouts > 0 {
		recs = append(recs, models.Recommendation{
			ID:          fmt.Sprintf("REC-%03d", recID),
			Category:    "timeout",
			Priority:    "medium",
			Title:       "存在超时任务",
			Description: fmt.Sprintf("共有 %d 个任务超时，超时率 %.2f%%", timeout.TotalTimeouts, timeout.TimeoutRate*100),
			RootCause:   "任务执行时间超过配置的超时阈值",
			Suggestion:  "分析超时任务的类型，考虑增加超时时间或优化任务执行逻辑",
			Evidence:    fmt.Sprintf("超时任务按类型分布: %v", timeout.ByJobType),
			Impact:      "超时可能导致任务被错误重试，或状态不一致",
		})
		recID++
	}

	if workerStats.IdleWorkers > 0 && backlog.PeakBacklog > 50 {
		recs = append(recs, models.Recommendation{
			ID:          fmt.Sprintf("REC-%03d", recID),
			Category:    "scheduling",
			Priority:    "medium",
			Title:       "Worker 利用率不均",
			Description: fmt.Sprintf("存在 %d 个空闲 Worker，但队列峰值积压 %d", workerStats.IdleWorkers, backlog.PeakBacklog),
			RootCause:   "可能是 Worker 只处理特定队列类型，或任务分配不均",
			Suggestion:  "检查 Worker 的队列类型绑定，考虑让 Worker 可以处理多个队列，或动态调整 Worker 分配",
			Evidence:    fmt.Sprintf("空闲 Worker: %d, 繁忙 Worker: %d, 峰值积压: %d", workerStats.IdleWorkers, workerStats.BusyWorkers, backlog.PeakBacklog),
			Impact:      "资源浪费，同时任务积压",
		})
		recID++
	}

	if jobStats.P99ExecutionTimeMs > jobStats.P95ExecutionTimeMs*3 {
		recs = append(recs, models.Recommendation{
			ID:          fmt.Sprintf("REC-%03d", recID),
			Category:    "execution",
			Priority:    "medium",
			Title:       "执行时间方差过大",
			Description: fmt.Sprintf("P99 执行时间 (%.0fms) 是 P95 (%.0fms) 的 3 倍以上", jobStats.P99ExecutionTimeMs, jobStats.P95ExecutionTimeMs),
			RootCause:   "存在少数异常耗时的任务，或任务执行时间波动大",
			Suggestion:  "分析慢任务的原因，考虑将大任务拆分，或设置更合理的超时时间",
			Evidence:    fmt.Sprintf("P50: %.0fms, P95: %.0fms, P99: %.0fms", jobStats.P50ExecutionTimeMs, jobStats.P95ExecutionTimeMs, jobStats.P99ExecutionTimeMs),
			Impact:      "慢任务可能阻塞 Worker，影响整体吞吐",
		})
		recID++
	}

	return recs
}

func (a *Analyzer) detectAnomalies(
	jobs []*models.Job,
	events []*models.QueueEvent,
	backlog *models.BacklogAnalysis,
	retry *models.RetryAnalysis,
	priority *models.PriorityAnalysis,
	timeout *models.TimeoutAnalysis,
) []models.Anomaly {
	anomalies := make([]models.Anomaly, 0)
	anomID := 1

	if backlog.PeakBacklog > 200 {
		anomalies = append(anomalies, models.Anomaly{
			ID:          fmt.Sprintf("ANOM-%03d", anomID),
			Type:        "backlog_spike",
			Severity:    "high",
			Timestamp:   backlog.PeakTime,
			Description: "队列积压峰值异常",
			Details:     fmt.Sprintf("峰值积压达到 %d，远超正常水平", backlog.PeakBacklog),
		})
		anomID++
	}

	if len(retry.RetryStormIndicators) > 0 {
		for _, storm := range retry.RetryStormIndicators {
			anomalies = append(anomalies, models.Anomaly{
				ID:          fmt.Sprintf("ANOM-%03d", anomID),
				Type:        "retry_storm",
				Severity:    storm.Severity,
				Timestamp:   storm.StartTime,
				Description: "检测到重试风暴",
				Details:     fmt.Sprintf("%s 级重试风暴：%d 次重试事件影响 %d 个任务，时间范围 %s - %s", storm.Severity, storm.RetryCount, storm.AffectedJobs, storm.StartTime.Format(time.RFC3339), storm.EndTime.Format(time.RFC3339)),
			})
			anomID++
		}
	}

	if len(priority.PriorityInversionCases) > 0 {
		for _, inv := range priority.PriorityInversionCases {
			anomalies = append(anomalies, models.Anomaly{
				ID:          fmt.Sprintf("ANOM-%03d", anomID),
				Type:        "priority_inversion",
				Severity:    inv.Severity,
				Timestamp:   inv.Timestamp,
				Description: "检测到优先级反转",
				Details:     fmt.Sprintf("高优先级任务 %s (优先级 %d) 等待 %dms，期间低优先级任务 %s (优先级 %d) 在执行 %dms", inv.HighPriorityJobID, inv.HighPriority, inv.HighPriorityWaitMs, inv.LowPriorityJobID, inv.LowPriority, inv.LowPriorityExecMs),
			})
			anomID++
		}
	}

	return anomalies
}

func (a *Analyzer) percentile(data []float64, p float64) float64 {
	if len(data) == 0 {
		return 0
	}

	n := len(data)
	if n == 1 {
		return data[0]
	}

	index := (p / 100.0) * float64(n-1)
	lower := int(index)
	upper := lower + 1
	weight := index - float64(lower)

	if upper >= n {
		return data[n-1]
	}

	return data[lower]*(1-weight) + data[upper]*weight
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
