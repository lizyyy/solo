package service

import (
	"database/sql"

	"cache-risk-analyzer/internal/db"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"sort"
	"time"
)

type StrategyConfig struct {
	StrategyType string                 `json:"strategy_type"`
	StrategyName string                 `json:"strategy_name,omitempty"`
	Parameters   map[string]interface{} `json:"parameters,omitempty"`
}

type SimulationMetrics struct {
	HitRate                 float64 `json:"hit_rate"`
	MissRate                float64 `json:"miss_rate"`
	BackendQPS              float64 `json:"backend_qps"`
	BackendLatencyAvgMS     float64 `json:"backend_latency_avg_ms"`
	BlockedRequests         int64   `json:"blocked_requests"`
	InterceptedRequests     int64   `json:"intercepted_requests"`
	AvgWaitTimeMS           float64 `json:"avg_wait_time_ms"`
	AvalancheWindowSize     int64   `json:"avalanche_window_size"`
	MaxConcurrentMisses     int64   `json:"max_concurrent_misses"`
	HotKeyMissRate          float64 `json:"hot_key_miss_rate"`
	InvalidKeyInterceptRate float64 `json:"invalid_key_intercept_rate"`
}

type SimulationResultDetail struct {
	ID               int64              `json:"id"`
	SimulationName   string             `json:"simulation_name"`
	StrategyTypes    []string           `json:"strategy_types"`
	BusinessDomain   string             `json:"business_domain,omitempty"`
	OriginalMetrics  SimulationMetrics  `json:"original_metrics"`
	SimulatedMetrics SimulationMetrics  `json:"simulated_metrics"`
	Comparison       StrategyComparison `json:"comparison"`
	CreatedAt        time.Time          `json:"created_at"`
}

type StrategyComparison struct {
	HitRateImprovement       float64 `json:"hit_rate_improvement_pct"`
	MissRateReduction        float64 `json:"miss_rate_reduction_pct"`
	BackendQPSReduction      float64 `json:"backend_qps_reduction_pct"`
	RequestsIntercepted      int64   `json:"requests_intercepted"`
	AvalancheRiskReduction   float64 `json:"avalanche_risk_reduction_pct"`
	MaxWaitTimeReduction     float64 `json:"max_wait_time_reduction_pct"`
	EstimatedCostSaving      float64 `json:"estimated_cost_saving_usd"`
	RecommendationConfidence float64 `json:"recommendation_confidence"`
}

type CompareResult struct {
	BaseLine       SimulationMetrics            `json:"baseline"`
	Strategies     map[string]SimulationMetrics `json:"strategies"`
	Rankings       []StrategyRanking            `json:"rankings"`
	Recommendation string                       `json:"recommendation"`
}

type StrategyRanking struct {
	StrategyType    string   `json:"strategy_type"`
	Score           float64  `json:"score"`
	Rank            int      `json:"rank"`
	KeyImprovements []string `json:"key_improvements"`
}

func RunSimulation(strategies []StrategyConfig, businessDomain string) (*SimulationResultDetail, error) {
	database := db.GetDB()

	originalMetrics, err := collectCurrentMetrics(database, businessDomain)
	if err != nil {
		return nil, fmt.Errorf("failed to collect baseline metrics: %v", err)
	}

	simulatedMetrics := *originalMetrics

	for _, strategy := range strategies {
		applyStrategyEffect(&simulatedMetrics, strategy, originalMetrics)
	}

	comparison := calculateComparison(originalMetrics, &simulatedMetrics)

	strategyTypes := make([]string, len(strategies))
	for i, s := range strategies {
		strategyTypes[i] = s.StrategyType
	}

	simName := "sim_" + time.Now().Format("20060102_150405")
	if len(strategies) > 0 {
		simName = strategies[0].StrategyType + "_" + simName
	}

	originalJSON, _ := json.Marshal(originalMetrics)
	simulatedJSON, _ := json.Marshal(simulatedMetrics)
	comparisonJSON, _ := json.Marshal(comparison)
	strategyTypesJSON, _ := json.Marshal(strategyTypes)

	result, err := database.Exec(`
		INSERT INTO simulation_results (
			simulation_name, strategy_types_json, business_domain,
			original_metrics_json, simulated_metrics_json, comparison_json, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)
	`,
		simName,
		string(strategyTypesJSON),
		businessDomain,
		string(originalJSON),
		string(simulatedJSON),
		string(comparisonJSON),
		time.Now(),
	)

	if err != nil {
		return nil, err
	}

	id, _ := result.LastInsertId()

	return &SimulationResultDetail{
		ID:               id,
		SimulationName:   simName,
		StrategyTypes:    strategyTypes,
		BusinessDomain:   businessDomain,
		OriginalMetrics:  *originalMetrics,
		SimulatedMetrics: simulatedMetrics,
		Comparison:       comparison,
		CreatedAt:        time.Now(),
	}, nil
}

func CompareAllStrategies(businessDomain string) (*CompareResult, error) {
	database := db.GetDB()

	baseline, err := collectCurrentMetrics(database, businessDomain)
	if err != nil {
		return nil, err
	}

	allStrategies := []StrategyConfig{
		{StrategyType: "negative_cache", Parameters: map[string]interface{}{"ttl_seconds": 60}},
		{StrategyType: "bloom_filter", Parameters: map[string]interface{}{"false_positive_rate": 0.01}},
		{StrategyType: "ttl_jitter", Parameters: map[string]interface{}{"jitter_percent": 20}},
		{StrategyType: "hot_key_prewarm", Parameters: map[string]interface{}{"prewarm_threshold": 1000}},
		{StrategyType: "mutex_lock", Parameters: map[string]interface{}{"timeout_ms": 5000}},
		{StrategyType: "stale_while_revalidate", Parameters: map[string]interface{}{"stale_ratio": 0.1}},
	}

	strategyResults := make(map[string]SimulationMetrics)
	rankings := make([]StrategyRanking, 0)

	for _, strategy := range allStrategies {
		metrics := *baseline
		applyStrategyEffect(&metrics, strategy, baseline)
		strategyResults[strategy.StrategyType] = metrics

		score := calculateStrategyScore(baseline, &metrics, strategy.StrategyType)
		improvements := getKeyImprovements(baseline, &metrics, strategy.StrategyType)

		rankings = append(rankings, StrategyRanking{
			StrategyType:    strategy.StrategyType,
			Score:           score,
			KeyImprovements: improvements,
		})
	}

	sort.Slice(rankings, func(i, j int) bool {
		return rankings[i].Score > rankings[j].Score
	})

	for i := range rankings {
		rankings[i].Rank = i + 1
	}

	recommendation := ""
	if len(rankings) > 0 {
		best := rankings[0]
		recommendation = fmt.Sprintf(
			"Recommended strategy: %s (score: %.2f). Key improvements: %v",
			best.StrategyType, best.Score, best.KeyImprovements,
		)
	}

	return &CompareResult{
		BaseLine:       *baseline,
		Strategies:     strategyResults,
		Rankings:       rankings,
		Recommendation: recommendation,
	}, nil
}

func collectCurrentMetrics(db *sql.DB, businessDomain string) (*SimulationMetrics, error) {
	metrics := &SimulationMetrics{}

	whereClause := "1=1"
	args := []interface{}{}
	if businessDomain != "" {
		whereClause = "business_domain = ?"
		args = append(args, businessDomain)
	}

	var totalRequests, hits, misses int64
	query := fmt.Sprintf(`
		SELECT 
			COUNT(*) as total,
			SUM(CASE WHEN is_hit = 1 THEN 1 ELSE 0 END) as hits,
			SUM(CASE WHEN is_hit = 0 THEN 1 ELSE 0 END) as misses,
			AVG(CASE WHEN is_hit = 0 THEN backend_latency_ms ELSE 0 END) as avg_miss_latency
		FROM cache_events
		WHERE %s
	`, whereClause)

	var avgMissLatency sql.NullFloat64
	err := db.QueryRow(query, args...).Scan(&totalRequests, &hits, &misses, &avgMissLatency)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	if totalRequests > 0 {
		metrics.HitRate = float64(hits) / float64(totalRequests)
		metrics.MissRate = float64(misses) / float64(totalRequests)
	}

	if avgMissLatency.Valid {
		metrics.BackendLatencyAvgMS = avgMissLatency.Float64
	}

	var avgQPS, maxQPS sql.NullFloat64
	metricQuery := fmt.Sprintf(`
		SELECT AVG(qps), AVG(max_qps) FROM backend_metrics WHERE %s
	`, whereClause)
	db.QueryRow(metricQuery, args...).Scan(&avgQPS, &maxQPS)

	if avgQPS.Valid {
		metrics.BackendQPS = avgQPS.Float64 * metrics.MissRate
	}

	ttlQuery := fmt.Sprintf(`
		SELECT 
			COUNT(*) as window_count,
			MAX(window_keys) as max_window_keys
		FROM (
			SELECT 
				strftime('%%Y-%%m-%%d %%H:00:00', expire_at) as time_window,
				COUNT(*) as window_keys
			FROM cache_keys
			WHERE %s AND expire_at > datetime('now')
			GROUP BY time_window
		)
	`, whereClause)

	var windowCount, maxWindowKeys sql.NullInt64
	db.QueryRow(ttlQuery, args...).Scan(&windowCount, &maxWindowKeys)

	if maxWindowKeys.Valid {
		metrics.AvalancheWindowSize = maxWindowKeys.Int64
	}

	concurrentQuery := fmt.Sprintf(`
		SELECT MAX(concurrent_count)
		FROM (
			SELECT 
				cache_key,
				strftime('%%Y-%%m-%%d %%H:%%M', timestamp) as minute_window,
				COUNT(*) as concurrent_count
			FROM cache_events
			WHERE %s AND is_hit = 0
			GROUP BY cache_key, minute_window
		)
	`, whereClause)

	var maxConcurrent sql.NullInt64
	db.QueryRow(concurrentQuery, args...).Scan(&maxConcurrent)

	if maxConcurrent.Valid {
		metrics.MaxConcurrentMisses = maxConcurrent.Int64
	}

	hotKeyQuery := fmt.Sprintf(`
		WITH hot_key_events AS (
			SELECT ce.*
			FROM cache_events ce
			JOIN cache_keys ck ON ce.cache_key = ck.cache_key AND ce.business_domain = ck.business_domain
			WHERE ck.is_hot = 1 AND ce.%s
		)
		SELECT 
			COUNT(*) as total,
			SUM(CASE WHEN is_hit = 0 THEN 1 ELSE 0 END) as misses
		FROM hot_key_events
	`, whereClause)

	var hotTotal, hotMisses sql.NullInt64
	db.QueryRow(hotKeyQuery, args...).Scan(&hotTotal, &hotMisses)

	if hotTotal.Valid && hotTotal.Int64 > 0 {
		metrics.HotKeyMissRate = float64(hotMisses.Int64) / float64(hotTotal.Int64)
	}

	return metrics, nil
}

func applyStrategyEffect(metrics *SimulationMetrics, strategy StrategyConfig, baseline *SimulationMetrics) {
	switch strategy.StrategyType {
	case "negative_cache":
		ttl := 60.0
		if t, ok := strategy.Parameters["ttl_seconds"].(float64); ok {
			ttl = t
		}

		interceptionRate := math.Min(0.9, 0.5+ttl/300.0)
		originalMisses := metrics.MissRate
		metrics.InvalidKeyInterceptRate = interceptionRate * 0.8
		metrics.MissRate = originalMisses * (1 - 0.4)
		metrics.HitRate = 1 - metrics.MissRate
		metrics.InterceptedRequests += int64(float64(10000) * originalMisses * 0.4)
		metrics.BackendQPS *= 0.6

	case "bloom_filter":
		fpr := 0.01
		if f, ok := strategy.Parameters["false_positive_rate"].(float64); ok {
			fpr = f
		}

		metrics.InvalidKeyInterceptRate = 1.0 - fpr
		originalMisses := metrics.MissRate
		metrics.MissRate = originalMisses*(1-0.5) + originalMisses*fpr*0.1
		metrics.HitRate = 1 - metrics.MissRate
		metrics.InterceptedRequests += int64(float64(10000) * originalMisses * 0.5)
		metrics.BackendQPS *= 0.55

	case "ttl_jitter":
		jitter := 20.0
		if j, ok := strategy.Parameters["jitter_percent"].(float64); ok {
			jitter = j
		}

		reductionFactor := math.Min(0.9, jitter/50.0)
		metrics.AvalancheWindowSize = int64(float64(metrics.AvalancheWindowSize) * (1 - reductionFactor*0.7))

	case "hot_key_prewarm":
		threshold := 1000.0
		if t, ok := strategy.Parameters["prewarm_threshold"].(float64); ok {
			threshold = t
		}

		improvement := math.Min(0.9, threshold/5000.0)
		metrics.HotKeyMissRate *= (1 - improvement)
		metrics.MissRate = metrics.MissRate*0.7 + metrics.HotKeyMissRate*0.3
		metrics.HitRate = 1 - metrics.MissRate
		metrics.BackendQPS *= 0.8

	case "mutex_lock":
		timeout := 5000.0
		if t, ok := strategy.Parameters["timeout_ms"].(float64); ok {
			timeout = t
		}

		reduction := math.Min(0.8, timeout/10000.0)
		if metrics.MaxConcurrentMisses > 1 {
			metrics.MaxConcurrentMisses = int64(math.Max(1, float64(metrics.MaxConcurrentMisses)*(1-reduction*0.6)))
		}

		if metrics.BackendLatencyAvgMS > 0 {
			metrics.AvgWaitTimeMS = metrics.BackendLatencyAvgMS * 0.3
		}

	case "stale_while_revalidate":
		staleRatio := 0.1
		if r, ok := strategy.Parameters["stale_ratio"].(float64); ok {
			staleRatio = r
		}

		effectiveness := math.Min(0.95, staleRatio*5)
		originalMisses := metrics.MissRate
		metrics.MissRate = originalMisses * (1 - effectiveness*0.7)
		metrics.HitRate = 1 - metrics.MissRate
		metrics.BackendQPS *= (1 - effectiveness*0.5)
		metrics.AvalancheWindowSize = int64(float64(metrics.AvalancheWindowSize) * (1 - effectiveness*0.4))
	}
}

func calculateComparison(original, simulated *SimulationMetrics) StrategyComparison {
	comparison := StrategyComparison{}

	if original.HitRate > 0 {
		comparison.HitRateImprovement = ((simulated.HitRate - original.HitRate) / original.HitRate) * 100
	}

	if original.MissRate > 0 {
		comparison.MissRateReduction = ((original.MissRate - simulated.MissRate) / original.MissRate) * 100
	}

	if original.BackendQPS > 0 {
		comparison.BackendQPSReduction = ((original.BackendQPS - simulated.BackendQPS) / original.BackendQPS) * 100
	}

	comparison.RequestsIntercepted = simulated.InterceptedRequests

	if original.AvalancheWindowSize > 0 {
		comparison.AvalancheRiskReduction = (float64(original.AvalancheWindowSize-simulated.AvalancheWindowSize) / float64(original.AvalancheWindowSize)) * 100
	}

	if original.BackendLatencyAvgMS > 0 {
		comparison.MaxWaitTimeReduction = ((original.BackendLatencyAvgMS - simulated.AvgWaitTimeMS) / original.BackendLatencyAvgMS) * 100
		if comparison.MaxWaitTimeReduction < 0 {
			comparison.MaxWaitTimeReduction = 0
		}
	}

	costPerQuery := 0.000001
	qpsReduction := original.BackendQPS - simulated.BackendQPS
	secondsPerDay := 86400.0
	comparison.EstimatedCostSaving = qpsReduction * secondsPerDay * costPerQuery * 30

	score := (comparison.HitRateImprovement * 0.2) +
		(comparison.MissRateReduction * 0.25) +
		(comparison.BackendQPSReduction * 0.25) +
		(comparison.AvalancheRiskReduction * 0.2) +
		(comparison.MaxWaitTimeReduction * 0.1)

	comparison.RecommendationConfidence = math.Min(100, math.Max(0, score))

	return comparison
}

func calculateStrategyScore(baseline, simulated *SimulationMetrics, strategyType string) float64 {
	score := 0.0

	if baseline.HitRate > 0 {
		score += ((simulated.HitRate - baseline.HitRate) / baseline.HitRate) * 25
	}

	if baseline.BackendQPS > 0 {
		score += ((baseline.BackendQPS - simulated.BackendQPS) / baseline.BackendQPS) * 30
	}

	if baseline.AvalancheWindowSize > 0 {
		score += (float64(baseline.AvalancheWindowSize-simulated.AvalancheWindowSize) / float64(baseline.AvalancheWindowSize)) * 25
	}

	if baseline.MaxConcurrentMisses > 1 && simulated.MaxConcurrentMisses < baseline.MaxConcurrentMisses {
		score += 10
	}

	if simulated.InterceptedRequests > 0 {
		score += 10
	}

	return math.Max(0, score)
}

func getKeyImprovements(baseline, simulated *SimulationMetrics, strategyType string) []string {
	improvements := make([]string, 0)

	switch strategyType {
	case "negative_cache":
		if simulated.InvalidKeyInterceptRate > 0 {
			improvements = append(improvements,
				fmt.Sprintf("Invalid key interception: %.1f%%", simulated.InvalidKeyInterceptRate*100),
			)
		}

	case "bloom_filter":
		if simulated.InvalidKeyInterceptRate > 0 {
			improvements = append(improvements,
				fmt.Sprintf("Bloom filter intercepts ~%.1f%% invalid requests", simulated.InvalidKeyInterceptRate*100),
			)
		}

	case "ttl_jitter":
		if baseline.AvalancheWindowSize > simulated.AvalancheWindowSize {
			reduction := float64(baseline.AvalancheWindowSize-simulated.AvalancheWindowSize) / float64(baseline.AvalancheWindowSize) * 100
			improvements = append(improvements,
				fmt.Sprintf("Avalanche window reduced by %.1f%%", reduction),
			)
		}

	case "hot_key_prewarm":
		if simulated.HotKeyMissRate < baseline.HotKeyMissRate {
			improvements = append(improvements,
				fmt.Sprintf("Hot key miss rate reduced from %.2f%% to %.2f%%",
					baseline.HotKeyMissRate*100, simulated.HotKeyMissRate*100),
			)
		}

	case "mutex_lock":
		if simulated.MaxConcurrentMisses < baseline.MaxConcurrentMisses {
			improvements = append(improvements,
				fmt.Sprintf("Concurrent misses reduced from %d to %d",
					baseline.MaxConcurrentMisses, simulated.MaxConcurrentMisses),
			)
		}
		if simulated.AvgWaitTimeMS > 0 {
			improvements = append(improvements,
				fmt.Sprintf("Average wait time: %.1fms", simulated.AvgWaitTimeMS),
			)
		}

	case "stale_while_revalidate":
		if simulated.HitRate > baseline.HitRate {
			improvements = append(improvements,
				fmt.Sprintf("Hit rate improved from %.2f%% to %.2f%%",
					baseline.HitRate*100, simulated.HitRate*100),
			)
		}
	}

	return improvements
}

func GetSimulationResultByID(id int64) (*SimulationResultDetail, error) {
	database := db.GetDB()

	var originalJSON, simulatedJSON, comparisonJSON, strategyTypesJSON string
	var result SimulationResultDetail

	err := database.QueryRow(`
		SELECT id, simulation_name, strategy_types_json, business_domain,
		       original_metrics_json, simulated_metrics_json, comparison_json, created_at
		FROM simulation_results
		WHERE id = ?
	`, id).Scan(
		&result.ID,
		&result.SimulationName,
		&strategyTypesJSON,
		&result.BusinessDomain,
		&originalJSON,
		&simulatedJSON,
		&comparisonJSON,
		&result.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	json.Unmarshal([]byte(strategyTypesJSON), &result.StrategyTypes)
	json.Unmarshal([]byte(originalJSON), &result.OriginalMetrics)
	json.Unmarshal([]byte(simulatedJSON), &result.SimulatedMetrics)
	json.Unmarshal([]byte(comparisonJSON), &result.Comparison)

	return &result, nil
}

func generateRandomKey(prefix string) string {
	return fmt.Sprintf("%s:%d:%d", prefix, rand.Intn(1000), rand.Intn(10000))
}
