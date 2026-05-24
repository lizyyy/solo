package com.ortho.rework.config;

import com.ortho.rework.entity.Patient;
import com.ortho.rework.entity.ImpressionBatch;
import com.ortho.rework.entity.ReworkOrder;
import com.ortho.rework.enums.ReworkStatus;
import com.ortho.rework.repository.PatientRepository;
import com.ortho.rework.repository.ImpressionBatchRepository;
import com.ortho.rework.repository.ReworkOrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private ImpressionBatchRepository impressionBatchRepository;

    @Autowired
    private ReworkOrderRepository reworkOrderRepository;

    @Override
    public void run(String... args) {
        Patient patient1 = new Patient();
        patient1.setPatientId("P001");
        patient1.setName("张三");
        patient1.setPhone("13800138000");
        patient1 = patientRepository.save(patient1);

        Patient patient2 = new Patient();
        patient2.setPatientId("P002");
        patient2.setName("李四");
        patient2.setPhone("13900139000");
        patient2 = patientRepository.save(patient2);

        ImpressionBatch batch1 = new ImpressionBatch();
        batch1.setBatchNumber("BATCH-001");
        batch1.setPatient(patient1);
        batch1.setDescription("正畸牙模批次1");
        batch1 = impressionBatchRepository.save(batch1);

        ImpressionBatch batch2 = new ImpressionBatch();
        batch2.setBatchNumber("BATCH-002");
        batch2.setPatient(patient2);
        batch2.setDescription("正畸牙模批次2");
        batch2 = impressionBatchRepository.save(batch2);

        ReworkOrder order1 = new ReworkOrder();
        order1.setOrderNumber("RW1001");
        order1.setBatch(batch1);
        order1.setStatus(ReworkStatus.PENDING_REVIEW);
        order1.setReworkReason("牙模边缘不清晰");
        reworkOrderRepository.save(order1);

        ReworkOrder order2 = new ReworkOrder();
        order2.setOrderNumber("RW1002");
        order2.setBatch(batch2);
        order2.setStatus(ReworkStatus.TECHNICIAN_REVIEW);
        order2.setReworkReason("咬合关系不准确");
        order2.setTechnicianNote("正在检查中...");
        reworkOrderRepository.save(order2);

        System.out.println("Sample data initialized successfully!");
    }
}
