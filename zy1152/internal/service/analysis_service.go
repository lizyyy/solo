package service

import (
	"database/sql"

	"cache-risk-analyzer/internal/db"
	"cache-risk-analyzer/internal/model"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"time"
)

type RiskAnalysisResult struct {
	TotalRisks  int64        `json:"total_risks"`
	Critical    int64        `json:"critical"`
	High        int64        `json:"high"`
	Medium      int64        `json:"medium"`
	Low         int64        `json:"low"`
	Risks       []RiskDetail `json:"risks"`
	Summary     RiskSummary  `json:"summary"`
	GeneratedAt time.Time    `json:"generated_at"`
}

type RiskDetail struct {
	ID                int64                  `json:"id,omitempty"`
	RiskType          string                 `json:"risk_type"`
	Severity          string                 `json:"severity"`
	BusinessDomain    string                 `json:"business_domain"`
	CacheKey          string                 `json:"cache_key,omitempty"`
	Evidence          map[string]interface{} `json:"evidence"`
	ImpactScore       float64                `json:"impact_score"`
	RecommendedAction string                 `json:"recommended_action"`
	DetectedAt        time.Time              `json:"detected_at"`
}

type RiskSummary struct {
	TopRisks        []string `json:"top_risks"`
	AffectedDomains []string `json:"affected_domains"`
	MaxImpactScore  float64  `json:"max_impact_score"`
}

type KeyAccessStats struct {
	CacheKey       string
	BusinessDomain string
	TotalRequests  int64
	MissCount      int64
	MissRate       float64
	AvgLatency     float64
	TTL            int64
	ExpireAt       time.Time
}

type TTLAnalysis struct {
	TimeWindow       time.Time
	KeyCount         int64
	TotalAccessCount int64
}

func AnalyzeAllRisks() (*RiskAnalysisResult, error) {
	result := &RiskAnalysisResult{
		GeneratedAt: time.Now(),
	}

	thresholds, err := GetThresholdConfig()
	if err != nil {
		return nil, err
	}

	database := db.GetDB()

	var allRisks []RiskDetail

	penetrationRisks, err := analyzeCachePenetration(database, thresholds)
	if err != nil {
		return nil, fmt.Errorf("penetration analysis failed: %v", err)
	}
	allRisks = append(allRisks, penetrationRisks...)

	breakdownRisks, err := analyzeHotKeyBreakdown(database, thresholds)
	if err != nil {
		return nil, fmt.Errorf("hotkey breakdown analysis failed: %v", err)
	}
	allRisks = append(allRisks, breakdownRisks...)

	avalancheRisks, err := analyzeTTLAvalanche(database, thresholds)
	if err != nil {
		return nil, fmt.Errorf("TTL avalanche analysis failed: %v", err)
	}
	allRisks = append(allRisks, avalancheRisks...)

	negativeCacheRisks, err := analyzeNegativeCacheGap(database, thresholds)
	if err != nil {
		return nil, fmt.Errorf("negative cache gap analysis failed: %v", err)
	}
	allRisks = append(allRisks, negativeCacheRisks...)

	prewarmRisks, err := analyzePrewarmGap(database, thresholds)
	if err != nil {
		return nil, fmt.Errorf("prewarm gap analysis failed: %v", err)
	}
	allRisks = append(allRisks, prewarmRisks...)

	bloomRisks, err := analyzeBloomFilterRisk(database, thresholds)
	if err != nil {
		return nil, fmt.Errorf("bloom filter risk analysis failed: %v", err)
	}
	allRisks = append(allRisks, bloomRisks...)

	mutexRisks, err := analyzeMutexWaitRisk(database, thresholds)
	if err != nil {
		return nil, fmt.Errorf("mutex wait risk analysis failed: %v", err)
	}
	allRisks = append(allRisks, mutexRisks...)

	staleRisks, err := analyzeStaleRevalidate(database, thresholds)
	if err != nil {
		return nil, fmt.Errorf("stale revalidate analysis failed: %v", err)
	}
	allRisks = append(allRisks, staleRisks...)

	sort.Slice(allRisks, func(i, j int) bool {
		severityOrder := map[string]int{"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
		si := severityOrder[allRisks[i].Severity]
		sj := severityOrder[allRisks[j].Severity]
		if si != sj {
			return si < sj
		}
		return allRisks[i].ImpactScore > allRisks[j].ImpactScore
	})

	for _, r := range allRisks {
		result.TotalRisks++
		switch r.Severity {
		case "CRITICAL":
			result.Critical++
		case "HIGH":
			result.High++
		case "MEDIUM":
			result.Medium++
		case "LOW":
			result.Low++
		}
	}

	result.Risks = allRisks
	result.Summary = buildRiskSummary(allRisks)

	if err := saveRiskEvents(allRisks); err != nil {
		return nil, fmt.Errorf("failed to save risk events: %v", err)
	}

	return result, nil
}

func analyzeCachePenetration(db *sql.DB, thresholds *model.ThresholdConfig) ([]RiskDetail, error) {
	var risks []RiskDetail

	query := `
		SELECT 
			cache_key,
			business_domain,
			COUNT(*) as total,
			SUM(CASE WHEN is_hit = 0 THEN 1 ELSE 0 END) as misses,
			AVG(backend_latency_ms) as avg_latency
		FROM cache_events
		GROUP BY cache_key, business_domain
		HAVING misses > 0
		ORDER BY misses DESC
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	invalidKeys := make(map[string]KeyAccessStats)
	domains := make(map[string]bool)

	for rows.Next() {
		var stats KeyAccessStats
		var total int64

		if err := rows.Scan(&stats.CacheKey, &stats.BusinessDomain, &total, &stats.MissCount, &stats.AvgLatency); err != nil {
			return nil, err
		}

		stats.TotalRequests = total
		stats.MissRate = float64(stats.MissCount) / float64(total)

		if stats.MissRate >= 1.0 && stats.TotalRequests >= 10 {
			invalidKeys[stats.CacheKey] = stats
			domains[stats.BusinessDomain] = true
		}
	}

	if len(invalidKeys) > 0 {
		evidence := map[string]interface{}{
			"invalid_key_count":   len(invalidKeys),
			"affected_domains":    mapKeys(domains),
			"threshold_miss_rate": thresholds.PenetrationMissRateThreshold,
			"top_invalid_keys":    topNKeys(invalidKeys, 10),
		}

		var maxImpact float64
		var worstKey string
		var worstDomain string

		for k, v := range invalidKeys {
			impact := float64(v.MissCount) * v.AvgLatency / 1000.0
			if impact > maxImpact {
				maxImpact = impact
				worstKey = k
				worstDomain = v.BusinessDomain
			}
		}

		severity := "MEDIUM"
		if len(invalidKeys) > 50 || maxImpact > 1000 {
			severity = "HIGH"
		}
		if len(invalidKeys) > 200 || maxImpact > 10000 {
			severity = "CRITICAL"
		}

		risks = append(risks, RiskDetail{
			RiskType:          "CACHE_PENETRATION",
			Severity:          severity,
			BusinessDomain:    worstDomain,
			CacheKey:          worstKey,
			Evidence:          evidence,
			ImpactScore:       maxImpact,
			RecommendedAction: "Implement negative cache for invalid keys, add input validation, consider Bloom Filter for key existence check",
			DetectedAt:        time.Now(),
		})
	}

	return risks, nil
}

func analyzeHotKeyBreakdown(db *sql.DB, thresholds *model.ThresholdConfig) ([]RiskDetail, error) {
	var risks []RiskDetail

	query := `
		SELECT 
			ce.cache_key,
			ce.business_domain,
			COUNT(*) as access_count,
			SUM(CASE WHEN ce.is_hit = 0 THEN 1 ELSE 0 END) as miss_count,
			AVG(ce.backend_latency_ms) as avg_latency,
			ck.ttl_seconds,
			ck.expire_at,
			ck.is_hot
		FROM cache_events ce
		LEFT JOIN cache_keys ck ON ce.cache_key = ck.cache_key AND ce.business_domain = ck.business_domain
		GROUP BY ce.cache_key, ce.business_domain
		HAVING access_count > ?
		ORDER BY access_count DESC
	`

	rows, err := db.Query(query, thresholds.HotKeyAccessThreshold/10)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hotKeys := make(map[string]KeyAccessStats)

	for rows.Next() {
		var stats KeyAccessStats
		var isHot sql.NullBool
		var expireAt sql.NullTime

		if err := rows.Scan(
			&stats.CacheKey, &stats.BusinessDomain, &stats.TotalRequests,
			&stats.MissCount, &stats.AvgLatency, &stats.TTL, &expireAt, &isHot,
		); err != nil {
			return nil, err
		}

		if expireAt.Valid {
			stats.ExpireAt = expireAt.Time
		}
		stats.MissRate = float64(stats.MissCount) / float64(stats.TotalRequests)

		if stats.TotalRequests >= thresholds.HotKeyAccessThreshold {
			hotKeys[stats.CacheKey] = stats
		}
	}

	for key, stats := range hotKeys {
		aboutToExpire := false
		if !stats.ExpireAt.IsZero() {
			timeToExpire := stats.ExpireAt.Sub(time.Now())
			aboutToExpire = timeToExpire < 5*time.Minute && timeToExpire > 0
		}

		highMissRate := stats.MissRate > 0.3

		if aboutToExpire || highMissRate {
			evidence := map[string]interface{}{
				"key":              key,
				"business_domain":  stats.BusinessDomain,
				"access_count":     stats.TotalRequests,
				"miss_rate":        stats.MissRate,
				"ttl_seconds":      stats.TTL,
				"about_to_expire":  aboutToExpire,
				"threshold_access": thresholds.HotKeyAccessThreshold,
			}

			impact := float64(stats.TotalRequests) * stats.AvgLatency / 1000.0

			severity := "MEDIUM"
			if stats.TotalRequests > thresholds.HotKeyAccessThreshold*5 {
				severity = "HIGH"
			}
			if stats.TotalRequests > thresholds.HotKeyAccessThreshold*20 && aboutToExpire {
				severity = "CRITICAL"
			}

			risks = append(risks, RiskDetail{
				RiskType:          "HOT_KEY_BREAKDOWN",
				Severity:          severity,
				BusinessDomain:    stats.BusinessDomain,
				CacheKey:          key,
				Evidence:          evidence,
				ImpactScore:       impact,
				RecommendedAction: "Pre-warm this hot key, extend TTL, use multi-level cache, or implement mutex lock for concurrent misses",
				DetectedAt:        time.Now(),
			})
		}
	}

	return risks, nil
}

func analyzeTTLAvalanche(db *sql.DB, thresholds *model.ThresholdConfig) ([]RiskDetail, error) {
	var risks []RiskDetail

	query := `
		SELECT 
			strftime('%Y-%m-%d %H:00:00', expire_at) as time_window,
			COUNT(*) as key_count,
			SUM(access_count) as total_access
		FROM cache_keys
		WHERE expire_at > ?
		GROUP BY time_window
		ORDER BY total_access DESC
	`

	rows, err := db.Query(query, time.Now())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var windows []TTLAnalysis
	var totalKeys int64
	var maxAccess int64

	for rows.Next() {
		var w TTLAnalysis
		var timeWindowStr string

		if err := rows.Scan(&timeWindowStr, &w.KeyCount, &w.TotalAccessCount); err != nil {
			return nil, err
		}

		w.TimeWindow, _ = time.Parse("2006-01-02 15:04:05", timeWindowStr)
		windows = append(windows, w)
		totalKeys += w.KeyCount
		if w.TotalAccessCount > maxAccess {
			maxAccess = w.TotalAccessCount
		}
	}

	if len(windows) == 0 {
		return risks, nil
	}

	avgKeysPerWindow := float64(totalKeys) / float64(len(windows))

	for _, w := range windows {
		clusterRatio := float64(w.KeyCount) / math.Max(avgKeysPerWindow, 1)

		if clusterRatio >= thresholds.TTLClusterThreshold && w.KeyCount > 10 {
			evidence := map[string]interface{}{
				"time_window":            w.TimeWindow.Format(time.RFC3339),
				"keys_in_window":         w.KeyCount,
				"total_access_in_window": w.TotalAccessCount,
				"cluster_ratio":          clusterRatio,
				"avg_keys_per_window":    avgKeysPerWindow,
				"threshold_ratio":        thresholds.TTLClusterThreshold,
			}

			impact := float64(w.TotalAccessCount)

			severity := "LOW"
			if clusterRatio > 2.0 {
				severity = "MEDIUM"
			}
			if clusterRatio > 5.0 {
				severity = "HIGH"
			}
			if clusterRatio > 10.0 && w.TotalAccessCount > 10000 {
				severity = "CRITICAL"
			}

			risks = append(risks, RiskDetail{
				RiskType:          "TTL_AVALANCHE",
				Severity:          severity,
				BusinessDomain:    "MULTIPLE",
				Evidence:          evidence,
				ImpactScore:       impact,
				RecommendedAction: "Add TTL random jitter (±10-30%), stagger key expirations, or use perpetual TTL with active refresh",
				DetectedAt:        time.Now(),
			})
		}
	}

	return risks, nil
}

func analyzeNegativeCacheGap(db *sql.DB, thresholds *model.ThresholdConfig) ([]RiskDetail, error) {
	var risks []RiskDetail

	query := `
		SELECT 
			cache_key,
			business_domain,
			COUNT(*) as miss_count,
			AVG(backend_latency_ms) as avg_latency
		FROM cache_events
		WHERE is_hit = 0
		GROUP BY cache_key, business_domain
		HAVING miss_count >= 5
		ORDER BY miss_count DESC
		LIMIT 100
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var highMissKeys []KeyAccessStats
	totalMisses := int64(0)

	for rows.Next() {
		var stats KeyAccessStats
		if err := rows.Scan(&stats.CacheKey, &stats.BusinessDomain, &stats.MissCount, &stats.AvgLatency); err != nil {
			return nil, err
		}
		highMissKeys = append(highMissKeys, stats)
		totalMisses += stats.MissCount
	}

	if len(highMissKeys) > 20 {
		evidence := map[string]interface{}{
			"frequently_missed_keys": len(highMissKeys),
			"total_miss_events":      totalMisses,
			"top_missed_keys":        firstNStats(highMissKeys, 10),
		}

		impact := float64(totalMisses)

		severity := "LOW"
		if len(highMissKeys) > 50 {
			severity = "MEDIUM"
		}
		if len(highMissKeys) > 100 && totalMisses > 10000 {
			severity = "HIGH"
		}

		risks = append(risks, RiskDetail{
			RiskType:          "NEGATIVE_CACHE_MISSING",
			Severity:          severity,
			BusinessDomain:    "MULTIPLE",
			Evidence:          evidence,
			ImpactScore:       impact,
			RecommendedAction: "Implement negative caching for frequently-missed invalid keys with short TTL",
			DetectedAt:        time.Now(),
		})
	}

	return risks, nil
}

func analyzePrewarmGap(db *sql.DB, thresholds *model.ThresholdConfig) ([]RiskDetail, error) {
	var risks []RiskDetail

	query := `
		SELECT 
			ck.cache_key,
			ck.business_domain,
			ck.access_count,
			ck.is_hot,
			COUNT(ce.id) as recent_access
		FROM cache_keys ck
		LEFT JOIN cache_events ce ON ck.cache_key = ce.cache_key 
			AND ce.business_domain = ck.business_domain
			AND ce.timestamp > datetime('now', '-1 hour')
		WHERE ck.is_hot = 1
		GROUP BY ck.cache_key, ck.business_domain
		HAVING recent_access = 0
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var coldHotKeys []string
	domains := make(map[string]bool)

	for rows.Next() {
		var key, domain string
		var accessCount int64
		var isHot bool
		var recentAccess int64

		if err := rows.Scan(&key, &domain, &accessCount, &isHot, &recentAccess); err != nil {
			return nil, err
		}

		coldHotKeys = append(coldHotKeys, key)
		domains[domain] = true
	}

	if len(coldHotKeys) > 0 {
		evidence := map[string]interface{}{
			"hot_keys_not_accessed": len(coldHotKeys),
			"affected_domains":      mapKeys(domains),
			"sample_keys":           firstNStrings(coldHotKeys, 10),
		}

		impact := float64(len(coldHotKeys)) * 100

		severity := "LOW"
		if len(coldHotKeys) > 10 {
			severity = "MEDIUM"
		}
		if len(coldHotKeys) > 50 {
			severity = "HIGH"
		}

		risks = append(risks, RiskDetail{
			RiskType:          "PREWARM_GAP",
			Severity:          severity,
			BusinessDomain:    "MULTIPLE",
			Evidence:          evidence,
			ImpactScore:       impact,
			RecommendedAction: "Review pre-warm strategy - marked hot keys show no recent access; check if pre-warm is working or key patterns have changed",
			DetectedAt:        time.Now(),
		})
	}

	return risks, nil
}

func analyzeBloomFilterRisk(db *sql.DB, thresholds *model.ThresholdConfig) ([]RiskDetail, error) {
	var risks []RiskDetail

	query := `
		SELECT 
			business_domain,
			COUNT(*) as total_keys,
			SUM(CASE WHEN is_hit = 0 THEN 1 ELSE 0 END) as misses
		FROM cache_events
		GROUP BY business_domain
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var highMissDomains []map[string]interface{}

	for rows.Next() {
		var domain string
		var total, misses int64

		if err := rows.Scan(&domain, &total, &misses); err != nil {
			return nil, err
		}

		missRate := float64(misses) / float64(total)

		if missRate > 0.2 && total > 100 {
			highMissDomains = append(highMissDomains, map[string]interface{}{
				"domain":    domain,
				"miss_rate": missRate,
				"total":     total,
				"misses":    misses,
			})
		}
	}

	if len(highMissDomains) > 0 {
		evidence := map[string]interface{}{
			"domains_with_high_miss_rate":  highMissDomains,
			"recommended_bloom_filter_fpr": thresholds.BloomFilterFalsePositiveRate,
			"note":                         "High miss rate domains may benefit from Bloom Filter to reduce penetration",
		}

		risks = append(risks, RiskDetail{
			RiskType:          "BLOOM_FILTER_RECOMMENDED",
			Severity:          "LOW",
			BusinessDomain:    "MULTIPLE",
			Evidence:          evidence,
			ImpactScore:       50,
			RecommendedAction: fmt.Sprintf("Consider adding Bloom Filter with target FPR <= %.2f%% for high miss-rate domains", thresholds.BloomFilterFalsePositiveRate*100),
			DetectedAt:        time.Now(),
		})
	}

	return risks, nil
}

func analyzeMutexWaitRisk(db *sql.DB, thresholds *model.ThresholdConfig) ([]RiskDetail, error) {
	var risks []RiskDetail

	query := `
		SELECT 
			cache_key,
			business_domain,
			COUNT(*) as concurrent_miss_window,
			AVG(backend_latency_ms) as avg_latency
		FROM cache_events
		WHERE is_hit = 0
		GROUP BY cache_key, business_domain, strftime('%Y-%m-%d %H:%M', timestamp)
		HAVING concurrent_miss_window > 5
		ORDER BY concurrent_miss_window DESC
		LIMIT 50
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	highConcurrencyMisses := make(map[string]map[string]interface{})

	for rows.Next() {
		var key, domain string
		var concurrentCount int64
		var avgLatency float64

		if err := rows.Scan(&key, &domain, &concurrentCount, &avgLatency); err != nil {
			return nil, err
		}

		k := domain + ":" + key
		if existing, ok := highConcurrencyMisses[k]; ok {
			if concurrentCount > existing["max_concurrent"].(int64) {
				existing["max_concurrent"] = concurrentCount
				existing["avg_latency"] = avgLatency
			}
			existing["total_windows"] = existing["total_windows"].(int) + 1
		} else {
			highConcurrencyMisses[k] = map[string]interface{}{
				"key":            key,
				"domain":         domain,
				"max_concurrent": concurrentCount,
				"avg_latency":    avgLatency,
				"total_windows":  1,
			}
		}
	}

	if len(highConcurrencyMisses) > 0 {
		var worstEntry map[string]interface{}
		maxConcurrent := int64(0)

		for _, v := range highConcurrencyMisses {
			if v["max_concurrent"].(int64) > maxConcurrent {
				maxConcurrent = v["max_concurrent"].(int64)
				worstEntry = v
			}
		}

		evidence := map[string]interface{}{
			"keys_with_concurrent_misses": len(highConcurrencyMisses),
			"worst_case":                  worstEntry,
			"mutex_wait_threshold_ms":     thresholds.MutexWaitThresholdMS,
		}

		avgLatency := 0.0
		if worstEntry != nil {
			avgLatency = worstEntry["avg_latency"].(float64)
		}

		severity := "LOW"
		if maxConcurrent > 20 {
			severity = "MEDIUM"
		}
		if maxConcurrent > 50 && avgLatency > float64(thresholds.MutexWaitThresholdMS) {
			severity = "HIGH"
		}

		impact := float64(maxConcurrent) * avgLatency / 1000.0

		risks = append(risks, RiskDetail{
			RiskType: "MUTEX_WAIT_RISK",
			Severity: severity,
			BusinessDomain: func() string {
				if worstEntry != nil {
					return worstEntry["domain"].(string)
				}
				return "UNKNOWN"
			}(),
			CacheKey: func() string {
				if worstEntry != nil {
					return worstEntry["key"].(string)
				}
				return ""
			}(),
			Evidence:          evidence,
			ImpactScore:       impact,
			RecommendedAction: "Use single-flight pattern or fair mutex; consider stale-while-revalidate to avoid blocking on refresh",
			DetectedAt:        time.Now(),
		})
	}

	return risks, nil
}

func analyzeStaleRevalidate(db *sql.DB, thresholds *model.ThresholdConfig) ([]RiskDetail, error) {
	var risks []RiskDetail

	query := `
		WITH key_stats AS (
			SELECT 
				cache_key,
				business_domain,
				COUNT(*) as total,
				SUM(CASE WHEN is_hit = 1 THEN 1 ELSE 0 END) as hits,
				AVG(backend_latency_ms) as avg_latency
			FROM cache_events
			GROUP BY cache_key, business_domain
		)
		SELECT 
			ks.cache_key,
			ks.business_domain,
			ks.total,
			ks.hits,
			ks.avg_latency,
			ck.expire_at
		FROM key_stats ks
		LEFT JOIN cache_keys ck ON ks.cache_key = ck.cache_key AND ks.business_domain = ck.business_domain
		WHERE CAST(ks.hits AS FLOAT) / ks.total > 0.8
		ORDER BY ks.total DESC
		LIMIT 100
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	highHitRateKeys := make([]map[string]interface{}, 0)
	soonToExpire := 0

	for rows.Next() {
		var key, domain string
		var total, hits int64
		var avgLatency float64
		var expireAt sql.NullTime

		if err := rows.Scan(&key, &domain, &total, &hits, &avgLatency, &expireAt); err != nil {
			return nil, err
		}

		entry := map[string]interface{}{
			"key":         key,
			"domain":      domain,
			"total":       total,
			"hit_rate":    float64(hits) / float64(total),
			"avg_latency": avgLatency,
		}

		if expireAt.Valid {
			entry["expire_at"] = expireAt.Time.Format(time.RFC3339)
			timeToExpire := expireAt.Time.Sub(time.Now())
			if timeToExpire > 0 && timeToExpire < 30*time.Minute {
				soonToExpire++
				entry["soon_to_expire"] = true
			}
		}

		highHitRateKeys = append(highHitRateKeys, entry)
	}

	if len(highHitRateKeys) > 0 {
		evidence := map[string]interface{}{
			"high_hit_rate_keys_eligible": len(highHitRateKeys),
			"soon_to_expire_count":        soonToExpire,
			"stale_revalidate_ratio":      thresholds.StaleRevalidateRatio,
			"sample_keys":                 firstNMaps(highHitRateKeys, 5),
		}

		severity := "LOW"
		if soonToExpire > 10 {
			severity = "MEDIUM"
		}

		risks = append(risks, RiskDetail{
			RiskType:          "STALE_WHILE_REVALIDATE_BENEFIT",
			Severity:          severity,
			BusinessDomain:    "MULTIPLE",
			Evidence:          evidence,
			ImpactScore:       float64(soonToExpire * 10),
			RecommendedAction: fmt.Sprintf("Consider stale-while-revalidate pattern for high hit-rate keys: serve stale immediately + async refresh (recommended ratio: %.0f%% of TTL)", thresholds.StaleRevalidateRatio*100),
			DetectedAt:        time.Now(),
		})
	}

	return risks, nil
}

func saveRiskEvents(risks []RiskDetail) error {
	database := db.GetDB()

	tx, err := database.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO risk_events (
			risk_type, severity, business_domain, cache_key, evidence_json,
			impact_score, recommended_action, detected_at, is_resolved, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, r := range risks {
		evidenceJSON, _ := json.Marshal(r.Evidence)

		_, err = stmt.Exec(
			r.RiskType,
			r.Severity,
			r.BusinessDomain,
			r.CacheKey,
			string(evidenceJSON),
			r.ImpactScore,
			r.RecommendedAction,
			r.DetectedAt,
			time.Now(),
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func buildRiskSummary(risks []RiskDetail) RiskSummary {
	summary := RiskSummary{}

	riskTypeCounts := make(map[string]int)
	domainSet := make(map[string]bool)
	var maxImpact float64

	for _, r := range risks {
		riskTypeCounts[r.RiskType]++
		if r.BusinessDomain != "MULTIPLE" && r.BusinessDomain != "" {
			domainSet[r.BusinessDomain] = true
		}
		if r.ImpactScore > maxImpact {
			maxImpact = r.ImpactScore
		}
	}

	type riskCount struct {
		typ   string
		count int
	}
	var sorted []riskCount
	for k, v := range riskTypeCounts {
		sorted = append(sorted, riskCount{k, v})
	}
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].count > sorted[j].count
	})

	for i := 0; i < min(5, len(sorted)); i++ {
		summary.TopRisks = append(summary.TopRisks, sorted[i].typ)
	}

	summary.AffectedDomains = mapKeys(domainSet)
	summary.MaxImpactScore = maxImpact

	return summary
}

func mapKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func topNKeys(m map[string]KeyAccessStats, n int) []string {
	type kv struct {
		Key   string
		Value KeyAccessStats
	}
	var list []kv
	for k, v := range m {
		list = append(list, kv{k, v})
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].Value.MissCount > list[j].Value.MissCount
	})

	result := make([]string, 0, min(n, len(list)))
	for i := 0; i < min(n, len(list)); i++ {
		result = append(result, list[i].Key)
	}
	return result
}

func firstNStats(s []KeyAccessStats, n int) []string {
	result := make([]string, 0, min(n, len(s)))
	for i := 0; i < min(n, len(s)); i++ {
		result = append(result, s[i].CacheKey)
	}
	return result
}

func firstNStrings(s []string, n int) []string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func firstNMaps(m []map[string]interface{}, n int) []map[string]interface{} {
	if len(m) <= n {
		return m
	}
	return m[:n]
}
