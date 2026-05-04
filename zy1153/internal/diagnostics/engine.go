package diagnostics

import (
	"sort"
	"time"

	"github.com/zy1153/pool-diagnostic/internal/models"
	"github.com/zy1153/pool-diagnostic/internal/storage"
)

// 默认阈值配置
type DiagnosticThresholds struct {
	ConnectionUnreturnedThreshold time.Duration
	LongTransactionThreshold      time.Duration
	SlowSQLThreshold              time.Duration
	WaitQueueStarvationThreshold  time.Duration
	MaxIdleRatioThreshold         float64
	TenantContentionThreshold     float64
	ConnectionFluctuationWindow   time.Duration
}

func DefaultThresholds() *DiagnosticThresholds {
	return &DiagnosticThresholds{
		ConnectionUnreturnedThreshold: 5 * time.Minute,
		LongTransactionThreshold:      1 * time.Minute,
		SlowSQLThreshold:              10 * time.Second,
		WaitQueueStarvationThreshold:  30 * time.Second,
		MaxIdleRatioThreshold:         0.5,
		TenantContentionThreshold:     0.8,
		ConnectionFluctuationWindow:   5 * time.Minute,
	}
}

type DiagnosticEngine struct {
	store      *storage.BoltStore
	thresholds *DiagnosticThresholds
}

func NewDiagnosticEngine(store *storage.BoltStore) *DiagnosticEngine {
	return &DiagnosticEngine{
		store:      store,
		thresholds: DefaultThresholds(),
	}
}

func NewDiagnosticEngineWithThresholds(store *storage.BoltStore, thresholds *DiagnosticThresholds) *DiagnosticEngine {
	return &DiagnosticEngine{
		store:      store,
		thresholds: thresholds,
	}
}

// RunFullDiagnostics 运行所有诊断规则
func (e *DiagnosticEngine) RunFullDiagnostics() (*models.AnalysisResult, error) {
	result := &models.AnalysisResult{
		AnalysisTime: time.Now(),
		Alerts:       make([]models.Alert, 0),
	}

	// 运行所有诊断规则
	rules := []func() ([]models.Alert, error){
		e.detectConnectionUnreturned,
		e.detectLongTransaction,
		e.detectSlowSQLOccupation,
		e.detectWaitQueueStarvation,
		e.detectConfigurationIssue,
		e.detectTenantContention,
		e.detectConnectionFluctuation,
		e.detectTimeoutRetryAmplification,
	}

	for _, rule := range rules {
		alerts, err := rule()
		if err != nil {
			continue
		}
		result.Alerts = append(result.Alerts, alerts...)
	}

	// 计算摘要
	result.Summary = e.calculateSummary(result.Alerts)

	return result, nil
}

// 1. 检测连接未归还
func (e *DiagnosticEngine) detectConnectionUnreturned() ([]models.Alert, error) {
	leases, err := e.store.GetActiveLeases()
	if err != nil {
		return nil, err
	}

	var alerts []models.Alert
	now := time.Now()

	for _, lease := range leases {
		if lease.Status != models.LeaseStatusBorrowed && lease.Status != models.LeaseStatusSuspicious {
			continue
		}

		elapsed := now.Sub(lease.BorrowedAt)
		if elapsed > e.thresholds.ConnectionUnreturnedThreshold {
			alert := models.Alert{
				Type:            models.AlertTypeConnectionUnreturned,
				Severity:        e.calculateSeverity(elapsed, e.thresholds.ConnectionUnreturnedThreshold),
				Title:           "连接疑似未归还",
				Description:     "数据库连接被借出后长时间未归还，可能导致连接池耗尽",
				RootCause:       "可能的原因：事务未提交/回滚、代码忘记归还连接、异常未正确处理、死锁",
				Recommendation:  "1. 检查相关代码是否有 defer 归还连接；2. 查看是否有未提交的事务；3. 考虑设置连接最大生命周期",
				ConnectionID:    &lease.ConnectionID,
				RequestID:       &lease.RequestID,
				TenantID:        &lease.TenantID,
				CreatedAt:       now,
				FirstSeenAt:     lease.BorrowedAt,
				Status:          models.AlertStatusOpen,
				IsFalsePositive: false,
				Evidence: map[string]interface{}{
					"connection_id":     lease.ConnectionID,
					"request_id":        lease.RequestID,
					"tenant_id":         lease.TenantID,
					"borrowed_at":       lease.BorrowedAt,
					"elapsed_seconds":   elapsed.Seconds(),
					"threshold_seconds": e.thresholds.ConnectionUnreturnedThreshold.Seconds(),
					"status":            lease.Status,
					"has_error":         lease.HasError,
					"has_transaction":   lease.TransactionID != nil,
				},
				Score: e.calculateScore(elapsed, e.thresholds.ConnectionUnreturnedThreshold),
			}
			alerts = append(alerts, alert)
		}
	}

	return alerts, nil
}

// 2. 检测长事务
func (e *DiagnosticEngine) detectLongTransaction() ([]models.Alert, error) {
	txs, err := e.store.GetActiveTransactions()
	if err != nil {
		return nil, err
	}

	var alerts []models.Alert
	now := time.Now()

	for _, tx := range txs {
		if tx.Status != models.TransactionStatusActive {
			continue
		}

		elapsed := now.Sub(tx.BeginTime)
		if elapsed > e.thresholds.LongTransactionThreshold {
			alert := models.Alert{
				Type:            models.AlertTypeLongTransaction,
				Severity:        e.calculateSeverity(elapsed, e.thresholds.LongTransactionThreshold),
				Title:           "长事务告警",
				Description:     "事务运行时间超过阈值，可能持有锁导致其他请求阻塞",
				RootCause:       "可能的原因：大查询未提交、等待用户输入、外部系统调用、锁争用",
				Recommendation:  "1. 检查事务中的 SQL 是否有大查询；2. 考虑设置事务超时；3. 拆分大事务为小事务",
				TransactionID:   &tx.ID,
				ConnectionID:    &tx.ConnectionID,
				RequestID:       &tx.RequestID,
				TenantID:        &tx.TenantID,
				CreatedAt:       now,
				FirstSeenAt:     tx.BeginTime,
				Status:          models.AlertStatusOpen,
				IsFalsePositive: false,
				Evidence: map[string]interface{}{
					"transaction_id":    tx.ID,
					"connection_id":     tx.ConnectionID,
					"request_id":        tx.RequestID,
					"tenant_id":         tx.TenantID,
					"begin_time":        tx.BeginTime,
					"elapsed_seconds":   elapsed.Seconds(),
					"threshold_seconds": e.thresholds.LongTransactionThreshold.Seconds(),
					"sql_count":         tx.SQLCount,
					"has_savepoints":    tx.HasSavepoints,
				},
				Score: e.calculateScore(elapsed, e.thresholds.LongTransactionThreshold),
			}
			alerts = append(alerts, alert)
		}
	}

	return alerts, nil
}

// 3. 检测慢 SQL 占用
func (e *DiagnosticEngine) detectSlowSQLOccupation() ([]models.Alert, error) {
	queries, err := e.store.GetSlowQueries(e.thresholds.SlowSQLThreshold)
	if err != nil {
		return nil, err
	}

	var alerts []models.Alert
	now := time.Now()

	for _, query := range queries {
		if query.Duration > e.thresholds.SlowSQLThreshold {
			alert := models.Alert{
				Type:            models.AlertTypeSlowSQLOccupation,
				Severity:        e.calculateSeverity(query.Duration, e.thresholds.SlowSQLThreshold),
				Title:           "慢 SQL 占用连接",
				Description:     "慢 SQL 正在占用数据库连接，可能导致连接池资源紧张",
				RootCause:       "可能的原因：缺少索引、数据量大、锁等待、配置不当",
				Recommendation:  "1. 分析执行计划；2. 添加合适的索引；3. 优化查询逻辑；4. 考虑读写分离",
				QueryID:         &query.ID,
				ConnectionID:    &query.ConnectionID,
				RequestID:       &query.RequestID,
				TenantID:        &query.TenantID,
				CreatedAt:       now,
				FirstSeenAt:     query.StartTime,
				Status:          models.AlertStatusOpen,
				IsFalsePositive: false,
				Evidence: map[string]interface{}{
					"query_id":          query.ID,
					"connection_id":     query.ConnectionID,
					"request_id":        query.RequestID,
					"tenant_id":         query.TenantID,
					"sql_text":          query.SQLText,
					"sql_type":          query.SQLType,
					"start_time":        query.StartTime,
					"duration_seconds":  query.Duration.Seconds(),
					"threshold_seconds": e.thresholds.SlowSQLThreshold.Seconds(),
					"rows_affected":     query.RowsAffected,
					"has_error":         query.Error != "",
					"in_transaction":    query.TransactionID != nil,
				},
				Score: e.calculateScore(query.Duration, e.thresholds.SlowSQLThreshold),
			}
			alerts = append(alerts, alert)
		}
	}

	return alerts, nil
}

// 4. 检测等待队列饥饿
func (e *DiagnosticEngine) detectWaitQueueStarvation() ([]models.Alert, error) {
	queueItems, err := e.store.GetAllQueueItems()
	if err != nil {
		return nil, err
	}

	var alerts []models.Alert
	now := time.Now()

	// 统计等待超时的项
	for _, item := range queueItems {
		if item.IsTimeout || item.Status == models.QueueStatusTimeout {
			alert := models.Alert{
				Type:            models.AlertTypeWaitQueueStarvation,
				Severity:        models.AlertSeverityHigh,
				Title:           "等待队列超时",
				Description:     "请求在等待队列中等待超时，说明连接池资源严重不足",
				RootCause:       "可能的原因：连接池太小、慢查询占用所有连接、流量突增、配置不合理",
				Recommendation:  "1. 增加 max_open_connections；2. 优化慢查询；3. 考虑连接池动态扩容；4. 检查是否有连接泄漏",
				RequestID:       &item.RequestID,
				TenantID:        &item.TenantID,
				CreatedAt:       now,
				FirstSeenAt:     item.EnqueuedAt,
				Status:          models.AlertStatusOpen,
				IsFalsePositive: false,
				Evidence: map[string]interface{}{
					"request_id":            item.RequestID,
					"tenant_id":             item.TenantID,
					"enqueued_at":           item.EnqueuedAt,
					"wait_duration_seconds": item.WaitDuration.Seconds(),
					"timeout_seconds":       item.Timeout.Seconds(),
					"status":                item.Status,
					"is_timeout":            item.IsTimeout,
				},
				Score: 0.9,
			}
			alerts = append(alerts, alert)
		}
	}

	// 检查是否有大量等待项
	activeItems, err := e.store.GetActiveQueueItems()
	if err != nil {
		return alerts, nil
	}

	if len(activeItems) > 0 {
		// 计算平均等待时间
		var totalWait time.Duration
		for _, item := range activeItems {
			elapsed := now.Sub(item.EnqueuedAt)
			totalWait += elapsed
		}
		avgWait := totalWait / time.Duration(len(activeItems))

		if avgWait > e.thresholds.WaitQueueStarvationThreshold {
			alert := models.Alert{
				Type:            models.AlertTypeWaitQueueStarvation,
				Severity:        models.AlertSeverityCritical,
				Title:           "等待队列饥饿",
				Description:     "等待队列中存在大量请求，平均等待时间过长",
				RootCause:       "连接池资源无法满足当前请求量，可能需要扩容或优化",
				Recommendation:  "1. 立即增加连接池大小；2. 检查是否有慢查询阻塞；3. 考虑限流或降级",
				CreatedAt:       now,
				FirstSeenAt:     now,
				Status:          models.AlertStatusOpen,
				IsFalsePositive: false,
				Evidence: map[string]interface{}{
					"waiting_requests":  len(activeItems),
					"avg_wait_seconds":  avgWait.Seconds(),
					"threshold_seconds": e.thresholds.WaitQueueStarvationThreshold.Seconds(),
				},
				Score: 0.95,
			}
			alerts = append(alerts, alert)
		}
	}

	return alerts, nil
}

// 5. 检测配置不合理
func (e *DiagnosticEngine) detectConfigurationIssue() ([]models.Alert, error) {
	pool, err := e.store.GetDefaultPool()
	if err != nil {
		return nil, err
	}

	var alerts []models.Alert
	now := time.Now()

	// 检查 max_idle 与 max_open 的比例
	if pool.MaxOpen > 0 {
		idleRatio := float64(pool.MaxIdle) / float64(pool.MaxOpen)
		if idleRatio > e.thresholds.MaxIdleRatioThreshold {
			alert := models.Alert{
				Type:            models.AlertTypeConfigurationIssue,
				Severity:        models.AlertSeverityMedium,
				Title:           "连接池配置不合理：空闲连接比例过高",
				Description:     "max_idle_connections 占 max_open_connections 的比例过高，可能造成资源浪费",
				RootCause:       "空闲连接比例过高会增加数据库资源开销，而实际可用连接数不足",
				Recommendation:  "建议将 max_idle 设置为 max_open 的 30%-50%",
				CreatedAt:       now,
				FirstSeenAt:     now,
				Status:          models.AlertStatusOpen,
				IsFalsePositive: false,
				Evidence: map[string]interface{}{
					"max_open":          pool.MaxOpen,
					"max_idle":          pool.MaxIdle,
					"idle_ratio":        idleRatio,
					"recommended_ratio": e.thresholds.MaxIdleRatioThreshold,
				},
				Score: 0.6,
			}
			alerts = append(alerts, alert)
		}
	}

	// 检查 max_idle > max_open 的情况
	if pool.MaxIdle > pool.MaxOpen {
		alert := models.Alert{
			Type:            models.AlertTypeConfigurationIssue,
			Severity:        models.AlertSeverityHigh,
			Title:           "连接池配置错误：max_idle > max_open",
			Description:     "max_idle_connections 不能大于 max_open_connections，这是无效配置",
			RootCause:       "配置错误，空闲连接数不能超过最大连接数",
			Recommendation:  "将 max_idle 设置为小于等于 max_open 的值",
			CreatedAt:       now,
			FirstSeenAt:     now,
			Status:          models.AlertStatusOpen,
			IsFalsePositive: false,
			Evidence: map[string]interface{}{
				"max_open": pool.MaxOpen,
				"max_idle": pool.MaxIdle,
			},
			Score: 0.9,
		}
		alerts = append(alerts, alert)
	}

	// 检查 idle_timeout 是否合理
	if pool.IdleTimeout < 30*time.Second {
		alert := models.Alert{
			Type:            models.AlertTypeConfigurationIssue,
			Severity:        models.AlertSeverityLow,
			Title:           "连接池配置不合理：空闲超时过短",
			Description:     "idle_timeout 过短可能导致频繁创建和销毁连接，增加开销",
			RootCause:       "连接生命周期太短，无法有效复用连接",
			Recommendation:  "建议将 idle_timeout 设置为至少 30 秒",
			CreatedAt:       now,
			FirstSeenAt:     now,
			Status:          models.AlertStatusOpen,
			IsFalsePositive: false,
			Evidence: map[string]interface{}{
				"idle_timeout_seconds":    pool.IdleTimeout.Seconds(),
				"recommended_min_seconds": 30,
			},
			Score: 0.4,
		}
		alerts = append(alerts, alert)
	}

	// 检查租户配额
	if pool.TenantQuota <= 0 {
		alert := models.Alert{
			Type:            models.AlertTypeConfigurationIssue,
			Severity:        models.AlertSeverityMedium,
			Title:           "租户配额未设置",
			Description:     "tenant_quota 未设置或为 0，可能导致单个租户占用所有连接",
			RootCause:       "缺少租户级别的连接隔离",
			Recommendation:  "设置合理的 tenant_quota，建议为 max_open 的 20%-30%",
			CreatedAt:       now,
			FirstSeenAt:     now,
			Status:          models.AlertStatusOpen,
			IsFalsePositive: false,
			Evidence: map[string]interface{}{
				"tenant_quota": pool.TenantQuota,
				"max_open":     pool.MaxOpen,
			},
			Score: 0.5,
		}
		alerts = append(alerts, alert)
	}

	return alerts, nil
}

// 6. 检测租户争抢
func (e *DiagnosticEngine) detectTenantContention() ([]models.Alert, error) {
	tenants, err := e.store.GetAllTenants()
	if err != nil {
		return nil, err
	}

	if len(tenants) < 2 {
		return nil, nil
	}

	var alerts []models.Alert
	now := time.Now()

	// 计算总连接数
	var totalConnections int
	for _, tenant := range tenants {
		totalConnections += tenant.CurrentConnections
	}

	if totalConnections == 0 {
		return nil, nil
	}

	// 检查是否有租户占用过多连接
	for _, tenant := range tenants {
		usageRatio := float64(tenant.CurrentConnections) / float64(totalConnections)
		if usageRatio > e.thresholds.TenantContentionThreshold {
			alert := models.Alert{
				Type:            models.AlertTypeTenantContention,
				Severity:        models.AlertSeverityHigh,
				Title:           "租户连接争抢",
				Description:     "单个租户占用了过多的连接池资源，可能影响其他租户",
				RootCause:       "租户配额设置过大或未生效，单个租户流量过高",
				Recommendation:  "1. 降低该租户的连接配额；2. 检查该租户是否有慢查询；3. 考虑租户级别的连接池隔离",
				TenantID:        &tenant.ID,
				CreatedAt:       now,
				FirstSeenAt:     now,
				Status:          models.AlertStatusOpen,
				IsFalsePositive: false,
				Evidence: map[string]interface{}{
					"tenant_id":           tenant.ID,
					"tenant_name":         tenant.Name,
					"current_connections": tenant.CurrentConnections,
					"total_connections":   totalConnections,
					"usage_ratio":         usageRatio,
					"threshold":           e.thresholds.TenantContentionThreshold,
					"quota":               tenant.Quota,
					"total_borrows":       tenant.TotalBorrows,
					"alert_count":         tenant.AlertCount,
				},
				Score: usageRatio,
			}
			alerts = append(alerts, alert)
		}
	}

	// 检查租户间等待时间差异
	sort.Slice(tenants, func(i, j int) bool {
		return tenants[i].AvgWaitTime < tenants[j].AvgWaitTime
	})

	if len(tenants) >= 2 {
		minWait := tenants[0].AvgWaitTime
		maxWait := tenants[len(tenants)-1].AvgWaitTime

		if maxWait > minWait*3 && maxWait > 5*time.Second {
			alert := models.Alert{
				Type:            models.AlertTypeTenantContention,
				Severity:        models.AlertSeverityMedium,
				Title:           "租户等待时间不均",
				Description:     "不同租户的连接等待时间差异较大，可能存在公平性问题",
				RootCause:       "可能是某个租户持续占用连接，导致其他租户等待",
				Recommendation:  "1. 检查是否有慢查询租户；2. 考虑使用公平队列；3. 租户级别限流",
				CreatedAt:       now,
				FirstSeenAt:     now,
				Status:          models.AlertStatusOpen,
				IsFalsePositive: false,
				Evidence: map[string]interface{}{
					"min_wait_seconds": minWait.Seconds(),
					"max_wait_seconds": maxWait.Seconds(),
					"ratio":            float64(maxWait) / float64(minWait),
				},
				Score: 0.7,
			}
			alerts = append(alerts, alert)
		}
	}

	return alerts, nil
}

// 7. 检测连接抖动
func (e *DiagnosticEngine) detectConnectionFluctuation() ([]models.Alert, error) {
	leases, err := e.store.GetAllLeases()
	if err != nil {
		return nil, err
	}

	if len(leases) < 10 {
		return nil, nil
	}

	var alerts []models.Alert
	now := time.Now()

	// 按时间段统计连接创建频率
	window := e.thresholds.ConnectionFluctuationWindow
	startTime := now.Add(-1 * time.Hour) // 检查过去 1 小时

	recentLeases := make([]models.ConnectionLease, 0)
	for _, lease := range leases {
		if lease.BorrowedAt.After(startTime) {
			recentLeases = append(recentLeases, lease)
		}
	}

	if len(recentLeases) < 5 {
		return nil, nil
	}

	// 计算每个窗口内的连接波动
	// 统计短时间内大量借出又归还
	// 简单检测：平均使用时间过短
	var totalUseTime time.Duration
	shortLivedCount := 0

	for _, lease := range recentLeases {
		if lease.UseDuration > 0 {
			totalUseTime += lease.UseDuration
			if lease.UseDuration < 100*time.Millisecond {
				shortLivedCount++
			}
		}
	}

	if len(recentLeases) > 0 {
		avgUseTime := totalUseTime / time.Duration(len(recentLeases))
		shortLivedRatio := float64(shortLivedCount) / float64(len(recentLeases))

		if shortLivedRatio > 0.5 && len(recentLeases) > 10 {
			alert := models.Alert{
				Type:            models.AlertTypeConnectionFluctuation,
				Severity:        models.AlertSeverityMedium,
				Title:           "连接抖动异常",
				Description:     "短时间内大量连接被创建后立即释放，可能存在连接使用不当",
				RootCause:       "可能的原因：连接复用失败、频繁的连接验证、连接池配置问题",
				Recommendation:  "1. 检查是否每次请求都新建连接；2. 检查连接验证逻辑；3. 确保连接正确复用",
				CreatedAt:       now,
				FirstSeenAt:     now,
				Status:          models.AlertStatusOpen,
				IsFalsePositive: false,
				Evidence: map[string]interface{}{
					"window_seconds":    window.Seconds(),
					"total_leases":      len(recentLeases),
					"short_lived_count": shortLivedCount,
					"short_lived_ratio": shortLivedRatio,
					"avg_use_time_ms":   avgUseTime.Milliseconds(),
				},
				Score: shortLivedRatio,
			}
			alerts = append(alerts, alert)
		}
	}

	return alerts, nil
}

// 8. 检测超时重试放大
func (e *DiagnosticEngine) detectTimeoutRetryAmplification() ([]models.Alert, error) {
	queueItems, err := e.store.GetAllQueueItems()
	if err != nil {
		return nil, err
	}

	// 统计超时的数量
	timeoutCount := 0
	for _, item := range queueItems {
		if item.IsTimeout {
			timeoutCount++
		}
	}

	if timeoutCount == 0 {
		return nil, nil
	}

	var alerts []models.Alert
	now := time.Now()

	// 检查是否有同一 request_id 多次超时（重试）
	timeoutByRequest := make(map[string]int)
	for _, item := range queueItems {
		if item.IsTimeout {
			timeoutByRequest[item.RequestID]++
		}
	}

	// 检查是否有同一租户大量超时
	timeoutByTenant := make(map[string]int)
	for _, item := range queueItems {
		if item.IsTimeout {
			timeoutByTenant[item.TenantID]++
		}
	}

	// 检查是否有重试放大效应
	// 简单检测：短时间内多次超时
	for requestID, count := range timeoutByRequest {
		if count >= 3 {
			alert := models.Alert{
				Type:            models.AlertTypeTimeoutRetryAmplification,
				Severity:        models.AlertSeverityHigh,
				Title:           "超时重试放大效应",
				Description:     "同一请求多次超时，可能存在重试风暴",
				RootCause:       "重试策略不当，在系统过载时继续重试会加重负担",
				Recommendation:  "1. 增加重试间隔；2. 设置最大重试次数；3. 考虑使用退避策略；4. 必要时熔断",
				RequestID:       &requestID,
				CreatedAt:       now,
				FirstSeenAt:     now,
				Status:          models.AlertStatusOpen,
				IsFalsePositive: false,
				Evidence: map[string]interface{}{
					"request_id":     requestID,
					"timeout_count":  count,
					"total_timeouts": timeoutCount,
				},
				Score: 0.85,
			}
			alerts = append(alerts, alert)
		}
	}

	// 检查租户级别的重试
	for tenantID, count := range timeoutByTenant {
		if count >= 5 {
			tenant := tenantID
			alert := models.Alert{
				Type:            models.AlertTypeTimeoutRetryAmplification,
				Severity:        models.AlertSeverityMedium,
				Title:           "租户级超时重试",
				Description:     "租户多次超时，可能存在重试放大",
				RootCause:       "该租户可能有大量请求超时，重试会加重系统负担",
				Recommendation:  "1. 检查该租户的请求模式；2. 考虑租户级别限流；3. 优化该租户的查询",
				TenantID:        &tenant,
				CreatedAt:       now,
				FirstSeenAt:     now,
				Status:          models.AlertStatusOpen,
				IsFalsePositive: false,
				Evidence: map[string]interface{}{
					"tenant_id":     tenantID,
					"timeout_count": count,
				},
				Score: 0.7,
			}
			alerts = append(alerts, alert)
		}
	}

	return alerts, nil
}

// 辅助函数：计算严重程度
func (e *DiagnosticEngine) calculateSeverity(actual, threshold time.Duration) models.AlertSeverity {
	ratio := float64(actual) / float64(threshold)
	switch {
	case ratio >= 10:
		return models.AlertSeverityCritical
	case ratio >= 5:
		return models.AlertSeverityHigh
	case ratio >= 3:
		return models.AlertSeverityMedium
	default:
		return models.AlertSeverityLow
	}
}

// 辅助函数：计算分数
func (e *DiagnosticEngine) calculateScore(actual, threshold time.Duration) float64 {
	ratio := float64(actual) / float64(threshold)
	// 归一化到 0-1 范围
	if ratio <= 1 {
		return ratio * 0.5
	}
	if ratio >= 10 {
		return 1.0
	}
	return 0.5 + (ratio-1)*0.05
}

// 辅助函数：计算摘要
func (e *DiagnosticEngine) calculateSummary(alerts []models.Alert) models.AnalysisSummary {
	summary := models.AnalysisSummary{
		TotalAlerts: len(alerts),
	}

	for _, alert := range alerts {
		switch alert.Severity {
		case models.AlertSeverityCritical:
			summary.CriticalAlerts++
		case models.AlertSeverityHigh:
			summary.HighAlerts++
		case models.AlertSeverityMedium:
			summary.MediumAlerts++
		case models.AlertSeverityLow:
			summary.LowAlerts++
		}
	}

	return summary
}

// GetConnectionTimeline 获取连接的时间线
func (e *DiagnosticEngine) GetConnectionTimeline(connectionID string) ([]models.TimelineEvent, error) {
	var events []models.TimelineEvent

	// 获取连接租约
	leases, err := e.store.GetLeasesByConnection(connectionID)
	if err != nil {
		return nil, err
	}

	for _, lease := range leases {
		// 借出事件
		events = append(events, models.TimelineEvent{
			Timestamp:   lease.BorrowedAt,
			Type:        "connection_borrow",
			Description: "连接被借出",
			Details: map[string]interface{}{
				"request_id":    lease.RequestID,
				"tenant_id":     lease.TenantID,
				"wait_duration": lease.WaitDuration.String(),
				"source":        lease.BorrowSource,
			},
		})

		// 归还事件
		if lease.ReturnedAt != nil {
			events = append(events, models.TimelineEvent{
				Timestamp:   *lease.ReturnedAt,
				Type:        "connection_return",
				Description: "连接被归还",
				Details: map[string]interface{}{
					"use_duration": lease.UseDuration.String(),
					"reason":       lease.ReturnReason,
					"has_error":    lease.HasError,
					"sql_count":    lease.SQLCount,
				},
			})
		}
	}

	// 获取审计事件
	auditEvents, err := e.store.GetAuditEventsByConnection(connectionID)
	if err == nil {
		for _, ae := range auditEvents {
			events = append(events, models.TimelineEvent{
				Timestamp:   ae.Timestamp,
				Type:        string(ae.EventType),
				Description: ae.Description,
				Details:     ae.Details,
			})
		}
	}

	// 按时间排序
	sort.Slice(events, func(i, j int) bool {
		return events[i].Timestamp.Before(events[j].Timestamp)
	})

	return events, nil
}

// GetRequestTimeline 获取请求的时间线
func (e *DiagnosticEngine) GetRequestTimeline(requestID string) ([]models.TimelineEvent, error) {
	var events []models.TimelineEvent

	// 获取连接租约
	leases, err := e.store.GetLeasesByRequest(requestID)
	if err != nil {
		return nil, err
	}

	for _, lease := range leases {
		events = append(events, models.TimelineEvent{
			Timestamp:   lease.BorrowedAt,
			Type:        "connection_borrow",
			Description: "获取连接",
			Details: map[string]interface{}{
				"connection_id": lease.ConnectionID,
				"tenant_id":     lease.TenantID,
				"wait_duration": lease.WaitDuration.String(),
			},
		})

		if lease.ReturnedAt != nil {
			events = append(events, models.TimelineEvent{
				Timestamp:   *lease.ReturnedAt,
				Type:        "connection_return",
				Description: "归还连接",
				Details: map[string]interface{}{
					"connection_id": lease.ConnectionID,
					"use_duration":  lease.UseDuration.String(),
				},
			})
		}
	}

	// 获取 SQL 查询
	queries, err := e.store.GetQueriesByRequest(requestID)
	if err == nil {
		for _, q := range queries {
			events = append(events, models.TimelineEvent{
				Timestamp:   q.StartTime,
				Type:        "sql_execute",
				Description: "执行 SQL",
				Details: map[string]interface{}{
					"sql_type":      q.SQLType,
					"sql_text":      q.SQLText,
					"duration":      q.Duration.String(),
					"is_slow":       q.IsSlow,
					"rows_affected": q.RowsAffected,
				},
			})
		}
	}

	// 获取审计事件
	auditEvents, err := e.store.GetAuditEventsByRequest(requestID)
	if err == nil {
		for _, ae := range auditEvents {
			events = append(events, models.TimelineEvent{
				Timestamp:   ae.Timestamp,
				Type:        string(ae.EventType),
				Description: ae.Description,
				Details:     ae.Details,
			})
		}
	}

	// 按时间排序
	sort.Slice(events, func(i, j int) bool {
		return events[i].Timestamp.Before(events[j].Timestamp)
	})

	return events, nil
}

// SimulateConfigChange 模拟配置变更
func (e *DiagnosticEngine) SimulateConfigChange(newConfig models.PoolConfig) (*models.ConfigSimulation, error) {
	// 获取当前配置
	pool, err := e.store.GetDefaultPool()
	if err != nil {
		return nil, err
	}

	originalConfig := models.PoolConfig{
		MaxOpen:     pool.MaxOpen,
		MaxIdle:     pool.MaxIdle,
		IdleTimeout: pool.IdleTimeout,
		TenantQuota: pool.TenantQuota,
	}

	simulation := &models.ConfigSimulation{
		OriginalConfig: originalConfig,
		ProposedConfig: newConfig,
	}

	// 分析预期改进
	improvements := make([]models.Improvement, 0)

	// 1. 最大连接数变化
	if newConfig.MaxOpen > originalConfig.MaxOpen {
		improvements = append(improvements, models.Improvement{
			Metric:         "最大连接数",
			OriginalValue:  float64(originalConfig.MaxOpen),
			ExpectedValue:  float64(newConfig.MaxOpen),
			ImprovementPct: float64(newConfig.MaxOpen-originalConfig.MaxOpen) / float64(originalConfig.MaxOpen) * 100,
		})
	}

	// 2. 空闲连接比例优化
	if newConfig.MaxIdle > 0 && newConfig.MaxOpen > 0 {
		originalRatio := float64(originalConfig.MaxIdle) / float64(originalConfig.MaxOpen)
		newRatio := float64(newConfig.MaxIdle) / float64(newConfig.MaxOpen)
		recommendedRatio := 0.4 // 推荐 40%

		if (originalRatio > 0.6 && newRatio <= 0.6) || (originalRatio < 0.2 && newRatio >= 0.2) {
			improvements = append(improvements, models.Improvement{
				Metric:         "空闲连接比例",
				OriginalValue:  originalRatio,
				ExpectedValue:  newRatio,
				ImprovementPct: (recommendedRatio - newRatio) / recommendedRatio * 100,
			})
		}
	}

	// 3. 空闲超时优化
	if newConfig.IdleTimeout > originalConfig.IdleTimeout && newConfig.IdleTimeout >= 30*time.Second {
		improvements = append(improvements, models.Improvement{
			Metric:         "空闲超时",
			OriginalValue:  originalConfig.IdleTimeout.Seconds(),
			ExpectedValue:  newConfig.IdleTimeout.Seconds(),
			ImprovementPct: float64(newConfig.IdleTimeout-originalConfig.IdleTimeout) / float64(originalConfig.IdleTimeout) * 100,
		})
	}

	simulation.ExpectedImprovements = improvements

	// 分析风险
	risks := make([]models.Risk, 0)

	// 风险 1: 连接数增加过多
	if newConfig.MaxOpen > originalConfig.MaxOpen*2 {
		risks = append(risks, models.Risk{
			Description: "连接数增加超过 100%，可能增加数据库负担",
			Severity:    "medium",
			Mitigation:  "建议逐步增加连接数，监控数据库负载",
		})
	}

	// 风险 2: 空闲连接比例过高
	if newConfig.MaxIdle > 0 && newConfig.MaxOpen > 0 {
		idleRatio := float64(newConfig.MaxIdle) / float64(newConfig.MaxOpen)
		if idleRatio > 0.7 {
			risks = append(risks, models.Risk{
				Description: "空闲连接比例超过 70%，可能造成资源浪费",
				Severity:    "low",
				Mitigation:  "建议将 max_idle 设置为 max_open 的 30%-50%",
			})
		}
	}

	// 风险 3: 租户配额过小
	if newConfig.TenantQuota > 0 && newConfig.TenantQuota < 2 {
		risks = append(risks, models.Risk{
			Description: "租户配额过小，可能影响正常业务",
			Severity:    "medium",
			Mitigation:  "建议租户配额至少为 2，确保基本并发能力",
		})
	}

	simulation.Risks = risks

	return simulation, nil
}
