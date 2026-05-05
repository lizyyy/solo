package parser

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"go-perf-helper/internal/analyzer"
)

// PprofParser 解析 pprof 格式的性能剖析数据
type PprofParser struct{}

// ParseCPUProfile 解析 CPU 剖析文件（pprof 文本格式）
func (p *PprofParser) ParseCPUProfile(path string) ([]analyzer.CPUProfileSample, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open CPU profile: %w", err)
	}
	defer file.Close()

	return p.parseCPUProfileText(file)
}

// ParseHeapProfile 解析堆内存剖析文件（pprof 文本格式）
func (p *PprofParser) ParseHeapProfile(path string) ([]analyzer.HeapProfileSample, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open heap profile: %w", err)
	}
	defer file.Close()

	return p.parseHeapProfileText(file)
}

// ParseBlockProfile 解析阻塞剖析文件（pprof 文本格式）
func (p *PprofParser) ParseBlockProfile(path string) ([]analyzer.BlockProfileSample, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open block profile: %w", err)
	}
	defer file.Close()

	return p.parseBlockProfileText(file)
}

// ParseMutexProfile 解析锁竞争剖析文件（pprof 文本格式）
func (p *PprofParser) ParseMutexProfile(path string) ([]analyzer.MutexProfileSample, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open mutex profile: %w", err)
	}
	defer file.Close()

	return p.parseMutexProfileText(file)
}

// parseCPUProfileText 解析文本格式的 CPU 剖析
func (p *PprofParser) parseCPUProfileText(r io.Reader) ([]analyzer.CPUProfileSample, error) {
	scanner := bufio.NewScanner(r)
	var samples []analyzer.CPUProfileSample
	var currentStack analyzer.CallStack
	var readingStack bool

	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimSpace(line)

		if line == "" {
			continue
		}

		// 检测是否开始新的调用栈
		if strings.HasPrefix(line, "    ") || strings.HasPrefix(line, "\t") {
			readingStack = true
			frame := p.parseStackFrame(line)
			if frame.Function != "" {
				currentStack.Frames = append(currentStack.Frames, frame)
			}
		} else {
			// 结束当前调用栈，开始新的样本
			if readingStack && len(currentStack.Frames) > 0 {
				// 尝试从行首解析值
				parts := strings.Fields(line)
				if len(parts) >= 1 {
					value, err := strconv.ParseInt(parts[0], 10, 64)
					if err == nil {
						sample := analyzer.CPUProfileSample{
							CallStack: currentStack,
							Value:     value,
						}
						samples = append(samples, sample)
					}
				}
			}
			readingStack = false
			currentStack = analyzer.CallStack{}
		}
	}

	// 处理最后一个样本
	if readingStack && len(currentStack.Frames) > 0 {
		// 如果没有显式的值，使用默认值
		sample := analyzer.CPUProfileSample{
			CallStack: currentStack,
			Value:     1,
		}
		samples = append(samples, sample)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return samples, nil
}

// parseHeapProfileText 解析文本格式的堆内存剖析
func (p *PprofParser) parseHeapProfileText(r io.Reader) ([]analyzer.HeapProfileSample, error) {
	scanner := bufio.NewScanner(r)
	var samples []analyzer.HeapProfileSample
	var currentStack analyzer.CallStack
	var readingStack bool
	var lastSample *analyzer.HeapProfileSample

	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimSpace(line)

		if line == "" {
			continue
		}

		// 检测是否开始新的调用栈
		if strings.HasPrefix(line, "    ") || strings.HasPrefix(line, "\t") {
			readingStack = true
			frame := p.parseStackFrame(line)
			if frame.Function != "" {
				currentStack.Frames = append(currentStack.Frames, frame)
			}
		} else {
			// 结束当前调用栈，开始新的样本
			if readingStack && len(currentStack.Frames) > 0 && lastSample != nil {
				lastSample.CallStack = currentStack
				samples = append(samples, *lastSample)
			}
			
			// 解析新样本的数值
			parts := strings.Fields(line)
			if len(parts) >= 4 {
				// 典型格式：in_use_objects in_use_bytes alloc_objects alloc_bytes
				inUseObjects, _ := strconv.ParseInt(parts[0], 10, 64)
				inUseBytes, _ := strconv.ParseInt(parts[1], 10, 64)
				allocObjects, _ := strconv.ParseInt(parts[2], 10, 64)
				allocBytes, _ := strconv.ParseInt(parts[3], 10, 64)

				lastSample = &analyzer.HeapProfileSample{
					InUseBytes:    inUseBytes,
					InUseObjects:  inUseObjects,
					AllocBytes:    allocBytes,
					AllocObjects:  allocObjects,
				}
			}
			
			readingStack = false
			currentStack = analyzer.CallStack{}
		}
	}

	// 处理最后一个样本
	if readingStack && len(currentStack.Frames) > 0 && lastSample != nil {
		lastSample.CallStack = currentStack
		samples = append(samples, *lastSample)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return samples, nil
}

// parseBlockProfileText 解析文本格式的阻塞剖析
func (p *PprofParser) parseBlockProfileText(r io.Reader) ([]analyzer.BlockProfileSample, error) {
	scanner := bufio.NewScanner(r)
	var samples []analyzer.BlockProfileSample
	var currentStack analyzer.CallStack
	var readingStack bool
	var lastSample *analyzer.BlockProfileSample

	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimSpace(line)

		if line == "" {
			continue
		}

		// 检测是否开始新的调用栈
		if strings.HasPrefix(line, "    ") || strings.HasPrefix(line, "\t") {
			readingStack = true
			frame := p.parseStackFrame(line)
			if frame.Function != "" {
				currentStack.Frames = append(currentStack.Frames, frame)
			}
		} else {
			// 结束当前调用栈，开始新的样本
			if readingStack && len(currentStack.Frames) > 0 && lastSample != nil {
				lastSample.CallStack = currentStack
				samples = append(samples, *lastSample)
			}
			
			// 解析新样本的数值
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				// 典型格式：count nanoseconds
				count, _ := strconv.ParseInt(parts[0], 10, 64)
				nanoseconds, _ := strconv.ParseInt(parts[1], 10, 64)

				lastSample = &analyzer.BlockProfileSample{
					Count:       count,
					Nanoseconds: nanoseconds,
				}
			}
			
			readingStack = false
			currentStack = analyzer.CallStack{}
		}
	}

	// 处理最后一个样本
	if readingStack && len(currentStack.Frames) > 0 && lastSample != nil {
		lastSample.CallStack = currentStack
		samples = append(samples, *lastSample)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return samples, nil
}

// parseMutexProfileText 解析文本格式的锁竞争剖析
func (p *PprofParser) parseMutexProfileText(r io.Reader) ([]analyzer.MutexProfileSample, error) {
	// Mutex 剖析格式与 Block 剖析类似
	blockSamples, err := p.parseBlockProfileText(r)
	if err != nil {
		return nil, err
	}

	// 转换为 Mutex 样本格式
	mutexSamples := make([]analyzer.MutexProfileSample, len(blockSamples))
	for i, bs := range blockSamples {
		mutexSamples[i] = analyzer.MutexProfileSample{
			CallStack:   bs.CallStack,
			Count:       bs.Count,
			Nanoseconds: bs.Nanoseconds,
		}
	}

	return mutexSamples, nil
}

// parseStackFrame 解析调用栈帧
func (p *PprofParser) parseStackFrame(line string) analyzer.StackFrame {
	line = strings.TrimSpace(line)

	// 典型格式：function (file:line)
	// 或者：function
	// 或者：runtime.main (proc.go:250)
	
	// 尝试提取文件名和行号
	var function, file string
	var lineNum int

	// 查找括号中的内容
	if idx := strings.Index(line, "("); idx != -1 {
		function = strings.TrimSpace(line[:idx])
		rest := line[idx+1:]
		if idx2 := strings.Index(rest, ")"); idx2 != -1 {
			filePart := rest[:idx2]
			// 解析 file:line
			if colonIdx := strings.LastIndex(filePart, ":"); colonIdx != -1 {
				file = strings.TrimSpace(filePart[:colonIdx])
				lineNumStr := strings.TrimSpace(filePart[colonIdx+1:])
				if num, err := strconv.Atoi(lineNumStr); err == nil {
					lineNum = num
				}
			} else {
				file = filePart
			}
		}
	} else {
		// 没有括号，整个行就是函数名
		function = line
	}

	return analyzer.StackFrame{
		Function: function,
		File:     file,
		Line:     lineNum,
	}
}
