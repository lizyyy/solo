<?php

declare(strict_types=1);

namespace DeployFlow\Validator;

use DeployFlow\Config\ProjectConfig;
use DeployFlow\Parser\ComposerParser;
use DeployFlow\Parser\EnvMatrixParser;
use DeployFlow\Parser\MigrationParser;
use DeployFlow\Parser\ReleaseConfigParser;
use DeployFlow\Parser\DeployTargetsParser;
use DeployFlow\Exception\DeployFlowException;

class ProjectValidator
{
    private ProjectConfig $config;
    private ComposerParser $composerParser;
    private EnvMatrixParser $envMatrixParser;
    private MigrationParser $migrationParser;
    private ReleaseConfigParser $releaseConfig;
    private DeployTargetsParser $deployTargets;
    private ?string $targetEnvironment = null;

    public function __construct(
        ProjectConfig $config,
        ComposerParser $composerParser,
        EnvMatrixParser $envMatrixParser,
        MigrationParser $migrationParser,
        ReleaseConfigParser $releaseConfig,
        DeployTargetsParser $deployTargets
    ) {
        $this->config = $config;
        $this->composerParser = $composerParser;
        $this->envMatrixParser = $envMatrixParser;
        $this->migrationParser = $migrationParser;
        $this->releaseConfig = $releaseConfig;
        $this->deployTargets = $deployTargets;
    }

    public function setTargetEnvironment(?string $environment): void
    {
        $this->targetEnvironment = $environment;
    }

    public function validate(): ValidatorResult
    {
        $result = new ValidatorResult();

        if ($this->releaseConfig->isValidationEnabled('check_composer_platform')) {
            $result->merge($this->validateComposerPlatform());
        }

        if ($this->releaseConfig->isValidationEnabled('check_php_extensions')) {
            $result->merge($this->validatePhpExtensions());
        }

        if ($this->releaseConfig->isValidationEnabled('check_env_differences')) {
            $result->merge($this->validateEnvDifferences());
        }

        if ($this->releaseConfig->isValidationEnabled('check_directory_permissions')) {
            $result->merge($this->validateDirectoryPermissions());
        }

        if ($this->releaseConfig->isValidationEnabled('check_sensitive_configs')) {
            $result->merge($this->validateSensitiveConfigs());
        }

        if ($this->releaseConfig->isValidationEnabled('check_migration_order')) {
            $result->merge($this->validateMigrationOrder());
        }

        $result->merge($this->validateTargetConfig());
        $result->merge($this->validateRollbackCapability());

        return $result;
    }

    public function validateComposerPlatform(): ValidatorResult
    {
        $result = new ValidatorResult();
        $category = 'composer_platform';

        try {
            $platformReq = $this->composerParser->getPlatformRequirements();
            $jsonPhpVersion = $this->composerParser->getPhpVersion();

            if ($jsonPhpVersion) {
                $result->addInfo(
                    $category,
                    "Composer PHP version constraint: {$jsonPhpVersion}",
                    ['constraint' => $jsonPhpVersion]
                );

                $currentPhpVersion = PHP_VERSION;
                if (version_compare($currentPhpVersion, '8.0.0', '<')) {
                    $result->addError(
                        $category,
                        "Current PHP version ({$currentPhpVersion}) is below minimum required (8.0)",
                        ['current' => $currentPhpVersion, 'required' => '8.0']
                    );
                }
            }

            if (!empty($platformReq)) {
                $result->addInfo(
                    $category,
                    'Composer platform overrides detected',
                    ['platform' => $platformReq]
                );
            }

            $lockHash = $this->composerParser->getLockHash();
            if ($lockHash) {
                $result->addInfo(
                    $category,
                    "composer.lock content hash: " . substr($lockHash, 0, 16) . '...',
                    ['hash' => $lockHash]
                );
            }

            $packages = $this->composerParser->getLockPackages();
            $packageCount = count($packages);
            $result->addInfo(
                $category,
                "composer.lock contains {$packageCount} production packages",
                ['package_count' => $packageCount]
            );

            $devPackages = $this->composerParser->getLockPackagesDev();
            $devCount = count($devPackages);
            if ($devCount > 0) {
                $result->addWarning(
                    $category,
                    "composer.lock contains {$devCount} dev packages - consider using --no-dev for production",
                    ['dev_package_count' => $devCount]
                );
            }
        } catch (DeployFlowException $e) {
            $result->addError(
                $category,
                'Failed to validate composer platform: ' . $e->getMessage(),
                ['exception' => $e->getCode()]
            );
        }

        return $result;
    }

    public function validatePhpExtensions(): ValidatorResult
    {
        $result = new ValidatorResult();
        $category = 'php_extensions';

        $requiredExtensions = $this->composerParser->getRequiredExtensions();

        if (empty($requiredExtensions)) {
            $result->addInfo($category, 'No PHP extensions explicitly required in composer.json');
            return $result;
        }

        $missingExtensions = [];
        $loadedExtensions = get_loaded_extensions();

        foreach ($requiredExtensions as $ext) {
            if (!in_array($ext, $loadedExtensions) && !extension_loaded($ext)) {
                $missingExtensions[] = $ext;
                $result->addBlocker(
                    $category,
                    "Required PHP extension '{$ext}' is not loaded",
                    ['extension' => $ext],
                    $this->config->composerJsonPath
                );
            } else {
                $result->addInfo(
                    $category,
                    "PHP extension '{$ext}' is loaded",
                    ['extension' => $ext, 'loaded' => true]
                );
            }
        }

        if ($this->targetEnvironment) {
            $target = $this->deployTargets->getTarget($this->targetEnvironment);
            if ($target && isset($target['php_extensions'])) {
                $targetExtensions = $target['php_extensions'];
                foreach ($requiredExtensions as $ext) {
                    if (!in_array($ext, $targetExtensions)) {
                        $result->addError(
                            $category,
                            "Target environment '{$this->targetEnvironment}' is missing required extension '{$ext}'",
                            [
                                'extension' => $ext,
                                'target' => $this->targetEnvironment,
                                'target_extensions' => $targetExtensions,
                            ],
                            $this->config->deployTargetsPath
                        );
                    }
                }
            }
        }

        return $result;
    }

    public function validateEnvDifferences(): ValidatorResult
    {
        $result = new ValidatorResult();
        $category = 'env_differences';

        $environments = $this->envMatrixParser->getEnvironments();

        if (count($environments) < 2) {
            $result->addInfo($category, 'Only one environment defined, no differences to compare');
            return $result;
        }

        $result->addInfo(
            $category,
            'Detected environments: ' . implode(', ', $environments),
            ['environments' => $environments]
        );

        $stagingEnv = in_array('staging', $environments) ? 'staging' : null;
        $productionEnv = in_array('production', $environments) ? 'production' : null;

        if ($stagingEnv && $productionEnv) {
            $differences = $this->envMatrixParser->findDifferences($stagingEnv, $productionEnv);

            if (!empty($differences)) {
                $result->addWarning(
                    $category,
                    sprintf(
                        'Found %d environment variable difference(s) between staging and production',
                        count($differences)
                    ),
                    ['differences' => $differences],
                    $this->config->envMatrixPath
                );

                foreach ($differences as $var => $values) {
                    $result->addInfo(
                        $category,
                        "Variable '{$var}': staging='{$values['staging']}' vs production='{$values['production']}'",
                        [
                            'variable' => $var,
                            'staging' => $values['staging'],
                            'production' => $values['production'],
                        ],
                        $this->config->envMatrixPath
                    );
                }
            } else {
                $result->addInfo(
                    $category,
                    'No environment variable differences between staging and production',
                    [],
                    $this->config->envMatrixPath
                );
            }
        }

        $variables = $this->envMatrixParser->getVariables();
        $suspiciousVars = [];
        foreach ($variables as $var) {
            $lowerVar = strtolower($var);
            if (str_contains($lowerVar, 'key') || 
                str_contains($lowerVar, 'secret') || 
                str_contains($lowerVar, 'password') ||
                str_contains($lowerVar, 'token')) {
                $values = $this->envMatrixParser->getVariableValues($var);
                $suspiciousVars[] = [
                    'variable' => $var,
                    'values' => $values,
                ];
            }
        }

        if (!empty($suspiciousVars)) {
            $result->addWarning(
                $category,
                'Found potential sensitive variables in env matrix - ensure these are placeholders',
                ['suspicious_variables' => $suspiciousVars],
                $this->config->envMatrixPath
            );
        }

        return $result;
    }

    public function validateDirectoryPermissions(): ValidatorResult
    {
        $result = new ValidatorResult();
        $category = 'directory_permissions';

        $dirsToCheck = [
            $this->config->getPublicPath() => 'public (web accessible)',
            $this->config->getConfigPath() => 'config (sensitive)',
            $this->config->getMigrationsPath() => 'migrations',
        ];

        foreach ($dirsToCheck as $path => $description) {
            if (!is_dir($path)) {
                $result->addWarning(
                    $category,
                    "Directory '{$description}' does not exist: {$path}",
                    ['path' => $path, 'description' => $description]
                );
                continue;
            }

            if (!is_readable($path)) {
                $result->addError(
                    $category,
                    "Directory '{$description}' is not readable",
                    ['path' => $path, 'description' => $description],
                    $path
                );
            }

            $perms = fileperms($path);
            $octalPerms = decoct($perms & 0777);

            $result->addInfo(
                $category,
                "Directory '{$description}' permissions: {$octalPerms}",
                [
                    'path' => $path,
                    'description' => $description,
                    'permissions' => $octalPerms,
                ]
            );

            if (($perms & 0004) && !($perms & 0400)) {
                $result->addWarning(
                    $category,
                    "Directory '{$description}' is world-readable but not owner-only - potential security issue",
                    ['path' => $path, 'permissions' => $octalPerms],
                    $path
                );
            }

            if ($perms & 0002) {
                $result->addError(
                    $category,
                    "Directory '{$description}' is world-writable - security risk!",
                    ['path' => $path, 'permissions' => $octalPerms],
                    $path
                );
            }
        }

        return $result;
    }

    public function validateSensitiveConfigs(): ValidatorResult
    {
        $result = new ValidatorResult();
        $category = 'sensitive_configs';

        $sensitivePatterns = [
            '/\.env(\.local)?$/' => 'Environment file',
            '/config(\.inc)?\.php$/' => 'Config file with potential secrets',
            '/database(\.inc)?\.php$/' => 'Database config',
            '/secrets\.yaml$/' => 'Secrets file',
        ];

        $suspiciousContentPatterns = [
            '/password\s*=\s*["\'][^"\']{4,}/i' => 'Hardcoded password',
            '/api_key\s*=\s*["\'][^"\']{4,}/i' => 'Hardcoded API key',
            '/secret\s*=\s*["\'][^"\']{4,}/i' => 'Hardcoded secret',
            '/token\s*=\s*["\'][^"\']{8,}/i' => 'Hardcoded token',
        ];

        $configDir = $this->config->getConfigPath();
        $publicDir = $this->config->getPublicPath();

        if (is_dir($configDir)) {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($configDir, \RecursiveDirectoryIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::LEAVES_ONLY
            );

            foreach ($iterator as $file) {
                $filePath = $file->getRealPath();
                $fileName = $file->getFilename();

                foreach ($sensitivePatterns as $pattern => $description) {
                    if (preg_match($pattern, $fileName)) {
                        $result->addWarning(
                            $category,
                            "Found potential sensitive file: {$description} in {$filePath}",
                            ['file' => $filePath, 'type' => $description],
                            $filePath
                        );
                    }
                }

                if (in_array($file->getExtension(), ['php', 'ini', 'yaml', 'yml', 'json'])) {
                    $content = @file_get_contents($filePath);
                    if ($content) {
                        foreach ($suspiciousContentPatterns as $pattern => $description) {
                            if (preg_match($pattern, $content, $matches)) {
                                $line = $this->findLineNumber($content, $matches[0]);
                                $result->addBlocker(
                                    $category,
                                    "Found {$description} in file: {$filePath}",
                                    ['file' => $filePath, 'pattern' => $description],
                                    $filePath,
                                    $line
                                );
                            }
                        }
                    }
                }
            }
        }

        $envFile = $this->config->projectRoot . '/.env';
        if (file_exists($envFile)) {
            $result->addWarning(
                $category,
                'Found .env file in project root - ensure this is not committed to version control',
                ['file' => $envFile],
                $envFile
            );
        }

        $gitIgnore = $this->config->projectRoot . '/.gitignore';
        if (file_exists($gitIgnore)) {
            $gitIgnoreContent = file_get_contents($gitIgnore);
            if ($gitIgnoreContent) {
                $missingRules = [];
                if (!preg_match('/\.env/', $gitIgnoreContent)) {
                    $missingRules[] = '.env';
                }
                if (!preg_match('/\.env\.local/', $gitIgnoreContent)) {
                    $missingRules[] = '.env.local';
                }

                if (!empty($missingRules)) {
                    $result->addWarning(
                        $category,
                        '.gitignore may be missing rules for sensitive files: ' . implode(', ', $missingRules),
                        ['missing_rules' => $missingRules],
                        $gitIgnore
                    );
                }
            }
        }

        return $result;
    }

    public function validateMigrationOrder(): ValidatorResult
    {
        $result = new ValidatorResult();
        $category = 'migration_order';

        $migrations = $this->migrationParser->getMigrations();

        if (empty($migrations)) {
            $result->addInfo($category, 'No migration files found');
            return $result;
        }

        $result->addInfo(
            $category,
            sprintf('Found %d migration file(s)', count($migrations)),
            ['count' => count($migrations)]
        );

        $withDeps = $this->migrationParser->getMigrationsWithDependencies();
        if (!empty($withDeps)) {
            foreach ($withDeps as $migration) {
                $missingDeps = [];
                foreach ($migration['depends_on'] as $dep) {
                    if (!$this->migrationParser->hasMigration($dep)) {
                        $missingDeps[] = $dep;
                    }
                }

                if (!empty($missingDeps)) {
                    $result->addBlocker(
                        $category,
                        "Migration '{$migration['filename']}' has missing dependencies: " . implode(', ', $missingDeps),
                        [
                            'migration' => $migration['filename'],
                            'missing_dependencies' => $missingDeps,
                        ],
                        $migration['path']
                    );
                } else {
                    $result->addInfo(
                        $category,
                        "Migration '{$migration['filename']}' dependencies verified",
                        [
                            'migration' => $migration['filename'],
                            'dependencies' => $migration['depends_on'],
                        ],
                        $migration['path']
                    );
                }
            }
        }

        $irreversible = $this->migrationParser->getIrreversibleMigrations();
        if (!empty($irreversible)) {
            foreach ($irreversible as $migration) {
                $result->addWarning(
                    $category,
                    "Migration '{$migration['filename']}' is marked as irreversible",
                    [
                        'migration' => $migration['filename'],
                        'description' => $migration['description'] ?? 'No description',
                    ],
                    $migration['path']
                );
            }
        }

        $nonRollbackable = $this->migrationParser->getNonRollbackableMigrations();
        if (!empty($nonRollbackable)) {
            $result->addWarning(
                $category,
                sprintf('Found %d migration(s) that cannot be rolled back', count($nonRollbackable)),
                ['non_rollbackable' => array_column($nonRollbackable, 'filename')]
            );
        }

        $this->checkMigrationCycles($migrations, $result, $category);

        return $result;
    }

    private function checkMigrationCycles(array $migrations, ValidatorResult $result, string $category): void
    {
        $graph = [];
        $lookup = [];

        foreach ($migrations as $m) {
            $filename = $m['filename'];
            $lookup[$filename] = $m;
            $graph[$filename] = $m['depends_on'] ?? [];
        }

        $visited = [];
        $recStack = [];
        $path = [];

        foreach (array_keys($graph) as $node) {
            if (!$this->dfsCycleCheck($node, $graph, $visited, $recStack, $path, $result, $category, $lookup)) {
                break;
            }
        }
    }

    private function dfsCycleCheck(
        string $node,
        array $graph,
        array &$visited,
        array &$recStack,
        array &$path,
        ValidatorResult $result,
        string $category,
        array $lookup
    ): bool {
        if (!isset($visited[$node])) {
            $visited[$node] = true;
            $recStack[$node] = true;
            $path[] = $node;

            $deps = $graph[$node] ?? [];
            foreach ($deps as $dep) {
                if (!isset($visited[$dep])) {
                    if (!$this->dfsCycleCheck($dep, $graph, $visited, $recStack, $path, $result, $category, $lookup)) {
                        return false;
                    }
                } elseif (isset($recStack[$dep]) && $recStack[$dep]) {
                    $cycleStart = array_search($dep, $path);
                    $cycle = array_slice($path, $cycleStart);
                    $cycle[] = $dep;

                    $migration = $lookup[$node] ?? null;
                    $result->addBlocker(
                        $category,
                        'Circular dependency detected in migrations: ' . implode(' -> ', $cycle),
                        ['cycle' => $cycle],
                        $migration['path'] ?? null
                    );
                    return false;
                }
            }
        }

        $recStack[$node] = false;
        array_pop($path);
        return true;
    }

    public function validateTargetConfig(): ValidatorResult
    {
        $result = new ValidatorResult();
        $category = 'target_config';

        $targets = $this->deployTargets->getTargets();

        if (empty($targets)) {
            $result->addInfo($category, 'No deploy targets configured, using defaults');
            return $result;
        }

        $result->addInfo(
            $category,
            'Configured deploy targets: ' . implode(', ', array_keys($targets))
        );

        foreach ($targets as $name => $target) {
            $phpVersion = $target['php_version'] ?? null;
            if ($phpVersion) {
                $result->addInfo(
                    $category,
                    "Target '{$name}' requires PHP {$phpVersion}",
                    ['target' => $name, 'php_version' => $phpVersion]
                );

                if (version_compare($phpVersion, '8.0.0', '<')) {
                    $result->addWarning(
                        $category,
                        "Target '{$name}' specifies PHP version {$phpVersion} which is below recommended 8.0",
                        ['target' => $name, 'php_version' => $phpVersion],
                        $this->config->deployTargetsPath
                    );
                }
            }

            $deployPath = $target['deploy_path'] ?? null;
            if ($deployPath) {
                if (!str_starts_with($deployPath, '/')) {
                    $result->addWarning(
                        $category,
                        "Target '{$name}' deploy path is not absolute: {$deployPath}",
                        ['target' => $name, 'deploy_path' => $deployPath],
                        $this->config->deployTargetsPath
                    );
                }
            } else {
                $result->addError(
                    $category,
                    "Target '{$name}' is missing deploy_path",
                    ['target' => $name],
                    $this->config->deployTargetsPath
                );
            }
        }

        if ($this->targetEnvironment) {
            if (!$this->deployTargets->hasTarget($this->targetEnvironment)) {
                $result->addBlocker(
                    $category,
                    "Target environment '{$this->targetEnvironment}' is not configured",
                    [
                        'target' => $this->targetEnvironment,
                        'available_targets' => $this->deployTargets->getTargetNames(),
                    ],
                    $this->config->deployTargetsPath
                );
            }
        }

        return $result;
    }

    public function validateRollbackCapability(): ValidatorResult
    {
        $result = new ValidatorResult();
        $category = 'rollback_capability';

        if (!$this->releaseConfig->isRollbackEnabled()) {
            $result->addWarning(
                $category,
                'Rollback is disabled in release.yaml - no automatic rollback will be available',
                [],
                $this->config->releaseYamlPath
            );
            return $result;
        }

        $keepReleases = $this->releaseConfig->getKeepReleases();
        $result->addInfo(
            $category,
            "Rollback is enabled, keeping last {$keepReleases} releases",
            ['keep_releases' => $keepReleases]
        );

        $nonRollbackable = $this->migrationParser->getNonRollbackableMigrations();
        if (!empty($nonRollbackable)) {
            $filenames = array_column($nonRollbackable, 'filename');
            $result->addWarning(
                $category,
                sprintf(
                    'Full rollback may not be possible due to %d non-rollbackable migration(s)',
                    count($nonRollbackable)
                ),
                ['non_rollbackable_migrations' => $filenames]
            );
        }

        $irreversible = $this->migrationParser->getIrreversibleMigrations();
        if (!empty($irreversible)) {
            $filenames = array_column($irreversible, 'filename');
            $result->addBlocker(
                $category,
                sprintf(
                    'Release contains %d irreversible migration(s) - manual intervention may be required',
                    count($irreversible)
                ),
                ['irreversible_migrations' => $filenames]
            );
        }

        return $result;
    }

    private function findLineNumber(string $content, string $search): ?int
    {
        $lines = explode("\n", $content);
        foreach ($lines as $lineNum => $line) {
            if (strpos($line, $search) !== false) {
                return $lineNum + 1;
            }
        }
        return null;
    }
}
