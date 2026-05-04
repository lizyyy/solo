<?php

declare(strict_types=1);

namespace DeployFlow\Command;

use DeployFlow\Exception\DeployFlowException;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\Yaml\Yaml;

class InitCommand extends Command
{
    protected static $defaultName = 'init';

    protected function configure(): void
    {
        $this
            ->setDescription('Initialize a new DeployFlow project')
            ->setHelp('This command creates the necessary configuration files for a new DeployFlow project')
            ->addOption(
                'force',
                'f',
                InputOption::VALUE_NONE,
                'Force overwrite existing files'
            )
            ->addOption(
                'seed',
                's',
                InputOption::VALUE_NONE,
                'Create sample project files for testing'
            )
            ->addOption(
                'bad-sample',
                'b',
                InputOption::VALUE_NONE,
                'Create bad sample with intentional errors for testing'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $filesystem = new Filesystem();
        $cwd = getcwd();

        $io->title('DeployFlow Project Initializer');
        $io->text('Creating configuration files in: ' . $cwd);

        $force = $input->getOption('force');
        $seed = $input->getOption('seed');
        $badSample = $input->getOption('bad-sample');

        $filesToCreate = [
            'release.yaml' => $this->getReleaseYamlContent(),
            'deploy-targets.json' => $this->getDeployTargetsJsonContent(),
            'env-matrix.csv' => $this->getEnvMatrixCsvContent(),
        ];

        foreach ($filesToCreate as $filename => $content) {
            $path = $cwd . '/' . $filename;
            
            if ($filesystem->exists($path) && !$force) {
                $io->warning("File '{$filename}' already exists. Use --force to overwrite.");
                continue;
            }

            $filesystem->dumpFile($path, $content);
            $io->text("  ✔ Created: {$filename}");
        }

        if ($seed) {
            $this->createSeedProject($io, $filesystem, $cwd, $force);
        }

        if ($badSample) {
            $this->createBadSampleProject($io, $filesystem, $cwd, $force);
        }

        $io->success('DeployFlow initialized successfully!');
        $io->text('');
        $io->text('Next steps:');
        $io->listing([
            'Run `deployflow validate` to check your project',
            'Run `deployflow build` to create release packages',
            'Run `deployflow plan` to generate a release plan',
        ]);

        return Command::SUCCESS;
    }

    private function getReleaseYamlContent(): string
    {
        $config = [
            'project' => [
                'name' => 'my-php-project',
                'version' => '1.0.0',
                'description' => 'My PHP Application',
            ],
            'build' => [
                'output_format' => 'tar',
                'include' => [
                    'public/',
                    'config/',
                    'src/',
                    'vendor/',
                    'composer.json',
                    'composer.lock',
                ],
                'exclude' => [
                    '.git/',
                    '.env',
                    '.env.local',
                    'node_modules/',
                    'tests/',
                    '.phpunit/',
                    'output/',
                ],
            ],
            'deploy' => [
                'default_target' => 'production',
                'backup_before_deploy' => true,
                'maintenance_mode' => true,
                'clear_cache' => true,
            ],
            'validation' => [
                'check_composer_platform' => true,
                'check_php_extensions' => true,
                'check_env_differences' => true,
                'check_directory_permissions' => true,
                'check_sensitive_configs' => true,
                'check_migration_order' => true,
            ],
            'migrations' => [
                'directory' => 'migrations',
                'run_before_deploy' => false,
                'require_manual_confirmation' => true,
            ],
            'rollback' => [
                'enabled' => true,
                'keep_releases' => 5,
                'auto_backup' => true,
            ],
            'reporting' => [
                'formats' => ['markdown', 'json'],
                'include_changes' => true,
                'include_validations' => true,
            ],
        ];

        return Yaml::dump($config, 4, 2);
    }

    private function getDeployTargetsJsonContent(): string
    {
        $config = [
            'targets' => [
                'development' => [
                    'name' => 'development',
                    'type' => 'server',
                    'environment' => 'dev',
                    'php_version' => '8.0',
                    'php_extensions' => ['json', 'pdo', 'pdo_mysql', 'mbstring'],
                    'deploy_path' => '/var/www/html',
                    'webserver_user' => 'www-data',
                    'maintenance_enabled' => false,
                    'backup_enabled' => false,
                    'description' => 'Development environment',
                ],
                'staging' => [
                    'name' => 'staging',
                    'type' => 'server',
                    'environment' => 'staging',
                    'php_version' => '8.0',
                    'php_extensions' => ['json', 'pdo', 'pdo_mysql', 'mbstring', 'opcache'],
                    'deploy_path' => '/var/www/app',
                    'webserver_user' => 'www-data',
                    'maintenance_enabled' => true,
                    'backup_enabled' => true,
                    'description' => 'Staging environment',
                ],
                'production' => [
                    'name' => 'production',
                    'type' => 'server',
                    'environment' => 'production',
                    'php_version' => '8.0',
                    'php_extensions' => ['json', 'pdo', 'pdo_mysql', 'mbstring', 'opcache', 'redis'],
                    'deploy_path' => '/var/www/prod',
                    'webserver_user' => 'www-data',
                    'maintenance_enabled' => true,
                    'backup_enabled' => true,
                    'description' => 'Production environment',
                ],
            ],
        ];

        return json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    }

    private function getEnvMatrixCsvContent(): string
    {
        return <<<'CSV'
variable,development,staging,production
APP_ENV,dev,staging,prod
APP_DEBUG,true,false,false
APP_URL,http://dev.example.com,https://staging.example.com,https://www.example.com
DB_HOST,localhost,staging-db.internal,prod-db.internal
DB_PORT,3306,3306,3306
DB_NAME,app_dev,app_staging,app_prod
DB_USER,dev_user,staging_user,prod_user
DB_PASS,dev_secret,staging_secret,prod_secret
REDIS_HOST,localhost,staging-redis.internal,prod-redis.internal
REDIS_PORT,6379,6379,6379
MAILER_DSN,smtp://localhost:1025,smtp://staging-smtp:25,smtp://prod-smtp:25

CSV;
    }

    private function createSeedProject(SymfonyStyle $io, Filesystem $filesystem, string $cwd, bool $force): void
    {
        $io->section('Creating seed project files');

        $dirs = [
            'public',
            'public/css',
            'public/js',
            'config',
            'src',
            'src/Controller',
            'src/Service',
            'migrations',
        ];

        foreach ($dirs as $dir) {
            $path = $cwd . '/' . $dir;
            if (!$filesystem->exists($path)) {
                $filesystem->mkdir($path);
                $io->text("  ✔ Created directory: {$dir}/");
            }
        }

        $files = [
            'composer.json' => $this->getSeedComposerJson(),
            'composer.lock' => $this->getSeedComposerLock(),
            'public/index.php' => $this->getSeedIndexPhp(),
            'config/app.php' => $this->getSeedConfigAppPhp(),
            'config/database.php' => $this->getSeedConfigDatabasePhp(),
            'src/Controller/HomeController.php' => $this->getSeedHomeController(),
            'src/Service/UserService.php' => $this->getSeedUserService(),
            'migrations/20240101000000_CreateUsersTable.php' => $this->getSeedMigration1(),
            'migrations/20240102000000_AddUserEmailIndex.php' => $this->getSeedMigration2(),
            'migrations/20240103000000_CreateOrdersTable.sql' => $this->getSeedMigration3(),
        ];

        foreach ($files as $filename => $content) {
            $path = $cwd . '/' . $filename;
            
            if ($filesystem->exists($path) && !$force) {
                $io->warning("File '{$filename}' already exists. Use --force to overwrite.");
                continue;
            }

            $filesystem->dumpFile($path, $content);
            $io->text("  ✔ Created: {$filename}");
        }
    }

    private function createBadSampleProject(SymfonyStyle $io, Filesystem $filesystem, string $cwd, bool $force): void
    {
        $io->section('Creating bad sample project (with intentional errors)');

        $badDir = $cwd . '/bad-sample';
        $filesystem->mkdir($badDir);

        $dirs = [
            'public',
            'config',
            'src',
            'migrations',
            'output',
        ];

        foreach ($dirs as $dir) {
            $path = $badDir . '/' . $dir;
            $filesystem->mkdir($path);
        }

        $files = [
            'release.yaml' => $this->getBadReleaseYaml(),
            'deploy-targets.json' => $this->getBadDeployTargetsJson(),
            'env-matrix.csv' => $this->getBadEnvMatrixCsv(),
            'composer.json' => $this->getBadComposerJson(),
            'composer.lock' => $this->getBadComposerLock(),
            'config/secrets.php' => $this->getBadSecretsPhp(),
            'config/database.php' => $this->getBadDatabasePhp(),
            'migrations/001_CreateTable.php' => $this->getBadMigration1(),
            'migrations/002_AddColumn.php' => $this->getBadMigration2(),
            'migrations/003_DropTable.sql' => $this->getBadMigration3(),
        ];

        foreach ($files as $filename => $content) {
            $path = $badDir . '/' . $filename;
            $filesystem->dumpFile($path, $content);
            $io->text("  ✔ Created: bad-sample/{$filename}");
        }

        chmod($badDir . '/public', 0777);

        $io->text('');
        $io->note('Bad sample created in: bad-sample/');
        $io->text('Intentional issues in this sample:');
        $io->listing([
            'Missing PHP extensions in composer.json',
            'Hardcoded secrets in config files',
            'World-writable public directory',
            'Irreversible migrations (DROP TABLE)',
            'Missing deployment paths in targets',
            'Invalid environment matrix (missing production)',
        ]);
    }

    private function getSeedComposerJson(): string
    {
        return json_encode([
            'name' => 'example/my-php-app',
            'description' => 'Example PHP Application',
            'type' => 'project',
            'require' => [
                'php' => '>=8.0',
                'ext-json' => '*',
                'ext-pdo' => '*',
                'ext-pdo_mysql' => '*',
                'ext-mbstring' => '*',
                'symfony/console' => '^6.0',
                'symfony/yaml' => '^6.0',
            ],
            'require-dev' => [
                'phpunit/phpunit' => '^9.0',
            ],
            'autoload' => [
                'psr-4' => [
                    'App\\' => 'src/',
                ],
            ],
            'config' => [
                'platform' => [
                    'php' => '8.0.30',
                ],
            ],
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    }

    private function getSeedComposerLock(): string
    {
        return json_encode([
            '_readme' => [
                'This file locks the dependencies of your project to a known state',
            ],
            'content-hash' => 'abc123def4567890abcdef1234567890abcdef1234567890abcdef12345678',
            'packages' => [
                [
                    'name' => 'symfony/console',
                    'version' => 'v6.4.0',
                ],
                [
                    'name' => 'symfony/yaml',
                    'version' => 'v6.4.0',
                ],
            ],
            'packages-dev' => [
                [
                    'name' => 'phpunit/phpunit',
                    'version' => '9.6.0',
                ],
            ],
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    }

    private function getSeedIndexPhp(): string
    {
        return <<<'PHP'
<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\Controller\HomeController;

$controller = new HomeController();
echo $controller->index();

PHP;
    }

    private function getSeedConfigAppPhp(): string
    {
        return <<<'PHP'
<?php

return [
    'app_name' => 'My PHP App',
    'app_version' => '1.0.0',
    'timezone' => 'UTC',
    'locale' => 'en',
];

PHP;
    }

    private function getSeedConfigDatabasePhp(): string
    {
        return <<<'PHP'
<?php

return [
    'default' => [
        'driver' => 'mysql',
        'host' => getenv('DB_HOST') ?: 'localhost',
        'port' => getenv('DB_PORT') ?: 3306,
        'database' => getenv('DB_NAME') ?: 'app',
        'username' => getenv('DB_USER') ?: 'root',
        'password' => getenv('DB_PASS') ?: '',
    ],
];

PHP;
    }

    private function getSeedHomeController(): string
    {
        return <<<'PHP'
<?php

declare(strict_types=1);

namespace App\Controller;

class HomeController
{
    public function index(): string
    {
        return 'Welcome to My PHP App!';
    }
}

PHP;
    }

    private function getSeedUserService(): string
    {
        return <<<'PHP'
<?php

declare(strict_types=1);

namespace App\Service;

class UserService
{
    public function getUserById(int $id): ?array
    {
        return [
            'id' => $id,
            'name' => 'John Doe',
            'email' => 'john@example.com',
        ];
    }
}

PHP;
    }

    private function getSeedMigration1(): string
    {
        return <<<'PHP'
<?php

declare(strict_types=1);

/**
 * @description Create users table
 * @dependsOn None
 */
class CreateUsersTable
{
    public function up(): void
    {
        echo "Creating users table...\n";
    }

    public function down(): void
    {
        echo "Dropping users table...\n";
    }
}

PHP;
    }

    private function getSeedMigration2(): string
    {
        return <<<'PHP'
<?php

declare(strict_types=1);

/**
 * @description Add email index to users table
 * @dependsOn 20240101000000_CreateUsersTable.php
 */
class AddUserEmailIndex
{
    public function up(): void
    {
        echo "Adding email index...\n";
    }

    public function down(): void
    {
        echo "Dropping email index...\n";
    }
}

PHP;
    }

    private function getSeedMigration3(): string
    {
        return <<<'SQL'
-- Create orders table
-- @description Create orders table for storing purchase information

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status ENUM('pending','paid','shipped','delivered') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SQL;
    }

    private function getBadReleaseYaml(): string
    {
        return Yaml::dump([
            'project' => [
                'name' => 'bad-sample',
                'version' => '0.0.1',
            ],
            'build' => [
                'output_format' => 'tar',
                'include' => ['public/', 'config/', 'src/'],
            ],
            'rollback' => [
                'enabled' => true,
            ],
        ], 4, 2);
    }

    private function getBadDeployTargetsJson(): string
    {
        return json_encode([
            'targets' => [
                'development' => [
                    'name' => 'development',
                    'php_version' => '7.4',
                    'php_extensions' => ['json'],
                ],
                'staging' => [
                    'name' => 'staging',
                    'deploy_path' => 'relative/path',
                ],
            ],
        ], JSON_PRETTY_PRINT) . "\n";
    }

    private function getBadEnvMatrixCsv(): string
    {
        return <<<'CSV'
variable,development,staging
APP_ENV,dev,staging
APP_DEBUG,true,true
DB_HOST,localhost,localhost
DB_PASS,hardcoded_secret,hardcoded_secret

CSV;
    }

    private function getBadComposerJson(): string
    {
        return json_encode([
            'name' => 'bad/sample',
            'require' => [
                'php' => '>=7.0',
            ],
        ], JSON_PRETTY_PRINT) . "\n";
    }

    private function getBadComposerLock(): string
    {
        return json_encode([
            'content-hash' => 'badhash123',
            'packages' => [],
            'packages-dev' => [],
        ], JSON_PRETTY_PRINT) . "\n";
    }

    private function getBadSecretsPhp(): string
    {
        return <<<'PHP'
<?php

return [
    'api_key' => 'sk_live_abcdef1234567890',
    'aws_secret' => 'AKIAIOSFODNN7EXAMPLE/wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    'database_password' => 'MySuperSecretPassword123!',
];

PHP;
    }

    private function getBadDatabasePhp(): string
    {
        return <<<'PHP'
<?php

return [
    'default' => [
        'host' => 'localhost',
        'username' => 'root',
        'password' => 'password',
        'database' => 'app_prod',
    ],
];

PHP;
    }

    private function getBadMigration1(): string
    {
        return <<<'PHP'
<?php

class CreateTable
{
    public function up(): void
    {
        echo "Up...\n";
    }
}

PHP;
    }

    private function getBadMigration2(): string
    {
        return <<<'PHP'
<?php

/**
 * @dependsOn nonexistent_migration.php
 */
class AddColumn
{
    public function up(): void
    {
        echo "Up...\n";
    }

    public function down(): void
    {
        echo "Down...\n";
    }
}

PHP;
    }

    private function getBadMigration3(): string
    {
        return <<<'SQL'
-- @irreversible DANGEROUS operation
-- @description Drop users table - CANNOT BE UNDONE

DROP TABLE IF EXISTS users;

SQL;
    }
}
