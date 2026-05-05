package analyzer

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"regexp"
	"strings"
	"time"

	"go-iface-analyzer/internal/config"
	"go-iface-analyzer/internal/database"
	"go-iface-analyzer/internal/models"
)

type AnalysisResult struct {
	SessionID    int64
	TotalCases   int
	IssuesFound  int
	Categories   map[string]int
	Severity     map[string]int
}

type Analyzer struct {
	db *database.Database
}

func New(db *database.Database) *Analyzer {
	return &Analyzer{db: db}
}

func (a *Analyzer) Analyze(interfaceCases *config.InterfaceConfig, callRecords []config.CallRecord, snippets map[string]string) (*AnalysisResult, error) {
	session, err := a.db.CreateSession()
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	result := &AnalysisResult{
		SessionID:  session.ID,
		Categories: make(map[string]int),
		Severity:   make(map[string]int),
	}

	for _, c := range interfaceCases.Cases {
		caseModel := &models.InterfaceCase{
			SessionID:   session.ID,
			CaseName:    c.Name,
			Category:    c.Category,
			Description: c.Description,
			SourceFile:  c.SourceFile,
			LineNumber:  c.LineNumber,
		}

		caseID, err := a.db.CreateCase(caseModel)
		if err != nil {
			return nil, fmt.Errorf("failed to create case: %w", err)
		}

		result.TotalCases++
		result.Categories[c.Category]++

		issues, err := a.analyzeCase(caseModel, caseID, snippets)
		if err != nil {
			return nil, fmt.Errorf("failed to analyze case %s: %w", c.Name, err)
		}

		for _, issue := range issues {
			result.IssuesFound++
			result.Severity[issue.Severity]++
			if err := a.db.CreateIssue(issue); err != nil {
				return nil, fmt.Errorf("failed to create issue: %w", err)
			}
		}
	}

	for _, record := range callRecords {
		if err := a.analyzeCallRecord(session.ID, record); err != nil {
			return nil, fmt.Errorf("failed to analyze call record: %w", err)
		}
	}

	session.EndTime = time.Now()
	session.Status = "completed"
	session.TotalCases = result.TotalCases
	session.IssuesFound = result.IssuesFound

	if err := a.db.UpdateSession(session); err != nil {
		return nil, fmt.Errorf("failed to update session: %w", err)
	}

	return result, nil
}

func (a *Analyzer) analyzeCase(c *models.InterfaceCase, caseID int64, snippets map[string]string) ([]*models.AnalysisIssue, error) {
	var issues []*models.AnalysisIssue

	if c.SourceFile != "" {
		if snippet, ok := snippets[c.SourceFile]; ok {
			codeIssues, err := a.analyzeCodeSnippet(caseID, c.SourceFile, snippet, c.Category)
			if err != nil {
				return nil, err
			}
			issues = append(issues, codeIssues...)
		}
	}

	switch c.Category {
	case "eface_iface":
		issues = append(issues, a.analyzeEfaceIface(caseID, c)...)
	case "itab":
		issues = append(issues, a.analyzeItab(caseID, c)...)
	case "dynamic_type":
		issues = append(issues, a.analyzeDynamicType(caseID, c)...)
	case "method_set":
		issues = append(issues, a.analyzeMethodSet(caseID, c)...)
	case "type_assertion":
		issues = append(issues, a.analyzeTypeAssertion(caseID, c)...)
	case "type_switch":
		issues = append(issues, a.analyzeTypeSwitch(caseID, c)...)
	case "typed_nil":
		issues = append(issues, a.analyzeTypedNil(caseID, c)...)
	case "allocation":
		issues = append(issues, a.analyzeAllocation(caseID, c)...)
	}

	return issues, nil
}

func (a *Analyzer) analyzeCodeSnippet(caseID int64, filename string, code string, category string) ([]*models.AnalysisIssue, error) {
	var issues []*models.AnalysisIssue

	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, filename, code, parser.AllErrors)
	if err != nil {
		issue := &models.AnalysisIssue{
			CaseID:      caseID,
			IssueType:   "parse_error",
			Severity:    "high",
			Description: fmt.Sprintf("代码解析错误: %v", err),
			Location:    filename,
			Suggestion:  "请检查代码语法是否正确",
		}
		issues = append(issues, issue)
		return issues, nil
	}

	ast.Inspect(file, func(n ast.Node) bool {
		if n == nil {
			return true
		}

		switch node := n.(type) {
		case *ast.TypeAssertExpr:
			pos := fset.Position(node.Pos())
			taInfo := &models.TypeAssertionInfo{
				CaseID:       caseID,
				Location:     fmt.Sprintf("%s:%d", filename, pos.Line),
				IsTypeSwitch: false,
				HasCommaOk:   false,
			}

			if ident, ok := node.Type.(*ast.Ident); ok {
				taInfo.TargetType = ident.Name
			}

			if assign, ok := node.X.(*ast.AssignStmt); ok {
				if len(assign.Lhs) == 2 {
					taInfo.HasCommaOk = true
				}
			}

			risk := "low"
			if !taInfo.HasCommaOk {
				risk = "high"
				issues = append(issues, &models.AnalysisIssue{
					CaseID:      caseID,
					IssueType:   "unsafe_type_assertion",
					Severity:    "high",
					Description: fmt.Sprintf("在 %s:%d 发现不安全的类型断言，未使用 comma-ok 模式", filename, pos.Line),
					Location:    taInfo.Location,
					Suggestion:  "建议使用 `value, ok := interface.(Type)` 模式来避免 panic",
				})
			}
			taInfo.RiskLevel = risk
			a.db.CreateTypeAssertionInfo(taInfo)

		case *ast.TypeSwitchStmt:
			pos := fset.Position(node.Pos())
			issues = append(issues, &models.AnalysisIssue{
				CaseID:      caseID,
				IssueType:   "type_switch",
				Severity:    "info",
				Description: fmt.Sprintf("在 %s:%d 发现 type switch", filename, pos.Line),
				Location:    fmt.Sprintf("%s:%d", filename, pos.Line),
				Suggestion:  "type switch 是处理多种类型的安全方式",
			})

			taInfo := &models.TypeAssertionInfo{
				CaseID:       caseID,
				Location:     fmt.Sprintf("%s:%d", filename, pos.Line),
				IsTypeSwitch: true,
				RiskLevel:    "low",
			}
			a.db.CreateTypeAssertionInfo(taInfo)
		}

		return true
	})

	issues = append(issues, a.checkAllocationPatterns(caseID, filename, code)...)

	return issues, nil
}

func (a *Analyzer) checkAllocationPatterns(caseID int64, filename string, code string) []*models.AnalysisIssue {
	var issues []*models.AnalysisIssue

	allocationPatterns := []struct {
		pattern    *regexp.Regexp
		issueType  string
		severity   string
		desc       string
		suggestion string
	}{
		{
			pattern:    regexp.MustCompile(`var\s+\w+\s+interface\{\}\s*=\s*\d+`),
			issueType:  "boxing_allocation",
			severity:   "medium",
			desc:       "发现接口装箱可能导致堆分配：将基本类型赋值给空接口",
			suggestion: "考虑使用类型参数或避免在热路径中使用接口装箱",
		},
		{
			pattern:    regexp.MustCompile(`var\s+i\s+interface\{\}\s*=\s*&\s*\w+\{\}`),
			issueType:  "pointer_boxing",
			severity:   "low",
			desc:       "发现指针类型的接口装箱",
			suggestion: "指针装箱通常不会额外分配，但要注意接口内部表示的差异",
		},
	}

	for _, p := range allocationPatterns {
		matches := p.pattern.FindAllStringIndex(code, -1)
		for _, match := range matches {
			line := strings.Count(code[:match[0]], "\n") + 1
			risk := &models.AllocationRisk{
				CaseID:      caseID,
				Location:    fmt.Sprintf("%s:%d", filename, line),
				Description: p.desc,
				RiskType:    p.issueType,
				Example:     code[match[0]:match[1]],
			}
			a.db.CreateAllocationRisk(risk)

			issues = append(issues, &models.AnalysisIssue{
				CaseID:      caseID,
				IssueType:   p.issueType,
				Severity:    p.severity,
				Description: fmt.Sprintf("在 %s:%d %s", filename, line, p.desc),
				Location:    fmt.Sprintf("%s:%d", filename, line),
				Suggestion:  p.suggestion,
			})
		}
	}

	return issues
}

func (a *Analyzer) analyzeEfaceIface(caseID int64, c *models.InterfaceCase) []*models.AnalysisIssue {
	var issues []*models.AnalysisIssue

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "eface_analysis",
		Severity:    "info",
		Description: "空接口 (interface{}) 底层使用 eface 结构",
		Location:    c.SourceFile,
		Suggestion:  "eface 包含两个指针：_type (类型信息) 和 data (数据指针)",
	})

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "iface_analysis",
		Severity:    "info",
		Description: "带方法的接口底层使用 iface 结构",
		Location:    c.SourceFile,
		Suggestion:  "iface 包含两个指针：itab (接口表) 和 data (数据指针)",
	})

	return issues
}

func (a *Analyzer) analyzeItab(caseID int64, c *models.InterfaceCase) []*models.AnalysisIssue {
	var issues []*models.AnalysisIssue

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "itab_analysis",
		Severity:    "info",
		Description: "itab 是接口和具体类型之间的动态绑定",
		Location:    c.SourceFile,
		Suggestion:  "itab 包含：inter (接口类型)、_type (具体类型)、hash (类型哈希)、fun (方法表)",
	})

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "itab_caching",
		Severity:    "medium",
		Description: "itab 会被缓存，但类型转换时仍可能有开销",
		Location:    c.SourceFile,
		Suggestion: "在热路径中频繁进行接口断言可能影响性能，考虑缓存结果或重构设计",
	})

	return issues
}

func (a *Analyzer) analyzeDynamicType(caseID int64, c *models.InterfaceCase) []*models.AnalysisIssue {
	var issues []*models.AnalysisIssue

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "dynamic_type_info",
		Severity:    "info",
		Description: "接口的动态类型和值在运行时确定",
		Location:    c.SourceFile,
		Suggestion: "使用 reflect.TypeOf() 和 reflect.ValueOf() 可以获取动态类型信息，但有性能开销",
	})

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "nil_interface_check",
		Severity:    "high",
		Description: "接口的 nil 判断需要同时考虑类型和值都为 nil",
		Location:    c.SourceFile,
		Suggestion: "注意：var i interface{} = (*int)(nil) 中 i != nil，因为类型不为 nil",
	})

	return issues
}

func (a *Analyzer) analyzeMethodSet(caseID int64, c *models.InterfaceCase) []*models.AnalysisIssue {
	var issues []*models.AnalysisIssue

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "value_receiver",
		Severity:    "info",
		Description: "值接收者方法：值类型和指针类型都可以调用",
		Location:    c.SourceFile,
		Suggestion: "值接收者方法会复制接收者，适合小类型；大类型考虑指针接收者",
	})

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "ptr_receiver",
		Severity:    "info",
		Description: "指针接收者方法：只有指针类型可以调用",
		Location:    c.SourceFile,
		Suggestion: "指针接收者不会复制，适合大类型或需要修改接收者的场景",
	})

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "method_set_rule",
		Severity:    "high",
		Description: "方法集规则：*T 包含 T 和 *T 的方法；T 只包含 T 的方法",
		Location:    c.SourceFile,
		Suggestion: "如果类型有指针接收者方法，只有指针类型才能实现需要这些方法的接口",
	})

	return issues
}

func (a *Analyzer) analyzeTypeAssertion(caseID int64, c *models.InterfaceCase) []*models.AnalysisIssue {
	var issues []*models.AnalysisIssue

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "type_assertion_syntax",
		Severity:    "info",
		Description: "类型断言语法：value := interface.(Type)",
		Location:    c.SourceFile,
		Suggestion: "类型不匹配时会 panic，建议使用 comma-ok 模式：value, ok := interface.(Type)",
	})

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "type_assertion_perf",
		Severity:    "medium",
		Description: "类型断言有运行时开销，需要检查 itab 缓存或计算",
		Location:    c.SourceFile,
		Suggestion: "在热循环中避免频繁类型断言，考虑缓存结果或使用类型参数",
	})

	return issues
}

func (a *Analyzer) analyzeTypeSwitch(caseID int64, c *models.InterfaceCase) []*models.AnalysisIssue {
	var issues []*models.AnalysisIssue

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "type_switch_analysis",
		Severity:    "info",
		Description: "type switch 是处理多种类型的安全方式",
		Location:    c.SourceFile,
		Suggestion: "type switch 不会 panic，每个 case 处理一种类型，default 处理未匹配的情况",
	})

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "type_switch_nil_case",
		Severity:    "medium",
		Description: "type switch 中可以单独处理 nil 情况",
		Location:    c.SourceFile,
		Suggestion: "使用 case nil: 来明确处理接口为 nil 的情况，这与 typed nil 不同",
	})

	return issues
}

func (a *Analyzer) analyzeTypedNil(caseID int64, c *models.InterfaceCase) []*models.AnalysisIssue {
	var issues []*models.AnalysisIssue

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "typed_nil_concept",
		Severity:    "high",
		Description: "typed nil：接口有类型但值为 nil",
		Location:    c.SourceFile,
		Suggestion: "例如：var i interface{} = (*int)(nil)，此时 i != nil",
	})

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "typed_nil_bug",
		Severity:    "critical",
		Description: "typed nil 是 Go 中常见的 bug 来源",
		Location:    c.SourceFile,
		Suggestion: "返回接口时，确保不要返回 typed nil。使用显式的 nil 返回或检查值的 nil 状态",
	})

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "typed_nil_check",
		Severity:    "high",
		Description: "如何检查 typed nil",
		Location:    c.SourceFile,
		Suggestion: "使用 reflect.ValueOf(v).IsNil() 来检查值是否为 nil，或使用类型断言后再检查",
	})

	return issues
}

func (a *Analyzer) analyzeAllocation(caseID int64, c *models.InterfaceCase) []*models.AnalysisIssue {
	var issues []*models.AnalysisIssue

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "boxing_allocation",
		Severity:    "high",
		Description: "接口装箱可能导致堆分配",
		Location:    c.SourceFile,
		Suggestion: "当把值类型赋给接口时，如果值无法存放到接口的 data 字段（大于一个指针大小），会发生堆分配",
	})

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "escape_analysis",
		Severity:    "medium",
		Description: "使用逃逸分析来检查分配",
		Location:    c.SourceFile,
		Suggestion: "使用 go build -gcflags='-m' 来查看哪些变量逃逸到堆上",
	})

	issues = append(issues, &models.AnalysisIssue{
		CaseID:      caseID,
		IssueType:   "pointer_boxing",
		Severity:    "low",
		Description: "指针装箱通常不会额外分配",
		Location:    c.SourceFile,
		Suggestion: "指针类型赋给接口时，data 字段直接存储指针，不会额外分配",
	})

	return issues
}

func (a *Analyzer) analyzeCallRecord(sessionID int64, record config.CallRecord) error {
	if record.Allocation {
		issue := &models.AnalysisIssue{
			SessionID:   sessionID,
			IssueType:   "call_record_allocation",
			Severity:    "medium",
			Description: fmt.Sprintf("调用记录显示分配：%s -> %s, 方法: %s", record.Interface, record.Concrete, record.MethodCall),
			Location:    fmt.Sprintf("%s:%d", record.SourceFile, record.LineNumber),
			Suggestion:  "检查此调用是否在热路径中，考虑优化",
		}
		return a.db.CreateIssue(issue)
	}
	return nil
}
