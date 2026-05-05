package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"go-iface-analyzer/internal/database"
)

const (
	defaultConfigDir     = "."
	interfaceCasesFile   = "interface-cases.yaml"
	callsFile            = "calls.jsonl"
	snippetsDir          = "snippets"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "初始化工作目录，创建必要的文件和目录结构",
	Long: `初始化工作目录，创建 interface-cases.yaml、calls.jsonl 模板文件
和 snippets 目录，并生成 seed 样例数据供学习使用。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return runInit()
	},
}

func init() {
	rootCmd.AddCommand(initCmd)
}

func runInit() error {
	fmt.Println("正在初始化工作目录...")

	if err := createDirectories(); err != nil {
		return fmt.Errorf("创建目录失败: %w", err)
	}

	if err := createInterfaceCasesTemplate(); err != nil {
		return fmt.Errorf("创建 interface-cases.yaml 失败: %w", err)
	}

	if err := createCallsTemplate(); err != nil {
		return fmt.Errorf("创建 calls.jsonl 失败: %w", err)
	}

	if err := createSampleSnippets(); err != nil {
		return fmt.Errorf("创建样例代码片段失败: %w", err)
	}

	db, err := database.New()
	if err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}
	defer db.Close()

	fmt.Println("\n初始化完成！")
	fmt.Println("创建的文件和目录:")
	fmt.Printf("  - %s/\n", snippetsDir)
	fmt.Printf("  - %s\n", interfaceCasesFile)
	fmt.Printf("  - %s\n", callsFile)
	fmt.Printf("  - analysis.db\n")
	fmt.Println("\n下一步:")
	fmt.Println("  1. 编辑 interface-cases.yaml 添加你的分析案例")
	fmt.Println("  2. 在 snippets/ 目录下添加 Go 代码片段")
	fmt.Println("  3. 运行 'go-iface-analyzer analyze' 进行分析")

	return nil
}

func createDirectories() error {
	dirs := []string{snippetsDir}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	return nil
}

func createInterfaceCasesTemplate() error {
	content := `# Go Interface 底层原理分析案例配置
# 此文件定义了需要分析的 interface 相关案例
# 可用的 category:
#   - eface_iface: 空接口与非空接口底层结构分析
#   - itab: 接口表分析
#   - dynamic_type: 动态类型与值分析
#   - method_set: 方法集分析（值/指针接收者）
#   - type_assertion: 类型断言分析
#   - type_switch: type switch 分析
#   - typed_nil: typed nil 分析
#   - allocation: 接口装箱分配风险分析

cases:
  # 案例 1: eface 与 iface 结构
  - name: "empty_interface_struct"
    category: "eface_iface"
    description: "分析空接口 interface{} 的底层结构 eface"
    source_file: "eface_example.go"
    line_number: 10
    tags: ["eface", "interface{}", "底层结构"]

  # 案例 2: itab 接口表
  - name: "itab_cache_analysis"
    category: "itab"
    description: "分析 itab 的缓存机制和类型转换开销"
    source_file: "itab_example.go"
    line_number: 15
    tags: ["itab", "缓存", "类型转换"]

  # 案例 3: 动态类型
  - name: "dynamic_type_check"
    category: "dynamic_type"
    description: "分析接口的动态类型和值"
    source_file: "dynamic_type.go"
    line_number: 20
    tags: ["动态类型", "reflect"]

  # 案例 4: 方法集
  - name: "method_set_comparison"
    category: "method_set"
    description: "比较值接收者和指针接收者的方法集差异"
    source_file: "method_set.go"
    line_number: 5
    tags: ["方法集", "值接收者", "指针接收者"]

  # 案例 5: 类型断言
  - name: "unsafe_type_assertion"
    category: "type_assertion"
    description: "分析不安全的类型断言（无 comma-ok 模式）"
    source_file: "type_assertion.go"
    line_number: 25
    tags: ["类型断言", "panic", "comma-ok"]

  # 案例 6: type switch
  - name: "type_switch_usage"
    category: "type_switch"
    description: "分析 type switch 的使用场景和注意事项"
    source_file: "type_switch.go"
    line_number: 8
    tags: ["type switch", "多类型处理"]

  # 案例 7: typed nil
  - name: "typed_nil_pitfall"
    category: "typed_nil"
    description: "分析 typed nil 的陷阱"
    source_file: "typed_nil.go"
    line_number: 12
    tags: ["typed nil", "nil判断", "陷阱"]

  # 案例 8: 分配风险
  - name: "interface_boxing_allocation"
    category: "allocation"
    description: "分析接口装箱带来的堆分配风险"
    source_file: "allocation.go"
    line_number: 18
    tags: ["装箱", "堆分配", "性能"]
`

	filePath := filepath.Join(defaultConfigDir, interfaceCasesFile)
	if _, err := os.Stat(filePath); err == nil {
		fmt.Printf("  %s 已存在，跳过\n", interfaceCasesFile)
		return nil
	}

	fmt.Printf("  创建 %s\n", interfaceCasesFile)
	return os.WriteFile(filePath, []byte(content), 0644)
}

func createCallsTemplate() error {
	content := `{"timestamp":"2024-01-15T10:30:00Z","operation":"assign","interface":"fmt.Stringer","concrete":"*main.MyType","allocation":true,"method_call":"","source_file":"main.go","line_number":42}
{"timestamp":"2024-01-15T10:30:01Z","operation":"call","interface":"fmt.Stringer","concrete":"*main.MyType","allocation":false,"method_call":"String","source_file":"main.go","line_number":45}
{"timestamp":"2024-01-15T10:30:02Z","operation":"assert","interface":"interface{}","concrete":"string","allocation":false,"method_call":"","source_file":"utils.go","line_number":17}
`

	filePath := filepath.Join(defaultConfigDir, callsFile)
	if _, err := os.Stat(filePath); err == nil {
		fmt.Printf("  %s 已存在，跳过\n", callsFile)
		return nil
	}

	fmt.Printf("  创建 %s\n", callsFile)
	return os.WriteFile(filePath, []byte(content), 0644)
}

func createSampleSnippets() error {
	snippets := map[string]string{
		"eface_example.go": `package main

import "fmt"

type MyStringer struct {
	value string
}

func (m MyStringer) String() string {
	return m.value
}

func main() {
	// eface: 空接口，包含 _type 和 data
	var i interface{} = 42
	fmt.Printf("类型: %T, 值: %v\n", i, i)

	// 将字符串赋给空接口
	i = "hello"
	fmt.Printf("类型: %T, 值: %v\n", i, i)

	// 将结构体赋给空接口
	i = MyStringer{value: "test"}
	fmt.Printf("类型: %T, 值: %v\n", i, i)
}
`,
		"method_set.go": `package main

import "fmt"

type Counter struct {
	count int
}

// 值接收者方法
func (c Counter) Get() int {
	return c.count
}

// 指针接收者方法
func (c *Counter) Increment() {
	c.count++
}

// 接口定义
type Getter interface {
	Get() int
}

type Incrementer interface {
	Increment()
}

func main() {
	// 值类型
	c1 := Counter{count: 0}
	
	// 值类型可以调用值接收者方法
	fmt.Println(c1.Get())
	
	// 值类型可以调用指针接收者方法（Go 自动取址）
	c1.Increment()
	fmt.Println(c1.Get())

	// 接口赋值
	var g Getter = c1      // OK: 值类型实现了 Getter
	fmt.Println(g.Get())

	// var inc Incrementer = c1  // 编译错误！值类型没有实现 Incrementer
	var inc Incrementer = &c1   // OK: 指针类型实现了 Incrementer
	inc.Increment()
	fmt.Println(c1.Get())
}
`,
		"type_assertion.go": `package main

import "fmt"

func main() {
	var i interface{} = "hello"

	// 不安全的类型断言 - 类型不匹配会 panic
	s := i.(string)
	fmt.Println(s)

	// 安全的类型断言 - comma-ok 模式
	if s, ok := i.(string); ok {
		fmt.Println("字符串:", s)
	} else {
		fmt.Println("不是字符串")
	}

	// 类型不匹配的 unsafe 断言会 panic
	// n := i.(int)  // panic: interface conversion: interface {} is string, not int

	// comma-ok 模式不会 panic
	if n, ok := i.(int); ok {
		fmt.Println("数字:", n)
	} else {
		fmt.Println("不是数字，安全返回")
	}
}
`,
		"typed_nil.go": `package main

import "fmt"

type MyInterface interface {
	DoSomething()
}

type MyStruct struct{}

func (m *MyStruct) DoSomething() {
	fmt.Println("Doing something")
}

func returnsNil() MyInterface {
	// 返回 typed nil
	var s *MyStruct = nil
	return s  // 这里返回的不是 nil interface！
}

func returnsRealNil() MyInterface {
	return nil  // 这里返回的是真正的 nil interface
}

func main() {
	// 案例 1: typed nil
	v1 := returnsNil()
	fmt.Printf("v1 == nil: %v\n", v1 == nil)  // false！
	fmt.Printf("v1 type: %T\n", v1)            // *main.MyStruct
	fmt.Printf("v1 value: %v\n", v1)           // <nil>

	// 案例 2: 真正的 nil
	v2 := returnsRealNil()
	fmt.Printf("v2 == nil: %v\n", v2 == nil)  // true
	fmt.Printf("v2 type: %T\n", v2)            // <nil>

	// 如何正确检查
	if v1 != nil {
		fmt.Println("v1 不是 nil interface")
		// 但值可能是 nil
		if s, ok := v1.(*MyStruct); ok && s != nil {
			s.DoSomething()
		} else {
			fmt.Println("但实际值是 nil")
		}
	}
}
`,
		"allocation.go": `package main

import (
	"fmt"
	"runtime"
)

type SmallStruct struct {
	x int
}

type LargeStruct struct {
	a, b, c, d int
}

func (s SmallStruct) String() string {
	return fmt.Sprintf("%d", s.x)
}

func (l LargeStruct) String() string {
	return fmt.Sprintf("%d", l.a)
}

func main() {
	// 打印 GC 信息，帮助观察分配
	runtime.GC()
	var stats runtime.MemStats
	runtime.ReadMemStats(&stats)
	initialHeap := stats.HeapAlloc

	// 基本类型装箱 - 可能分配
	var i interface{} = 42
	_ = i

	// 小结构体装箱
	var s fmt.Stringer = SmallStruct{x: 10}
	_ = s

	// 大结构体装箱 - 更可能分配
	var l fmt.Stringer = LargeStruct{a: 1, b: 2, c: 3, d: 4}
	_ = l

	// 指针装箱 - 通常不额外分配
	smallPtr := &SmallStruct{x: 20}
	var p fmt.Stringer = smallPtr
	_ = p

	runtime.ReadMemStats(&stats)
	fmt.Printf("堆分配增加: %d bytes\n", stats.HeapAlloc-initialHeap)

	// 使用 go build -gcflags='-m' 查看具体的逃逸分析
}
`,
	}

	for name, content := range snippets {
		filePath := filepath.Join(snippetsDir, name)
		if _, err := os.Stat(filePath); err == nil {
			fmt.Printf("  snippets/%s 已存在，跳过\n", name)
			continue
		}
		fmt.Printf("  创建 snippets/%s\n", name)
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			return err
		}
	}

	return nil
}
