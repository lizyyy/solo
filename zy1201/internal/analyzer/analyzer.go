package analyzer

import (
	"db-audit/internal/config"
	"db-audit/internal/storage"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	SeverityCritical = "CRITICAL"
	SeverityHigh       = "HIGH"
	SeverityMedium     = "MEDIUM"
	SeverityLow        = "LOW"
	SeverityInfo       = "INFO"
)

const (
	CategoryConnectionPool = "connection_pool"
	CategoryIndex        = "index"
	CategorySlowQuery    = "slow_query"
	CategoryReadWrite    = "read_write"
	CategorySharding     = "sharding"
	CategoryWritePerformance = "write_performance"
)

type Analyzer struct {
	profile *config.AnalysisProfile
	storage *storage.Storage
}

func NewAnalyzer(profile *config.AnalysisProfile, store *storage.Storage) *Analyzer {
	return &Analyzer{
		profile: profile,
		storage: store,
	}
}

func (a *Analyzer) AnalyzeAll(sessionID int64) error {
	if err := a.AnalyzeConnectionPool(sessionID); err != nil {
		return err
	}

	if err := a.AnalyzeIndexes(sessionID); err != nil {
		return err
	}

	if err := a.AnalyzeSlowQueries(sessionID); err != nil {
		return err
	}

	if err := a.AnalyzeReadWrite(sessionID); err != nil {
		return err
	}

	if err := a.AnalyzeSharding(sessionID); err != nil {
		return err
	}

	return a.GenerateBottlenecks(sessionID)
}

func (a *Analyzer) AnalyzeConnectionPool(sessionID int64) error {
	if a.profile.Profile == nil {
		return nil
	}

	poolConfig := a.profile.Profile.ConnectionPool

	var issues []string
	var suggestions []string

	rating := "GOOD"

	if poolConfig.MaxOpenConns == 0 {
		issues = append(issues, "max_open_conns 未设置，可能导致连接数无限制增长")
		suggestions = append(suggestions, "建议根据并发量设置合理的 max_open_conns，通常为 CPU 核数 * 2-4 倍")
		rating = "CRITICAL"
	}

	if poolConfig.MaxOpenConns > 0 && poolConfig.MaxOpenConns < 10 {
		issues = append(issues, fmt.Sprintf("max_open_conns=%d 过小，可能在高并发下导致连接池耗尽", poolConfig.MaxOpenConns))
		suggestions = append(suggestions, "建议增大 max_open_conns 到至少 20-50，根据实际业务 QPS 调整")
		if rating != "CRITICAL" {
			rating = "HIGH"
		}
	}

	if poolConfig.MaxIdleConns > poolConfig.MaxOpenConns && poolConfig.MaxOpenConns > 0 {
		issues = append(issues, fmt.Sprintf("max_idle_conns=%d 大于 max_open_conns=%d，配置不合理", poolConfig.MaxIdleConns, poolConfig.MaxOpenConns))
		suggestions = append(suggestions, "建议 max_idle_conns 应小于等于 max_open_conns")
		if rating == "GOOD" {
			rating = "MEDIUM"
		}
	}

	if poolConfig.ConnMaxLifetime == 0 {
		issues = append(issues, "conn_max_lifetime 未设置，连接可能长时间持有导致连接老化问题")
		suggestions = append(suggestions, "建议设置 conn_max_lifetime 为 30m-1h，避免数据库端超时断开导致的连接失效")
		if rating == "GOOD" {
			rating = "MEDIUM"
		}
	}

	if poolConfig.AcquireTimeout == 0 {
		issues = append(issues, "acquire_timeout 未设置，获取连接超时可能无限等待")
		suggestions = append(suggestions, "建议设置 acquire_timeout 为 30s-1m，避免请求在连接池耗尽时请求堆积")
		if rating == "GOOD" {
			rating = "MEDIUM"
		}
	}

	analysis := &storage.ConnectionPoolAnalysis{
		MaxOpenConns:     poolConfig.MaxOpenConns,
		MaxIdleConns:     poolConfig.MaxIdleConns,
		ConnectionRating: rating,
		Issues:           strings.Join(issues, "; "),
		Suggestions:      strings.Join(suggestions, "; "),
	}

	return a.storage.SaveConnectionPoolAnalysis(sessionID, analysis)
}

func (a *Analyzer) AnalyzeIndexes(sessionID int64) error {
	if a.profile.Schema == nil {
		return nil
	}

	var analyses []storage.IndexAnalysis

	for tableName, table := range a.profile.Schema {
		analyses = append(analyses, a.analyzeTableIndexes(tableName, table)...)
	}

	if len(analyses) > 0 {
		return a.storage.SaveIndexAnalysis(sessionID, analyses)
	}
	return nil
}

func (a *Analyzer) analyzeTableIndexes(tableName string, table *config.TableSchema) []storage.IndexAnalysis {
	var analyses []storage.IndexAnalysis

	hasPrimary := false
	for _, idx := range table.Indexes {
		if idx.IsPrimary {
			hasPrimary = true
			break
		}
	}

	if !hasPrimary {
		analyses = append(analyses, storage.IndexAnalysis{
			TableName:   tableName,
			IndexName:   "(none)",
			IndexType:   "PRIMARY",
			Columns:     "",
			IssueType:   "MISSING_PRIMARY_KEY",
			Severity:    SeverityCritical,
			Description: "表缺少主键",
			Suggestion:  "为表添加主键，推荐使用自增主键或业务主键",
			ImpactScore: 10.0,
		})
	}

	indexesByColumns := make(map[string]string)
	for _, idx := range table.Indexes {
		colKey := strings.Join(idx.Columns, ",")
		indexesByColumns[colKey] = idx.Name

		if len(idx.Columns) > 5 {
			analyses = append(analyses, storage.IndexAnalysis{
				TableName:   tableName,
				IndexName:   idx.Name,
				IndexType:   idx.Type,
				Columns:     strings.Join(idx.Columns, ", "),
				IssueType:   "TOO_MANY_COLUMNS",
				Severity:    SeverityMedium,
				Description: fmt.Sprintf("组合索引包含 %d 个列，可能过多", len(idx.Columns)),
				Suggestion:  "建议评估是否可以拆分为多个简单索引或减少组合索引列数",
				ImpactScore: 5.0,
			})
		}

		if len(idx.Columns) == 1 && idx.Columns[0] == "id" && !idx.IsPrimary {
			analyses = append(analyses, storage.IndexAnalysis{
				TableName:   tableName,
				IndexName:   idx.Name,
				IndexType:   idx.Type,
				Columns:     strings.Join(idx.Columns, ", "),
				IssueType:   "REDUNDANT_INDEX",
				Severity:    SeverityMedium,
				Description: "在主键列上创建了额外的索引",
				Suggestion:  "主键自带索引，可删除该重复索引",
				ImpactScore: 4.0,
			})
		}
	}

	for _, slowLog := range a.profile.SlowLogs {
		sql := strings.ToLower(slowLog.SQL)
		if !strings.Contains(sql, strings.ToLower(tableName)) {
			continue
		}

		whereMatch := regexp.MustCompile(`(?i)where\s+(.+?)(?:\s+group|\s+order|\s+limit|\s+for|$)`).FindStringSubmatch(slowLog.SQL)
		if len(whereMatch) > 1 {
			whereClause := whereMatch[1]

			colMatches := regexp.MustCompile(`(\w+)\s*[<>=!]`).FindAllStringSubmatch(whereClause, -1)
			usedColumns := make(map[string]bool)
			for _, match := range colMatches {
				if len(match) > 1 {
					usedColumns[match[1]] = true
				}
			}

			for col := range usedColumns {
				found := false
				for _, idx := range table.Indexes {
					for _, idxCol := range idx.Columns {
						if strings.EqualFold(idxCol, col) {
							found = true
							break
						}
					}
					if found {
						break
					}
				}

				if !found {
					for _, tableCol := range table.Columns {
						if strings.EqualFold(tableCol.Name, col) {
							analyses = append(analyses, storage.IndexAnalysis{
								TableName:   tableName,
								IndexName:   "(missing)",
								IndexType:   "MISSING",
								Columns:     col,
								IssueType:   "MISSING_INDEX",
								Severity:    SeverityHigh,
								Description: fmt.Sprintf("列 %s 在慢查询中被使用但没有索引", col),
								Suggestion:  fmt.Sprintf("建议为列 %s 创建索引，参考：CREATE INDEX idx_%s_%s ON %s(%s)",
									col, tableName, col, tableName, col),
								ImpactScore: 8.0,
							})
							i++
							break
						}
					}
				}
			}
		}
	}

	return analyses
}

func (a *Analyzer) AnalyzeSlowQueries(sessionID int64) error {
	if len(a.profile.SlowLogs) == 0 {
		return nil
	}

	var analyses []storage.SlowQueryAnalysis

	for _, slowLog := range a.profile.SlowLogs {
		analysis := a.analyzeSingleSlowQuery(slowLog)
		if analysis != nil {
			analyses = append(analyses, *analysis)
		}
	}

	if len(analyses) > 0 {
		return a.storage.SaveSlowQueryAnalysis(sessionID, analyses)
	}
	return nil
}

func (a *Analyzer) analyzeSingleSlowQuery(slowLog config.SlowLogEntry) *storage.SlowQueryAnalysis {
	analysis := &storage.SlowQueryAnalysis{
		QueryTime:    slowLog.QueryTime,
		LockTime:     slowLog.LockTime,
		RowsExamined: slowLog.RowsExamined,
		RowsSent:     slowLog.RowsSent,
		SQL:          slowLog.SQL,
		ImpactScore:  calculateImpactScore(slowLog),
	}

	var issues []string
	var suggestions []string

	analysis.Severity = SeverityInfo

	if slowLog.QueryTime > 10*time.Second {
		analysis.Severity = SeverityCritical
		issues = append(issues, "查询时间超过10秒")
	} else if slowLog.QueryTime > 5*time.Second {
		if analysis.Severity == SeverityInfo {
			analysis.Severity = SeverityHigh
		}
		issues = append(issues, "查询时间超过5秒")
	} else if slowLog.QueryTime > 2*time.Second {
		if analysis.Severity == SeverityInfo {
			analysis.Severity = SeverityMedium
		}
		issues = append(issues, "查询时间超过2秒")
	}

	if slowLog.RowsExamined > slowLog.RowsSent*100 && slowLog.RowsSent > 0 {
		issues = append(issues, "扫描行数远大于返回行数，可能存在全表扫描或低效索引")
		suggestions = append(suggestions, "检查WHERE条件是否有合适的索引，考虑添加索引或优化查询条件")
		if analysis.Severity == SeverityInfo {
			analysis.Severity = SeverityHigh
		}
	}

	if slowLog.FullScan {
		issues = append(issues, "使用了全表扫描")
		suggestions = append(suggestions, "为查询条件添加合适的索引")
		if analysis.Severity == SeverityInfo {
			analysis.Severity = SeverityHigh
		}
	}

	if slowLog.FullJoin {
		issues = append(issues, "使用了全表连接")
		suggestions = append(suggestions, "为连接条件添加索引，或优化JOIN逻辑")
		analysis.Severity = SeverityCritical
	}

	if slowLog.Filesort {
		issues = append(issues, "使用了文件排序（filesort）")
		suggestions = append(suggestions, "为ORDER BY字段添加索引，或调整查询逻辑")
	}

	if slowLog.TmpTable {
		issues = append(issues, "使用了临时表")
		suggestions = append(suggestions, "优化GROUP BY或ORDER BY，添加合适的索引避免临时表")
	}

	if slowLog.TmpDiskTable {
		issues = append(issues, "使用了磁盘临时表")
		suggestions = append(suggestions, "增大tmp_table_size和max_heap_table_size，或优化查询")
		analysis.Severity = SeverityHigh
	}

	sqlLower := strings.ToLower(slowLog.SQL)
	if strings.Contains(sqlLower, "select *") {
		issues = append(issues, "使用了SELECT *")
		suggestions = append(suggestions, "明确指定需要的列名，减少数据传输")
	}

	limitMatch := regexp.MustCompile(`(?i)limit\s+(\d+)(?:\s*,\s*(\d+))?`).FindStringSubmatch(slowLog.SQL)
	if len(limitMatch) == 0 && !strings.Contains(sqlLower, "count(") {
		offsetMatch := regexp.MustCompile(`(?i)offset\s+(\d+)`).FindStringSubmatch(slowLog.SQL)
		if len(offsetMatch) > 1 {
			offset, _ := parseOffset(offsetMatch[1])
			if offset > 10000 {
				issues = append(issues, fmt.Sprintf("使用了大OFFSET深分页（OFFSET %d）", offset))
				suggestions = append(suggestions, "使用游标分页或延迟关联优化深分页")
			}
		}
	}

	if strings.Contains(sqlLower, "like") && strings.Contains(sqlLower, "%") {
		likeMatch := regexp.MustCompile(`like\s+['"]%`).FindStringIndex(sqlLower)
		if likeMatch != nil {
			issues = append(issues, "使用了前导通配符LIKE '%xxx'")
			suggestions = append(suggestions, "前导通配符无法使用索引，考虑使用全文索引或优化查询逻辑")
		}
	}

	analysis.Description = strings.Join(issues, "; ")
	analysis.Suggestion = strings.Join(suggestions, "; ")
	analysis.OptimizedSQL = a.generateOptimizedSQL(slowLog.SQL, issues)

	if len(issues) == 0 {
		return nil
	}

	analysis.AnalysisType = "slow_query"
	return analysis
}

func (a *Analyzer) generateOptimizedSQL(originalSQL string, issues []string) string {
	optimized := originalSQL

	if strings.Contains(originalSQL, "SELECT *") || strings.Contains(originalSQL, "select *") {
		optimized = strings.Replace(optimized, "SELECT *", "SELECT column1, column2", 1)
		optimized = strings.Replace(optimized, "select *", "SELECT column1, column2", 1)
		optimized += " -- 请替换为实际需要的列名"
	}

	for _, issue := range issues {
		if strings.Contains(issue, "全表扫描") {
			optimized += " -- 建议: 为WHERE条件添加索引"
		}
		if strings.Contains(issue, "文件排序") {
			optimized += " -- 建议: 为ORDER BY字段添加索引"
		}
	}

	return optimized
}

func calculateImpactScore(slowLog config.SlowLogEntry) float64 {
	score := 0.0

	score += slowLog.QueryTime.Seconds() * 2

	if slowLog.RowsExamined > 0 {
		score += math.Log10(float64(slowLog.RowsExamined)) * 0.5
	}

	if slowLog.FullScan {
		score += 5.0
	}
	if slowLog.FullJoin {
		score += 10.0
	}
	if slowLog.Filesort {
		score += 3.0
	}
	if slowLog.TmpDiskTable {
		score += 8.0
	} else if slowLog.TmpTable {
		score += 2.0
	}

	return math.Min(score, 100.0)
}

func (a *Analyzer) AnalyzeReadWrite(sessionID int64) error {
	if a.profile.Profile == nil {
		return nil
	}

	rwConfig := a.profile.Profile.ReadWrite

	analysis := &storage.ReadWriteAnalysis{
		ReadWriteEnabled:   rwConfig.Enabled,
		ReadRatio:         rwConfig.ReadRatio,
		ActualReadRatio:   a.calculateActualReadRatio(),
		ReadEndpointCount: len(rwConfig.ReadEndpoints),
	}

	var issues []string
	var suggestions []string

	if rwConfig.Enabled {
		if len(rwConfig.ReadEndpoints) == 0 {
			issues = append(issues, "读写分离已启用但未配置读端点")
			suggestions = append(suggestions, "配置至少一个读端点用于读流量分配")
		}

		if len(rwConfig.ReadEndpoints) == 1 {
			issues = append(issues, "仅配置了单个读端点，无法实现读高可用")
			suggestions = append(suggestions, "配置多个读端点以实现读负载均衡和高可用")
		}

		if rwConfig.ReadRatio <= 0 || rwConfig.ReadRatio > 1 {
			issues = append(issues, fmt.Sprintf("读比例配置不合理: %.2f，应在(0,1)之间", rwConfig.ReadRatio))
			suggestions = append(suggestions, "建议根据实际读写比例调整，通常读多写少场景可设置为0.7-0.9")
		}
	} else {
		if analysis.ActualReadRatio > 0.7 {
			issues = append(issues, "实际读比例较高但未启用读写分离")
			suggestions = append(suggestions, "建议启用读写分离，将读流量分担到从库")
		}
	}

	analysis.Issues = strings.Join(issues, "; ")
	analysis.Suggestions = strings.Join(suggestions, "; ")

	return a.storage.SaveReadWriteAnalysis(sessionID, analysis)
}

func (a *Analyzer) calculateActualReadRatio() float64 {
	if len(a.profile.SlowLogs) == 0 {
		return 0.5
	}

	readCount := 0
	writeCount := 0

	for _, log := range a.profile.SlowLogs {
		sql := strings.ToLower(log.SQL)
		if strings.HasPrefix(sql, "select") {
			readCount++
		} else if strings.HasPrefix(sql, "insert") || strings.HasPrefix(sql, "update") || strings.HasPrefix(sql, "delete") {
			writeCount++
		}
	}

	total := readCount + writeCount
	if total == 0 {
		return 0.5
	}
	return float64(readCount) / float64(total)
}

func (a *Analyzer) AnalyzeSharding(sessionID int64) error {
	if a.profile.Profile == nil {
		return nil
	}

	shardConfig := a.profile.Profile.Sharding

	analysis := &storage.ShardingAnalysis{
		ShardingEnabled: shardConfig.Enabled,
		ShardKey:         shardConfig.ShardKey,
		ShardCount:       shardConfig.ShardCount,
	}

	var issues []string
	var suggestions []string
	var hotspotTables []string

	if shardConfig.Enabled {
		if shardConfig.ShardKey == "" {
			issues = append(issues, "分库分表已启用但未配置分片键")
			suggestions = append(suggestions, "配置分片键，建议选择区分度高的字段如user_id、order_id等")
		}

		if shardConfig.ShardCount <= 0 {
			issues = append(issues, "分片数量配置不合理")
			suggestions = append(suggestions, "分片数量应大于0，建议根据数据量规划分片数为2的幂次")
		}

		if shardConfig.ShardCount == 1 {
			issues = append(issues, "分片数量为1，分库分表无实际意义")
			suggestions = append(suggestions, "考虑关闭分库分表或增加分片数量")
		}

		for tableName, shardTable := range shardConfig.TableMap {
			if shardTable.ShardKey == "" {
				hotspotTables = append(hotspotTables, tableName)
				issues = append(issues, fmt.Sprintf("表 %s 未配置分片键", tableName))
				suggestions = append(suggestions, fmt.Sprintf("为表 %s 配置分片键", tableName))
			}

			if shardTable.Strategy == "" {
				issues = append(issues, fmt.Sprintf("表 %s 未配置分片策略", tableName))
				suggestions = append(suggestions, fmt.Sprintf("为表 %s 配置分片策略（如mod、range、hash）", tableName))
			}
		}

		if shardConfig.Strategy == "mod" && shardConfig.ShardCount > 0 {
			issues = append(issues, "使用取模分片策略，扩容时需要数据迁移")
			suggestions = append(suggestions, "考虑使用一致性哈希或范围分片策略，便于水平扩容")
		}

		hotspotRisk := "LOW"
		if len(hotspotTables) > 0 {
			hotspotRisk = "HIGH"
		} else if shardConfig.ShardKey == "status" || shardConfig.ShardKey == "type" {
			hotspotRisk = "MEDIUM"
			issues = append(issues, "分片键可能区分度较低，存在热点风险")
			suggestions = append(suggestions, "选择区分度更高的字段作为分片键")
		}
		analysis.HotspotRisk = hotspotRisk
	} else {
		if len(a.profile.WriteBatches) > 0 {
			tableStats := make(map[string]int)
			for _, batch := range a.profile.WriteBatches {
				tableStats[batch.Table] += batch.RowCount
			}

			for table, count := range tableStats {
				if count > 10000 {
					issues = append(issues, fmt.Sprintf("表 %s 写入量较大 (%d 行)，建议考虑分库分表", table, count))
					suggestions = append(suggestions, fmt.Sprintf("评估表 %s 是否需要分库分表", table))
				}
			}
		}
	}

	analysis.HotspotTables = strings.Join(hotspotTables, ", ")
	analysis.Suggestions = strings.Join(suggestions, "; ")

	return a.storage.SaveShardingAnalysis(sessionID, analysis)
}

func (a *Analyzer) GenerateBottlenecks(sessionID int64) error {
	var bottlenecks []storage.Bottleneck

	if a.profile.Profile != nil {
		pool := a.profile.Profile.ConnectionPool

		if pool.MaxOpenConns == 0 {
			bottlenecks = append(bottlenecks, storage.Bottleneck{
				Category:    CategoryConnectionPool,
				Description: "连接池未设置最大连接数，存在连接数无限增长风险",
				Severity:    SeverityCritical,
				Priority:    1,
				Impact:      10.0,
			})
		}

		if pool.MaxOpenConns > 0 && pool.MaxOpenConns < 10 {
			bottlenecks = append(bottlenecks, storage.Bottleneck{
				Category:    CategoryConnectionPool,
				Description: fmt.Sprintf("连接池最大连接数过小 (%d)，高并发下可能耗尽", pool.MaxOpenConns),
				Severity:    SeverityHigh,
				Priority:    2,
				Impact:      8.0,
			})
		}
	}

	slowQueryCount := len(a.profile.SlowLogs)
	if slowQueryCount > 0 {
		var maxQueryTime := time.Duration(0)
		for _, log := range a.profile.SlowLogs {
			if log.QueryTime > maxQueryTime {
				maxQueryTime = log.QueryTime
			}
		}

		bottlenecks = append(bottlenecks, storage.Bottleneck{
			Category:    CategorySlowQuery,
			Description: fmt.Sprintf("存在 %d 条慢查询，最长执行时间 %.2fs", slowQueryCount, maxQueryTime.Seconds()),
			Severity:    SeverityHigh,
			Priority:    3,
			Impact:      7.0,
		})
	}

	if a.profile.Schema != nil {
		for tableName, table := range a.profile.Schema {
			hasPrimary := false
			for _, idx := range table.Indexes {
				if idx.IsPrimary {
					hasPrimary = true
					break
				}
			}

			if !hasPrimary {
				bottlenecks = append(bottlenecks, storage.Bottleneck{
					Category:    CategoryIndex,
					Description: fmt.Sprintf("表 %s 缺少主键", tableName),
					Severity:    SeverityCritical,
					Priority:    4,
					Impact:      9.0,
				})
			}
		}
	}

	if len(a.profile.WriteBatches) > 0 {
		singleCount := 0
		batchCount := 0
		for _, batch := range a.profile.WriteBatches {
			if batch.BatchSize == 1 {
				singleCount++
			} else {
				batchCount++
			}
		}

		if singleCount > batchCount && singleCount > 10 {
			bottlenecks = append(bottlenecks, storage.Bottleneck{
				Category:    CategoryWritePerformance,
				Description: fmt.Sprintf("单条写入占比较高 (%d/%d)，建议评估是否可以批量写入", singleCount, singleCount+batchCount),
				Severity:    SeverityMedium,
				Priority:    5,
				Impact:      5.0,
			})
		}
	}

	sort.Slice(bottlenecks, func(i, j int) bool {
		if bottlenecks[i].Priority != bottlenecks[j].Priority {
			return bottlenecks[i].Priority < bottlenecks[j].Priority
		}
		return bottlenecks[i].Impact > bottlenecks[j].Impact
	})

	if len(bottlenecks) > 0 {
		return a.storage.SaveBottlenecks(sessionID, bottlenecks)
	}
	return nil
}

func parseOffset(s string) (int, error) {
	var offset int
	_, err := fmt.Sscanf(s, "%d", &offset)
	return offset, err
}
