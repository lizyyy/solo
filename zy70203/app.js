window.App = {
    currentPage: 'dashboard',

    init: function() {
        this.bindNavigation();
        this.renderPage('dashboard');
        this.addGlobalEventListeners();
    },

    bindNavigation: function() {
        var navButtons = document.querySelectorAll('.nav-btn');
        var self = this;
        
        for (var i = 0; i < navButtons.length; i++) {
            (function(btn) {
                btn.addEventListener('click', function() {
                    var pageName = this.dataset.page;
                    if (pageName) {
                        self.navigateTo(pageName);
                    }
                });
            })(navButtons[i]);
        }
    },

    navigateTo: function(pageName) {
        if (this.currentPage === pageName) return;

        var allNav = document.querySelectorAll('.nav-btn');
        for (var i = 0; i < allNav.length; i++) {
            var btn = allNav[i];
            if (btn.dataset.page === pageName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }

        var allPages = document.querySelectorAll('.page');
        for (var j = 0; j < allPages.length; j++) {
            allPages[j].classList.remove('active');
        }

        this.renderPage(pageName);
        this.currentPage = pageName;
    },

    renderPage: function(pageName) {
        var pageContainer = document.getElementById('page-' + pageName);
        if (!pageContainer) return;

        pageContainer.classList.add('active');

        if (pageName === 'dashboard' && window.DashboardPage) {
            window.DashboardPage.render();
        } else if (pageName === 'residents' && window.ResidentsPage) {
            window.ResidentsPage.render();
        } else if (pageName === 'screenings' && window.ScreeningsPage) {
            window.ScreeningsPage.render();
        } else if (pageName === 'retests' && window.RetestsPage) {
            window.RetestsPage.render();
        } else if (pageName === 'followups' && window.FollowupsPage) {
            window.FollowupsPage.render();
        } else if (pageName === 'guide' && window.GuidePage) {
            window.GuidePage.render();
        }
    },

    addGlobalEventListeners: function() {
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn')) {
                var ripple = document.createElement('span');
                ripple.classList.add('ripple');
                var rect = e.target.getBoundingClientRect();
                ripple.style.left = (e.clientX - rect.left) + 'px';
                ripple.style.top = (e.clientY - rect.top) + 'px';
                e.target.appendChild(ripple);
                setTimeout(function() { ripple.remove(); }, 600);
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && window.Utils) {
                window.Utils.closeModal();
            }
        });
    }
};

window.addEventListener('DOMContentLoaded', function() {
    App.init();
});
