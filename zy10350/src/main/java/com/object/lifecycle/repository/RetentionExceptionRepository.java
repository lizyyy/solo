package com.object.lifecycle.repository;

import com.object.lifecycle.entity.RetentionException;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface RetentionExceptionRepository extends JpaRepository<RetentionException, Long> {

    List<RetentionException> findByObjectKeyAndBucketName(String objectKey, String bucketName);

    @Query("SELECT r FROM RetentionException r WHERE r.objectKey = :objectKey AND r.bucketName = :bucketName " +
           "AND r.enabled = true AND r.effectiveFrom <= :currentTime AND r.effectiveTo >= :currentTime")
    List<RetentionException> findActiveExceptions(String objectKey, String bucketName, LocalDateTime currentTime);

    boolean existsByObjectKeyAndBucketNameAndRuleId(String objectKey, String bucketName, Long ruleId);
}
