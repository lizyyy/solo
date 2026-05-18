package com.riskcontrol.graylist.service;

import com.riskcontrol.graylist.dto.ImportResultDTO;
import com.riskcontrol.graylist.entity.GraylistRecord;
import com.riskcontrol.graylist.entity.ImportBatch;
import com.riskcontrol.graylist.entity.ImportResultDetail;
import com.riskcontrol.graylist.enums.GraylistStatus;
import com.riskcontrol.graylist.enums.ImportResultType;
import com.riskcontrol.graylist.repository.GraylistRecordRepository;
import com.riskcontrol.graylist.repository.ImportBatchRepository;
import com.riskcontrol.graylist.repository.ImportResultDetailRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class GraylistImportService {

    private final GraylistRecordRepository graylistRecordRepository;
    private final ImportBatchRepository importBatchRepository;
    private final ImportResultDetailRepository importResultDetailRepository;

    @Transactional
    public ImportResultDTO importGraylist(MultipartFile file, String importUser) throws IOException {
        String batchNo = "IMP" + System.currentTimeMillis();
        String fileName = file.getOriginalFilename();

        ImportBatch batch = new ImportBatch();
        batch.setBatchNo(batchNo);
        batch.setFileName(fileName);
        batch.setImportUser(importUser);
        batch = importBatchRepository.save(batch);

        List<ImportResultDetail> details = new ArrayList<>();

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            int totalRows = sheet.getLastRowNum();
            int successCount = 0;
            int conflictCount = 0;
            int invalidCount = 0;

            for (int i = 1; i <= totalRows; i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                ImportResultDetail detail = new ImportResultDetail();
                detail.setBatchNo(batchNo);
                detail.setRowNumber(i + 1);

                try {
                    String customerId = getCellStringValue(row, 0);
                    String customerName = getCellStringValue(row, 1);
                    String listReason = getCellStringValue(row, 2);
                    LocalDateTime expireTime = getCellDateValue(row, 3);
                    String statusStr = getCellStringValue(row, 4);

                    detail.setCustomerId(customerId);
                    detail.setCustomerName(customerName);

                    if (customerId == null || customerId.trim().isEmpty()) {
                        detail.setResultType(ImportResultType.INVALID);
                        detail.setErrorMessage("客户ID不能为空");
                        invalidCount++;
                        details.add(detail);
                        continue;
                    }

                    if (customerName == null || customerName.trim().isEmpty()) {
                        detail.setResultType(ImportResultType.INVALID);
                        detail.setErrorMessage("客户名称不能为空");
                        invalidCount++;
                        details.add(detail);
                        continue;
                    }

                    if (listReason == null || listReason.trim().isEmpty()) {
                        detail.setResultType(ImportResultType.INVALID);
                        detail.setErrorMessage("名单原因不能为空");
                        invalidCount++;
                        details.add(detail);
                        continue;
                    }

                    if (expireTime == null) {
                        detail.setResultType(ImportResultType.INVALID);
                        detail.setErrorMessage("到期时间格式错误");
                        invalidCount++;
                        details.add(detail);
                        continue;
                    }

                    GraylistStatus status = parseStatus(statusStr);
                    if (status == null) {
                        detail.setResultType(ImportResultType.INVALID);
                        detail.setErrorMessage("状态值无效");
                        invalidCount++;
                        details.add(detail);
                        continue;
                    }

                    boolean exists = graylistRecordRepository.existsByCustomerIdAndStatusNot(customerId, GraylistStatus.REMOVED);
                    if (exists) {
                        detail.setResultType(ImportResultType.CONFLICT);
                        detail.setErrorMessage("该客户已有有效灰名单记录");
                        conflictCount++;
                        details.add(detail);
                        continue;
                    }

                    GraylistRecord record = new GraylistRecord();
                    record.setCustomerId(customerId);
                    record.setCustomerName(customerName);
                    record.setListReason(listReason);
                    record.setExpireTime(expireTime);
                    record.setStatus(status);
                    record.setBatchNo(batchNo);
                    record.setCreatedBy(importUser);
                    graylistRecordRepository.save(record);

                    detail.setResultType(ImportResultType.SUCCESS);
                    successCount++;
                    details.add(detail);

                } catch (Exception e) {
                    log.error("处理第{}行数据失败", i + 1, e);
                    detail.setResultType(ImportResultType.INVALID);
                    detail.setErrorMessage("数据处理异常: " + e.getMessage());
                    invalidCount++;
                    details.add(detail);
                }
            }

            importResultDetailRepository.saveAll(details);

            batch.setTotalCount(totalRows);
            batch.setSuccessCount(successCount);
            batch.setConflictCount(conflictCount);
            batch.setInvalidCount(invalidCount);
            importBatchRepository.save(batch);

            return buildImportResultDTO(batch, details);

        } catch (Exception e) {
            log.error("导入文件处理失败", e);
            batch.setErrorDetails(e.getMessage());
            importBatchRepository.save(batch);
            throw e;
        }
    }

    private ImportResultDTO buildImportResultDTO(ImportBatch batch, List<ImportResultDetail> details) {
        ImportResultDTO result = new ImportResultDTO();
        result.setBatchNo(batch.getBatchNo());
        result.setFileName(batch.getFileName());
        result.setTotalCount(batch.getTotalCount());
        result.setSuccessCount(batch.getSuccessCount());
        result.setConflictCount(batch.getConflictCount());
        result.setInvalidCount(batch.getInvalidCount());
        result.setImportUser(batch.getImportUser());
        result.setImportTime(batch.getImportTime());

        List<ImportResultDTO.ImportDetailDTO> detailDTOs = details.stream()
                .map(d -> {
                    ImportResultDTO.ImportDetailDTO dto = new ImportResultDTO.ImportDetailDTO();
                    dto.setRowNumber(d.getRowNumber());
                    dto.setCustomerId(d.getCustomerId());
                    dto.setCustomerName(d.getCustomerName());
                    dto.setResultType(d.getResultType().name());
                    dto.setResultDescription(d.getResultType().getDescription());
                    dto.setErrorMessage(d.getErrorMessage());
                    return dto;
                })
                .toList();
        result.setDetails(detailDTOs);

        return result;
    }

    private String getCellStringValue(Row row, int cellNum) {
        if (row.getCell(cellNum) == null) return null;
        return row.getCell(cellNum).getStringCellValue();
    }

    private LocalDateTime getCellDateValue(Row row, int cellNum) {
        if (row.getCell(cellNum) == null) return null;
        try {
            return row.getCell(cellNum).getDateCellValue()
                    .toInstant()
                    .atZone(ZoneId.systemDefault())
                    .toLocalDateTime();
        } catch (Exception e) {
            return null;
        }
    }

    private GraylistStatus parseStatus(String statusStr) {
        if (statusStr == null) return GraylistStatus.IN_GRAYLIST;
        try {
            return GraylistStatus.valueOf(statusStr);
        } catch (IllegalArgumentException e) {
            for (GraylistStatus s : GraylistStatus.values()) {
                if (s.getDescription().equals(statusStr)) {
                    return s;
                }
            }
            return null;
        }
    }
}
