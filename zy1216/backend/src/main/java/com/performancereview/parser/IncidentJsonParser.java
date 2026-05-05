package com.performancereview.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.performancereview.entity.Incident;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

@Component
@Slf4j
public class IncidentJsonParser implements FileParser {

    private final ObjectMapper objectMapper;
    private static final DateTimeFormatter[] DATE_FORMATTERS = {
            DateTimeFormatter.ISO_LOCAL_DATE_TIME,
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm:ss")
    };

    public IncidentJsonParser() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }

    @Override
    public String getSupportedFileType() {
        return "incident.json";
    }

    @Override
    public boolean canParse(String fileName) {
        if (fileName == null) return false;
        String lowerName = fileName.toLowerCase();
        return lowerName.endsWith("incident.json") ||
               lowerName.contains("incident") && lowerName.endsWith(".json");
    }

    @Override
    public void parse(File file, Incident incident) throws IOException, IllegalArgumentException {
        log.info("开始解析 incident.json 文件: {}", file.getName());

        JsonNode root = objectMapper.readTree(file);

        if (root.has("title")) {
            incident.setTitle(root.get("title").asText());
        } else if (incident.getTitle() == null) {
            incident.setTitle("未命名事故 - " + LocalDateTime.now());
        }

        if (root.has("description")) {
            incident.setDescription(root.get("description").asText());
        }

        if (root.has("incidentTime") || root.has("timestamp")) {
            String timeStr = root.has("incidentTime") 
                    ? root.get("incidentTime").asText() 
                    : root.get("timestamp").asText();
            incident.setIncidentTime(parseDateTime(timeStr));
        }

        if (root.has("status")) {
            incident.setStatus(root.get("status").asText());
        } else if (incident.getStatus() == null) {
            incident.setStatus("OPEN");
        }

        if (root.has("severity")) {
            incident.setSeverity(root.get("severity").asText().toUpperCase());
        } else if (incident.getSeverity() == null) {
            incident.setSeverity("MEDIUM");
        }

        if (root.has("dispositionSuggestion")) {
            incident.setDispositionSuggestion(root.get("dispositionSuggestion").asText());
        }

        if (root.has("resolutionNotes")) {
            incident.setResolutionNotes(root.get("resolutionNotes").asText());
        }

        log.info("成功解析 incident.json 文件: {}", file.getName());
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
