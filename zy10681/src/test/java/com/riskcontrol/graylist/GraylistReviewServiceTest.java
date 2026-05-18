package com.riskcontrol.graylist;

import com.riskcontrol.graylist.dto.GraylistRecordDTO;
import com.riskcontrol.graylist.dto.ImportResultDTO;
import com.riskcontrol.graylist.dto.ReviewRequestDTO;
import com.riskcontrol.graylist.entity.GraylistRecord;
import com.riskcontrol.graylist.entity.ReviewHistory;
import com.riskcontrol.graylist.enums.GraylistStatus;
import com.riskcontrol.graylist.enums.ReviewConclusion;
import com.riskcontrol.graylist.repository.GraylistRecordRepository;
import com.riskcontrol.graylist.service.GraylistExportService;
import com.riskcontrol.graylist.service.GraylistImportService;
import com.riskcontrol.graylist.service.GraylistReviewService;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
@Rollback
class GraylistReviewServiceTest {

    @Autowired
    private GraylistReviewService graylistReviewService;

    @Autowired
    private GraylistImportService graylistImportService;

    @Autowired
    private GraylistExportService graylistExportService;

    @Autowired
    private GraylistRecordRepository graylistRecordRepository;

    private GraylistRecord testRecord;

    @BeforeEach
    void setUp() {
        testRecord = new GraylistRecord();
        testRecord.setCustomerId("CUST001");
        testRecord.setCustomerName("测试客户001");
        testRecord.setListReason("交易异常-大额转账");
        testRecord.setExpireTime(LocalDateTime.now().plusDays(30));
        testRecord.setStatus(GraylistStatus.IN_GRAYLIST);
        testRecord.setCreatedBy("test");
        testRecord = graylistRecordRepository.save(testRecord);
    }

    @Test
    @DisplayName("测试完整流转：灰名单中 -> 复核待办 -> 已解除")
    void testFullReviewFlow() {
        GraylistRecordDTO detailBefore = graylistReviewService.getById(testRecord.getId());
        assertEquals(GraylistStatus.IN_GRAYLIST, detailBefore.getStatus());

        ReviewRequestDTO request1 = new ReviewRequestDTO();
        request1.setRecordId(testRecord.getId());
        request1.setNewStatus(GraylistStatus.REVIEW_PENDING);
        request1.setReviewRemark("进入复核流程，需进一步核实");
        request1.setReviewer("张三");
        GraylistRecordDTO result1 = graylistReviewService.review(request1);
        assertEquals(GraylistStatus.REVIEW_PENDING, result1.getStatus());
        assertEquals("张三", result1.getReviewer());

        List<ReviewHistory> history = graylistReviewService.getHistory(testRecord.getId());
        assertFalse(history.isEmpty());
        assertEquals(GraylistStatus.IN_GRAYLIST, history.get(0).getPreviousStatus());
        assertEquals(GraylistStatus.REVIEW_PENDING, history.get(0).getNewStatus());

        ReviewRequestDTO request2 = new ReviewRequestDTO();
        request2.setRecordId(testRecord.getId());
        request2.setNewStatus(GraylistStatus.REMOVED);
        request2.setConclusion(ReviewConclusion.REMOVE_FROM_LIST);
        request2.setReviewRemark("经核实，为正常交易，解除灰名单");
        request2.setReviewer("李四");
        GraylistRecordDTO result2 = graylistReviewService.review(request2);
        assertEquals(GraylistStatus.REMOVED, result2.getStatus());

        List<ReviewHistory> historyAfter = graylistReviewService.getHistory(testRecord.getId());
        assertTrue(historyAfter.size() >= 2);
    }

    @Test
    @DisplayName("测试完整流转：灰名单中 -> 继续观察")
    void testContinueObservationFlow() {
        ReviewRequestDTO request = new ReviewRequestDTO();
        request.setRecordId(testRecord.getId());
        request.setNewStatus(GraylistStatus.UNDER_OBSERVATION);
        request.setConclusion(ReviewConclusion.CONTINUE_OBSERVATION);
        request.setReviewRemark("风险未完全排除，继续观察30天");
        request.setReviewer("王五");

        GraylistRecordDTO result = graylistReviewService.review(request);
        assertEquals(GraylistStatus.UNDER_OBSERVATION, result.getStatus());
        assertEquals("王五", result.getReviewer());

        List<ReviewHistory> history = graylistReviewService.getHistory(testRecord.getId());
        assertFalse(history.isEmpty());
    }

    @Test
    @DisplayName("测试列表查询与详情互相对齐")
    void testListAndDetailAlignment() {
        for (int i = 1; i <= 3; i++) {
            GraylistRecord record = new GraylistRecord();
            record.setCustomerId("CUST" + String.format("%03d", i + 1));
            record.setCustomerName("测试客户" + String.format("%03d", i + 1));
            record.setListReason("测试原因");
            record.setExpireTime(LocalDateTime.now().plusDays(30));
            record.setStatus(GraylistStatus.IN_GRAYLIST);
            record.setCreatedBy("test");
            graylistRecordRepository.save(record);
        }

        Page<GraylistRecordDTO> listResult = graylistReviewService.list(null, null, null, 0, 10);
        assertTrue(listResult.getTotalElements() >= 4);

        for (GraylistRecordDTO item : listResult.getContent()) {
            GraylistRecordDTO detail = graylistReviewService.getById(item.getId());
            assertEquals(item.getCustomerId(), detail.getCustomerId());
            assertEquals(item.getCustomerName(), detail.getCustomerName());
            assertEquals(item.getStatus(), detail.getStatus());
        }
    }

    @Test
    @DisplayName("测试导出功能")
    void testExport() throws IOException {
        byte[] exportData = graylistExportService.exportGraylist(null, null, null);
        assertNotNull(exportData);
        assertTrue(exportData.length > 0);
    }

    @Test
    @DisplayName("测试到期未复核自动拦截")
    void testExpiredCheck() {
        GraylistRecord expiredRecord = new GraylistRecord();
        expiredRecord.setCustomerId("EXPIRED001");
        expiredRecord.setCustomerName("到期测试客户");
        expiredRecord.setListReason("测试到期");
        expiredRecord.setExpireTime(LocalDateTime.now().minusDays(1));
        expiredRecord.setStatus(GraylistStatus.IN_GRAYLIST);
        expiredRecord.setCreatedBy("test");
        expiredRecord = graylistRecordRepository.save(expiredRecord);

        graylistReviewService.checkExpiredRecords();

        GraylistRecordDTO result = graylistReviewService.checkCustomerStatus("EXPIRED001");
        assertNotNull(result);
        assertTrue(result.getIsExpiredNotReviewed());
        assertNotNull(result.getNextStepHint());
    }

    @Test
    @DisplayName("测试批量导入：包含成功、冲突、坏行")
    void testImportWithConflictAndBadRow() throws IOException {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet();

            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("客户ID");
            header.createCell(1).setCellValue("客户名称");
            header.createCell(2).setCellValue("名单原因");
            header.createCell(3).setCellValue("到期时间");
            header.createCell(4).setCellValue("状态");

            Row row1 = sheet.createRow(1);
            row1.createCell(0).setCellValue("NEW001");
            row1.createCell(1).setCellValue("新客户001");
            row1.createCell(2).setCellValue("测试导入成功");
            row1.createCell(3).setCellValue(java.sql.Timestamp.valueOf(LocalDateTime.now().plusDays(30)));
            row1.createCell(4).setCellValue("IN_GRAYLIST");

            Row row2 = sheet.createRow(2);
            row2.createCell(0).setCellValue("CUST001");
            row2.createCell(1).setCellValue("重复客户");
            row2.createCell(2).setCellValue("测试冲突");
            row2.createCell(3).setCellValue(java.sql.Timestamp.valueOf(LocalDateTime.now().plusDays(30)));
            row2.createCell(4).setCellValue("IN_GRAYLIST");

            Row row3 = sheet.createRow(3);
            row3.createCell(0).setCellValue("");
            row3.createCell(1).setCellValue("坏行客户");
            row3.createCell(2).setCellValue("客户ID为空");
            row3.createCell(3).setCellValue(java.sql.Timestamp.valueOf(LocalDateTime.now().plusDays(30)));
            row3.createCell(4).setCellValue("IN_GRAYLIST");

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            byte[] fileBytes = out.toByteArray();

            MockMultipartFile file = new MockMultipartFile("file", "test.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileBytes);

            ImportResultDTO result = graylistImportService.importGraylist(file, "test");

            assertEquals(3, result.getTotalCount());
            assertEquals(1, result.getSuccessCount());
            assertEquals(1, result.getConflictCount());
            assertEquals(1, result.getInvalidCount());

            assertNotNull(graylistRecordRepository.findByCustomerId("NEW001"));

            assertFalse(result.getDetails().isEmpty());
        }
    }

    @Test
    @DisplayName("测试历史记录与状态变更对应")
    void testHistoryAccuracy() {
        ReviewRequestDTO request1 = new ReviewRequestDTO();
        request1.setRecordId(testRecord.getId());
        request1.setNewStatus(GraylistStatus.REVIEW_PENDING);
        request1.setReviewRemark("复核中");
        request1.setReviewer("张三");
        graylistReviewService.review(request1);

        ReviewRequestDTO request2 = new ReviewRequestDTO();
        request2.setRecordId(testRecord.getId());
        request2.setNewStatus(GraylistStatus.UNDER_OBSERVATION);
        request2.setConclusion(ReviewConclusion.CONTINUE_OBSERVATION);
        request2.setReviewRemark("继续观察");
        request2.setReviewer("李四");
        graylistReviewService.review(request2);

        List<ReviewHistory> history = graylistReviewService.getHistory(testRecord.getId());
        assertEquals(2, history.size());

        assertEquals(GraylistStatus.IN_GRAYLIST, history.get(1).getPreviousStatus());
        assertEquals(GraylistStatus.REVIEW_PENDING, history.get(1).getNewStatus());
        assertEquals("张三", history.get(1).getReviewer());

        assertEquals(GraylistStatus.REVIEW_PENDING, history.get(0).getPreviousStatus());
        assertEquals(GraylistStatus.UNDER_OBSERVATION, history.get(0).getNewStatus());
        assertEquals("李四", history.get(0).getReviewer());
        assertEquals(ReviewConclusion.CONTINUE_OBSERVATION, history.get(0).getConclusion());
    }

    @Test
    @DisplayName("测试状态筛选查询")
    void testStatusFilter() {
        GraylistRecord removedRecord = new GraylistRecord();
        removedRecord.setCustomerId("REMOVED001");
        removedRecord.setCustomerName("已解除客户");
        removedRecord.setListReason("测试");
        removedRecord.setExpireTime(LocalDateTime.now().plusDays(30));
        removedRecord.setStatus(GraylistStatus.REMOVED);
        removedRecord.setCreatedBy("test");
        graylistRecordRepository.save(removedRecord);

        Page<GraylistRecordDTO> inGraylistResult = graylistReviewService.list(null, null, GraylistStatus.IN_GRAYLIST, 0, 10);
        assertTrue(inGraylistResult.getContent().stream().allMatch(r -> r.getStatus() == GraylistStatus.IN_GRAYLIST));

        Page<GraylistRecordDTO> removedResult = graylistReviewService.list(null, null, GraylistStatus.REMOVED, 0, 10);
        assertTrue(removedResult.getContent().stream().allMatch(r -> r.getStatus() == GraylistStatus.REMOVED));
    }
}
