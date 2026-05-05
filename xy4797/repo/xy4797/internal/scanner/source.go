package scanner

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"go-quality-scanner/internal/config"
	"go-quality-scanner/internal/models"
)

// SourceScanner 源码扫描器
type SourceScanner struct {
	rules *config.RulesConfig
}

// NewSourceScanner 创建新的源码扫描器
func NewSourceScanner(rules *config.RulesConfig) *SourceScanner {
	return &SourceScanner{
		rules: rules,
	}
}

// ScanResult 扫描结果
type ScanResult struct {
	Issues      []*models.Issue
	FilesScanned int
	TestFilesScanned int
}

// Scan 扫描源码文件
func (s *SourceScanner) Scan(projectPath string) (*ScanResult, error) {
	result := &ScanResult{}
	
	// 遍历项目目录，查找所有 .go 文件
	err := filepath.Walk(projectPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		// 只处理 .go 文件
		if info.IsDir() || !strings.HasSuffix(info.Name(), ".go") {
			return nil
		}
		
		// 跳过 vendor 目录
		if strings.Contains(path, "vendor") || strings.Contains(path, ".git") {
			return nil
		}
		
		// 检查是否是测试文件
		isTestFile := strings.HasSuffix(info.Name(), "_test.go")
		if isTestFile {
			result.TestFilesScanned++
		} else {
			result.FilesScanned++
		}
		
		// 扫描单个文件
		fileIssues, err := s.scanFile(path, projectPath)
		if err != nil {
			return fmt.Errorf("failed to scan file %s: %w", path, err)
		}
		
		result.Issues = append(result.Issues, fileIssues...)
		return nil
	})
	
	if err != nil {
		return nil, fmt.Errorf("failed to walk project directory: %w", err)
	}
	
	return result, nil
}

// scanFile 扫描单个文件
func (s *SourceScanner) scanFile(filePath, projectPath string) ([]*models.Issue, error) {
	var issues []*models.Issue
	
	// 计算相对路径
	relPath, err := filepath.Rel(projectPath, filePath)
	if err != nil {
		relPath = filePath
	}
	
	// 读取文件
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	
	var lines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	
	// 检查各种规则
	if s.rules.Rules.CrossLayerImport.Enabled {
		importIssues := s.checkCrossLayerImports(lines, relPath, filePath)
		issues = append(issues, importIssues...)
	}
	
	if s.rules.Rules.BareReturnError.Enabled {
		returnIssues := s.checkBareReturnErrors(lines, relPath, filePath)
		issues = append(issues, returnIssues...)
	}
	
	if s.rules.Rules.UnhandledError.Enabled {
		unhandledIssues := s.checkUnhandledErrors(lines, relPath, filePath)
		issues = append(issues, unhandledIssues...)
	}
	
	if s.rules.Rules.ExpiredTodo.Enabled {
		todoIssues := s.checkExpiredTodos(lines, relPath, filePath)
		issues = append(issues, todoIssues...)
	}
	
	return issues, nil
}

// checkCrossLayerImports 检查跨层导入
func (s *SourceScanner) checkCrossLayerImports(lines []string, relPath, fullPath string) []*models.Issue {
	var issues []*models.Issue
	rule := s.rules.Rules.CrossLayerImport
	
	// 确定文件属于哪一层
	var currentLayer *config.LayerConfig
	for i := range rule.Layers {
		layer := &rule.Layers[i]
		if strings.Contains(relPath, layer.PathPattern) {
			currentLayer = layer
			break
		}
	}
	
	if currentLayer == nil {
		return issues
	}
	
	// 检查 import 块
	inImportBlock := false
	importPattern := regexp.MustCompile(`"([^"]+)"`)
	
	for lineNum, line := range lines {
		line = strings.TrimSpace(line)
		
		if strings.HasPrefix(line, "import (") {
			inImportBlock = true
			continue
		}
		if inImportBlock && strings.HasPrefix(line, ")") {
			inImportBlock = false
			continue
		}
		
		if inImportBlock || strings.HasPrefix(line, "import ") {
			matches := importPattern.FindStringSubmatch(line)
			if len(matches) > 1 {
				importPath := matches[1]
				
				// 检查是否是禁止的导入
				for _, forbidden := range currentLayer.ForbiddenImports {
					if strings.Contains(importPath, forbidden) {
						// 检查是否在允许列表中
						allowed := false
						for _, allow := range currentLayer.AllowedImports {
							if strings.Contains(importPath, allow) {
								allowed = true
								break
							}
						}
						
						if !allowed {
							issue := &models.Issue{
								RuleType:    "cross_layer_import",
								Severity:    rule.Severity,
								Description: rule.Description,
								File:        relPath,
								Line:        lineNum + 1,
								CodeSnippet: line,
								Message:     fmt.Sprintf("Layer '%s' cannot import '%s' (forbidden pattern: %s)", 
									currentLayer.Name, importPath, forbidden),
							}
							issues = append(issues, issue)
						}
					}
				}
			}
		}
	}
	
	return issues
}

// checkBareReturnErrors 检查裸返回错误
func (s *SourceScanner) checkBareReturnErrors(lines []string, relPath, fullPath string) []*models.Issue {
	var issues []*models.Issue
	rule := s.rules.Rules.BareReturnError
	
	// 匹配裸返回模式
	// 例如: return err, return nil, err, return result, err
	bareReturnPatterns := []*regexp.Regexp{
		regexp.MustCompile(`^\s*return\s+err\s*$`),
		regexp.MustCompile(`^\s*return\s+nil,\s*err\s*$`),
		regexp.MustCompile(`^\s*return\s+\w+,\s*err\s*$`),
		regexp.MustCompile(`^\s*return\s+\w+,\s*nil,\s*err\s*$`),
	}
	
	// 但我们需要排除 fmt.Errorf 包装的情况
	wrappedErrorPattern := regexp.MustCompile(`fmt\.Errorf|errors\.Wrap|errors\.WithMessage`)
	
	for lineNum, line := range lines {
		// 检查是否匹配裸返回模式
		for _, pattern := range bareReturnPatterns {
			if pattern.MatchString(line) {
				// 检查是否已经被包装
				if !wrappedErrorPattern.MatchString(line) {
					issue := &models.Issue{
						RuleType:    "bare_return_error",
						Severity:    rule.Severity,
						Description: rule.Description,
						File:        relPath,
						Line:        lineNum + 1,
						CodeSnippet: strings.TrimSpace(line),
						Message:     fmt.Sprintf("Bare error return detected: '%s'. Consider wrapping with fmt.Errorf or adding context.", 
							strings.TrimSpace(line)),
					}
					issues = append(issues, issue)
				}
				break
			}
		}
	}
	
	return issues
}

// checkUnhandledErrors 检查未处理的错误
func (s *SourceScanner) checkUnhandledErrors(lines []string, relPath, fullPath string) []*models.Issue {
	var issues []*models.Issue
	rule := s.rules.Rules.UnhandledError
	
	// 匹配忽略错误的模式: _ = someFunc(...)
	ignorePattern := regexp.MustCompile(`^\s*_\s*=\s*\w+\(`)
	
	// 匹配调用函数但没有处理返回值的情况（简化版）
	// 注意：这只是一个简化的检测，真正的未处理错误需要更复杂的静态分析
	callWithoutErrCheck := regexp.MustCompile(`^\s*\w+\(.*\)\s*$`)
	
	// 排除的模式
	excludePatterns := []*regexp.Regexp{
		regexp.MustCompile(`^//`),        // 注释
		regexp.MustCompile(`^import`),    // import 语句
		regexp.MustCompile(`^package`),   // package 语句
		regexp.MustCompile(`^func`),      // func 声明
		regexp.MustCompile(`^type`),      // type 声明
		regexp.MustCompile(`^var`),       // var 声明
		regexp.MustCompile(`^const`),     // const 声明
		regexp.MustCompile(`^return`),    // return 语句
		regexp.MustCompile(`^if`),        // if 语句
		regexp.MustCompile(`^for`),       // for 语句
		regexp.MustCompile(`^switch`),    // switch 语句
		regexp.MustCompile(`^case`),      // case 语句
		regexp.MustCompile(`^default`),   // default 语句
		regexp.MustCompile(`^defer`),     // defer 语句
		regexp.MustCompile(`^go`),        // go 语句
		regexp.MustCompile(`^select`),    // select 语句
		regexp.MustCompile(`\s*=\s*`),    // 赋值语句（已经处理了返回值）
	}
	
	for lineNum, line := range lines {
		trimmedLine := strings.TrimSpace(line)
		
		// 检查是否是忽略错误: _ = someFunc(...)
		if ignorePattern.MatchString(trimmedLine) {
			issue := &models.Issue{
				RuleType:    "unhandled_error",
				Severity:    rule.Severity,
				Description: rule.Description,
				File:        relPath,
				Line:        lineNum + 1,
				CodeSnippet: trimmedLine,
				Message:     fmt.Sprintf("Error explicitly ignored with '_': '%s'. Consider handling the error or at least logging it.", 
					trimmedLine),
			}
			issues = append(issues, issue)
			continue
		}
		
		// 简化的未处理错误检查
		// 注意：这只是一个启发式检查，可能会有误报
		// 真正完整的检查需要使用 go/ast 进行静态分析
		if callWithoutErrCheck.MatchString(trimmedLine) {
			// 检查是否是排除的模式
			isExcluded := false
			for _, exclude := range excludePatterns {
				if exclude.MatchString(trimmedLine) {
					isExcluded = true
					break
				}
			}
			
			// 检查是否是方法调用（可能有多个返回值）
			// 这里我们简化处理：如果函数名可能返回 error，标记为潜在问题
			if !isExcluded {
				// 检查是否是可能返回错误的函数（根据命名约定）
				lowerLine := strings.ToLower(trimmedLine)
				errorRelatedNames := []string{"error", "err", "fail", "open", "read", "write", "close", "connect", "dial", "exec", "query"}
				
				for _, name := range errorRelatedNames {
					if strings.Contains(lowerLine, name) {
						// 这是一个潜在的未处理错误
						issue := &models.Issue{
							RuleType:    "unhandled_error",
							Severity:    "low", // 标记为低优先级，因为这是启发式检查
							Description: rule.Description,
							File:        relPath,
							Line:        lineNum + 1,
							CodeSnippet: trimmedLine,
							Message:     fmt.Sprintf("Potential unhandled error: '%s'. Verify if this function returns an error that should be handled.", 
								trimmedLine),
						}
						issues = append(issues, issue)
						break
					}
				}
			}
		}
	}
	
	return issues
}

// checkExpiredTodos 检查过期的 TODO
func (s *SourceScanner) checkExpiredTodos(lines []string, relPath, fullPath string) []*models.Issue {
	var issues []*models.Issue
	rule := s.rules.Rules.ExpiredTodo
	
	// TODO 模式
	todoPatterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)TODO:`),
		regexp.MustCompile(`(?i)TODO\s+`),
		regexp.MustCompile(`(?i)FIXME:`),
		regexp.MustCompile(`(?i)FIXME\s+`),
		regexp.MustCompile(`(?i)HACK:`),
		regexp.MustCompile(`(?i)HACK\s+`),
	}
	
	// 日期模式: YYYY-MM-DD 或 MM/DD/YYYY 等
	datePatterns := []*regexp.Regexp{
		regexp.MustCompile(`(\d{4})-(\d{2})-(\d{2})`),
		regexp.MustCompile(`(\d{2})/(\d{2})/(\d{4})`),
		regexp.MustCompile(`(\d{2})-(\d{2})-(\d{4})`),
	}
	
	for lineNum, line := range lines {
		for _, pattern := range todoPatterns {
			if pattern.MatchString(line) {
				// 找到 TODO，检查是否有日期
				var hasDate bool
				var todoDate string
				
				for _, datePat := range datePatterns {
					matches := datePat.FindStringSubmatch(line)
					if len(matches) > 0 {
						hasDate = true
						todoDate = matches[0]
						break
					}
				}
				
				var message string
				if hasDate {
					message = fmt.Sprintf("TODO with date found: '%s'. Please check if this TODO is still relevant (expire threshold: %d days).", 
						strings.TrimSpace(line), rule.ExpireDays)
				} else {
					message = fmt.Sprintf("TODO without date found: '%s'. Consider adding a completion date or removing it if done.", 
						strings.TrimSpace(line))
				}
				
				issue := &models.Issue{
					RuleType:    "expired_todo",
					Severity:    rule.Severity,
					Description: rule.Description,
					File:        relPath,
					Line:        lineNum + 1,
					CodeSnippet: strings.TrimSpace(line),
					Message:     message,
				}
				issues = append(issues, issue)
				break
			}
		}
	}
	
	return issues
}
