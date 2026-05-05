package parser

import (
	"bufio"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/zy1214/pefa/pkg/evidence"
)

type TopParser struct {
	BaseParser
}

func NewTopParser() *TopParser {
	return &TopParser{
		BaseParser: BaseParser{evidenceType: evidence.TypeTop},
	}
}

var (
	topLoadAvgRegex  = regexp.MustCompile(`load average:\s*([\d.]+),?\s*([\d.]+),?\s*([\d.]+)`)
	topMemTotalRegex = regexp.MustCompile(`MiB Mem\s*:\s*([\d.]+)\s+total,\s*([\d.]+)\s+free,\s*([\d.]+)\s+used,\s*([\d.]+)\s+buff/cache`)
	topSwapRegex     = regexp.MustCompile(`MiB Swap\s*:\s*([\d.]+)\s+total,\s*([\d.]+)\s+free,\s*([\d.]+)\s+used`)
	topCPURegex      = regexp.MustCompile(`%Cpu\(s\):\s*([\d.]+)\s+us,\s*([\d.]+)\s+sy,\s*([\d.]+)\s+ni,\s*([\d.]+)\s+id,\s*([\d.]+)\s+wa,\s*([\d.]+)\s+hi,\s*([\d.]+)\s+si,\s*([\d.]+)\s+st`)
	topProcHeader    = regexp.MustCompile(`^\s*PID\s+USER\s+PR\s+NI`)
	topProcLine      = regexp.MustCompile(`^\s*(\d+)\s+(\S+)\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(\S+)\s+(.*)$`)
)

func (p *TopParser) Detect(content string) bool {
	lines := strings.SplitN(content, "\n", 50)
	for _, line := range lines {
		if topLoadAvgRegex.MatchString(line) {
			return true
		}
		if topCPURegex.MatchString(line) {
			return true
		}
		if strings.Contains(line, "top - ") {
			return true
		}
	}
	return false
}

func (p *TopParser) Parse(content string) (evidence.Evidence, error) {
	scanner := bufio.NewScanner(strings.NewReader(content))

	var startTime, endTime time.Time
	var samples []struct {
		Timestamp time.Time
		CPUSample evidence.CPUSample
		Processes []evidence.ProcessSample
		LoadAvg   [3]float64
		TotalMem  uint64
		FreeMem   uint64
		UsedMem   uint64
		BuffMem   uint64
		CacheMem  uint64
		TotalSwap uint64
		FreeSwap  uint64
		UsedSwap  uint64
	}

	var currentSample struct {
		Timestamp time.Time
		CPUSample evidence.CPUSample
		Processes []evidence.ProcessSample
		LoadAvg   [3]float64
		TotalMem  uint64
		FreeMem   uint64
		UsedMem   uint64
		BuffMem   uint64
		CacheMem  uint64
		TotalSwap uint64
		FreeSwap  uint64
		UsedSwap  uint64
	}

	inProcessSection := false
	sampleIndex := 0
	baseTime := time.Now()

	for scanner.Scan() {
		line := scanner.Text()

		if strings.Contains(line, "top - ") {
			if sampleIndex > 0 {
				samples = append(samples, currentSample)
			}
			currentSample = struct {
				Timestamp time.Time
				CPUSample evidence.CPUSample
				Processes []evidence.ProcessSample
				LoadAvg   [3]float64
				TotalMem  uint64
				FreeMem   uint64
				UsedMem   uint64
				BuffMem   uint64
				CacheMem  uint64
				TotalSwap uint64
				FreeSwap  uint64
				UsedSwap  uint64
			}{}
			inProcessSection = false
			sampleIndex++

			currentSample.Timestamp = baseTime.Add(time.Duration(sampleIndex-1) * time.Second)
			if sampleIndex == 1 {
				startTime = currentSample.Timestamp
			}
			endTime = currentSample.Timestamp

			if matches := topLoadAvgRegex.FindStringSubmatch(line); matches != nil {
				currentSample.LoadAvg[0], _ = strconv.ParseFloat(matches[1], 64)
				currentSample.LoadAvg[1], _ = strconv.ParseFloat(matches[2], 64)
				currentSample.LoadAvg[2], _ = strconv.ParseFloat(matches[3], 64)
			}
			continue
		}

		if matches := topCPURegex.FindStringSubmatch(line); matches != nil {
			currentSample.CPUSample.User, _ = strconv.ParseFloat(matches[1], 64)
			currentSample.CPUSample.System, _ = strconv.ParseFloat(matches[2], 64)
			currentSample.CPUSample.Nice, _ = strconv.ParseFloat(matches[3], 64)
			currentSample.CPUSample.Idle, _ = strconv.ParseFloat(matches[4], 64)
			currentSample.CPUSample.IOWait, _ = strconv.ParseFloat(matches[5], 64)
			currentSample.CPUSample.IRQ, _ = strconv.ParseFloat(matches[6], 64)
			currentSample.CPUSample.SoftIRQ, _ = strconv.ParseFloat(matches[7], 64)
			currentSample.CPUSample.Steal, _ = strconv.ParseFloat(matches[8], 64)
			currentSample.CPUSample.Timestamp = currentSample.Timestamp
			continue
		}

		if matches := topMemTotalRegex.FindStringSubmatch(line); matches != nil {
			total, _ := strconv.ParseFloat(matches[1], 64)
			free, _ := strconv.ParseFloat(matches[2], 64)
			used, _ := strconv.ParseFloat(matches[3], 64)
			buffCache, _ := strconv.ParseFloat(matches[4], 64)
			currentSample.TotalMem = uint64(total * 1024 * 1024)
			currentSample.FreeMem = uint64(free * 1024 * 1024)
			currentSample.UsedMem = uint64(used * 1024 * 1024)
			currentSample.BuffMem = uint64(buffCache * 1024 * 1024 / 2)
			currentSample.CacheMem = uint64(buffCache * 1024 * 1024 / 2)
			continue
		}

		if matches := topSwapRegex.FindStringSubmatch(line); matches != nil {
			total, _ := strconv.ParseFloat(matches[1], 64)
			free, _ := strconv.ParseFloat(matches[2], 64)
			used, _ := strconv.ParseFloat(matches[3], 64)
			currentSample.TotalSwap = uint64(total * 1024 * 1024)
			currentSample.FreeSwap = uint64(free * 1024 * 1024)
			currentSample.UsedSwap = uint64(used * 1024 * 1024)
			continue
		}

		if topProcHeader.MatchString(line) {
			inProcessSection = true
			continue
		}

		if inProcessSection && strings.TrimSpace(line) != "" {
			if matches := topProcLine.FindStringSubmatch(line); matches != nil {
				pid, _ := strconv.Atoi(matches[1])
				cpuPct, _ := strconv.ParseFloat(matches[9], 64)
				memPct, _ := strconv.ParseFloat(matches[10], 64)
				virt, _ := strconv.ParseUint(matches[5], 10, 64)
				res, _ := strconv.ParseUint(matches[6], 10, 64)
				shr, _ := strconv.ParseUint(matches[7], 10, 64)

				currentSample.Processes = append(currentSample.Processes, evidence.ProcessSample{
					PID:        pid,
					User:       matches[2],
					CPUPercent: cpuPct,
					MemPercent: memPct,
					Virt:       virt,
					Res:        res,
					SHR:        shr,
					Status:     matches[8],
					Time:       matches[11],
					Command:    matches[13],
				})
			}
		}
	}

	if sampleIndex > 0 {
		samples = append(samples, currentSample)
	}

	evidence := &evidence.TopEvidence{
		BaseEvidence: evidence.BaseEvidence{
			EvidenceType: evidence.TypeTop,
			StartTime:    startTime,
			EndTime:      endTime,
			SampleCount:  len(samples),
			Metadata: map[string]string{
				"format":     "top",
				"samplerate": "1s",
			},
			RawContent: content,
		},
		Samples: samples,
	}

	return evidence, nil
}

type VmstatParser struct {
	BaseParser
}

func NewVmstatParser() *VmstatParser {
	return &VmstatParser{
		BaseParser: BaseParser{evidenceType: evidence.TypeVmstat},
	}
}

var (
	vmstatHeader   = regexp.MustCompile(`^\s*procs`)
	vmstatHeader2  = regexp.MustCompile(`^\s*r\s+b\s+swpd`)
	vmstatDataLine = regexp.MustCompile(`^\s*\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+`)
)

func (p *VmstatParser) Detect(content string) bool {
	lines := strings.SplitN(content, "\n", 20)
	headerCount := 0
	dataCount := 0
	for _, line := range lines {
		if vmstatHeader.MatchString(line) {
			headerCount++
		}
		if vmstatHeader2.MatchString(line) {
			headerCount++
		}
		if vmstatDataLine.MatchString(line) {
			dataCount++
		}
	}
	return headerCount >= 1 && dataCount >= 1
}

func (p *VmstatParser) Parse(content string) (evidence.Evidence, error) {
	scanner := bufio.NewScanner(strings.NewReader(content))

	var samples []evidence.VmstatSample
	baseTime := time.Now()
	lineNum := 0

	for scanner.Scan() {
		line := scanner.Text()
		lineNum++

		if vmstatHeader.MatchString(line) || vmstatHeader2.MatchString(line) {
			continue
		}

		if strings.TrimSpace(line) == "" {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 17 {
			continue
		}

		r, _ := strconv.Atoi(fields[0])
		b, _ := strconv.Atoi(fields[1])
		swpd, _ := strconv.ParseUint(fields[2], 10, 64)
		free, _ := strconv.ParseUint(fields[3], 10, 64)
		buff, _ := strconv.ParseUint(fields[4], 10, 64)
		cache, _ := strconv.ParseUint(fields[5], 10, 64)
		si, _ := strconv.ParseUint(fields[6], 10, 64)
		so, _ := strconv.ParseUint(fields[7], 10, 64)
		bi, _ := strconv.ParseUint(fields[8], 10, 64)
		bo, _ := strconv.ParseUint(fields[9], 10, 64)
		in, _ := strconv.ParseUint(fields[10], 10, 64)
		cs, _ := strconv.ParseUint(fields[11], 10, 64)
		us, _ := strconv.ParseFloat(fields[12], 64)
		sy, _ := strconv.ParseFloat(fields[13], 64)
		id, _ := strconv.ParseFloat(fields[14], 64)
		wa, _ := strconv.ParseFloat(fields[15], 64)
		st, _ := strconv.ParseFloat(fields[16], 64)

		samples = append(samples, evidence.VmstatSample{
			Timestamp: baseTime.Add(time.Duration(len(samples)) * time.Second),
			R:         r,
			B:         b,
			Swpd:      swpd,
			Free:      free,
			Buff:      buff,
			Cache:     cache,
			Si:        si,
			So:        so,
			Bi:        bi,
			Bo:        bo,
			In:        in,
			Cs:        cs,
			Us:        us,
			Sy:        sy,
			Id:        id,
			Wa:        wa,
			St:        st,
		})
	}

	if len(samples) == 0 {
		return nil, &evidence.ParseError{
			EvidenceType: evidence.TypeVmstat,
			ErrorType:    evidence.ErrIncompleteData,
			Message:      "No valid vmstat samples found",
			Suggestion:   "Ensure the file contains vmstat output with numeric data rows",
		}
	}

	ev := &evidence.VmstatEvidence{
		BaseEvidence: evidence.BaseEvidence{
			EvidenceType: evidence.TypeVmstat,
			StartTime:    samples[0].Timestamp,
			EndTime:      samples[len(samples)-1].Timestamp,
			SampleCount:  len(samples),
			Metadata: map[string]string{
				"format":     "vmstat",
				"samplerate": "1s",
			},
			RawContent: content,
		},
		Samples: samples,
	}

	return ev, nil
}

type IostatParser struct {
	BaseParser
}

func NewIostatParser() *IostatParser {
	return &IostatParser{
		BaseParser: BaseParser{evidenceType: evidence.TypeIostat},
	}
}

var (
	iostatDeviceHeader = regexp.MustCompile(`^Device\s+`)
	iostatLinuxHeader  = regexp.MustCompile(`Linux.*\d+\.\d+\.\d+`)
	iostatAvgCPU       = regexp.MustCompile(`^avg-cpu:`)
)

func (p *IostatParser) Detect(content string) bool {
	lines := strings.SplitN(content, "\n", 30)
	for _, line := range lines {
		if iostatDeviceHeader.MatchString(line) {
			return true
		}
		if iostatAvgCPU.MatchString(line) {
			return true
		}
		if iostatLinuxHeader.MatchString(line) {
			return true
		}
	}
	return false
}

func (p *IostatParser) Parse(content string) (evidence.Evidence, error) {
	scanner := bufio.NewScanner(strings.NewReader(content))

	var samples []evidence.IostatSample
	baseTime := time.Now()
	currentSample := evidence.IostatSample{
		Timestamp: baseTime,
	}

	inDeviceSection := false

	for scanner.Scan() {
		line := scanner.Text()

		if iostatLinuxHeader.MatchString(line) {
			if len(currentSample.Devices) > 0 || currentSample.AvgCPU.User > 0 {
				samples = append(samples, currentSample)
			}
			currentSample = evidence.IostatSample{
				Timestamp: baseTime.Add(time.Duration(len(samples)) * time.Second),
			}
			inDeviceSection = false
			continue
		}

		if iostatAvgCPU.MatchString(line) {
			fields := strings.Fields(line)
			if len(fields) >= 8 {
				currentSample.AvgCPU.User, _ = strconv.ParseFloat(fields[1], 64)
				currentSample.AvgCPU.Nice, _ = strconv.ParseFloat(fields[2], 64)
				currentSample.AvgCPU.System, _ = strconv.ParseFloat(fields[3], 64)
				currentSample.AvgCPU.IOWait, _ = strconv.ParseFloat(fields[4], 64)
				currentSample.AvgCPU.Steal, _ = strconv.ParseFloat(fields[5], 64)
				currentSample.AvgCPU.Idle, _ = strconv.ParseFloat(fields[6], 64)
			}
			continue
		}

		if iostatDeviceHeader.MatchString(line) {
			inDeviceSection = true
			continue
		}

		if inDeviceSection && strings.TrimSpace(line) != "" {
			fields := strings.Fields(line)
			if len(fields) >= 14 {
				device := evidence.IODeviceSample{
					Device:    fields[0],
					RRQM:      parseFloatSafe(fields[1]),
					WRQM:      parseFloatSafe(fields[2]),
					RSec:      parseFloatSafe(fields[3]),
					WSec:      parseFloatSafe(fields[4]),
					RAwait:    parseFloatSafe(fields[5]),
					WAwait:    parseFloatSafe(fields[6]),
					Await:     parseFloatSafe(fields[7]),
					SVCTM:     parseFloatSafe(fields[8]),
					Util:      parseFloatSafe(fields[9]),
					ReadIOPS:  parseFloatSafe(fields[2]),
					WriteIOPS: parseFloatSafe(fields[3]),
				}
				currentSample.Devices = append(currentSample.Devices, device)
			}
		}
	}

	if len(currentSample.Devices) > 0 || currentSample.AvgCPU.User > 0 {
		samples = append(samples, currentSample)
	}

	if len(samples) == 0 {
		return nil, &evidence.ParseError{
			EvidenceType: evidence.TypeIostat,
			ErrorType:    evidence.ErrIncompleteData,
			Message:      "No valid iostat samples found",
			Suggestion:   "Ensure the file contains iostat output with device statistics",
		}
	}

	ev := &evidence.IostatEvidence{
		BaseEvidence: evidence.BaseEvidence{
			EvidenceType: evidence.TypeIostat,
			StartTime:    samples[0].Timestamp,
			EndTime:      samples[len(samples)-1].Timestamp,
			SampleCount:  len(samples),
			Metadata: map[string]string{
				"format": "iostat",
			},
			RawContent: content,
		},
		Samples: samples,
	}

	return ev, nil
}

func parseFloatSafe(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

type SsParser struct {
	BaseParser
}

func NewSsParser() *SsParser {
	return &SsParser{
		BaseParser: BaseParser{evidenceType: evidence.TypeSs},
	}
}

var (
	ssHeader = regexp.MustCompile(`^Netid\s+`)
	ssLine   = regexp.MustCompile(`^(\w+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s*(.*)$`)
)

func (p *SsParser) Detect(content string) bool {
	lines := strings.SplitN(content, "\n", 20)
	for _, line := range lines {
		if ssHeader.MatchString(line) {
			return true
		}
		if ssLine.MatchString(line) {
			return true
		}
	}
	return false
}

func (p *SsParser) Parse(content string) (evidence.Evidence, error) {
	scanner := bufio.NewScanner(strings.NewReader(content))

	var samples []struct {
		Timestamp   time.Time
		Connections []evidence.NetworkConnection
		Stats       []evidence.NetworkStats
		SocketCount int
		TCPStates   map[string]int
	}
	baseTime := time.Now()

	currentSample := struct {
		Timestamp   time.Time
		Connections []evidence.NetworkConnection
		Stats       []evidence.NetworkStats
		SocketCount int
		TCPStates   map[string]int
	}{
		Timestamp: baseTime,
		TCPStates: make(map[string]int),
	}

	for scanner.Scan() {
		line := scanner.Text()

		if ssHeader.MatchString(line) {
			if len(currentSample.Connections) > 0 {
				samples = append(samples, currentSample)
			}
			currentSample = struct {
				Timestamp   time.Time
				Connections []evidence.NetworkConnection
				Stats       []evidence.NetworkStats
				SocketCount int
				TCPStates   map[string]int
			}{
				Timestamp: baseTime.Add(time.Duration(len(samples)) * time.Second),
				TCPStates: make(map[string]int),
			}
			continue
		}

		if matches := ssLine.FindStringSubmatch(line); matches != nil {
			conn := evidence.NetworkConnection{
				Protocol: matches[1],
				State:    matches[2],
			}

			localAddr, localPort := parseAddrPort(matches[5])
			remoteAddr, remotePort := parseAddrPort(matches[6])

			conn.LocalAddr = localAddr
			conn.LocalPort = localPort
			conn.RemoteAddr = remoteAddr
			conn.RemotePort = remotePort

			if len(matches) > 7 && matches[7] != "" {
				if idx := strings.Index(matches[7], "pid="); idx != -1 {
					rest := matches[7][idx+4:]
					if commaIdx := strings.IndexAny(rest, ",)"); commaIdx != -1 {
						rest = rest[:commaIdx]
					}
					pid, _ := strconv.Atoi(strings.TrimSpace(rest))
					conn.PID = pid
				}
			}

			currentSample.Connections = append(currentSample.Connections, conn)
			currentSample.TCPStates[conn.State]++
			currentSample.SocketCount++
		}
	}

	if len(currentSample.Connections) > 0 {
		samples = append(samples, currentSample)
	}

	if len(samples) == 0 {
		return nil, &evidence.ParseError{
			EvidenceType: evidence.TypeSs,
			ErrorType:    evidence.ErrIncompleteData,
			Message:      "No valid ss samples found",
			Suggestion:   "Ensure the file contains ss output with connection information",
		}
	}

	ev := &evidence.SsEvidence{
		BaseEvidence: evidence.BaseEvidence{
			EvidenceType: evidence.TypeSs,
			StartTime:    samples[0].Timestamp,
			EndTime:      samples[len(samples)-1].Timestamp,
			SampleCount:  len(samples),
			Metadata: map[string]string{
				"format": "ss",
			},
			RawContent: content,
		},
		Samples: samples,
	}

	return ev, nil
}

func parseAddrPort(addr string) (string, int) {
	lastColon := strings.LastIndex(addr, ":")
	if lastColon == -1 {
		return addr, 0
	}
	portStr := addr[lastColon+1:]
	port, _ := strconv.Atoi(portStr)
	return addr[:lastColon], port
}

type StraceParser struct {
	BaseParser
}

func NewStraceParser() *StraceParser {
	return &StraceParser{
		BaseParser: BaseParser{evidenceType: evidence.TypeStrace},
	}
}

var (
	straceLineWithPID    = regexp.MustCompile(`^(\d+)\s+([\d.]+)\s+(\S+)\(([^)]*)\)\s*=\s*(-?\d+)\s*<([\d.]+)>$`)
	straceLineSimple     = regexp.MustCompile(`^(\S+)\(([^)]*)\)\s*=\s*(-?\d+)\s*<([\d.]+)>$`)
	straceError          = regexp.MustCompile(`^(\d+)\s+([\d.]+)\s+(\S+)\(([^)]*)\)\s*=\s*-1\s+(\w+)\s+\(([^)]+)\)\s*<([\d.]+)>$`)
	straceLineWithPIDOld = regexp.MustCompile(`^(\d+)\s+(\S+)\(([^)]*)\)\s*=\s*(-?\d+)\s*<([\d.]+)>$`)
	straceErrorOld       = regexp.MustCompile(`^(\d+)\s+(\S+)\(([^)]*)\)\s*=\s*-1\s+(\w+)\s+\(([^)]+)\)\s*<([\d.]+)>$`)
	foldedStackLine      = regexp.MustCompile(`^([^;]+(?:;[^;]+)*)\s+(\d+)$`)
)

func (p *StraceParser) Detect(content string) bool {
	lines := strings.SplitN(content, "\n", 30)
	for _, line := range lines {
		if straceLineWithPID.MatchString(line) {
			return true
		}
		if straceLineWithPIDOld.MatchString(line) {
			return true
		}
		if straceLineSimple.MatchString(line) {
			return true
		}
		if straceError.MatchString(line) {
			return true
		}
		if straceErrorOld.MatchString(line) {
			return true
		}
		if strings.Contains(line, "+++ exited with") {
			return true
		}
	}
	return false
}

func (p *StraceParser) Parse(content string) (evidence.Evidence, error) {
	scanner := bufio.NewScanner(strings.NewReader(content))

	var events []evidence.SyscallEvent
	baseTime := time.Now()
	syscallStats := make(map[string]struct {
		Count     int
		TotalTime time.Duration
		Errors    int
	})

	var blockedCalls []evidence.SyscallEvent
	var startTime, endTime time.Time

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "+++") || strings.HasPrefix(line, "---") {
			continue
		}

		if matches := straceError.FindStringSubmatch(line); matches != nil {
			pid, _ := strconv.Atoi(matches[1])
			retVal := int64(-1)
			dur, _ := strconv.ParseFloat(matches[7], 64)
			duration := time.Duration(dur * float64(time.Second))

			event := evidence.SyscallEvent{
				Timestamp:   baseTime.Add(time.Duration(len(events)) * time.Microsecond),
				PID:         pid,
				Syscall:     matches[3],
				Arguments:   parseArgs(matches[4]),
				ReturnValue: retVal,
				Duration:    duration,
				IsError:     true,
				Errno:       -1,
				ErrMessage:  matches[6],
			}
			events = append(events, event)

			if duration > 100*time.Millisecond {
				blockedCalls = append(blockedCalls, event)
			}

			stats := syscallStats[event.Syscall]
			stats.Count++
			stats.TotalTime += duration
			stats.Errors++
			syscallStats[event.Syscall] = stats

			if startTime.IsZero() {
				startTime = event.Timestamp
			}
			endTime = event.Timestamp
			continue
		}

		if matches := straceErrorOld.FindStringSubmatch(line); matches != nil {
			pid, _ := strconv.Atoi(matches[1])
			retVal := int64(-1)
			dur, _ := strconv.ParseFloat(matches[6], 64)
			duration := time.Duration(dur * float64(time.Second))

			event := evidence.SyscallEvent{
				Timestamp:   baseTime.Add(time.Duration(len(events)) * time.Microsecond),
				PID:         pid,
				Syscall:     matches[2],
				Arguments:   parseArgs(matches[3]),
				ReturnValue: retVal,
				Duration:    duration,
				IsError:     true,
				Errno:       -1,
				ErrMessage:  matches[5],
			}
			events = append(events, event)

			if duration > 100*time.Millisecond {
				blockedCalls = append(blockedCalls, event)
			}

			stats := syscallStats[event.Syscall]
			stats.Count++
			stats.TotalTime += duration
			stats.Errors++
			syscallStats[event.Syscall] = stats

			if startTime.IsZero() {
				startTime = event.Timestamp
			}
			endTime = event.Timestamp
			continue
		}

		if matches := straceLineWithPID.FindStringSubmatch(line); matches != nil {
			pid, _ := strconv.Atoi(matches[1])
			retVal, _ := strconv.ParseInt(matches[5], 10, 64)
			var duration time.Duration
			if len(matches) > 6 && matches[6] != "" {
				dur, _ := strconv.ParseFloat(matches[6], 64)
				duration = time.Duration(dur * float64(time.Second))
			}

			event := evidence.SyscallEvent{
				Timestamp:   baseTime.Add(time.Duration(len(events)) * time.Microsecond),
				PID:         pid,
				Syscall:     matches[3],
				Arguments:   parseArgs(matches[4]),
				ReturnValue: retVal,
				Duration:    duration,
			}
			events = append(events, event)

			if duration > 100*time.Millisecond {
				blockedCalls = append(blockedCalls, event)
			}

			stats := syscallStats[event.Syscall]
			stats.Count++
			stats.TotalTime += duration
			syscallStats[event.Syscall] = stats

			if startTime.IsZero() {
				startTime = event.Timestamp
			}
			endTime = event.Timestamp
			continue
		}

		if matches := straceLineWithPIDOld.FindStringSubmatch(line); matches != nil {
			pid, _ := strconv.Atoi(matches[1])
			retVal, _ := strconv.ParseInt(matches[4], 10, 64)
			var duration time.Duration
			if len(matches) > 5 && matches[5] != "" {
				dur, _ := strconv.ParseFloat(matches[5], 64)
				duration = time.Duration(dur * float64(time.Second))
			}

			event := evidence.SyscallEvent{
				Timestamp:   baseTime.Add(time.Duration(len(events)) * time.Microsecond),
				PID:         pid,
				Syscall:     matches[2],
				Arguments:   parseArgs(matches[3]),
				ReturnValue: retVal,
				Duration:    duration,
			}
			events = append(events, event)

			if duration > 100*time.Millisecond {
				blockedCalls = append(blockedCalls, event)
			}

			stats := syscallStats[event.Syscall]
			stats.Count++
			stats.TotalTime += duration
			syscallStats[event.Syscall] = stats

			if startTime.IsZero() {
				startTime = event.Timestamp
			}
			endTime = event.Timestamp
			continue
		}

		if matches := straceLineSimple.FindStringSubmatch(line); matches != nil {
			retVal, _ := strconv.ParseInt(matches[3], 10, 64)
			var duration time.Duration
			if len(matches) > 4 && matches[4] != "" {
				dur, _ := strconv.ParseFloat(matches[4], 64)
				duration = time.Duration(dur * float64(time.Second))
			}

			event := evidence.SyscallEvent{
				Timestamp:   baseTime.Add(time.Duration(len(events)) * time.Microsecond),
				Syscall:     matches[1],
				Arguments:   parseArgs(matches[2]),
				ReturnValue: retVal,
				Duration:    duration,
			}
			events = append(events, event)

			if duration > 100*time.Millisecond {
				blockedCalls = append(blockedCalls, event)
			}

			stats := syscallStats[event.Syscall]
			stats.Count++
			stats.TotalTime += duration
			syscallStats[event.Syscall] = stats

			if startTime.IsZero() {
				startTime = event.Timestamp
			}
			endTime = event.Timestamp
		}
	}

	syscallStatsMap := make(map[string]struct {
		Count     int
		TotalTime time.Duration
		AvgTime   time.Duration
		Errors    int
	})

	for syscall, stats := range syscallStats {
		syscallStatsMap[syscall] = struct {
			Count     int
			TotalTime time.Duration
			AvgTime   time.Duration
			Errors    int
		}{
			Count:     stats.Count,
			TotalTime: stats.TotalTime,
			AvgTime:   stats.TotalTime / time.Duration(max(1, stats.Count)),
			Errors:    stats.Errors,
		}
	}

	ev := &evidence.StraceEvidence{
		BaseEvidence: evidence.BaseEvidence{
			EvidenceType: evidence.TypeStrace,
			StartTime:    startTime,
			EndTime:      endTime,
			SampleCount:  len(events),
			Metadata: map[string]string{
				"format":      "strace",
				"total_calls": fmt.Sprintf("%d", len(events)),
			},
			RawContent: content,
		},
		Events:       events,
		SyscallStats: syscallStatsMap,
		BlockedCalls: blockedCalls,
	}

	return ev, nil
}

func parseArgs(args string) map[string]string {
	result := make(map[string]string)
	pairs := strings.Split(args, ", ")
	for i, pair := range pairs {
		pair = strings.TrimSpace(pair)
		result[fmt.Sprintf("arg%d", i)] = pair
	}
	return result
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

type PerfScriptParser struct {
	BaseParser
}

func NewPerfScriptParser() *PerfScriptParser {
	return &PerfScriptParser{
		BaseParser: BaseParser{evidenceType: evidence.TypePerfScript},
	}
}

var (
	perfScriptHeader      = regexp.MustCompile(`^(\S+)\s+(\d+)\s+\[\d+\]\s+([\d.]+):\s+(?:\d+\s+)?(\S+):`)
	perfScriptHeaderLoose = regexp.MustCompile(`^(\S+)\s+(\d+)\s+\[\d+\]\s+([\d.]+):`)
)

func (p *PerfScriptParser) Detect(content string) bool {
	lines := strings.SplitN(content, "\n", 30)
	for _, line := range lines {
		if perfScriptHeader.MatchString(line) {
			return true
		}
		if perfScriptHeaderLoose.MatchString(line) {
			return true
		}
	}
	return false
}

func (p *PerfScriptParser) Parse(content string) (evidence.Evidence, error) {
	scanner := bufio.NewScanner(strings.NewReader(content))

	var stacks []evidence.PerfStack
	hotSymbols := make(map[string]int)
	baseTime := time.Now()
	var startTime, endTime time.Time

	var currentStack *evidence.PerfStack

	for scanner.Scan() {
		line := scanner.Text()

		var matches []string
		if perfScriptHeader.MatchString(line) {
			matches = perfScriptHeader.FindStringSubmatch(line)
		} else if perfScriptHeaderLoose.MatchString(line) {
			matches = perfScriptHeaderLoose.FindStringSubmatch(line)
		}

		if matches != nil {
			if currentStack != nil && len(currentStack.CallChain) > 0 {
				stacks = append(stacks, *currentStack)
			}

			pid, _ := strconv.Atoi(matches[2])
			ts, _ := strconv.ParseFloat(matches[3], 64)
			timestamp := baseTime.Add(time.Duration(ts * float64(time.Second)))

			if startTime.IsZero() {
				startTime = timestamp
			}
			endTime = timestamp

			currentStack = &evidence.PerfStack{
				PID:         pid,
				Comm:        matches[1],
				CallChain:   []string{},
				SampleCount: 1,
			}
			continue
		}

		if currentStack != nil && strings.TrimSpace(line) != "" {
			trimmed := strings.TrimSpace(line)
			parts := strings.Fields(trimmed)
			if len(parts) >= 2 {
				funcName := parts[1]
				if idx := strings.Index(funcName, "("); idx != -1 {
					funcName = funcName[:idx]
				}
				currentStack.CallChain = append(currentStack.CallChain, funcName)
				hotSymbols[funcName]++
			}
		}
	}

	if currentStack != nil && len(currentStack.CallChain) > 0 {
		stacks = append(stacks, *currentStack)
	}

	hotFunctions := make(map[string]struct {
		SampleCount int
		Percent     float64
	})

	totalSamples := len(stacks)
	if totalSamples > 0 {
		for sym, count := range hotSymbols {
			hotFunctions[sym] = struct {
				SampleCount int
				Percent     float64
			}{
				SampleCount: count,
				Percent:     float64(count) / float64(totalSamples) * 100,
			}
		}
	}

	ev := &evidence.PerfScriptEvidence{
		BaseEvidence: evidence.BaseEvidence{
			EvidenceType: evidence.TypePerfScript,
			StartTime:    startTime,
			EndTime:      endTime,
			SampleCount:  len(stacks),
			Metadata: map[string]string{
				"format":        "perf_script",
				"total_samples": fmt.Sprintf("%d", len(stacks)),
			},
			RawContent: content,
		},
		Stacks:       stacks,
		HotSymbols:   hotSymbols,
		HotFunctions: hotFunctions,
	}

	return ev, nil
}

type FoldedStackParser struct {
	BaseParser
}

func NewFoldedStackParser() *FoldedStackParser {
	return &FoldedStackParser{
		BaseParser: BaseParser{evidenceType: evidence.TypeFoldedStack},
	}
}

func (p *FoldedStackParser) Detect(content string) bool {
	lines := strings.SplitN(content, "\n", 30)
	for _, line := range lines {
		if foldedStackLine.MatchString(line) {
			return true
		}
	}
	return false
}

func (p *FoldedStackParser) Parse(content string) (evidence.Evidence, error) {
	scanner := bufio.NewScanner(strings.NewReader(content))

	var stacks []struct {
		CallChain   string
		SampleCount int
	}
	hotSymbols := make(map[string]int)
	totalSamples := 0
	baseTime := time.Now()

	for scanner.Scan() {
		line := scanner.Text()

		if matches := foldedStackLine.FindStringSubmatch(line); matches != nil {
			count, _ := strconv.Atoi(matches[2])
			stacks = append(stacks, struct {
				CallChain   string
				SampleCount int
			}{
				CallChain:   matches[1],
				SampleCount: count,
			})
			totalSamples += count

			funcs := strings.Split(matches[1], ";")
			for _, f := range funcs {
				hotSymbols[f] += count
			}
		}
	}

	if len(stacks) == 0 {
		return nil, &evidence.ParseError{
			EvidenceType: evidence.TypeFoldedStack,
			ErrorType:    evidence.ErrIncompleteData,
			Message:      "No valid folded stack samples found",
			Suggestion:   "Ensure the file contains folded stack format (callchain;funcs count)",
		}
	}

	ev := &evidence.FoldedStackEvidence{
		BaseEvidence: evidence.BaseEvidence{
			EvidenceType: evidence.TypeFoldedStack,
			StartTime:    baseTime,
			EndTime:      baseTime.Add(time.Duration(totalSamples) * time.Millisecond),
			SampleCount:  totalSamples,
			Metadata: map[string]string{
				"format":        "folded_stack",
				"unique_stacks": fmt.Sprintf("%d", len(stacks)),
			},
			RawContent: content,
		},
		Stacks:       stacks,
		HotSymbols:   hotSymbols,
		TotalSamples: totalSamples,
	}

	return ev, nil
}

type HtopParser struct {
	BaseParser
}

func NewHtopParser() *HtopParser {
	return &HtopParser{
		BaseParser: BaseParser{evidenceType: evidence.TypeHtop},
	}
}

func (p *HtopParser) Detect(content string) bool {
	lines := strings.SplitN(content, "\n", 30)
	for _, line := range lines {
		if strings.Contains(line, "htop") {
			return true
		}
		if strings.Contains(line, "Mem[") && strings.Contains(line, "Swp[") {
			return true
		}
	}
	return false
}

func (p *HtopParser) Parse(content string) (evidence.Evidence, error) {
	var samples []struct {
		Timestamp time.Time
		CPUSample evidence.CPUSample
		Processes []evidence.ProcessSample
		LoadAvg   [3]float64
		Uptime    time.Duration
		Tasks     int
		Threads   int
	}
	baseTime := time.Now()

	ev := &evidence.HtopEvidence{
		BaseEvidence: evidence.BaseEvidence{
			EvidenceType: evidence.TypeHtop,
			StartTime:    baseTime,
			EndTime:      baseTime,
			SampleCount:  1,
			Metadata: map[string]string{
				"format": "htop",
			},
			RawContent: content,
		},
		Samples: samples,
	}

	return ev, nil
}

type NetstatParser struct {
	BaseParser
}

func NewNetstatParser() *NetstatParser {
	return &NetstatParser{
		BaseParser: BaseParser{evidenceType: evidence.TypeNetstat},
	}
}

func (p *NetstatParser) Detect(content string) bool {
	lines := strings.SplitN(content, "\n", 30)
	for _, line := range lines {
		if strings.Contains(line, "Active Internet connections") {
			return true
		}
		if strings.Contains(line, "Active UNIX domain sockets") {
			return true
		}
		if strings.HasPrefix(line, "Proto") && strings.Contains(line, "Recv-Q") {
			return true
		}
	}
	return false
}

func (p *NetstatParser) Parse(content string) (evidence.Evidence, error) {
	var samples []struct {
		Timestamp   time.Time
		Connections []evidence.NetworkConnection
		Stats       []evidence.NetworkStats
		ListenPorts []int
	}
	baseTime := time.Now()

	ev := &evidence.NetstatEvidence{
		BaseEvidence: evidence.BaseEvidence{
			EvidenceType: evidence.TypeNetstat,
			StartTime:    baseTime,
			EndTime:      baseTime,
			SampleCount:  1,
			Metadata: map[string]string{
				"format": "netstat",
			},
			RawContent: content,
		},
		Samples: samples,
	}

	return ev, nil
}

func (p *TopParser) ParseStream(r io.Reader) (evidence.Evidence, error) {
	content, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	return p.Parse(string(content))
}

func (p *VmstatParser) ParseStream(r io.Reader) (evidence.Evidence, error) {
	content, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	return p.Parse(string(content))
}

func (p *IostatParser) ParseStream(r io.Reader) (evidence.Evidence, error) {
	content, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	return p.Parse(string(content))
}

func (p *SsParser) ParseStream(r io.Reader) (evidence.Evidence, error) {
	content, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	return p.Parse(string(content))
}

func (p *StraceParser) ParseStream(r io.Reader) (evidence.Evidence, error) {
	content, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	return p.Parse(string(content))
}

func (p *PerfScriptParser) ParseStream(r io.Reader) (evidence.Evidence, error) {
	content, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	return p.Parse(string(content))
}

func (p *FoldedStackParser) ParseStream(r io.Reader) (evidence.Evidence, error) {
	content, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	return p.Parse(string(content))
}

func (p *HtopParser) ParseStream(r io.Reader) (evidence.Evidence, error) {
	content, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	return p.Parse(string(content))
}

func (p *NetstatParser) ParseStream(r io.Reader) (evidence.Evidence, error) {
	content, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	return p.Parse(string(content))
}
