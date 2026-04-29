const AssessmentPage = {
    scoringWeights: {
        meetFrequency: {
            'daily': 5,
            'weekly': 4,
            'monthly': 3,
            'rarely': 2,
            'never': 1
        },
        afterFeeling: {
            'energetic': 25,
            'neutral': 10,
            'tired': -15,
            'negative': -30
        },
        initiative: {
            'always': 15,
            'sometimes': 8,
            'rarely': 0,
            'never': -10
        },
        hasInterest: {
            'no': 0,
            'minor': -5,
            'major': -15
        },
        hasConflict: {
            'no': 10,
            'minor': -5,
            'major': -20
        }
    },

    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('assessBtn').addEventListener('click', () => {
            this.assess();
        });
    },

    assess() {
        const relationType = document.getElementById('relationType').value;
        const meetFrequency = document.getElementById('meetFrequency').value;
        const afterFeeling = document.getElementById('afterFeeling').value;
        const initiative = document.getElementById('initiative').value;
        const hasInterest = document.getElementById('hasInterest').value;
        const hasConflict = document.getElementById('hasConflict').value;

        let score = 50;
        const factors = [];

        const freqScore = this.scoringWeights.meetFrequency[meetFrequency];
        score += freqScore;
        factors.push({
            label: '相处频率',
            value: this.getLabel('meetFrequency', meetFrequency),
            score: freqScore,
            positive: freqScore >= 0
        });

        const feelingScore = this.scoringWeights.afterFeeling[afterFeeling];
        score += feelingScore;
        factors.push({
            label: '相处感受',
            value: this.getLabel('afterFeeling', afterFeeling),
            score: feelingScore,
            positive: feelingScore >= 0
        });

        const initiativeScore = this.scoringWeights.initiative[initiative];
        score += initiativeScore;
        factors.push({
            label: '对方主动性',
            value: this.getLabel('initiative', initiative),
            score: initiativeScore,
            positive: initiativeScore >= 0
        });

        const interestScore = this.scoringWeights.hasInterest[hasInterest];
        score += interestScore;
        factors.push({
            label: '利益往来',
            value: this.getLabel('hasInterest', hasInterest),
            score: interestScore,
            positive: interestScore >= 0
        });

        const conflictScore = this.scoringWeights.hasConflict[hasConflict];
        score += conflictScore;
        factors.push({
            label: '矛盾状况',
            value: this.getLabel('hasConflict', hasConflict),
            score: conflictScore,
            positive: conflictScore >= 0
        });

        score = Math.max(0, Math.min(100, score));

        this.showResult(score, factors, relationType);
    },

    getLabel(category, value) {
        const labels = {
            meetFrequency: {
                'daily': '每天',
                'weekly': '每周几次',
                'monthly': '每月几次',
                'rarely': '很少',
                'never': '几乎不'
            },
            afterFeeling: {
                'energetic': '充满能量',
                'neutral': '平淡',
                'tired': '有些疲惫',
                'negative': '心情变差'
            },
            initiative: {
                'always': '经常主动',
                'sometimes': '偶尔',
                'rarely': '很少',
                'never': '从不'
            },
            hasInterest: {
                'no': '没有',
                'minor': '有一些',
                'major': '利益关系重要'
            },
            hasConflict: {
                'no': '没有',
                'minor': '有小矛盾，已解决',
                'major': '有重大矛盾，未解决'
            },
            relationType: {
                'friend': '朋友',
                'colleague': '同事',
                'family': '家人',
                'partner': '伴侣',
                'acquaintance': '熟人'
            }
        };
        return labels[category]?.[value] || value;
    },

    showResult(score, factors, relationType) {
        const resultContainer = document.getElementById('assessmentResult');
        
        let resultType = '';
        let resultIcon = '';
        let resultTitle = '';
        let suggestion = '';
        let scoreClass = '';

        if (score >= 70) {
            scoreClass = 'high';
            resultIcon = '🌟';
            resultTitle = '优质关系';
            resultType = '优质';
            suggestion = `这是一段非常健康的${this.getLabel('relationType', relationType)}关系！对方能给你带来正能量，相处感受积极，且双方互动良好。建议：继续保持这段关系，可以多投入时间和精力维护，这样的关系值得珍惜。`;
        } else if (score >= 40) {
            scoreClass = 'medium';
            resultIcon = '⚖️';
            resultTitle = '普通关系';
            resultType = '普通';
            suggestion = `这是一段比较普通的${this.getLabel('relationType', relationType)}关系。有积极的一面，也有需要注意的地方。建议：保持现状即可，不必刻意投入过多，但也不必疏远。如果想改善，可以尝试增加真诚的沟通和互动。`;
        } else if (score >= 20) {
            scoreClass = 'low';
            resultIcon = '⚠️';
            resultTitle = '消耗型关系';
            resultType = '消耗';
            suggestion = `这段${this.getLabel('relationType', relationType)}关系可能在消耗你的能量。相处后感到疲惫、对方不够主动、或者存在未解决的矛盾，都是需要注意的信号。建议：减少不必要的社交互动，保护好自己的精力。如果必须维持（如同事关系），保持表面和平即可，不必深交。`;
        } else {
            scoreClass = 'low';
            resultIcon = '🚨';
            resultTitle = '有毒关系';
            resultType = '有毒';
            suggestion = `警告：这很可能是一段"有毒"的${this.getLabel('relationType', relationType)}关系！相处后心情变差、存在重大矛盾、对方从不主动联系，这些都是强烈的负面信号。建议：强烈建议考虑疏远甚至断联。你的心理健康和情绪稳定比什么都重要。如果是家人或无法完全切断的关系，建议保持物理和心理距离，减少互动频率。`;
        }

        let factorsHtml = '';
        factors.forEach(factor => {
            factorsHtml += `
                <div class="factor-item">
                    <span>${factor.label}：${factor.value}</span>
                    <span class="factor-score ${factor.positive ? 'positive' : 'negative'}">
                        ${factor.score >= 0 ? '+' : ''}${factor.score}
                    </span>
                </div>
            `;
        });

        resultContainer.innerHTML = `
            <div class="result-header">
                <div class="result-icon">${resultIcon}</div>
                <div class="result-title">${resultTitle}</div>
                <div class="result-score ${scoreClass}">${score}分</div>
            </div>
            <div class="result-details">
                <h4>评分细节</h4>
                ${factorsHtml}
            </div>
            <div class="result-suggestion">
                <strong>💡 建议：</strong><br>
                ${suggestion}
            </div>
        `;

        resultContainer.classList.remove('hidden');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AssessmentPage.init();
});
