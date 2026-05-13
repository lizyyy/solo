package com.example.readonlywindow.repository;

import com.example.readonlywindow.entity.FreezeWindow;
import com.example.readonlywindow.entity.WindowStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface FreezeWindowRepository extends JpaRepository<FreezeWindow, Long> {
    Optional<FreezeWindow> findByWindowCode(String windowCode);
    List<FreezeWindow> findByStatus(WindowStatus status);
    List<FreezeWindow> findByStatusAndStartTimeBeforeAndEndTimeAfter(
            WindowStatus status, LocalDateTime before, LocalDateTime after);
    List<FreezeWindow> findByCreatedBy(String createdBy);
    boolean existsByWindowCode(String windowCode);
}
