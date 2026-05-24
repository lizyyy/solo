package com.port.reefer.repository;

import com.port.reefer.entity.TemperatureSample;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TemperatureSampleRepository extends JpaRepository<TemperatureSample, Long> {
    List<TemperatureSample> findByContainerIdOrderBySampleTimeDesc(Long containerId);

    List<TemperatureSample> findByContainerIdAndSampleTimeBetweenOrderBySampleTimeDesc(
            Long containerId, LocalDateTime start, LocalDateTime end);

    List<TemperatureSample> findBySocketIdOrderBySampleTimeDesc(Long socketId);
}
