package reporter

import (
	"testing"

	"migration-chaos-simulator/internal/chaos"
)

func TestAnalyzeErrorsWithNilTrace(t *testing.T) {
	r, err := NewReporter("/tmp/test-reports")
	if err != nil {
		t.Fatalf("Failed to create reporter: %v", err)
	}

	errors := r.analyzeErrors(nil)
	if errors == nil {
		t.Error("Expected non-nil empty slice")
	}
	if len(errors) != 0 {
		t.Errorf("Expected 0 errors, got %d", len(errors))
	}
}

func TestGenerateChaosReportWithNilTrace(t *testing.T) {
	r, err := NewReporter("/tmp/test-reports")
	if err != nil {
		t.Fatalf("Failed to create reporter: %v", err)
	}

	exp := &chaos.ChaosExperiment{
		ID:            "exp-test-001",
		Name:          "Test Experiment",
		Type:          chaos.ChaosTypeHighConcurrency,
		Status:        chaos.ChaosStatusCompleted,
		TotalRequests: 100,
		ErrorCount:    5,
		SuccessCount:  95,
	}

	report := r.GenerateChaosReport(exp, nil)

	if report == nil {
		t.Fatal("Expected non-nil report")
	}
	if report.ChaosReport == nil {
		t.Fatal("Expected non-nil ChaosReport")
	}
	if report.ChaosReport.ExperimentID != "exp-test-001" {
		t.Errorf("Expected ExperimentID = exp-test-001, got %s", report.ChaosReport.ExperimentID)
	}
	if report.ChaosReport.TotalRequests != 100 {
		t.Errorf("Expected TotalRequests = 100, got %d", report.ChaosReport.TotalRequests)
	}
	if report.ChaosReport.ErrorCount != 5 {
		t.Errorf("Expected ErrorCount = 5, got %d", report.ChaosReport.ErrorCount)
	}
	if report.ChaosReport.SuccessCount != 95 {
		t.Errorf("Expected SuccessCount = 95, got %d", report.ChaosReport.SuccessCount)
	}
	if len(report.ChaosReport.TopErrors) != 0 {
		t.Errorf("Expected 0 TopErrors with nil trace, got %d", len(report.ChaosReport.TopErrors))
	}
}
