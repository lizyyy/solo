package hclparser

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/hclparse"
	"github.com/hashicorp/hcl/v2/hclsyntax"
	"github.com/zclconf/go-cty/cty"
	"tfvars-trace/pkg/types"
)

type Parser struct {
	parser *hclparse.Parser
	diags  hcl.Diagnostics
}

func NewParser() *Parser {
	return &Parser{
		parser: hclparse.NewParser(),
	}
}

func (p *Parser) ParseVariablesFromFile(filePath string) (map[string]*types.VariableDefinition, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file %s: %w", filePath, err)
	}

	return p.ParseVariablesContent(string(content), filePath)
}

func (p *Parser) ParseVariablesContent(content, filename string) (map[string]*types.VariableDefinition, error) {
	file, diags := p.parser.ParseHCL([]byte(content), filename)
	if diags.HasErrors() {
		return nil, fmt.Errorf("parse errors: %v", diags.Error())
	}

	body := file.Body.(*hclsyntax.Body)
	variables := make(map[string]*types.VariableDefinition)

	for _, block := range body.Blocks {
		if block.Type == "variable" && len(block.Labels) > 0 {
			varName := block.Labels[0]
			variable := p.parseVariableBlock(varName, block, filename)
			variables[varName] = variable
		}
	}

	return variables, nil
}

func (p *Parser) parseVariableBlock(name string, block *hclsyntax.Block, filename string) *types.VariableDefinition {
	variable := &types.VariableDefinition{
		Name:       name,
		SourceFile: filename,
		LineNumber: block.DefRange().Start.Line,
		Type:       types.TypeUnknown,
		Nullable:   true,
	}

	body := block.Body
	for _, attr := range body.Attributes {
		switch attr.Name {
		case "type":
			variable.Type = p.parseType(attr.Expr)
		case "default":
			val, _ := p.evaluateExpr(attr.Expr)
			variable.Default = ctyValueToInterface(val)
		case "description":
			val, _ := p.evaluateExpr(attr.Expr)
			if val.Type() == cty.String {
				variable.Description = val.AsString()
			}
		case "sensitive":
			val, _ := p.evaluateExpr(attr.Expr)
			if val.Type() == cty.Bool {
				variable.Sensitive = val.True()
			}
		case "nullable":
			val, _ := p.evaluateExpr(attr.Expr)
			if val.Type() == cty.Bool {
				variable.Nullable = val.True()
			}
		}
	}

	return variable
}

func (p *Parser) parseType(expr hclsyntax.Expression) types.VariableType {
	switch e := expr.(type) {
	case *hclsyntax.ScopeTraversalExpr:
		if len(e.Traversal) > 0 {
			if attr, ok := e.Traversal[0].(hcl.TraverseRoot); ok {
				switch attr.Name {
				case "string":
					return types.TypeString
				case "number":
					return types.TypeNumber
				case "bool":
					return types.TypeBool
				}
			}
		}
	case *hclsyntax.FunctionCallExpr:
		switch e.Name {
		case "list":
			return types.TypeList
		case "map":
			return types.TypeMap
		case "set":
			return types.TypeSet
		case "object":
			return types.TypeObject
		case "tuple":
			return types.TypeTuple
		}
	}
	return types.TypeUnknown
}

func (p *Parser) evaluateExpr(expr hclsyntax.Expression) (cty.Value, hcl.Diagnostics) {
	return expr.Value(&hcl.EvalContext{})
}

func (p *Parser) ParseTFVarsFile(filePath string) (map[string]interface{}, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read tfvars file %s: %w", filePath, err)
	}

	return p.ParseTFVarsContent(string(content), filePath)
}

func (p *Parser) ParseTFVarsContent(content, filename string) (map[string]interface{}, error) {
	file, diags := p.parser.ParseHCL([]byte(content), filename)
	if diags.HasErrors() {
		return nil, fmt.Errorf("parse errors in tfvars: %v", diags.Error())
	}

	body := file.Body.(*hclsyntax.Body)
	values := make(map[string]interface{})

	for _, attr := range body.Attributes {
		val, _ := p.evaluateExpr(attr.Expr)
		values[attr.Name] = ctyValueToInterface(val)
	}

	return values, nil
}

func (p *Parser) ParseModuleBlocks(filePath string) (map[string]*types.Module, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file %s: %w", filePath, err)
	}

	file, diags := p.parser.ParseHCL(content, filePath)
	if diags.HasErrors() {
		return nil, fmt.Errorf("parse errors: %v", diags.Error())
	}

	body := file.Body.(*hclsyntax.Body)
	modules := make(map[string]*types.Module)

	for _, block := range body.Blocks {
		if block.Type == "module" && len(block.Labels) > 0 {
			moduleName := block.Labels[0]
			module := p.parseModuleBlock(moduleName, block, filePath)
			modules[moduleName] = module
		}
	}

	return modules, nil
}

func (p *Parser) parseModuleBlock(name string, block *hclsyntax.Block, filename string) *types.Module {
	module := &types.Module{
		Name:           name,
		SourceFile:     filename,
		Variables:      make(map[string]*types.ResolvedVariable),
		SubModules:     make(map[string]*types.Module),
		VariableInputs: make(map[string]interface{}),
	}

	body := block.Body
	for _, attr := range body.Attributes {
		if attr.Name == "source" {
			val, _ := p.evaluateExpr(attr.Expr)
			if val.Type() == cty.String {
				module.Source = val.AsString()
			}
		} else {
			val, _ := p.evaluateExpr(attr.Expr)
			module.VariableInputs[attr.Name] = ctyValueToInterface(val)
		}
	}

	return module
}

func ctyValueToInterface(val cty.Value) interface{} {
	if val.IsNull() {
		return nil
	}

	switch val.Type() {
	case cty.String:
		return val.AsString()
	case cty.Number:
		num := val.AsBigFloat()
		if num.IsInt() {
			i, _ := num.Int64()
			return i
		}
		f, _ := num.Float64()
		return f
	case cty.Bool:
		return val.True()
	}

	if val.Type().IsListType() || val.Type().IsTupleType() || val.Type().IsSetType() {
		var result []interface{}
		for it := val.ElementIterator(); it.Next(); {
			_, v := it.Element()
			result = append(result, ctyValueToInterface(v))
		}
		return result
	}

	if val.Type().IsMapType() || val.Type().IsObjectType() {
		result := make(map[string]interface{})
		for it := val.ElementIterator(); it.Next(); {
			k, v := it.Element()
			result[k.AsString()] = ctyValueToInterface(v)
		}
		return result
	}

	return val.GoString()
}

func FindTFVarsFiles(dir string) ([]string, error) {
	var files []string

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".tfvars") ||
			strings.HasSuffix(name, ".tfvars.json") ||
			name == "terraform.tfvars" ||
			name == "terraform.tfvars.json" {
			files = append(files, filepath.Join(dir, name))
		}
	}

	return files, nil
}

func FindTFiles(dir string) ([]string, error) {
	var files []string

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".tf") {
			files = append(files, filepath.Join(dir, name))
		}
	}

	return files, nil
}
