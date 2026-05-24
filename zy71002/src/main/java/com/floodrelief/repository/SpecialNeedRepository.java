package com.floodrelief.repository;

import com.floodrelief.entity.SpecialNeed;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpecialNeedRepository extends JpaRepository<SpecialNeed, Long> {
    List<SpecialNeed> findByShelterIdOrderByCreatedAtDesc(Long shelterId);
    List<SpecialNeed> findByNeedType(String needType);
}
