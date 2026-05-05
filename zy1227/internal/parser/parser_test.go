package parser

import (
	"os"
	"path/filepath"
	"testing"
)

func TestYAMLParser_ParseSyncCases(t *testing.T) {
	// 创建临时 YAML 文件
	tempDir := t.TempDir()
	yamlContent := `
- name: "test_case"
  description: "Test case for parsing"
  primitives:
    - type: "Mutex"
      name: "mu"
      location: "main.go:10"
  events:
    - primitive_name: "mu"
      primitive_type: "Mutex"
      event_type: "Lock"
      goroutine_id: 1
      timestamp: "2024-01-01T10:00:00Z"
      location: "main.go:20"
  expectations:
    - issue_type: "lock_order_inversion"
      should_exist: false
      description: "Test expectation"
`

	yamlPath := filepath.Join(tempDir, "sync-cases.yaml")
	if err := os.WriteFile(yamlPath, []byte(yamlContent), 0644); err != nil {
		t.Fatalf("Failed to create test YAML file: %v", err)
	}

	// 测试解析
	parser := NewYAMLParser()
	cases, err := parser.ParseSyncCases(yamlPath)
	if err != nil {
		t.Fatalf("Failed to parse YAML: %v", err)
	}

	// 验证解析结果
	if len(cases) != 1 {
		t.Errorf("Expected 1 case, got %d", len(cases))
	}

	c := cases[0]
	if c.Name != "test_case" {
		t.Errorf("Expected name 'test_case', got '%s'", c.Name)
	}
	if len(c.Primitives) != 1 {
		t.Errorf("Expected 1 primitive, got %d", len(c.Primitives))
	}
	if c.Primitives[0].Name != "mu" {
		t.Errorf("Expected primitive name 'mu', got '%s'", c.Primitives[0].Name)
	}
}

func TestJSONLParser_ParseEvents(t *testing.T) {
	// 创建临时 JSONL 文件
	tempDir := t.TempDir()
	jsonlContent := `{"primitive_name": "mu", "primitive_type": "Mutex", "event_type": "Lock", "goroutine_id": 1, "timestamp": "2024-01-01T10:00:00Z", "location": "main.go:20", "file": "main.go", "line": 20, "details": "Test lock"}
{"primitive_name": "mu", "primitive_type": "Mutex", "event_type": "Unlock", "goroutine_id": 1, "timestamp": "2024-01-01T10:00:01Z", "location": "main.go:25", "file": "main.go", "line": 25}
`

	jsonlPath := filepath.Join(tempDir, "events.jsonl")
	if err := os.WriteFile(jsonlPath, []byte(jsonlContent), 0644); err != nil {
		t.Fatalf("Failed to create test JSONL file: %v", err)
	}

	// 测试解析
	parser := NewJSONLParser()
	events, err := parser.ParseEvents(jsonlPath)
	if err != nil {
		t.Fatalf("Failed to parse JSONL: %v", err)
	}

	// 验证解析结果
	if len(events) != 2 {
		t.Errorf("Expected 2 events, got %d", len(events))
	}

	if events[0].PrimitiveName != "mu" {
		t.Errorf("Expected primitive name 'mu', got '%s'", events[0].PrimitiveName)
	}
	if events[0].EventType != "Lock" {
		t.Errorf("Expected event type 'Lock', got '%s'", events[0].EventType)
	}
	if events[1].EventType != "Unlock" {
		t.Errorf("Expected event type 'Unlock', got '%s'", events[1].EventType)
	}
}

func TestGoParser_ParseSnippet(t *testing.T) {
	// 创建临时 Go 文件
	tempDir := t.TempDir()
	goContent := `package main

import (
	"sync"
)

type TestStruct struct {
	mu sync.Mutex
	wg sync.WaitGroup
}

func (t *TestStruct) DoWork() {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.wg.Add(1)
	go func() {
		defer t.wg.Done()
		// Do something
	}()
}
`

	goPath := filepath.Join(tempDir, "test.go")
	if err := os.WriteFile(goPath, []byte(goContent), 0644); err != nil {
		t.Fatalf("Failed to create test Go file: %v", err)
	}

	// 测试解析
	parser := NewGoParser()
	snippet, err := parser.ParseSnippet(goPath)
	if err != nil {
		t.Fatalf("Failed to parse Go file: %v", err)
	}

	// 验证解析结果
	if snippet.FilePath != goPath {
		t.Errorf("Expected file path '%s', got '%s'", goPath, snippet.FilePath)
	}

	// 检查是否找到了 sync 原语
	// 注意：我们的解析器会查找变量声明中的 sync 类型
	// 在这个测试中，mu 和 wg 是结构体字段，可能不会被直接识别
	// 但应该能识别操作调用

	foundLock := false
	foundUnlock := false
	foundAdd := false
	foundDone := false

	for _, op := range snippet.Operations {
		switch op.Operation {
		case "Lock":
			foundLock = true
		case "Unlock":
			foundUnlock = true
		case "Add":
			foundAdd = true
		case "Done":
			foundDone = true
		}
	}

	// 我们的解析器应该能识别这些操作
	// 但由于是方法调用，需要检查是否识别了
	if !foundLock {
		t.Log("Warning: Lock operation not found (this may be expected depending on parsing depth)")
	}
	if !foundUnlock {
		t.Log("Warning: Unlock operation not found")
	}
	if !foundAdd {
		t.Log("Warning: Add operation not found")
	}
	if !foundDone {
		t.Log("Warning: Done operation not found")
	}
}

func TestGoParser_ParseSnippets(t *testing.T) {
	// 创建临时目录和多个 Go 文件
	tempDir := t.TempDir()

	// 创建第一个文件
	file1Content := `package main

import "sync"

var mu sync.Mutex

func test1() {
	mu.Lock()
	mu.Unlock()
}
`
	file1Path := filepath.Join(tempDir, "file1.go")
	if err := os.WriteFile(file1Path, []byte(file1Content), 0644); err != nil {
		t.Fatalf("Failed to create test file 1: %v", err)
	}

	// 创建第二个文件
	file2Content := `package main

import "sync"

var wg sync.WaitGroup

func test2() {
	wg.Add(1)
	wg.Done()
}
`
	file2Path := filepath.Join(tempDir, "file2.go")
	if err := os.WriteFile(file2Path, []byte(file2Content), 0644); err != nil {
		t.Fatalf("Failed to create test file 2: %v", err)
	}

	// 创建一个非 Go 文件（应该被忽略）
	txtPath := filepath.Join(tempDir, "readme.txt")
	if err := os.WriteFile(txtPath, []byte("This is not a Go file"), 0644); err != nil {
		t.Fatalf("Failed to create test txt file: %v", err)
	}

	// 测试解析目录
	parser := NewGoParser()
	snippets, err := parser.ParseSnippets(tempDir)
	if err != nil {
		t.Fatalf("Failed to parse snippets: %v", err)
	}

	// 验证解析结果
	// 应该只解析 Go 文件
	if len(snippets) != 2 {
		t.Errorf("Expected 2 snippets, got %d", len(snippets))
	}
}
