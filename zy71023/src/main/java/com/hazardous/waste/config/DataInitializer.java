package com.hazardous.waste.config;

import com.hazardous.waste.entity.StorageBucket;
import com.hazardous.waste.entity.TransferForm;
import com.hazardous.waste.repository.StorageBucketRepository;
import com.hazardous.waste.repository.TransferFormRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final StorageBucketRepository bucketRepository;
    private final TransferFormRepository transferFormRepository;

    @Override
    public void run(String... args) {
        if (bucketRepository.count() == 0) {
            initBuckets();
        }
        if (transferFormRepository.count() == 0) {
            initTransferForms();
        }
    }

    private void initBuckets() {
        String[] categories = {"HW08", "HW09", "HW12", "HW49"};
        String[] locations = {"A区-1号架", "A区-2号架", "B区-1号架", "C区-1号架"};

        for (int i = 0; i < categories.length; i++) {
            StorageBucket bucket = new StorageBucket();
            bucket.setBucketCode("BKT-" + categories[i] + "-001");
            bucket.setCategory(categories[i]);
            bucket.setMaxCapacity(200.0);
            bucket.setLocation(locations[i]);
            bucket.setRemark(categories[i] + "类专用暂存桶");
            bucketRepository.save(bucket);
        }
    }

    private void initTransferForms() {
        String[] categories = {"HW08", "HW09", "HW12", "HW49"};

        for (int i = 0; i < categories.length; i++) {
            TransferForm form = new TransferForm();
            form.setFormNo("TF-" + categories[i] + "-202400" + (i + 1));
            form.setCategory(categories[i]);
            form.setTotalWeight(0.0);
            form.setTransporter("合规运输有限公司");
            form.setRemark("预置转运单");
            transferFormRepository.save(form);
        }
    }
}
