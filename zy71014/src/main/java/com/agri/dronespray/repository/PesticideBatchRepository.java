package com.agri.dronespray.repository;

import com.agri.dronespray.entity.PesticideBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PesticideBatchRepository extends JpaRepository<PesticideBatch, Long> {

    Optional<PesticideBatch> findByBatchNumber(String batchNumber);

    List<PesticideBatch> findByPesticideId(Long pesticideId);
}
