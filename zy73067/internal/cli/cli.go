package cli

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"text/tabwriter"
	"time"

	"blade-schedule/internal/db"
	"blade-schedule/internal/scheduler"
)

const usage = `风机叶片备件排程 blade-schedule

用法:
  blade-schedule init    --workdir ./data                 # 初始化工作目录，复制一份正常样例数据
  blade-schedule run     --spare-parts spare.csv          # 执行排程（必填：备件清单、停机窗口、到货计划）
                 --downtime windows.csv
                 --arrivals arrivals.csv
                 [--remarks remarks.csv]
                 [--db blade.db]
                 [--tag run-20240601]
  blade-schedule rerun   --spare-parts spare.csv          # 异常样例重跑（保留已有备注、状态、截图说明引用）
                 --downtime windows.csv
                 --arrivals arrivals.csv
                 [--remarks remarks.csv]
                 [--db blade.db]
                 [--tag rerun-anomaly]
  blade-schedule show    [--db blade.db]                  # 查看汇总 + 异常明细 + 截图说明
                 [--run-id N]
                 [--format text|json]
`

func Main() int {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		return 2
	}
	cmd := os.Args[1]
	args := os.Args[2:]
	switch cmd {
	case "init":
		return cmdInit(args)
	case "run":
		return cmdRun(args, false)
	case "rerun":
		return cmdRun(args, true)
	case "show":
		return cmdShow(args)
	case "-h", "--help", "help":
		fmt.Print(usage)
		return 0
	default:
		fmt.Fprintf(os.Stderr, "未知命令 %q\n\n%s", cmd, usage)
		return 2
	}
}

func cmdInit(args []string) int {
	fs := flag.NewFlagSet("init", flag.ExitOnError)
	workdir := fs.String("workdir", "./data", "样例数据输出目录")
	_ = fs.Parse(args)
	if *workdir == "" {
		fmt.Fprintln(os.Stderr, "错误: --workdir 不能为空")
		return 2
	}
	if err := os.MkdirAll(*workdir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "错误: 创建工作目录 %s 失败: %v\n", *workdir, err)
		return 1
	}
	subs := []string{"normal", "anomaly"}
	for _, sub := range subs {
		p := filepath.Join(*workdir, sub)
		if err := os.MkdirAll(p, 0o755); err != nil {
			fmt.Fprintf(os.Stderr, "错误: %v\n", err)
			return 1
		}
	}
	files := map[string]string{
		"normal/spare_parts.csv":  sampleNormalSpare,
		"normal/downtime.csv":     sampleNormalDowntime,
		"normal/arrivals.csv":     sampleNormalArrivals,
		"normal/remarks.csv":      sampleNormalRemarks,
		"anomaly/spare_parts.csv": sampleAnomalySpare,
		"anomaly/downtime.csv":    sampleAnomalyDowntime,
		"anomaly/arrivals.csv":    sampleAnomalyArrivals,
		"anomaly/remarks.csv":     sampleAnomalyRemarks,
	}
	for name, body := range files {
		fp := filepath.Join(*workdir, name)
		if err := os.WriteFile(fp, []byte(body), 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "错误: 写入 %s 失败: %v\n", fp, err)
			return 1
		}
	}
	fmt.Printf("✔ 初始化完成\n  工作目录: %s\n\n  正常排程样例（第1步）:\n    blade-schedule run \\\n      --spare-parts %s/normal/spare_parts.csv \\\n      --downtime %s/normal/downtime.csv \\\n      --arrivals %s/normal/arrivals.csv \\\n      --remarks %s/normal/remarks.csv \\\n      --tag normal-run\n\n  异常样例重跑（第2步）:\n    blade-schedule rerun \\\n      --spare-parts %s/anomaly/spare_parts.csv \\\n      --downtime %s/anomaly/downtime.csv \\\n      --arrivals %s/anomaly/arrivals.csv \\\n      --remarks %s/anomaly/remarks.csv \\\n      --tag anomaly-rerun\n\n  查看汇总与异常（第3步）:\n    blade-schedule show\n",
		*workdir, *workdir, *workdir, *workdir, *workdir,
		*workdir, *workdir, *workdir, *workdir)
	return 0
}

func cmdRun(args []string, isRerun bool) int {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	spare := fs.String("spare-parts", "", "必填: 备件清单 CSV")
	downtime := fs.String("downtime", "", "必填: 停机窗口 CSV")
	arrivals := fs.String("arrivals", "", "必填: 到货计划 CSV")
	remarks := fs.String("remarks", "", "选填: 备注状态 CSV")
	dbPath := fs.String("db", "./blade.db", "SQLite 数据库路径")
	tag := fs.String("tag", "", "本次运行的标签")
	_ = fs.Parse(args)

	switch {
	case *spare == "":
		fmt.Fprintln(os.Stderr, "错误: 缺少 --spare-parts 备件清单参数")
		return 2
	case *downtime == "":
		fmt.Fprintln(os.Stderr, "错误: 缺少 --downtime 停机窗口参数")
		return 2
	case *arrivals == "":
		fmt.Fprintln(os.Stderr, "错误: 缺少 --arrivals 到货计划参数")
		return 2
	}
	if *tag == "" {
		prefix := "run"
		if isRerun {
			prefix = "rerun"
		}
		*tag = fmt.Sprintf("%s-%s", prefix, time.Now().Format("20060102-150405"))
	}

	s := scheduler.New()
	res, err := s.Compute(scheduler.InputSet{
		SparePartsPath: *spare,
		DowntimePath:   *downtime,
		ArrivalPath:    *arrivals,
		RemarksPath:    *remarks,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "排程失败: %v\n", err)
		return 1
	}

	store, err := db.Open(*dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "打开数据库 %s 失败: %v\n", *dbPath, err)
		return 1
	}
	defer store.Close()

	summary := fmt.Sprintf("total=%d ontime=%d late=%d anomaly=%d",
		res.SummaryStats.Total, res.SummaryStats.OnTime, res.SummaryStats.Late, res.SummaryStats.Anomaly)
	runID, err := store.CreateRun(*tag, summary)
	if err != nil {
		fmt.Fprintf(os.Stderr, "写入 runs 表失败: %v\n", err)
		return 1
	}

	if len(res.Remarks) > 0 {
		if err := store.SaveRemarks(res.Remarks); err != nil {
			fmt.Fprintf(os.Stderr, "写入备注状态失败: %v\n", err)
			return 1
		}
		fmt.Printf("📝 已加载 %d 条备注状态（已存在的人工信息未被覆盖）\n", len(res.Remarks))
	}

	for i := range res.Records {
		res.Records[i].RunID = runID
		res.Records[i].RunTag = *tag
		note, _ := store.GetNote(res.Records[i].UnifiedName, res.Records[i].SpecModel)
		if note != nil {
			res.Records[i].PrevStatus = note.Status
			res.Records[i].PrevRemark = note.Remark
			res.Records[i].PrevScreenshot = note.ScreenshotRef
			if note.Status != "" && note.Status != "pending" {
				res.Records[i].Status = note.Status
			}
			if note.Remark != "" {
				res.Records[i].Remark = note.Remark
			}
			if note.ScreenshotRef != "" {
				res.Records[i].ScreenshotRef = note.ScreenshotRef
			}
			if note.ThresholdNote != "" && res.Records[i].ThresholdText == "" {
				res.Records[i].ThresholdText = note.ThresholdNote
			}
		}
		if _, err := store.SaveRecord(&res.Records[i]); err != nil {
			fmt.Fprintf(os.Stderr, "保存记录失败: %v\n", err)
			return 1
		}
	}

	mode := "正常排程"
	if isRerun {
		mode = "异常重跑（保留已有备注/状态）"
	}
	fmt.Printf("⚙ %s 完成  run_id=%d tag=%s\n", mode, runID, *tag)
	printSummary(res)
	return 0
}

func cmdShow(args []string) int {
	fs := flag.NewFlagSet("show", flag.ExitOnError)
	dbPath := fs.String("db", "./blade.db", "SQLite 数据库路径")
	runID := fs.Int64("run-id", 0, "指定 run_id（默认最新一次）")
	format := fs.String("format", "text", "输出格式 text|json")
	_ = fs.Parse(args)

	store, err := db.Open(*dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "打开数据库 %s 失败: %v\n", *dbPath, err)
		return 1
	}
	defer store.Close()

	runs, err := store.ListRuns()
	if err != nil {
		fmt.Fprintf(os.Stderr, "查询 runs 失败: %v\n", err)
		return 1
	}
	if len(runs) == 0 {
		fmt.Println("（数据库为空，请先运行 blade-schedule run 或 blade-schedule rerun）")
		return 0
	}
	var target db.RunSummary
	if *runID > 0 {
		for _, r := range runs {
			if r.ID == *runID {
				target = r
				break
			}
		}
		if target.ID == 0 {
			fmt.Fprintf(os.Stderr, "找不到 run_id=%d，可用的 run_id 有: ", *runID)
			for i, r := range runs {
				if i > 0 {
					fmt.Fprint(os.Stderr, ",")
				}
				fmt.Fprintf(os.Stderr, " %d(%s)", r.ID, r.Tag)
			}
			fmt.Fprintln(os.Stderr)
			return 1
		}
	} else {
		target = runs[0]
	}
	anomalies, err := store.ListAnomalies(target.ID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "查询异常记录失败: %v\n", err)
		return 1
	}
	if *format == "json" {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		_ = enc.Encode(map[string]any{
			"run":       target,
			"runs":      runs,
			"anomalies": anomalies,
		})
		return 0
	}

	fmt.Println("═══════════════════════════════════════════════════")
	fmt.Printf(" 运行历史（共 %d 次）\n", len(runs))
	fmt.Println("───────────────────────────────────────────────────")
	tw := tabwriter.NewWriter(os.Stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintln(tw, "RUN_ID\tTAG\t创建时间\t总数\t异常\t摘要")
	for _, r := range runs {
		marker := " "
		if r.ID == target.ID {
			marker = "◀"
		}
		fmt.Fprintf(tw, "%d%s\t%s\t%s\t%d\t%d\t%s\n", r.ID, marker, r.Tag, r.When[:19], r.Total, r.Anomaly, r.Summary)
	}
	tw.Flush()
	fmt.Println()
	fmt.Printf(" ▶ 当前查看 run_id=%d  tag=%s  %s\n", target.ID, target.Tag, target.When)
	fmt.Println()
	fmt.Println("───────────────────────────────────────────────────")
	fmt.Println(" 汇总统计")
	fmt.Println("───────────────────────────────────────────────────")
	fmt.Printf("  记录总数       : %d\n", target.Total)
	fmt.Printf("  异常数         : %d\n", target.Anomaly)
	fmt.Printf("  正常率         : %s\n", calcRate(target.Total, target.Total-target.Anomaly))
	fmt.Println()

	if len(anomalies) == 0 {
		fmt.Println("✔ 本次运行无异常")
		return 0
	}
	fmt.Println("───────────────────────────────────────────────────")
	fmt.Printf(" 异常明细（共 %d 条）\n", len(anomalies))
	fmt.Println("───────────────────────────────────────────────────")
	sort.Slice(anomalies, func(i, j int) bool { return anomalies[i].ID < anomalies[j].ID })
	for i, a := range anomalies {
		fmt.Printf("\n  [%d] %s  (需求%d / 到货%d)\n", i+1, a.UnifiedName, a.RequiredQty, a.ArrivedQty)
		makeWin := "✔ 赶得上停机窗口"
		if a.WillMakeWindow == 0 {
			makeWin = "✗ 晚于停机窗口"
			if a.DaysLate > 0 {
				makeWin = fmt.Sprintf("✗ 晚于停机窗口 %d 天", a.DaysLate)
			}
		}
		fmt.Printf("      排程结论      : %s\n", makeWin)
		if a.ETA != "" {
			fmt.Printf("      ETA/停机开始  : %s / %s\n", a.ETA, a.DowntimeStart)
		}
		fmt.Printf("      异常原因      : %s\n", a.Reasons)
		if a.RawSourceQuote != "" {
			fmt.Printf("      原始清单原话  : %s\n", a.RawSourceQuote)
		}
		if a.Status != "" {
			fmt.Printf("      当前状态      : %s\n", a.Status)
		}
		if a.Remark != "" {
			fmt.Printf("      备注（保留）  : %s\n", a.Remark)
		}
		if a.ScreenshotRef != "" {
			fmt.Printf("      截图说明引用  : %s\n", a.ScreenshotRef)
		}
		if a.DeltaFromPrev != "" {
			fmt.Printf("      ⚠ 相较上次变化: %s\n", a.DeltaFromPrev)
		}
	}
	fmt.Println()
	fmt.Println("───────────────────────────────────────────────────")
	fmt.Println(" 说明: 再次执行 blade-schedule rerun 时，已有 状态/备注/截图 不会被覆盖，")
	fmt.Println("       Delta 字段会标出本次排程结论的变化原因，便于维保主管交接时追溯。")
	fmt.Println("═══════════════════════════════════════════════════")
	return 0
}

func calcRate(total, ok int) string {
	if total == 0 {
		return "-"
	}
	return fmt.Sprintf("%.1f%%", 100.0*float64(ok)/float64(total))
}

func printSummary(res *scheduler.RunResult) {
	fmt.Println("───────────────────────────────────────────────────")
	fmt.Println(" 汇总")
	fmt.Println("───────────────────────────────────────────────────")
	fmt.Printf("  备件种类总数   : %d\n", res.SummaryStats.Total)
	fmt.Printf("  赶得上停机窗口 : %d\n", res.SummaryStats.OnTime)
	fmt.Printf("  晚于停机窗口   : %d\n", res.SummaryStats.Late)
	fmt.Printf("  需关注异常     : %d\n", res.SummaryStats.Anomaly)
	fmt.Println()
	fmt.Println("───────────────────────────────────────────────────")
	fmt.Printf(" 备件排程明细（共 %d 条）\n", len(res.Records))
	fmt.Println("───────────────────────────────────────────────────")
	tw := tabwriter.NewWriter(os.Stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintln(tw, "统一备件名称\t需求\t到货\tETA\t停机开始\t状态\t晚(天)\t异常")
	sort.Slice(res.Records, func(i, j int) bool { return res.Records[i].UnifiedName < res.Records[j].UnifiedName })
	for _, r := range res.Records {
		status := "⚠ 异常"
		if r.WillMakeWindow {
			status = "✔ 赶得上"
		} else if !r.DowntimeStart.IsZero() {
			status = "✗ 延误"
		}
		eta := "-"
		if !r.ETA.IsZero() {
			eta = r.ETA.Format("2006-01-02")
		}
		ds := "-"
		if !r.DowntimeStart.IsZero() {
			ds = r.DowntimeStart.Format("2006-01-02")
		}
		days := "-"
		if r.DaysLate > 0 {
			days = fmt.Sprintf("%d", r.DaysLate)
		}
		anom := "-"
		if len(r.AnomalyReasons) > 0 {
			anom = strings.Join(r.AnomalyReasons, "；")
		}
		fmt.Fprintf(tw, "%s\t%d\t%d\t%s\t%s\t%s\t%s\t%s\n",
			r.UnifiedName, r.RequiredQty, r.ArrivedQty, eta, ds, status, days, anom)
	}
	tw.Flush()
	withMeta := false
	for _, r := range res.Records {
		if r.Status != "" || r.Remark != "" || r.ScreenshotRef != "" {
			withMeta = true
			break
		}
	}
	if withMeta {
		fmt.Println()
		fmt.Println("───────────────────────────────────────────────────")
		fmt.Println(" 备注 / 状态 / 截图引用")
		fmt.Println("───────────────────────────────────────────────────")
		for _, r := range res.Records {
			if r.Status == "" && r.Remark == "" && r.ScreenshotRef == "" {
				continue
			}
			fmt.Printf("  %s\n", r.UnifiedName)
			if r.Status != "" {
				fmt.Printf("      当前状态      : %s\n", r.Status)
			}
			if r.Remark != "" {
				fmt.Printf("      备注          : %s\n", r.Remark)
			}
			if r.ScreenshotRef != "" {
				fmt.Printf("      截图说明引用  : %s\n", r.ScreenshotRef)
			}
		}
	}
}
