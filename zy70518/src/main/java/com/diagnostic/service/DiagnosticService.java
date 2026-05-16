package com.diagnostic.service;

import com.alibaba.fastjson.JSON;
import com.diagnostic.config.DiagnosticProperties;
import com.diagnostic.dto.*;
import com.diagnostic.entity.ConnectionPoolDiagnostic;
import com.diagnostic.entity.DiagnosticReport;
import com.diagnostic.enums.DiagnosticStatus;
import com.diagnostic.repository.ConnectionPoolDiagnosticRepository;
import com.diagnostic.repository.DiagnosticReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DiagnosticService {
    private final ConnectionPoolDiagnosticRepository diagnosticRepository;
    private final DiagnosticReportRepository reportRepository;
    private final DiagnosticProperties properties;

    @Transactional
    public ConnectionPoolDiagnostic createDiagnostic(DiagnosticCreateRequest request) {
        ConnectionPoolDiagnostic diagnostic = buildDiagnostic(request);
        diagnostic.setRawInput(request.getRawInput());
        evaluateLeakRisk(diagnostic);
        String processingBasis = buildProcessingBasis(diagnostic);
        diagnostic.setProcessingBasis(processingBasis);
        return diagnosticRepository.save(diagnostic);
    }

    private ConnectionPoolDiagnostic buildDiagnostic(DiagnosticCreateRequest request) {
        return ConnectionPoolDiagnostic.builder()
                .instanceId(request.getInstanceId())
                .poolName(request.getPoolName())
                .sampleTime(request.getSampleTime())
                .totalConnections(request.getTotalConnections())
                .activeConnections(request.getActiveConnections())
                .idleConnections(request.getIdleConnections())
                .waitingThreads(request.getWaitingThreads())
                .maxPoolSize(request.getMaxPoolSize())
                .connectionUsageAvgTime(request.getConnectionUsageAvgTime())
                .connectionUsageMaxTime(request.getConnectionUsageMaxTime())
                .stackSummary(request.getStackSummary())
                .stackDetails(request.getStackDetails())
                .status(DiagnosticStatus.PENDING)
                .build();
    }

    private void evaluateLeakRisk(ConnectionPoolDiagnostic diagnostic) {
        int score = 0;
        int maxScore = 100;
        if (diagnostic.getMaxPoolSize() != null && diagnostic.getActiveConnections() != null) {
            double usageRate = (double) diagnostic.getActiveConnections() / diagnostic.getMaxPoolSize() * 100;
            if (usageRate >= properties.getThreshold().getActiveConnection()) {
                score += 40;
                log.info("连接池使用率过高: {}%", usageRate);
            }
        }
        if (diagnostic.getConnectionUsageMaxTime() != null &&
            diagnostic.getConnectionUsageMaxTime() > properties.getThreshold().getConnectionUsageTime()) {
            score += 30;
            log.info("连接使用时间过长: {}秒", diagnostic.getConnectionUsageMaxTime());
        }
        if (diagnostic.getWaitingThreads() != null && diagnostic.getWaitingThreads() > 0) {
            score += 20;
            log.info("存在等待线程: {}", diagnostic.getWaitingThreads());
        }
        LocalDateTime thresholdTime = diagnostic.getSampleTime().minusHours(1);
        Long consecutiveCount = diagnosticRepository.countConsecutiveLeakSamples(
                diagnostic.getInstanceId(), diagnostic.getPoolName(), thresholdTime);
        diagnostic.setConsecutiveLeakSamples(consecutiveCount.intValue() + 1);
        if (consecutiveCount >= properties.getThreshold().getConsecutiveSamples()) {
            score += 10;
            log.info("连续采样达到阈值: {}次", consecutiveCount);
        }
        diagnostic.setLeakConfidence(score);
        diagnostic.setSuspectedLeak(score >= 50);
    }

    private String buildProcessingBasis(ConnectionPoolDiagnostic diagnostic) {
        StringBuilder sb = new StringBuilder();
        sb.append("泄漏评估结果: ").append(diagnostic.getSuspectedLeak() ? "疑似泄漏" : "正常").append("\n");
        sb.append("泄漏置信度: ").append(diagnostic.getLeakConfidence()).append("%\n");
        sb.append("阈值配置: 活跃连接使用率>=").append(properties.getThreshold().getActiveConnection()).append("%, ");
        sb.append("连接使用时间>=").append(properties.getThreshold().getConnectionUsageTime()).append("秒, ");
        sb.append("连续采样>=").append(properties.getThreshold().getConsecutiveSamples()).append("次\n");
        sb.append("连续泄漏采样数: ").append(diagnostic.getConsecutiveLeakSamples()).append("\n");
        sb.append("活跃连接数: ").append(diagnostic.getActiveConnections()).append(", ");
        sb.append("最大连接池大小: ").append(diagnostic.getMaxPoolSize()).append("\n");
        sb.append("连接平均使用时间: ").append(diagnostic.getConnectionUsageAvgTime()).append("秒, ");
        sb.append("连接最大使用时间: ").append(diagnostic.getConnectionUsageMaxTime()).append("秒\n");
        sb.append("等待线程数: ").append(diagnostic.getWaitingThreads());
        return sb.toString();
    }

    public Page<ConnectionPoolDiagnostic> queryDiagnostics(DiagnosticQueryRequest request) {
        Pageable pageable = PageRequest.of(request.getPageNum() - 1, request.getPageSize());
        return diagnosticRepository.findByConditions(
                request.getInstanceId(),
                request.getPoolName(),
                request.getStatus(),
                request.getSuspectedLeak(),
                request.getStartTime(),
                request.getEndTime(),
                pageable);
    }

    public Optional<ConnectionPoolDiagnostic> getDiagnostic(Long id) {
        return diagnosticRepository.findById(id);
    }

    @Transactional
    public ConnectionPoolDiagnostic updateStatus(StatusUpdateRequest request) {
        ConnectionPoolDiagnostic diagnostic = diagnosticRepository.findById(request.getId())
                .orElseThrow(() -> new IllegalArgumentException("诊断记录不存在"));
        diagnostic.setStatus(request.getTargetStatus());
        if (request.getProcessingBasis() != null) {
            diagnostic.setProcessingBasis(request.getProcessingBasis());
        }
        if (request.getFinalConclusion() != null) {
            diagnostic.setFinalConclusion(request.getFinalConclusion());
        }
        if (request.getReviewer() != null) {
            diagnostic.setReviewer(request.getReviewer());
            diagnostic.setReviewTime(LocalDateTime.now());
        }
        if (request.getReviewComment() != null) {
            diagnostic.setReviewComment(request.getReviewComment());
        }
        return diagnosticRepository.save(diagnostic);
    }

    @Transactional
    public ConnectionPoolDiagnostic manualCorrection(ManualCorrectionRequest request) {
        ConnectionPoolDiagnostic diagnostic = diagnosticRepository.findById(request.getId())
                .orElseThrow(() -> new IllegalArgumentException("诊断记录不存在"));
        if (request.getSuspectedLeak() != null) {
            diagnostic.setSuspectedLeak(request.getSuspectedLeak());
        }
        if (request.getLeakConfidence() != null) {
            diagnostic.setLeakConfidence(request.getLeakConfidence());
        }
        diagnostic.setReviewer(request.getReviewer());
        diagnostic.setReviewTime(LocalDateTime.now());
        diagnostic.setReviewComment(request.getReviewComment());
        diagnostic.setProcessingBasis(request.getProcessingBasis());
        diagnostic.setFinalConclusion(request.getFinalConclusion());
        diagnostic.setStatus(DiagnosticStatus.CONFIRMED);
        return diagnosticRepository.save(diagnostic);
    }

    @Transactional
    public DiagnosticReport generateReport(String instanceId, String poolName,
                                            LocalDateTime startTime, LocalDateTime endTime) {
        List<ConnectionPoolDiagnostic> samples = diagnosticRepository.findByTimeRange(
                instanceId, poolName, startTime, endTime);
        if (samples.isEmpty()) {
            throw new IllegalArgumentException("指定时间范围内无采样数据");
        }
        int sampleCount = samples.size();
        int leakSampleCount = (int) samples.stream().filter(ConnectionPoolDiagnostic::getSuspectedLeak).count();
        Integer maxActive = diagnosticRepository.findMaxActiveConnections(instanceId, poolName, startTime, endTime);
        Integer maxWaiting = samples.stream().map(ConnectionPoolDiagnostic::getWaitingThreads).max(Integer::compareTo).orElse(0);
        Long avgUsageTime = samples.stream().mapToLong(d -> d.getConnectionUsageAvgTime() != null ? d.getConnectionUsageAvgTime() : 0L).average().isPresent() ? (long) samples.stream().mapToLong(d -> d.getConnectionUsageAvgTime() != null ? d.getConnectionUsageAvgTime() : 0L).average().getAsDouble() : 0L;
        StringBuilder stackAnalysis = new StringBuilder();
        samples.forEach(d -> {
            if (d.getStackSummary() != null) stackAnalysis.append(d.getStackSummary()).append("\n");
        });
        int leakProbability = sampleCount > 0 ? (leakSampleCount * 100 / sampleCount) : 0;
        String recommendations = buildRecommendations(leakProbability, maxActive, maxWaiting);
        String reportNo = "RPT-" + System.currentTimeMillis();
        DiagnosticReport report = DiagnosticReport.builder()
                .reportNo(reportNo).instanceId(instanceId).poolName(poolName)
                .startTime(startTime).endTime(endTime).sampleCount(sampleCount)
                .leakSampleCount(leakSampleCount).maxActiveConnections(maxActive)
                .maxWaitingThreads(maxWaiting).avgConnectionUsageTime(avgUsageTime)
                .stackAnalysis(stackAnalysis.toString()).leakProbability(leakProbability)
                .recommendations(recommendations).finalStatus(leakProbability >= 50 ? DiagnosticStatus.CONFIRMED : DiagnosticStatus.PENDING)
                .generatedBy("SYSTEM").build();
        return reportRepository.save(report);
    }

    private String buildRecommendations(int leakProbability, Integer maxActive, Integer maxWaiting) {
        StringBuilder sb = new StringBuilder();
        if (leakProbability >= 70) {
            sb.append("高概率存在连接泄漏风险，建议：\n");
            sb.append("1. 立即检查代码中未关闭的连接\n");
            sb.append("2. 检查连接池配置是否合理\n");
            sb.append("3. 增加连接超时时间设置\n");
        } else if (leakProbability >= 40) {
            sb.append("中度连接泄漏风险，建议：\n");
            sb.append("1. 关注连接池连接使用情况\n");
            sb.append("2. 检查业务访问量\n");
        } else {
            sb.append("连接池状态正常\n");
        }
        return sb.toString();
    }

    public Optional<DiagnosticReport> getReport(String reportNo) {
        return reportRepository.findByReportNo(reportNo);
    }

    public byte[] exportToExcel(DiagnosticQueryRequest request) throws Exception {
        Page<ConnectionPoolDiagnostic> page = queryDiagnostics(request);
        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("诊断记录");
        String[] headers = {"ID", "实例ID", "连接池名称", "采样时间", "总连接数", "活跃连接数", "空闲连接数", "等待线程数", "疑似泄漏", "泄漏置信度", "状态", "创建时间"};
        Row headerRow = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
        }
        List<ConnectionPoolDiagnostic> list = page.getContent();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        for (int i = 0; i < list.size(); i++) {
            ConnectionPoolDiagnostic d = list.get(i);
            Row row = sheet.createRow(i + 1);
            row.createCell(0).setCellValue(d.getId());
            row.createCell(1).setCellValue(d.getInstanceId());
            row.createCell(2).setCellValue(d.getPoolName());
            row.createCell(3).setCellValue(d.getSampleTime().format(formatter));
            row.createCell(4).setCellValue(d.getTotalConnections() != null ? d.getTotalConnections() : 0);
            row.createCell(5).setCellValue(d.getActiveConnections() != null ? d.getActiveConnections() : 0);
            row.createCell(6).setCellValue(d.getIdleConnections() != null ? d.getIdleConnections() : 0);
            row.createCell(7).setCellValue(d.getWaitingThreads() != null ? d.getWaitingThreads() : 0);
            row.createCell(8).setCellValue(d.getSuspectedLeak() ? "是" : "否");
            row.createCell(9).setCellValue(d.getLeakConfidence() != null ? d.getLeakConfidence() : 0);
            row.createCell(10).setCellValue(d.getStatus().getDescription());
            row.createCell(11).setCellValue(d.getCreatedAt().format(formatter));
        }
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        workbook.write(outputStream);
        workbook.close();
        return outputStream.toByteArray();
    }

    public String exportToJson(DiagnosticQueryRequest request) {
        Page<ConnectionPoolDiagnostic> page = queryDiagnostics(request);
        return JSON.toJSONString(page.getContent(), true);
    }

    @Transactional
    public void archiveOldRecords() {
        LocalDateTime expireTime = LocalDateTime.now().minusDays(properties.getArchive().getRetentionDays());
        diagnosticRepository.deleteExpiredRecords(expireTime);
        log.info("已归档删除 {} 天前的诊断记录", properties.getArchive().getRetentionDays());
    }

    public List<DiagnosticStatus> getAllStatuses() {
        return List.of(DiagnosticStatus.values());
    }
}
