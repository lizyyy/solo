package com.hazardous.waste.repository;

import com.hazardous.waste.entity.TransferForm;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransferFormRepository extends JpaRepository<TransferForm, Long> {

    Optional<TransferForm> findByFormNo(String formNo);

    List<TransferForm> findByIsUsed(Boolean isUsed);

    List<TransferForm> findByIsSigned(Boolean isSigned);

    List<TransferForm> findByCategory(String category);

    boolean existsByFormNo(String formNo);
}
