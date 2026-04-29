const Navigation = {
    currentPage: 'home',
    pageIds: {
        'home': 'homePage',
        'relationships': 'relationshipsPage',
        'templates': 'templatesPage',
        'avoid': 'avoidPage',
        'favors': 'favorsPage',
        'reminders': 'remindersPage',
        'assessment': 'assessmentPage',
        'battery': 'batteryPage',
        'community': 'communityPage'
    },

    init() {
        this.bindEvents();
        this.navigateTo('home');
    },

    bindEvents() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.navigateTo(page);
            });
        });

        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.navigateTo(page);
            });
        });

        document.getElementById('socialBatteryBtn').addEventListener('click', () => {
            this.navigateTo('battery');
        });
    },

    navigateTo(page) {
        if (!this.pageIds[page]) {
            console.error(`Page not found: ${page}`);
            return;
        }

        this.currentPage = page;

        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });

        const targetPage = document.getElementById(this.pageIds[page]);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });

        this.onPageChange(page);
    },

    onPageChange(page) {
        switch (page) {
            case 'home':
                HomePage.render();
                break;
            case 'relationships':
                RelationshipsPage.render();
                break;
            case 'templates':
                TemplatesPage.render();
                break;
            case 'avoid':
                AvoidPage.render();
                break;
            case 'favors':
                FavorsPage.render();
                break;
            case 'reminders':
                RemindersPage.render();
                break;
            case 'assessment':
                AssessmentPage.init();
                break;
            case 'battery':
                BatteryPage.render();
                break;
            case 'community':
                CommunityPage.render();
                break;
        }
    }
};
