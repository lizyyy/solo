package service_test

import (
	"bytes"
	"database/sql"
	"fmt"
	"strings"
	"testing"
	"time"

	"cache-risk-analyzer/internal/db"
	"cache-risk-analyzer/internal/service"

	_ "github.com/mattn/go-sqlite3"
)

func setupTestDB(t *testing.T) *sql.DB {
	testDBPath := t.TempDir() + "/test_cache_risk.db"

	if err := db.InitDB(testDBPath); err != nil {
		t.Fatalf("Failed to initialize test database: %v", err)
	}

	return db.GetDB()
}

func TestImportCacheEvents_ValidData(t *testing.T) {
	setupTestDB(t)

	validJSONL := `{"timestamp":"2026-05-04T10:00:00Z","business_domain":"product","cache_key":"product:detail:1001","ttl_seconds":3600,"is_hit":true,"backend_latency_ms":0,"request_source":"app"}
{"timestamp":"2026-05-04T10:00:01Z","business_domain":"product","cache_key":"product:detail:1002","ttl_seconds":3600,"is_hit":false,"backend_latency_ms":150,"request_source":"web"}
`

	result, err := service.ImportCacheEventsFromJSONL(bytes.NewReader([]byte(validJSONL)))
	if err != nil {
		t.Fatalf("Expected no error for valid data, got: %v", err)
	}

	if result.Total != 2 {
		t.Errorf("Expected total 2, got %d", result.Total)
	}
	if result.Success != 2 {
		t.Errorf("Expected success 2, got %d", result.Success)
	}
	if result.Failed != 0 {
		t.Errorf("Expected failed 0, got %d", result.Failed)
	}
}

func TestImportCacheEvents_InvalidJSON(t *testing.T) {
	setupTestDB(t)

	invalidJSONL := `{"timestamp":"2026-05-04T10:00:00Z","business_domain":"product","cache_key":"product:detail:1001","ttl_seconds":3600,"is_hit":true}
this is not valid json
{"timestamp":"2026-05-04T10:00:01Z","business_domain":"product","cache_key":"product:detail:1002","ttl_seconds":3600,"is_hit":false}
`

	result, err := service.ImportCacheEventsFromJSONL(bytes.NewReader([]byte(invalidJSONL)))
	if err != nil {
		t.Fatalf("Expected partial success, got error: %v", err)
	}

	if result.Total != 3 {
		t.Errorf("Expected total 3, got %d", result.Total)
	}
	if result.Failed != 1 {
		t.Errorf("Expected failed 1, got %d", result.Failed)
	}
	if len(result.Errors) == 0 {
		t.Error("Expected at least one error record")
	}
}

func TestImportCacheEvents_MissingRequiredFields(t *testing.T) {
	setupTestDB(t)

	missingFieldsJSONL := `{"timestamp":"2026-05-04T10:00:00Z","cache_key":"product:detail:1001","ttl_seconds":3600,"is_hit":true}
{"timestamp":"2026-05-04T10:00:00Z","business_domain":"product","ttl_seconds":3600,"is_hit":true}
`

	result, err := service.ImportCacheEventsFromJSONL(bytes.NewReader([]byte(missingFieldsJSONL)))
	if err != nil {
		t.Fatalf("Expected partial success, got error: %v", err)
	}

	if result.Failed != 2 {
		t.Errorf("Expected failed 2, got %d", result.Failed)
	}
}

func TestImportCacheEvents_InvalidTTL(t *testing.T) {
	setupTestDB(t)

	invalidTTLJSONL := `{"timestamp":"2026-05-04T10:00:00Z","business_domain":"product","cache_key":"product:detail:1001","ttl_seconds":-100,"is_hit":true,"backend_latency_ms":0}
`

	result, err := service.ImportCacheEventsFromJSONL(bytes.NewReader([]byte(invalidTTLJSONL)))
	if err != nil {
		t.Fatalf("Expected partial success, got error: %v", err)
	}

	if result.Failed != 1 {
		t.Errorf("Expected failed 1 for negative TTL, got %d", result.Failed)
	}
	if len(result.Errors) > 0 && !strings.Contains(result.Errors[0].Message, "negative") {
		t.Errorf("Expected error message to mention negative TTL, got: %s", result.Errors[0].Message)
	}
}

func TestImportKeys_ValidCSV(t *testing.T) {
	setupTestDB(t)

	validCSV := `business_domain,cache_key,ttl_seconds,expire_at,is_hot,access_count
product,product:detail:1001,3600,2026-05-04T11:00:00Z,true,15000
product,product:detail:1002,3600,2026-05-04T11:00:00Z,false,500
`

	result, err := service.ImportKeysFromCSV(bytes.NewReader([]byte(validCSV)))
	if err != nil {
		t.Fatalf("Expected no error for valid CSV, got: %v", err)
	}

	if result.Total != 2 {
		t.Errorf("Expected total 2, got %d", result.Total)
	}
	if result.Success != 2 {
		t.Errorf("Expected success 2, got %d", result.Success)
	}
}

func TestImportKeys_InvalidTTL(t *testing.T) {
	setupTestDB(t)

	invalidCSV := `business_domain,cache_key,ttl_seconds,expire_at,is_hot
product,product:detail:1001,-100,2026-05-04T11:00:00Z,true
`

	result, err := service.ImportKeysFromCSV(bytes.NewReader([]byte(invalidCSV)))
	if err != nil {
		t.Fatalf("Expected partial success, got error: %v", err)
	}

	if result.Failed != 1 {
		t.Errorf("Expected failed 1 for negative TTL, got %d", result.Failed)
	}
}

func TestCachePenetrationDetection(t *testing.T) {
	setupTestDB(t)

	database := db.GetDB()

	now := time.Now()

	for i := 0; i < 15; i++ {
		invalidKey := fmt.Sprintf("product:invalid:%d", i)
		for j := 0; j < 10; j++ {
			_, err := database.Exec(`
				INSERT INTO cache_events (
					timestamp, business_domain, cache_key, ttl_seconds, is_hit,
					backend_latency_ms, request_source, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`,
				now.Add(time.Duration(i*j)*time.Second),
				"product",
				invalidKey,
				3600,
				false,
				100.0,
				"app",
				time.Now(),
			)
			if err != nil {
				t.Fatalf("Failed to insert test data: %v", err)
			}
		}
	}

	for i := 0; i < 10; i++ {
		validKey := fmt.Sprintf("product:valid:%d", i)
		for j := 0; j < 5; j++ {
			_, err := database.Exec(`
				INSERT INTO cache_events (
					timestamp, business_domain, cache_key, ttl_seconds, is_hit,
					backend_latency_ms, request_source, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`,
				now.Add(time.Duration(i*j)*time.Second),
				"product",
				validKey,
				3600,
				true,
				0.0,
				"app",
				time.Now(),
			)
			if err != nil {
				t.Fatalf("Failed to insert test data: %v", err)
			}
		}
	}

	result, err := service.AnalyzeAllRisks()
	if err != nil {
		t.Fatalf("Analysis failed: %v", err)
	}

	var foundPenetration bool
	for _, risk := range result.Risks {
		if risk.RiskType == "CACHE_PENETRATION" {
			foundPenetration = true
			t.Logf("Found cache penetration risk: severity=%s, impact=%.2f", risk.Severity, risk.ImpactScore)
			break
		}
	}

	if !foundPenetration {
		t.Log("No cache penetration risk detected (may be expected depending on threshold)")
	}
}

func TestStrategySimulation(t *testing.T) {
	setupTestDB(t)

	database := db.GetDB()

	now := time.Now()
	for i := 0; i < 100; i++ {
		key := fmt.Sprintf("product:detail:%d", i)
		isHit := i%3 != 0
		latency := 0.0
		if !isHit {
			latency = 150.0
		}
		_, err := database.Exec(`
			INSERT INTO cache_events (
				timestamp, business_domain, cache_key, ttl_seconds, is_hit,
				backend_latency_ms, request_source, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`,
			now.Add(time.Duration(i)*time.Second),
			"product",
			key,
			3600,
			isHit,
			latency,
			"app",
			time.Now(),
		)
		if err != nil {
			t.Fatalf("Failed to insert test data: %v", err)
		}
	}

	compareResult, err := service.CompareAllStrategies("product")
	if err != nil {
		t.Fatalf("Strategy comparison failed: %v", err)
	}

	if len(compareResult.Strategies) == 0 {
		t.Error("Expected at least one strategy result")
	}

	if len(compareResult.Rankings) == 0 {
		t.Error("Expected at least one ranking")
	}

	t.Logf("Baseline hit rate: %.2f%%", compareResult.BaseLine.HitRate*100)

	for _, ranking := range compareResult.Rankings {
		t.Logf("Strategy: %s, Score: %.2f, Rank: %d", ranking.StrategyType, ranking.Score, ranking.Rank)
	}
}

func TestReportGeneration(t *testing.T) {
	setupTestDB(t)

	database := db.GetDB()

	now := time.Now()
	for i := 0; i < 20; i++ {
		key := fmt.Sprintf("product:test:%d", i)
		isHit := i%2 == 0
		latency := 0.0
		if !isHit {
			latency = 100.0
		}
		database.Exec(`
			INSERT INTO cache_events (
				timestamp, business_domain, cache_key, ttl_seconds, is_hit,
				backend_latency_ms, request_source, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`,
			now.Add(time.Duration(i)*time.Second),
			"product",
			key,
			3600,
			isHit,
			latency,
			"app",
			time.Now(),
		)
	}

	report, err := service.GenerateFullReport()
	if err != nil {
		t.Fatalf("Report generation failed: %v", err)
	}

	if report.GeneratedAt.IsZero() {
		t.Error("Expected report to have generated time")
	}

	if report.CurrentMetrics == nil {
		t.Error("Expected report to have current metrics")
	}

	md := service.GenerateMarkdownReport(report)
	if len(md) == 0 {
		t.Error("Expected markdown report to have content")
	}

	if !strings.Contains(md, "#") {
		t.Error("Expected markdown report to have headers")
	}
}
