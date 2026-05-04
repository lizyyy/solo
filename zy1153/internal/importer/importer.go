package importer

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/zy1153/pool-diagnostic/internal/models"
	"github.com/zy1153/pool-diagnostic/internal/storage"
	"gopkg.in/yaml.v3"
)

type Importer struct {
	store *storage.BoltStore
}

func NewImporter(store *storage.BoltStore) *Importer {
	return &Importer{store: store}
}

// ImportPoolEventsJSONL 导入 pool-events.jsonl 文件
func (imp *Importer) ImportPoolEventsJSONL(filename string) (*models.ImportResult, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	result := &models.ImportResult{}
	scanner := bufio.NewScanner(file)
	lineNumber := 0

	for scanner.Scan() {
		lineNumber++
		line := scanner.Text()

		if strings.TrimSpace(line) == "" {
			continue
		}

		result.TotalRecords++

		var event models.PoolEvent
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			result.FailedRecords++
			result.Errors = append(result.Errors, models.ImportError{
				LineNumber: lineNumber,
				RecordType: "pool_event",
				Error:      fmt.Sprintf("invalid JSON: %v", err),
				RawRecord:  line,
			})
			continue
		}

		// 验证必填字段
		if event.Timestamp.IsZero() {
			result.FailedRecords++
			result.Errors = append(result.Errors, models.ImportError{
				LineNumber: lineNumber,
				RecordType: "pool_event",
				Error:      "missing required field: timestamp",
				RawRecord:  line,
			})
			continue
		}

		if event.ConnectionID == "" {
			result.FailedRecords++
			result.Errors = append(result.Errors, models.ImportError{
				LineNumber: lineNumber,
				RecordType: "pool_event",
				Error:      "missing required field: connection_id",
				RawRecord:  line,
			})
			continue
		}

		// 处理不同类型的事件
		if err := imp.processPoolEvent(&event); err != nil {
			result.FailedRecords++
			result.Errors = append(result.Errors, models.ImportError{
				LineNumber: lineNumber,
				RecordType: "pool_event",
				Error:      err.Error(),
				RawRecord:  line,
			})
			continue
		}

		result.SuccessRecords++
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading file: %w", err)
	}

	return result, nil
}

// processPoolEvent 处理单个连接池事件
func (imp *Importer) processPoolEvent(event *models.PoolEvent) error {
	switch event.EventType {
	case "connection_borrow":
		return imp.processBorrowEvent(event)
	case "connection_return":
		return imp.processReturnEvent(event)
	case "wait_enqueue":
		return imp.processWaitEnqueueEvent(event)
	case "wait_timeout":
		return imp.processWaitTimeoutEvent(event)
	case "transaction_begin":
		return imp.processTransactionBeginEvent(event)
	case "transaction_end":
		return imp.processTransactionEndEvent(event)
	case "sql_execute":
		return imp.processSQLExecuteEvent(event)
	default:
		return fmt.Errorf("unknown event type: %s", event.EventType)
	}
}

func (imp *Importer) processBorrowEvent(event *models.PoolEvent) error {
	lease := &models.ConnectionLease{
		ConnectionID: event.ConnectionID,
		RequestID:    event.RequestID,
		TenantID:     event.TenantID,
		BorrowedAt:   event.Timestamp,
		BorrowSource: "idle", // 默认值
		Status:       models.LeaseStatusBorrowed,
	}

	if event.WaitDuration != nil {
		lease.WaitDuration = *event.WaitDuration
	}

	if event.TransactionID != nil {
		lease.TransactionID = event.TransactionID
	}

	return imp.store.CreateLease(lease)
}

func (imp *Importer) processReturnEvent(event *models.PoolEvent) error {
	// 查找对应的借出记录
	leases, err := imp.store.GetLeasesByConnection(event.ConnectionID)
	if err != nil {
		return fmt.Errorf("failed to find lease: %w", err)
	}

	var activeLease *models.ConnectionLease
	for i := range leases {
		if leases[i].Status == models.LeaseStatusBorrowed && leases[i].RequestID == event.RequestID {
			activeLease = &leases[i]
			break
		}
	}

	if activeLease == nil {
		// 如果没有找到活跃的租约，可能是数据顺序问题，创建一个完整的租约
		lease := &models.ConnectionLease{
			ConnectionID: event.ConnectionID,
			RequestID:    event.RequestID,
			TenantID:     event.TenantID,
			BorrowedAt:   event.Timestamp.Add(-1 * time.Second), // 假设借出在归还前 1 秒
			ReturnedAt:   &event.Timestamp,
			Status:       models.LeaseStatusReturned,
		}

		if event.ReturnReason != nil {
			lease.ReturnReason = *event.ReturnReason
		}

		if event.Error != nil {
			lease.HasError = true
			lease.ErrorMessage = *event.Error
		}

		return imp.store.CreateLease(lease)
	}

	// 更新现有租约
	activeLease.ReturnedAt = &event.Timestamp
	activeLease.UseDuration = event.Timestamp.Sub(activeLease.BorrowedAt)
	activeLease.Status = models.LeaseStatusReturned

	if event.ReturnReason != nil {
		activeLease.ReturnReason = *event.ReturnReason
	}

	if event.Error != nil {
		activeLease.HasError = true
		activeLease.ErrorMessage = *event.Error
	}

	return imp.store.UpdateLease(activeLease)
}

func (imp *Importer) processWaitEnqueueEvent(event *models.PoolEvent) error {
	item := &models.WaitQueueItem{
		RequestID:  event.RequestID,
		TenantID:   event.TenantID,
		EnqueuedAt: event.Timestamp,
		Status:     models.QueueStatusWaiting,
		Priority:   0,
		Timeout:    30 * time.Second, // 默认超时
	}

	return imp.store.CreateQueueItem(item)
}

func (imp *Importer) processWaitTimeoutEvent(event *models.PoolEvent) error {
	items, err := imp.store.GetActiveQueueItems()
	if err != nil {
		return err
	}

	for i := range items {
		if items[i].RequestID == event.RequestID {
			items[i].Status = models.QueueStatusTimeout
			items[i].IsTimeout = true
			items[i].WaitDuration = event.Timestamp.Sub(items[i].EnqueuedAt)
			return imp.store.UpdateQueueItem(&items[i])
		}
	}

	// 如果找不到，创建一个新的
	item := &models.WaitQueueItem{
		RequestID:    event.RequestID,
		TenantID:     event.TenantID,
		EnqueuedAt:   event.Timestamp.Add(-30 * time.Second),
		DequeuedAt:   &event.Timestamp,
		WaitDuration: 30 * time.Second,
		Status:       models.QueueStatusTimeout,
		IsTimeout:    true,
		Timeout:      30 * time.Second,
	}

	return imp.store.CreateQueueItem(item)
}

func (imp *Importer) processTransactionBeginEvent(event *models.PoolEvent) error {
	tx := &models.Transaction{
		ConnectionID: event.ConnectionID,
		RequestID:    event.RequestID,
		TenantID:     event.TenantID,
		BeginTime:    event.Timestamp,
		Status:       models.TransactionStatusActive,
	}

	if event.TransactionID != nil {
		tx.ID = *event.TransactionID
	}

	return imp.store.CreateTransaction(tx)
}

func (imp *Importer) processTransactionEndEvent(event *models.PoolEvent) error {
	txs, err := imp.store.GetActiveTransactions()
	if err != nil {
		return err
	}

	for i := range txs {
		if txs[i].ConnectionID == event.ConnectionID && txs[i].RequestID == event.RequestID {
			txs[i].EndTime = &event.Timestamp
			txs[i].Duration = event.Timestamp.Sub(txs[i].BeginTime)
			txs[i].Status = models.TransactionStatusCommitted

			if event.Status != nil {
				if *event.Status == "rollback" {
					txs[i].CommitOrRollback = "rollback"
					txs[i].Status = models.TransactionStatusRolledBack
				} else {
					txs[i].CommitOrRollback = "commit"
				}
			} else {
				txs[i].CommitOrRollback = "commit"
			}

			return imp.store.UpdateTransaction(&txs[i])
		}
	}

	return nil
}

func (imp *Importer) processSQLExecuteEvent(event *models.PoolEvent) error {
	query := &models.SQLQuery{
		ConnectionID: event.ConnectionID,
		RequestID:    event.RequestID,
		TenantID:     event.TenantID,
		StartTime:    event.Timestamp,
		SQLType:      models.SQLTypeSelect, // 默认
	}

	if event.SQLText != nil {
		query.SQLText = *event.SQLText
		// 推断 SQL 类型
		upperSQL := strings.ToUpper(strings.TrimSpace(*event.SQLText))
		if strings.HasPrefix(upperSQL, "SELECT") {
			query.SQLType = models.SQLTypeSelect
		} else if strings.HasPrefix(upperSQL, "INSERT") {
			query.SQLType = models.SQLTypeInsert
		} else if strings.HasPrefix(upperSQL, "UPDATE") {
			query.SQLType = models.SQLTypeUpdate
		} else if strings.HasPrefix(upperSQL, "DELETE") {
			query.SQLType = models.SQLTypeDelete
		} else {
			query.SQLType = models.SQLTypeOther
		}
	}

	if event.Duration != nil {
		query.Duration = *event.Duration
		endTime := event.Timestamp.Add(*event.Duration)
		query.EndTime = &endTime
	}

	if event.IsSlow != nil {
		query.IsSlow = *event.IsSlow
	}

	if event.Error != nil {
		query.Error = *event.Error
	}

	if event.TransactionID != nil {
		query.TransactionID = event.TransactionID
	}

	return imp.store.CreateQuery(query)
}

// ImportQueriesCSV 导入 queries.csv 文件
func (imp *Importer) ImportQueriesCSV(filename string) (*models.ImportResult, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	result := &models.ImportResult{}
	lineNumber := 0

	// 读取表头
	headers, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read headers: %w", err)
	}
	lineNumber++

	headerIndex := make(map[string]int)
	for i, h := range headers {
		headerIndex[strings.ToLower(h)] = i
	}

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read record: %w", err)
		}
		lineNumber++
		result.TotalRecords++

		query := &models.SQLQuery{}

		// 解析必填字段
		if idx, ok := headerIndex["connection_id"]; ok {
			query.ConnectionID = record[idx]
		}
		if idx, ok := headerIndex["request_id"]; ok {
			query.RequestID = record[idx]
		}
		if idx, ok := headerIndex["tenant_id"]; ok {
			query.TenantID = record[idx]
		}

		// 验证必填字段
		if query.ConnectionID == "" {
			result.FailedRecords++
			result.Errors = append(result.Errors, models.ImportError{
				LineNumber: lineNumber,
				RecordType: "query",
				Error:      "missing required field: connection_id",
			})
			continue
		}

		// 解析时间
		if idx, ok := headerIndex["start_time"]; ok {
			if t, err := time.Parse(time.RFC3339, record[idx]); err == nil {
				query.StartTime = t
			}
		}
		if idx, ok := headerIndex["end_time"]; ok && record[idx] != "" {
			if t, err := time.Parse(time.RFC3339, record[idx]); err == nil {
				query.EndTime = &t
			}
		}

		// 解析时长
		if idx, ok := headerIndex["duration_ms"]; ok && record[idx] != "" {
			if ms, err := strconv.ParseInt(record[idx], 10, 64); err == nil {
				query.Duration = time.Duration(ms) * time.Millisecond
			}
		}

		// 解析 SQL 文本
		if idx, ok := headerIndex["sql_text"]; ok {
			query.SQLText = record[idx]
		}

		// 解析 SQL 类型
		if idx, ok := headerIndex["sql_type"]; ok {
			query.SQLType = models.SQLType(strings.ToUpper(record[idx]))
		}

		// 解析是否慢查询
		if idx, ok := headerIndex["is_slow"]; ok {
			query.IsSlow = record[idx] == "true" || record[idx] == "1"
		}

		// 解析错误
		if idx, ok := headerIndex["error"]; ok {
			query.Error = record[idx]
		}

		// 解析事务 ID
		if idx, ok := headerIndex["transaction_id"]; ok && record[idx] != "" {
			query.TransactionID = &record[idx]
		}

		if err := imp.store.CreateQuery(query); err != nil {
			result.FailedRecords++
			result.Errors = append(result.Errors, models.ImportError{
				LineNumber: lineNumber,
				RecordType: "query",
				Error:      err.Error(),
			})
			continue
		}

		result.SuccessRecords++
	}

	return result, nil
}

// ImportTransactionsJSON 导入 transactions.json 文件
func (imp *Importer) ImportTransactionsJSON(filename string) (*models.ImportResult, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var txs []models.Transaction
	if err := json.Unmarshal(data, &txs); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	result := &models.ImportResult{}
	result.TotalRecords = int64(len(txs))

	for i := range txs {
		tx := &txs[i]

		// 验证必填字段
		if tx.ConnectionID == "" {
			result.FailedRecords++
			result.Errors = append(result.Errors, models.ImportError{
				LineNumber: i + 1,
				RecordType: "transaction",
				Error:      "missing required field: connection_id",
			})
			continue
		}

		// 计算时长
		if tx.EndTime != nil {
			tx.Duration = tx.EndTime.Sub(tx.BeginTime)
		}

		if err := imp.store.CreateTransaction(tx); err != nil {
			result.FailedRecords++
			result.Errors = append(result.Errors, models.ImportError{
				LineNumber: i + 1,
				RecordType: "transaction",
				Error:      err.Error(),
			})
			continue
		}

		result.SuccessRecords++
	}

	return result, nil
}

// ImportTenantsCSV 导入 tenants.csv 文件
func (imp *Importer) ImportTenantsCSV(filename string) (*models.ImportResult, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	result := &models.ImportResult{}
	lineNumber := 0

	// 读取表头
	headers, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read headers: %w", err)
	}
	lineNumber++

	headerIndex := make(map[string]int)
	for i, h := range headers {
		headerIndex[strings.ToLower(h)] = i
	}

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read record: %w", err)
		}
		lineNumber++
		result.TotalRecords++

		tenant := &models.Tenant{}

		// 解析字段
		if idx, ok := headerIndex["id"]; ok {
			tenant.ID = record[idx]
		}
		if idx, ok := headerIndex["name"]; ok {
			tenant.Name = record[idx]
		}
		if idx, ok := headerIndex["quota"]; ok {
			if quota, err := strconv.Atoi(record[idx]); err == nil {
				tenant.Quota = quota
			}
		}

		// 验证必填字段
		if tenant.ID == "" {
			result.FailedRecords++
			result.Errors = append(result.Errors, models.ImportError{
				LineNumber: lineNumber,
				RecordType: "tenant",
				Error:      "missing required field: id",
			})
			continue
		}

		if err := imp.store.CreateTenant(tenant); err != nil {
			result.FailedRecords++
			result.Errors = append(result.Errors, models.ImportError{
				LineNumber: lineNumber,
				RecordType: "tenant",
				Error:      err.Error(),
			})
			continue
		}

		result.SuccessRecords++
	}

	return result, nil
}

// ImportPoolConfigYAML 导入 pool-config.yaml 文件
func (imp *Importer) ImportPoolConfigYAML(filename string) (*models.ImportResult, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	type PoolConfigFile struct {
		Name        string        `yaml:"name"`
		MaxOpen     int           `yaml:"max_open"`
		MaxIdle     int           `yaml:"max_idle"`
		IdleTimeout string        `yaml:"idle_timeout"`
		TenantQuota int           `yaml:"tenant_quota"`
	}

	var config PoolConfigFile
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	// 验证配置值
	if config.MaxOpen <= 0 {
		return nil, fmt.Errorf("invalid max_open: must be positive")
	}
	if config.MaxIdle < 0 {
		return nil, fmt.Errorf("invalid max_idle: must be non-negative")
	}
	if config.MaxIdle > config.MaxOpen {
		return nil, fmt.Errorf("max_idle (%d) cannot be greater than max_open (%d)", config.MaxIdle, config.MaxOpen)
	}

	// 解析空闲超时
	idleTimeout, err := time.ParseDuration(config.IdleTimeout)
	if err != nil {
		return nil, fmt.Errorf("invalid idle_timeout: %w", err)
	}
	if idleTimeout <= 0 {
		return nil, fmt.Errorf("idle_timeout must be positive")
	}

	// 创建连接池配置
	pool := &models.ConnectionPool{
		Name:         config.Name,
		MaxOpen:      config.MaxOpen,
		MaxIdle:      config.MaxIdle,
		IdleTimeout:  idleTimeout,
		TenantQuota:  config.TenantQuota,
	}

	if pool.Name == "" {
		pool.Name = "default"
	}

	if err := imp.store.CreatePool(pool); err != nil {
		return nil, fmt.Errorf("failed to create pool: %w", err)
	}

	return &models.ImportResult{
		TotalRecords:   1,
		SuccessRecords: 1,
		FailedRecords:  0,
	}, nil
}
