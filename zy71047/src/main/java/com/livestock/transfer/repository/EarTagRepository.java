package com.livestock.transfer.repository;

import com.livestock.transfer.entity.EarTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EarTagRepository extends JpaRepository<EarTag, Long> {
    Optional<EarTag> findByTagNo(String tagNo);
    List<EarTag> findByCurrentFarmId(Long currentFarmId);
    List<EarTag> findByTagNoIn(List<String> tagNos);
}
