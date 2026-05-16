package com.dependency.license;

import com.dependency.license.dto.*;
import com.dependency.license.exception.BusinessException;
import com.dependency.license.model.*;
import com.dependency.license.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class LicenseApiApplicationTests {

    @Autowired
    private PackageService packageService;

    @Autowired
    private RepositoryService repositoryService;

    @Autowired
    private BatchService batchService;

    @Test
    void testSemanticVersionValidation() {
        CreatePackageRequest request = new CreatePackageRequest();
        request.setName("Test Lib");
        request.setGroupId("com.test");
        request.setArtifactId("test-lib");
        request.setCurrentVersion("1.0.0");
        request.setTargetVersion("invalid-version");

        assertThrows(BusinessException.class, () -> packageService.createPackage(request));
    }

    @Test
    void testVersionDowngradeRejected() {
        CreatePackageRequest request = new CreatePackageRequest();
        request.setName("Test Lib");
        request.setGroupId("com.test");
        request.setArtifactId("test-lib2");
        request.setCurrentVersion("2.0.0");
        request.setTargetVersion("1.0.0");

        BusinessException exception = assertThrows(BusinessException.class,
                () -> packageService.createPackage(request));
        assertTrue(exception.getMessage().contains("目标版本必须高于当前版本"));
    }

    @Test
    void testApprovalIdempotency() {
        CreatePackageRequest pkgRequest = new CreatePackageRequest();
        pkgRequest.setName("Test");
        pkgRequest.setGroupId("com.test");
        pkgRequest.setArtifactId("idempotent");
        pkgRequest.setCurrentVersion("1.0.0");
        pkgRequest.setTargetVersion("2.0.0");
        DependencyPackage pkg = packageService.createPackage(pkgRequest);

        CreateRepositoryRequest repoRequest = new CreateRepositoryRequest();
        repoRequest.setName("test-repo-idempotent");
        repoRequest.setUrl("http://test");
        repoRequest.setMaintainer("测试");
        repoRequest.setMaintainerEmail("test@test.com");
        Repository repo = repositoryService.createRepository(repoRequest);

        CreateBatchRequest batchRequest = new CreateBatchRequest();
        batchRequest.setName("测试批次-幂等性");
        batchRequest.setPackageId(pkg.getId());
        batchRequest.setCreatedBy("测试");
        batchRequest.setRepositoryIds(Arrays.asList(repo.getId()));
        UpgradeBatch batch = batchService.createBatch(batchRequest);

        RepositoryApproval approval = batchService.getApprovalsByBatch(batch.getId()).get(0);

        ApprovalRequest approveRequest = new ApprovalRequest();
        approveRequest.setApproved(true);
        approveRequest.setApprover("测试用户");

        RepositoryApproval first = batchService.approve(approval.getId(), approveRequest);
        RepositoryApproval second = batchService.approve(approval.getId(), approveRequest);

        assertEquals(first.getStatus(), second.getStatus());
        assertEquals(first.getApprovalTime(), second.getApprovalTime());
    }

    @Test
    void testInvalidStateTransition() {
        CreatePackageRequest pkgRequest = new CreatePackageRequest();
        pkgRequest.setName("Test State");
        pkgRequest.setGroupId("com.test");
        pkgRequest.setArtifactId("state-test");
        pkgRequest.setCurrentVersion("1.0.0");
        pkgRequest.setTargetVersion("2.0.0");
        DependencyPackage pkg = packageService.createPackage(pkgRequest);

        CreateRepositoryRequest repoRequest = new CreateRepositoryRequest();
        repoRequest.setName("test-repo-state");
        repoRequest.setUrl("http://test");
        repoRequest.setMaintainer("测试");
        repoRequest.setMaintainerEmail("test@test.com");
        Repository repo = repositoryService.createRepository(repoRequest);

        CreateBatchRequest batchRequest = new CreateBatchRequest();
        batchRequest.setName("测试批次-状态流转");
        batchRequest.setPackageId(pkg.getId());
        batchRequest.setCreatedBy("测试");
        batchRequest.setRepositoryIds(Arrays.asList(repo.getId()));
        UpgradeBatch batch = batchService.createBatch(batchRequest);

        assertThrows(BusinessException.class, () -> batchService.startUpgrade(batch.getId()));
    }

    @Test
    void testDeferralConflict() {
        CreatePackageRequest pkgRequest = new CreatePackageRequest();
        pkgRequest.setName("Test Deferral");
        pkgRequest.setGroupId("com.test");
        pkgRequest.setArtifactId("deferral-test");
        pkgRequest.setCurrentVersion("1.0.0");
        pkgRequest.setTargetVersion("2.0.0");
        DependencyPackage pkg = packageService.createPackage(pkgRequest);

        CreateRepositoryRequest repoRequest = new CreateRepositoryRequest();
        repoRequest.setName("test-repo-deferral");
        repoRequest.setUrl("http://test");
        repoRequest.setMaintainer("测试");
        repoRequest.setMaintainerEmail("test@test.com");
        Repository repo = repositoryService.createRepository(repoRequest);

        CreateBatchRequest batchRequest = new CreateBatchRequest();
        batchRequest.setName("测试批次-延期");
        batchRequest.setPackageId(pkg.getId());
        batchRequest.setCreatedBy("测试");
        batchRequest.setRepositoryIds(Arrays.asList(repo.getId()));
        UpgradeBatch batch = batchService.createBatch(batchRequest);

        RepositoryApproval approval = batchService.getApprovalsByBatch(batch.getId()).get(0);

        DeferralRequestDto deferralRequest = new DeferralRequestDto();
        deferralRequest.setRequestedDate(LocalDateTime.now().plusDays(30));
        deferralRequest.setReason("测试延期");
        deferralRequest.setRequestedBy("测试用户");

        batchService.requestDeferral(approval.getId(), deferralRequest);

        assertThrows(BusinessException.class,
                () -> batchService.requestDeferral(approval.getId(), deferralRequest));
    }

    @Test
    void testManualCorrection() {
        CreatePackageRequest pkgRequest = new CreatePackageRequest();
        pkgRequest.setName("Test Manual");
        pkgRequest.setGroupId("com.test");
        pkgRequest.setArtifactId("manual-test");
        pkgRequest.setCurrentVersion("1.0.0");
        pkgRequest.setTargetVersion("2.0.0");
        DependencyPackage pkg = packageService.createPackage(pkgRequest);

        CreateRepositoryRequest repoRequest = new CreateRepositoryRequest();
        repoRequest.setName("test-repo-manual");
        repoRequest.setUrl("http://test");
        repoRequest.setMaintainer("测试");
        repoRequest.setMaintainerEmail("test@test.com");
        Repository repo = repositoryService.createRepository(repoRequest);

        CreateBatchRequest batchRequest = new CreateBatchRequest();
        batchRequest.setName("测试批次-人工修正");
        batchRequest.setPackageId(pkg.getId());
        batchRequest.setCreatedBy("测试");
        batchRequest.setRepositoryIds(Arrays.asList(repo.getId()));
        UpgradeBatch batch = batchService.createBatch(batchRequest);

        RepositoryApproval approval = batchService.getApprovalsByBatch(batch.getId()).get(0);

        RepositoryApproval corrected = batchService.manualCorrect(
                approval.getId(), ApprovalStatus.APPROVED, "管理员", "人工修正测试");

        assertEquals(ApprovalStatus.APPROVED, corrected.getStatus());
    }
}