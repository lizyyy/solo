package com.school.canteen.service;

import com.school.canteen.entity.*;
import com.school.canteen.exception.BusinessException;
import com.school.canteen.repository.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class ReportService {

    private static final Logger log = LoggerFactory.getLogger(ReportService.class);

    private final MealReportRepository mealReportRepository;
    private final ReplacementRequestRepository replacementRepository;
    private final ParentConfirmationRepository confirmationRepository;
    private final StudentRepository studentRepository;

    @Autowired
    public ReportService(MealReportRepository mealReportRepository,
                         ReplacementRequestRepository replacementRepository,
                         ParentConfirmationRepository confirmationRepository,
                         StudentRepository studentRepository) {
        this.mealReportRepository = mealReportRepository;
        this.replacementRepository = replacementRepository;
        this.confirmationRepository = confirmationRepository;
        this.studentRepository = studentRepository;
    }

    @Transactional
    public MealReport generateMealReport(LocalDate mealDate, String mealType, String operator) {
        log.info("生成供餐报告: {} {}", mealDate, mealType);

        if (mealReportRepository.existsByMealDateAndMealTypeAndFinalizedTrue(mealDate, mealType)) {
            throw new BusinessException("该餐次报告已终审，无法重新生成", "REPORT_FINALIZED");
        }

        List<ReplacementRequest> replacements = replacementRepository
            .findActiveReplacements(mealDate, mealType);

        int totalStudents = (int) studentRepository.countActiveStudents();
        int replacementCount = replacements.size();
        int affectedStudentsCount = 0;
        int confirmedCount = 0;
        int pendingCount = 0;
        int rejectedCount = 0;
        int allergenConflictCount = 0;

        StringBuilder reportContent = new StringBuilder();
        reportContent.append("供餐报告 - ").append(mealDate).append(" ").append(mealType).append("\n\n");

        for (ReplacementRequest rep : replacements) {
            affectedStudentsCount += rep.getAffectedStudents().size();

            if (rep.getAffectedStudents() != null && !rep.getAffectedStudents().isEmpty()) {
                allergenConflictCount++;
            }

            long conf = confirmationRepository.countByReplacementIdAndStatus(rep.getId(), "CONFIRMED");
            long pend = confirmationRepository.countByReplacementIdAndStatus(rep.getId(), "PENDING");
            long rej = confirmationRepository.countByReplacementIdAndStatus(rep.getId(), "REJECTED");

            confirmedCount += conf;
            pendingCount += pend;
            rejectedCount += rej;

            reportContent.append("替换请求: ").append(rep.getRequestNo()).append("\n");
            reportContent.append("  原菜品: ").append(rep.getOriginalDish().getName()).append("\n");
            reportContent.append("  替换菜品: ").append(rep.getReplacementDish().getName()).append("\n");
            reportContent.append("  状态: ").append(rep.getStatus()).append("\n");
            reportContent.append("  影响学生: ").append(rep.getAffectedStudents().size()).append("人\n");
            reportContent.append("  回执: 已确认").append(conf).append(" 待确认").append(pend).append(" 已拒绝").append(rej).append("\n\n");
        }

        MealReport report = mealReportRepository.findByMealDateAndMealType(mealDate, mealType)
            .orElse(new MealReport());

        report.setReportNo(generateReportNo(mealDate, mealType));
        report.setMealDate(mealDate);
        report.setMealType(mealType);
        report.setTotalStudents(totalStudents);
        report.setAffectedStudentsCount(affectedStudentsCount);
        report.setConfirmedCount(confirmedCount);
        report.setPendingConfirmationCount(pendingCount);
        report.setRejectedCount(rejectedCount);
        report.setReplacementCount(replacementCount);
        report.setAllergenConflictCount(allergenConflictCount);
        report.setReportContent(reportContent.toString());
        report.setGeneratedBy(operator);
        report.setGeneratedAt(LocalDateTime.now());
        report.setFinalized(false);

        return mealReportRepository.save(report);
    }

    @Transactional
    public MealReport finalizeReport(Long reportId, String operator) {
        MealReport report = mealReportRepository.findById(reportId)
            .orElseThrow(() -> new BusinessException("报告不存在", "REPORT_NOT_FOUND"));

        if (report.getFinalized()) {
            throw new BusinessException("报告已终审", "REPORT_FINALIZED");
        }

        report.setFinalized(true);
        report.setReviewedBy(operator);
        report.setReviewedAt(LocalDateTime.now());

        List<ReplacementRequest> replacements = replacementRepository
            .findActiveReplacements(report.getMealDate(), report.getMealType());

        for (ReplacementRequest rep : replacements) {
            if (rep.getStatus() == ReplacementStatus.COMPLETED) {
                rep.setLocked(true);
                rep.setStatus(ReplacementStatus.LOCKED);
                replacementRepository.save(rep);
            }
        }

        return mealReportRepository.save(report);
    }

    @Transactional(readOnly = true)
    public byte[] exportReportToExcel(Long reportId) {
        MealReport report = mealReportRepository.findById(reportId)
            .orElseThrow(() -> new BusinessException("报告不存在", "REPORT_NOT_FOUND"));

        List<ReplacementRequest> replacements = replacementRepository
            .findActiveReplacements(report.getMealDate(), report.getMealType());

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("供餐报告");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            int rowNum = 0;

            Row titleRow = sheet.createRow(rowNum++);
            titleRow.createCell(0).setCellValue("供餐报告");

            Row infoRow = sheet.createRow(rowNum++);
            infoRow.createCell(0).setCellValue("日期: " + report.getMealDate());
            infoRow.createCell(2).setCellValue("餐次: " + report.getMealType());

            rowNum++;

            String[] headers = {"统计项", "数值"};
            Row headerRow = sheet.createRow(rowNum++);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            Object[][] stats = {
                {"学生总数", report.getTotalStudents()},
                {"替换菜品数", report.getReplacementCount()},
                {"过敏原冲突数", report.getAllergenConflictCount()},
                {"影响学生数", report.getAffectedStudentsCount()},
                {"已确认回执", report.getConfirmedCount()},
                {"待确认回执", report.getPendingConfirmationCount()},
                {"已拒绝回执", report.getRejectedCount()},
                {"报告状态", report.getFinalized() ? "已终审" : "草稿"}
            };

            for (Object[] stat : stats) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(stat[0].toString());
                row.createCell(1).setCellValue(stat[1].toString());
            }

            rowNum += 2;

            String[] repHeaders = {"替换编号", "原菜品", "替换菜品", "状态", "影响学生数", "已确认", "待确认", "已拒绝"};
            Row repHeaderRow = sheet.createRow(rowNum++);
            for (int i = 0; i < repHeaders.length; i++) {
                Cell cell = repHeaderRow.createCell(i);
                cell.setCellValue(repHeaders[i]);
                cell.setCellStyle(headerStyle);
            }

            for (ReplacementRequest rep : replacements) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(rep.getRequestNo());
                row.createCell(1).setCellValue(rep.getOriginalDish().getName());
                row.createCell(2).setCellValue(rep.getReplacementDish().getName());
                row.createCell(3).setCellValue(rep.getStatus().toString());
                row.createCell(4).setCellValue(rep.getAffectedStudents().size());
                row.createCell(5).setCellValue(
                    confirmationRepository.countByReplacementIdAndStatus(rep.getId(), "CONFIRMED"));
                row.createCell(6).setCellValue(
                    confirmationRepository.countByReplacementIdAndStatus(rep.getId(), "PENDING"));
                row.createCell(7).setCellValue(
                    confirmationRepository.countByReplacementIdAndStatus(rep.getId(), "REJECTED"));
            }

            for (int i = 0; i < 8; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();

        } catch (Exception e) {
            log.error("导出Excel失败", e);
            throw new BusinessException("导出Excel失败: " + e.getMessage(), "EXPORT_ERROR");
        }
    }

    @Transactional(readOnly = true)
    public MealReport getReport(Long id) {
        return mealReportRepository.findById(id)
            .orElseThrow(() -> new BusinessException("报告不存在", "REPORT_NOT_FOUND"));
    }

    @Transactional(readOnly = true)
    public List<MealReport> getAllReports() {
        return mealReportRepository.findAll();
    }

    private String generateReportNo(LocalDate date, String mealType) {
        return "RPT" + date.format(DateTimeFormatter.ofPattern("yyyyMMdd")) + mealType;
    }
}
