package tracer

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"tfvars-trace/pkg/hclparser"
	"tfvars-trace/pkg/types"
)

const (
	PriorityDefault     = 0
	PriorityModuleInput = 5
	PriorityTFVars      = 10
	PriorityEnvVar      = 15
	PriorityCLI         = 20
)

type Tracer struct {
	parser        *hclparser.Parser
	moduleCache   map[string]*types.Module
	envVarPrefix  string
}

func NewTracer() *Tracer {
	return &Tracer{
		parser:       hclparser.NewParser(),
		moduleCache:  make(map[string]*types.Module),
		envVarPrefix: "TF_VAR_",
	}
}

func (t *Tracer) AnalyzeDirectory(dir string) (*types.AnalysisResult, error) {
	result := &types.AnalysisResult{
		AllVariables:    make(map[string]*types.ResolvedVariable),
		EnvironmentVars: make(map[string]string),
		Conflicts:       []types.Conflict{},
		TFVarsFiles:     []string{},
	}

	tfFiles, err := hclparser.FindTFiles(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to find .tf files: %w", err)
	}

	if len(tfFiles) == 0 {
		return nil, fmt.Errorf("no .tf files found in directory: %s", dir)
	}

	allVarDefs := make(map[string]*types.VariableDefinition)
	for _, tfFile := range tfFiles {
		vars, err := t.parser.ParseVariablesFromFile(tfFile)
		if err != nil {
			return nil, fmt.Errorf("failed to parse variables from %s: %w", tfFile, err)
		}
		for name, v := range vars {
			if existing, ok := allVarDefs[name]; ok {
				result.Conflicts = append(result.Conflicts, types.Conflict{
					Type:        "variable_redefinition",
					Description: fmt.Sprintf("Variable '%s' is defined in multiple files", name),
					Sources:     []string{existing.SourceFile, tfFile},
					Severity:    "warning",
				})
			}
			allVarDefs[name] = v
		}
	}

	tfvarsFiles, err := hclparser.FindTFVarsFiles(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to find tfvars files: %w", err)
	}
	result.TFVarsFiles = tfvarsFiles

	allTFVarsValues := make(map[string]map[string]interface{})
	for _, tfvarsFile := range tfvarsFiles {
		values, err := t.parser.ParseTFVarsFile(tfvarsFile)
		if err != nil {
			return nil, fmt.Errorf("failed to parse tfvars file %s: %w", tfvarsFile, err)
		}
		allTFVarsValues[tfvarsFile] = values
	}

	t.collectEnvVars(result)

	rootModule := &types.Module{
		Name:       "root",
		Path:       dir,
		Variables:  make(map[string]*types.ResolvedVariable),
		SubModules: make(map[string]*types.Module),
		SourceFile: dir,
	}

	for varName, varDef := range allVarDefs {
		resolved := t.resolveVariable(varName, varDef, allTFVarsValues, result.EnvironmentVars, nil, "root")
		rootModule.Variables[varName] = resolved
		result.AllVariables[varName] = resolved

		if len(resolved.Conflicts) > 0 {
			result.Conflicts = append(result.Conflicts, resolved.Conflicts...)
		}
	}

	t.parseSubModules(dir, rootModule, result)

	result.RootModule = rootModule
	t.calculateSummary(result)

	return result, nil
}

func (t *Tracer) resolveVariable(
	varName string,
	varDef *types.VariableDefinition,
	tfvarsValues map[string]map[string]interface{},
	envVars map[string]string,
	moduleInputs map[string]interface{},
	modulePath string,
) *types.ResolvedVariable {
	resolved := &types.ResolvedVariable{
		Name:         varName,
		Type:         varDef.Type,
		Sensitive:    varDef.Sensitive,
		ModulePath:   modulePath,
		ValueSources: []types.VariableValue{},
		Conflicts:    []types.Conflict{},
	}

	if varDef.Default != nil {
		resolved.ValueSources = append(resolved.ValueSources, types.VariableValue{
			Value:      varDef.Default,
			Source:     types.SourceDefault,
			SourceFile: varDef.SourceFile,
			Priority:   PriorityDefault,
		})
	}

	if moduleInputs != nil {
		if val, ok := moduleInputs[varName]; ok {
			resolved.ValueSources = append(resolved.ValueSources, types.VariableValue{
				Value:      val,
				Source:     types.SourceModuleInput,
				SourceType: "module",
				Priority:   PriorityModuleInput,
			})
		}
	}

	for tfvarsFile, values := range tfvarsValues {
		if val, ok := values[varName]; ok {
			resolved.ValueSources = append(resolved.ValueSources, types.VariableValue{
				Value:      val,
				Source:     types.SourceTFVars,
				SourceFile: tfvarsFile,
				Priority:   PriorityTFVars,
			})
		}
	}

	envVarName := t.envVarPrefix + varName
	if val, ok := envVars[envVarName]; ok {
		resolved.ValueSources = append(resolved.ValueSources, types.VariableValue{
			Value:      val,
			Source:     types.SourceEnvVar,
			SourceType: envVarName,
			Priority:   PriorityEnvVar,
		})
	}

	sort.Slice(resolved.ValueSources, func(i, j int) bool {
		return resolved.ValueSources[i].Priority > resolved.ValueSources[j].Priority
	})

	if len(resolved.ValueSources) > 0 {
		active := resolved.ValueSources[0]
		resolved.EffectiveValue = active.Value
		resolved.ActiveSource = active.Source
		resolved.ActiveSourceFile = active.SourceFile

		if resolved.Sensitive {
			resolved.MaskedValue = t.maskValue(resolved.EffectiveValue)
		}

		t.detectConflicts(resolved)
	}

	return resolved
}

func (t *Tracer) detectConflicts(resolved *types.ResolvedVariable) {
	if len(resolved.ValueSources) <= 1 {
		return
	}

	var differentSources []types.VariableValue
	primaryValue := fmt.Sprintf("%v", resolved.EffectiveValue)

	for _, source := range resolved.ValueSources[1:] {
		sourceValue := fmt.Sprintf("%v", source.Value)
		if sourceValue != primaryValue {
			differentSources = append(differentSources, source)
		}
	}

	if len(differentSources) > 0 {
		var sourceDescs []string
		for _, s := range resolved.ValueSources {
			desc := fmt.Sprintf("%s (value: %v)", s.Source, s.Value)
			sourceDescs = append(sourceDescs, desc)
		}

		resolved.Conflicts = append(resolved.Conflicts, types.Conflict{
			Type:        "value_override",
			Description: fmt.Sprintf("Variable '%s' has multiple values, '%s' takes precedence",
				resolved.Name, resolved.ActiveSource),
			Sources:  sourceDescs,
			Severity: "info",
		})
	}

	tfvarsSources := make(map[string][]string)
	for _, s := range resolved.ValueSources {
		if s.Source == types.SourceTFVars && s.SourceFile != "" {
			tfvarsSources[s.SourceFile] = append(tfvarsSources[s.SourceFile], fmt.Sprintf("%v", s.Value))
		}
	}

	if len(tfvarsSources) > 1 {
		var files []string
		for f := range tfvarsSources {
			files = append(files, f)
		}
		resolved.Conflicts = append(resolved.Conflicts, types.Conflict{
			Type:        "multiple_tfvars",
			Description: fmt.Sprintf("Variable '%s' is set in multiple tfvars files", resolved.Name),
			Sources:     files,
			Severity:    "warning",
		})
	}
}

func (t *Tracer) collectEnvVars(result *types.AnalysisResult) {
	for _, env := range os.Environ() {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := parts[0]
		value := parts[1]
		if strings.HasPrefix(key, t.envVarPrefix) {
			result.EnvironmentVars[key] = value
		}
	}
}

func (t *Tracer) parseSubModules(dir string, parentModule *types.Module, result *types.AnalysisResult) error {
	tfFiles, err := hclparser.FindTFiles(dir)
	if err != nil {
		return err
	}

	for _, tfFile := range tfFiles {
		modules, err := t.parser.ParseModuleBlocks(tfFile)
		if err != nil {
			continue
		}

		for moduleName, module := range modules {
			modulePath := module.Source
			if strings.HasPrefix(modulePath, "./") || strings.HasPrefix(modulePath, "../") {
				modulePath = filepath.Join(dir, modulePath)
			}

			if cached, ok := t.moduleCache[modulePath]; ok {
				parentModule.SubModules[moduleName] = cached
				continue
			}

			resolvedModule := &types.Module{
				Name:           moduleName,
				Source:         module.Source,
				Path:           modulePath,
				Variables:      make(map[string]*types.ResolvedVariable),
				SubModules:     make(map[string]*types.Module),
				VariableInputs: module.VariableInputs,
				SourceFile:     tfFile,
			}

			if strings.HasPrefix(module.Source, "./") || strings.HasPrefix(module.Source, "../") {
				if err := t.analyzeModule(resolvedModule, result); err != nil {
					continue
				}
			}

			parentModule.SubModules[moduleName] = resolvedModule
			t.moduleCache[modulePath] = resolvedModule
		}
	}

	return nil
}

func (t *Tracer) analyzeModule(module *types.Module, result *types.AnalysisResult) error {
	tfFiles, err := hclparser.FindTFiles(module.Path)
	if err != nil {
		return err
	}

	allVarDefs := make(map[string]*types.VariableDefinition)
	for _, tfFile := range tfFiles {
		vars, err := t.parser.ParseVariablesFromFile(tfFile)
		if err != nil {
			continue
		}
		for name, v := range vars {
			allVarDefs[name] = v
		}
	}

	tfvarsValues := make(map[string]map[string]interface{})
	tfvarsFiles, _ := hclparser.FindTFVarsFiles(module.Path)
	for _, tfvarsFile := range tfvarsFiles {
		values, err := t.parser.ParseTFVarsFile(tfvarsFile)
		if err == nil {
			tfvarsValues[tfvarsFile] = values
		}
	}

	moduleEnvVars := make(map[string]string)
	for k, v := range result.EnvironmentVars {
		moduleEnvVars[k] = v
	}

	modulePrefix := module.Name + "."
	for varName, varDef := range allVarDefs {
		resolved := t.resolveVariable(
			varName,
			varDef,
			tfvarsValues,
			moduleEnvVars,
			module.VariableInputs,
			modulePrefix+varName,
		)
		module.Variables[varName] = resolved

		fullName := modulePrefix + varName
		result.AllVariables[fullName] = resolved

		if len(resolved.Conflicts) > 0 {
			result.Conflicts = append(result.Conflicts, resolved.Conflicts...)
		}
	}

	t.parseSubModules(module.Path, module, result)

	return nil
}

func (t *Tracer) maskValue(value interface{}) string {
	if value == nil {
		return "(sensitive)"
	}
	str := fmt.Sprintf("%v", value)
	if len(str) <= 2 {
		return "***"
	}
	return string(str[0]) + "***" + string(str[len(str)-1])
}

func (t *Tracer) calculateSummary(result *types.AnalysisResult) {
	summary := types.Summary{
		TotalVariables: len(result.AllVariables),
		Conflicts:      len(result.Conflicts),
	}

	for _, v := range result.AllVariables {
		if v.Sensitive {
			summary.SensitiveVariables++
		}

		switch v.ActiveSource {
		case types.SourceDefault:
			summary.DefaultValues++
		case types.SourceTFVars:
			summary.TFVarsValues++
		case types.SourceEnvVar:
			summary.EnvVarValues++
		case types.SourceModuleInput:
			summary.ModuleInputValues++
		}
	}

	summary.ModulesCount = t.countModules(result.RootModule)
	result.Summary = summary
	result.TotalVariables = summary.TotalVariables
	result.SensitiveCount = summary.SensitiveVariables
}

func (t *Tracer) countModules(module *types.Module) int {
	count := 1
	for _, sub := range module.SubModules {
		count += t.countModules(sub)
	}
	return count
}
