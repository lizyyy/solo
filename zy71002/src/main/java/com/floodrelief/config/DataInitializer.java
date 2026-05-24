package com.floodrelief.config;

import com.floodrelief.entity.*;
import com.floodrelief.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Component
public class DataInitializer implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    
    private final ShelterRepository shelterRepository;
    private final TransferRecordRepository transferRepository;
    private final MaterialBatchRepository materialRepository;
    private final AllocationRecordRepository allocationRepository;
    private final SpecialNeedRepository specialNeedRepository;
    private final AllocationEvidenceRepository evidenceRepository;

    public DataInitializer(ShelterRepository shelterRepository,
                           TransferRecordRepository transferRepository,
                           MaterialBatchRepository materialRepository,
                           AllocationRecordRepository allocationRepository,
                           SpecialNeedRepository specialNeedRepository,
                           AllocationEvidenceRepository evidenceRepository) {
        this.shelterRepository = shelterRepository;
        this.transferRepository = transferRepository;
        this.materialRepository = materialRepository;
        this.allocationRepository = allocationRepository;
        this.specialNeedRepository = specialNeedRepository;
        this.evidenceRepository = evidenceRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        log.info("开始初始化样例数据...");
        
        initShelters();
        initMaterialBatches();
        initTransferRecords();
        initNormalFlow();
        initConflictFlow();
        initWithdrawFlow();
        initManualCorrectionFlow();
        initNightAllocation();
        initSpecialNeeds();
        
        log.info("样例数据初始化完成！");
        log.info("==================================================");
        log.info("API 基础路径: http://localhost:8080/api");
        log.info("H2 控制台: http://localhost:8080/api/h2-console");
        log.info("JDBC URL: jdbc:h2:file:./data/floodrelief");
        log.info("用户名: admin, 密码: admin");
        log.info("==================================================");
    }

    private void initShelters() {
        Shelter s1 = new Shelter();
        s1.setCode("SH001");
        s1.setName("县城第一中学安置点");
        s1.setLocation("县城中心区人民路1号");
        s1.setManager("张主任");
        s1.setManagerPhone("13800138001");
        s1.setMaxCapacity(500);
        s1.setActive(true);
        shelterRepository.save(s1);

        Shelter s2 = new Shelter();
        s2.setCode("SH002");
        s2.setName("县体育馆安置点");
        s2.setLocation("县城南区体育路2号");
        s2.setManager("李馆长");
        s2.setManagerPhone("13800138002");
        s2.setMaxCapacity(800);
        s2.setActive(true);
        shelterRepository.save(s2);

        Shelter s3 = new Shelter();
        s3.setCode("SH003");
        s3.setName("县职业中专安置点");
        s3.setLocation("县城北区职业路3号");
        s3.setManager("王校长");
        s3.setManagerPhone("13800138003");
        s3.setMaxCapacity(600);
        s3.setActive(true);
        shelterRepository.save(s3);

        log.info("创建3个安置点");
    }

    private void initMaterialBatches() {
        MaterialBatch m1 = new MaterialBatch();
        m1.setBatchNo("MAT20240501001");
        m1.setMaterialType("FOOD");
        m1.setMaterialName("应急方便面");
        m1.setSpecification("12桶/箱");
        m1.setQuantity(1000);
        m1.setUnit("桶");
        m1.setSource("县应急管理局");
        m1.setStorageLocation("县城中心仓库A区");
        m1.setOperator("陈仓管");
        materialRepository.save(m1);

        MaterialBatch m2 = new MaterialBatch();
        m2.setBatchNo("MAT20240501002");
        m2.setMaterialType("WATER");
        m2.setMaterialName("瓶装饮用水");
        m2.setSpecification("550ml/瓶");
        m2.setQuantity(5000);
        m2.setUnit("瓶");
        m2.setSource("县应急管理局");
        m2.setStorageLocation("县城中心仓库B区");
        m2.setOperator("陈仓管");
        materialRepository.save(m2);

        MaterialBatch m3 = new MaterialBatch();
        m3.setBatchNo("MAT20240501003");
        m3.setMaterialType("MEDICINE");
        m3.setMaterialName("常用急救药品包");
        m3.setSpecification("10件/包");
        m3.setQuantity(200);
        m3.setUnit("包");
        m3.setSource("县卫生局");
        m3.setStorageLocation("县城中心仓库C区");
        m3.setOperator("陈仓管");
        materialRepository.save(m3);

        MaterialBatch m4 = new MaterialBatch();
        m4.setBatchNo("MAT20240501004");
        m4.setMaterialType("CHILDREN_FOOD");
        m4.setMaterialName("儿童营养奶粉");
        m4.setSpecification("900g/罐");
        m4.setQuantity(100);
        m4.setUnit("罐");
        m4.setSource("县民政局");
        m4.setStorageLocation("县城中心仓库D区");
        m4.setOperator("陈仓管");
        materialRepository.save(m4);

        MaterialBatch m5 = new MaterialBatch();
        m5.setBatchNo("MAT20240501005");
        m5.setMaterialType("BLANKET");
        m5.setMaterialName("救灾毛毯");
        m5.setSpecification("200x150cm");
        m5.setQuantity(1000);
        m5.setUnit("条");
        m5.setSource("县应急管理局");
        m5.setStorageLocation("县城中心仓库E区");
        m5.setOperator("陈仓管");
        materialRepository.save(m5);

        log.info("创建5个物资批次");
    }

    private void initTransferRecords() {
        TransferRecord t1 = new TransferRecord();
        t1.setShelterId(1L);
        t1.setTotalCount(200);
        t1.setElderlyCount(45);
        t1.setChildrenCount(35);
        t1.setDisabledCount(8);
        t1.setReporter("张主任");
        t1.setRemark("第一批转移人员");
        transferRepository.save(t1);

        TransferRecord t2 = new TransferRecord();
        t2.setShelterId(2L);
        t2.setTotalCount(350);
        t2.setElderlyCount(70);
        t2.setChildrenCount(60);
        t2.setDisabledCount(12);
        t2.setReporter("李馆长");
        t2.setRemark("第一批转移人员");
        transferRepository.save(t2);

        TransferRecord t3 = new TransferRecord();
        t3.setShelterId(3L);
        t3.setTotalCount(250);
        t3.setElderlyCount(55);
        t3.setChildrenCount(40);
        t3.setDisabledCount(10);
        t3.setReporter("王校长");
        t3.setRemark("第一批转移人员");
        transferRepository.save(t3);

        log.info("创建3个转移人数初始记录");
    }

    private void initNormalFlow() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        
        AllocationRecord a1 = new AllocationRecord();
        a1.setAllocationNo("AL" + date + "NORM01");
        a1.setShelterId(1L);
        a1.setMaterialBatchId(1L);
        a1.setQuantity(300);
        a1.setUnit("桶");
        a1.setStatus(AllocationRecord.AllocationStatus.RECEIVED);
        a1.setApplicant("张主任");
        a1.setApprover("刘局长");
        a1.setDispatcher("陈仓管");
        a1.setReceiver("王后勤");
        a1.setDispatchedAt(LocalDateTime.now().minusHours(5));
        a1.setReceivedAt(LocalDateTime.now().minusHours(3));
        a1.setReceiptEvidence("签收单照片: REC-001");
        allocationRepository.save(a1);

        AllocationEvidence e1 = new AllocationEvidence();
        e1.setAllocationId(a1.getId());
        e1.setEvidenceType("RECEIPT");
        e1.setEvidenceUrl("/images/receipt_001.jpg");
        e1.setDescription("现场签收单，签收人：王后勤");
        e1.setUploader("张主任");
        evidenceRepository.save(e1);

        AllocationRecord a2 = new AllocationRecord();
        a2.setAllocationNo("AL" + date + "NORM02");
        a2.setShelterId(1L);
        a2.setMaterialBatchId(2L);
        a2.setQuantity(800);
        a2.setUnit("瓶");
        a2.setStatus(AllocationRecord.AllocationStatus.RECEIVED);
        a2.setApplicant("张主任");
        a2.setApprover("刘局长");
        a2.setDispatcher("陈仓管");
        a2.setReceiver("王后勤");
        a2.setDispatchedAt(LocalDateTime.now().minusHours(4));
        a2.setReceivedAt(LocalDateTime.now().minusHours(2));
        a2.setReceiptEvidence("签收单照片: REC-002");
        allocationRepository.save(a2);

        log.info("【正常流程】创建2条已完成的调拨记录，含签收回执");
    }

    private void initConflictFlow() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        
        AllocationRecord pending = new AllocationRecord();
        pending.setAllocationNo("AL" + date + "CONF01");
        pending.setShelterId(2L);
        pending.setMaterialBatchId(1L);
        pending.setQuantity(400);
        pending.setUnit("桶");
        pending.setStatus(AllocationRecord.AllocationStatus.PENDING);
        pending.setApplicant("李馆长");
        allocationRepository.save(pending);

        AllocationRecord approved = new AllocationRecord();
        approved.setAllocationNo("AL" + date + "CONF02");
        approved.setShelterId(2L);
        approved.setMaterialBatchId(1L);
        approved.setQuantity(200);
        approved.setUnit("桶");
        approved.setStatus(AllocationRecord.AllocationStatus.APPROVED);
        approved.setApplicant("李馆长");
        approved.setApprover("刘局长");
        allocationRepository.save(approved);

        AllocationRecord rejected = new AllocationRecord();
        rejected.setAllocationNo("AL" + date + "CONF03");
        rejected.setShelterId(2L);
        rejected.setMaterialBatchId(3L);
        rejected.setQuantity(100);
        rejected.setUnit("包");
        rejected.setStatus(AllocationRecord.AllocationStatus.REJECTED);
        rejected.setApplicant("李馆长");
        rejected.setApprover("刘局长");
        rejected.setRejectReason("药品配给超标，请核对人数后重新申请");
        allocationRepository.save(rejected);

        log.info("【冲突场景】安置点2存在待审批、已通过、已驳回的记录，模拟重复申领拦截场景");
    }

    private void initWithdrawFlow() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        
        AllocationRecord withdrawn = new AllocationRecord();
        withdrawn.setAllocationNo("AL" + date + "WDRW01");
        withdrawn.setShelterId(3L);
        withdrawn.setMaterialBatchId(5L);
        withdrawn.setQuantity(150);
        withdrawn.setUnit("条");
        withdrawn.setStatus(AllocationRecord.AllocationStatus.WITHDRAWN);
        withdrawn.setApplicant("王校长");
        withdrawn.setApprover("刘局长");
        withdrawn.setPreviousStatus("APPROVED");
        withdrawn.setWithdrawReason("天气转暖，毛毯需求减少，申请撤回");
        allocationRepository.save(withdrawn);

        AllocationRecord dispatched = new AllocationRecord();
        dispatched.setAllocationNo("AL" + date + "WDRW02");
        dispatched.setShelterId(3L);
        dispatched.setMaterialBatchId(4L);
        dispatched.setQuantity(30);
        dispatched.setUnit("罐");
        dispatched.setStatus(AllocationRecord.AllocationStatus.DISPATCHED);
        dispatched.setApplicant("王校长");
        dispatched.setApprover("刘局长");
        dispatched.setDispatcher("陈仓管");
        dispatched.setDispatchedAt(LocalDateTime.now().minusMinutes(30));
        allocationRepository.save(dispatched);

        log.info("【撤回场景】安置点3：毛毯调拨已撤回（从APPROVED撤回），儿童奶粉运输中可撤回");
    }

    private void initManualCorrectionFlow() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        
        TransferRecord original = new TransferRecord();
        original.setShelterId(1L);
        original.setTotalCount(220);
        original.setElderlyCount(48);
        original.setChildrenCount(38);
        original.setDisabledCount(8);
        original.setReporter("张主任");
        original.setRemark("第二次上报人数，因统计错误需人工修正 | 人工修正原因：晚间清点发现漏报20人");
        original.setManualCorrection(true);
        original.setCorrectedBy("县应急办-周统计");
        transferRepository.save(original);

        AllocationRecord correctedAlloc = new AllocationRecord();
        correctedAlloc.setAllocationNo("AL" + date + "MANU01");
        correctedAlloc.setShelterId(1L);
        correctedAlloc.setMaterialBatchId(3L);
        correctedAlloc.setQuantity(60);
        correctedAlloc.setUnit("包");
        correctedAlloc.setStatus(AllocationRecord.AllocationStatus.RECEIVED);
        correctedAlloc.setApplicant("张主任");
        correctedAlloc.setApprover("刘局长");
        correctedAlloc.setDispatcher("陈仓管");
        correctedAlloc.setReceiver("王后勤");
        correctedAlloc.setDispatchedAt(LocalDateTime.now().minusHours(6));
        correctedAlloc.setReceivedAt(LocalDateTime.now().minusHours(4));
        correctedAlloc.setManualCorrection(true);
        correctedAlloc.setCorrectedBy("县应急办-周统计");
        correctedAlloc.setReceiptEvidence("签收单照片: REC-003，已人工复核");
        allocationRepository.save(correctedAlloc);

        log.info("【人工修正】安置点1：人数记录人工修正，药品调拨记录人工复核");
    }

    private void initNightAllocation() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        
        AllocationRecord nightAlloc = new AllocationRecord();
        nightAlloc.setAllocationNo("AL" + date + "NIGHT01");
        nightAlloc.setShelterId(2L);
        nightAlloc.setMaterialBatchId(3L);
        nightAlloc.setQuantity(45);
        nightAlloc.setUnit("包");
        nightAlloc.setStatus(AllocationRecord.AllocationStatus.DISPATCHED);
        nightAlloc.setApplicant("李馆长");
        nightAlloc.setApprover("夜间值班-赵科长");
        nightAlloc.setDispatcher("夜间值班-孙司机");
        nightAlloc.setDispatchedAt(LocalDateTime.now().minusMinutes(45));
        nightAlloc.setRemark("夜间紧急调拨 - 老人突发不适，急需药品");
        allocationRepository.save(nightAlloc);

        log.info("【夜间调拨】安置点2夜间紧急药品调拨，待签收 - 模拟夜间调拨无签收场景");
    }

    private void initSpecialNeeds() {
        SpecialNeed n1 = new SpecialNeed();
        n1.setShelterId(1L);
        n1.setNeedType("MEDICINE");
        n1.setNeedName("高血压专用药");
        n1.setQuantity(10);
        n1.setDescription("10位老人需长期服用的降压药即将用完");
        n1.setReporter("张主任");
        n1.setStatus("PENDING");
        specialNeedRepository.save(n1);

        SpecialNeed n2 = new SpecialNeed();
        n2.setShelterId(2L);
        n2.setNeedType("MEDICAL_DEVICE");
        n2.setNeedName("轮椅");
        n2.setQuantity(3);
        n2.setDescription("3位行动不便的老人需要轮椅");
        n2.setReporter("李馆长");
        n2.setStatus("PENDING");
        specialNeedRepository.save(n2);

        SpecialNeed n3 = new SpecialNeed();
        n3.setShelterId(3L);
        n3.setNeedType("BABY_SUPPLY");
        n3.setNeedName("婴儿纸尿裤");
        n3.setQuantity(50);
        n3.setDescription("5名婴儿需要纸尿裤");
        n3.setReporter("王校长");
        n3.setStatus("RESOLVED");
        specialNeedRepository.save(n3);

        log.info("创建3条特殊需求记录");
    }
}
