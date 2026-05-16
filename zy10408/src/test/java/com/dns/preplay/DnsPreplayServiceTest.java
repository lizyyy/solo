package com.dns.preplay;

import com.dns.preplay.exception.DuplicatePreplayNameException;
import com.dns.preplay.exception.InvalidStatusTransitionException;
import com.dns.preplay.exception.PreplayNotFoundException;
import com.dns.preplay.model.dto.*;
import com.dns.preplay.model.enums.PreplayStatus;
import com.dns.preplay.model.enums.RecordType;
import com.dns.preplay.model.enums.RiskLevel;
import com.dns.preplay.service.DnsPreplayService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class DnsPreplayServiceTest {

    @Autowired
    private DnsPreplayService dnsPreplayService;

    private CreatePreplayRequest validRequest;

    @BeforeEach
    void setUp() {
        validRequest = CreatePreplayRequest.builder()
                .preplayName("测试预演")
                .description("测试描述")
                .createdBy("tester")
                .records(List.of(
                        DnsRecordDTO.builder()
                                .domainName("test.example.com")
                                .recordType(RecordType.A)
                                .oldTarget("1.1.1.1")
                                .newTarget("2.2.2.2")
                                .ttl(300)
                                .expectedTtl(300)
                                .build()
                ))
                .build();
    }

    @Test
    @DisplayName("正常流程: 创建预演 -> 计算差异 -> 检查TTL -> 推进状态 -> 完成")
    void testNormalFlow() {
        PreplayResponse created = dnsPreplayService.createPreplay(validRequest);
        assertEquals(PreplayStatus.CREATED, created.getStatus());
        assertNotNull(created.getId());

        PreplayResponse diffCalculated = dnsPreplayService.calculateDiff(created.getId());
        assertEquals(PreplayStatus.DIFF_CALCULATED, diffCalculated.getStatus());
        assertFalse(diffCalculated.getDiffResults().isEmpty());

        PreplayResponse ttlChecked = dnsPreplayService.checkTtlRisk(created.getId());
        assertEquals(PreplayStatus.TTL_CHECKED, ttlChecked.getStatus());
        assertNotNull(ttlChecked.getOverallRiskLevel());

        dnsPreplayService.updateStatus(created.getId(),
                StatusUpdateRequest.builder().targetStatus(PreplayStatus.READY_FOR_SWITCH).build());
        dnsPreplayService.updateStatus(created.getId(),
                StatusUpdateRequest.builder().targetStatus(PreplayStatus.SWITCH_CONFIRMED).build());
        dnsPreplayService.updateStatus(created.getId(),
                StatusUpdateRequest.builder().targetStatus(PreplayStatus.COMPLETED).build());

        PreplayResponse completed = dnsPreplayService.getPreplay(created.getId());
        assertEquals(PreplayStatus.COMPLETED, completed.getStatus());
        assertNotNull(completed.getCompletedAt());
    }

    @Test
    @DisplayName("脏数据测试: 创建预演时缺少必填字段")
    void testInvalidData() {
        CreatePreplayRequest invalidRequest = CreatePreplayRequest.builder()
                .preplayName(null)
                .records(List.of())
                .build();

        assertThrows(Exception.class, () -> dnsPreplayService.createPreplay(invalidRequest));
    }

    @Test
    @DisplayName("重复请求测试: 创建同名预演应抛出异常")
    void testDuplicateName() {
        dnsPreplayService.createPreplay(validRequest);
        assertThrows(DuplicatePreplayNameException.class, () -> dnsPreplayService.createPreplay(validRequest));
    }

    @Test
    @DisplayName("查询不存在的预演应抛出异常")
    void testGetNonExistentPreplay() {
        assertThrows(PreplayNotFoundException.class, () -> dnsPreplayService.getPreplay(999L));
    }

    @Test
    @DisplayName("无效的状态转换应抛出异常")
    void testInvalidStatusTransition() {
        PreplayResponse created = dnsPreplayService.createPreplay(validRequest);

        assertThrows(InvalidStatusTransitionException.class, () ->
                dnsPreplayService.updateStatus(created.getId(),
                        StatusUpdateRequest.builder().targetStatus(PreplayStatus.COMPLETED).build()));
    }

    @Test
    @DisplayName("人工修正后重新计算流程")
    void testManualCorrectionAndRecalculate() {
        PreplayResponse created = dnsPreplayService.createPreplay(validRequest);
        dnsPreplayService.calculateDiff(created.getId());
        dnsPreplayService.checkTtlRisk(created.getId());

        ManualCorrectionRequest correctionRequest = ManualCorrectionRequest.builder()
                .correctionReason("修正了错误的旧IP地址")
                .correctedRecords(List.of(
                        DnsRecordDTO.builder()
                                .domainName("test.example.com")
                                .recordType(RecordType.A)
                                .oldTarget("3.3.3.3")
                                .newTarget("2.2.2.2")
                                .ttl(60)
                                .expectedTtl(300)
                                .build()
                ))
                .build();

        PreplayResponse corrected = dnsPreplayService.applyManualCorrection(created.getId(), correctionRequest);
        assertEquals(PreplayStatus.CREATED, corrected.getStatus());
        assertTrue(corrected.getRecords().get(0).getIsManualCorrected());

        PreplayResponse recalculated = dnsPreplayService.calculateDiff(created.getId());
        assertEquals(PreplayStatus.DIFF_CALCULATED, recalculated.getStatus());
    }

    @Test
    @DisplayName("TTL高风险场景验证")
    void testHighTtlRisk() {
        CreatePreplayRequest highRiskRequest = CreatePreplayRequest.builder()
                .preplayName("高风险TTL测试")
                .createdBy("tester")
                .records(List.of(
                        DnsRecordDTO.builder()
                                .domainName("high-risk.example.com")
                                .recordType(RecordType.A)
                                .oldTarget("1.1.1.1")
                                .newTarget("2.2.2.2")
                                .ttl(7200)
                                .expectedTtl(300)
                                .build()
                ))
                .build();

        PreplayResponse created = dnsPreplayService.createPreplay(highRiskRequest);
        dnsPreplayService.calculateDiff(created.getId());
        PreplayResponse result = dnsPreplayService.checkTtlRisk(created.getId());

        assertEquals(RiskLevel.HIGH, result.getOverallRiskLevel());
        assertTrue(result.getConclusion().contains("高风险TTL"));
    }

    @Test
    @DisplayName("导出预演报告功能")
    void testExportReport() {
        PreplayResponse created = dnsPreplayService.createPreplay(validRequest);
        dnsPreplayService.calculateDiff(created.getId());
        dnsPreplayService.checkTtlRisk(created.getId());

        String report = dnsPreplayService.exportPreplayReport(created.getId());

        assertNotNull(report);
        assertTrue(report.contains("DNS切换预演报告"));
        assertTrue(report.contains("test.example.com"));
        assertTrue(report.contains("TTL风险等级"));
    }

    @Test
    @DisplayName("按名称查询预演")
    void testGetPreplayByName() {
        dnsPreplayService.createPreplay(validRequest);
        PreplayResponse found = dnsPreplayService.getPreplayByName("测试预演");
        assertNotNull(found);
        assertEquals("测试预演", found.getPreplayName());
    }

    @Test
    @DisplayName("查询所有预演")
    void testGetAllPreplays() {
        dnsPreplayService.createPreplay(validRequest);

        CreatePreplayRequest anotherRequest = CreatePreplayRequest.builder()
                .preplayName("另一个测试")
                .createdBy("tester")
                .records(List.of(
                        DnsRecordDTO.builder()
                                .domainName("another.example.com")
                                .recordType(RecordType.A)
                                .ttl(300)
                                .build()
                ))
                .build();
        dnsPreplayService.createPreplay(anotherRequest);

        List<PreplayResponse> all = dnsPreplayService.getAllPreplays();
        assertEquals(2, all.size());
    }

    @Test
    @DisplayName("删除预演")
    void testDeletePreplay() {
        PreplayResponse created = dnsPreplayService.createPreplay(validRequest);
        assertNotNull(dnsPreplayService.getPreplay(created.getId()));

        dnsPreplayService.deletePreplay(created.getId());
        assertThrows(PreplayNotFoundException.class, () -> dnsPreplayService.getPreplay(created.getId()));
    }

    @Test
    @DisplayName("记录回滚信息")
    void testRollbackRecording() {
        PreplayResponse created = dnsPreplayService.createPreplay(validRequest);
        dnsPreplayService.calculateDiff(created.getId());
        dnsPreplayService.checkTtlRisk(created.getId());
        dnsPreplayService.updateStatus(created.getId(),
                StatusUpdateRequest.builder().targetStatus(PreplayStatus.READY_FOR_SWITCH).build());
        dnsPreplayService.updateStatus(created.getId(),
                StatusUpdateRequest.builder().targetStatus(PreplayStatus.SWITCH_CONFIRMED).build());

        StatusUpdateRequest rollbackRequest = StatusUpdateRequest.builder()
                .targetStatus(PreplayStatus.ROLLBACK_RECORDED)
                .comment("切换后出现问题，已回滚到旧IP: 1.1.1.1")
                .build();

        PreplayResponse result = dnsPreplayService.updateStatus(created.getId(), rollbackRequest);
        assertEquals(PreplayStatus.ROLLBACK_RECORDED, result.getStatus());
        assertNotNull(result.getRollbackNotes());
        assertTrue(result.getRollbackNotes().contains("已回滚到旧IP"));
    }
}
