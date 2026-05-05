package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadInterfaceCases(t *testing.T) {
	tempDir := t.TempDir()
	testYAML := `cases:
  - name: "test_case_1"
    category: "eface_iface"
    description: "测试案例1"
    source_file: "test.go"
    line_number: 10
    tags: ["test", "eface"]
  - name: "test_case_2"
    category: "typed_nil"
    description: "测试案例2"
    source_file: "nil.go"
    line_number: 20
`
	filePath := filepath.Join(tempDir, "test-cases.yaml")
	if err := os.WriteFile(filePath, []byte(testYAML), 0644); err != nil {
		t.Fatalf("创建测试文件失败: %v", err)
	}

	config, err := LoadInterfaceCases(filePath)
	if err != nil {
		t.Fatalf("LoadInterfaceCases 失败: %v", err)
	}

	if config == nil {
		t.Fatal("config 不应为 nil")
	}

	if len(config.Cases) != 2 {
		t.Errorf("期望 2 个案例，实际得到 %d", len(config.Cases))
	}

	if config.Cases[0].Name != "test_case_1" {
		t.Errorf("期望案例名 'test_case_1'，实际得到 '%s'", config.Cases[0].Name)
	}

	if config.Cases[0].Category != "eface_iface" {
		t.Errorf("期望分类 'eface_iface'，实际得到 '%s'", config.Cases[0].Category)
	}

	if config.Cases[1].LineNumber != 20 {
		t.Errorf("期望行号 20，实际得到 %d", config.Cases[1].LineNumber)
	}
}

func TestLoadCallRecords(t *testing.T) {
	tempDir := t.TempDir()
	testJSONL := `{"timestamp":"2024-01-15T10:30:00Z","operation":"assign","interface":"fmt.Stringer","concrete":"*main.MyType","allocation":true,"method_call":"","source_file":"main.go","line_number":42}
{"timestamp":"2024-01-15T10:30:01Z","operation":"call","interface":"fmt.Stringer","concrete":"*main.MyType","allocation":false,"method_call":"String","source_file":"main.go","line_number":45}
`
	filePath := filepath.Join(tempDir, "test-calls.jsonl")
	if err := os.WriteFile(filePath, []byte(testJSONL), 0644); err != nil {
		t.Fatalf("创建测试文件失败: %v", err)
	}

	records, err := LoadCallRecords(filePath)
	if err != nil {
		t.Fatalf("LoadCallRecords 失败: %v", err)
	}

	if len(records) != 2 {
		t.Errorf("期望 2 条记录，实际得到 %d", len(records))
	}

	if records[0].Operation != "assign" {
		t.Errorf("期望操作 'assign'，实际得到 '%s'", records[0].Operation)
	}

	if records[0].Allocation != true {
		t.Errorf("期望 allocation 为 true，实际得到 false")
	}

	if records[1].MethodCall != "String" {
		t.Errorf("期望方法调用 'String'，实际得到 '%s'", records[1].MethodCall)
	}

	if records[1].Allocation != false {
		t.Errorf("期望 allocation 为 false，实际得到 true")
	}
}

func TestLoadCallRecords_InvalidJSON(t *testing.T) {
	tempDir := t.TempDir()
	testJSONL := `{"timestamp":"2024-01-15T10:30:00Z","operation":"assign"
invalid json line
`
	filePath := filepath.Join(tempDir, "test-calls.jsonl")
	if err := os.WriteFile(filePath, []byte(testJSONL), 0644); err != nil {
		t.Fatalf("创建测试文件失败: %v", err)
	}

	_, err := LoadCallRecords(filePath)
	if err == nil {
		t.Error("期望解析错误，但没有错误")
	}
}

func TestLoadSnippets(t *testing.T) {
	tempDir := t.TempDir()
	snippetsDir := filepath.Join(tempDir, "snippets")
	if err := os.MkdirAll(snippetsDir, 0755); err != nil {
		t.Fatalf("创建 snippets 目录失败: %v", err)
	}

	testFiles := map[string]string{
		"test1.go": `package main

func main() {}
`,
		"test2.go": `package main

type Test struct{}
`,
		"notgo.txt": "这不是 Go 文件",
	}

	for name, content := range testFiles {
		filePath := filepath.Join(snippetsDir, name)
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			t.Fatalf("创建测试文件 %s 失败: %v", name, err)
		}
	}

	snippets, err := LoadSnippets(snippetsDir)
	if err != nil {
		t.Fatalf("LoadSnippets 失败: %v", err)
	}

	if len(snippets) != 2 {
		t.Errorf("期望 2 个 Go 文件，实际得到 %d", len(snippets))
	}

	if _, ok := snippets["test1.go"]; !ok {
		t.Error("应该包含 test1.go")
	}

	if _, ok := snippets["test2.go"]; !ok {
		t.Error("应该包含 test2.go")
	}

	if _, ok := snippets["notgo.txt"]; ok {
		t.Error("不应该包含 notgo.txt")
	}
}

func TestLoadSnippets_EmptyDir(t *testing.T) {
	tempDir := t.TempDir()
	emptyDir := filepath.Join(tempDir, "empty")
	if err := os.MkdirAll(emptyDir, 0755); err != nil {
		t.Fatalf("创建空目录失败: %v", err)
	}

	snippets, err := LoadSnippets(emptyDir)
	if err != nil {
		t.Fatalf("LoadSnippets 失败: %v", err)
	}

	if len(snippets) != 0 {
		t.Errorf("期望 0 个文件，实际得到 %d", len(snippets))
	}
}
