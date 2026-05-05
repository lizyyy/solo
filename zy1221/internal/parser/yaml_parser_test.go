package parser

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/zy1221/slice-teacher/internal/model"
)

func TestParseSliceCases(t *testing.T) {
	testYAML := `cases:
  - id: "test_case"
    name: "测试用例"
    description: "这是一个测试用例"
    category: "测试"
    seed: 42
    operations:
      - type: "make"
        target: "a"
        parameters:
          len: 3
          cap: 5
        description: "创建切片 a"
      - type: "append"
        target: "a"
        parameters:
          num_elements: 2
`

	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "test-cases.yaml")

	if err := os.WriteFile(tmpFile, []byte(testYAML), 0644); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	caseFile, err := ParseSliceCases(tmpFile)
	if err != nil {
		t.Fatalf("ParseSliceCases failed: %v", err)
	}

	if len(caseFile.Cases) != 1 {
		t.Errorf("Expected 1 case, got %d", len(caseFile.Cases))
	}

	c := caseFile.Cases[0]
	if c.ID != "test_case" {
		t.Errorf("Expected ID='test_case', got '%s'", c.ID)
	}
	if c.Name != "测试用例" {
		t.Errorf("Expected Name='测试用例', got '%s'", c.Name)
	}
	if len(c.Operations) != 2 {
		t.Errorf("Expected 2 operations, got %d", len(c.Operations))
	}

	op1 := c.Operations[0]
	if op1.Type != model.OpMake {
		t.Errorf("Expected OpMake, got %s", op1.Type)
	}
	if op1.Target != "a" {
		t.Errorf("Expected target='a', got '%s'", op1.Target)
	}
}

func TestParseSliceCases_Validation(t *testing.T) {
	testCases := []struct {
		name        string
		yamlContent string
		expectError bool
	}{
		{
			name: "empty cases",
			yamlContent: `cases: []
`,
			expectError: true,
		},
		{
			name: "case without name",
			yamlContent: `cases:
  - id: "test"
    operations:
      - type: "make"
        target: "a"
`,
			expectError: true,
		},
		{
			name: "case without operations",
			yamlContent: `cases:
  - id: "test"
    name: "测试"
`,
			expectError: true,
		},
		{
			name: "operation without type",
			yamlContent: `cases:
  - id: "test"
    name: "测试"
    operations:
      - target: "a"
`,
			expectError: true,
		},
		{
			name: "invalid operation type",
			yamlContent: `cases:
  - id: "test"
    name: "测试"
    operations:
      - type: "invalid_type"
        target: "a"
`,
			expectError: true,
		},
		{
			name: "valid case",
			yamlContent: `cases:
  - id: "test"
    name: "测试"
    operations:
      - type: "make"
        target: "a"
        parameters:
          len: 3
`,
			expectError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tmpDir := t.TempDir()
			tmpFile := filepath.Join(tmpDir, "test.yaml")

			if err := os.WriteFile(tmpFile, []byte(tc.yamlContent), 0644); err != nil {
				t.Fatalf("Failed to write test file: %v", err)
			}

			_, err := ParseSliceCases(tmpFile)
			if tc.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tc.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
		})
	}
}

func TestAssignDefaultIDs(t *testing.T) {
	caseFile := &model.CaseFile{
		Cases: []*model.Case{
			{
				Name: "Case 1",
				Operations: []*model.Operation{
					{Type: model.OpMake, Target: "a"},
					{Type: model.OpAppend, Target: "a"},
				},
			},
			{
				ID:   "custom_id",
				Name: "Case 2",
				Operations: []*model.Operation{
					{Type: model.OpMake, Target: "b"},
				},
			},
		},
	}

	assignDefaultIDs(caseFile)

	if caseFile.Cases[0].ID == "" {
		t.Error("Expected first case to have default ID")
	}
	if caseFile.Cases[1].ID != "custom_id" {
		t.Error("Expected second case to keep custom ID")
	}

	if caseFile.Cases[0].Operations[0].ID == "" {
		t.Error("Expected first operation to have default ID")
	}
}

func TestIsValidOpType(t *testing.T) {
	validTypes := []model.OpType{
		model.OpMake,
		model.OpSlice,
		model.OpFullSlice,
		model.OpAppend,
		model.OpCopy,
		model.OpDelete,
		model.OpFilter,
		model.OpFuncPassByValue,
		model.OpFuncPassByRef,
		model.OpModifyElement,
	}

	for _, opType := range validTypes {
		if !isValidOpType(opType) {
			t.Errorf("Expected %s to be valid", opType)
		}
	}

	invalidTypes := []model.OpType{
		"invalid",
		"",
		"unknown",
	}

	for _, opType := range invalidTypes {
		if isValidOpType(opType) {
			t.Errorf("Expected %s to be invalid", opType)
		}
	}
}
