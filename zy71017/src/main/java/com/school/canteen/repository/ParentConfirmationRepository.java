package com.school.canteen.repository;

import com.school.canteen.entity.ParentConfirmation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ParentConfirmationRepository extends JpaRepository<ParentConfirmation, Long> {
    Optional<ParentConfirmation> findByReplacementIdAndStudentId(Long replacementId, Long studentId);

    List<ParentConfirmation> findByReplacementId(Long replacementId);

    @Query("SELECT COUNT(pc) FROM ParentConfirmation pc WHERE pc.replacement.id = :replacementId AND pc.confirmationStatus = :status")
    long countByReplacementIdAndStatus(@Param("replacementId") Long replacementId, @Param("status") String status);

    @Query("SELECT pc FROM ParentConfirmation pc WHERE pc.replacement.id = :replacementId AND pc.confirmationStatus = :status")
    List<ParentConfirmation> findByReplacementIdAndStatus(@Param("replacementId") Long replacementId, @Param("status") String status);

    boolean existsByReplacementIdAndStudentId(Long replacementId, Long studentId);
}
