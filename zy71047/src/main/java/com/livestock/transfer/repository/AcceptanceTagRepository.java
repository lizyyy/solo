package com.livestock.transfer.repository;

import com.livestock.transfer.entity.AcceptanceTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AcceptanceTagRepository extends JpaRepository<AcceptanceTag, Long> {
    List<AcceptanceTag> findByAcceptanceId(Long acceptanceId);
    void deleteByAcceptanceId(Long acceptanceId);
}
