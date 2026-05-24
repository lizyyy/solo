package com.factory.gauge.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.factory.gauge.dto.request.*;
import com.factory.gauge.entity.*;
import com.factory.gauge.entity.enums.*;
import com.factory.gauge.repository.MeasuringToolRepository;
import com.factory.gauge.service.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Component
public class SampleDataInitializer implements CommandLineRunner {


    private static final Logger log = LoggerFactory.getLogger(SampleDataInitializer.class);
    private final MeasuringToolService measuringToolService;

    public SampleDataInitializer(MeasuringToolService measuringToolService, ProductBatchService productBatchService, ReinspectionService reinspectionService, DeactivationService deactivationService, CalibrationReportService calibrationReportService, MeasuringToolRepository measuringToolRepository) {
        this.measuringToolService = measuringToolService;
        this.productBatchService = productBatchService;
        this.reinspectionService = reinspectionService;
        this.deactivationService = deactivationService;
        this.calibrationReportService = calibrationReportService;
        this.measuringToolRepository = measuringToolRepository;
    }
    private final ProductBatchService productBatchService;
    private final ReinspectionService reinspectionService;
    private final DeactivationService deactivationService;
    private final CalibrationReportService calibrationReportService;
    private final MeasuringToolRepository measuringToolRepository;

    @Override
    public void run(String... args) {
        if (measuringToolRepository.existsByToolNo("G-001-NORMAL")) {
            log.info("样例数据已存在，跳过初始化");
            return;
        }

        log.info("开始初始化样例数据...");

        // ============ 场景1: 正常流程 ============
        log.info("=== 场景1: 正常流程 ===");
        createNormalScenario();

        // ============ 场景2: 冲突场景（过期量具仍使用） ============
        log.info("=== 场景2: 冲突场景（过期量具仍使用） ===");
        createConflictScenario();

        // ============ 场景3: 撤回/重新启用 ============
        log.info("=== 场景3: 撤回/重新启用 ===");
        createWithdrawalScenario();

        // ============ 场景4: 人工修正 ============
        log.info("=== 场景4: 人工修正 ===");
        createCorrectionScenario();

        // ============ 场景5: 证书版本错误 ============
        log.info("=== 场景5: 证书版本错误 ===");
        createCertificateVersionScenario();

        // ============ 场景6: 复检后批次未解锁问题 ============
        log.info("=== 场景6: 复检后批次未解锁问题 ===");
        createUnlockIssueScenario();

        log.info("样例数据初始化完成！");
    }

    private void createNormalScenario() {
        String toolNo = "G-001-NORMAL";
        
        GaugeRegisterRequest gaugeReq = new GaugeRegisterRequest();
        gaugeReq.setToolNo(toolNo);
        gaugeReq.setToolName("数显游标卡尺");
        gaugeReq.setSpecification("0-300mm");
        gaugeReq.setCalibrationCertificateNo("CAL-2026-001");
        gaugeReq.setCalibrationDate(LocalDate.now().minusMonths(6));
        gaugeReq.setValidUntilDate(LocalDate.now().plusMonths(6));
        gaugeReq.setOperator("张工");
        gaugeReq.setRemarks("正常量具-正常流程样例");
        measuringToolService.registerGauge(gaugeReq);

        CalibrationReportRequest reportReq = new CalibrationReportRequest();
        reportReq.setToolNo(toolNo);
        reportReq.setCertificateNo("CAL-2026-001");
        reportReq.setCalibrationDate(LocalDate.now().minusMonths(6));
        reportReq.setValidUntilDate(LocalDate.now().plusMonths(6));
        reportReq.setCalibrationAgency("市计量检定所");
        reportReq.setCalibrator("李检定员");
        reportReq.setCalibrationItems("示值误差、重复性");
        reportReq.setCalibrationResult("全部项目合格");
        reportReq.setIsPassed(true);
        reportReq.setOperator("张工");
        calibrationReportService.addReport(reportReq);

        BatchRegisterRequest batchReq1 = new BatchRegisterRequest();
        batchReq1.setBatchNo("B-2026-0524-001");
        batchReq1.setProductName("法兰盘-A型");
        batchReq1.setToolNo(toolNo);
        batchReq1.setQuantity(100);
        batchReq1.setProductionLine("机加工线A");
        batchReq1.setOperator("王班长");
        batchReq1.setRemarks("正常流程批次1");
        productBatchService.registerBatch(batchReq1);

        BatchRegisterRequest batchReq2 = new BatchRegisterRequest();
        batchReq2.setBatchNo("B-2026-0524-002");
        batchReq2.setProductName("法兰盘-B型");
        batchReq2.setToolNo(toolNo);
        batchReq2.setQuantity(150);
        batchReq2.setProductionLine("机加工线A");
        batchReq2.setOperator("王班长");
        batchReq2.setRemarks("正常流程批次2-已关闭");
        ProductBatch batch2 = productBatchService.registerBatch(batchReq2);
        productBatchService.closeBatch(batch2.getBatchNo(), "张工");

        log.info("正常流程场景: 量具 {}, 批次2个(其中1个已关闭)", toolNo);
    }

    private void createConflictScenario() {
        String toolNo = "G-002-EXPIRED";
        
        GaugeRegisterRequest gaugeReq = new GaugeRegisterRequest();
        gaugeReq.setToolNo(toolNo);
        gaugeReq.setToolName("外径千分尺");
        gaugeReq.setSpecification("25-50mm");
        gaugeReq.setCalibrationCertificateNo("CAL-2025-088");
        gaugeReq.setCalibrationDate(LocalDate.now().minusYears(1));
        gaugeReq.setValidUntilDate(LocalDate.now().minusDays(7));
        gaugeReq.setOperator("刘工");
        gaugeReq.setRemarks("过期量具-冲突场景样例");
        measuringToolService.registerGauge(gaugeReq);

        try {
            BatchRegisterRequest batchReq = new BatchRegisterRequest();
            batchReq.setBatchNo("B-2026-0524-003");
            batchReq.setProductName("轴承座");
            batchReq.setToolNo(toolNo);
            batchReq.setQuantity(80);
            batchReq.setProductionLine("机加工线B");
            batchReq.setOperator("赵班长");
            productBatchService.registerBatch(batchReq);
            log.warn("冲突场景: 异常！过期量具登记批次未被拦截");
        } catch (Exception e) {
            log.info("冲突场景: 正确拦截 - {}", e.getMessage());
        }

        String validToolNo = "G-002-VALID";
        GaugeRegisterRequest validGaugeReq = new GaugeRegisterRequest();
        validGaugeReq.setToolNo(validToolNo);
        validGaugeReq.setToolName("内径百分表");
        validGaugeReq.setSpecification("18-35mm");
        validGaugeReq.setCalibrationCertificateNo("CAL-2026-002");
        validGaugeReq.setCalibrationDate(LocalDate.now().minusMonths(3));
        validGaugeReq.setValidUntilDate(LocalDate.now().plusMonths(9));
        validGaugeReq.setOperator("刘工");
        validGaugeReq.setRemarks("正常量具-用于演示锁定关联批次");
        measuringToolService.registerGauge(validGaugeReq);

        BatchRegisterRequest batchReq1 = new BatchRegisterRequest();
        batchReq1.setBatchNo("B-2026-0524-004");
        batchReq1.setProductName("缸套");
        batchReq1.setToolNo(validToolNo);
        batchReq1.setQuantity(50);
        batchReq1.setProductionLine("机加工线B");
        batchReq1.setOperator("赵班长");
        productBatchService.registerBatch(batchReq1);

        BatchRegisterRequest batchReq2 = new BatchRegisterRequest();
        batchReq2.setBatchNo("B-2026-0524-005");
        batchReq2.setProductName("活塞");
        batchReq2.setToolNo(validToolNo);
        batchReq2.setQuantity(60);
        batchReq2.setProductionLine("机加工线B");
        batchReq2.setOperator("赵班长");
        productBatchService.registerBatch(batchReq2);

        productBatchService.lockBatchesByExpiredTool(validToolNo, "量具过期追溯锁定", "质检系统");
        log.info("冲突场景: 量具 {} 关联批次已被批量锁定", validToolNo);
    }

    private void createWithdrawalScenario() {
        String toolNo = "G-003-WITHDRAW";
        
        GaugeRegisterRequest gaugeReq = new GaugeRegisterRequest();
        gaugeReq.setToolNo(toolNo);
        gaugeReq.setToolName("高度尺");
        gaugeReq.setSpecification("0-600mm");
        gaugeReq.setCalibrationCertificateNo("CAL-2026-003");
        gaugeReq.setCalibrationDate(LocalDate.now().minusMonths(2));
        gaugeReq.setValidUntilDate(LocalDate.now().plusMonths(10));
        gaugeReq.setOperator("陈工");
        gaugeReq.setRemarks("停用后重新启用-撤回场景样例");
        measuringToolService.registerGauge(gaugeReq);

        DeactivationRequest deactReq = new DeactivationRequest();
        deactReq.setToolNo(toolNo);
        deactReq.setReason("量具示值超差");
        deactReq.setDescription("日常自检发现0-300mm段示值超差0.02mm");
        deactReq.setOperator("质检组");
        deactReq.setRemarks("临时停用待维修");
        deactivationService.deactivateGauge(deactReq);
        log.info("撤回场景: 量具 {} 已停用", toolNo);

        try {
            BatchRegisterRequest batchReq = new BatchRegisterRequest();
            batchReq.setBatchNo("B-2026-0524-006");
            batchReq.setProductName("导轨");
            batchReq.setToolNo(toolNo);
            batchReq.setQuantity(30);
            batchReq.setProductionLine("机加工线C");
            batchReq.setOperator("孙班长");
            productBatchService.registerBatch(batchReq);
            log.warn("撤回场景: 异常！停用量具登记批次未被拦截");
        } catch (Exception e) {
            log.info("撤回场景: 正确拦截停用状态 - {}", e.getMessage());
        }

        deactivationService.reactivateGauge(toolNo, "量具维修后重新校准合格", "计量室");
        log.info("撤回场景: 量具 {} 已重新启用", toolNo);

        BatchRegisterRequest batchReq = new BatchRegisterRequest();
        batchReq.setBatchNo("B-2026-0524-007");
        batchReq.setProductName("滑块");
        batchReq.setToolNo(toolNo);
        batchReq.setQuantity(45);
        batchReq.setProductionLine("机加工线C");
        batchReq.setOperator("孙班长");
        batchReq.setRemarks("量具重新启用后正常批次");
        productBatchService.registerBatch(batchReq);
        log.info("撤回场景: 量具重新启用后成功登记批次");
    }

    private void createCorrectionScenario() {
        String toolNo = "G-004-CORRECT";
        
        GaugeRegisterRequest gaugeReq = new GaugeRegisterRequest();
        gaugeReq.setToolNo(toolNo);
        gaugeReq.setToolName("杠杆百分表");
        gaugeReq.setSpecification("0-0.8mm");
        gaugeReq.setCalibrationCertificateNo("CAL-2026-004");
        gaugeReq.setCalibrationDate(LocalDate.now().minusMonths(4));
        gaugeReq.setValidUntilDate(LocalDate.now().plusMonths(8));
        gaugeReq.setOperator("周工");
        gaugeReq.setRemarks("人工修正场景样例");
        measuringToolService.registerGauge(gaugeReq);

        BatchRegisterRequest batchReq = new BatchRegisterRequest();
        batchReq.setBatchNo("B-2026-0524-008");
        batchReq.setProductName("精密齿轮");
        batchReq.setToolNo(toolNo);
        batchReq.setQuantity(200);
        batchReq.setProductionLine("精密加工线");
        batchReq.setOperator("钱班长");
        ProductBatch batch = productBatchService.registerBatch(batchReq);

        productBatchService.lockBatch(batch.getBatchNo(), "客户反馈尺寸偏差", "质检组");
        log.info("人工修正场景: 批次 {} 已锁定", batch.getBatchNo());

        ReinspectionRequest reinspReq1 = new ReinspectionRequest();
        reinspReq1.setBatchNo(batch.getBatchNo());
        reinspReq1.setResult(ReinspectionResult.FAILED);
        reinspReq1.setInspectionDetail("初步复检：齿跳超差0.01mm");
        reinspReq1.setDefectDescription("20件样品中3件超差");
        reinspReq1.setInspector("初检员A");
        reinspReq1.setOperator("质检组");
        ReinspectionRecord record1 = reinspectionService.recordReinspection(reinspReq1);
        log.info("人工修正场景: 初次复检记录已创建(结果不合格)");

        reinspectionService.correctRecord(record1.getId(), "质检主管", 
            "经复核，系初检员操作失误，实际测量值在公差范围内");
        log.info("人工修正场景: 复检记录已修正");

        ReinspectionRequest reinspReq2 = new ReinspectionRequest();
        reinspReq2.setBatchNo(batch.getBatchNo());
        reinspReq2.setResult(ReinspectionResult.PASSED);
        reinspReq2.setInspectionDetail("重新复检：全部项目合格，齿跳≤0.005mm");
        reinspReq2.setInspector("复检员B");
        reinspReq2.setOperator("质检主管");
        ReinspectionRecord record2 = reinspectionService.recordReinspection(reinspReq2);
        log.info("人工修正场景: 二次复检记录已创建(结果通过)");

        reinspectionService.unlockBatchAfterReinspection(batch.getBatchNo(), "质检主管");
        log.info("人工修正场景: 批次已根据复检结果解锁");
    }

    private void createCertificateVersionScenario() {
        String toolNo = "G-005-CERT";
        
        GaugeRegisterRequest gaugeReq = new GaugeRegisterRequest();
        gaugeReq.setToolNo(toolNo);
        gaugeReq.setToolName("电子天平");
        gaugeReq.setSpecification("0-2000g/0.01g");
        gaugeReq.setCalibrationCertificateNo("CAL-2026-005");
        gaugeReq.setCalibrationDate(LocalDate.now().minusMonths(5));
        gaugeReq.setValidUntilDate(LocalDate.now().plusMonths(7));
        gaugeReq.setOperator("吴工");
        gaugeReq.setRemarks("证书版本错误场景样例");
        MeasuringTool gauge = measuringToolService.registerGauge(gaugeReq);

        CalibrationReportRequest reportReq1 = new CalibrationReportRequest();
        reportReq1.setToolNo(toolNo);
        reportReq1.setCertificateNo("CAL-2026-005");
        reportReq1.setCalibrationDate(LocalDate.now().minusMonths(5));
        reportReq1.setValidUntilDate(LocalDate.now().plusMonths(7));
        reportReq1.setCalibrationAgency("市计量检定所");
        reportReq1.setCalibrator("王检定员");
        reportReq1.setIsPassed(true);
        reportReq1.setOperator("吴工");
        calibrationReportService.addReport(reportReq1);
        log.info("证书版本场景: 初始版本(v1)已添加");

        try {
            calibrationReportService.validateCertificateVersion("CAL-2026-005", 2);
            log.warn("证书版本场景: 异常！版本验证未通过");
        } catch (Exception e) {
            log.info("证书版本场景: 正确识别版本错误 - {}", e.getMessage());
        }

        CalibrationReportRequest reportReq2 = new CalibrationReportRequest();
        reportReq2.setToolNo(toolNo);
        reportReq2.setCertificateNo("CAL-2026-005");
        reportReq2.setCalibrationDate(LocalDate.now());
        reportReq2.setValidUntilDate(LocalDate.now().plusYears(1));
        reportReq2.setCalibrationAgency("市计量检定所");
        reportReq2.setCalibrator("李检定员");
        reportReq2.setIsPassed(true);
        reportReq2.setOperator("吴工");
        reportReq2.setRemarks("年度复校");
        calibrationReportService.addReport(reportReq2);
        log.info("证书版本场景: 新版本(v2)已添加，量具状态自动更新");
    }

    private void createUnlockIssueScenario() {
        String toolNo = "G-006-UNLOCK";
        
        GaugeRegisterRequest gaugeReq = new GaugeRegisterRequest();
        gaugeReq.setToolNo(toolNo);
        gaugeReq.setToolName("粗糙度仪");
        gaugeReq.setSpecification("便携式");
        gaugeReq.setCalibrationCertificateNo("CAL-2026-006");
        gaugeReq.setCalibrationDate(LocalDate.now().minusMonths(3));
        gaugeReq.setValidUntilDate(LocalDate.now().plusMonths(9));
        gaugeReq.setOperator("郑工");
        gaugeReq.setRemarks("复检后未解锁场景样例");
        measuringToolService.registerGauge(gaugeReq);

        BatchRegisterRequest batchReq = new BatchRegisterRequest();
        batchReq.setBatchNo("B-2026-0524-009");
        batchReq.setProductName("密封件");
        batchReq.setToolNo(toolNo);
        batchReq.setQuantity(500);
        batchReq.setProductionLine("组装线A");
        batchReq.setOperator("冯班长");
        ProductBatch batch = productBatchService.registerBatch(batchReq);

        productBatchService.lockBatch(batch.getBatchNo(), "表面粗糙度可疑", "质检组");

        ReinspectionRequest reinspReq = new ReinspectionRequest();
        reinspReq.setBatchNo(batch.getBatchNo());
        reinspReq.setResult(ReinspectionResult.PASSED);
        reinspReq.setInspectionDetail("复检：Ra值全部在1.6μm以内");
        reinspReq.setInspector("质检组长");
        reinspReq.setOperator("质检组");
        reinspectionService.recordReinspection(reinspReq);

        log.info("复检后未解锁场景: 批次 {} 状态为已复检但未解锁 - 待处理", batch.getBatchNo());
        log.info("  提示: 调用 POST /api/reinspections/unlock-batch?batchNo={} 可解锁", batch.getBatchNo());
    }
}
