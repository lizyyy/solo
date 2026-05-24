package reporter

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"tfvars-trace/pkg/types"
)

type Reporter struct {
	config types.OutputConfig
}

func NewReporter(config types.OutputConfig) *Reporter {
	return &Reporter{
		config: config,
	}
}

func (r *Reporter) Generate(result *types.AnalysisResult) error {
	if r.config.FormatConsole {
		r.printConsoleSummary(result)
	}

	if r.config.OutputDir != "" {
		if err := os.MkdirAll(r.config.OutputDir, 0755); err != nil {
			return fmt.Errorf("failed to create output directory: %w", err)
		}
	}

	if r.config.FormatJSON {
		if err := r.writeJSONReport(result); err != nil {
			return err
		}
	}

	if r.config.FormatMarkdown {
		if err := r.writeMarkdownReport(result); err != nil {
			return err
		}
	}

	return nil
}

func (r *Reporter) printConsoleSummary(result *types.AnalysisResult) {
	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════════════╗")
	fmt.Println("║           TERRAFORM 变量溯源报告 - 控制台摘要                  ║")
	fmt.Println("╚══════════════════════════════════════════════════════════════╝")
	fmt.Println()

	fmt.Printf("📊 总览统计:\n")
	fmt.Printf("  • 变量总数: %d\n", result.Summary.TotalVariables)
	fmt.Printf("  • 敏感变量: %d\n", result.Summary.SensitiveVariables)
	fmt.Printf("  • 模块数量: %d\n", result.Summary.ModulesCount)
	fmt.Printf("  • 冲突数量: %d\n", result.Summary.Conflicts)
	fmt.Println()

	fmt.Printf("📈 变量来源分布:\n")
	fmt.Printf("  • 默认值:     %d 个\n", result.Summary.DefaultValues)
	fmt.Printf("  • tfvars:     %d 个\n", result.Summary.TFVarsValues)
	fmt.Printf("  • 环境变量:   %d 个\n", result.Summary.EnvVarValues)
	fmt.Printf("  • 模块输入:   %d 个\n", result.Summary.ModuleInputValues)
	fmt.Println()

	if len(result.TFVarsFiles) > 0 {
		fmt.Printf("📁 检测到的 tfvars 文件:\n")
		for _, f := range result.TFVarsFiles {
			fmt.Printf("  • %s\n", f)
		}
		fmt.Println()
	}

	fmt.Println("🔍 变量详情:")
	fmt.Println(strings.Repeat("─", 80))
	fmt.Printf("%-25s %-12s %-15s %s\n", "变量名", "类型", "来源", "有效值")
	fmt.Println(strings.Repeat("─", 80))

	varNames := make([]string, 0, len(result.AllVariables))
	for k := range result.AllVariables {
		varNames = append(varNames, k)
	}
	sort.Strings(varNames)

	for _, name := range varNames {
		v := result.AllVariables[name]
		displayValue := r.formatValueForConsole(v)
		fmt.Printf("%-25s %-12s %-15s %s\n",
			truncate(name, 25),
			truncate(string(v.Type), 12),
			truncate(string(v.ActiveSource), 15),
			displayValue,
		)
	}
	fmt.Println()

	if len(result.Conflicts) > 0 {
		fmt.Println("⚠️  检测到的冲突/警告:")
		fmt.Println(strings.Repeat("─", 80))
		for i, c := range result.Conflicts {
			fmt.Printf("%d. [%s] %s\n", i+1, strings.ToUpper(c.Severity), c.Description)
			if len(c.Sources) > 0 {
				fmt.Printf("   来源: %s\n", strings.Join(c.Sources, ", "))
			}
		}
		fmt.Println()
	}

	fmt.Println("💡 优先级说明: 环境变量(15) > tfvars(10) > 模块输入(5) > 默认值(0)")
	fmt.Println()
}

func (r *Reporter) formatValueForConsole(v *types.ResolvedVariable) string {
	if v.Sensitive && r.config.MaskSensitive {
		return v.MaskedValue
	}
	if v.EffectiveValue == nil {
		return "(nil)"
	}
	str := fmt.Sprintf("%v", v.EffectiveValue)
	if len(str) > 25 {
		return str[:22] + "..."
	}
	return str
}

func (r *Reporter) writeJSONReport(result *types.AnalysisResult) error {
	filename := filepath.Join(r.config.OutputDir, "variables-report.json")

	type JSONOutput struct {
		GeneratedAt time.Time              `json:"generated_at"`
		Version     string                 `json:"version"`
		Summary     types.Summary          `json:"summary"`
		Variables   map[string]interface{} `json:"variables"`
		Conflicts   []types.Conflict       `json:"conflicts"`
		TFVarsFiles []string               `json:"tfvars_files"`
		Environment map[string]string      `json:"environment_variables"`
	}

	variables := make(map[string]interface{})
	for name, v := range result.AllVariables {
		safeValueSources := make([]interface{}, len(v.ValueSources))
		for i, vs := range v.ValueSources {
			safeValueSources[i] = map[string]interface{}{
				"value":       vs.GetDisplayValue(r.config.MaskSensitive),
				"source":      vs.Source,
				"source_file": vs.SourceFile,
				"source_type": vs.SourceType,
				"priority":    vs.Priority,
			}
		}

		varData := map[string]interface{}{
			"name":               v.Name,
			"type":               v.Type,
			"sensitive":          v.Sensitive,
			"effective_value":    r.getDisplayValue(v),
			"active_source":      v.ActiveSource,
			"active_source_file": v.ActiveSourceFile,
			"module_path":        v.ModulePath,
			"conflicts":          v.Conflicts,
			"value_sources":      safeValueSources,
		}
		variables[name] = varData
	}

	safeEnvVars := make(map[string]string)
	for k, v := range result.EnvironmentVars {
		if r.config.MaskSensitive {
			varName := strings.TrimPrefix(k, "TF_VAR_")
			if variable, ok := result.AllVariables[varName]; ok && variable.Sensitive {
				safeEnvVars[k] = r.maskValueStr(v)
				continue
			}
		}
		safeEnvVars[k] = v
	}

	output := JSONOutput{
		GeneratedAt: time.Now(),
		Version:     "1.0.0",
		Summary:     result.Summary,
		Variables:   variables,
		Conflicts:   result.Conflicts,
		TFVarsFiles: result.TFVarsFiles,
		Environment: safeEnvVars,
	}

	data, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write JSON report: %w", err)
	}

	fmt.Printf("✅ JSON 报告已生成: %s\n", filename)
	return nil
}

func (r *Reporter) maskValueStr(value string) string {
	if len(value) <= 2 {
		return "***"
	}
	return string(value[0]) + "***" + string(value[len(value)-1])
}

func (r *Reporter) getDisplayValue(v *types.ResolvedVariable) interface{} {
	if v.Sensitive && r.config.MaskSensitive {
		return v.MaskedValue
	}
	return v.EffectiveValue
}

func (r *Reporter) writeMarkdownReport(result *types.AnalysisResult) error {
	filename := filepath.Join(r.config.OutputDir, "variables-report.md")

	var sb strings.Builder

	sb.WriteString("# Terraform 变量溯源报告\n\n")
	sb.WriteString(fmt.Sprintf("**生成时间**: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))
	sb.WriteString("---\n\n")

	sb.WriteString("## 📊 总览统计\n\n")
	sb.WriteString("| 指标 | 数值 |\n")
	sb.WriteString("|------|------|\n")
	sb.WriteString(fmt.Sprintf("| 变量总数 | %d |\n", result.Summary.TotalVariables))
	sb.WriteString(fmt.Sprintf("| 敏感变量 | %d |\n", result.Summary.SensitiveVariables))
	sb.WriteString(fmt.Sprintf("| 模块数量 | %d |\n", result.Summary.ModulesCount))
	sb.WriteString(fmt.Sprintf("| 冲突数量 | %d |\n", result.Summary.Conflicts))
	sb.WriteString("\n")

	sb.WriteString("## 📈 变量来源分布\n\n")
	sb.WriteString("| 来源 | 数量 | 优先级 |\n")
	sb.WriteString("|------|------|--------|\n")
	sb.WriteString(fmt.Sprintf("| 默认值 | %d | 0 (最低) |\n", result.Summary.DefaultValues))
	sb.WriteString(fmt.Sprintf("| 模块输入 | %d | 5 |\n", result.Summary.ModuleInputValues))
	sb.WriteString(fmt.Sprintf("| tfvars | %d | 10 |\n", result.Summary.TFVarsValues))
	sb.WriteString(fmt.Sprintf("| 环境变量 | %d | 15 (最高) |\n", result.Summary.EnvVarValues))
	sb.WriteString("\n")

	if len(result.TFVarsFiles) > 0 {
		sb.WriteString("## 📁 检测到的 tfvars 文件\n\n")
		for _, f := range result.TFVarsFiles {
			sb.WriteString(fmt.Sprintf("- `%s`\n", f))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("## 🔍 变量详情\n\n")
	sb.WriteString("| 变量名 | 类型 | 敏感 | 生效来源 | 有效值 | 来源文件 |\n")
	sb.WriteString("|--------|------|------|----------|--------|----------|\n")

	varNames := make([]string, 0, len(result.AllVariables))
	for k := range result.AllVariables {
		varNames = append(varNames, k)
	}
	sort.Strings(varNames)

	for _, name := range varNames {
		v := result.AllVariables[name]
		displayValue := r.formatValueForMarkdown(v)
		sensitiveFlag := "❌"
		if v.Sensitive {
			sensitiveFlag = "✅"
		}
		sourceFile := "-"
		if v.ActiveSourceFile != "" {
			sourceFile = fmt.Sprintf("`%s`", v.ActiveSourceFile)
		}
		sb.WriteString(fmt.Sprintf("| `%s` | `%s` | %s | `%s` | %s | %s |\n",
			name, v.Type, sensitiveFlag, v.ActiveSource, displayValue, sourceFile))
	}
	sb.WriteString("\n")

	sb.WriteString("## 📋 变量溯源详情\n\n")
	sb.WriteString("本节详细解释每个变量的所有可能来源及其优先级。\n\n")

	for _, name := range varNames {
		v := result.AllVariables[name]

		sb.WriteString(fmt.Sprintf("### %s\n\n", name))
		sb.WriteString(fmt.Sprintf("- **类型**: `%s`\n", v.Type))
		sb.WriteString(fmt.Sprintf("- **敏感变量**: %t\n", v.Sensitive))
		sb.WriteString(fmt.Sprintf("- **当前生效值**: %s\n", r.formatValueForMarkdown(v)))
		sb.WriteString(fmt.Sprintf("- **生效来源**: `%s`\n", v.ActiveSource))
		sb.WriteString("\n")

		if len(v.ValueSources) > 0 {
			sb.WriteString("#### 所有值来源（按优先级排序）\n\n")
			sb.WriteString("| 优先级 | 来源类型 | 值 | 来源文件 |\n")
			sb.WriteString("|--------|----------|----|----------|\n")
			for _, vs := range v.ValueSources {
				val := vs.GetDisplayValue(r.config.MaskSensitive)
				sourceFile := "-"
				if vs.SourceFile != "" {
					sourceFile = fmt.Sprintf("`%s`", vs.SourceFile)
				}
				sb.WriteString(fmt.Sprintf("| %d | `%s` | `%v` | %s |\n",
					vs.Priority, vs.Source, val, sourceFile))
			}
			sb.WriteString("\n")
		}

		if len(v.Conflicts) > 0 {
			sb.WriteString("#### ⚠️ 检测到的问题\n\n")
			for _, c := range v.Conflicts {
				sb.WriteString(fmt.Sprintf("- **[%s]** %s\n", strings.ToUpper(c.Severity), c.Description))
				if len(c.Sources) > 0 {
					sb.WriteString(fmt.Sprintf("  - 涉及来源: %s\n", strings.Join(c.Sources, ", ")))
				}
			}
			sb.WriteString("\n")
		}
	}

	if len(result.Conflicts) > 0 {
		sb.WriteString("## ⚠️ 全局冲突与警告\n\n")
		for i, c := range result.Conflicts {
			sb.WriteString(fmt.Sprintf("### %d. [%s] %s\n\n", i+1, strings.ToUpper(c.Severity), c.Description))
			if len(c.Sources) > 0 {
				sb.WriteString("**涉及来源:**\n")
				for _, s := range c.Sources {
					sb.WriteString(fmt.Sprintf("- `%s`\n", s))
				}
			}
			sb.WriteString("\n")
		}
	}

	sb.WriteString("## 📖 优先级规则说明\n\n")
	sb.WriteString("Terraform 变量值的优先级从高到低依次为：\n\n")
	sb.WriteString("1. **环境变量** (`TF_VAR_*`) - 优先级 15\n")
	sb.WriteString("2. **tfvars 文件** - 优先级 10\n")
	sb.WriteString("3. **模块输入变量** - 优先级 5\n")
	sb.WriteString("4. **默认值**（变量定义中的 default）- 优先级 0\n\n")
	sb.WriteString("当多个来源为同一个变量提供值时，优先级最高的值将生效。\n\n")

	sb.WriteString("---\n\n")
	sb.WriteString("*报告由 tfvars-trace 自动生成*\n")

	if err := os.WriteFile(filename, []byte(sb.String()), 0644); err != nil {
		return fmt.Errorf("failed to write Markdown report: %w", err)
	}

	fmt.Printf("✅ Markdown 报告已生成: %s\n", filename)
	return nil
}

func (r *Reporter) formatValueForMarkdown(v *types.ResolvedVariable) string {
	if v.Sensitive && r.config.MaskSensitive {
		return fmt.Sprintf("`%s` (已遮蔽)", v.MaskedValue)
	}
	if v.EffectiveValue == nil {
		return "`null`"
	}
	str := fmt.Sprintf("%v", v.EffectiveValue)
	if len(str) > 50 {
		str = str[:47] + "..."
	}
	return fmt.Sprintf("`%s`", str)
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
