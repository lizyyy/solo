package errors

import (
	"fmt"
	"os"
)

type GCTraceFormatError struct {
	LineNumber int
	Line       string
	Expected   string
	Actual     string
}

func (e *GCTraceFormatError) Error() string {
	return fmt.Sprintf("gctrace.log 格式错误 (第 %d 行)\n  期望格式: %s\n  实际内容: %s",
		e.LineNumber, e.Expected, e.Line)
}

type CSVFormatError struct {
	LineNumber   int
	FieldName    string
	ExpectedType string
	ActualValue  string
}

func (e *CSVFormatError) Error() string {
	return fmt.Sprintf("heap-samples.csv 格式错误 (第 %d 行)\n  字段 '%s' 期望类型: %s\n  实际值: %s",
		e.LineNumber, e.FieldName, e.ExpectedType, e.ActualValue)
}

type CSVHeaderError struct {
	MissingFields []string
}

func (e *CSVHeaderError) Error() string {
	return fmt.Sprintf("heap-samples.csv 表头错误\n  缺少必需字段: %v\n\n  正确的表头应包含: timestamp, heap_alloc, heap_sys, heap_inuse, heap_idle, heap_objects",
		e.MissingFields)
}

type JSONLFormatError struct {
	LineNumber int
	Line       string
	ParseError string
}

func (e *JSONLFormatError) Error() string {
	return fmt.Sprintf("alloc-events.jsonl 格式错误 (第 %d 行)\n  解析错误: %s\n  行内容: %s",
		e.LineNumber, e.ParseError, e.Line)
}

type FileError struct {
	Path   string
	Action string
	Err    error
}

func (e *FileError) Error() string {
	return fmt.Sprintf("文件操作失败\n  路径: %s\n  操作: %s\n  错误: %v",
		e.Path, e.Action, e.Err)
}

type ParseError interface {
	LineNum() int
	LineContent() string
	ErrorMessage() string
}

func FormatParseError(err error) string {
	switch e := err.(type) {
	case interface {
		LineNum() int
		LineContent() string
		ErrorMessage() string
	}:
		return fmt.Sprintf(`
分析数据格式错误！
═══════════════════════════════════════════════

错误位置: 第 %d 行
错误信息: %s
行内容: %s

提示:
  - 请检查输入文件的格式是否正确
  - 参考 examples/ 目录下的样例文件

═══════════════════════════════════════════════
`, e.LineNum(), e.ErrorMessage(), e.LineContent())

	case *GCTraceFormatError:
		return fmt.Sprintf(`
GC 跟踪日志格式错误！
═══════════════════════════════════════════════

错误位置: 第 %d 行
期望格式: %s
实际内容: %s

提示:
  - Go GC 跟踪日志的标准格式为:
    gc # @#s #%%: #+#+# ms clock, #+#/#+#/#+# ms cpu, #->#-># MB, # MB goal, # P
  - 正确的样例:
    gc 1 @0.001s 0%%: 0.010+0.48+0.005 ms clock, 0.020+0/0.30/0.25+0.010 ms cpu, 4->4->2 MB, 5 MB goal, 4 P

  - 要生成 GC 跟踪日志，请在运行 Go 程序时设置:
    GODEBUG=gctrace=1 ./your-program > gctrace.log

═══════════════════════════════════════════════
`, e.LineNumber, e.Expected, e.Actual)

	case *CSVFormatError:
		return fmt.Sprintf(`
堆采样 CSV 格式错误！
═══════════════════════════════════════════════

错误位置: 第 %d 行
字段名称: %s
期望类型: %s
实际值:   %s

提示:
  - heap-samples.csv 的各字段类型:
    * timestamp: 时间戳 (RFC3339 格式或 Unix 时间戳)
    * heap_alloc: 整数 (字节数)
    * heap_sys: 整数 (字节数)
    * heap_inuse: 整数 (字节数)
    * heap_idle: 整数 (字节数)
    * heap_objects: 整数 (对象数量)

═══════════════════════════════════════════════
`, e.LineNumber, e.FieldName, e.ExpectedType, e.ActualValue)

	case *CSVHeaderError:
		return fmt.Sprintf(`
CSV 表头错误！
═══════════════════════════════════════════════

缺少必需字段: %v

正确的表头格式应包含以下字段:
  timestamp, heap_alloc, heap_sys, heap_inuse, heap_idle, heap_released, 
  heap_objects, mallocs, frees, next_gc, last_gc, num_gc, num_forced_gc, gc_cpu_fraction

参考样例 (examples/heap-samples.csv):
  timestamp,heap_alloc,heap_sys,heap_inuse,heap_idle,heap_released,heap_objects,mallocs,frees,next_gc,last_gc,num_gc,num_forced_gc,gc_cpu_fraction
  2026-05-05T10:00:00Z,4194304,8388608,4194304,4194304,0,1024,2048,1024,5242880,0,0,0,0.00

═══════════════════════════════════════════════
`, e.MissingFields)

	case *JSONLFormatError:
		return fmt.Sprintf(`
分配事件 JSONL 格式错误！
═══════════════════════════════════════════════

错误位置: 第 %d 行
解析错误: %s
行内容:   %s

提示:
  - alloc-events.jsonl 每行应为一个有效的 JSON 对象
  - 必需字段: timestamp, type, size
  - 可选字段: address, stack, goroutine

  正确的样例:
    {"timestamp":"2026-05-05T10:00:00.001Z","type":"alloc","size":8192,"address":140737488355328,"stack":"runtime.allocm\nmain.main","goroutine":1}

═══════════════════════════════════════════════
`, e.LineNumber, e.ParseError, e.Line)

	case *FileError:
		actionDesc := map[string]string{
			"read":   "读取",
			"open":   "打开",
			"write":  "写入",
			"create": "创建",
		}
		action := actionDesc[e.Action]
		if action == "" {
			action = e.Action
		}

		if os.IsNotExist(e.Err) {
			return fmt.Sprintf(`
文件不存在！
═══════════════════════════════════════════════

路径: %s
操作: %s

提示:
  - 请检查文件路径是否正确
  - 确认文件是否存在
  - 检查当前工作目录

═══════════════════════════════════════════════
`, e.Path, action)
		}

		if os.IsPermission(e.Err) {
			return fmt.Sprintf(`
文件权限错误！
═══════════════════════════════════════════════

路径: %s
操作: %s

提示:
  - 请检查文件权限
  - 当前用户是否有足够权限访问该文件

═══════════════════════════════════════════════
`, e.Path, action)
		}

		return fmt.Sprintf(`
文件操作错误！
═══════════════════════════════════════════════

路径: %s
操作: %s
错误: %v

═══════════════════════════════════════════════
`, e.Path, action, e.Err)

	default:
		return fmt.Sprintf(`
错误！
═══════════════════════════════════════════════

%v

═══════════════════════════════════════════════
`, err)
	}
}
