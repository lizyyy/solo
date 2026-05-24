package com.hazardous.waste.repository;

import com.hazardous.waste.entity.StorageBucket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StorageBucketRepository extends JpaRepository<StorageBucket, Long> {

    Optional<StorageBucket> findByBucketCode(String bucketCode);

    List<StorageBucket> findByCategory(String category);

    List<StorageBucket> findByIsActive(Boolean isActive);

    List<StorageBucket> findByCategoryAndIsActive(String category, Boolean isActive);

    boolean existsByBucketCode(String bucketCode);
}
