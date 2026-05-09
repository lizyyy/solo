/**
 * 需求项类型定义
 * @typedef {Object} Requirement
 * @property {string} id - 需求唯一标识
 * @property {string} title - 需求标题
 * @property {string} description - 需求描述
 * @property {string} [status] - 需求状态
 * @property {string[]} [tags] - 需求标签
 */

/**
 * 测试用例类型定义
 * @typedef {Object} TestCase
 * @property {string} id - 用例唯一标识
 * @property {string} title - 用例标题
 * @property {string} [description] - 用例描述
 * @property {string[]} requirements - 关联的需求ID列表
 * @property {string[]} [codePaths] - 关联的代码路径
 * @property {'passed'|'failed'|'skipped'|'pending'} [status] - 执行状态
 * @property {string} [lastRun] - 最后执行时间
 */

/**
 * 代码路径信息
 * @typedef {Object} CodePath
 * @property {string} path - 文件路径
 * @property {string} [functionName] - 函数名
 * @property {number} [startLine] - 起始行
 * @property {number} [endLine] - 结束行
 * @property {string[]} [testCases] - 关联的测试用例ID
 */

/**
 * 覆盖缺口
 * @typedef {Object} CoverageGap
 * @property {string} type - 缺口类型
 * @property {string} id - 相关项ID
 * @property {string} description - 缺口描述
 * @property {'high'|'medium'|'low'} severity - 严重程度
 */

/**
 * 失败项
 * @typedef {Object} FailureItem
 * @property {string} id - 唯一标识
 * @property {string} type - 失败类型
 * @property {string} relatedId - 相关项ID
 * @property {string} description - 失败描述
 * @property {string} timestamp - 记录时间
 * @property {Object} [details] - 详细信息
 */
