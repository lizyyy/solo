package com.port.reefer.repository;

import com.port.reefer.entity.PowerSocket;
import com.port.reefer.entity.enums.SocketStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

import javax.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

@Repository
public interface PowerSocketRepository extends JpaRepository<PowerSocket, Long> {
    Optional<PowerSocket> findBySocketCode(String socketCode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<PowerSocket> findWithLockById(Long id);

    List<PowerSocket> findByStatus(SocketStatus status);

    List<PowerSocket> findByOccupiedByContainerId(Long containerId);
}
