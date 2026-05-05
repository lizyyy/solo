package com.performancereview.parser;

import com.performancereview.entity.CpuHotSpot;
import com.performancereview.entity.Incident;
import com.performancereview.entity.LockWaitChain;
import com.performancereview.enums.BottleneckSeverity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Slf4j
public class ThreadDumpParser implements FileParser {

    private static final Pattern THREAD_HEADER_PATTERN = 
            Pattern.compile("\"([^\"]+)\"\\s+(\\d+)?\\s+(daemon)?\\s+prio=(\\d+)\\s+os_prio=(\\d+)\\s+tid=(0x[0-9a-f]+)\\s+nid=(0x[0-9a-f]+)\\s+(\\w+)?\\s*\\[(.+)\\]");
    
    private static final Pattern THREAD_STATE_PATTERN = 
            Pattern.compile("java.lang.Thread.State:\\s+(\\w+)(?:\\s*\\((.+)\\))?");
    
    private static final Pattern LOCK_PATTERN = 
            Pattern.compile("-\\s+(waiting to lock|locked|parking to wait for)\\s+<(0x[0-9a-f]+)>\\s+\\(a\\s+([^)]+)\\)");
    
    private static final Pattern STACK_LINE_PATTERN = 
            Pattern.compile("\\s+at\\s+([\\w.$]+)\\(([^:]+)(?::(\\d+))?\\)");

    @Override
    public String getSupportedFileType() {
        return "thread-dump";
    }

    @Override
    public boolean canParse(String fileName) {
        if (fileName == null) return false;
        String lowerName = fileName.toLowerCase();
        return lowerName.contains("thread") && lowerName.contains("dump") ||
               lowerName.contains("tdump") ||
               lowerName.contains("jstack") ||
               lowerName.endsWith(".tdump") ||
               lowerName.endsWith(".threaddump");
    }

    @Override
    public void parse(File file, Incident incident) throws IOException, IllegalArgumentException {
        log.info("开始解析线程转储文件: {}", file.getName());

        List<CpuHotSpot> cpuHotSpots = new ArrayList<>();
        List<LockWaitChain> lockWaitChains = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            StringBuilder currentThread = null;
            int lineNumber = 0;

            while ((line = reader.readLine()) != null) {
                lineNumber++;

                if (line.contains("Full thread dump") || line.contains("Thread dump")) {
                    continue;
                }

                Matcher headerMatcher = THREAD_HEADER_PATTERN.matcher(line);
                if (headerMatcher.find()) {
                    if (currentThread != null && currentThread.length() > 0) {
                        parseThreadInfo(currentThread.toString(), incident, cpuHotSpots, lockWaitChains);
                    }
                    currentThread = new StringBuilder();
                    currentThread.append(line).append("\n");
                } else if (currentThread != null) {
                    currentThread.append(line).append("\n");
                }
            }

            if (currentThread != null && currentThread.length() > 0) {
                parseThreadInfo(currentThread.toString(), incident, cpuHotSpots, lockWaitChains);
            }
        }

        log.info("成功解析线程转储文件: {}, 共解析到 {} 个 CPU 热点, {} 个锁等待链", 
                file.getName(), cpuHotSpots.size(), lockWaitChains.size());
    }

    private void parseThreadInfo(String threadContent, Incident incident, 
                                 List<CpuHotSpot> cpuHotSpots, List<LockWaitChain> lockWaitChains) {
        try {
            String[] lines = threadContent.split("\n");
            if (lines.length == 0) return;

            Matcher headerMatcher = THREAD_HEADER_PATTERN.matcher(lines[0]);
            if (!headerMatcher.find()) return;

            String threadName = headerMatcher.group(1);
            String threadState = headerMatcher.group(8);
            String stackTrace = threadContent;

            String actualState = threadState;
            for (String line : lines) {
                Matcher stateMatcher = THREAD_STATE_PATTERN.matcher(line);
                if (stateMatcher.find()) {
                    actualState = stateMatcher.group(1);
                    break;
                }
            }

            if ("RUNNABLE".equalsIgnoreCase(actualState) || 
                "RUNNING".equalsIgnoreCase(actualState)) {
                CpuHotSpot cpuHotSpot = extractCpuHotSpot(threadName, actualState, stackTrace);
                if (cpuHotSpot != null) {
                    cpuHotSpot.setIncident(incident);
                    cpuHotSpots.add(cpuHotSpot);
                }
            }

            if ("BLOCKED".equalsIgnoreCase(actualState) || 
                "WAITING".equalsIgnoreCase(actualState) ||
                "TIMED_WAITING".equalsIgnoreCase(actualState)) {
                LockWaitChain lockWaitChain = extractLockWaitChain(threadName, actualState, stackTrace);
                if (lockWaitChain != null) {
                    lockWaitChain.setIncident(incident);
                    lockWaitChains.add(lockWaitChain);
                }
            }
        } catch (Exception e) {
            log.warn("解析线程信息时出错: {}", e.getMessage());
        }
    }

    private CpuHotSpot extractCpuHotSpot(String threadName, String threadState, String stackTrace) {
        CpuHotSpot cpuHotSpot = new CpuHotSpot();
        cpuHotSpot.setThreadName(threadName);
        cpuHotSpot.setThreadState(threadState);
        cpuHotSpot.setTimestamp(LocalDateTime.now());
        cpuHotSpot.setEvidenceSnippet(stackTrace.substring(0, Math.min(stackTrace.length(), 500)));

        Matcher stackMatcher = STACK_LINE_PATTERN.matcher(stackTrace);
        if (stackMatcher.find()) {
            String methodFull = stackMatcher.group(1);
            String file = stackMatcher.group(2);
            String lineNum = stackMatcher.group(3);

            int lastDot = methodFull.lastIndexOf('.');
            if (lastDot > 0) {
                cpuHotSpot.setClassName(methodFull.substring(0, lastDot));
                cpuHotSpot.setMethodName(methodFull.substring(lastDot + 1));
            } else {
                cpuHotSpot.setMethodName(methodFull);
            }

            if (lineNum != null) {
                try {
                    cpuHotSpot.setLineNumber(Integer.parseInt(lineNum));
                } catch (NumberFormatException e) {
                    // ignore
                }
            }
        }

        cpuHotSpot.setSeverity(BottleneckSeverity.MEDIUM);
        
        if (threadName.contains("http") || threadName.contains("request")) {
            cpuHotSpot.setSeverity(BottleneckSeverity.HIGH);
        }

        return cpuHotSpot;
    }

    private LockWaitChain extractLockWaitChain(String threadName, String threadState, String stackTrace) {
        LockWaitChain lockWaitChain = new LockWaitChain();
        lockWaitChain.setWaitingThreadName(threadName);
        lockWaitChain.setWaitingThreadState(threadState);
        lockWaitChain.setTimestamp(LocalDateTime.now());
        lockWaitChain.setDeadlockDetected(false);
        lockWaitChain.setEvidenceSnippet(stackTrace.substring(0, Math.min(stackTrace.length(), 500)));

        Matcher lockMatcher = LOCK_PATTERN.matcher(stackTrace);
        while (lockMatcher.find()) {
            String lockAction = lockMatcher.group(1);
            String lockId = lockMatcher.group(2);
            String lockType = lockMatcher.group(3);

            lockWaitChain.setLockName(lockId);
            lockWaitChain.setLockType(lockType);

            if ("waiting to lock".equalsIgnoreCase(lockAction)) {
                lockWaitChain.setWaitingStackTrace(stackTrace);
            } else if ("locked".equalsIgnoreCase(lockAction)) {
                lockWaitChain.setLockOwnerThreadName(threadName);
                lockWaitChain.setLockOwnerState(threadState);
                lockWaitChain.setLockOwnerStackTrace(stackTrace);
            }
        }

        if (stackTrace.contains("deadlock")) {
            lockWaitChain.setDeadlockDetected(true);
            lockWaitChain.setSeverity(BottleneckSeverity.CRITICAL);
        } else if ("BLOCKED".equalsIgnoreCase(threadState)) {
            lockWaitChain.setSeverity(BottleneckSeverity.HIGH);
        } else {
            lockWaitChain.setSeverity(BottleneckSeverity.MEDIUM);
        }

        return lockWaitChain;
    }
}
