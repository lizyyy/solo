package cmd

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
)

var (
	seedOutputDir string
	seedIncludeBad bool
)

var seedCmd = &cobra.Command{
	Use:   "seed",
	Short: "生成样例数据文件",
	Long:  `生成用于测试的样例数据文件，包括 gctrace.log、heap-samples.csv 和 alloc-events.jsonl。`,
	Run:   runSeed,
}

func init() {
	seedCmd.Flags().StringVarP(&seedOutputDir, "output", "o", ".", "输出目录（默认为当前目录）")
	seedCmd.Flags().BoolVarP(&seedIncludeBad, "bad", "b", false, "同时生成坏格式的样例文件")

	rootCmd.AddCommand(seedCmd)
}

func runSeed(cmd *cobra.Command, args []string) {
	if err := os.MkdirAll(seedOutputDir, 0755); err != nil {
		exitWithError(fmt.Sprintf("无法创建输出目录: %s", seedOutputDir), err)
	}

	fmt.Printf("生成样例数据到目录: %s\n\n", seedOutputDir)

	if err := generateGCTraceLog(); err != nil {
		exitWithError("生成 gctrace.log 失败", err)
	}
	fmt.Println("✓ 已生成: gctrace.log")

	if err := generateHeapSamplesCSV(); err != nil {
		exitWithError("生成 heap-samples.csv 失败", err)
	}
	fmt.Println("✓ 已生成: heap-samples.csv")

	if err := generateAllocEventsJSONL(); err != nil {
		exitWithError("生成 alloc-events.jsonl 失败", err)
	}
	fmt.Println("✓ 已生成: alloc-events.jsonl")

	if seedIncludeBad {
		if err := generateBadGCTraceLog(); err != nil {
			exitWithError("生成 bad-gctrace.log 失败", err)
		}
		fmt.Println("✓ 已生成: bad-gctrace.log")

		if err := generateBadHeapSamplesCSV(); err != nil {
			exitWithError("生成 bad-heap-samples.csv 失败", err)
		}
		fmt.Println("✓ 已生成: bad-heap-samples.csv")
	}

	fmt.Println("\n样例数据生成完成！")
	fmt.Printf("\n使用示例:\n")
	fmt.Printf("  gcinsight analyze --gc-trace %s/gctrace.log --heap-sample %s/heap-samples.csv --alloc-event %s/alloc-events.jsonl\n",
		seedOutputDir, seedOutputDir, seedOutputDir)
}

func generateGCTraceLog() error {
	filePath := filepath.Join(seedOutputDir, "gctrace.log")
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	lines := []string{
		"gc 1 @0.001s 0%: 0.010+0.48+0.005 ms clock, 0.020+0/0.30/0.25+0.010 ms cpu, 4->4->2 MB, 5 MB goal, 4 P",
		"gc 2 @0.005s 1%: 0.015+0.62+0.008 ms clock, 0.030+0/0.45/0.30+0.016 ms cpu, 6->6->3 MB, 7 MB goal, 4 P",
		"gc 3 @0.012s 2%: 0.012+0.85+0.010 ms clock, 0.024+0/0.60/0.40+0.020 ms cpu, 8->8->4 MB, 10 MB goal, 4 P",
		"gc 4 @0.025s 3%: 0.020+1.20+0.015 ms clock, 0.040+0/0.80/0.60+0.030 ms cpu, 12->12->6 MB, 15 MB goal, 4 P",
		"gc 5 @0.050s 4%: 0.025+2.10+0.020 ms clock, 0.050+0/1.50/1.00+0.040 ms cpu, 20->20->10 MB, 25 MB goal, 4 P",
		"gc 6 @0.100s 5%: 0.030+3.50+0.025 ms clock, 0.060+0/2.50/1.80+0.050 ms cpu, 30->30->15 MB, 38 MB goal, 4 P",
		"gc 7 @0.200s 6%: 0.035+5.20+0.030 ms clock, 0.070+0/3.80/2.80+0.060 ms cpu, 45->45->22 MB, 56 MB goal, 4 P",
		"gc 8 @0.400s 7%: 0.040+8.50+0.040 ms clock, 0.080+0/6.00/4.50+0.080 ms cpu, 68->68->34 MB, 85 MB goal, 4 P",
		"gc 9 @0.800s 8%: 0.050+12.00+0.050 ms clock, 0.100+0/8.50/6.50+0.100 ms cpu, 102->102->51 MB, 128 MB goal, 4 P",
		"gc 10 @1.500s 9%: 0.060+18.50+0.060 ms clock, 0.120+0/13.00/10.00+0.120 ms cpu, 153->153->76 MB, 191 MB goal, 4 P",
		"gc 11 @2.500s 10%: 0.070+25.00+0.070 ms clock, 0.140+0/18.00/14.00+0.140 ms cpu, 230->230->115 MB, 287 MB goal, 4 P",
		"gc 12 @4.000s 11%: 0.080+35.00+0.080 ms clock, 0.160+0/25.00/20.00+0.160 ms cpu, 345->345->172 MB, 431 MB goal, 4 P",
		"gc 13 @6.000s 12%: 0.090+50.00+0.090 ms clock, 0.180+0/35.00/28.00+0.180 ms cpu, 518->518->259 MB, 647 MB goal, 4 P",
		"gc 14 @8.000s 13%: 0.080+45.00+0.080 ms clock, 0.160+0/32.00/25.00+0.160 ms cpu, 777->777->388 MB, 971 MB goal, 4 P, assisted: 12 goroutines, 156.25 MB",
		"gc 15 @10.000s 14%: 0.100+65.00+0.100 ms clock, 0.200+0/45.00/35.00+0.200 ms cpu, 1165->1165->582 MB, 1456 MB goal, 4 P, assisted: 25 goroutines, 312.50 MB",
		"gc 16 @12.000s 15%: 0.090+55.00+0.090 ms clock, 0.180+0/40.00/30.00+0.180 ms cpu, 873->873->436 MB, 1091 MB goal, 4 P",
		"gc 17 @14.000s 16%: 0.085+48.00+0.085 ms clock, 0.170+0/34.00/26.00+0.170 ms cpu, 655->655->327 MB, 818 MB goal, 4 P",
		"gc 18 @16.000s 17%: 0.075+40.00+0.075 ms clock, 0.150+0/28.00/21.00+0.150 ms cpu, 491->491->245 MB, 614 MB goal, 4 P",
		"gc 19 @18.000s 18%: 0.065+32.00+0.065 ms clock, 0.130+0/22.00/16.00+0.130 ms cpu, 368->368->184 MB, 460 MB goal, 4 P",
		"gc 20 @20.000s 19%: 0.055+25.00+0.055 ms clock, 0.110+0/17.00/12.00+0.110 ms cpu, 276->276->138 MB, 345 MB goal, 4 P",
	}

	for _, line := range lines {
		if _, err := fmt.Fprintln(file, line); err != nil {
			return err
		}
	}

	return nil
}

func generateHeapSamplesCSV() error {
	filePath := filepath.Join(seedOutputDir, "heap-samples.csv")
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	header := []string{
		"timestamp", "heap_alloc", "heap_sys", "heap_inuse",
		"heap_idle", "heap_released", "heap_objects",
		"mallocs", "frees", "next_gc", "last_gc",
		"num_gc", "num_forced_gc", "gc_cpu_fraction",
	}
	if err := writer.Write(header); err != nil {
		return err
	}

	baseTime := time.Now()
	records := [][]interface{}{
		{baseTime.Add(0 * time.Second), 4194304, 8388608, 4194304, 4194304, 0, 1024, 2048, 1024, 5242880, 0, 0, 0, 0.00},
		{baseTime.Add(1 * time.Second), 6291456, 10485760, 6291456, 4194304, 0, 1536, 3072, 1536, 7340032, 0, 1, 0, 0.01},
		{baseTime.Add(2 * time.Second), 8388608, 12582912, 8388608, 4194304, 0, 2048, 4096, 2048, 10485760, 1000000, 2, 0, 0.02},
		{baseTime.Add(3 * time.Second), 12582912, 16777216, 12582912, 4194304, 0, 3072, 6144, 3072, 15728640, 2000000, 3, 0, 0.03},
		{baseTime.Add(5 * time.Second), 20971520, 25165824, 20971520, 4194304, 0, 5120, 10240, 5120, 26214400, 4000000, 4, 0, 0.04},
		{baseTime.Add(10 * time.Second), 31457280, 37748736, 31457280, 6291456, 0, 7680, 15360, 7680, 39845888, 8000000, 5, 0, 0.05},
		{baseTime.Add(20 * time.Second), 47185920, 54525952, 47185920, 7340032, 0, 11520, 23040, 11520, 58720256, 16000000, 6, 0, 0.06},
		{baseTime.Add(30 * time.Second), 71303168, 81788928, 71303168, 10485760, 0, 17408, 34816, 17408, 89128960, 32000000, 7, 0, 0.07},
	}

	for _, rec := range records {
		row := make([]string, len(rec))
		row[0] = rec[0].(time.Time).Format(time.RFC3339)
		for i := 1; i < len(rec); i++ {
			switch v := rec[i].(type) {
			case int:
				row[i] = fmt.Sprintf("%d", v)
			case float64:
				row[i] = fmt.Sprintf("%.2f", v)
			}
		}
		if err := writer.Write(row); err != nil {
			return err
		}
	}

	return nil
}

func generateAllocEventsJSONL() error {
	filePath := filepath.Join(seedOutputDir, "alloc-events.jsonl")
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	baseTime := time.Now()

	events := []map[string]interface{}{
		{"timestamp": baseTime.Add(1 * time.Millisecond).Format(time.RFC3339Nano), "type": "alloc", "size": 8192, "address": 140737488355328, "stack": "runtime.allocm\nruntime.malg\nmain.main", "goroutine": 1},
		{"timestamp": baseTime.Add(2 * time.Millisecond).Format(time.RFC3339Nano), "type": "alloc", "size": 4096, "address": 140737488363520, "stack": "runtime.allocm\nnet/http.(*ServeMux).ServeHTTP", "goroutine": 5},
		{"timestamp": baseTime.Add(3 * time.Millisecond).Format(time.RFC3339Nano), "type": "alloc", "size": 16384, "address": 140737488367616, "stack": "runtime.allocm\nencoding/json.(*Decoder).decode", "goroutine": 10},
		{"timestamp": baseTime.Add(5 * time.Millisecond).Format(time.RFC3339Nano), "type": "free", "size": 8192, "address": 140737488355328, "stack": "runtime.mcentral_cacheSpan\nruntime.mheap.alloc", "goroutine": 1},
		{"timestamp": baseTime.Add(10 * time.Millisecond).Format(time.RFC3339Nano), "type": "alloc", "size": 32768, "address": 140737488371712, "stack": "runtime.allocm\ngithub.com/gin-gonic/gin.(*Context).JSON", "goroutine": 15},
		{"timestamp": baseTime.Add(20 * time.Millisecond).Format(time.RFC3339Nano), "type": "alloc", "size": 65536, "address": 140737488379904, "stack": "runtime.allocm\ngorm.io/gorm.(*DB).Scan", "goroutine": 20},
		{"timestamp": baseTime.Add(50 * time.Millisecond).Format(time.RFC3339Nano), "type": "alloc", "size": 131072, "address": 140737488396288, "stack": "runtime.allocm\nbufio.NewWriterSize", "goroutine": 25},
		{"timestamp": baseTime.Add(100 * time.Millisecond).Format(time.RFC3339Nano), "type": "alloc", "size": 262144, "address": 140737488527360, "stack": "runtime.allocm\nfmt.Sprintf", "goroutine": 30},
		{"timestamp": baseTime.Add(200 * time.Millisecond).Format(time.RFC3339Nano), "type": "alloc", "size": 524288, "address": 140737488789504, "stack": "runtime.allocm\nnet/http.(*ResponseWriter).Write", "goroutine": 35},
		{"timestamp": baseTime.Add(500 * time.Millisecond).Format(time.RFC3339Nano), "type": "alloc", "size": 1048576, "address": 140737489313792, "stack": "runtime.allocm\nnet/http.(*Request).GetBody", "goroutine": 40},
	}

	for _, event := range events {
		data, err := json.Marshal(event)
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintln(file, string(data)); err != nil {
			return err
		}
	}

	return nil
}

func generateBadGCTraceLog() error {
	filePath := filepath.Join(seedOutputDir, "bad-gctrace.log")
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	lines := []string{
		"这是一行错误的 GC 日志格式",
		"gc INVALID @0.001s 0%: 0.010+0.48+0.005 ms clock, 0.020+0/0.30/0.25+0.010 ms cpu, 4->4->2 MB, 5 MB goal, 4 P",
		"另一个无效行",
		"gc 2 @0.005s INVALID: 0.015+0.62+0.008 ms clock, 0.030+0/0.45/0.30+0.016 ms cpu, 6->6->3 MB, 7 MB goal, 4 P",
	}

	for _, line := range lines {
		if _, err := fmt.Fprintln(file, line); err != nil {
			return err
		}
	}

	return nil
}

func generateBadHeapSamplesCSV() error {
	filePath := filepath.Join(seedOutputDir, "bad-heap-samples.csv")
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	header := []string{"timestamp", "heap_alloc", "heap_sys"}
	if err := writer.Write(header); err != nil {
		return err
	}

	records := [][]string{
		{"2026-05-05T10:00:00Z", "4194304", "8388608"},
		{"2026-05-05T10:00:01Z", "INVALID", "10485760"},
	}

	for _, rec := range records {
		if err := writer.Write(rec); err != nil {
			return err
		}
	}

	return nil
}
