package com.hotel.lostfound.service;

import com.hotel.lostfound.dto.request.ExportRequest;
import com.hotel.lostfound.dto.request.QueryLostItemRequest;
import com.hotel.lostfound.dto.response.LostItemListVO;
import com.hotel.lostfound.entity.LostItem;
import com.hotel.lostfound.exception.BusinessException;
import com.hotel.lostfound.repository.LostItemRepository;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
public class ExportService {

    private static final Logger log = LoggerFactory.getLogger(ExportService.class);

    private final LostItemRepository lostItemRepository;
    private final IdempotentService idempotentService;

    public ExportService(LostItemRepository lostItemRepository, IdempotentService idempotentService) {
        this.lostItemRepository = lostItemRepository;
        this.idempotentService = idempotentService;
    }

    @Transactional(readOnly = true)
    public byte[] exportLostItems(ExportRequest request) {
        String operationType = "EXPORT";
        idempotentService.checkDuplicate(request.getRequestId(), operationType);

        QueryLostItemRequest queryRequest = new QueryLostItemRequest();
        queryRequest.setItemNo(request.getItemNo());
        queryRequest.setItemName(request.getItemName());
        queryRequest.setCategory(request.getCategory());
        queryRequest.setStatus(request.getStatus());
        queryRequest.setRoomNumber(request.getRoomNumber());
        queryRequest.setPickedByStaff(request.getPickedByStaff());
        queryRequest.setFoundTimeStart(request.getFoundTimeStart());
        queryRequest.setFoundTimeEnd(request.getFoundTimeEnd());

        Specification<LostItem> spec = buildSpecification(queryRequest);
        List<LostItem> items = lostItemRepository.findAll(spec);

        if (items.isEmpty()) {
            throw new BusinessException("没有可导出的数据");
        }

        byte[] result = generateExcel(items);
        
        idempotentService.recordResult(request.getRequestId(), operationType, 
                "导出成功，共" + items.size() + "条记录", true);
        
        return result;
    }

    private byte[] generateExcel(List<LostItem> items) {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("遗失物品记录");

            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle dataStyle = createDataStyle(workbook);

            String[] headers = {
                "物品编号", "物品名称", "分类", "预估价值", "是否贵重", 
                "房号", "拾取位置", "拾取员工", "存放位置", "状态",
                "拾取时间", "到期时间", "失主姓名", "失主电话", "是否已核验",
                "创建时间"
            };

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
            int rowNum = 1;
            for (LostItem item : items) {
                Row row = sheet.createRow(rowNum++);
                
                createCell(row, 0, item.getItemNo(), dataStyle);
                createCell(row, 1, item.getItemName(), dataStyle);
                createCell(row, 2, item.getCategory() != null ? item.getCategory().name() : "", dataStyle);
                createCell(row, 3, item.getEstimatedValue() != null ? item.getEstimatedValue().toString() : "0", dataStyle);
                createCell(row, 4, item.isValuable() ? "是" : "否", dataStyle);
                createCell(row, 5, item.getRoomNumber() != null ? item.getRoomNumber() : "", dataStyle);
                createCell(row, 6, item.getPickUpLocation() != null ? item.getPickUpLocation() : "", dataStyle);
                createCell(row, 7, item.getPickedByStaff(), dataStyle);
                createCell(row, 8, item.getStorageLocation() != null ? item.getStorageLocation() : "", dataStyle);
                createCell(row, 9, item.getStatus() != null ? item.getStatus().name() : "", dataStyle);
                createCell(row, 10, item.getFoundTime() != null ? item.getFoundTime().format(formatter) : "", dataStyle);
                createCell(row, 11, item.getExpiredTime() != null ? item.getExpiredTime().format(formatter) : "", dataStyle);
                createCell(row, 12, item.getOwnerName() != null ? item.getOwnerName() : "", dataStyle);
                createCell(row, 13, item.getOwnerPhone() != null ? item.getOwnerPhone() : "", dataStyle);
                createCell(row, 14, item.isVerified() ? "是" : "否", dataStyle);
                createCell(row, 15, item.getCreatedAt() != null ? item.getCreatedAt().format(formatter) : "", dataStyle);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();

        } catch (Exception e) {
            log.error("导出Excel失败", e);
            throw new BusinessException("导出失败: " + e.getMessage());
        }
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private CellStyle createDataStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private void createCell(Row row, int column, String value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value);
        cell.setCellStyle(style);
    }

    private Specification<LostItem> buildSpecification(QueryLostItemRequest request) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (request.getItemNo() != null) {
                predicates.add(cb.like(root.get("itemNo"), "%" + request.getItemNo() + "%"));
            }
            if (request.getItemName() != null) {
                predicates.add(cb.like(root.get("itemName"), "%" + request.getItemName() + "%"));
            }
            if (request.getCategory() != null) {
                predicates.add(cb.equal(root.get("category"), request.getCategory()));
            }
            if (request.getStatus() != null) {
                predicates.add(cb.equal(root.get("status"), request.getStatus()));
            }
            if (request.getRoomNumber() != null) {
                predicates.add(cb.equal(root.get("roomNumber"), request.getRoomNumber()));
            }
            if (request.getPickedByStaff() != null) {
                predicates.add(cb.equal(root.get("pickedByStaff"), request.getPickedByStaff()));
            }
            if (request.getFoundTimeStart() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("foundTime"), request.getFoundTimeStart()));
            }
            if (request.getFoundTimeEnd() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("foundTime"), request.getFoundTimeEnd()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
