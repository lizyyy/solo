package com.agri.dronespray.service;

import com.agri.dronespray.entity.Permission;
import com.agri.dronespray.entity.PermissionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class StatusMachineServiceTest {

    private StatusMachineService statusMachineService;
    private Permission permission;

    @BeforeEach
    void setUp() {
        statusMachineService = new StatusMachineService();
        permission = new Permission();
        permission.setCreatedBy("test");
    }

    @Test
    void testSystemCheckingToSystemApproved_ShouldBeAllowed() {
        permission.setStatus(PermissionStatus.SYSTEM_CHECKING);
        
        boolean canTransition = statusMachineService.canTransition(permission, PermissionStatus.SYSTEM_APPROVED);
        
        assertTrue(canTransition, "SYSTEM_CHECKING 应该可以转换到 SYSTEM_APPROVED");
    }

    @Test
    void testSystemCheckingToSystemRejected_ShouldBeAllowed() {
        permission.setStatus(PermissionStatus.SYSTEM_CHECKING);
        
        boolean canTransition = statusMachineService.canTransition(permission, PermissionStatus.SYSTEM_REJECTED);
        
        assertTrue(canTransition, "SYSTEM_CHECKING 应该可以转换到 SYSTEM_REJECTED");
    }

    @Test
    void testSubmittedToSystemChecking_ShouldBeAllowed() {
        permission.setStatus(PermissionStatus.SUBMITTED);
        
        boolean canTransition = statusMachineService.canTransition(permission, PermissionStatus.SYSTEM_CHECKING);
        
        assertTrue(canTransition, "SUBMITTED 应该可以转换到 SYSTEM_CHECKING");
    }

    @Test
    void testDraftToSubmitted_ShouldBeAllowed() {
        permission.setStatus(PermissionStatus.DRAFT);
        
        boolean canTransition = statusMachineService.canTransition(permission, PermissionStatus.SUBMITTED);
        
        assertTrue(canTransition, "DRAFT 应该可以转换到 SUBMITTED");
    }

    @Test
    void testSystemApprovedToManualReviewing_ShouldBeAllowed() {
        permission.setStatus(PermissionStatus.SYSTEM_APPROVED);
        
        boolean canTransition = statusMachineService.canTransition(permission, PermissionStatus.MANUAL_REVIEWING);
        
        assertTrue(canTransition, "SYSTEM_APPROVED 应该可以转换到 MANUAL_REVIEWING");
    }

    @Test
    void testManualReviewingToApproved_ShouldBeAllowed() {
        permission.setStatus(PermissionStatus.MANUAL_REVIEWING);
        
        boolean canTransition = statusMachineService.canTransition(permission, PermissionStatus.APPROVED);
        
        assertTrue(canTransition, "MANUAL_REVIEWING 应该可以转换到 APPROVED");
    }

    @Test
    void testApprovedToCompleted_ShouldBeAllowed() {
        permission.setStatus(PermissionStatus.APPROVED);
        
        boolean canTransition = statusMachineService.canTransition(permission, PermissionStatus.COMPLETED);
        
        assertTrue(canTransition, "APPROVED 应该可以转换到 COMPLETED");
    }

    @Test
    void testDraftToSystemApproved_ShouldNotBeAllowed() {
        permission.setStatus(PermissionStatus.DRAFT);
        
        boolean canTransition = statusMachineService.canTransition(permission, PermissionStatus.SYSTEM_APPROVED);
        
        assertFalse(canTransition, "DRAFT 不应该直接转换到 SYSTEM_APPROVED");
    }

    @Test
    void testFullFlowTransition_ShouldWork() {
        permission.setStatus(PermissionStatus.DRAFT);
        assertTrue(statusMachineService.canTransition(permission, PermissionStatus.SUBMITTED));

        permission.setStatus(PermissionStatus.SUBMITTED);
        assertTrue(statusMachineService.canTransition(permission, PermissionStatus.SYSTEM_CHECKING));

        permission.setStatus(PermissionStatus.SYSTEM_CHECKING);
        assertTrue(statusMachineService.canTransition(permission, PermissionStatus.SYSTEM_APPROVED));
        assertTrue(statusMachineService.canTransition(permission, PermissionStatus.SYSTEM_REJECTED));

        permission.setStatus(PermissionStatus.SYSTEM_APPROVED);
        assertTrue(statusMachineService.canTransition(permission, PermissionStatus.MANUAL_REVIEWING));

        permission.setStatus(PermissionStatus.MANUAL_REVIEWING);
        assertTrue(statusMachineService.canTransition(permission, PermissionStatus.APPROVED));
        assertTrue(statusMachineService.canTransition(permission, PermissionStatus.REJECTED));

        permission.setStatus(PermissionStatus.APPROVED);
        assertTrue(statusMachineService.canTransition(permission, PermissionStatus.COMPLETED));
        assertTrue(statusMachineService.canTransition(permission, PermissionStatus.AMENDED));
    }

    @Test
    void testTransitionActionNames_ShouldBeCorrect() {
        assertEquals("系统审核通过", 
            statusMachineService.getTransitionAction(PermissionStatus.SYSTEM_CHECKING, PermissionStatus.SYSTEM_APPROVED));
        assertEquals("系统审核驳回", 
            statusMachineService.getTransitionAction(PermissionStatus.SYSTEM_CHECKING, PermissionStatus.SYSTEM_REJECTED));
    }
}
