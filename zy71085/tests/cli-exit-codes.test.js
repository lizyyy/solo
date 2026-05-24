'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { execSync } = require('child_process')
const path = require('path')

const CLI_PATH = path.join(__dirname, '..', 'bin', 'apkd.js')

function runCLI (args) {
  try {
    execSync(`node ${CLI_PATH} ${args}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    })
    return { exitCode: 0 }
  } catch (err) {
    return { exitCode: err.status, stdout: err.stdout, stderr: err.stderr }
  }
}

describe('CLI 退出码测试', () => {
  it('无权限变更应返回退出码 0', () => {
    const result = runCLI('compare --old examples/old/AndroidManifest.xml --new examples/old/AndroidManifest.xml --format terminal')
    assert.strictEqual(result.exitCode, 0, `期望退出码 0，实际为 ${result.exitCode}`)
  })

  it('高风险权限新增应返回退出码 11', () => {
    const result = runCLI('compare --old examples/old/AndroidManifest.xml --new examples/new/AndroidManifest.xml --format terminal')
    assert.strictEqual(result.exitCode, 11, `期望退出码 11，实际为 ${result.exitCode}`)
  })

  it('文件不存在应返回退出码 2', () => {
    const result = runCLI('compare --old nonexistent.xml --new examples/old/AndroidManifest.xml')
    assert.strictEqual(result.exitCode, 2, `期望退出码 2，实际为 ${result.exitCode}`)
  })

  it('缺少必需参数应返回退出码 1', () => {
    const result = runCLI('compare')
    assert.strictEqual(result.exitCode, 1, `期望退出码 1，实际为 ${result.exitCode}`)
  })

  it('list 命令应返回退出码 0', () => {
    const result = runCLI('list --risk')
    assert.strictEqual(result.exitCode, 0, `期望退出码 0，实际为 ${result.exitCode}`)
  })
})
