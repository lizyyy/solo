package com.performancereview.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.performancereview.entity.Incident;
import com.performancereview.entity.SlowRequest;
import com.performancereview.enums.BottleneckSeverity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Slf4j
public class SlowRequestParser implements FileParser {

    private static final Pattern ACCESS_LOG_PATTERN = 
            Pattern.compile("(\\S+)\\s+-\\s+\\S+\\s+\\[([^\\]]+)\\]\\s+\"(\\w+)\\s+([^\\s]+)\\s+HTTP/[\\d.]+\"\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)");
    
    private static final Pattern SLOW_LOG_PATTERN = 
            Pattern.compile("(\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2})\\s+(\\w+)\\s+([^\\s]+)\\s+(\\d+)ms\\s+(\\d+)\\s+([^\\s]+)");
    
    private static final DateTimeFormatter[] DATE_FORMATTERS = {
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("dd/MMM/yyyy:HH:mm:ss Z"),
            DateTimeFormatter.ISO_LOCAL_DATE_TIME
    };

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String getSupportedFileType() {
        return "slow-request";
    }

    @Override
    public boolean canParse(String fileName) {
        if (fileName == null) return false;
        String lowerName = fileName.toLowerCase();
        return lowerName.contains("slow") && lowerName.contains("request") ||
               lowerName.contains("access") && lowerName.contains("log") ||
               lowerName.contains("request") && lowerName.endsWith(".log") ||
               lowerName.contains("request") && lowerName.endsWith(".json");
    }

    @Override
    public void parse(File file, Incident incident) throws IOException, IllegalArgumentException {
        log.info("开始解析慢请求文件: {}", file.getName());

        List<SlowRequest> slowRequests = new ArrayList<>();

        String fileName = file.getName().toLowerCase();
        if (fileName.endsWith(".json")) {
            parseJsonFile(file, incident, slowRequests);
        } else {
            parseLogFile(file, incident, slowRequests);
        }

        if (slowRequests.isEmpty()) {
            log.warn("慢请求文件中未解析到有效数据: {}", file.getName());
            throw new IllegalArgumentException("慢请求文件格式不正确，无法解析到有效数据");
        }

        incident.getSlowRequests().addAll(slowRequests);
        log.info("成功解析慢请求文件: {}, 共解析到 {} 条慢请求记录", file.getName(), slowRequests.size());
    }

    private void parseJsonFile(File file, Incident incident, List<SlowRequest> slowRequests) throws IOException {
        JsonNode root = objectMapper.readTree(file);

        if (root.isArray()) {
            for (JsonNode node : root) {
                SlowRequest slowRequest = parseJsonRequest(node);
                if (slowRequest != null) {
                    slowRequest.setIncident(incident);
                    slowRequests.add(slowRequest);
                }
            }
        } else {
            SlowRequest slowRequest = parseJsonRequest(root);
            if (slowRequest != null) {
                slowRequest.setIncident(incident);
                slowRequests.add(slowRequest);
            }
        }
    }

    private SlowRequest parseJsonRequest(JsonNode node) {
        try {
            SlowRequest slowRequest = new SlowRequest();

            if (node.has("timestamp")) {
                slowRequest.setTimestamp(parseDateTime(node.get("timestamp").asText()));
            } else {
                slowRequest.setTimestamp(LocalDateTime.now());
            }

            if (node.has("requestId")) {
                slowRequest.setRequestId(node.get("requestId").asText());
            }

            if (node.has("method")) {
                slowRequest.setHttpMethod(node.get("method").asText().toUpperCase());
            } else if (node.has("httpMethod")) {
                slowRequest.setHttpMethod(node.get("httpMethod").asText().toUpperCase());
            }

            if (node.has("uri")) {
                slowRequest.setUri(node.get("uri").asText());
            } else if (node.has("url")) {
                slowRequest.setUri(node.get("url").asText());
            } else if (node.has("path")) {
                slowRequest.setUri(node.get("path").asText());
            }

            if (node.has("queryString")) {
                slowRequest.setQueryString(node.get("queryString").asText());
            }

            if (node.has("status")) {
                slowRequest.setResponseStatus(node.get("status").asInt());
            } else if (node.has("statusCode")) {
                slowRequest.setResponseStatus(node.get("statusCode").asInt());
            }

            if (node.has("duration")) {
                slowRequest.setTotalDurationMs(node.get("duration").asLong());
            } else if (node.has("durationMs")) {
                slowRequest.setTotalDurationMs(node.get("durationMs").asLong());
            } else if (node.has("responseTime")) {
                slowRequest.setTotalDurationMs(node.get("responseTime").asLong());
            }

            if (node.has("processingTime")) {
                slowRequest.setProcessingDurationMs(node.get("processingTime").asLong());
            }

            if (node.has("ioTime")) {
                slowRequest.setIoDurationMs(node.get("ioTime").asLong());
            }

            if (node.has("clientIp")) {
                slowRequest.setClientIp(node.get("clientIp").asText());
            }

            if (node.has("threadName")) {
                slowRequest.setThreadName(node.get("threadName").asText());
            }

            setSeverity(slowRequest);

            slowRequest.setEvidenceSnippet(node.toString().substring(0, Math.min(node.toString().length(), 500)));

            return slowRequest;
        } catch (Exception e) {
            log.warn("解析 JSON 请求时出错: {}", e.getMessage());
            return null;
        }
    }

    private void parseLogFile(File file, Incident incident, List<SlowRequest> slowRequests) throws IOException {
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            int lineNumber = 0;

            while ((line = reader.readLine()) != null) {
                lineNumber++;

                try {
                    SlowRequest slowRequest = parseLogLine(line, lineNumber);
                    if (slowRequest != null) {
                        slowRequest.setIncident(incident);
                        slowRequests.add(slowRequest);
                    }
                } catch (Exception e) {
                    log.warn("解析慢请求日志第 {} 行时出错: {}", lineNumber, e.getMessage());
                }
            }
        }
    }

    private SlowRequest parseLogLine(String line, int lineNumber) {
        if (line.trim().isEmpty() || line.startsWith("#")) {
            return null;
        }

        SlowRequest slowRequest = new SlowRequest();
        slowRequest.setEvidenceSnippet("Line " + lineNumber + ": " + line.substring(0, Math.min(line.length(), 200)));
        slowRequest.setTimestamp(LocalDateTime.now());

        Matcher accessMatcher = ACCESS_LOG_PATTERN.matcher(line);
        if (accessMatcher.find()) {
            String clientIp = accessMatcher.group(1);
            String timeStr = accessMatcher.group(2);
            String method = accessMatcher.group(3);
            String uri = accessMatcher.group(4);
            String statusStr = accessMatcher.group(5);
            String sizeStr = accessMatcher.group(6);
            String durationStr = accessMatcher.group(7);

            slowRequest.setClientIp(clientIp);
            slowRequest.setHttpMethod(method.toUpperCase());
            slowRequest.setUri(uri);

            try {
                slowRequest.setTimestamp(parseDateTime(timeStr));
            } catch (Exception e) {
                // ignore
            }

            try {
                slowRequest.setResponseStatus(Integer.parseInt(statusStr));
            } catch (NumberFormatException e) {
                // ignore
            }

            try {
                slowRequest.setTotalDurationMs(Long.parseLong(durationStr));
            } catch (NumberFormatException e) {
                // ignore
            }

            setSeverity(slowRequest);
            return slowRequest;
        }

        Matcher slowMatcher = SLOW_LOG_PATTERN.matcher(line);
        if (slowMatcher.find()) {
            String timeStr = slowMatcher.group(1);
            String method = slowMatcher.group(2);
            String uri = slowMatcher.group(3);
            String durationStr = slowMatcher.group(4);
            String statusStr = slowMatcher.group(5);
            String clientIp = slowMatcher.group(6);

            try {
                slowRequest.setTimestamp(parseDateTime(timeStr));
            } catch (Exception e) {
                // ignore
            }

            slowRequest.setHttpMethod(method.toUpperCase());
            slowRequest.setUri(uri);
            slowRequest.setClientIp(clientIp);

            try {
                slowRequest.setTotalDurationMs(Long.parseLong(durationStr));
            } catch (NumberFormatException e) {
                // ignore
            }

            try {
                slowRequest.setResponseStatus(Integer.parseInt(statusStr));
            } catch (NumberFormatException e) {
                // ignore
            }

            setSeverity(slowRequest);
            return slowRequest;
        }

        return null;
    }

    private void setSeverity(SlowRequest slowRequest) {
        Long duration = slowRequest.getTotalDurationMs();
        if (duration == null) {
            slowRequest.setSeverity(BottleneckSeverity.MEDIUM);
            return;
        }

        if (duration > 10000) {
            slowRequest.setSeverity(BottleneckSeverity.CRITICAL);
        } else if (duration > 5000) {
            slowRequest.setSeverity(BottleneckSeverity.HIGH);
        } else if (duration > 2000) {
            slowRequest.setSeverity(BottleneckSeverity.MEDIUM);
        } else if (duration > 1000) {
            slowRequest.setSeverity(BottleneckSeverity.LOW);
        } else {
            slowRequest.setSeverity(BottleneckSeverity.INFO);
        }

        Integer status = slowRequest.getResponseStatus();
        if (status != null && status >= 500) {
            slowRequest.setSeverity(BottleneckSeverity.HIGH);
        }
    }

    private LocalDateTime parseDateTime(String timeStr) {
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return LocalDateTime.parse(timeStr, formatter);
            } catch (DateTimeParseException e) {
                // 继续尝试下一个格式
            }
        }
        log.warn("无法解析时间格式: {}, 使用当前时间", timeStr);
        return LocalDateTime.now();
    }
}
