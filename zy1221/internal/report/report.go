package report

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/zy1221/slice-teacher/internal/errors"
	"github.com/zy1221/slice-teacher/internal/model"
)

func GenerateMarkdownReport(report *model.Report, outputPath string) error {
	var builder strings.Builder

	builder.WriteString(fmt.Sprintf("# Slice 分析报告: %s\n\n", report.CaseName))
	builder.WriteString(fmt.Sprintf("Case ID: `%s`\n\n", report.CaseID))

	builder.WriteString("## 执行摘要\n\n")
	builder.WriteString(fmt.Sprintf("- **总操作数**: %d\n", report.Summary.TotalOperations))
	builder.WriteString(fmt.Sprintf("- **扩容次数**: %d\n", report.Summary.TotalGrows))
	builder.WriteString(fmt.Sprintf("- **别名问题**: %d 处\n", report.Summary.TotalAliases))

	if len(report.Summary.BigArrayHolders) > 0 {
		builder.WriteString(fmt.Sprintf("- ⚠️ **大数组持有者**: %v\n", report.Summary.BigArrayHolders))
	}

	builder.WriteString(fmt.Sprintf("- **内存浪费**: %.2f KB\n\n", report.Summary.MemoryWasteKB))

	if report.Summary.Recommendation != "" {
		builder.WriteString(fmt.Sprintf("### 建议\n\n> %s\n\n", report.Summary.Recommendation))
	}

	builder.WriteString("---\n\n")

	for i, step := range report.Steps {
		builder.WriteString(fmt.Sprintf("## 步骤 %d: %s\n\n", step.StepNumber, step.Operation.Type))

		if step.Operation.Description != "" {
			builder.WriteString(fmt.Sprintf("> %s\n\n", step.Operation.Description))
		}

		if step.DidGrow {
			builder.WriteString(fmt.Sprintf("### ⚠️ 扩容发生!\n\n"))
			builder.WriteString(fmt.Sprintf("- 原容量: %d\n", step.GrowFrom))
			builder.WriteString(fmt.Sprintf("- 新容量: %d\n\n", step.GrowTo))
		}

		builder.WriteString("### 切片状态\n\n")
		builder.WriteString("| 切片名称 | len | cap | 底层数组 | 是否别名 |\n")
		builder.WriteString("|---------|-----|-----|---------|---------|\n")

		for name, slice := range step.Slices {
			aliasMark := ""
			if slice.IsAliased {
				aliasMark = "⚠️"
			}
			builder.WriteString(fmt.Sprintf("| %s | %d | %d | %s | %s |\n",
				name, slice.Len, slice.Cap, slice.ArrayID, aliasMark))
		}
		builder.WriteString("\n")

		if len(step.SliceAliases) > 0 {
			builder.WriteString("### ⚠️ 别名关系\n\n")
			for name, aliases := range step.SliceAliases {
				builder.WriteString(fmt.Sprintf("- `%s` 与 `%v` 共享底层数组\n", name, aliases))
			}
			builder.WriteString("\n")
		}

		if len(step.Arrays) > 0 {
			builder.WriteString("### 底层数组\n\n")
			for id, array := range step.Arrays {
				builder.WriteString(fmt.Sprintf("#### %s (大小: %d, 引用计数: %d)\n\n", id, array.Size, array.RefCount))
				builder.WriteString("```\n")
				builder.WriteString(fmt.Sprintf("索引:  ")
				for i := 0; i < array.Size; i++ {
					builder.WriteString(fmt.Sprintf("%-4d", i))
				}
				builder.WriteString("\n")
				builder.WriteString(fmt.Sprintf("值:    ")
				for i := 0; i < array.Size; i++ {
					if i < len(array.Values) {
						builder.WriteString(fmt.Sprintf("%-4v", array.Values[i]))
					} else {
						builder.WriteString("nil ")
					}
				}
				builder.WriteString("\n```\n\n")
			}
		}

		if len(step.Notes) > 0 {
			builder.WriteString("### 说明\n\n")
			for _, note := range step.Notes {
				builder.WriteString(fmt.Sprintf("- %s\n", note))
			}
			builder.WriteString("\n")
		}

		if i < len(report.Steps)-1 {
			builder.WriteString("---\n\n")
		}
	}

	if err := os.WriteFile(outputPath, []byte(builder.String()), 0644); err != nil {
		return errors.NewIOError("无法写入 Markdown 报告", outputPath, err)
	}

	return nil
}

func GenerateJSONReport(report *model.Report, outputPath string, pretty bool) error {
	var data []byte
	var err error

	if pretty {
		data, err = json.MarshalIndent(report, "", "  ")
	} else {
		data, err = json.Marshal(report)
	}

	if err != nil {
		return errors.NewRuntimeError(
			fmt.Sprintf("JSON 序列化失败: %v", err),
			"请检查报告数据格式",
		)
	}

	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		return errors.NewIOError("无法写入 JSON 报告", outputPath, err)
	}

	return nil
}

func BuildReport(caseID string, caseName string, steps []*model.Step) *model.Report {
	summary := &model.Summary{
		TotalOperations: len(steps),
		TotalGrows:      0,
		TotalAliases:    0,
		BigArrayHolders: []string{},
		MemoryWasteKB:   0,
		Recommendation:  "",
	}

	bigArrayMap := make(map[string]bool)
	var recommendations []string

	for _, step := range steps {
		if step.DidGrow {
			summary.TotalGrows++
		}

		if len(step.SliceAliases) > 0 {
			summary.TotalAliases++
		}

		if step.HoldsBigArray && step.BigArrayHolder != "" {
			if !bigArrayMap[step.BigArrayHolder] {
				bigArrayMap[step.BigArrayHolder] = true
				summary.BigArrayHolders = append(summary.BigArrayHolders, step.BigArrayHolder)
			}
		}

		for _, note := range step.Notes {
			if strings.Contains(note, "内存浪费") {
				recommendations = append(recommendations, note)
			}
		}
	}

	if len(recommendations) > 0 {
		summary.Recommendation = strings.Join(recommendations, " ")
	}

	if len(summary.BigArrayHolders) > 0 {
		summary.MemoryWasteKB = float64(len(summary.BigArrayHolders)) * 8.0
	}

	return &model.Report{
		CaseID:   caseID,
		CaseName: caseName,
		Steps:    steps,
		Summary:  summary,
	}
}
