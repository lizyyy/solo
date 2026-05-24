package com.ski.rental.repository;

import com.ski.rental.model.ReturnInspection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ReturnInspectionRepository extends JpaRepository<ReturnInspection, Long> {
    Optional<ReturnInspection> findByRentalOrderOrderNo(String orderNo);
}
