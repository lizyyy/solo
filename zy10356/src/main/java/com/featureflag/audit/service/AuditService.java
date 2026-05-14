package com.featureflag.audit.service;

import com.featureflag.audit.entity.AuditRecord;
import com.featureflag.audit.repository.AuditRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {
    private final AuditRecordRepository auditRecordRepository;

    public Page<AuditRecord> getAuditRecords(String experimentKey, String userIdentifier,
                                             AuditRecord.AuditStatus status,
                                             LocalDateTime startTime, LocalDateTime endTime,
                                             int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        if (experimentKey != null) {
            return auditRecordRepository.findByExperimentKey(experimentKey, pageable);
        }
        if (userIdentifier != null) {
            return auditRecordRepository.findByUserIdentifier(userIdentifier, pageable);
        }
        if (status != null) {
            return auditRecordRepository.findByStatus(status, pageable);
        }
        if (startTime != null && endTime != null) {
            return auditRecordRepository.findByTimeRange(startTime, endTime, pageable);
        }
        return auditRecordRepository.findAll(pageable);
    }

    public AuditRecord getAuditRecordById(Long id) {
        return auditRecordRepository.findById(id).orElse(null);
    }

    public AuditRecord getAuditRecordByRequestId(String requestId) {
        return auditRecordRepository.findByRequestId(requestId).orElse(null);
    }

    public List<AuditRecord> getRecentUserHits(String experimentKey, String userIdentifier, int limit) {
        Pageable pageable = PageRequest.of(0, limit);
        return auditRecordRepository.findRecentByExperimentAndUser(experimentKey, userIdentifier, pageable);
    }

    @Transactional
    public byte[] exportAuditRecords(String experimentKey, LocalDateTime startTime, LocalDateTime endTime) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             PrintWriter writer = new PrintWriter(new OutputStreamWriter(baos, StandardCharsets.UTF_8))) {

            writer.println("请求ID,实验Key,用户标识,命中结果,状态,分桶Key,分桶值,覆盖原因,覆盖类型,创建时间,更新时间");

            int page = 0;
            int size = 1000;
            boolean hasMore = true;

            while (hasMore) {
                Page<AuditRecord> recordsPage;
                if (experimentKey != null) {
                    recordsPage = auditRecordRepository.findByExperimentKey(
                            experimentKey, PageRequest.of(page, size));
                } else if (startTime != null && endTime != null) {
                    recordsPage = auditRecordRepository.findByTimeRange(
                            startTime, endTime, PageRequest.of(page, size));
                } else {
                    recordsPage = auditRecordRepository.findAll(PageRequest.of(page, size));
                }

                for (AuditRecord record : recordsPage.getContent()) {
                    writer.printf("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s%n",
                            escapeCsv(record.getRequestId()),
                            escapeCsv(record.getExperimentKey()),
                            escapeCsv(record.getUserIdentifier()),
                            escapeCsv(record.getHitResult() != null ? record.getHitResult().name() : ""),
                            escapeCsv(record.getStatus() != null ? record.getStatus().name() : ""),
                            escapeCsv(record.getBucketKey()),
                            escapeCsv(record.getBucketValue()),
                            escapeCsv(record.getOverrideReason()),
                            escapeCsv(record.getOverrideType()),
                            escapeCsv(record.getCreatedAt() != null ? record.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : ""),
                            escapeCsv(record.getUpdatedAt() != null ? record.getUpdatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : "")
                    );

                    if (record.getStatus() == AuditRecord.AuditStatus.SUCCESS) {
                        record.setStatus(AuditRecord.AuditStatus.EXPORTED);
                        auditRecordRepository.save(record);
                    }
                }

                hasMore = recordsPage.hasNext();
                page++;
            }

            writer.flush();
            return baos.toByteArray();

        } catch (Exception e) {
            log.error("导出审计记录失败", e);
            throw new RuntimeException("导出失败: " + e.getMessage());
        }
    }

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
