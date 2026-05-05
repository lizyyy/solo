package parser_test

import (
	"os"
	"path/filepath"
	"testing"

	"deferpanic/pkg/parser"
)

func TestParseValidCases(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "test_cases.yaml")

	content := `
cases:
  - name: test_case_1
    description: 测试用例1
    snippet: snippets/test1.go
    expected_status: normal

  - name: test_case_2
    description: 测试用例2
    snippet: snippets/test2.go
    expected_status: recovered
    risk_level: medium
`

	if err := os.WriteFile(testFile, []byte(content), 0644); err != nil {
		t.Fatalf("创建测试文件失败: %v", err)
	}

	cases, err := parser.ParseCases(testFile)
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}

	if len(cases) != 2 {
		t.Errorf("期望 2 个用例，实际: %d", len(cases))
	}

	if cases[0].Name != "test_case_1" {
		t.Errorf("期望第一个用例名称 test_case_1，实际: %s", cases[0].Name)
	}

	if cases[1].RiskLevel != "medium" {
		t.Errorf("期望风险等级 medium，实际: %s", cases[1].RiskLevel)
	}
}

func TestParseCasesMissingRequiredFields(t *testing.T) {
	tmpDir := t.TempDir()

	tests := []struct {
		name    string
		content string
	}{
		{
			name: "缺少 name",
			content: `
cases:
  - description: 缺少 name
    snippet: snippets/test.go
`,
		},
		{
			name: "缺少 snippet",
			content: `
cases:
  - name: test_case
    description: 缺少 snippet
`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			testFile := filepath.Join(tmpDir, tt.name+".yaml")
			if err := os.WriteFile(testFile, []byte(tt.content), 0644); err != nil {
				t.Fatalf("创建测试文件失败: %v", err)
			}

			_, err := parser.ParseCases(testFile)
			if err == nil {
				t.Error("期望解析失败，但成功了")
			}
		})
	}
}

func TestParseInvalidYAML(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "invalid.yaml")

	content := `
cases:
  - name: invalid
    description: [这是一个无效的 YAML
      缩进错误
`

	if err := os.WriteFile(testFile, []byte(content), 0644); err != nil {
		t.Fatalf("创建测试文件失败: %v", err)
	}

	_, err := parser.ParseCases(testFile)
	if err == nil {
		t.Error("期望解析无效 YAML 失败，但成功了")
	}
}

func TestParseValidEvents(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "test_events.jsonl")

	content := `{"timestamp": "2024-01-15T10:00:00Z", "event_type": "case_start", "case_name": "test", "details": {}}
{"timestamp": "2024-01-15T10:00:01Z", "event_type": "defer_exec", "details": {"function": "test"}}
`

	if err := os.WriteFile(testFile, []byte(content), 0644); err != nil {
		t.Fatalf("创建测试文件失败: %v", err)
	}

	events, err := parser.ParseEvents(testFile)
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}

	if len(events) != 2 {
		t.Errorf("期望 2 个事件，实际: %d", len(events))
	}

	if events[0].EventType != "case_start" {
		t.Errorf("期望事件类型 case_start，实际: %s", events[0].EventType)
	}
}

func TestParseEventsMissingEventType(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "bad_events.jsonl")

	content := `{"timestamp": "2024-01-15T10:00:00Z", "case_name": "test", "details": {}}
`

	if err := os.WriteFile(testFile, []byte(content), 0644); err != nil {
		t.Fatalf("创建测试文件失败: %v", err)
	}

	_, err := parser.ParseEvents(testFile)
	if err == nil {
		t.Error("期望解析缺少 event_type 的事件失败，但成功了")
	}
}

func TestParseInvalidJSONL(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "invalid.jsonl")

	content := `这不是 JSON
{"timestamp": "2024-01-15T10:00:00Z", "event_type": "test", "details": {}}
`

	if err := os.WriteFile(testFile, []byte(content), 0644); err != nil {
		t.Fatalf("创建测试文件失败: %v", err)
	}

	_, err := parser.ParseEvents(testFile)
	if err == nil {
		t.Error("期望解析无效 JSONL 失败，但成功了")
	}
}

func TestParseNonExistentFile(t *testing.T) {
	events, err := parser.ParseEvents("/nonexistent/path/events.jsonl")
	if err != nil {
		t.Errorf("不存在的文件应该返回空列表，而非错误: %v", err)
	}
	if len(events) != 0 {
		t.Errorf("期望 0 个事件，实际: %d", len(events))
	}
}

func TestParseSnippet(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "test.go")

	content := `package main

func main() {
	defer fmt.Println("defer1")
	defer func() {
		if r := recover(); r != nil {
			fmt.Println(r)
		}
	}()
	
	fmt.Println("hello")
	panic("test")
}
`

	if err := os.WriteFile(testFile, []byte(content), 0644); err != nil {
		t.Fatalf("创建测试文件失败: %v", err)
	}

	info, err := parser.ParseSnippet(testFile)
	if err != nil {
		t.Fatalf("解析片段失败: %v", err)
	}

	if info.DeferCount < 1 {
		t.Errorf("期望至少 1 个 defer，实际: %d", info.DeferCount)
	}

	if info.PanicCount < 1 {
		t.Errorf("期望至少 1 个 panic，实际: %d", info.PanicCount)
	}

	if info.RecoverCount < 1 {
		t.Errorf("期望至少 1 个 recover，实际: %d", info.RecoverCount)
	}
}

func TestParseSnippetNamedReturn(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "named_return.go")

	content := `package main

func namedReturn() (result int) {
	defer func() {
		result++
	}()
	return 1
}
`

	if err := os.WriteFile(testFile, []byte(content), 0644); err != nil {
		t.Fatalf("创建测试文件失败: %v", err)
	}

	info, err := parser.ParseSnippet(testFile)
	if err != nil {
		t.Fatalf("解析片段失败: %v", err)
	}

	if !info.HasNamedReturn {
		t.Error("期望检测到命名返回值")
	}
}
