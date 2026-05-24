package com.pottery.kilnqueue.service;

import com.pottery.kilnqueue.entity.FiringReport;
import com.pottery.kilnqueue.entity.KilnBatch;
import com.pottery.kilnqueue.entity.QueueRecord;
import com.pottery.kilnqueue.entity.Work;
import com.pottery.kilnqueue.enums.BatchStatus;
import com.pottery.kilnqueue.exception.BusinessException;
import com.pottery.kilnqueue.repository.FiringReportRepository;
import com.pottery.kilnqueue.repository.KilnBatchRepository;
import com.pottery.kilnqueue.repository.QueueRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ReportService {

    private static final Logger log = LoggerFactory.getLogger(ReportService.class);

    private final FiringReportRepository firingReportRepository;
    private final KilnBatchRepository kilnBatchRepository;
    private final QueueRecordRepository queueRecordRepository;

    public ReportService(FiringReportRepository firingReportRepository,
                         KilnBatchRepository kilnBatchRepository,
                         QueueRecordRepository queueRecordRepository) {
        this.firingReportRepository = firingReportRepository;
        this.kilnBatchRepository = kilnBatchRepository;
        this.queueRecordRepository = queueRecordRepository;
    }

    @Transactional
    public void generateBatchReports(String batchNo) {
        KilnBatch batch = kilnBatchRepository.findByBatchNo(batchNo)
            .orElseThrow(() -> BusinessException.notFound("批次不存在"));

        if (batch.getStatus() != BatchStatus.COMPLETED) {
            throw BusinessException.invalidStatusTransition("只有已完成的批次可以生成报告");
        }

        List<QueueRecord> records = queueRecordRepository.findByBatchId(batch.getId());
        int reportCount = 1;

        for (QueueRecord record : records) {
            String reportNo = batchNo + "-R" + String.format("%03d", reportCount);

            if (firingReportRepository.existsByReportNo(reportNo)) {
                reportCount++;
                continue;
            }

            Work work = record.getWork();
            FiringReport report = new FiringReport();
            report.setReportNo(reportNo);
            report.setBatch(batch);
            report.setWork(work);
            report.setWorkNo(work.getWorkNo());
            report.setWorkName(work.getName());
            report.setStudentName(work.getStudent().getName());
            report.setStudentNo(work.getStudent().getStudentNo());
            report.setGlazeCodes(work.getGlazeCodes());
            report.setSuccess(true);
            report.setFiringResult("烧制完成");

            firingReportRepository.save(report);
            reportCount++;
        }

        log.info("批次 {} 已生成 {} 份烧制报告", batchNo, records.size());
    }

    public List<FiringReport> getBatchReports(String batchNo) {
        KilnBatch batch = kilnBatchRepository.findByBatchNo(batchNo)
            .orElseThrow(() -> BusinessException.notFound("批次不存在"));
        return firingReportRepository.findByBatchId(batch.getId());
    }

    public List<FiringReport> getWorkReports(String workNo) {
        Work work = queueRecordRepository.findAll().stream()
            .filter(r -> r.getWork().getWorkNo().equals(workNo))
            .findFirst()
            .map(r -> r.getWork())
            .orElseThrow(() -> BusinessException.notFound("作品不存在"));
        return firingReportRepository.findByWorkId(work.getId());
    }

    public List<FiringReport> getStudentReports(String studentNo) {
        return firingReportRepository.findByStudentNo(studentNo);
    }

    public Map<String, Object> getBatchStatistics(String batchNo) {
        KilnBatch batch = kilnBatchRepository.findByBatchNo(batchNo)
            .orElseThrow(() -> BusinessException.notFound("批次不存在"));

        Map<String, Object> stats = new HashMap<>();
        stats.put("batchNo", batch.getBatchNo());
        stats.put("batchName", batch.getName());
        stats.put("status", batch.getStatus());
        stats.put("firingType", batch.getFiringType());
        stats.put("scheduledTime", batch.getScheduledTime());
        stats.put("actualStartTime", batch.getActualStartTime());
        stats.put("actualEndTime", batch.getActualEndTime());

        Long totalWorks = firingReportRepository.countByBatchId(batch.getId());
        Long successWorks = firingReportRepository.countSuccessByBatchId(batch.getId());

        stats.put("totalWorks", totalWorks);
        stats.put("successWorks", successWorks);
        stats.put("successRate", totalWorks > 0 ? (successWorks * 100.0 / totalWorks) : 0);

        List<FiringReport> reports = firingReportRepository.findByBatchId(batch.getId());
        long thickBodyCount = reports.stream()
            .filter(r -> {
                List<QueueRecord> records = queueRecordRepository.findByWorkId(r.getWork().getId());
                return !records.isEmpty() && records.get(0).getWork().getIsThickBody();
            })
            .count();
        stats.put("thickBodyCount", thickBodyCount);

        return stats;
    }

    public String exportBatchAsCsv(String batchNo) {
        List<FiringReport> reports = getBatchReports(batchNo);
        StringBuilder sb = new StringBuilder();

        sb.append("报告编号,批次编号,作品编号,作品名称,学员编号,学员姓名,釉料,是否成功,结果,创建时间\n");

        for (FiringReport report : reports) {
            sb.append(report.getReportNo()).append(",");
            sb.append(report.getBatch().getBatchNo()).append(",");
            sb.append(report.getWorkNo()).append(",");
            sb.append(escapeCsv(report.getWorkName())).append(",");
            sb.append(report.getStudentNo()).append(",");
            sb.append(escapeCsv(report.getStudentName())).append(",");
            sb.append(escapeCsv(report.getGlazeCodes())).append(",");
            sb.append(report.getSuccess()).append(",");
            sb.append(escapeCsv(report.getFiringResult())).append(",");
            sb.append(report.getCreatedAt()).append("\n");
        }

        return sb.toString();
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
