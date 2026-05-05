package storage

import (
	"os"
	"testing"
	"time"

	"go-policy-scanner/pkg/model"
)

func TestSQLiteStorage(t *testing.T) {
	testDB := "./test_scanner.db"
	defer os.Remove(testDB)

	store, err := NewSQLiteStorage(testDB)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer store.Close()

	t.Run("Save and Get ScanResult", func(t *testing.T) {
		result := &model.ScanResult{
			RepoName: "test-repo",
			Branch:   "main",
			Commit:   "abc123",
			ScanTime: time.Now(),
			Summary: model.Summary{
				TotalChecks:    10,
				PassedChecks:   8,
				FailedChecks:   2,
				ViolationsByType: map[string]int{"cyclic_dependency": 2},
			},
		}

		id, err := store.SaveScanResult(result)
		if err != nil {
			t.Fatalf("Failed to save scan result: %v", err)
		}
		if id <= 0 {
			t.Error("Expected positive ID, got", id)
		}

		retrieved, err := store.GetScanResult(id)
		if err != nil {
			t.Fatalf("Failed to get scan result: %v", err)
		}

		if retrieved.RepoName != result.RepoName {
			t.Errorf("Expected RepoName %s, got %s", result.RepoName, retrieved.RepoName)
		}
		if retrieved.Summary.TotalChecks != result.Summary.TotalChecks {
			t.Errorf("Expected TotalChecks %d, got %d", result.Summary.TotalChecks, retrieved.Summary.TotalChecks)
		}
	})

	t.Run("Save and Get Violations", func(t *testing.T) {
		result := &model.ScanResult{
			RepoName: "test-repo-2",
			ScanTime: time.Now(),
			Summary: model.Summary{
				TotalChecks:    5,
				PassedChecks:   3,
				FailedChecks:   2,
				ViolationsByType: map[string]int{},
			},
		}

		id, err := store.SaveScanResult(result)
		if err != nil {
			t.Fatalf("Failed to save scan result: %v", err)
		}

		violations := []model.Violation{
			{
				Type:     "cyclic_dependency",
				Severity: "critical",
				Message:  "Cyclic dependency detected",
				File:     "test.go",
				Line:     10,
				Detail:   "Detailed info",
			},
			{
				Type:     "cross_layer",
				Severity: "high",
				Message:  "Cross layer violation",
				File:     "service.go",
				Line:     25,
				Detail:   "Service should not import repository",
			},
		}

		err = store.SaveViolations(id, violations)
		if err != nil {
			t.Fatalf("Failed to save violations: %v", err)
		}

		retrievedViolations, err := store.GetViolations(id)
		if err != nil {
			t.Fatalf("Failed to get violations: %v", err)
		}

		if len(retrievedViolations) != len(violations) {
			t.Errorf("Expected %d violations, got %d", len(violations), len(retrievedViolations))
		}

		for i, v := range retrievedViolations {
			if v.Type != violations[i].Type {
				t.Errorf("Violation %d: Expected type %s, got %s", i, violations[i].Type, v.Type)
			}
			if v.Message != violations[i].Message {
				t.Errorf("Violation %d: Expected message %s, got %s", i, violations[i].Message, v.Message)
			}
		}
	})

	t.Run("List Scan Results", func(t *testing.T) {
		for i := 0; i < 3; i++ {
			result := &model.ScanResult{
				RepoName: "list-test-repo",
				ScanTime: time.Now(),
				Summary: model.Summary{
					TotalChecks:  5,
					PassedChecks: 5,
					FailedChecks: 0,
				},
			}
			_, err := store.SaveScanResult(result)
			if err != nil {
				t.Fatalf("Failed to save scan result: %v", err)
			}
		}

		results, err := store.ListScanResults(2)
		if err != nil {
			t.Fatalf("Failed to list scan results: %v", err)
		}

		if len(results) != 2 {
			t.Errorf("Expected 2 results, got %d", len(results))
		}
	})
}
