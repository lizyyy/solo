package replay

import (
	"encoding/json"
	"os"
	"testing"

	"mapdebug/pkg/types"
)

func TestNewReplayer(t *testing.T) {
	replayer := NewReplayer(42, 0)
	if replayer == nil {
		t.Fatal("NewReplayer returned nil")
	}
	if replayer.Seed() != 42 {
		t.Errorf("Expected seed 42, got %d", replayer.Seed())
	}
}

func TestExecuteOperation(t *testing.T) {
	replayer := NewReplayer(42, 0)

	putOp := types.Operation{
		Type:  types.OpPut,
		Key:   "test_key",
		Value: "test_value",
	}

	result := replayer.ExecuteOperation(putOp)
	if result.StepIndex != 0 {
		t.Errorf("Expected StepIndex 0, got %d", result.StepIndex)
	}
	if result.Op.Type != types.OpPut {
		t.Errorf("Expected OpPut, got %s", result.Op.Type)
	}
	if result.MapState.Count != 1 {
		t.Errorf("Expected Count 1, got %d", result.MapState.Count)
	}

	getOp := types.Operation{
		Type: types.OpGet,
		Key:  "test_key",
	}
	result = replayer.ExecuteOperation(getOp)
	if !result.LookupCost.Found {
		t.Error("Expected Found=true")
	}

	lenOp := types.Operation{
		Type: types.OpLen,
	}
	result = replayer.ExecuteOperation(lenOp)
	if result.MapState.Count != 1 {
		t.Errorf("Expected Count 1, got %d", result.MapState.Count)
	}
}

func TestExecuteAll(t *testing.T) {
	replayer := NewReplayer(42, 0)

	ops := []types.Operation{
		{Type: types.OpPut, Key: "a", Value: "1"},
		{Type: types.OpPut, Key: "b", Value: "2"},
		{Type: types.OpPut, Key: "c", Value: "3"},
		{Type: types.OpGet, Key: "b"},
		{Type: types.OpDelete, Key: "a"},
		{Type: types.OpLen},
	}

	steps := replayer.ExecuteAll(ops)
	if len(steps) != 6 {
		t.Errorf("Expected 6 steps, got %d", len(steps))
	}

	finalSnapshot := replayer.GetFinalSnapshot()
	if finalSnapshot.Count != 2 {
		t.Errorf("Expected final Count 2, got %d", finalSnapshot.Count)
	}
}

func TestPerformanceStats(t *testing.T) {
	replayer := NewReplayer(42, 0)

	for i := 0; i < 10; i++ {
		op := types.Operation{
			Type:  types.OpPut,
			Key:   string(rune('a' + i)),
			Value: string(rune('0' + i)),
		}
		replayer.ExecuteOperation(op)
	}

	stats := replayer.GetPerformanceStats()
	if stats.TotalSteps != 10 {
		t.Errorf("Expected TotalSteps 10, got %d", stats.TotalSteps)
	}
	if stats.AvgCost <= 0 {
		t.Errorf("Expected positive AvgCost, got %f", stats.AvgCost)
	}
}

func TestRiskSummary(t *testing.T) {
	replayer := NewReplayer(42, 0)
	replayer.Simulator().SetConcurrent(true)

	for i := 0; i < 5; i++ {
		op := types.Operation{
			Type:  types.OpPut,
			Key:   string(rune('a' + i)),
			Value: string(rune('0' + i)),
		}
		replayer.ExecuteOperation(op)
	}

	riskSummary := replayer.GetRiskSummary()
	if len(riskSummary) == 0 {
		t.Log("No risks detected (expected for simple operations)")
	}
}

func TestLoadOperations(t *testing.T) {
	tempFile, err := os.CreateTemp("", "ops_*.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tempFile.Name())

	ops := []types.Operation{
		{Type: types.OpPut, Key: "key1", Value: "val1"},
		{Type: types.OpGet, Key: "key1"},
		{Type: types.OpDelete, Key: "key1"},
	}

	encoder := json.NewEncoder(tempFile)
	for _, op := range ops {
		if err := encoder.Encode(op); err != nil {
			t.Fatal(err)
		}
	}
	tempFile.Close()

	replayer := NewReplayer(42, 0)
	loadedOps, err := replayer.LoadOperations(tempFile.Name())
	if err != nil {
		t.Fatal(err)
	}

	if len(loadedOps) != 3 {
		t.Errorf("Expected 3 operations, got %d", len(loadedOps))
	}

	if loadedOps[0].Type != types.OpPut {
		t.Errorf("Expected first op to be Put, got %s", loadedOps[0].Type)
	}
	if loadedOps[0].Key != "key1" {
		t.Errorf("Expected key1, got %s", loadedOps[0].Key)
	}
}

func TestExpandEvents(t *testing.T) {
	replayer := NewReplayer(42, 0)

	for i := 0; i < 30; i++ {
		op := types.Operation{
			Type:  types.OpPut,
			Key:   string(rune('a' + i%26)),
			Value: string(rune('0' + i%10)),
		}
		replayer.ExecuteOperation(op)
	}

	expandEvents := replayer.GetExpandEvents()
	t.Logf("Expand events: %v", expandEvents)
}

func TestRangeOperation(t *testing.T) {
	replayer := NewReplayer(42, 0)

	for i := 0; i < 5; i++ {
		op := types.Operation{
			Type:  types.OpPut,
			Key:   string(rune('a' + i)),
			Value: string(rune('0' + i)),
		}
		replayer.ExecuteOperation(op)
	}

	rangeOp := types.Operation{Type: types.OpRange}
	result := replayer.ExecuteOperation(rangeOp)

	foundRangeRisk := false
	for _, risk := range result.RiskAlerts {
		if risk.Category == types.RiskIterationOrder {
			foundRangeRisk = true
			break
		}
	}

	if !foundRangeRisk {
		t.Error("Expected iteration_order risk for range operation")
	}
}

func TestSimulatorAccess(t *testing.T) {
	replayer := NewReplayer(42, 0)
	sim := replayer.Simulator()

	if sim == nil {
		t.Fatal("Simulator() returned nil")
	}

	sim.Put("test", "value")

	lenOp := types.Operation{Type: types.OpLen}
	result := replayer.ExecuteOperation(lenOp)

	if result.MapState.Count != 1 {
		t.Errorf("Expected Count 1 after put via simulator, got %d", result.MapState.Count)
	}
}
