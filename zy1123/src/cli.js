#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const Workspace = require('./modules/workspace');
const LeaseManager = require('./modules/lease-manager');
const WriteCoordinator = require('./modules/write-coordinator');
const MergeEngine = require('./modules/merge-engine');
const AuditExporter = require('./modules/audit-exporter');
const Simulator = require('./modules/simulator');

const cwd = process.cwd();

function getWorkspace() {
    const ws = new Workspace(cwd);
    if (!ws.exists()) {
        console.error(chalk.red('Error: Workspace not initialized.'));
        console.error(chalk.yellow('Run `doc-guard init` first to initialize the workspace.'));
        process.exit(1);
    }
    return ws;
}

function handleError(error, message = 'An error occurred') {
    console.error(chalk.red(`✗ ${message}:`));
    console.error(chalk.red(error.message));
    if (program.opts().verbose) {
        console.error(error.stack);
    }
    process.exit(1);
}

function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}

program
    .name('doc-guard')
    .description('文档并发写安全助手 - 协调多人并发编辑，防止覆盖，智能合并冲突')
    .version('1.0.0')
    .option('-v, --verbose', '显示详细输出');

program
    .command('init')
    .description('初始化一个新的 workspace')
    .option('--force', '强制重新初始化（会删除现有数据）')
    .option('--lease-duration <seconds>', '默认租约时长（秒）', '300')
    .option('--max-lease <seconds>', '最大租约时长（秒）', '3600')
    .option('--no-auto-merge', '禁用自动合并')
    .action((options) => {
        try {
            const ws = new Workspace(cwd);

            if (ws.exists() && !options.force) {
                console.error(chalk.red('✗ Workspace 已经存在于当前目录。'));
                console.error(chalk.yellow('使用 --force 选项重新初始化。'));
                process.exit(1);
            }

            const meta = ws.init({
                defaultLeaseDuration: parseInt(options.leaseDuration),
                maxLeaseDuration: parseInt(options.maxLease),
                autoMergeEnabled: options.autoMerge !== false
            });

            console.log(chalk.green('✓ Workspace 初始化成功！'));
            console.log('');
            console.log(chalk.cyan('Workspace 信息：'));
            console.log(`  ID: ${meta.id}`);
            console.log(`  创建时间: ${meta.createdAt}`);
            console.log(`  默认租约时长: ${meta.options.defaultLeaseDuration}s`);
            console.log(`  自动合并: ${meta.options.autoMergeEnabled ? '启用' : '禁用'}`);
            console.log('');
            console.log(chalk.gray('数据存储在: .doc-guard/ 目录中'));

        } catch (error) {
            handleError(error, '初始化 workspace 失败');
        }
    });

program
    .command('status')
    .description('显示 workspace 状态信息')
    .action(() => {
        try {
            const ws = getWorkspace();
            const meta = ws.getMeta();
            const trackedFiles = ws.listTrackedFiles();
            const revisions = ws.getAllRevisions();

            const leaseManager = new LeaseManager(ws);
            const activeLeases = leaseManager.getActiveLeases();

            const coordinator = new WriteCoordinator(ws);
            const pendingConflicts = coordinator.getPendingConflicts();

            console.log(chalk.cyan('=== Workspace 状态 ==='));
            console.log('');
            console.log(`ID: ${meta.id}`);
            console.log(`创建时间: ${meta.createdAt}`);
            console.log('');
            console.log(chalk.cyan('--- 统计 ---'));
            console.log(`跟踪文件: ${trackedFiles.length} 个`);
            console.log(`总修订数: ${revisions.length} 个`);
            console.log(`活跃租约: ${activeLeases.length} 个`);
            console.log(`待处理冲突: ${pendingConflicts.length} 个`);
            console.log('');

            if (trackedFiles.length > 0) {
                console.log(chalk.cyan('--- 跟踪的文件 ---'));
                trackedFiles.forEach(file => {
                    const fileRevisions = revisions.filter(r => r.relativePath === file);
                    const lastRev = fileRevisions[fileRevisions.length - 1];
                    console.log(`  ${chalk.blue(file)}`);
                    console.log(`    修订数: ${fileRevisions.length}`);
                    console.log(`    最后修改: ${lastRev?.timestamp || '未知'} (${lastRev?.author || 'unknown'})`);
                });
                console.log('');
            }

            if (activeLeases.length > 0) {
                console.log(chalk.yellow('--- 活跃租约 ---'));
                activeLeases.forEach(lease => {
                    console.log(`  ${chalk.blue(lease.relativePath)}`);
                    console.log(`    持有者: ${lease.author}`);
                    console.log(`    创建时间: ${lease.createdAt}`);
                    console.log(`    过期时间: ${lease.expiresAt}`);
                });
                console.log('');
            }

            if (pendingConflicts.length > 0) {
                console.log(chalk.red('--- 待处理冲突 ---'));
                pendingConflicts.forEach(conflict => {
                    console.log(`  ID: ${chalk.red(conflict.id.substring(0, 8))}...`);
                    console.log(`    文件: ${conflict.relativePath}`);
                    console.log(`    创建时间: ${conflict.createdAt}`);
                    console.log(`    冲突数: ${conflict.conflictCount}`);
                });
            }

        } catch (error) {
            handleError(error, '获取状态失败');
        }
    });

program
    .command('write <file>')
    .description('写入文件内容（支持版本校验和自动合并）')
    .option('--author <name>', '作者名称', 'unknown')
    .option('--message <msg>', '提交信息')
    .option('--lease-id <id>', '使用的租约 ID')
    .option('--expected-revision <id>', '期望的修订版本 ID')
    .option('--no-auto-merge', '禁用自动合并')
    .option('--content <text>', '直接提供内容（代替从文件读取）')
    .option('--from-file <path>', '从指定文件读取内容')
    .action(async (relativePath, options) => {
        try {
            const ws = getWorkspace();

            let content;
            if (options.content) {
                content = options.content;
            } else if (options.fromFile) {
                const sourcePath = path.resolve(cwd, options.fromFile);
                if (!fs.existsSync(sourcePath)) {
                    throw new Error(`源文件不存在: ${sourcePath}`);
                }
                content = fs.readFileSync(sourcePath, 'utf8');
            } else {
                const fullPath = path.resolve(cwd, relativePath);
                if (!fs.existsSync(fullPath)) {
                    throw new Error(`文件不存在: ${fullPath}。使用 --content 或 --from-file 提供内容。`);
                }
                content = fs.readFileSync(fullPath, 'utf8');
            }

            const coordinator = new WriteCoordinator(ws);

            console.log(chalk.gray(`正在写入: ${relativePath}`));
            console.log(chalk.gray(`作者: ${options.author}`));

            const result = await coordinator.attemptWrite(
                relativePath,
                content,
                options.author,
                {
                    leaseId: options.leaseId,
                    expectedRevisionId: options.expectedRevision,
                    autoMerge: options.autoMerge !== false
                }
            );

            switch (result.result) {
                case WriteCoordinator.WRITE_RESULT.SUCCESS:
                    console.log(chalk.green('✓ 写入成功！'));
                    if (result.isNew) {
                        console.log(chalk.green('  新文件已创建'));
                    }
                    if (result.revision) {
                        console.log(`  修订 ID: ${result.revision.id}`);
                        console.log(`  哈希: ${result.revision.hash.substring(0, 16)}...`);
                    }
                    break;

                case WriteCoordinator.WRITE_RESULT.MERGED:
                    console.log(chalk.yellow('✓ 自动合并成功！'));
                    console.log(chalk.yellow(`  ${result.message}`));
                    if (result.mergeResult?.details) {
                        console.log(`  合并类型: ${result.mergeResult.status}`);
                    }
                    if (result.revision) {
                        console.log(`  修订 ID: ${result.revision.id}`);
                    }
                    if (result.finalContent) {
                        ws.writeWorkingFile(relativePath, result.finalContent);
                        console.log(chalk.gray('  工作文件已更新'));
                    }
                    break;

                case WriteCoordinator.WRITE_RESULT.CONFLICT:
                    console.log(chalk.red('✗ 检测到冲突！'));
                    console.log(chalk.red(`  ${result.message}`));
                    console.log('');
                    console.log(chalk.yellow('冲突信息：'));
                    if (result.conflict) {
                        console.log(`  冲突 ID: ${result.conflict.id}`);
                        console.log(`  文件: ${result.conflict.relativePath}`);
                    }
                    if (result.mergeResult?.conflicts) {
                        console.log(`  冲突数量: ${result.mergeResult.conflicts.length}`);
                        result.mergeResult.conflicts.forEach((c, i) => {
                            console.log(`    ${i + 1}. ${c.type}: ${c.blockTitle || c.path || 'unknown'}`);
                        });
                    }
                    console.log('');
                    console.log(chalk.cyan('解决方法：'));
                    console.log('  1. 查看冲突详情: doc-guard conflict show <conflict-id>');
                    console.log('  2. 使用一方的版本: doc-guard conflict resolve <id> --choice theirs/ours');
                    console.log('  3. 手动解决后: doc-guard conflict resolve <id> --choice manual --content "<resolved>"');
                    break;

                case WriteCoordinator.WRITE_RESULT.LEASE_EXPIRED:
                    console.log(chalk.red('✗ 租约已过期或无效！'));
                    console.log(chalk.red(`  ${result.message}`));
                    if (result.details?.leaseCheck) {
                        console.log(`  原因: ${result.details.leaseCheck.reason}`);
                    }
                    break;

                case WriteCoordinator.WRITE_RESULT.VERSION_MISMATCH:
                    console.log(chalk.red('✗ 版本不匹配！'));
                    console.log(chalk.red(`  ${result.message}`));
                    if (result.details) {
                        console.log(`  期望版本: ${result.details.expectedRevisionId}`);
                        console.log(`  当前版本: ${result.details.actualRevisionId}`);
                    }
                    console.log('');
                    console.log(chalk.cyan('建议：'));
                    console.log('  1. 获取最新版本: 查看当前内容');
                    console.log('  2. 重新申请租约: doc-guard lease acquire <file>');
                    console.log('  3. 或者允许自动合并: 不加 --expected-revision 参数');
                    break;

                default:
                    console.log(chalk.yellow(`结果: ${result.result}`));
                    console.log(result.message);
            }

        } catch (error) {
            handleError(error, '写入失败');
        }
    });

const leaseCmd = program
    .command('lease')
    .description('租约管理命令');

leaseCmd
    .command('acquire <file>')
    .description('为文件申请一个写租约')
    .option('--author <name>', '作者名称', 'unknown')
    .option('--duration <seconds>', '租约时长（秒）')
    .option('--expected-revision <id>', '期望的修订版本 ID')
    .action((relativePath, options) => {
        try {
            const ws = getWorkspace();
            const leaseManager = new LeaseManager(ws);

            const result = leaseManager.acquireLease(
                relativePath,
                options.author,
                options.duration ? parseInt(options.duration) : null,
                options.expectedRevision
            );

            if (result.success) {
                console.log(chalk.green('✓ 租约申请成功！'));
                console.log('');
                console.log(chalk.cyan('租约信息：'));
                console.log(`  ID: ${result.lease.id}`);
                console.log(`  文件: ${result.lease.relativePath}`);
                console.log(`  持有者: ${result.lease.author}`);
                console.log(`  创建时间: ${result.lease.createdAt}`);
                console.log(`  过期时间: ${result.lease.expiresAt}`);
                console.log(`  时长: ${result.lease.durationSeconds}s`);
                console.log('');
                console.log(chalk.yellow('⚠️  使用此租约写入时，请传递 --lease-id 参数：'));
                console.log(chalk.gray(`   doc-guard write ${relativePath} --lease-id ${result.lease.id}`));
            } else {
                console.log(chalk.red('✗ 租约申请失败'));
                console.log(chalk.red(`  原因: ${result.reason}`));
                console.log(`  ${result.message}`);

                if (result.lease) {
                    console.log('');
                    console.log(chalk.cyan('现有租约信息：'));
                    console.log(`  持有者: ${result.lease.author}`);
                    console.log(`  过期时间: ${result.lease.expiresAt}`);
                }
            }

        } catch (error) {
            handleError(error, '申请租约失败');
        }
    });

leaseCmd
    .command('release <lease-id>')
    .description('释放一个租约')
    .option('--author <name>', '作者名称（验证用）')
    .action((leaseId, options) => {
        try {
            const ws = getWorkspace();
            const leaseManager = new LeaseManager(ws);

            const result = leaseManager.releaseLease(leaseId, options.author);

            console.log(chalk.green('✓ 租约已释放！'));
            console.log(`  文件: ${result.lease.relativePath}`);
            console.log(`  原持有者: ${result.lease.author}`);
            console.log(`  原过期时间: ${result.lease.expiresAt}`);

        } catch (error) {
            handleError(error, '释放租约失败');
        }
    });

leaseCmd
    .command('renew <lease-id>')
    .description('续租一个活跃的租约')
    .option('--duration <seconds>', '新的租约时长（秒）')
    .action((leaseId, options) => {
        try {
            const ws = getWorkspace();
            const leaseManager = new LeaseManager(ws);

            const result = leaseManager.renewLease(
                leaseId,
                options.duration ? parseInt(options.duration) : null
            );

            console.log(chalk.green('✓ 租约已续租！'));
            console.log(`  文件: ${result.lease.relativePath}`);
            console.log(`  持有者: ${result.lease.author}`);
            console.log(`  新过期时间: ${result.lease.expiresAt}`);
            console.log(`  续租次数: ${result.lease.renewedAt?.length || 1}`);

        } catch (error) {
            handleError(error, '续租失败');
        }
    });

leaseCmd
    .command('list')
    .description('列出所有租约')
    .option('--active', '只显示活跃租约')
    .option('--file <path>', '只显示指定文件的租约')
    .action((options) => {
        try {
            const ws = getWorkspace();
            const leaseManager = new LeaseManager(ws);

            let leases;
            if (options.active) {
                leases = leaseManager.getActiveLeases(options.file);
            } else {
                leases = leaseManager.getAllLeases();
                if (options.file) {
                    leases = leases.filter(l => l.relativePath === options.file);
                }
            }

            if (leases.length === 0) {
                console.log(chalk.gray('没有找到租约记录。'));
                return;
            }

            console.log(chalk.cyan(`=== 租约列表 (${leases.length} 个) ===`));
            console.log('');

            leases.forEach((lease, index) => {
                const statusColor = lease.status === 'active' ? chalk.green :
                                   lease.status === 'expired' ? chalk.red :
                                   lease.status === 'released' ? chalk.gray : chalk.yellow;

                console.log(`${index + 1}. ${chalk.blue(lease.relativePath)}`);
                console.log(`   ID: ${lease.id}`);
                console.log(`   状态: ${statusColor(lease.status)}`);
                console.log(`   持有者: ${lease.author}`);
                console.log(`   创建: ${lease.createdAt}`);
                console.log(`   过期: ${lease.expiresAt}`);
                if (lease.releasedAt) {
                    console.log(`   释放: ${lease.releasedAt}`);
                }
                console.log('');
            });

        } catch (error) {
            handleError(error, '获取租约列表失败');
        }
    });

leaseCmd
    .command('show <lease-id>')
    .description('显示租约详情')
    .action((leaseId) => {
        try {
            const ws = getWorkspace();
            const leaseManager = new LeaseManager(ws);

            const lease = leaseManager.getLease(leaseId);

            if (!lease) {
                console.log(chalk.red(`✗ 租约不存在: ${leaseId}`));
                process.exit(1);
            }

            const verification = leaseManager.verifyLease(leaseId);

            console.log(chalk.cyan('=== 租约详情 ==='));
            console.log('');
            console.log(`ID: ${lease.id}`);
            console.log(`文件: ${lease.relativePath}`);
            console.log(`状态: ${verification.valid ? chalk.green('有效') : chalk.red('无效')}`);
            if (!verification.valid) {
                console.log(`无效原因: ${verification.reason}`);
            }
            console.log('');
            console.log(`持有者: ${lease.author}`);
            console.log(`创建时间: ${lease.createdAt}`);
            console.log(`过期时间: ${lease.expiresAt}`);
            console.log(`时长: ${lease.durationSeconds}s`);
            console.log('');
            if (lease.expectedRevisionId) {
                console.log(`期望修订版本: ${lease.expectedRevisionId}`);
            }
            if (lease.renewedAt) {
                console.log(`续租次数: ${lease.renewedAt.length}`);
                lease.renewedAt.forEach((time, i) => {
                    console.log(`  ${i + 1}. ${time}`);
                });
            }

        } catch (error) {
            handleError(error, '获取租约详情失败');
        }
    });

const conflictCmd = program
    .command('conflict')
    .description('冲突管理命令');

conflictCmd
    .command('list')
    .description('列出待处理的冲突')
    .option('--file <path>', '只显示指定文件的冲突')
    .action((options) => {
        try {
            const ws = getWorkspace();
            const coordinator = new WriteCoordinator(ws);

            const conflicts = coordinator.getPendingConflicts(options.file);

            if (conflicts.length === 0) {
                console.log(chalk.green('✓ 没有待处理的冲突！'));
                return;
            }

            console.log(chalk.red(`=== 待处理冲突 (${conflicts.length} 个) ===`));
            console.log('');

            conflicts.forEach((conflict, index) => {
                console.log(`${index + 1}. ${chalk.red(conflict.relativePath)}`);
                console.log(`   ID: ${conflict.id}`);
                console.log(`   作者: ${conflict.author}`);
                console.log(`   创建时间: ${conflict.createdAt}`);
                console.log(`   冲突数量: ${conflict.conflictCount}`);
                console.log('');
            });

            console.log(chalk.cyan('使用以下命令查看详情：'));
            console.log(chalk.gray('  doc-guard conflict show <conflict-id>'));

        } catch (error) {
            handleError(error, '获取冲突列表失败');
        }
    });

conflictCmd
    .command('show <conflict-id>')
    .description('显示冲突详情')
    .action((conflictId) => {
        try {
            const ws = getWorkspace();
            const coordinator = new WriteCoordinator(ws);

            const conflict = coordinator.getConflict(conflictId);

            if (!conflict) {
                console.log(chalk.red(`✗ 冲突不存在: ${conflictId}`));
                process.exit(1);
            }

            console.log(chalk.red('=== 冲突详情 ==='));
            console.log('');
            console.log(`ID: ${conflict.id}`);
            console.log(`文件: ${conflict.relativePath}`);
            console.log(`状态: ${conflict.status}`);
            console.log(`创建时间: ${conflict.createdAt}`);
            console.log(`作者: ${conflict.author}`);
            console.log('');

            if (conflict.humanReadable) {
                console.log(chalk.cyan('--- 冲突摘要 ---'));
                console.log(conflict.humanReadable);
            }

            if (conflict.mergeResult?.message) {
                console.log('');
                console.log(chalk.cyan('--- 合并信息 ---'));
                console.log(conflict.mergeResult.message);
            }

            console.log('');
            console.log(chalk.cyan('--- 解决选项 ---'));
            console.log('1. 接受 THEIR 版本（其他人的更改）:');
            console.log(chalk.gray(`   doc-guard conflict resolve ${conflictId} --choice theirs`));
            console.log('');
            console.log('2. 接受 OUR 版本（你的更改）:');
            console.log(chalk.gray(`   doc-guard conflict resolve ${conflictId} --choice ours`));
            console.log('');
            console.log('3. 手动合并后提交:');
            console.log(chalk.gray(`   doc-guard conflict resolve ${conflictId} --choice manual --content "<resolved content>"`));
            console.log('');
            console.log('   或者编辑文件后使用:');
            console.log(chalk.gray(`   doc-guard write ${conflict.relativePath} --author <your-name>`));

        } catch (error) {
            handleError(error, '获取冲突详情失败');
        }
    });

conflictCmd
    .command('resolve <conflict-id>')
    .description('解决冲突')
    .requiredOption('--choice <option>', '选择版本: theirs, ours, manual')
    .option('--author <name>', '作者名称', 'unknown')
    .option('--content <text>', '手动解决后的内容（当 choice=manual 时需要）')
    .option('--from-file <path>', '从文件读取解决后的内容')
    .action(async (conflictId, options) => {
        try {
            const ws = getWorkspace();
            const coordinator = new WriteCoordinator(ws);

            let resolvedContent = null;

            if (options.choice === 'manual') {
                if (options.content) {
                    resolvedContent = options.content;
                } else if (options.fromFile) {
                    const sourcePath = path.resolve(cwd, options.fromFile);
                    if (!fs.existsSync(sourcePath)) {
                        throw new Error(`源文件不存在: ${sourcePath}`);
                    }
                    resolvedContent = fs.readFileSync(sourcePath, 'utf8');
                } else {
                    const conflict = coordinator.getConflict(conflictId);
                    if (conflict?.files?.ours?.content) {
                        resolvedContent = conflict.files.ours.content;
                        console.log(chalk.yellow('⚠️  未提供内容，使用 OUR 版本作为基础'));
                    } else {
                        throw new Error('当 choice=manual 时，必须提供 --content 或 --from-file');
                    }
                }
            }

            const result = coordinator.resolveConflict(
                conflictId,
                options.choice,
                options.author,
                resolvedContent
            );

            console.log(chalk.green('✓ 冲突已解决！'));
            console.log('');
            console.log(`冲突 ID: ${conflictId}`);
            console.log(`解决方式: ${options.choice}`);
            console.log(`解决者: ${options.author}`);
            console.log(`修订 ID: ${result.revision.id}`);
            console.log('');
            console.log(chalk.gray('工作文件已更新'));

        } catch (error) {
            handleError(error, '解决冲突失败');
        }
    });

program
    .command('history <file>')
    .description('查看文件的修订历史')
    .option('--limit <n>', '显示最近 N 条记录', '10')
    .action((relativePath, options) => {
        try {
            const ws = getWorkspace();

            const history = ws.getFileHistory(relativePath);

            if (history.length === 0) {
                console.log(chalk.gray(`文件 ${relativePath} 没有修订历史。`));
                return;
            }

            const limit = parseInt(options.limit);
            const display = history.slice(0, limit);

            console.log(chalk.cyan(`=== ${relativePath} 的修订历史 (最近 ${display.length} 条) ===`));
            console.log('');

            display.forEach((rev, index) => {
                const isLatest = index === 0;
                const marker = isLatest ? chalk.green(' [最新]') : '';

                console.log(`${index + 1}. ${chalk.blue(rev.id.substring(0, 12))}...${marker}`);
                console.log(`   作者: ${rev.author}`);
                console.log(`   时间: ${rev.timestamp}`);
                console.log(`   大小: ${rev.size} bytes`);
                console.log(`   哈希: ${rev.hash.substring(0, 16)}...`);
                if (rev.message) {
                    console.log(`   消息: ${rev.message}`);
                }
                if (rev.parentRevisionId) {
                    console.log(`   父版本: ${rev.parentRevisionId.substring(0, 12)}...`);
                }
                console.log('');
            });

            if (history.length > limit) {
                console.log(chalk.gray(`... 还有 ${history.length - limit} 条更早的记录`));
            }

        } catch (error) {
            handleError(error, '获取历史记录失败');
        }
    });

program
    .command('simulate')
    .description('运行并发写入模拟')
    .option('--scenario <type>', '模拟场景: overwrite, clean_merge, conflict, mixed', 'mixed')
    .option('--workers <n>', '并发 worker 数量', '3')
    .option('--iterations <n>', '每个 worker 的迭代次数', '5')
    .option('--file-types <types>', '测试文件类型: md,json', 'md,json')
    .option('--delay <ms>', '操作间隔毫秒', '100')
    .option('--output <path>', '输出报告文件路径')
    .option('--format <fmt>', '报告格式: json, md', 'md')
    .option('--verbose', '显示详细输出')
    .action(async (options) => {
        try {
            const ws = getWorkspace();
            const simulator = new Simulator(ws);

            const validScenarios = Object.values(Simulator.SCENARIOS);
            if (!validScenarios.includes(options.scenario)) {
                throw new Error(`无效的场景类型: ${options.scenario}。有效类型: ${validScenarios.join(', ')}`);
            }

            const fileTypes = options.fileTypes.split(',').map(t => t.trim());

            console.log(chalk.cyan('=== 启动并发模拟 ==='));
            console.log('');
            console.log(`场景: ${options.scenario}`);
            console.log(`Worker 数量: ${options.workers}`);
            console.log(`迭代次数: ${options.iterations}`);
            console.log(`文件类型: ${fileTypes.join(', ')}`);
            console.log(`操作间隔: ${options.delay}ms`);
            console.log('');

            const startTime = Date.now();

            const results = await simulator.runSimulation({
                scenario: options.scenario,
                workerCount: parseInt(options.workers),
                iterations: parseInt(options.iterations),
                fileTypes,
                delayMs: parseInt(options.delay),
                verbose: options.verbose
            });

            const duration = Date.now() - startTime;

            console.log(chalk.green('✓ 模拟完成！'));
            console.log('');
            console.log(chalk.cyan('--- 统计 ---'));
            console.log(`总耗时: ${formatDuration(duration)}`);
            console.log(`总写入尝试: ${results.statistics.totalWrites}`);
            console.log(`成功写入: ${chalk.green(results.statistics.successfulWrites)}`);
            console.log(`自动合并: ${chalk.yellow(results.statistics.mergedWrites)}`);
            console.log(`检测冲突: ${chalk.red(results.statistics.conflicts)}`);
            console.log(`租约/版本问题: ${chalk.red(results.statistics.leaseIssues)}`);
            console.log(`拒绝: ${chalk.red(results.statistics.rejections)}`);
            console.log('');

            const report = simulator.generateSimulationReport(results, options.format);

            if (options.output) {
                const outputPath = path.resolve(cwd, options.output);
                const outputDir = path.dirname(outputPath);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                fs.writeFileSync(outputPath, report);
                console.log(chalk.green(`报告已写入: ${outputPath}`));
            } else {
                console.log(chalk.cyan('--- 模拟报告 ---'));
                console.log(report);
            }

        } catch (error) {
            handleError(error, '模拟运行失败');
        }
    });

const auditCmd = program
    .command('audit')
    .description('审计和导出命令');

auditCmd
    .command('export')
    .description('导出审计报告')
    .option('--format <fmt>', '导出格式: json, html, md', 'json')
    .option('--output <path>', '输出文件路径')
    .option('--start <time>', '开始时间 (ISO 格式)')
    .option('--end <time>', '结束时间 (ISO 格式)')
    .option('--no-revisions', '不包含修订信息')
    .option('--no-conflicts', '不包含冲突信息')
    .option('--no-leases', '不包含租约信息')
    .action((options) => {
        try {
            const ws = getWorkspace();
            const exporter = new AuditExporter(ws);

            console.log(chalk.cyan('生成审计报告...'));

            const result = exporter.export({
                format: options.format,
                outputPath: options.output ? path.resolve(cwd, options.output) : null,
                startTime: options.start,
                endTime: options.end,
                includeRevisions: options.revisions !== false,
                includeConflicts: options.conflicts !== false,
                includeLeases: options.leases !== false
            });

            if (result.outputPath) {
                console.log(chalk.green(`✓ 报告已导出: ${result.outputPath}`));
                console.log(`格式: ${result.format}`);
                console.log(`大小: ${result.fileSize} bytes`);
            } else {
                console.log(chalk.cyan('--- 审计报告 ---'));
                console.log(result.content);
            }

        } catch (error) {
            handleError(error, '导出审计报告失败');
        }
    });

auditCmd
    .command('log')
    .description('查看审计日志')
    .option('--action <type>', '过滤操作类型')
    .option('--limit <n>', '显示最近 N 条', '50')
    .option('--verbose', '显示详细信息')
    .action((options) => {
        try {
            const ws = getWorkspace();

            const logs = ws.getAuditLog(null, null, options.action);
            const limit = parseInt(options.limit);
            const display = logs.slice(-limit);

            if (display.length === 0) {
                console.log(chalk.gray('没有审计日志记录。'));
                return;
            }

            console.log(chalk.cyan(`=== 审计日志 (最近 ${display.length} 条) ===`));
            console.log('');

            display.forEach((entry, index) => {
                const actionColor = entry.action.includes('success') || entry.action.includes('merged') ? chalk.green :
                                   entry.action.includes('conflict') || entry.action.includes('reject') || entry.action.includes('expire') ? chalk.red :
                                   chalk.blue;

                console.log(`${index + 1}. ${actionColor(entry.action)}`);
                console.log(`   时间: ${entry.timestamp}`);

                if (options.verbose && entry.details) {
                    console.log(`   详情: ${JSON.stringify(entry.details, null, 2).replace(/\n/g, '\n         ')}`);
                } else if (entry.details) {
                    const details = [];
                    if (entry.details.author) details.push(`作者: ${entry.details.author}`);
                    if (entry.details.file) details.push(`文件: ${entry.details.file}`);
                    if (entry.details.relativePath) details.push(`文件: ${entry.details.relativePath}`);
                    if (entry.details.revisionId) details.push(`版本: ${entry.details.revisionId.substring(0, 12)}`);
                    if (entry.details.conflictId) details.push(`冲突: ${entry.details.conflictId.substring(0, 12)}`);

                    if (details.length > 0) {
                        console.log(`   ${details.join(' | ')}`);
                    }
                }
                console.log('');
            });

            if (logs.length > limit) {
                console.log(chalk.gray(`... 还有 ${logs.length - limit} 条更早的记录`));
            }

        } catch (error) {
            handleError(error, '获取审计日志失败');
        }
    });

program.parse(process.argv);
