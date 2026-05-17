const DEFAULT_RULES = {
  categories: [
    {
      name: '修复',
      key: 'fix',
      color: 'red',
      priority: 100,
      patterns: [
        /^fix:/i,
        /^bugfix/i,
        /修复/i,
        /解决.*问题/i,
        /修正/i,
        /修复/i,
        /patch/i,
        /hotfix/i,
        /fix\s/i,
        /bug/i,
        /issue/i,
        /defect/i
      ],
      filePatterns: []
    },
    {
      name: '新功能',
      key: 'feature',
      color: 'green',
      priority: 90,
      patterns: [
        /^feat:/i,
        /^feature/i,
        /新增/i,
        /添加/i,
        /增加/i,
        /实现/i,
        /新功能/i,
        /feature/i,
        /add/i,
        /new/i,
        /introduce/i
      ],
      filePatterns: []
    },
    {
      name: '重构',
      key: 'refactor',
      color: 'yellow',
      priority: 80,
      patterns: [
        /^refactor:/i,
        /重构/i,
        /代码重构/i,
        /优化/i,
        /改进/i,
        /refactor/i,
        /rewrite/i,
        /restructure/i,
        /cleanup/i,
        /整理/i
      ],
      filePatterns: []
    },
    {
      name: '配置改动',
      key: 'config',
      color: 'blue',
      priority: 70,
      patterns: [
        /^config:/i,
        /^chore:/i,
        /配置/i,
        /更新配置/i,
        /修改配置/i,
        /config/i,
        /configuration/i,
        /setting/i,
        /env/i,
        /environment/i
      ],
      filePatterns: [
        /\.json$/i,
        /\.yaml$/i,
        /\.yml$/i,
        /\.config\./i,
        /\.env/i,
        /package\.json$/i,
        /tsconfig\.json$/i,
        /webpack\.config/i,
        /babel\.config/i,
        /\.eslintrc/i,
        /\.prettierrc/i
      ]
    },
    {
      name: '文档',
      key: 'docs',
      color: 'cyan',
      priority: 60,
      patterns: [
        /^docs:/i,
        /文档/i,
        /更新文档/i,
        /修改文档/i,
        /README/i,
        /doc\s/i,
        /documentation/i,
        /comment/i,
        /注释/i
      ],
      filePatterns: [
        /\.md$/i,
        /\.txt$/i,
        /\.rst$/i,
        /README/i,
        /CHANGELOG/i,
        /docs?\//i
      ]
    },
    {
      name: '测试',
      key: 'test',
      color: 'magenta',
      priority: 50,
      patterns: [
        /^test:/i,
        /测试/i,
        /单元测试/i,
        /集成测试/i,
        /添加测试/i,
        /test/i,
        /spec/i,
        /unittest/i,
        /e2e/i,
        /coverage/i
      ],
      filePatterns: [
        /\.test\./i,
        /\.spec\./i,
        /_test\./i,
        /tests?\//i,
        /__tests__\//i
      ]
    },
    {
      name: '样式',
      key: 'style',
      color: 'gray',
      priority: 40,
      patterns: [
        /^style:/i,
        /样式/i,
        /格式化/i,
        /代码风格/i,
        /lint/i,
        /format/i,
        /indent/i,
        /whitespace/i,
        /css/i,
        /style/i
      ],
      filePatterns: [
        /\.css$/i,
        /\.scss$/i,
        /\.less$/i,
        /\.styl$/i
      ]
    },
    {
      name: '构建/CI',
      key: 'build',
      color: 'gray',
      priority: 35,
      patterns: [
        /^build:/i,
        /^ci:/i,
        /构建/i,
        /打包/i,
        /ci\s/i,
        /build/i,
        /compile/i,
        /pipeline/i,
        /workflow/i,
        /github action/i
      ],
      filePatterns: [
        /\.github\//i,
        /\.gitlab-ci\.yml/i,
        /dockerfile/i,
        /docker-compose/i,
        /Makefile$/i
      ]
    },
    {
      name: '回滚',
      key: 'revert',
      color: 'red',
      priority: 30,
      patterns: [
        /^revert:/i,
        /回滚/i,
        /撤销/i,
        /revert/i,
        /rollback/i
      ],
      filePatterns: []
    },
    {
      name: '性能',
      key: 'perf',
      color: 'orange',
      priority: 25,
      patterns: [
        /^perf:/i,
        /性能/i,
        /优化性能/i,
        /性能优化/i,
        /performance/i,
        /speed/i,
        /optimize/i,
        /cache/i
      ],
      filePatterns: []
    }
  ],
  uncategorized: {
    name: '其他',
    key: 'other',
    color: 'gray'
  }
};

class Classifier {
  constructor(customRules = null) {
    this.rules = customRules || DEFAULT_RULES;
    this.errors = [];
  }

  classify(commit) {
    if (!commit || !commit.subject) {
      this.errors.push({
        type: 'empty_commit',
        commitHash: commit?.hash,
        reason: '提交对象为空或没有subject字段'
      });
      return {
        category: this.rules.uncategorized,
        matchedPattern: null,
        confidence: 0
      };
    }

    const subject = commit.subject;
    const files = commit.files || [];

    let bestMatch = {
      category: this.rules.uncategorized,
      matchedPattern: null,
      confidence: 0
    };

    for (const category of this.rules.categories) {
      let matchScore = 0;
      let matchedPattern = null;

      for (const pattern of category.patterns) {
        if (pattern.test(subject)) {
          matchScore = category.priority;
          matchedPattern = pattern.toString();
          break;
        }
      }

      if (matchScore === 0 && category.filePatterns.length > 0) {
        for (const file of files) {
          for (const pattern of category.filePatterns) {
            if (pattern.test(file.path)) {
              matchScore = category.priority * 0.5;
              matchedPattern = pattern.toString();
              break;
            }
          }
          if (matchScore > 0) break;
        }
      }

      if (matchScore > bestMatch.confidence) {
        bestMatch = {
          category,
          matchedPattern,
          confidence: matchScore
        };
      }
    }

    return bestMatch;
  }

  classifyAll(commits) {
    const results = [];
    const errors = [];

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      try {
        const classification = this.classify(commit);
        results.push({
          ...commit,
          classification
        });
      } catch (error) {
        errors.push({
          type: 'classification_error',
          lineNumber: commit.lineNumber || i,
          commitHash: commit.hash,
          content: commit.subject,
          reason: error.message
        });
      }
    }

    return {
      classified: results,
      errors: [...errors, ...this.errors]
    };
  }

  groupByCategory(classifiedCommits) {
    const groups = {};
    
    for (const category of this.rules.categories) {
      groups[category.key] = {
        category: category,
        commits: []
      };
    }
    
    groups[this.rules.uncategorized.key] = {
      category: this.rules.uncategorized,
      commits: []
    };

    for (const commit of classifiedCommits) {
      const categoryKey = commit.classification.category.key;
      if (groups[categoryKey]) {
        groups[categoryKey].commits.push(commit);
      } else {
        groups[this.rules.uncategorized.key].commits.push(commit);
      }
    }

    return groups;
  }

  addCustomCategory(category) {
    if (!category.name || !category.key || !category.patterns) {
      throw new Error('自定义分类需要name、key和patterns字段');
    }
    
    this.rules.categories.push({
      priority: 50,
      color: 'gray',
      filePatterns: [],
      ...category
    });
  }
}

Classifier.DEFAULT_RULES = DEFAULT_RULES;

module.exports = Classifier;