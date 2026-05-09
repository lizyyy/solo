// +build integration

package test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"grayscale-simulator/internal/api"
	"grayscale-simulator/internal/service"
	"grayscale-simulator/pkg/config"
	"grayscale-simulator/pkg/database"
	"grayscale-simulator/pkg/logger"
)

func setupTestServer(t *testing.T) (*httptest.Server, *api.Handler) {
	t.Helper()

	gin.SetMode(gin.TestMode)

	cfg := &config.Config{
		Database: config.DatabaseConfig{
			Host:     "localhost",
			Port:     5432,
			User:     "postgres",
			Password: "postgres",
			DBName:   "grayscale_simulator_test",
			SSLMode:  "disable",
		},
		Log: config.LogConfig{
			Level:  "error",
			Format: "text",
			Output: "stdout",
		},
	}

	if err := logger.Init(cfg.Log.Level, cfg.Log.Format, cfg.Log.Output); err != nil {
		t.Fatalf("Failed to init logger: %v", err)
	}

	if err := database.Init(&cfg.Database); err != nil {
		t.Logf("Warning: Database not available for integration test: %v", err)
	}

	grayReleaseService := service.NewGrayReleaseService(10)
	rollbackEngine := service.NewRollbackEngine(3, "1s", true)
	faultInjectionService := service.NewFaultInjectionService(
		true, 100, 1000, "100ms", "5s", 0.1, 0.05, 3, "exponential",
	)
	traceService := service.NewTraceService("test-service")
	reportService := service.NewReportService("/tmp/reports", traceService)
	messageConsumer := service.NewMessageConsumerService(true, "5m", "30s", true)

	handler := api.NewHandler(
		grayReleaseService,
		rollbackEngine,
		faultInjectionService,
		messageConsumer,
		traceService,
		reportService,
	)

	router := api.SetupRouter(handler)
	return httptest.NewServer(router), handler
}

func TestHealthCheck(t *testing.T) {
	server, _ := setupTestServer(t)
	defer server.Close()

	resp, err := http.Get(server.URL + "/api/v1/health")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)
	assert.Equal(t, "healthy", result["status"])
}

func TestCreateGrayRelease(t *testing.T) {
	server, _ := setupTestServer(t)
	defer server.Close()

	release := map[string]interface{}{
		"service_name":    "user-service",
		"version":         "v1.2.0",
		"description":     "User profile update feature",
		"strategy":        "percentage",
		"strategy_config": map[string]interface{}{"percentage": 20},
		"created_by":      "admin",
	}

	body, _ := json.Marshal(release)
	resp, err := http.Post(server.URL+"/api/v1/releases", "application/json", bytes.NewReader(body))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)
	assert.True(t, result["success"].(bool))
}

func TestCreateFaultInjection(t *testing.T) {
	server, _ := setupTestServer(t)
	defer server.Close()

	fault := map[string]interface{}{
		"name":          "Network Latency",
		"fault_type":    "timeout",
		"target_service": "payment-service",
		"enabled":       true,
		"config": map[string]interface{}{
			"min_timeout": "500ms",
			"max_timeout": "2s",
		},
		"probability": 0.2,
		"created_by":  "qa-engineer",
	}

	body, _ := json.Marshal(fault)
	resp, err := http.Post(server.URL+"/api/v1/faults", "application/json", bytes.NewReader(body))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestFaultInjectionSimulation(t *testing.T) {
	server, _ := setupTestServer(t)
	defer server.Close()

	resp, err := http.Get(server.URL + "/api/v1/faults/simulate?target_service=test-service")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)
	assert.True(t, result["success"].(bool))
}

func TestCreateIncidentReport(t *testing.T) {
	server, _ := setupTestServer(t)
	defer server.Close()

	report := map[string]interface{}{
		"title":            "Payment processing timeout",
		"severity":         "high",
		"category":         "performance",
		"affected_services": []string{"payment-service", "order-service"},
		"root_cause":       "Database query taking too long during peak hours",
		"impact_analysis":  "Affecting 30% of users during checkout",
		"reported_by":      "on-call-engineer",
	}

	body, _ := json.Marshal(report)
	resp, err := http.Post(server.URL+"/api/v1/reports", "application/json", bytes.NewReader(body))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)
	assert.True(t, result["success"].(bool))
}

func TestListReleases(t *testing.T) {
	server, _ := setupTestServer(t)
	defer server.Close()

	resp, err := http.Get(server.URL + "/api/v1/releases?limit=10")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)
	assert.True(t, result["success"].(bool))
}

func TestConcurrentRequests(t *testing.T) {
	server, _ := setupTestServer(t)
	defer server.Close()

	const concurrentRequests = 50
	done := make(chan bool, concurrentRequests)

	for i := 0; i < concurrentRequests; i++ {
		go func() {
			resp, err := http.Get(server.URL + "/api/v1/health")
			if err == nil {
				resp.Body.Close()
			}
			done <- true
		}()
	}

	for i := 0; i < concurrentRequests; i++ {
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Fatal("Timeout waiting for concurrent requests")
		}
	}
}

