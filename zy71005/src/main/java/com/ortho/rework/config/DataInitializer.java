package com.ortho.rework.config;

import com.ortho.rework.entity.ImpressionBatch;
import com.ortho.rework.entity.Patient;
import com.ortho.rework.repository.ImpressionBatchRepository;
import com.ortho.rework.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.time.LocalDateTime;

@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final PatientRepository patientRepository;
    private final ImpressionBatchRepository batchRepository;

    @Bean
    CommandLineRunner initData() {
        return args -> {
            Patient p1 = new Patient();
            p1.setPatientNo("P2024001");
            p1.setName("张三");
            p1.setPhone("13800138001");
            p1.setDoctorName("王医生");
            p1.setCreatedAt(LocalDateTime.now());
            p1.setUpdatedAt(LocalDateTime.now());
            patientRepository.save(p1);

            Patient p2 = new Patient();
            p2.setPatientNo("P2024002");
            p2.setName("李四");
            p2.setPhone("13800138002");
            p2.setDoctorName("李医生");
            p2.setCreatedAt(LocalDateTime.now());
            p2.setUpdatedAt(LocalDateTime.now());
            patientRepository.save(p2);

            Patient p3 = new Patient();
            p3.setPatientNo("P2024003");
            p3.setName("王五");
            p3.setPhone("13800138003");
            p3.setDoctorName("王医生");
            p3.setCreatedAt(LocalDateTime.now());
            p3.setUpdatedAt(LocalDateTime.now());
            patientRepository.save(p3);

            ImpressionBatch b1 = new ImpressionBatch();
            b1.setBatchNo("BATCH-2024-001");
            b1.setPatient(p1);
            b1.setImpressionType("隐形矫治器");
            b1.setOriginalBatchNo("BATCH-2024-001");
            b1.setReworkCount(0);
            b1.setProductionDate(LocalDateTime.now().minusDays(7));
            b1.setCreatedAt(LocalDateTime.now());
            b1.setUpdatedAt(LocalDateTime.now());
            batchRepository.save(b1);

            ImpressionBatch b2 = new ImpressionBatch();
            b2.setBatchNo("BATCH-2024-002");
            b2.setPatient(p2);
            b2.setImpressionType("托槽");
            b2.setOriginalBatchNo("BATCH-2024-002");
            b2.setReworkCount(1);
            b2.setProductionDate(LocalDateTime.now().minusDays(14));
            b2.setCreatedAt(LocalDateTime.now());
            b2.setUpdatedAt(LocalDateTime.now());
            batchRepository.save(b2);

            ImpressionBatch b3 = new ImpressionBatch();
            b3.setBatchNo("BATCH-2024-003");
            b3.setPatient(p3);
            b3.setImpressionType("保持器");
            b3.setOriginalBatchNo("BATCH-2024-003");
            b3.setReworkCount(0);
            b3.setProductionDate(LocalDateTime.now().minusDays(3));
            b3.setCreatedAt(LocalDateTime.now());
            b3.setUpdatedAt(LocalDateTime.now());
            batchRepository.save(b3);

            System.out.println("========================================");
            System.out.println("  测试数据初始化完成");
            System.out.println("  患者数据: 3 条 (P2024001, P2024002, P2024003)");
            System.out.println("  批次数据: 3 条 (BATCH-2024-001~003)");
            System.out.println("========================================");
        };
    }
}
