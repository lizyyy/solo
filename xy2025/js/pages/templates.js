const TemplatesPage = {
    currentScenario: 'perfunctory',

    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.querySelectorAll('.scenario-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchScenario(e.target.dataset.scenario);
            });
        });
    },

    switchScenario(scenario) {
        this.currentScenario = scenario;
        
        document.querySelectorAll('.scenario-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.scenario === scenario) {
                tab.classList.add('active');
            }
        });

        this.render();
    },

    render() {
        const templates = Storage.getTemplates().filter(t => t.scenario === this.currentScenario);
        const container = document.getElementById('templatesList');

        if (templates.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无模板</p>';
            return;
        }

        let html = '';
        templates.forEach(template => {
            html += this.renderTemplateCard(template);
        });

        container.innerHTML = html;
        this.bindCopyEvents();
    },

    renderTemplateCard(template) {
        return `
            <div class="template-card">
                <div class="template-content">${template.content}</div>
                ${template.description ? `<p style="font-size: 12px; color: var(--text-light); margin-bottom: 8px;">${template.description}</p>` : ''}
                <div class="template-actions">
                    <button class="btn-copy" data-content="${template.content.replace(/"/g, '&quot;')}">
                        复制
                    </button>
                </div>
            </div>
        `;
    },

    bindCopyEvents() {
        document.querySelectorAll('.btn-copy').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const content = e.target.dataset.content;
                try {
                    await Utils.copyToClipboard(content);
                    Toast.success('已复制到剪贴板');
                } catch (err) {
                    Toast.error('复制失败');
                }
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    TemplatesPage.init();
});
