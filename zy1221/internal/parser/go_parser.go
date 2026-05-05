package parser

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/zy1221/slice-teacher/internal/errors"
	"github.com/zy1221/slice-teacher/internal/model"
)

func ParseGoSnippets(dir string) ([]*model.Snippet, []*model.Operation, error) {
	var allSnippets []*model.Snippet
	var allOperations []*model.Operation

	files, err := filepath.Glob(filepath.Join(dir, "*.go"))
	if err != nil {
		return nil, nil, errors.NewIOError("无法读取 snippets 目录", dir, err)
	}

	if len(files) == 0 {
		return nil, nil, errors.NewValidationError(
			"snippets 目录中没有找到 .go 文件",
			dir,
			"请在 snippets 目录中添加至少一个 Go 源代码文件",
		)
	}

	for _, filename := range files {
		snippets, ops, err := parseGoFile(filename)
		if err != nil {
			return nil, nil, err
		}
		allSnippets = append(allSnippets, snippets...)
		allOperations = append(allOperations, ops...)
	}

	return allSnippets, allOperations, nil
}

func parseGoFile(filename string) ([]*model.Snippet, []*model.Operation, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, nil, errors.NewIOError("无法读取文件", filename, err)
	}

	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, filename, data, 0)
	if err != nil {
		return nil, nil, errors.NewParseError(
			"Go 代码解析失败",
			filename,
			0,
			"请检查 Go 语法是否正确",
			err,
		)
	}

	var snippets []*model.Snippet
	var operations []*model.Operation

	lines := strings.Split(string(data), "\n")

	ast.Inspect(file, func(n ast.Node) bool {
		if n == nil {
			return true
		}

		switch node := n.(type) {
		case *ast.AssignStmt:
			for _, rhs := range node.Rhs {
				op := extractOperationFromExpr(rhs, fset, lines, filename)
				if op != nil {
					if len(node.Lhs) > 0 {
						if ident, ok := node.Lhs[0].(*ast.Ident); ok {
							op.Target = ident.Name
						}
					}
					operations = append(operations, op)
				}
			}

		case *ast.ExprStmt:
			op := extractOperationFromExpr(node.X, fset, lines, filename)
			if op != nil {
				operations = append(operations, op)
			}

		case *ast.CallExpr:
			op := extractOperationFromCall(node, fset, lines, filename)
			if op != nil {
				operations = append(operations, op)
			}
		}

		return true
	})

	commentOps := extractOperationsFromComments(file, fset, lines, filename)
	operations = append(operations, commentOps...)

	if len(operations) > 0 {
		snippets = append(snippets, &model.Snippet{
			Filename:    filename,
			Content:     string(data),
			LineStart:   1,
			LineEnd:     len(lines),
			Description: fmt.Sprintf("文件 %s 包含 %d 个 slice 操作", filepath.Base(filename), len(operations)),
		})
	}

	return snippets, operations, nil
}

func extractOperationFromExpr(expr ast.Expr, fset *token.FileSet, lines []string, filename string) *model.Operation {
	switch e := expr.(type) {
	case *ast.CallExpr:
		return extractOperationFromCall(e, fset, lines, filename)

	case *ast.SliceExpr:
		return extractOperationFromSliceExpr(e, fset, lines, filename)

	case *ast.UnaryExpr:
		if e.Op == token.AND {
			return &model.Operation{
				Type:        model.OpFuncPassByRef,
				Description: fmt.Sprintf("取地址操作: %s", lines[fset.Position(e.Pos()).Line-1]),
				LineNumber:  fset.Position(e.Pos()).Line,
			}
		}
	}

	return nil
}

func extractOperationFromCall(call *ast.CallExpr, fset *token.FileSet, lines []string, filename string) *model.Operation {
	lineNum := fset.Position(call.Pos()).Line

	switch fun := call.Fun.(type) {
	case *ast.Ident:
		switch fun.Name {
		case "make":
			return extractMakeOperation(call, fset, lines, filename)

		case "append":
			return extractAppendOperation(call, fset, lines, filename)

		case "copy":
			return extractCopyOperation(call, fset, lines, filename)

		case "delete":
			return &model.Operation{
				Type:        model.OpDelete,
				Description: fmt.Sprintf("delete 操作: %s", lines[lineNum-1]),
				LineNumber:  lineNum,
			}
		}

	case *ast.SelectorExpr:
		if ident, ok := fun.X.(*ast.Ident); ok {
			return &model.Operation{
				Type:        model.OpFuncPassByValue,
				Target:      ident.Name,
				Description: fmt.Sprintf("方法调用: %s", lines[lineNum-1]),
				LineNumber:  lineNum,
			}
		}
	}

	return nil
}

func extractMakeOperation(call *ast.CallExpr, fset *token.FileSet, lines []string, filename string) *model.Operation {
	lineNum := fset.Position(call.Pos()).Line
	params := make(map[string]interface{})

	if len(call.Args) >= 2 {
		if lenExpr, ok := call.Args[1].(*ast.BasicLit); ok && lenExpr.Kind == token.INT {
			lenVal, _ := strconv.Atoi(lenExpr.Value)
			params["len"] = lenVal
		}
		if len(call.Args) >= 3 {
			if capExpr, ok := call.Args[2].(*ast.BasicLit); ok && capExpr.Kind == token.INT {
				capVal, _ := strconv.Atoi(capExpr.Value)
				params["cap"] = capVal
			}
		}
	}

	return &model.Operation{
		Type:        model.OpMake,
		Parameters:  params,
		Description: fmt.Sprintf("make 创建 slice: %s", lines[lineNum-1]),
		LineNumber:  lineNum,
	}
}

func extractAppendOperation(call *ast.CallExpr, fset *token.FileSet, lines []string, filename string) *model.Operation {
	lineNum := fset.Position(call.Pos()).Line
	params := make(map[string]interface{})

	if len(call.Args) >= 1 {
		if ident, ok := call.Args[0].(*ast.Ident); ok {
			params["source"] = ident.Name
		}
		params["num_elements"] = len(call.Args) - 1
	}

	return &model.Operation{
		Type:        model.OpAppend,
		Parameters:  params,
		Description: fmt.Sprintf("append 操作: %s", lines[lineNum-1]),
		LineNumber:  lineNum,
	}
}

func extractCopyOperation(call *ast.CallExpr, fset *token.FileSet, lines []string, filename string) *model.Operation {
	lineNum := fset.Position(call.Pos()).Line
	sources := []string{}

	if len(call.Args) >= 2 {
		if ident, ok := call.Args[1].(*ast.Ident); ok {
			sources = append(sources, ident.Name)
		}
	}

	return &model.Operation{
		Type:        model.OpCopy,
		Sources:     sources,
		Description: fmt.Sprintf("copy 操作: %s", lines[lineNum-1]),
		LineNumber:  lineNum,
	}
}

func extractOperationFromSliceExpr(slice *ast.SliceExpr, fset *token.FileSet, lines []string, filename string) *model.Operation {
	lineNum := fset.Position(slice.Pos()).Line
	params := make(map[string]interface{})

	if slice.Low != nil {
		if lit, ok := slice.Low.(*ast.BasicLit); ok && lit.Kind == token.INT {
			lowVal, _ := strconv.Atoi(lit.Value)
			params["low"] = lowVal
		}
	}
	if slice.High != nil {
		if lit, ok := slice.High.(*ast.BasicLit); ok && lit.Kind == token.INT {
			highVal, _ := strconv.Atoi(lit.Value)
			params["high"] = highVal
		}
	}
	if slice.Max != nil {
		if lit, ok := slice.Max.(*ast.BasicLit); ok && lit.Kind == token.INT {
			maxVal, _ := strconv.Atoi(lit.Value)
			params["max"] = maxVal
		}
	}

	opType := model.OpSlice
	if slice.Max != nil {
		opType = model.OpFullSlice
	}

	return &model.Operation{
		Type:        opType,
		Parameters:  params,
		Description: fmt.Sprintf("切片表达式: %s", lines[lineNum-1]),
		LineNumber:  lineNum,
	}
}

func extractOperationsFromComments(file *ast.File, fset *token.FileSet, lines []string, filename string) []*model.Operation {
	var ops []*model.Operation

	annotationPattern := regexp.MustCompile(`//\s*@slice-op:\s*(\w+)(?:\s*\((.*)\))?`)

	for _, group := range file.Comments {
		for _, comment := range group.List {
			lineNum := fset.Position(comment.Pos()).Line
			matches := annotationPattern.FindStringSubmatch(comment.Text)
			if len(matches) >= 2 {
				opType := model.OpType(matches[1])
				params := make(map[string]interface{})

				if len(matches) >= 3 && matches[2] != "" {
					paramStr := matches[2]
					paramPairs := strings.Split(paramStr, ",")
					for _, pair := range paramPairs {
						pair = strings.TrimSpace(pair)
						if idx := strings.Index(pair, "="); idx > 0 {
							key := strings.TrimSpace(pair[:idx])
							value := strings.TrimSpace(pair[idx+1:])
							params[key] = value
						}
					}
				}

				ops = append(ops, &model.Operation{
					Type:        opType,
					Parameters:  params,
					Description: fmt.Sprintf("注释标注的操作: %s", comment.Text),
					LineNumber:  lineNum,
				})
			}
		}
	}

	return ops
}
