package com.promptversion.service;

import com.promptversion.entity.*;
import com.promptversion.repository.*;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.StringWriter;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ExportService {

    @Autowired
    private TemplateVersionRepository versionRepository;

    @Autowired
    private HitRecordRepository hitRecordRepository;

    @Autowired
    private RollbackEventRepository rollbackEventRepository;

    @Autowired
    private ExceptionLogRepository exceptionLogRepository;

    @Autowired
    private PromptTemplateRepository templateRepository;

    public String exportVersionSummary(Long templateId) {
        PromptTemplate template = templateRepository.findById(templateId).orElse(null);
        List<TemplateVersion> versions = versionRepository.findByTemplateIdOrderByCreatedAtDesc(templateId);
        List<Object[]> hitCounts = hitRecordRepository.countHitsByVersionIdForTemplate(templateId);
        List<RollbackEvent> rollbackEvents = rollbackEventRepository.findByTemplateIdOrderByRollbackTimeDesc(templateId);
        List<ExceptionLog> exceptions = exceptionLogRepository.findByTemplateIdOrderByCreatedAtDesc(templateId);

        Map<Long, Long> hitCountMap = new HashMap<>();
        for (Object[] row : hitCounts) {
            hitCountMap.put((Long) row[0], (Long) row[1]);
        }

        StringWriter out = new StringWriter();
        try (CSVPrinter printer = new CSVPrinter(out, CSVFormat.DEFAULT.withHeader(
                "模板名称", "版本号", "状态", "发布人", "发布时间", "流量占比", "命中次数", "备注"))) {

            for (TemplateVersion version : versions) {
                printer.printRecord(
                        template != null ? template.getTemplateName() : "Unknown",
                        version.getVersionNumber(),
                        version.getStatus(),
                        version.getPublishedBy(),
                        formatDateTime(version.getPublishedAt()),
                        version.getTrafficPercentage() + "%",
                        hitCountMap.getOrDefault(version.getId(), 0L),
                        version.getRemark()
                );
            }
        } catch (Exception e) {
            throw new RuntimeException("导出失败: " + e.getMessage());
        }

        return out.toString();
    }

    public String exportHitRecords(Long templateId, LocalDateTime startTime, LocalDateTime endTime) {
        List<HitRecord> records;
        if (startTime != null && endTime != null) {
            records = hitRecordRepository.findByTemplateIdAndHitTimeBetween(templateId, startTime, endTime);
        } else {
            records = hitRecordRepository.findByTemplateIdOrderByHitTimeDesc(templateId);
        }

        Map<Long, String> versionMap = new HashMap<>();
        for (HitRecord record : records) {
            if (!versionMap.containsKey(record.getVersionId())) {
                versionRepository.findById(record.getVersionId()).ifPresent(v ->
                        versionMap.put(v.getId(), v.getVersionNumber()));
            }
        }

        StringWriter out = new StringWriter();
        try (CSVPrinter printer = new CSVPrinter(out, CSVFormat.DEFAULT.withHeader(
                "请求ID", "用户ID", "版本号", "模型名称", "命中原因", "延迟(ms)", "命中时间"))) {

            for (HitRecord record : records) {
                printer.printRecord(
                        record.getRequestId(),
                        record.getUserId(),
                        versionMap.getOrDefault(record.getVersionId(), "Unknown"),
                        record.getModelName(),
                        record.getHitReason(),
                        record.getLatencyMs(),
                        formatDateTime(record.getHitTime())
                );
            }
        } catch (Exception e) {
            throw new RuntimeException("导出失败: " + e.getMessage());
        }

        return out.toString();
    }

    public String exportRollbackEvents(Long templateId) {
        List<RollbackEvent> events = rollbackEventRepository.findByTemplateIdOrderByRollbackTimeDesc(templateId);

        Map<Long, String> versionMap = new HashMap<>();
        for (RollbackEvent event : events) {
            if (!versionMap.containsKey(event.getVersionId())) {
                versionRepository.findById(event.getVersionId()).ifPresent(v ->
                        versionMap.put(v.getId(), v.getVersionNumber()));
            }
            if (event.getPreviousVersionId() != null && !versionMap.containsKey(event.getPreviousVersionId())) {
                versionRepository.findById(event.getPreviousVersionId()).ifPresent(v ->
                        versionMap.put(v.getId(), v.getVersionNumber()));
            }
        }

        StringWriter out = new StringWriter();
        try (CSVPrinter printer = new CSVPrinter(out, CSVFormat.DEFAULT.withHeader(
                "回滚类型", "操作人", "当前版本", "目标版本", "回滚原因", "回滚时间", "处理状态"))) {

            for (RollbackEvent event : events) {
                printer.printRecord(
                        event.getRollbackType(),
                        event.getOperator(),
                        versionMap.getOrDefault(event.getVersionId(), "Unknown"),
                        event.getPreviousVersionId() != null ? versionMap.getOrDefault(event.getPreviousVersionId(), "Unknown") : "",
                        event.getReason(),
                        formatDateTime(event.getRollbackTime()),
                        event.getProcessed() ? "已处理" : "待处理"
                );
            }
        } catch (Exception e) {
            throw new RuntimeException("导出失败: " + e.getMessage());
        }

        return out.toString();
    }

    public String exportExceptionLogs(LocalDateTime startTime, LocalDateTime endTime) {
        List<ExceptionLog> logs;
        if (startTime != null && endTime != null) {
            logs = exceptionLogRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(startTime, endTime);
        } else {
            logs = exceptionLogRepository.findAll();
        }

        StringWriter out = new StringWriter();
        try (CSVPrinter printer = new CSVPrinter(out, CSVFormat.DEFAULT.withHeader(
                "操作类型", "错误信息", "原始输入", "操作人", "处理结论", "发生时间"))) {

            for (ExceptionLog log : logs) {
                printer.printRecord(
                        log.getOperationType(),
                        log.getErrorMessage(),
                        truncate(log.getOriginalInput(), 200),
                        log.getOperator(),
                        log.getConclusion(),
                        formatDateTime(log.getCreatedAt())
                );
            }
        } catch (Exception e) {
            throw new RuntimeException("导出失败: " + e.getMessage());
        }

        return out.toString();
    }

    public String exportFullReport(Long templateId) {
        StringBuilder sb = new StringBuilder();
        sb.append("=== 版本摘要 ===\n");
        sb.append(exportVersionSummary(templateId));
        sb.append("\n\n=== 命中记录 ===\n");
        sb.append(exportHitRecords(templateId, null, null));
        sb.append("\n\n=== 回滚事件 ===\n");
        sb.append(exportRollbackEvents(templateId));
        return sb.toString();
    }

    private String formatDateTime(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "";
        }
        return dateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    private String truncate(String str, int maxLength) {
        if (str == null) {
            return "";
        }
        if (str.length() <= maxLength) {
            return str;
        }
        return str.substring(0, maxLength) + "...";
    }
}