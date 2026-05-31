package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"text/tabwriter"

	"freefall-grading/internal/correct"
	"freefall-grading/internal/export"
	"freefall-grading/internal/history"
	"freefall-grading/internal/model"
	"freefall-grading/internal/parser"
	"freefall-grading/internal/review"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(importCmd)
	rootCmd.AddCommand(reviewCmd)
	rootCmd.AddCommand(correctCmd)
	rootCmd.AddCommand(historyCmd)
	rootCmd.AddCommand(exportCmd)
	rootCmd.AddCommand(statusCmd)
	rootCmd.AddCommand(gapsCmd)

	initImportCmd()
	initReviewCmd()
	initCorrectCmd()
	initHistoryCmd()
	initExportCmd()
}

var importCmd = &cobra.Command{
	Use:   "import [文件/目录]",
	Short: "导入传感器日志或标定表",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		path := args[0]
		isCal, _ := cmd.Flags().GetBool("calibration")

		info, err := os.Stat(path)
		if err != nil {
			fmt.Fprintf(os.Stderr, "路径无效: %v\n", err)
			os.Exit(1)
		}

		if info.IsDir() {
			importDirectory(path)
		} else {
			importFile(path, isCal)
		}
	},
}

func initImportCmd() {
	importCmd.Flags().Bool("calibration", false, "导入标定表")
}

func importFile(filename string, isCal bool) {

	if isCal {
		calData, err := parser.ParseCalibration(filename)
		if err != nil {
			fmt.Fprintf(os.Stderr, "解析标定表失败: %v\n", err)
			os.Exit(1)
		}

		cal := &model.Calibration{
			SensorID:     calData.SensorID,
			CalibratedAt: calData.CalibratedAt,
			ZeroPoint:    calData.ZeroPoint,
			Sensitivity:  calData.Sensitivity,
			Temperature:  calData.Temperature,
			Operator:     calData.Operator,
		}

		id, err := database.SaveCalibration(cal)
		if err != nil {
			fmt.Fprintf(os.Stderr, "保存标定表失败: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("标定表导入成功 | ID: %d | 传感器: %s\n", id, calData.SensorID)
		return
	}

	record, rawData, _, err := review.ParseAndReview(filename, filepath.Base(filename))
	if err != nil {
		fmt.Fprintf(os.Stderr, "解析失败: %v\n", err)
		os.Exit(1)
	}

	record.LastModifiedBy = operator

	id, err := database.UpsertExperimentRecord(record)
	if err != nil {
		fmt.Fprintf(os.Stderr, "保存记录失败: %v\n", err)
		os.Exit(1)
	}

	if len(rawData) > 0 {
		if err := database.SaveRawData(id, rawData); err != nil {
			fmt.Fprintf(os.Stderr, "保存原始数据失败: %v\n", err)
		}
	}

	fmt.Printf("导入成功 | ID: %d | 学生: %s | 数据点: %d | 状态: %s\n",
		id, record.StudentID, len(rawData), history.FormatStatus(record.Status))
}

func importDirectory(dirname string) {
	files, err := parser.GetFilenames(dirname)
	if err != nil {
		fmt.Fprintf(os.Stderr, "读取目录失败: %v\n", err)
		os.Exit(1)
	}

	success := 0
	for _, filename := range files {
		record, rawData, _, err := review.ParseAndReview(filename, filepath.Base(filename))
		if err != nil {
			fmt.Fprintf(os.Stderr, "跳过 %s: %v\n", filename, err)
			continue
		}

		record.LastModifiedBy = operator
		record.Source = model.SourceBatch

		id, err := database.UpsertExperimentRecord(record)
		if err != nil {
			fmt.Fprintf(os.Stderr, "保存 %s 失败: %v\n", filename, err)
			continue
		}

		if len(rawData) > 0 {
			database.SaveRawData(id, rawData)
		}

		fmt.Printf("导入 | ID: %d | %s | %s\n", id, record.StudentID, filepath.Base(filename))
		success++
	}

	fmt.Printf("\n批量导入完成 | 成功: %d / %d\n", success, len(files))
}

var reviewCmd = &cobra.Command{
	Use:   "review [记录ID]",
	Short: "复核实验数据（不带ID则复核全部）",
	Run: func(cmd *cobra.Command, args []string) {
		reviewer := review.NewReviewer(database, model.DefaultReviewConfig())

		if len(args) == 0 {
			processed, pending, err := reviewer.ReviewAllImported(operator)
			if err != nil {
				fmt.Fprintf(os.Stderr, "批量复核失败: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("复核完成 | 处理: %d | 待处理: %d | 通过: %d\n",
				processed, pending, processed-pending)
			return
		}

		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "无效的ID: %v\n", err)
			os.Exit(1)
		}

		result, err := reviewer.ReviewRecord(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "复核失败: %v\n", err)
			os.Exit(1)
		}

		if err := reviewer.ApplyReview(id, result, operator); err != nil {
			fmt.Fprintf(os.Stderr, "应用复核结果失败: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("记录 #%d 复核完成\n", id)
		fmt.Printf("  状态: %s\n", history.FormatStatus(result.Status))
		fmt.Printf("  零点漂移: %.4fg\n", result.ZeroDrift)
		fmt.Printf("  采样缺口: %d处\n", result.GapCount)
		fmt.Printf("  重力加速度: %.4f m/s²\n", result.FinalGravity)
		if len(result.Issues) > 0 {
			fmt.Println("  问题:")
			for _, issue := range result.Issues {
				fmt.Printf("    - %s\n", issue)
			}
		}
	},
}

func initReviewCmd() {}

var correctCmd = &cobra.Command{
	Use:   "correct",
	Short: "修正/审核实验记录",
}

func initCorrectCmd() {
	approveCmd := &cobra.Command{
		Use:   "approve [记录ID...]",
		Short: "通过记录（不带ID则通过全部已复核）",
		Run: func(cmd *cobra.Command, args []string) {
			c := correct.NewCorrector(database)
			reason, _ := cmd.Flags().GetString("reason")

			if len(args) == 0 {
				count, err := c.BatchApprove(operator, reason)
				if err != nil {
					fmt.Fprintf(os.Stderr, "批量通过失败: %v\n", err)
					os.Exit(1)
				}
				fmt.Printf("批量通过完成 | 数量: %d\n", count)
				return
			}

			var ids []int64
			for _, arg := range args {
				id, err := strconv.ParseInt(arg, 10, 64)
				if err != nil {
					fmt.Fprintf(os.Stderr, "无效ID: %s\n", arg)
					continue
				}
				ids = append(ids, id)
			}

			success, failed, _ := c.BatchApproveByIDs(ids, operator, reason)
			fmt.Printf("通过完成 | 成功: %d | 失败: %d\n", success, len(failed))
		},
	}
	approveCmd.Flags().String("reason", "", "审核理由")

	rejectCmd := &cobra.Command{
		Use:   "reject <记录ID>",
		Short: "驳回记录",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			id, _ := strconv.ParseInt(args[0], 10, 64)
			reason, _ := cmd.Flags().GetString("reason")
			c := correct.NewCorrector(database)
			if err := c.RejectRecord(id, operator, reason); err != nil {
				fmt.Fprintf(os.Stderr, "驳回失败: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("记录 #%d 已驳回\n", id)
		},
	}
	rejectCmd.Flags().String("reason", "", "驳回理由")

	setGravityCmd := &cobra.Command{
		Use:   "gravity <记录ID> <值>",
		Short: "设置重力加速度值",
		Args:  cobra.ExactArgs(2),
		Run: func(cmd *cobra.Command, args []string) {
			id, _ := strconv.ParseInt(args[0], 10, 64)
			value, _ := strconv.ParseFloat(args[1], 64)
			reason, _ := cmd.Flags().GetString("reason")

			c := correct.NewCorrector(database)
			if err := c.UpdateGravity(id, value, operator, reason); err != nil {
				fmt.Fprintf(os.Stderr, "更新失败: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("记录 #%d 重力加速度已设为 %.4f m/s²\n", id, value)
		},
	}
	setGravityCmd.Flags().String("reason", "", "修改理由")

	correctCmd.AddCommand(approveCmd)
	correctCmd.AddCommand(rejectCmd)
	correctCmd.AddCommand(setGravityCmd)
}

var historyCmd = &cobra.Command{
	Use:   "history [记录ID]",
	Short: "查看记录历史",
	Run: func(cmd *cobra.Command, args []string) {
		h := history.NewHistoryQuery(database)

		if len(args) == 0 {
			fmt.Println("请提供记录ID")
			return
		}

		id, _ := strconv.ParseInt(args[0], 10, 64)
		record, hist, err := h.GetRecordDetail(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "查询失败: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("记录 #%d 详情\n", id)
		fmt.Printf("  学生: %s (%s)\n", record.StudentName, record.StudentID)
		fmt.Printf("  实验: %s | 组号: %s\n", record.ExperimentNo, record.GroupNo)
		fmt.Printf("  来源: %s (%s)\n", history.FormatSource(record.Source), record.SourceFile)
		fmt.Printf("  当前状态: %s\n", history.FormatStatus(record.Status))
		fmt.Printf("  数据点: %d | 零点漂移: %.4fg | 缺口: %d处\n",
			record.DataPoints, record.ZeroDrift, record.GapCount)
		fmt.Printf("  重力加速度: %.4f %s\n", record.FinalGravity, record.GravityUnit)
		fmt.Printf("  待处理原因: %s\n", record.PendingReason)
		fmt.Printf("  最后修改: %s @ %s\n", record.LastModifiedBy, record.UpdatedAt.Format("2006-01-02 15:04:05"))

		if len(hist) > 0 {
			fmt.Println("\n状态历史:")
			for _, h := range hist {
				fmt.Printf("  [%s] %s → %s | %s\n",
					h.CreatedAt.Format("01-02 15:04"),
					history.FormatStatus(h.FromStatus),
					history.FormatStatus(h.ToStatus),
					h.ModifiedBy)
				if h.Reason != "" {
					fmt.Printf("      理由: %s\n", h.Reason)
				}
			}
		}
	},
}

func initHistoryCmd() {}

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出数据",
}

func initExportCmd() {
	csvCmd := &cobra.Command{
		Use:   "csv <输出文件>",
		Short: "导出已通过记录为CSV",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			e := export.NewExporter(database)
			count, err := e.ExportApprovedToCSV(args[0])
			if err != nil {
				fmt.Fprintf(os.Stderr, "导出失败: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("导出成功 | 记录: %d | 文件: %s\n", count, args[0])
		},
	}

	jsonCmd := &cobra.Command{
		Use:   "json <输出文件>",
		Short: "导出全部记录为JSON",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			e := export.NewExporter(database)
			count, err := e.ExportAllToJSON(args[0])
			if err != nil {
				fmt.Fprintf(os.Stderr, "导出失败: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("导出成功 | 记录: %d | 文件: %s\n", count, args[0])
		},
	}

	reportCmd := &cobra.Command{
		Use:   "report <输出文件>",
		Short: "导待处理报告",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			e := export.NewExporter(database)
			count, err := e.ExportPendingReport(args[0])
			if err != nil {
				fmt.Fprintf(os.Stderr, "导出失败: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("导出成功 | 待处理记录: %d | 文件: %s\n", count, args[0])
		},
	}

	exportCmd.AddCommand(csvCmd)
	exportCmd.AddCommand(jsonCmd)
	exportCmd.AddCommand(reportCmd)
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "查看数据统计",
	Run: func(cmd *cobra.Command, args []string) {
		h := history.NewHistoryQuery(database)
		stats, total, err := h.GetStatistics()
		if err != nil {
			fmt.Fprintf(os.Stderr, "查询失败: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("自由落体实验批改 统计")
		fmt.Println("=" + stringsRepeat("-", 40))
		fmt.Printf("总记录数: %d\n\n", total)

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		allStatus := []model.RecordStatus{
			model.StatusImported,
			model.StatusPending,
			model.StatusReviewed,
			model.StatusCorrected,
			model.StatusApproved,
			model.StatusRejected,
			model.StatusExported,
		}
		for _, s := range allStatus {
			count := stats[string(s)]
			if count > 0 {
				fmt.Fprintf(w, "  %s\t: %d\n", history.FormatStatus(s), count)
			}
		}
		w.Flush()
	},
}

var gapsCmd = &cobra.Command{
	Use:   "gaps <记录ID>",
	Short: "查看采样缺口详情",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, _ := strconv.ParseInt(args[0], 10, 64)
		h := history.NewHistoryQuery(database)
		report, err := h.GetGapReport(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "查询失败: %v\n", err)
			os.Exit(1)
		}
		fmt.Println(report)
	},
}

func stringsRepeat(s string, count int) string {
	result := ""
	for i := 0; i < count; i++ {
		result += s
	}
	return result
}
