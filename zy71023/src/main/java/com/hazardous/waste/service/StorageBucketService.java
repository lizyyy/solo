package com.hazardous.waste.service;

import com.hazardous.waste.entity.StorageBucket;
import com.hazardous.waste.enums.ErrorCode;
import com.hazardous.waste.exception.BusinessException;
import com.hazardous.waste.repository.StorageBucketRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class StorageBucketService {

    private final StorageBucketRepository storageBucketRepository;

    public StorageBucketService(StorageBucketRepository storageBucketRepository) {
        this.storageBucketRepository = storageBucketRepository;
    }

    @Transactional
    public StorageBucket createBucket(StorageBucket bucket) {
        if (storageBucketRepository.existsByBucketCode(bucket.getBucketCode())) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "暂存桶编号已存在: " + bucket.getBucketCode());
        }
        return storageBucketRepository.save(bucket);
    }

    public List<StorageBucket> getAllBuckets() {
        return storageBucketRepository.findAll();
    }

    public List<StorageBucket> getActiveBuckets() {
        return storageBucketRepository.findByIsActive(true);
    }

    public List<StorageBucket> getBucketsByCategory(String category) {
        return storageBucketRepository.findByCategoryAndIsActive(category, true);
    }

    public StorageBucket getBucketByCode(String bucketCode) {
        return storageBucketRepository.findByBucketCode(bucketCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "暂存桶不存在: " + bucketCode));
    }

    @Transactional
    public StorageBucket updateBucket(String bucketCode, StorageBucket updatedBucket) {
        StorageBucket bucket = getBucketByCode(bucketCode);
        bucket.setCategory(updatedBucket.getCategory());
        bucket.setMaxCapacity(updatedBucket.getMaxCapacity());
        bucket.setLocation(updatedBucket.getLocation());
        bucket.setRemark(updatedBucket.getRemark());
        bucket.setIsActive(updatedBucket.getIsActive());
        return storageBucketRepository.save(bucket);
    }

    @Transactional
    public void deactivateBucket(String bucketCode) {
        StorageBucket bucket = getBucketByCode(bucketCode);
        bucket.setIsActive(false);
        storageBucketRepository.save(bucket);
    }
}
