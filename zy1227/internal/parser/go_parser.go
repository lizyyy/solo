package parser

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"

	"github.com/yourteam/sync-analyzer/internal/models"
)

// GoParser 用于解析 Go 代码文件
type GoParser struct {
	fset *token.FileSet
}

// NewGoParser 创建一个新的 Go 代码解析器
func NewGoParser() *GoParser {
	return &GoParser{
		fset: token.NewFileSet(),
	}
}

// ParseSnippet 解析单个 Go 代码文件
func (p *GoParser) ParseSnippet(filePath string) (*models.CodeSnippet, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	node, err := parser.ParseFile(p.fset, filePath, content, parser.ParseComments)
	if err != nil {
		return nil, err
	}

	snippet := &models.CodeSnippet{
		FilePath:   filePath,
		Content:    string(content),
		Primitives: []models.PrimitiveUsage{},
		Operations: []models.OperationUsage{},
	}

	// 分析 AST 以提取 sync 原语和操作
	p.analyzeAST(node, snippet)

	return snippet, nil
}

// ParseSnippets 解析目录中的所有 Go 代码文件
func (p *GoParser) ParseSnippets(dirPath string) ([]*models.CodeSnippet, error) {
	var snippets []*models.CodeSnippet

	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		if !strings.HasSuffix(info.Name(), ".go") {
			return nil
		}

		snippet, err := p.ParseSnippet(path)
		if err != nil {
			return err
		}

		snippets = append(snippets, snippet)
		return nil
	})

	if err != nil {
		return nil, err
	}

	return snippets, nil
}

// analyzeAST 分析 AST 以提取 sync 原语和操作
func (p *GoParser) analyzeAST(node *ast.File, snippet *models.CodeSnippet) {
	// 查找 sync 包导入
	hasSyncImport := false
	for _, imp := range node.Imports {
		if imp.Path.Value == `"sync"` || imp.Path.Value == `"sync/atomic"` {
			hasSyncImport = true
			break
		}
	}

	if !hasSyncImport {
		return
	}

	// 遍历声明
	for _, decl := range node.Decls {
		p.analyzeDecl(decl, snippet)
	}
}

// analyzeDecl 分析声明
func (p *GoParser) analyzeDecl(decl ast.Decl, snippet *models.CodeSnippet) {
	switch d := decl.(type) {
	case *ast.GenDecl:
		// 变量声明
		if d.Tok == token.VAR {
			for _, spec := range d.Specs {
				if valueSpec, ok := spec.(*ast.ValueSpec); ok {
					p.analyzeValueSpec(valueSpec, snippet)
				}
			}
		}
	case *ast.FuncDecl:
		// 函数声明 - 分析函数体中的操作
		if d.Body != nil {
			p.analyzeStmtList(d.Body.List, snippet)
		}
	}
}

// analyzeValueSpec 分析变量声明
func (p *GoParser) analyzeValueSpec(spec *ast.ValueSpec, snippet *models.CodeSnippet) {
	for i, name := range spec.Names {
		// 检查类型
		var primitiveType models.SyncPrimitiveType
		var declaration string

		if spec.Type != nil {
			primitiveType, declaration = p.identifyPrimitiveType(spec.Type)
		} else if i < len(spec.Values) {
			// 检查值的类型
			if compositeLit, ok := spec.Values[i].(*ast.CompositeLit); ok {
				primitiveType, declaration = p.identifyPrimitiveType(compositeLit.Type)
			}
		}

		if primitiveType != "" {
			pos := p.fset.Position(spec.Pos())
			snippet.Primitives = append(snippet.Primitives, models.PrimitiveUsage{
				Type:        primitiveType,
				Name:        name.Name,
				Declaration: declaration,
				Location: models.CodeLocation{
					File: pos.Filename,
					Line: pos.Line,
					Col:  pos.Column,
				},
			})
		}
	}
}

// identifyPrimitiveType 识别 sync 原语类型
func (p *GoParser) identifyPrimitiveType(expr ast.Expr) (models.SyncPrimitiveType, string) {
	switch e := expr.(type) {
	case *ast.SelectorExpr:
		if ident, ok := e.X.(*ast.Ident); ok && ident.Name == "sync" {
			declaration := "sync." + e.Sel.Name
			switch e.Sel.Name {
			case "Mutex":
				return models.SyncTypeMutex, declaration
			case "RWMutex":
				return models.SyncTypeRWMutex, declaration
			case "WaitGroup":
				return models.SyncTypeWaitGroup, declaration
			case "Once":
				return models.SyncTypeOnce, declaration
			case "Cond":
				return models.SyncTypeCond, declaration
			case "Pool":
				return models.SyncTypePool, declaration
			}
		}
	case *ast.StarExpr:
		// 指针类型
		return p.identifyPrimitiveType(e.X)
	}

	return "", ""
}

// analyzeStmtList 分析语句列表
func (p *GoParser) analyzeStmtList(stmts []ast.Stmt, snippet *models.CodeSnippet) {
	for _, stmt := range stmts {
		p.analyzeStmt(stmt, snippet)
	}
}

// analyzeStmt 分析单个语句
func (p *GoParser) analyzeStmt(stmt ast.Stmt, snippet *models.CodeSnippet) {
	switch s := stmt.(type) {
	case *ast.ExprStmt:
		// 表达式语句
		p.analyzeExpr(s.X, snippet)
	case *ast.AssignStmt:
		// 赋值语句
		for _, expr := range s.Rhs {
			p.analyzeExpr(expr, snippet)
		}
	case *ast.DeferStmt:
		// defer 语句
		p.analyzeExpr(s.Call, snippet)
	case *ast.GoStmt:
		// go 语句
		p.analyzeExpr(s.Call, snippet)
	case *ast.BlockStmt:
		// 块语句
		p.analyzeStmtList(s.List, snippet)
	case *ast.IfStmt:
		// if 语句
		p.analyzeStmt(s.Body, snippet)
		if s.Else != nil {
			p.analyzeStmt(s.Else, snippet)
		}
	case *ast.ForStmt:
		// for 语句
		p.analyzeStmt(s.Body, snippet)
	case *ast.RangeStmt:
		// range 语句
		p.analyzeStmt(s.Body, snippet)
	case *ast.SelectStmt:
		// select 语句
		p.analyzeStmt(s.Body, snippet)
	case *ast.SwitchStmt:
		// switch 语句
		p.analyzeStmt(s.Body, snippet)
	}
}

// analyzeExpr 分析表达式
func (p *GoParser) analyzeExpr(expr ast.Expr, snippet *models.CodeSnippet) {
	switch e := expr.(type) {
	case *ast.CallExpr:
		// 函数调用
		p.analyzeCallExpr(e, snippet)
	case *ast.SelectorExpr:
		// 选择器表达式
		p.analyzeSelectorExpr(e, snippet)
	}
}

// analyzeCallExpr 分析函数调用表达式
func (p *GoParser) analyzeCallExpr(call *ast.CallExpr, snippet *models.CodeSnippet) {
	// 检查是否是 sync 原语的方法调用
	if sel, ok := call.Fun.(*ast.SelectorExpr); ok {
		// 获取对象名称
		var objName string
		if ident, ok := sel.X.(*ast.Ident); ok {
			objName = ident.Name
		}

		// 识别操作类型
		operation := sel.Sel.Name
		if objName != "" && p.isSyncOperation(operation) {
			pos := p.fset.Position(call.Pos())
			snippet.Operations = append(snippet.Operations, models.OperationUsage{
				PrimitiveName: objName,
				Operation:     operation,
				Location: models.CodeLocation{
					File: pos.Filename,
					Line: pos.Line,
					Col:  pos.Column,
				},
			})
		}
	}

	// 分析参数中的表达式
	for _, arg := range call.Args {
		p.analyzeExpr(arg, snippet)
	}
}

// analyzeSelectorExpr 分析选择器表达式
func (p *GoParser) analyzeSelectorExpr(sel *ast.SelectorExpr, snippet *models.CodeSnippet) {
	// 递归分析 X 部分
	p.analyzeExpr(sel.X, snippet)
}

// isSyncOperation 检查是否是 sync 原语的操作
func (p *GoParser) isSyncOperation(operation string) bool {
	syncOperations := map[string]bool{
		"Lock":    true,
		"Unlock":  true,
		"RLock":   true,
		"RUnlock": true,
		"Add":     true,
		"Done":    true,
		"Wait":    true,
		"Do":      true,
		"Signal":  true,
		"Broadcast": true,
		"Get":     true,
		"Put":     true,
	}
	return syncOperations[operation]
}
