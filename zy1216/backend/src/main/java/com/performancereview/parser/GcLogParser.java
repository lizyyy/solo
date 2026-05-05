package com.performancereview.parser;

import com.performancereview.entity.GcPause;
import com.performancereview.entity.Incident;
import com.performancereview.enums.BottleneckSeverity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Slf4j
public class GcLogParser implements FileParser {

    private static final Pattern GC_PAUSE_PATTERN = 
            Pattern.compile("(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}[+-]\\d{4})|(\\d{2}:\\d{2}:\\d{2}\\.\\d{3})");
    
    private static final Pattern GC_TYPE_PATTERN = 
            Pattern.compile("(GC|Full GC|CMS|G1|Parallel|Serial|ZGC|Shenandoah)");
    
    private static final Pattern PAUSE_TIME_PATTERN = 
            Pattern.compile("Pause\\s+([\\d.]+)ms|Times:\\s+user=([\\d.]+)s\\s+sys=([\\d.]+)s\\s+real=([\\d.]+)s|real=([\\d.]+)s");
    
    private static final Pattern MEMORY_PATTERN = 
            Pattern.compile("(\\d+)K->(\\d+)K\\((\\d+)K\\)");

    @Override
    public String getSupportedFileType() {
        return "gc.log";
    }

    @Override
    public boolean canParse(String fileName) {
        if (fileName == null) return false;
        String lowerName = fileName.toLowerCase();
        return lowerName.contains("gc") && lowerName.endsWith(".log") ||
               lowerName.endsWith("gc.log") ||
               lowerName.contains("garbage") && lowerName.endsWith(".log");
    }

    @Override
    public void parse(File file, Incident incident) throws IOException, IllegalArgumentException {
        log.info("开始解析 GC 日志文件: {}", file.getName());

        List<GcPause> gcPauses = new ArrayList<>();
        LocalDateTime baseTime = LocalDateTime.now().toLocalDate().atStartOfDay();

        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            int lineNumber = 0;
            
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                
                try {
                    GcPause gcPause = parseGcLine(line, baseTime, lineNumber);
                    if (gcPause != null) {
                        gcPause.setIncident(incident);
                        gcPauses.add(gcPause);
                    }
                } catch (Exception e) {
                    log.warn("解析 GC 日志第 {} 行时出错: {}", lineNumber, e.getMessage());
                }
            }
        }

        if (gcPauses.isEmpty()) {
            log.warn("GC 日志文件中未解析到有效数据: {}", file.getName());
            throw new IllegalArgumentException("GC 日志格式不正确，无法解析到有效数据");
        }

        incident.getGcPauses().addAll(gcPauses);
        log.info("成功解析 GC 日志文件: {}, 共解析到 {} 条 GC 记录", file.getName(), gcPauses.size());
    }

    private GcPause parseGcLine(String line, LocalDateTime baseTime, int lineNumber) {
        if (line.trim().isEmpty() || line.startsWith("#") || line.startsWith("Java HotSpot")) {
            return null;
        }

        GcPause gcPause = new GcPause();
        gcPause.setEvidenceSnippet("Line " + lineNumber + ": " + line.substring(0, Math.min(line.length(), 200)));

        Matcher timeMatcher = GC_PAUSE_PATTERN.matcher(line);
        if (timeMatcher.find()) {
            String timeStr = timeMatcher.group();
            if (timeStr.contains("T") && timeStr.contains("+")) {
                try {
                    gcPause.setTimestamp(LocalDateTime.parse(timeStr, DateTimeFormatter.ISO_OFFSET_DATE_TIME));
                } catch (Exception e) {
                    log.debug("无法解析时间格式: {}", timeStr);
                }
            } else {
                try {
                    LocalTime time = LocalTime.parse(timeStr, DateTimeFormatter.ofPattern("HH:mm:ss.SSS"));
                    gcPause.setTimestamp(baseTime.with(time));
                } catch (Exception e) {
                    log.debug("无法解析时间格式: {}", timeStr);
                }
            }
        }

        if (gcPause.getTimestamp() == null) {
            gcPause.setTimestamp(LocalDateTime.now());
        }

        Matcher typeMatcher = GC_TYPE_PATTERN.matcher(line);
        if (typeMatcher.find()) {
            gcPause.setGcType(typeMatcher.group(1));
        }

        if (line.contains("Allocation Failure")) {
            gcPause.setGcCause("Allocation Failure");
        } else if (line.contains("System.gc()")) {
            gcPause.setGcCause("System.gc()");
        } else if (line.contains("Metadata GC Threshold")) {
            gcPause.setGcCause("Metadata GC Threshold");
        } else if (line.contains("G1 Evacuation Pause")) {
            gcPause.setGcCause("G1 Evacuation Pause");
        }

        Matcher pauseMatcher = PAUSE_TIME_PATTERN.matcher(line);
        while (pauseMatcher.find()) {
            if (pauseMatcher.group(1) != null) {
                gcPause.setPauseDurationMs(Double.parseDouble(pauseMatcher.group(1)));
            } else if (pauseMatcher.group(4) != null) {
                gcPause.setTotalDurationMs(Double.parseDouble(pauseMatcher.group(4)) * 1000);
            } else if (pauseMatcher.group(5) != null) {
                gcPause.setTotalDurationMs(Double.parseDouble(pauseMatcher.group(5)) * 1000);
            }
        }

        if (gcPause.getPauseDurationMs() == null) {
            gcPause.setPauseDurationMs(0.0);
        }
        if (gcPause.getTotalDurationMs() == null) {
            gcPause.setTotalDurationMs(gcPause.getPauseDurationMs());
        }

        Matcher memMatcher = MEMORY_PATTERN.matcher(line);
        int memIndex = 0;
        while (memMatcher.find()) {
            long before = Long.parseLong(memMatcher.group(1));
            long after = Long.parseLong(memMatcher.group(2));
            
            if (memIndex == 0) {
                gcPause.setYoungGenBeforeBytes(before * 1024);
                gcPause.setYoungGenAfterBytes(after * 1024);
            } else if (memIndex == 1) {
                gcPause.setOldGenBeforeBytes(before * 1024);
                gcPause.setOldGenAfterBytes(after * 1024);
            } else if (memIndex == 2) {
                gcPause.setHeapBeforeBytes(before * 1024);
                gcPause.setHeapAfterBytes(after * 1024);
            }
            memIndex++;
        }

        gcPause.setConcurrentMarkFail(line.contains("concurrent-mark-overflow") || 
                                        line.contains("concurrent mode failure"));
        gcPause.setToSpaceExhausted(line.contains("to-space exhausted") || 
                                       line.contains("Evacuation Failure"));

        if (gcPause.getPauseDurationMs() > 1000) {
            gcPause.setSeverity(BottleneckSeverity.CRITICAL);
        } else if (gcPause.getPauseDurationMs() > 500) {
            gcPause.setSeverity(BottleneckSeverity.HIGH);
        } else if (gcPause.getPauseDurationMs() > 200) {
            gcPause.setSeverity(BottleneckSeverity.MEDIUM);
        } else if (gcPause.getPauseDurationMs() > 100) {
            gcPause.setSeverity(BottleneckSeverity.LOW);
        } else {
            gcPause.setSeverity(BottleneckSeverity.INFO);
        }

        if (Boolean.TRUE.equals(gcPause.getConcurrentMarkFail()) || 
            Boolean.TRUE.equals(gcPause.getToSpaceExhausted())) {
            gcPause.setSeverity(BottleneckSeverity.CRITICAL);
        }

        return gcPause;
    }
}
