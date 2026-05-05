package com.performancereview.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.performancereview.entity.Incident;
import com.performancereview.entity.IoBlock;
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
public class IoBlockParser implements FileParser {

    private static final Pattern IO_LOG_PATTERN = 
            Pattern.compile("(\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2})\\s+(READ|WRITE|OPEN|CLOSE|SEEK)\\s+([^\\s]+)\\s+(\\d+)ms\\s+(\\d+)bytes?");
    
    private static final Pattern STACK_PATTERN = 
            Pattern.compile("\\s+at\\s+([\\w.$]+)\\(([^:]+)(?::(\\d+))?\\)");
    
    private static final DateTimeFormatter[] DATE_FORMATTERS = {
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ISO_LOCAL_DATE_TIME
    };

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String getSupportedFileType() {
        return "io-block";
    }

    @Override
    public boolean canParse(String fileName) {
        if (fileName == null) return false;
        String lowerName = fileName.toLowerCase();
        return lowerName.contains("io") && lowerName.contains("block") ||
               lowerName.contains("ioblock") ||
               lowerName.contains("disk") && lowerName.endsWith(".log") ||
               lowerName.contains("io") && lowerName.endsWith(".log") ||
               lowerName.contains("io") && lowerName.endsWith(".json");
    }

    @Override
    public void parse(File file, Incident incident) throws IOException, IllegalArgumentException {
        log.info("开始解析 I/O 阻塞文件: {}", file.getName());

        List<IoBlock> ioBlocks = new ArrayList<>();

        String fileName = file.getName().toLowerCase();
        if (fileName.endsWith(".json")) {
            parseJsonFile(file, incident, ioBlocks);
        } else {
            parseLogFile(file, incident, ioBlocks);
        }

        if (ioBlocks.isEmpty()) {
            log.warn("I/O 阻塞文件中未解析到有效数据: {}", file.getName());
            throw new IllegalArgumentException("I/O 阻塞文件格式不正确，无法解析到有效数据");
        }

        incident.getIoBlocks().addAll(ioBlocks);
        log.info("成功解析 I/O 阻塞文件: {}, 共解析到 {} 条 I/O 阻塞记录", file.getName(), ioBlocks.size());
    }

    private void parseJsonFile(File file, Incident incident, List<IoBlock> ioBlocks) throws IOException {
        JsonNode root = objectMapper.readTree(file);

        if (root.isArray()) {
            for (JsonNode node : root) {
                IoBlock ioBlock = parseJsonIoBlock(node);
                if (ioBlock != null) {
                    ioBlock.setIncident(incident);
                    ioBlocks.add(ioBlock);
                }
            }
        } else {
            IoBlock ioBlock = parseJsonIoBlock(root);
            if (ioBlock != null) {
                ioBlock.setIncident(incident);
                ioBlocks.add(ioBlock);
            }
        }
    }

    private IoBlock parseJsonIoBlock(JsonNode node) {
        try {
            IoBlock ioBlock = new IoBlock();

            if (node.has("timestamp")) {
                ioBlock.setTimestamp(parseDateTime(node.get("timestamp").asText()));
            } else {
                ioBlock.setTimestamp(LocalDateTime.now());
            }

            if (node.has("threadName")) {
                ioBlock.setThreadName(node.get("threadName").asText());
            }

            if (node.has("ioType")) {
                ioBlock.setIoType(node.get("ioType").asText().toUpperCase());
            } else if (node.has("type")) {
                ioBlock.setIoType(node.get("type").asText().toUpperCase());
            }

            if (node.has("resourcePath")) {
                ioBlock.setResourcePath(node.get("resourcePath").asText());
            } else if (node.has("path")) {
                ioBlock.setResourcePath(node.get("path").asText());
            } else if (node.has("file")) {
                ioBlock.setResourcePath(node.get("file").asText());
            }

            if (node.has("resourceType")) {
                ioBlock.setResourceType(node.get("resourceType").asText());
            }

            if (node.has("blockDuration")) {
                ioBlock.setBlockDurationMs(node.get("blockDuration").asLong());
            } else if (node.has("duration")) {
                ioBlock.setBlockDurationMs(node.get("duration").asLong());
            } else if (node.has("waitTime")) {
                ioBlock.setBlockDurationMs(node.get("waitTime").asLong());
            }

            if (node.has("bytesTransferred")) {
                ioBlock.setBytesTransferred(node.get("bytesTransferred").asLong());
            } else if (node.has("bytes")) {
                ioBlock.setBytesTransferred(node.get("bytes").asLong());
            }

            if (node.has("stackTrace")) {
                ioBlock.setStackTrace(node.get("stackTrace").asText());
            }

            if (node.has("methodName")) {
                ioBlock.setMethodName(node.get("methodName").asText());
            }

            if (node.has("className")) {
                ioBlock.setClassName(node.get("className").asText());
            }

            setSeverity(ioBlock);

            ioBlock.setEvidenceSnippet(node.toString().substring(0, Math.min(node.toString().length(), 500)));

            return ioBlock;
        } catch (Exception e) {
            log.warn("解析 JSON I/O 阻塞时出错: {}", e.getMessage());
            return null;
        }
    }

    private void parseLogFile(File file, Incident incident, List<IoBlock> ioBlocks) throws IOException {
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            int lineNumber = 0;
            StringBuilder currentStack = null;
            IoBlock currentIoBlock = null;

            while ((line = reader.readLine()) != null) {
                lineNumber++;

                try {
                    Matcher ioMatcher = IO_LOG_PATTERN.matcher(line);
                    if (ioMatcher.find()) {
                        if (currentIoBlock != null) {
                            setSeverity(currentIoBlock);
                            currentIoBlock.setIncident(incident);
                            ioBlocks.add(currentIoBlock);
                        }

                        String timeStr = ioMatcher.group(1);
                        String ioType = ioMatcher.group(2);
                        String resourcePath = ioMatcher.group(3);
                        String durationStr = ioMatcher.group(4);
                        String bytesStr = ioMatcher.group(5);

                        currentIoBlock = new IoBlock();
                        currentIoBlock.setEvidenceSnippet("Line " + lineNumber + ": " + line.substring(0, Math.min(line.length(), 200)));

                        try {
                            currentIoBlock.setTimestamp(parseDateTime(timeStr));
                        } catch (Exception e) {
                            currentIoBlock.setTimestamp(LocalDateTime.now());
                        }

                        currentIoBlock.setIoType(ioType.toUpperCase());
                        currentIoBlock.setResourcePath(resourcePath);

                        try {
                            currentIoBlock.setBlockDurationMs(Long.parseLong(durationStr));
                        } catch (NumberFormatException e) {
                            // ignore
                        }

                        try {
                            currentIoBlock.setBytesTransferred(Long.parseLong(bytesStr));
                        } catch (NumberFormatException e) {
                            // ignore
                        }

                        currentStack = new StringBuilder();
                    } else if (currentIoBlock != null) {
                        Matcher stackMatcher = STACK_PATTERN.matcher(line);
                        if (stackMatcher.find()) {
                            if (currentStack == null) {
                                currentStack = new StringBuilder();
                            }
                            currentStack.append(line).append("\n");

                            String methodFull = stackMatcher.group(1);
                            String file = stackMatcher.group(2);
                            String lineNum = stackMatcher.group(3);

                            if (currentIoBlock.getMethodName() == null) {
                                int lastDot = methodFull.lastIndexOf('.');
                                if (lastDot > 0) {
                                    currentIoBlock.setClassName(methodFull.substring(0, lastDot));
                                    currentIoBlock.setMethodName(methodFull.substring(lastDot + 1));
                                } else {
                                    currentIoBlock.setMethodName(methodFull);
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("解析 I/O 阻塞日志第 {} 行时出错: {}", lineNumber, e.getMessage());
                }
            }

            if (currentIoBlock != null) {
                if (currentStack != null && currentStack.length() > 0) {
                    currentIoBlock.setStackTrace(currentStack.toString());
                }
                setSeverity(currentIoBlock);
                currentIoBlock.setIncident(incident);
                ioBlocks.add(currentIoBlock);
            }
        }
    }

    private void setSeverity(IoBlock ioBlock) {
        Long duration = ioBlock.getBlockDurationMs();
        if (duration == null) {
            ioBlock.setSeverity(BottleneckSeverity.MEDIUM);
            return;
        }

        if (duration > 5000) {
            ioBlock.setSeverity(BottleneckSeverity.CRITICAL);
        } else if (duration > 2000) {
            ioBlock.setSeverity(BottleneckSeverity.HIGH);
        } else if (duration > 1000) {
            ioBlock.setSeverity(BottleneckSeverity.MEDIUM);
        } else if (duration > 500) {
            ioBlock.setSeverity(BottleneckSeverity.LOW);
        } else {
            ioBlock.setSeverity(BottleneckSeverity.INFO);
        }

        String ioType = ioBlock.getIoType();
        if (ioType != null && (ioType.contains("WRITE") || ioType.contains("SYNC"))) {
            if (ioBlock.getSeverity().ordinal() < BottleneckSeverity.HIGH.ordinal()) {
                ioBlock.setSeverity(BottleneckSeverity.HIGH);
            }
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
