package com.featureflag.audit.config;

import com.featureflag.audit.entity.*;
import com.featureflag.audit.repository.AuditRecordRepository;
import com.featureflag.audit.repository.ExperimentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {
    private final ExperimentRepository experimentRepository;
    private final AuditRecordRepository auditRecordRepository;

    @Override
    public void run(String... args) {
        log.info("初始化测试数据...");

        Experiment experiment = createExperiment();
        createAuditRecords(experiment);

        log.info("测试数据初始化完成");
    }

    private Experiment createExperiment() {
        Experiment experiment = new Experiment();
        experiment.setExperimentKey("button_color_test");
        experiment.setName("按钮颜色AB测试");
        experiment.setDescription("测试不同按钮颜色对用户点击率的影响");
        experiment.setEnabled(true);
        experiment.setTrafficPercentage(100);
        experiment.setSalt("random_salt_2024");
        experiment.setStatus(Experiment.ExperimentStatus.RUNNING);
        experiment.setStartTime(LocalDateTime.now().minusDays(7));
        experiment.setEndTime(LocalDateTime.now().plusDays(30));

        HitRule rule1 = new HitRule();
        rule1.setExperiment(experiment);
        rule1.setAttributeName("country");
        rule1.setOperator(HitRule.Operator.EQUALS);
        rule1.setAttributeValue("CN");
        rule1.setPriority(10);
        rule1.setEnabled(true);
        experiment.getRules().add(rule1);

        HitRule rule2 = new HitRule();
        rule2.setExperiment(experiment);
        rule2.setAttributeName("userSegment");
        rule2.setOperator(HitRule.Operator.IN);
        rule2.setAttributeValue("new,premium");
        rule2.setPriority(5);
        rule2.setEnabled(true);
        experiment.getRules().add(rule2);

        BucketValue bucketA = new BucketValue();
        bucketA.setExperiment(experiment);
        bucketA.setBucketKey("control");
        bucketA.setValue("#FF0000");
        bucketA.setWeight(50);
        bucketA.setEnabled(true);
        experiment.getBuckets().add(bucketA);

        BucketValue bucketB = new BucketValue();
        bucketB.setExperiment(experiment);
        bucketB.setBucketKey("variant");
        bucketB.setValue("#00FF00");
        bucketB.setWeight(50);
        bucketB.setEnabled(true);
        experiment.getBuckets().add(bucketB);

        OverrideReason override1 = new OverrideReason();
        override1.setExperiment(experiment);
        override1.setUserIdentifier("qa_user_001");
        override1.setForcedBucketKey("control");
        override1.setReason("QA测试强制命中对照组");
        override1.setOverrideType(OverrideReason.OverrideType.QA_TESTING);
        override1.setEnabled(true);
        experiment.getOverrides().add(override1);

        OverrideReason override2 = new OverrideReason();
        override2.setExperiment(experiment);
        override2.setUserIdentifier("admin_001");
        override2.setForcedBucketKey("variant");
        override2.setReason("管理员强制查看新版本");
        override2.setOverrideType(OverrideReason.OverrideType.ADMIN_OVERRIDE);
        override2.setEnabled(true);
        experiment.getOverrides().add(override2);

        return experimentRepository.save(experiment);
    }

    private void createAuditRecords(Experiment experiment) {
        AuditRecord successRecord = new AuditRecord();
        successRecord.setRequestId("req_001_normal");
        successRecord.setExperimentKey(experiment.getExperimentKey());
        successRecord.setUserIdentifier("user_1001");
        successRecord.setHitResult(AuditRecord.HitResult.HIT);
        successRecord.setStatus(AuditRecord.AuditStatus.SUCCESS);
        successRecord.setBucketKey("control");
        successRecord.setBucketValue("#FF0000");
        successRecord.setMatchedRules("country:EQUALS,userSegment:IN");
        successRecord.setCreatedAt(LocalDateTime.now().minusMinutes(30));
        successRecord.setUpdatedAt(LocalDateTime.now().minusMinutes(30));
        auditRecordRepository.save(successRecord);

        AuditRecord overrideRecord = new AuditRecord();
        overrideRecord.setRequestId("req_002_override");
        overrideRecord.setExperimentKey(experiment.getExperimentKey());
        overrideRecord.setUserIdentifier("qa_user_001");
        overrideRecord.setHitResult(AuditRecord.HitResult.OVERRIDDEN);
        overrideRecord.setStatus(AuditRecord.AuditStatus.SUCCESS);
        overrideRecord.setBucketKey("control");
        overrideRecord.setBucketValue("#FF0000");
        overrideRecord.setOverrideReason("QA测试强制命中对照组");
        overrideRecord.setOverrideType("QA_TESTING");
        overrideRecord.setCreatedAt(LocalDateTime.now().minusMinutes(25));
        overrideRecord.setUpdatedAt(LocalDateTime.now().minusMinutes(25));
        auditRecordRepository.save(overrideRecord);

        AuditRecord failedRecord = new AuditRecord();
        failedRecord.setRequestId("req_003_failed");
        failedRecord.setExperimentKey(experiment.getExperimentKey());
        failedRecord.setUserIdentifier("user_1003");
        failedRecord.setHitResult(AuditRecord.HitResult.ERROR);
        failedRecord.setStatus(AuditRecord.AuditStatus.FAILED);
        failedRecord.setErrorMessage("数据库连接超时");
        failedRecord.setRetryCount(3);
        failedRecord.setCreatedAt(LocalDateTime.now().minusMinutes(20));
        failedRecord.setUpdatedAt(LocalDateTime.now().minusMinutes(20));
        auditRecordRepository.save(failedRecord);

        AuditRecord missRecord = new AuditRecord();
        missRecord.setRequestId("req_004_miss");
        missRecord.setExperimentKey(experiment.getExperimentKey());
        missRecord.setUserIdentifier("user_1004");
        missRecord.setHitResult(AuditRecord.HitResult.MISS);
        missRecord.setStatus(AuditRecord.AuditStatus.SUCCESS);
        missRecord.setCreatedAt(LocalDateTime.now().minusMinutes(15));
        missRecord.setUpdatedAt(LocalDateTime.now().minusMinutes(15));
        auditRecordRepository.save(missRecord);

        AuditRecord notInTrafficRecord = new AuditRecord();
        notInTrafficRecord.setRequestId("req_005_not_in_traffic");
        notInTrafficRecord.setExperimentKey(experiment.getExperimentKey());
        notInTrafficRecord.setUserIdentifier("user_1005");
        notInTrafficRecord.setHitResult(AuditRecord.HitResult.NOT_IN_TRAFFIC);
        notInTrafficRecord.setStatus(AuditRecord.AuditStatus.SUCCESS);
        notInTrafficRecord.setCreatedAt(LocalDateTime.now().minusMinutes(10));
        notInTrafficRecord.setUpdatedAt(LocalDateTime.now().minusMinutes(10));
        auditRecordRepository.save(notInTrafficRecord);

        AuditRecord compensatedRecord = new AuditRecord();
        compensatedRecord.setRequestId("req_006_compensated");
        compensatedRecord.setExperimentKey(experiment.getExperimentKey());
        compensatedRecord.setUserIdentifier("user_1006");
        compensatedRecord.setHitResult(AuditRecord.HitResult.ERROR);
        compensatedRecord.setStatus(AuditRecord.AuditStatus.COMPENSATED);
        compensatedRecord.setErrorMessage("临时网络异常");
        compensatedRecord.setCompensatedAt(LocalDateTime.now().minusMinutes(5));
        compensatedRecord.setCompensatedBy("admin");
        compensatedRecord.setCreatedAt(LocalDateTime.now().minusMinutes(10));
        compensatedRecord.setUpdatedAt(LocalDateTime.now().minusMinutes(5));
        auditRecordRepository.save(compensatedRecord);

        AuditRecord exportedRecord = new AuditRecord();
        exportedRecord.setRequestId("req_007_exported");
        exportedRecord.setExperimentKey(experiment.getExperimentKey());
        exportedRecord.setUserIdentifier("user_1007");
        exportedRecord.setHitResult(AuditRecord.HitResult.HIT);
        exportedRecord.setStatus(AuditRecord.AuditStatus.EXPORTED);
        exportedRecord.setBucketKey("variant");
        exportedRecord.setBucketValue("#00FF00");
        exportedRecord.setCreatedAt(LocalDateTime.now().minusHours(1));
        exportedRecord.setUpdatedAt(LocalDateTime.now().minusMinutes(30));
        auditRecordRepository.save(exportedRecord);
    }
}
