package reporter

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"text/tabwriter"
	"time"

	"proto-scanner/pkg/parser"
)

type ScanSummary struct {
	TotalFiles      int            `json:"total_files"`
	TotalMessages   int            `json:"total_messages"`
	TotalFields     int            `json:"total_fields"`
	HighRiskFields  int            `json:"high_risk_fields"`
	MediumRiskFields int           `json:"medium_risk_fields"`
	LowRiskFields   int            `json:"low_risk_fields"`
	ParseErrors     int            `json:"parse_errors"`
	ScanTime        string         `json:"scan_time"`
}

type FullReport struct {
	Summary    ScanSummary          `json:"summary"`
	ProtoFiles []*parser.ProtoFile  `json:"proto_files"`
	RiskFields []RiskField          `json:"risk_fields"`
}

type RiskField struct {
	FilePath     string      `json:"file_path"`
	MessageName  string      `json:"message_name"`
	FieldName    string      `json:"field_name"`
	Line         int         `json:"line"`
	FieldType    string      `json:"field_type"`
	DefaultValue interface{} `json:"default_value"`
	RiskLevel    string      `json:"risk_level"`
	RiskReason   string      `json:"risk_reason"`
}

type Reporter struct {
	protoFiles []*parser.ProtoFile
	outputDir  string
}

func NewReporter(protoFiles []*parser.ProtoFile, outputDir string) *Reporter {
	return &Reporter{
		protoFiles: protoFiles,
		outputDir:  outputDir,
	}
}

func (r *Reporter) GenerateAll() error {
	if r.outputDir != "" {
		if err := os.MkdirAll(r.outputDir, 0755); err != nil {
			return fmt.Errorf("failed to create output directory: %w", err)
		}
	}

	if err := r.PrintTerminalSummary(); err != nil {
		return err
	}

	if err := r.GenerateJSONReport(); err != nil {
		return err
	}

	if err := r.GenerateMarkdownReport(); err != nil {
		return err
	}

	return nil
}

func (r *Reporter) collectRiskFields() []RiskField {
	var riskFields []RiskField

	for _, pf := range r.protoFiles {
		for _, msg := range pf.Messages {
			for _, field := range msg.Fields {
				if field.RiskLevel == string(parser.RiskHigh) || field.RiskLevel == string(parser.RiskMedium) {
					riskFields = append(riskFields, RiskField{
						FilePath:     pf.FilePath,
						MessageName:  msg.Name,
						FieldName:    field.Name,
						Line:         field.Line,
						FieldType:    field.Type,
						DefaultValue: field.DefaultValue,
						RiskLevel:    field.RiskLevel,
						RiskReason:   field.RiskReason,
					})
				}
			}
		}
	}

	sort.Slice(riskFields, func(i, j int) bool {
		levelOrder := map[string]int{"HIGH": 0, "MEDIUM": 1, "LOW": 2}
		if levelOrder[riskFields[i].RiskLevel] != levelOrder[riskFields[j].RiskLevel] {
			return levelOrder[riskFields[i].RiskLevel] < levelOrder[riskFields[j].RiskLevel]
		}
		return riskFields[i].FilePath < riskFields[j].FilePath
	})

	return riskFields
}

func (r *Reporter) buildSummary() ScanSummary {
	var totalMessages, totalFields, highRisk, mediumRisk, lowRisk, parseErrors int

	for _, pf := range r.protoFiles {
		totalMessages += len(pf.Messages)
		parseErrors += len(pf.Errors)
		for _, msg := range pf.Messages {
			totalFields += len(msg.Fields)
			for _, field := range msg.Fields {
				switch field.RiskLevel {
				case string(parser.RiskHigh):
					highRisk++
				case string(parser.RiskMedium):
					mediumRisk++
				case string(parser.RiskLow):
					lowRisk++
				}
			}
		}
	}

	return ScanSummary{
		TotalFiles:        len(r.protoFiles),
		TotalMessages:     totalMessages,
		TotalFields:       totalFields,
		HighRiskFields:    highRisk,
		MediumRiskFields:  mediumRisk,
		LowRiskFields:     lowRisk,
		ParseErrors:       parseErrors,
		ScanTime:          time.Now().Format(time.RFC3339),
	}
}

func (r *Reporter) PrintTerminalSummary() error {
	fmt.Println("\n" + strings.Repeat("=", 80))
	fmt.Println("                    PROTO 默认值风险扫描报告")
	fmt.Println(strings.Repeat("=", 80))

	summary := r.buildSummary()

	fmt.Printf("\n扫描时间: %s\n", summary.ScanTime)
	fmt.Printf("扫描文件: %d 个\n", summary.TotalFiles)

	fmt.Println("\n" + strings.Repeat("-", 80))
	fmt.Println("风险统计:")
	fmt.Println(strings.Repeat("-", 80))

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintf(w, "  高风险字段 (HIGH)\t%d\t🔴\n", summary.HighRiskFields)
	fmt.Fprintf(w, "  中风险字段 (MEDIUM)\t%d\t🟡\n", summary.MediumRiskFields)
	fmt.Fprintf(w, "  低风险字段 (LOW)\t%d\t🟢\n", summary.LowRiskFields)
	fmt.Fprintf(w, "  解析错误\t\t%d\t⚠️\n", summary.ParseErrors)
	w.Flush()

	riskFields := r.collectRiskFields()
	if len(riskFields) > 0 {
		fmt.Println("\n" + strings.Repeat("-", 80))
		fmt.Println("重点风险字段 (前10个):")
		fmt.Println(strings.Repeat("-", 80))

		displayCount := 10
		if len(riskFields) < 10 {
			displayCount = len(riskFields)
		}

		for i := 0; i < displayCount; i++ {
			rf := riskFields[i]
			riskIcon := "🔴"
			if rf.RiskLevel == "MEDIUM" {
				riskIcon = "🟡"
			}
			relPath := filepath.Base(rf.FilePath)
			fmt.Printf("  %s %s.%s [%s] @ %s:L%d\n",
				riskIcon, rf.MessageName, rf.FieldName, rf.FieldType, relPath, rf.Line)
		}

		if len(riskFields) > 10 {
			fmt.Printf("  ... 还有 %d 个风险字段，请查看完整报告\n", len(riskFields)-10)
		}
	}

	fmt.Println("\n" + strings.Repeat("=", 80))
	fmt.Println("完整报告已生成:")
	if r.outputDir != "" {
		fmt.Printf("  - JSON报告: %s/report.json\n", r.outputDir)
		fmt.Printf("  - Markdown报告: %s/report.md\n", r.outputDir)
	} else {
		fmt.Println("  - JSON报告: report.json")
		fmt.Println("  - Markdown报告: report.md")
	}
	fmt.Println(strings.Repeat("=", 80) + "\n")

	return nil
}

func (r *Reporter) GenerateJSONReport() error {
	report := FullReport{
		Summary:    r.buildSummary(),
		ProtoFiles: r.protoFiles,
		RiskFields: r.collectRiskFields(),
	}

	jsonData, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	outputPath := "report.json"
	if r.outputDir != "" {
		outputPath = filepath.Join(r.outputDir, "report.json")
	}

	if err := os.WriteFile(outputPath, jsonData, 0644); err != nil {
		return fmt.Errorf("failed to write JSON report: %w", err)
	}

	return nil
}

func (r *Reporter) GenerateMarkdownReport() error {
	var sb strings.Builder

	summary := r.buildSummary()
	riskFields := r.collectRiskFields()

	sb.WriteString("# Proto 默认值风险扫描报告\n\n")
	sb.WriteString(fmt.Sprintf("**扫描时间**: %s  \n", summary.ScanTime))
	sb.WriteString(fmt.Sprintf("**扫描文件**: %d 个  \n", summary.TotalFiles))
	sb.WriteString("\n---\n\n")

	sb.WriteString("## 风险统计\n\n")
	sb.WriteString("| 风险等级 | 字段数量 | 说明 |\n")
	sb.WriteString("|---------|---------|------|\n")
	sb.WriteString(fmt.Sprintf("| 🔴 HIGH | %d | 高度歧义，极易造成误解 |\n", summary.HighRiskFields))
	sb.WriteString(fmt.Sprintf("| 🟡 MEDIUM | %d | 中度歧义，可能造成误解 |\n", summary.MediumRiskFields))
	sb.WriteString(fmt.Sprintf("| 🟢 LOW | %d | 低风险或无歧义 |\n", summary.LowRiskFields))
	sb.WriteString(fmt.Sprintf("| ⚠️ 解析错误 | %d | 语法问题无法解析 |\n", summary.ParseErrors))
	sb.WriteString("\n---\n\n")

	sb.WriteString("## 高风险字段详情\n\n")
	highRiskCount := 0
	for _, rf := range riskFields {
		if rf.RiskLevel == "HIGH" {
			highRiskCount++
			relPath := filepath.Base(rf.FilePath)
			sb.WriteString(fmt.Sprintf("### %d. `%s.%s`\n\n", highRiskCount, rf.MessageName, rf.FieldName))
			sb.WriteString(fmt.Sprintf("- **位置**: [%s:%d](%s#L%d)\n", relPath, rf.Line, rf.FilePath, rf.Line))
			sb.WriteString(fmt.Sprintf("- **类型**: `%s`\n", rf.FieldType))
			sb.WriteString(fmt.Sprintf("- **隐式默认值**: `%v`\n", rf.DefaultValue))
			sb.WriteString(fmt.Sprintf("- **风险说明**: %s\n", rf.RiskReason))
			sb.WriteString("\n**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义\n\n")
		}
	}

	if highRiskCount == 0 {
		sb.WriteString("未发现高风险字段 🎉\n\n")
	}

	sb.WriteString("---\n\n")

	sb.WriteString("## 中风险字段详情\n\n")
	mediumRiskCount := 0
	for _, rf := range riskFields {
		if rf.RiskLevel == "MEDIUM" {
			mediumRiskCount++
			relPath := filepath.Base(rf.FilePath)
			sb.WriteString(fmt.Sprintf("### %d. `%s.%s`\n\n", mediumRiskCount, rf.MessageName, rf.FieldName))
			sb.WriteString(fmt.Sprintf("- **位置**: [%s:%d](%s#L%d)\n", relPath, rf.Line, rf.FilePath, rf.Line))
			sb.WriteString(fmt.Sprintf("- **类型**: `%s`\n", rf.FieldType))
			sb.WriteString(fmt.Sprintf("- **隐式默认值**: `%v`\n", rf.DefaultValue))
			sb.WriteString(fmt.Sprintf("- **风险说明**: %s\n", rf.RiskReason))
			sb.WriteString("\n")
		}
	}

	if mediumRiskCount == 0 {
		sb.WriteString("未发现中风险字段\n\n")
	}

	sb.WriteString("---\n\n")

	hasErrors := false
	for _, pf := range r.protoFiles {
		if len(pf.Errors) > 0 {
			hasErrors = true
			break
		}
	}
	if hasErrors {
		sb.WriteString("## 解析错误\n\n")
		sb.WriteString("以下行解析失败，已保留原始内容供排查：\n\n")
		for _, pf := range r.protoFiles {
			for _, err := range pf.Errors {
				relPath := filepath.Base(err.FilePath)
				sb.WriteString(fmt.Sprintf("### [%s:%d](%s#L%d)\n\n", relPath, err.Line, err.FilePath, err.Line))
				sb.WriteString(fmt.Sprintf("**错误**: %s\n\n", err.Message))
				sb.WriteString(fmt.Sprintf("```\n%s\n```\n\n", err.RawLine))
			}
		}
		sb.WriteString("---\n\n")
	}

	sb.WriteString("## Proto3 默认值参考\n\n")
	sb.WriteString("| 类型 | 默认值 | 歧义风险 |\n")
	sb.WriteString("|------|--------|----------|\n")
	sb.WriteString("| string | `\"\"` | 🔴 HIGH |\n")
	sb.WriteString("| bool | `false` | 🟡 MEDIUM |\n")
	sb.WriteString("| int32/int64 | `0` | 🔴 HIGH |\n")
	sb.WriteString("| float/double | `0` | 🔴 HIGH |\n")
	sb.WriteString("| bytes | `[]` | 🟡 MEDIUM |\n")
	sb.WriteString("| enum | 第一个值 | 🔴 HIGH |\n")
	sb.WriteString("| message | `null` | 🟢 LOW |\n")
	sb.WriteString("\n---\n\n")

	sb.WriteString("## 调用示例参考\n\n")
	sb.WriteString("### 问题场景\n")
	sb.WriteString("```go\n")
	sb.WriteString("// 危险：无法区分是未设置还是真的为空\n")
	sb.WriteString("type User struct {\n")
	sb.WriteString("    Phone string `protobuf:\"bytes,1,opt,name=phone\"`\n")
	sb.WriteString("}\n")
	sb.WriteString("\n")
	sb.WriteString("// client 端不设置字段\n")
	sb.WriteString("user := &User{}\n")
	sb.WriteString("// server 端收到 Phone = \"\"，无法判断用户是否真的没填电话\n")
	sb.WriteString("```\n\n")

	sb.WriteString("### 推荐方案\n")
	sb.WriteString("```proto\n")
	sb.WriteString("import \"google/protobuf/wrappers.proto\";\n")
	sb.WriteString("\n")
	sb.WriteString("message User {\n")
	sb.WriteString("    google.protobuf.StringValue phone = 1;  // null 表示未设置\n")
	sb.WriteString("}\n")
	sb.WriteString("```\n")

	outputPath := "report.md"
	if r.outputDir != "" {
		outputPath = filepath.Join(r.outputDir, "report.md")
	}

	if err := os.WriteFile(outputPath, []byte(sb.String()), 0644); err != nil {
		return fmt.Errorf("failed to write Markdown report: %w", err)
	}

	return nil
}
