package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"memreplay/internal/models"
	"time"

	"github.com/google/uuid"
)

func NewID() string {
	return uuid.New().String()
}

func CreateBatch(batch *models.Batch) error {
	if batch.ID == "" {
		batch.ID = NewID()
	}
	if batch.CreatedAt.IsZero() {
		batch.CreatedAt = time.Now()
	}

	query := `INSERT INTO batches (id, name, description, created_at, service_name)
	          VALUES (?, ?, ?, ?, ?)`
	_, err := db.Exec(query, batch.ID, batch.Name, batch.Description, batch.CreatedAt, batch.ServiceName)
	if err != nil {
		return fmt.Errorf("创建批次失败: %w", err)
	}
	return nil
}

func GetBatch(id string) (*models.Batch, error) {
	query := `SELECT id, name, description, created_at, service_name FROM batches WHERE id = ?`
	row := db.QueryRow(query, id)

	var batch models.Batch
	err := row.Scan(&batch.ID, &batch.Name, &batch.Description, &batch.CreatedAt, &batch.ServiceName)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("批次不存在: %s", id)
		}
		return nil, fmt.Errorf("获取批次失败: %w", err)
	}
	return &batch, nil
}

func GetBatchByName(name string) (*models.Batch, error) {
	query := `SELECT id, name, description, created_at, service_name FROM batches WHERE name = ?`
	row := db.QueryRow(query, name)

	var batch models.Batch
	err := row.Scan(&batch.ID, &batch.Name, &batch.Description, &batch.CreatedAt, &batch.ServiceName)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("批次不存在: %s", name)
		}
		return nil, fmt.Errorf("获取批次失败: %w", err)
	}
	return &batch, nil
}

func ListBatches() ([]models.Batch, error) {
	query := `SELECT id, name, description, created_at, service_name FROM batches ORDER BY created_at DESC`
	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("查询批次列表失败: %w", err)
	}
	defer rows.Close()

	var batches []models.Batch
	for rows.Next() {
		var batch models.Batch
		if err := rows.Scan(&batch.ID, &batch.Name, &batch.Description, &batch.CreatedAt, &batch.ServiceName); err != nil {
			return nil, fmt.Errorf("扫描批次失败: %w", err)
		}
		batches = append(batches, batch)
	}
	return batches, nil
}

func CreateSamplePoint(sp *models.SamplePoint) error {
	if sp.ID == "" {
		sp.ID = NewID()
	}
	if sp.Timestamp.IsZero() {
		sp.Timestamp = time.Now()
	}

	query := `INSERT INTO sample_points (id, batch_id, timestamp, description, source_type)
	          VALUES (?, ?, ?, ?, ?)`
	_, err := db.Exec(query, sp.ID, sp.BatchID, sp.Timestamp, sp.Description, sp.SourceType)
	if err != nil {
		return fmt.Errorf("创建采样点失败: %w", err)
	}
	return nil
}

func CreateMemStatsRecord(record *models.MemStatsRecord) error {
	if record.ID == "" {
		record.ID = NewID()
	}

	query := `INSERT INTO mem_stats (
		id, sample_point_id, timestamp, alloc, total_alloc, sys, lookups, mallocs, frees,
		heap_alloc, heap_sys, heap_idle, heap_inuse, heap_released, heap_objects,
		stack_inuse, stack_sys, mspan_inuse, mspan_sys, mcache_inuse, mcache_sys,
		buck_hash_sys, gc_sys, other_sys, next_gc, last_gc, pause_total_ns,
		num_gc, num_forced_gc, gc_cpu_fraction, rss
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := db.Exec(query,
		record.ID, record.SamplePointID, record.Timestamp,
		record.Alloc, record.TotalAlloc, record.Sys, record.Lookups, record.Mallocs, record.Frees,
		record.HeapAlloc, record.HeapSys, record.HeapIdle, record.HeapInuse, record.HeapReleased, record.HeapObjects,
		record.StackInuse, record.StackSys, record.MSpanInuse, record.MSpanSys, record.MCacheInuse, record.MCacheSys,
		record.BuckHashSys, record.GCSys, record.OtherSys, record.NextGC, record.LastGC, record.PauseTotalNs,
		record.NumGC, record.NumForcedGC, record.GCCPUFraction, record.RSS,
	)
	if err != nil {
		return fmt.Errorf("创建 MemStats 记录失败: %w", err)
	}
	return nil
}

func CreateGoroutineRecord(record *models.GoroutineRecord) error {
	if record.ID == "" {
		record.ID = NewID()
	}

	query := `INSERT INTO goroutines (
		id, sample_point_id, goroutine_id, status, stack, function, file, line, wait_duration, timestamp
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := db.Exec(query,
		record.ID, record.SamplePointID, record.GoroutineID,
		record.Status, record.Stack, record.Function, record.File, record.Line,
		record.WaitDuration, record.Timestamp,
	)
	if err != nil {
		return fmt.Errorf("创建 Goroutine 记录失败: %w", err)
	}
	return nil
}

func CreateAllocSite(site *models.AllocSite) error {
	if site.ID == "" {
		site.ID = NewID()
	}

	query := `INSERT INTO alloc_sites (
		id, sample_point_id, function, file, line, alloc_bytes, alloc_objects,
		inuse_bytes, inuse_objects, stack_id, timestamp
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := db.Exec(query,
		site.ID, site.SamplePointID, site.Function, site.File, site.Line,
		site.AllocBytes, site.AllocObjects, site.InuseBytes, site.InuseObjects,
		site.StackID, site.Timestamp,
	)
	if err != nil {
		return fmt.Errorf("创建 AllocSite 记录失败: %w", err)
	}
	return nil
}

func CreateTrafficRecord(record *models.TrafficRecord) error {
	if record.ID == "" {
		record.ID = NewID()
	}

	query := `INSERT INTO traffic (
		id, sample_point_id, timestamp, endpoint, method, requests, errors,
		latency_p50, latency_p99, qps
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := db.Exec(query,
		record.ID, record.SamplePointID, record.Timestamp,
		record.Endpoint, record.Method, record.Requests, record.Errors,
		record.LatencyP50, record.LatencyP99, record.QPS,
	)
	if err != nil {
		return fmt.Errorf("创建 Traffic 记录失败: %w", err)
	}
	return nil
}

func CreateConfigRecord(record *models.ConfigRecord) error {
	if record.ID == "" {
		record.ID = NewID()
	}

	query := `INSERT INTO configs (
		id, sample_point_id, key, value, source, timestamp
	) VALUES (?, ?, ?, ?, ?, ?)`

	_, err := db.Exec(query,
		record.ID, record.SamplePointID, record.Key, record.Value,
		record.Source, record.Timestamp,
	)
	if err != nil {
		return fmt.Errorf("创建 Config 记录失败: %w", err)
	}
	return nil
}

func CreateHeapProfileRecord(record *models.HeapProfileRecord) error {
	if record.ID == "" {
		record.ID = NewID()
	}

	query := `INSERT INTO heap_profiles (
		id, sample_point_id, type, function, file, line,
		inuse_bytes, inuse_objects, alloc_bytes, alloc_objects, timestamp
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := db.Exec(query,
		record.ID, record.SamplePointID, record.Type, record.Function, record.File, record.Line,
		record.InuseBytes, record.InuseObjects, record.AllocBytes, record.AllocObjects, record.Timestamp,
	)
	if err != nil {
		return fmt.Errorf("创建 HeapProfile 记录失败: %w", err)
	}
	return nil
}

func SaveAnalysisResult(result *models.AnalysisResult) error {
	if result.ID == "" {
		result.ID = NewID()
	}
	if result.CreatedAt.IsZero() {
		result.CreatedAt = time.Now()
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("开始事务失败: %w", err)
	}
	defer tx.Rollback()

	query := `INSERT INTO analysis_results (id, batch_id, created_at, conclusion, confidence, risk_level)
	          VALUES (?, ?, ?, ?, ?, ?)`
	_, err = tx.Exec(query, result.ID, result.BatchID, result.CreatedAt, result.Conclusion, result.Confidence, result.RiskLevel)
	if err != nil {
		return fmt.Errorf("保存分析结果失败: %w", err)
	}

	for _, f := range result.Findings {
		if f.ID == "" {
			f.ID = NewID()
		}
		f.AnalysisID = result.ID
		query := `INSERT INTO findings (id, analysis_id, category, title, description, confidence, severity, source)
		          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		_, err = tx.Exec(query, f.ID, f.AnalysisID, f.Category, f.Title, f.Description, f.Confidence, f.Severity, f.Source)
		if err != nil {
			return fmt.Errorf("保存发现失败: %w", err)
		}
	}

	for _, e := range result.Evidence {
		if e.ID == "" {
			e.ID = NewID()
		}
		e.AnalysisID = result.ID
		query := `INSERT INTO evidence (id, analysis_id, finding_id, type, value, details, source)
		          VALUES (?, ?, ?, ?, ?, ?, ?)`
		_, err = tx.Exec(query, e.ID, e.AnalysisID, e.FindingID, e.Type, e.Value, e.Details, e.Source)
		if err != nil {
			return fmt.Errorf("保存证据失败: %w", err)
		}
	}

	for _, r := range result.Recommendations {
		if r.ID == "" {
			r.ID = NewID()
		}
		r.AnalysisID = result.ID
		query := `INSERT INTO recommendations (id, analysis_id, priority, action, details)
		          VALUES (?, ?, ?, ?, ?)`
		_, err = tx.Exec(query, r.ID, r.AnalysisID, r.Priority, r.Action, r.Details)
		if err != nil {
			return fmt.Errorf("保存建议失败: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("提交事务失败: %w", err)
	}
	return nil
}

func SaveCompareResult(result *models.CompareResult) error {
	if result.ID == "" {
		result.ID = NewID()
	}
	if result.CreatedAt.IsZero() {
		result.CreatedAt = time.Now()
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("开始事务失败: %w", err)
	}
	defer tx.Rollback()

	query := `INSERT INTO compare_results (id, base_batch_id, target_batch_id, created_at, conclusion, confidence)
	          VALUES (?, ?, ?, ?, ?, ?)`
	_, err = tx.Exec(query, result.ID, result.BaseBatchID, result.TargetBatchID, result.CreatedAt, result.Conclusion, result.Confidence)
	if err != nil {
		return fmt.Errorf("保存对比结果失败: %w", err)
	}

	for _, d := range result.Differences {
		if d.ID == "" {
			d.ID = NewID()
		}
		d.CompareID = result.ID
		query := `INSERT INTO differences (id, compare_id, category, metric, base_value, target_value, change_pct, importance, description)
		          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		_, err = tx.Exec(query, d.ID, d.CompareID, d.Category, d.Metric, d.BaseValue, d.TargetValue, d.ChangePct, d.Importance, d.Description)
		if err != nil {
			return fmt.Errorf("保存差异失败: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("提交事务失败: %w", err)
	}
	return nil
}

func SaveSimulationResult(params *models.SimulationParams, result *models.SimulationResult) error {
	if params.ID == "" {
		params.ID = NewID()
	}
	if params.CreatedAt.IsZero() {
		params.CreatedAt = time.Now()
	}
	if result.ID == "" {
		result.ID = NewID()
	}
	if result.CreatedAt.IsZero() {
		result.CreatedAt = time.Now()
	}
	result.ParamsID = params.ID

	paramsJSON, err := json.Marshal(params.Params)
	if err != nil {
		return fmt.Errorf("序列化模拟参数失败: %w", err)
	}

	metricsJSON, err := json.Marshal(result.Metrics)
	if err != nil {
		return fmt.Errorf("序列化指标失败: %w", err)
	}

	warningsJSON, err := json.Marshal(result.Warnings)
	if err != nil {
		return fmt.Errorf("序列化警告失败: %w", err)
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("开始事务失败: %w", err)
	}
	defer tx.Rollback()

	query := `INSERT INTO simulation_params (id, name, created_at, params)
	          VALUES (?, ?, ?, ?)`
	_, err = tx.Exec(query, params.ID, params.Name, params.CreatedAt, string(paramsJSON))
	if err != nil {
		return fmt.Errorf("保存模拟参数失败: %w", err)
	}

	query = `INSERT INTO simulation_results (id, params_id, created_at, risk_level, metrics, conclusion, warnings)
	          VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err = tx.Exec(query, result.ID, result.ParamsID, result.CreatedAt, result.RiskLevel, string(metricsJSON), result.Conclusion, string(warningsJSON))
	if err != nil {
		return fmt.Errorf("保存模拟结果失败: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("提交事务失败: %w", err)
	}
	return nil
}

func GetMemStatsByBatch(batchID string) ([]models.MemStatsRecord, error) {
	query := `SELECT ms.id, ms.sample_point_id, ms.timestamp, ms.alloc, ms.total_alloc, ms.sys, 
	          ms.lookups, ms.mallocs, ms.frees, ms.heap_alloc, ms.heap_sys, ms.heap_idle, 
	          ms.heap_inuse, ms.heap_released, ms.heap_objects, ms.stack_inuse, ms.stack_sys, 
	          ms.mspan_inuse, ms.mspan_sys, ms.mcache_inuse, ms.mcache_sys, ms.buck_hash_sys, 
	          ms.gc_sys, ms.other_sys, ms.next_gc, ms.last_gc, ms.pause_total_ns, 
	          ms.num_gc, ms.num_forced_gc, ms.gc_cpu_fraction, ms.rss
	          FROM mem_stats ms
	          JOIN sample_points sp ON ms.sample_point_id = sp.id
	          WHERE sp.batch_id = ?
	          ORDER BY ms.timestamp ASC`

	rows, err := db.Query(query, batchID)
	if err != nil {
		return nil, fmt.Errorf("查询 MemStats 失败: %w", err)
	}
	defer rows.Close()

	var records []models.MemStatsRecord
	for rows.Next() {
		var r models.MemStatsRecord
		err := rows.Scan(
			&r.ID, &r.SamplePointID, &r.Timestamp, &r.Alloc, &r.TotalAlloc, &r.Sys,
			&r.Lookups, &r.Mallocs, &r.Frees, &r.HeapAlloc, &r.HeapSys, &r.HeapIdle,
			&r.HeapInuse, &r.HeapReleased, &r.HeapObjects, &r.StackInuse, &r.StackSys,
			&r.MSpanInuse, &r.MSpanSys, &r.MCacheInuse, &r.MCacheSys, &r.BuckHashSys,
			&r.GCSys, &r.OtherSys, &r.NextGC, &r.LastGC, &r.PauseTotalNs,
			&r.NumGC, &r.NumForcedGC, &r.GCCPUFraction, &r.RSS,
		)
		if err != nil {
			return nil, fmt.Errorf("扫描 MemStats 失败: %w", err)
		}
		records = append(records, r)
	}
	return records, nil
}

func GetGoroutinesByBatch(batchID string) ([]models.GoroutineRecord, error) {
	query := `SELECT g.id, g.sample_point_id, g.goroutine_id, g.status, g.stack, 
	          g.function, g.file, g.line, g.wait_duration, g.timestamp
	          FROM goroutines g
	          JOIN sample_points sp ON g.sample_point_id = sp.id
	          WHERE sp.batch_id = ?
	          ORDER BY g.timestamp ASC, g.goroutine_id ASC`

	rows, err := db.Query(query, batchID)
	if err != nil {
		return nil, fmt.Errorf("查询 Goroutines 失败: %w", err)
	}
	defer rows.Close()

	var records []models.GoroutineRecord
	for rows.Next() {
		var r models.GoroutineRecord
		err := rows.Scan(
			&r.ID, &r.SamplePointID, &r.GoroutineID, &r.Status, &r.Stack,
			&r.Function, &r.File, &r.Line, &r.WaitDuration, &r.Timestamp,
		)
		if err != nil {
			return nil, fmt.Errorf("扫描 Goroutine 失败: %w", err)
		}
		records = append(records, r)
	}
	return records, nil
}

func GetAllocSitesByBatch(batchID string) ([]models.AllocSite, error) {
	query := `SELECT a.id, a.sample_point_id, a.function, a.file, a.line,
	          a.alloc_bytes, a.alloc_objects, a.inuse_bytes, a.inuse_objects,
	          a.stack_id, a.timestamp
	          FROM alloc_sites a
	          JOIN sample_points sp ON a.sample_point_id = sp.id
	          WHERE sp.batch_id = ?
	          ORDER BY a.inuse_bytes DESC`

	rows, err := db.Query(query, batchID)
	if err != nil {
		return nil, fmt.Errorf("查询 AllocSites 失败: %w", err)
	}
	defer rows.Close()

	var sites []models.AllocSite
	for rows.Next() {
		var s models.AllocSite
		err := rows.Scan(
			&s.ID, &s.SamplePointID, &s.Function, &s.File, &s.Line,
			&s.AllocBytes, &s.AllocObjects, &s.InuseBytes, &s.InuseObjects,
			&s.StackID, &s.Timestamp,
		)
		if err != nil {
			return nil, fmt.Errorf("扫描 AllocSite 失败: %w", err)
		}
		sites = append(sites, s)
	}
	return sites, nil
}

func GetTrafficByBatch(batchID string) ([]models.TrafficRecord, error) {
	query := `SELECT t.id, t.sample_point_id, t.timestamp, t.endpoint, t.method,
	          t.requests, t.errors, t.latency_p50, t.latency_p99, t.qps
	          FROM traffic t
	          JOIN sample_points sp ON t.sample_point_id = sp.id
	          WHERE sp.batch_id = ?
	          ORDER BY t.timestamp ASC`

	rows, err := db.Query(query, batchID)
	if err != nil {
		return nil, fmt.Errorf("查询 Traffic 失败: %w", err)
	}
	defer rows.Close()

	var records []models.TrafficRecord
	for rows.Next() {
		var r models.TrafficRecord
		err := rows.Scan(
			&r.ID, &r.SamplePointID, &r.Timestamp, &r.Endpoint, &r.Method,
			&r.Requests, &r.Errors, &r.LatencyP50, &r.LatencyP99, &r.QPS,
		)
		if err != nil {
			return nil, fmt.Errorf("扫描 Traffic 失败: %w", err)
		}
		records = append(records, r)
	}
	return records, nil
}

func GetConfigsByBatch(batchID string) ([]models.ConfigRecord, error) {
	query := `SELECT c.id, c.sample_point_id, c.key, c.value, c.source, c.timestamp
	          FROM configs c
	          JOIN sample_points sp ON c.sample_point_id = sp.id
	          WHERE sp.batch_id = ?
	          ORDER BY c.key ASC`

	rows, err := db.Query(query, batchID)
	if err != nil {
		return nil, fmt.Errorf("查询 Configs 失败: %w", err)
	}
	defer rows.Close()

	var records []models.ConfigRecord
	for rows.Next() {
		var r models.ConfigRecord
		err := rows.Scan(
			&r.ID, &r.SamplePointID, &r.Key, &r.Value, &r.Source, &r.Timestamp,
		)
		if err != nil {
			return nil, fmt.Errorf("扫描 Config 失败: %w", err)
		}
		records = append(records, r)
	}
	return records, nil
}

func GetHeapProfilesByBatch(batchID string) ([]models.HeapProfileRecord, error) {
	query := `SELECT h.id, h.sample_point_id, h.type, h.function, h.file, h.line,
	          h.inuse_bytes, h.inuse_objects, h.alloc_bytes, h.alloc_objects, h.timestamp
	          FROM heap_profiles h
	          JOIN sample_points sp ON h.sample_point_id = sp.id
	          WHERE sp.batch_id = ?
	          ORDER BY h.inuse_bytes DESC`

	rows, err := db.Query(query, batchID)
	if err != nil {
		return nil, fmt.Errorf("查询 HeapProfiles 失败: %w", err)
	}
	defer rows.Close()

	var records []models.HeapProfileRecord
	for rows.Next() {
		var r models.HeapProfileRecord
		err := rows.Scan(
			&r.ID, &r.SamplePointID, &r.Type, &r.Function, &r.File, &r.Line,
			&r.InuseBytes, &r.InuseObjects, &r.AllocBytes, &r.AllocObjects, &r.Timestamp,
		)
		if err != nil {
			return nil, fmt.Errorf("扫描 HeapProfile 失败: %w", err)
		}
		records = append(records, r)
	}
	return records, nil
}
