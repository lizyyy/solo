package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "初始化工作目录并生成样例数据",
	Long: `init 命令会在当前目录初始化 Go Runtime Analyzer 的工作环境，
并生成一些样例数据文件，帮助你快速了解工具的使用方法。`,
	Run: func(cmd *cobra.Command, args []string) {
		runInit()
	},
}

func init() {
	rootCmd.AddCommand(initCmd)
}

func runInit() {
	// 检查当前目录是否已初始化
	if isInitialized() {
		fmt.Println("警告: 当前目录已初始化。将覆盖现有配置和样例数据。")
	}

	// 创建必要的目录结构
	dirs := []string{
		"data",
		"data/stacktraces",
		"data/schedtraces",
		"data/preempt_events",
		"data/snippets",
		"data/benchmarks",
		"reports",
	}

	for _, dir := range dirs {
		err := os.MkdirAll(dir, 0755)
		if err != nil {
			fmt.Printf("错误: 创建目录 %s 失败: %v\n", dir, err)
			os.Exit(1)
		}
	}

	// 创建配置文件
	config := `[database]
path = "gra.db"

[analysis]
default_stack_threshold = 1024  # KB
default_latency_threshold = 100  # us
`

	err := os.WriteFile("gra.conf", []byte(config), 0644)
	if err != nil {
		fmt.Printf("错误: 创建配置文件失败: %v\n", err)
		os.Exit(1)
	}

	// 生成样例数据
	generateSampleData()

	fmt.Println("初始化完成！")
	fmt.Println("\n目录结构:")
	fmt.Println("  data/          - 数据文件目录")
	fmt.Println("    stacktraces/   - goroutine stacktrace 文件")
	fmt.Println("    schedtraces/   - schedtrace 输出文件")
	fmt.Println("    preempt_events/- 抢占事件日志")
	fmt.Println("    snippets/      - 代码片段")
	fmt.Println("    benchmarks/    - benchmark 结果")
	fmt.Println("  reports/       - 分析报告输出目录")
	fmt.Println("  gra.conf       - 配置文件")
	fmt.Println("\n使用示例:")
	fmt.Println("  gra import -t stacktrace data/stacktraces/sample1.txt")
	fmt.Println("  gra analyze")
	fmt.Println("  gra export -o reports/analysis.md")
}

func isInitialized() bool {
	_, err := os.Stat("gra.db")
	return err == nil
}

func generateSampleData() {
	// 样例 stacktrace
	stacktraceSample := `goroutine 1 [running]:
main.heavyFunction(0x1, 0x2)
	/Users/user/project/main.go:42 +0x30
main.main()
	/Users/user/project/main.go:18 +0x50

goroutine 5 [syscall, 10 minutes]:
syscall.Syscall(0x1, 0x2, 0x3, 0x4)
	/usr/local/go/src/syscall/asm_darwin_amd64.s:20 +0x10
os.file.write(...)
	/usr/local/go/src/os/file_unix.go:268
os.(*File).Write(0xc000010010, {0xc000016000, 0x400, 0x400})
	/usr/local/go/src/os/file.go:174 +0x6e
main.logWriter(0xc000010020)
	/Users/user/project/main.go:85 +0x45
created by main.main in goroutine 1
	/Users/user/project/main.go:15 +0x3a

goroutine 7 [chan receive]:
main.worker(0xc000014000)
	/Users/user/project/main.go:100 +0x85
created by main.main in goroutine 1
	/Users/user/project/main.go:12 +0x25
`

	os.WriteFile(filepath.Join("data", "stacktraces", "sample1.txt"), []byte(stacktraceSample), 0644)

	// 样例 schedtrace
	schedtraceSample := `SCHED 1000ms: gomaxprocs=2 idleprocs=1 threads=5 spinningthreads=0 idlethreads=2 runqueue=0 [0 0]
[0]: RUNNING goroutine 5: runtime.sysmon (10/2/0)
[1]: RUNNABLE goroutine 12: main.worker (0/1/0)
  M P  ID  TICK  STATUS  GOMAXPROCS  THREADS  IDLEPROCS  RUNQ  LATENCY
  0  0   5  1000  running           2        5          1     0  500us
  1  -   1  1000  idle              2        5          1     0  0us
  0  -   7  1000  waiting           2        5          1     0  200us
  0  -   3  1000  syscall           2        5          1     0  1500us
`

	os.WriteFile(filepath.Join("data", "schedtraces", "sample1.txt"), []byte(schedtraceSample), 0644)

	// 样例 preempt events
	preemptSample := `timestamp=1699999999.123456, goroutine=12, type=async_preempt, reason=long_running, duration=1500us, pc=0x45a8b0
timestamp=1699999999.234567, goroutine=5, type=stack_growth, old_size=2048, new_size=4096, duration=250us
timestamp=1699999999.345678, goroutine=3, type=nosplit_call, function=runtime.memmove, frames=3, duration=100us
timestamp=1699999999.456789, goroutine=7, type=syscall_block, syscall=write, duration=3000us
`

	os.WriteFile(filepath.Join("data", "preempt_events", "sample1.txt"), []byte(preemptSample), 0644)

	// 样例 benchmark
	benchSample := `goos: darwin
goarch: amd64
pkg: github.com/example/project
cpu: Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz
BenchmarkHeavyFunction-12            100          12543210 ns/op          2048 B/op          5 allocs/op
BenchmarkWorker-12                   500           2345678 ns/op          1024 B/op          3 allocs/op
PASS
ok      github.com/example/project  3.123s
`

	os.WriteFile(filepath.Join("data", "benchmarks", "sample1.txt"), []byte(benchSample), 0644)

	// 样例代码片段
	snippetSample := `// 潜在问题：长循环缺少抢占点
func processLargeDataset(data []int) {
	for i := 0; i < len(data); i++ {
		// 密集计算，没有函数调用，无法被抢占
		data[i] = data[i] * 2
		if data[i] > 1000 {
			data[i] = data[i] / 2
		}
	}
}

// 潜在问题：nosplit 调用链
//go:nosplit
func fastHash(data []byte) uint64 {
	// 快速哈希计算，标记为 nosplit
	// 但如果调用链很长，可能导致栈溢出或延迟
	h := uint64(17)
	for _, b := range data {
		h = h*31 + uint64(b)
	}
	return h
}

// 潜在问题：syscall 阻塞
func writeLog(file *os.File, message string) {
	// 这个写操作可能阻塞很长时间
	// 特别是在网络文件系统或慢速磁盘上
	_, err := file.WriteString(message + "\n")
	if err != nil {
		log.Println("写入失败:", err)
	}
}
`

	os.WriteFile(filepath.Join("data", "snippets", "sample1.go"), []byte(snippetSample), 0644)

	fmt.Println("样例数据已生成到 data/ 目录")
}
