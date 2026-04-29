const Modal = {
    container: null,

    init() {
        this.container = document.getElementById('modalContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'modalContainer';
            document.body.appendChild(this.container);
        }
    },

    show(options) {
        const {
            title,
            content,
            confirmText = '确认',
            cancelText = '取消',
            showCancel = true,
            onConfirm,
            onCancel
        } = options;

        const modalHtml = `
            <div class="modal-overlay" id="currentModal">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close" id="modalClose">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        ${showCancel ? `<button class="btn-secondary" id="modalCancel">${cancelText}</button>` : ''}
                        <button class="btn-primary" id="modalConfirm">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = modalHtml;
        const overlay = document.getElementById('currentModal');

        document.getElementById('modalClose').onclick = () => {
            this.hide();
            if (onCancel) onCancel();
        };

        if (showCancel) {
            document.getElementById('modalCancel').onclick = () => {
                this.hide();
                if (onCancel) onCancel();
            };
        }

        document.getElementById('modalConfirm').onclick = () => {
            if (onConfirm) {
                const result = onConfirm();
                if (result !== false) {
                    this.hide();
                }
            } else {
                this.hide();
            }
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.hide();
                if (onCancel) onCancel();
            }
        };
    },

    hide() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    },

    confirm(message, onConfirm, onCancel) {
        this.show({
            title: '确认',
            content: `<p>${message}</p>`,
            confirmText: '确定',
            cancelText: '取消',
            showCancel: true,
            onConfirm,
            onCancel
        });
    },

    alert(message, onConfirm) {
        this.show({
            title: '提示',
            content: `<p>${message}</p>`,
            confirmText: '知道了',
            showCancel: false,
            onConfirm
        });
    },

    prompt(title, placeholder, onConfirm, defaultValue = '') {
        const content = `
            <div class="form-group">
                <input type="text" class="text-input" id="promptInput" placeholder="${placeholder}" value="${defaultValue}">
            </div>
        `;

        this.show({
            title,
            content,
            confirmText: '确认',
            cancelText: '取消',
            showCancel: true,
            onConfirm: () => {
                const input = document.getElementById('promptInput');
                if (onConfirm && input) {
                    onConfirm(input.value);
                }
            }
        });

        setTimeout(() => {
            const input = document.getElementById('promptInput');
            if (input) {
                input.focus();
            }
        }, 100);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Modal.init();
});
