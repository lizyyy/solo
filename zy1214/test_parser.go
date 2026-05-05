package main

import (
	"fmt"
	"os"
	"regexp"
)

var (
	// Vmstat
	vmstatHeader   = regexp.MustCompile(`^\s*procs`)
	vmstatHeader2  = regexp.MustCompile(`^\s*r\s+b\s+swpd`)
	vmstatDataLine = regexp.MustCompile(`^\s*\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+`)

	// Iostat
	iostatDeviceHeader = regexp.MustCompile(`^Device\s+`)
	iostatLinuxHeader  = regexp.MustCompile(`Linux.*\d+\.\d+\.\d+`)
	iostatAvgCPU       = regexp.MustCompile(`^avg-cpu:`)

	// Ss
	ssHeader = regexp.MustCompile(`^Netid\s+`)
	ssLine   = regexp.MustCompile(`^(\w+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s*(.*)$`)

	// Strace
	straceLineWithPID    = regexp.MustCompile(`^(\d+)\s+([\d.]+)\s+(\S+)\(([^)]*)\)\s*=\s*(-?\d+)\s*<([\d.]+)>$`)
	straceLineSimple     = regexp.MustCompile(`^(\S+)\(([^)]*)\)\s*=\s*(-?\d+)\s*<([\d.]+)>$`)
	straceError          = regexp.MustCompile(`^(\d+)\s+([\d.]+)\s+(\S+)\(([^)]*)\)\s*=\s*-1\s+(\w+)\s+\(([^)]+)\)\s*<([\d.]+)>$`)
	straceLineWithPIDOld = regexp.MustCompile(`^(\d+)\s+(\S+)\(([^)]*)\)\s*=\s*(-?\d+)\s*<([\d.]+)>$`)
	straceErrorOld       = regexp.MustCompile(`^(\d+)\s+(\S+)\(([^)]*)\)\s*=\s*-1\s+(\w+)\s+\(([^)]+)\)\s*<([\d.]+)>$`)

	// Perf script
	perfScriptHeader = regexp.MustCompile(`^(\S+)\s+(\d+)\s+\[\d+\]\s+([\d.]+):\s+(\S+):`)

	// Folded stack
	foldedStackLine = regexp.MustCompile(`^([^;]+(?:;[^;]+)*)\s+(\d+)$`)
)

func testFile(filePath string) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		fmt.Printf("Error reading %s: %v\n", filePath, err)
		return
	}

	lines := splitLines(string(content), 20)
	fmt.Printf("\n=== Testing: %s ===\n", filePath)

	// Test vmstat
	fmt.Printf("\nVmstat tests:\n")
	for i, line := range lines {
		if vmstatHeader.MatchString(line) {
			fmt.Printf("  Line %d: matches vmstatHeader\n", i+1)
		}
		if vmstatHeader2.MatchString(line) {
			fmt.Printf("  Line %d: matches vmstatHeader2\n", i+1)
		}
		if vmstatDataLine.MatchString(line) {
			fmt.Printf("  Line %d: matches vmstatDataLine\n", i+1)
		}
	}

	// Test iostat
	fmt.Printf("\nIostat tests:\n")
	for i, line := range lines {
		if iostatDeviceHeader.MatchString(line) {
			fmt.Printf("  Line %d: matches iostatDeviceHeader\n", i+1)
		}
		if iostatLinuxHeader.MatchString(line) {
			fmt.Printf("  Line %d: matches iostatLinuxHeader\n", i+1)
		}
		if iostatAvgCPU.MatchString(line) {
			fmt.Printf("  Line %d: matches iostatAvgCPU\n", i+1)
		}
	}

	// Test ss
	fmt.Printf("\nSs tests:\n")
	for i, line := range lines {
		if ssHeader.MatchString(line) {
			fmt.Printf("  Line %d: matches ssHeader\n", i+1)
		}
		if ssLine.MatchString(line) {
			fmt.Printf("  Line %d: matches ssLine\n", i+1)
		}
	}

	// Test strace
	fmt.Printf("\nStrace tests:\n")
	for i, line := range lines {
		if straceLineWithPID.MatchString(line) {
			fmt.Printf("  Line %d: matches straceLineWithPID\n", i+1)
		}
		if straceLineWithPIDOld.MatchString(line) {
			fmt.Printf("  Line %d: matches straceLineWithPIDOld\n", i+1)
		}
		if straceLineSimple.MatchString(line) {
			fmt.Printf("  Line %d: matches straceLineSimple\n", i+1)
		}
		if straceError.MatchString(line) {
			fmt.Printf("  Line %d: matches straceError\n", i+1)
		}
		if straceErrorOld.MatchString(line) {
			fmt.Printf("  Line %d: matches straceErrorOld\n", i+1)
		}
	}

	// Test perf script
	fmt.Printf("\nPerf script tests:\n")
	for i, line := range lines {
		if perfScriptHeader.MatchString(line) {
			fmt.Printf("  Line %d: matches perfScriptHeader\n", i+1)
		}
	}

	// Test folded stack
	fmt.Printf("\nFolded stack tests:\n")
	for i, line := range lines {
		if foldedStackLine.MatchString(line) {
			fmt.Printf("  Line %d: matches foldedStackLine\n", i+1)
		}
	}
}

func splitLines(content string, maxLines int) []string {
	lines := []string{}
	for i, line := range splitByNewline(content) {
		lines = append(lines, line)
		if i+1 >= maxLines {
			break
		}
	}
	return lines
}

func splitByNewline(content string) []string {
	lines := []string{}
	start := 0
	for i := 0; i < len(content); i++ {
		if content[i] == '\n' {
			lines = append(lines, content[start:i])
			start = i + 1
		}
	}
	if start < len(content) {
		lines = append(lines, content[start:])
	}
	return lines
}

func main() {
	testFiles := []string{
		"./test-abnormal/vmstat.txt",
		"./test-abnormal/iostat.txt",
		"./test-abnormal/ss.txt",
		"./test-abnormal/strace.txt",
		"./test-abnormal/perf_script.txt",
		"./test-abnormal/folded.txt",
	}

	for _, file := range testFiles {
		testFile(file)
	}
}
