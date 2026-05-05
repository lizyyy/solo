package engine

import (
	"testing"

	"github.com/zy1221/slice-teacher/internal/model"
)

func TestMakeOperation(t *testing.T) {
	eng := NewSliceEngine()

	ops := []*model.Operation{
		{
			Type:   model.OpMake,
			Target: "a",
			Parameters: map[string]interface{}{
				"len": 3,
				"cap": 5,
			},
			Description: "创建切片 a",
		},
	}

	err := eng.Execute(ops)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}

	steps := eng.GetSteps()
	if len(steps) != 1 {
		t.Errorf("Expected 1 step, got %d", len(steps))
	}

	step := steps[0]
	slice, ok := step.Slices["a"]
	if !ok {
		t.Error("Slice 'a' not found")
	}

	if slice.Len != 3 {
		t.Errorf("Expected len=3, got %d", slice.Len)
	}
	if slice.Cap != 5 {
		t.Errorf("Expected cap=5, got %d", slice.Cap)
	}
}

func TestSliceAlias(t *testing.T) {
	eng := NewSliceEngine()

	ops := []*model.Operation{
		{
			Type:   model.OpMake,
			Target: "original",
			Parameters: map[string]interface{}{
				"len": 5,
				"cap": 10,
			},
		},
		{
			Type:    model.OpSlice,
			Target:  "alias",
			Sources: []string{"original"},
			Parameters: map[string]interface{}{
				"low":  1,
				"high": 4,
			},
		},
	}

	err := eng.Execute(ops)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}

	steps := eng.GetSteps()
	if len(steps) != 2 {
		t.Errorf("Expected 2 steps, got %d", len(steps))
	}

	step := steps[1]
	original, ok := step.Slices["original"]
	if !ok {
		t.Error("Slice 'original' not found")
	}

	alias, ok := step.Slices["alias"]
	if !ok {
		t.Error("Slice 'alias' not found")
	}

	if original.ArrayID != alias.ArrayID {
		t.Error("Expected original and alias to share same array")
	}

	if alias.Len != 3 {
		t.Errorf("Expected alias len=3, got %d", alias.Len)
	}

	if alias.Cap != 9 {
		t.Errorf("Expected alias cap=9, got %d", alias.Cap)
	}
}

func TestFullSliceExpression(t *testing.T) {
	eng := NewSliceEngine()

	ops := []*model.Operation{
		{
			Type:   model.OpMake,
			Target: "source",
			Parameters: map[string]interface{}{
				"len": 5,
				"cap": 10,
			},
		},
		{
			Type:    model.OpFullSlice,
			Target:  "limited",
			Sources: []string{"source"},
			Parameters: map[string]interface{}{
				"low":  1,
				"high": 3,
				"max":  3,
			},
		},
	}

	err := eng.Execute(ops)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}

	steps := eng.GetSteps()
	step := steps[1]

	limited, ok := step.Slices["limited"]
	if !ok {
		t.Error("Slice 'limited' not found")
	}

	if limited.Len != 2 {
		t.Errorf("Expected len=2, got %d", limited.Len)
	}

	if limited.Cap != 2 {
		t.Errorf("Expected cap=2 (limited by full slice), got %d", limited.Cap)
	}
}

func TestAppendWithGrow(t *testing.T) {
	eng := NewSliceEngine()

	ops := []*model.Operation{
		{
			Type:   model.OpMake,
			Target: "a",
			Parameters: map[string]interface{}{
				"len": 3,
				"cap": 5,
			},
		},
		{
			Type:   model.OpAppend,
			Target: "a",
			Parameters: map[string]interface{}{
				"num_elements": 3,
			},
		},
	}

	err := eng.Execute(ops)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}

	steps := eng.GetSteps()
	if len(steps) != 2 {
		t.Errorf("Expected 2 steps, got %d", len(steps))
	}

	step1 := steps[0]
	step2 := steps[1]

	if !step2.DidGrow {
		t.Error("Expected DidGrow=true after append")
	}

	slice1 := step1.Slices["a"]
	slice2 := step2.Slices["a"]

	if slice1.ArrayID == slice2.ArrayID {
		t.Error("Expected different array IDs after grow")
	}

	if slice2.Len != 6 {
		t.Errorf("Expected len=6, got %d", slice2.Len)
	}
}

func TestAppendWithoutGrow(t *testing.T) {
	eng := NewSliceEngine()

	ops := []*model.Operation{
		{
			Type:   model.OpMake,
			Target: "a",
			Parameters: map[string]interface{}{
				"len": 3,
				"cap": 10,
			},
		},
		{
			Type:   model.OpAppend,
			Target: "a",
			Parameters: map[string]interface{}{
				"num_elements": 2,
			},
		},
	}

	err := eng.Execute(ops)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}

	steps := eng.GetSteps()
	step1 := steps[0]
	step2 := steps[1]

	if step2.DidGrow {
		t.Error("Expected DidGrow=false")
	}

	slice1 := step1.Slices["a"]
	slice2 := step2.Slices["a"]

	if slice1.ArrayID != slice2.ArrayID {
		t.Error("Expected same array ID when no grow")
	}
}

func TestModifyElement(t *testing.T) {
	eng := NewSliceEngine()

	ops := []*model.Operation{
		{
			Type:   model.OpMake,
			Target: "original",
			Parameters: map[string]interface{}{
				"len": 5,
				"cap": 10,
			},
		},
		{
			Type:    model.OpSlice,
			Target:  "alias",
			Sources: []string{"original"},
			Parameters: map[string]interface{}{
				"low":  0,
				"high": 5,
			},
		},
		{
			Type:   model.OpModifyElement,
			Target: "alias",
			Parameters: map[string]interface{}{
				"index": 2,
			},
		},
	}

	err := eng.Execute(ops)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}

	steps := eng.GetSteps()
	step3 := steps[2]

	original, ok := step3.Slices["original"]
	if !ok {
		t.Error("Slice 'original' not found")
	}

	alias, ok := step3.Slices["alias"]
	if !ok {
		t.Error("Slice 'alias' not found")
	}

	if original.ArrayID != alias.ArrayID {
		t.Error("Expected original and alias to share same array")
	}
}

func TestCalculateNewCap(t *testing.T) {
	eng := NewSliceEngine()

	testCases := []struct {
		oldCap   int
		needed   int
		expected int
	}{
		{0, 3, 8},
		{4, 5, 8},
		{8, 9, 16},
		{16, 17, 32},
		{256, 257, 320},
		{10, 25, 32},
	}

	for _, tc := range testCases {
		result := eng.calculateNewCap(tc.oldCap, tc.needed)
		if result != tc.expected {
			t.Errorf("calculateNewCap(%d, %d) = %d, expected %d", tc.oldCap, tc.needed, result, tc.expected)
		}
	}
}

func TestFunctionPassByValue(t *testing.T) {
	eng := NewSliceEngine()

	ops := []*model.Operation{
		{
			Type:   model.OpMake,
			Target: "data",
			Parameters: map[string]interface{}{
				"len": 3,
				"cap": 5,
			},
		},
		{
			Type:   model.OpFuncPassByValue,
			Target: "data",
		},
	}

	err := eng.Execute(ops)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}

	steps := eng.GetSteps()
	step2 := steps[1]

	original, ok := step2.Slices["data"]
	if !ok {
		t.Error("Slice 'data' not found")
	}

	param, ok := step2.Slices["data_param"]
	if !ok {
		t.Error("Slice 'data_param' not found")
	}

	if original.ArrayID != param.ArrayID {
		t.Error("Expected data and data_param to share same array")
	}
}

func TestBigArrayHolderDetection(t *testing.T) {
	eng := NewSliceEngine()

	ops := []*model.Operation{
		{
			Type:   model.OpMake,
			Target: "big",
			Parameters: map[string]interface{}{
				"len": 100,
				"cap": 100,
			},
		},
		{
			Type:    model.OpSlice,
			Target:  "small",
			Sources: []string{"big"},
			Parameters: map[string]interface{}{
				"low":  0,
				"high": 5,
			},
		},
	}

	err := eng.Execute(ops)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}

	steps := eng.GetSteps()
	step2 := steps[1]

	if !step2.HoldsBigArray {
		t.Error("Expected HoldsBigArray=true")
	}
}
