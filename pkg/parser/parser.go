package parser

import (
	"bufio"
	"context-health/pkg/model"
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

func ParseContextPlan(path string) (*model.ContextPlan, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read context-plan.yaml: %w", err)
	}

	var plan model.ContextPlan
	if err := yaml.Unmarshal(data, &plan); err != nil {
		return nil, fmt.Errorf("failed to parse context-plan.yaml: %w", err)
	}

	return &plan, nil
}

func ParseCallsJSONL(path string) ([]model.CallRecord, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open calls.jsonl: %w", err)
	}
	defer file.Close()

	var calls []model.CallRecord
	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var raw map[string]interface{}
		if err := json.Unmarshal(line, &raw); err != nil {
			return nil, fmt.Errorf("line %d: failed to parse JSON: %w", lineNum, err)
		}

		call := mapToCallRecord(raw)
		call.RawData = make([]byte, len(line))
		copy(call.RawData, line)
		calls = append(calls, call)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading calls.jsonl: %w", err)
	}

	return calls, nil
}

func mapToCallRecord(raw map[string]interface{}) model.CallRecord {
	call := model.CallRecord{}

	if v, ok := raw["caller"].(string); ok {
		call.Caller = v
	}
	if v, ok := raw["callee"].(string); ok {
		call.Callee = v
	}
	if v, ok := raw["method"].(string); ok {
		call.Method = v
	}
	if v, ok := raw["has_deadline"].(bool); ok {
		call.HasDeadline = v
	}
	if v, ok := raw["deadline"].(string); ok {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			call.Deadline = t
		}
	}
	if v, ok := raw["timeout_budget_ms"].(float64); ok {
		call.TimeoutBudget = time.Duration(v) * time.Millisecond
	} else if v, ok := raw["timeout_budget"].(string); ok {
		if d, err := time.ParseDuration(v); err == nil {
			call.TimeoutBudget = d
		}
	}
	if v, ok := raw["has_cancel"].(bool); ok {
		call.HasCancel = v
	}
	if v, ok := raw["cancel_propagated"].(bool); ok {
		call.CancelPropagated = v
	}
	if v, ok := raw["uses_background"].(bool); ok {
		call.UsesBackground = v
	}
	if v, ok := raw["uses_todo"].(bool); ok {
		call.UsesTODO = v
	}
	if v, ok := raw["with_value_keys"].([]interface{}); ok {
		for _, k := range v {
			if s, ok := k.(string); ok {
				call.WithValueKeys = append(call.WithValueKeys, s)
			}
		}
	}
	if v, ok := raw["is_goroutine"].(bool); ok {
		call.IsGoroutine = v
	}
	if v, ok := raw["cancel_called"].(bool); ok {
		call.CancelCalled = v
	}
	if v, ok := raw["source_file"].(string); ok {
		call.SourceFile = v
	}
	if v, ok := raw["line_number"].(float64); ok {
		call.LineNumber = int(v)
	}

	return call
}

type GoCodeAnalysis struct {
	SourceFile string
	Calls      []model.CallRecord
	Risks      []model.RiskIssue
}

func ParseGoSnippets(dir string) ([]GoCodeAnalysis, error) {
	var results []GoCodeAnalysis

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}

		analysis, err := analyzeGoFile(path)
		if err != nil {
			return fmt.Errorf("analyze %s: %w", path, err)
		}
		if analysis != nil {
			results = append(results, *analysis)
		}
		return nil
	})

	return results, err
}

func analyzeGoFile(path string) (*GoCodeAnalysis, error) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, path, nil, parser.AllErrors)
	if err != nil {
		return nil, err
	}

	analysis := &GoCodeAnalysis{
		SourceFile: path,
	}

	ast.Inspect(file, func(n ast.Node) bool {
		if call, ok := n.(*ast.CallExpr); ok {
			analyzeCallExpr(fset, call, path, analysis)
		}
		return true
	})

	return analysis, nil
}

func analyzeCallExpr(fset *token.FileSet, call *ast.CallExpr, path string, analysis *GoCodeAnalysis) {
	pos := fset.Position(call.Pos())

	if sel, ok := call.Fun.(*ast.SelectorExpr); ok {
		if pkg, ok := sel.X.(*ast.Ident); ok {
			if pkg.Name == "context" {
				switch sel.Sel.Name {
				case "Background":
					record := model.CallRecord{
						SourceFile:  path,
						LineNumber:  pos.Line,
						UsesBackground: true,
					}
					analysis.Calls = append(analysis.Calls, record)

				case "TODO":
					record := model.CallRecord{
						SourceFile: path,
						LineNumber: pos.Line,
						UsesTODO:   true,
					}
					analysis.Calls = append(analysis.Calls, record)

				case "WithValue":
					if len(call.Args) >= 3 {
						key := extractValueKey(call.Args[1])
						record := model.CallRecord{
							SourceFile:    path,
							LineNumber:    pos.Line,
							WithValueKeys: []string{key},
						}
						analysis.Calls = append(analysis.Calls, record)
					}

				case "WithTimeout", "WithDeadline":
					record := model.CallRecord{
						SourceFile: path,
						LineNumber: pos.Line,
						HasDeadline: true,
						HasCancel:   true,
					}
					analysis.Calls = append(analysis.Calls, record)

				case "WithCancel":
					record := model.CallRecord{
						SourceFile: path,
						LineNumber: pos.Line,
						HasCancel:  true,
					}
					analysis.Calls = append(analysis.Calls, record)
				}
			}
		}
	}

	if isGoroutineCall(call) {
		record := model.CallRecord{
			SourceFile:  path,
			LineNumber:  pos.Line,
			IsGoroutine: true,
		}
		analysis.Calls = append(analysis.Calls, record)
	}
}

func extractValueKey(expr ast.Expr) string {
	switch e := expr.(type) {
	case *ast.BasicLit:
		return strings.Trim(e.Value, `"`)
	case *ast.Ident:
		return e.Name
	case *ast.SelectorExpr:
		if pkg, ok := e.X.(*ast.Ident); ok {
			return pkg.Name + "." + e.Sel.Name
		}
		return e.Sel.Name
	default:
		return "unknown_key"
	}
}

func isGoroutineCall(call *ast.CallExpr) bool {
	if parent, ok := call.Fun.(*ast.Ident); ok {
		return parent.Name == "go"
	}
	return false
}

func ParseConfig(path string) (map[string]interface{}, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	var config map[string]interface{}
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	return config, nil
}
