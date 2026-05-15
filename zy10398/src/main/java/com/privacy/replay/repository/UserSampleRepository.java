package com.privacy.replay.repository;

import com.privacy.replay.model.UserSample;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserSampleRepository extends JpaRepository<UserSample, Long> {

    Optional<UserSample> findBySampleId(String sampleId);

    List<UserSample> findByUserIdAndIsActiveTrue(String userId);

    List<UserSample> findByExpiredAtBeforeAndIsActiveTrue(LocalDateTime dateTime);

    List<UserSample> findBySampleIdIn(List<String> sampleIds);
}
