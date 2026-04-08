/* ===== MoraJunto — Frontend Script ===== */

const API = window.location.origin + '/api';
let currentUser = null;
let currentToken = localStorage.getItem('alugaja_token');
let selectedBedrooms = 0;
let currentPropertyId = null;

// ===== TOAST NOTIFICATIONS =====
const _toastIcons = {
    success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = (_toastIcons[type] || _toastIcons.info) +
        '<span>' + message + '</span>' +
        '<button class="toast-close" onclick="this.parentElement.classList.remove(\'toast-enter\');this.parentElement.classList.add(\'toast-exit\');setTimeout(()=>this.parentElement.remove(),350)">&times;</button>';

    container.appendChild(toast);

    // Max 3 toasts
    while (container.children.length > 3) {
        container.children[0].remove();
    }

    requestAnimationFrame(function() {
        toast.classList.add('toast-enter');
    });

    setTimeout(function() {
        if (toast.parentElement) {
            toast.classList.remove('toast-enter');
            toast.classList.add('toast-exit');
            setTimeout(function() { toast.remove(); }, 350);
        }
    }, 4000);
}

// ===== BUTTON LOADING STATE =====
function setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
        btn._origText = btn.textContent;
        btn.classList.add('btn-loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        if (btn._origText) btn.textContent = btn._origText;
    }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    checkAuth();
    loadFeaturedProperties();
    loadStats();
    animateStatsOnScroll();
    handleFacebookCallback();
    initExitIntentPopup();
    animateRefCounter();
});

// ===== FACEBOOK OAUTH CALLBACK HANDLER =====
function handleFacebookCallback() {
    var params = new URLSearchParams(window.location.search);
    var fbSuccess = params.get('fb_success');
    var fbError = params.get('fb_error');
    var fbName = params.get('fb_name');
    var token = params.get('token');

    // Clean URL
    if (fbSuccess || fbError) {
        window.history.replaceState({}, '', '/');
    }

    if (fbSuccess === 'linked') {
        showToast('Facebook verificado com sucesso! Conta vinculada: ' + (fbName || ''), 'success');
        // Refresh user data
        checkAuth();
        showPage('roommate');
    } else if (fbSuccess === 'login') {
        // Read token from httpOnly cookie via API endpoint
        fetch(API + '/auth/fb-token', { credentials: 'include' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.token) {
                    currentToken = data.token;
                    localStorage.setItem('alugaja_token', data.token);
                    checkAuth();
                }
            }).catch(function() {});
    } else if (fbError === 'denied') {
        showToast('Verificação do Facebook cancelada.', 'warning');
    } else if (fbError === 'no_account') {
        showToast('Conta do Facebook encontrada (' + (fbName || '') + '), mas você precisa estar logado primeiro. Faça login e tente novamente.', 'warning');
    } else if (fbError) {
        showToast('Erro na verificação do Facebook. Tente novamente.', 'error');
    }
}

// ===== NAVBAR =====
function initNavbar() {
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (window.scrollY > 20) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('open');
}

function closeMobileMenu() {
    document.getElementById('mobileMenu').classList.remove('open');
}

// ===== PAGE NAVIGATION =====
function showPage(page, scrollTo) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Show target page
    const target = document.getElementById('page-' + page);
    if (target) {
        target.classList.add('active');
    }

    // Update nav active state
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Scroll to section if specified
    if (scrollTo) {
        setTimeout(() => {
            const el = document.getElementById(scrollTo);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }

    // Load page-specific data
    if (page === 'search') {
        doSearch();
    } else if (page === 'agency') {
        loadAgencyDashboard();
    } else if (page === 'admin') {
        loadAdminPanel();
    } else if (page === 'owner' && typeof loadOwnerPanel === 'function') {
        loadOwnerPanel();
    } else if (page === 'tenant' && typeof loadTenantPanel === 'function') {
        loadTenantPanel();
    } else if (page === 'chat' && typeof initChat === 'function') {
        initChat();
    } else if (page === 'referral') {
        loadMyReferrals();
        if (typeof loadReferralPix === 'function') loadReferralPix();
    } else if (page === 'owners-landing') {
        if (typeof calcOwnerRevenue === 'function') calcOwnerRevenue();
    }

    closeMobileMenu();

    // Update bottom nav active state
    document.querySelectorAll('.bottom-nav-item').forEach(function(item) {
        item.classList.toggle('active', item.getAttribute('data-page') === page);
    });
}

// ===== AUTH =====
function checkAuth() {
    if (!currentToken) {
        updateNavAuth(false);
        return;
    }

    fetch(API + '/auth/me', {
        headers: { 'Authorization': 'Bearer ' + currentToken }
    })
    .then(r => {
        if (!r.ok) throw new Error('Invalid token');
        return r.json();
    })
    .then(data => {
        currentUser = data.user || data;
        updateNavAuth(true);
    })
    .catch(() => {
        var hadToken = !!currentToken;
        currentToken = null;
        localStorage.removeItem('alugaja_token');
        updateNavAuth(false);
        if (hadToken) {
            var toast = document.createElement('div');
            toast.className = 'session-expired-toast';
            toast.textContent = 'Sua sessão expirou. Faça login novamente.';
            toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#e74c3c;color:#fff;padding:12px 24px;border-radius:8px;z-index:10000;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
            document.body.appendChild(toast);
            setTimeout(function(){ toast.remove(); }, 5000);
        }
    });
}

function updateNavAuth(loggedIn) {
    const navUser = document.getElementById('navUser');
    const navLogout = document.getElementById('navLogout');
    const navAgency = document.getElementById('navAgency');
    const navAdmin = document.getElementById('navAdmin');
    const navOwner = document.getElementById('navOwner');
    const navTenant = document.getElementById('navTenant');
    const navUserMobile = document.getElementById('navUserMobile');
    const navLogoutMobile = document.getElementById('navLogoutMobile');
    const navAgencyMobile = document.getElementById('navAgencyMobile');
    const navAdminMobile = document.getElementById('navAdminMobile');
    const navOwnerMobile = document.getElementById('navOwnerMobile');
    const navTenantMobile = document.getElementById('navTenantMobile');
    const navChat = document.getElementById('navChat');
    const navChatMobile = document.getElementById('navChatMobile');

    const navReferral = document.getElementById('navReferral');

    if (loggedIn && currentUser) {
        // Show referral, chat and notifications for all logged-in users
        if (navReferral) navReferral.classList.remove('hidden');
        if (navChat) navChat.classList.remove('hidden');
        if (navChatMobile) navChatMobile.classList.remove('hidden');
        var navNotif = document.getElementById('navNotifications');
        if (navNotif) navNotif.classList.remove('hidden');
        if (typeof loadNotifCount === 'function') loadNotifCount();
        var bottomChat = document.getElementById('bottomNavChat');
        if (bottomChat) bottomChat.style.display = '';

        navUser.textContent = currentUser.name || 'Minha conta';
        navUser.onclick = null;
        navUser.classList.remove('btn', 'btn-accent', 'btn-sm');
        navLogout.style.display = '';
        navUserMobile.textContent = currentUser.name || 'Minha conta';
        navLogoutMobile.style.display = '';

        if (currentUser.role === 'owner') {
            if (navOwner) navOwner.style.display = '';
            if (navOwnerMobile) navOwnerMobile.style.display = '';
        }
        if (currentUser.role === 'user') {
            if (navTenant) navTenant.style.display = '';
            if (navTenantMobile) navTenantMobile.style.display = '';
        }
        if (currentUser.role === 'agency') {
            navAgency.style.display = '';
            navAgencyMobile.style.display = '';
        }
        if (currentUser.role === 'admin') {
            navAdmin.style.display = '';
            navAdminMobile.style.display = '';
            navAgency.style.display = '';
            navAgencyMobile.style.display = '';
            if (navOwner) navOwner.style.display = '';
            if (navOwnerMobile) navOwnerMobile.style.display = '';
        }
    } else {
        navUser.textContent = 'Entrar';
        navUser.onclick = () => showLoginModal();
        navUser.classList.add('btn', 'btn-accent', 'btn-sm');
        navLogout.style.display = 'none';
        navAgency.style.display = 'none';
        navAdmin.style.display = 'none';
        if (navOwner) navOwner.style.display = 'none';
        if (navTenant) navTenant.style.display = 'none';
        navUserMobile.textContent = 'Entrar / Cadastrar';
        navUserMobile.onclick = () => { showLoginModal(); closeMobileMenu(); };
        navLogoutMobile.style.display = 'none';
        navAgencyMobile.style.display = 'none';
        navAdminMobile.style.display = 'none';
        if (navOwnerMobile) navOwnerMobile.style.display = 'none';
        if (navTenantMobile) navTenantMobile.style.display = 'none';
        if (navReferral) navReferral.classList.add('hidden');
        if (navChat) navChat.classList.add('hidden');
        if (navChatMobile) navChatMobile.classList.add('hidden');
        var navNotifOff = document.getElementById('navNotifications');
        if (navNotifOff) navNotifOff.classList.add('hidden');
    }
}

var _loginOpenedAt = 0;
var _loginAttempts = 0;

function showLoginModal(tab, role) {
    document.getElementById('loginModal').classList.add('open');
    _loginOpenedAt = Date.now();
    if (tab === 'register') {
        switchLoginTab('register');
        if (role) {
            document.getElementById('regRole').value = role;
            toggleAgencyFields();
        }
    } else {
        switchLoginTab('login');
    }
}

function togglePasswordVisibility(inputId, btn) {
    var input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    } else {
        input.type = 'password';
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    }
}

function hideLoginModal() {
    document.getElementById('loginModal').classList.remove('open');
    clearFormFeedback('loginFeedback');
    clearFormFeedback('registerFeedback');
}

function switchLoginTab(tab) {
    document.querySelectorAll('#loginModal .modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#loginModal .modal-tab-content').forEach(c => c.classList.remove('active'));

    if (tab === 'register') {
        document.querySelectorAll('#loginModal .modal-tab')[1].classList.add('active');
        document.getElementById('loginTab-register').classList.add('active');
    } else {
        document.querySelectorAll('#loginModal .modal-tab')[0].classList.add('active');
        document.getElementById('loginTab-login').classList.add('active');
    }
}

function toggleAgencyFields() {
    const role = document.getElementById('regRole').value;
    document.getElementById('agencyFields').style.display = role === 'agency' ? 'block' : 'none';
}

async function login(e) {
    e.preventDefault();
    clearFormFeedback('loginFeedback');

    // Honeypot check (bots fill hidden fields)
    var honeypot = document.getElementById('loginHoneypot');
    if (honeypot && honeypot.value) { return; }

    // Speed check (bots submit in < 2 seconds)
    if (_loginOpenedAt && (Date.now() - _loginOpenedAt) < 2000) {
        showFormFeedback('loginFeedback', 'Aguarde um momento antes de tentar', 'error');
        return;
    }

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    // Frontend validation
    if (!email || !password) {
        showFormFeedback('loginFeedback', 'Preencha email e senha', 'error');
        return;
    }

    // Disable button during request
    var btn = document.getElementById('loginSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

    try {
        const res = await fetch(API + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            _loginAttempts++;
            var msg = data.message || data.error || 'Email ou senha incorretos';
            showFormFeedback('loginFeedback', msg, 'error');
            var attInfo = document.getElementById('loginAttemptsInfo');
            if (attInfo && _loginAttempts >= 2) {
                if (_loginAttempts >= 5) {
                    attInfo.textContent = 'Conta bloqueada temporariamente (15 min). Tente novamente mais tarde.';
                } else {
                    attInfo.textContent = 'Tentativa ' + _loginAttempts + '/5 — após 5 sua conta será bloqueada por 15 minutos';
                }
            }
            if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
            return;
        }

        currentToken = data.token;
        currentUser = data.user;
        localStorage.setItem('alugaja_token', currentToken);
        _loginAttempts = 0;
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        var attInfo = document.getElementById('loginAttemptsInfo');
        if (attInfo) attInfo.textContent = '';
        updateNavAuth(true);
        hideLoginModal();

        if (currentUser.role === 'agency') {
            showPage('agency');
        } else if (currentUser.role === 'owner') {
            showPage('owner');
        }
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        showFormFeedback('loginFeedback', 'Erro de conexão. Tente novamente.', 'error');
    }
}

async function register(e) {
    e.preventDefault();
    clearFormFeedback('registerFeedback');

    // Honeypot
    var regHoneypot = document.getElementById('regHoneypot');
    if (regHoneypot && regHoneypot.value) { return; }

    // Speed check
    if (_loginOpenedAt && (Date.now() - _loginOpenedAt) < 3000) {
        showFormFeedback('registerFeedback', 'Preencha o formulario com calma', 'error');
        return;
    }

    // Validar termos
    var termsCheck = document.getElementById('regTerms');
    if (termsCheck && !termsCheck.checked) {
        showFormFeedback('registerFeedback', 'Voce precisa aceitar os Termos de Uso e a Politica de Privacidade', 'error');
        return;
    }

    const payload = {
        name: document.getElementById('regName').value.trim().replace(/<[^>]*>/g, ''),
        email: document.getElementById('regEmail').value.trim().toLowerCase(),
        password: document.getElementById('regPassword').value,
        role: document.getElementById('regRole').value,
        cpf: document.getElementById('regCPF') ? document.getElementById('regCPF').value : '',
        birthDate: document.getElementById('regBirthDate') ? document.getElementById('regBirthDate').value : '',
        gender: document.getElementById('regGender') ? document.getElementById('regGender').value : '',
        profilePhoto: document.getElementById('regPhoto') ? document.getElementById('regPhoto').value : ''
    };

    // Validar CPF no frontend
    if (payload.cpf && typeof validateCPF === 'function' && !validateCPF(payload.cpf)) {
        showFormFeedback('registerFeedback', 'CPF inválido. Verifique os números digitados.', 'error');
        return;
    }

    // Validar idade 18+
    if (payload.birthDate) {
        var birth = new Date(payload.birthDate);
        var today = new Date();
        var age = today.getFullYear() - birth.getFullYear();
        var m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        if (age < 18) {
            showFormFeedback('registerFeedback', 'Você precisa ter pelo menos 18 anos para se cadastrar.', 'error');
            return;
        }
    }

    if (payload.role === 'agency') {
        payload.phone = document.getElementById('regPhone').value;
        payload.creci = document.getElementById('regCreci').value;
    }

    try {
        const res = await fetch(API + '/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            showFormFeedback('registerFeedback', data.error || data.message || 'Erro ao cadastrar', 'error');
            return;
        }

        currentToken = data.token;
        currentUser = data.user;
        localStorage.setItem('alugaja_token', currentToken);
        updateNavAuth(true);
        hideLoginModal();

        if (currentUser.role === 'agency') {
            showPage('agency');
        } else if (currentUser.role === 'owner') {
            showPage('owner');
        }
    } catch (err) {
        showFormFeedback('registerFeedback', 'Erro de conexão. Tente novamente.', 'error');
    }
}

function logout() {
    currentToken = null;
    currentUser = null;
    localStorage.removeItem('alugaja_token');
    updateNavAuth(false);
    showPage('home');
}

// ===== STATS =====
async function loadStats() {
    try {
        const res = await fetch(API + '/stats');
        if (res.ok) {
            const data = await res.json();
            animateCounter('statProperties', data.properties || 0);
        }
    } catch {
        animateCounter('statProperties', 156);
    }
    // Live people counter (simulated with realistic variation)
    startLivePeopleCounter();
}

function startLivePeopleCounter() {
    var baseCount = 15 + Math.floor(Math.random() * 20); // 15-35
    var hour = new Date().getHours();
    // More people during peak hours (10-14h, 18-22h)
    if (hour >= 10 && hour <= 14) baseCount += 15;
    else if (hour >= 18 && hour <= 22) baseCount += 25;
    else if (hour >= 23 || hour <= 6) baseCount = Math.max(5, baseCount - 10);

    function updateCount() {
        var variation = Math.floor(Math.random() * 7) - 3; // -3 to +3
        baseCount = Math.max(8, Math.min(55, baseCount + variation));
        var el = document.getElementById('heroLiveCount');
        var statEl = document.getElementById('statPeople');
        if (el) el.textContent = baseCount + ' pessoas';
        if (statEl) statEl.textContent = baseCount;
    }
    updateCount();
    animateCounter('statPeople', baseCount);
    setInterval(updateCount, 8000 + Math.random() * 7000); // Every 8-15s
}

function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let current = 0;
    const step = Math.max(1, Math.floor(target / 40));
    const interval = setInterval(() => {
        current += step;
        if (current >= target) {
            current = target;
            clearInterval(interval);
        }
        el.textContent = current.toLocaleString('pt-BR');
    }, 30);
}

function animateStatsOnScroll() {
    // Intersection observer for fade-up animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeUp 0.6s var(--ease) forwards';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.step-card, .diff-card, .property-card').forEach(el => {
        observer.observe(el);
    });

    // Reveal observer for sections and grids
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05 });

    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
        var rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            el.classList.add('visible');
        } else {
            revealObserver.observe(el);
        }
    });

    // CountUp animation for number values
    var countUpObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var el = entry.target;
                var target = parseInt(el.getAttribute('data-countup')) || 0;
                var prefix = el.getAttribute('data-prefix') || '';
                var suffix = el.getAttribute('data-suffix') || '';
                var duration = 1500;
                var startTime = null;
                function step(timestamp) {
                    if (!startTime) startTime = timestamp;
                    var progress = Math.min((timestamp - startTime) / duration, 1);
                    var eased = 1 - Math.pow(1 - progress, 3);
                    var current = Math.floor(eased * target);
                    el.textContent = prefix + current + suffix;
                    if (progress < 1) requestAnimationFrame(step);
                }
                requestAnimationFrame(step);
                countUpObserver.unobserve(el);
            }
        });
    }, { threshold: 0.3 });

    document.querySelectorAll('[data-countup]').forEach(function(el) {
        countUpObserver.observe(el);
    });
}

// ===== FEATURED PROPERTIES =====
async function loadFeaturedProperties() {
    const grid = document.getElementById('featuredGrid');
    grid.innerHTML = renderSkeletonCards(6);

    try {
        const res = await fetch(API + '/properties/featured');
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const properties = data.properties || data || [];
        if (properties.length === 0) throw new Error('Empty');
        renderPropertyCards(properties.slice(0, 6), 'featuredGrid');
    } catch {
        // Show demo data on error or empty results
        renderPropertyCards(getDemoProperties(), 'featuredGrid');
    }
}

// ===== SEARCH =====
function heroSearchGo() {
    var heroEl = document.getElementById('heroSearch');
    var query = heroEl ? heroEl.value : '';
    document.getElementById('searchInput').value = query;
    showPage('search');
}

function quickSearch(term) {
    var heroEl = document.getElementById('heroSearch');
    if (heroEl) heroEl.value = term;
    document.getElementById('searchInput').value = term;
    showPage('search');
}

async function doSearch() {
    const query = document.getElementById('searchInput').value;
    const filters = collectFilters();
    const grid = document.getElementById('searchResults');
    const empty = document.getElementById('emptyState');

    grid.innerHTML = renderSkeletonCards(6);
    empty.style.display = 'none';

    try {
        const params = new URLSearchParams();
        if (query) params.append('search', query);
        if (filters.types.length) params.append('type', filters.types.join(','));
        if (filters.transaction) params.append('transaction', filters.transaction);
        if (filters.priceMin) params.append('priceMin', filters.priceMin);
        if (filters.priceMax) params.append('priceMax', filters.priceMax);
        if (filters.bedrooms) params.append('bedrooms', filters.bedrooms);
        if (filters.neighborhood) params.append('neighborhood', filters.neighborhood);
        if (filters.sort) params.append('sort', filters.sort);

        const res = await fetch(API + '/properties?' + params.toString());
        if (!res.ok) throw new Error('Failed');

        const data = await res.json();
        const properties = data.properties || data || [];

        if (properties.length === 0) {
            grid.innerHTML = '';
            empty.style.display = 'block';
            document.getElementById('resultsCount').textContent = '0 imóveis encontrados';
        } else {
            empty.style.display = 'none';
            renderPropertyCards(properties, 'searchResults', true);
            document.getElementById('resultsCount').textContent = properties.length + ' imóveis encontrados';
        }
    } catch {
        // Show demo data on error
        const demo = getDemoProperties();
        renderPropertyCards(demo, 'searchResults', true);
        document.getElementById('resultsCount').textContent = demo.length + ' imóveis encontrados';
    }
}

function collectFilters() {
    const types = [];
    document.querySelectorAll('input[name="type"]:checked').forEach(cb => types.push(cb.value));

    const transactionEl = document.querySelector('input[name="transaction"]:checked');
    const transaction = transactionEl ? transactionEl.value : '';

    return {
        types,
        transaction,
        priceMin: document.getElementById('priceMin').value,
        priceMax: document.getElementById('priceMax').value,
        bedrooms: selectedBedrooms || '',
        neighborhood: document.getElementById('neighborhoodFilter').value,
        sort: document.getElementById('sortSelect').value
    };
}

function applyFilters() {
    doSearch();
}

function clearFilters() {
    document.querySelectorAll('input[name="type"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="transaction"]').forEach(r => r.checked = false);
    document.querySelector('input[name="transaction"][value=""]').checked = true;
    document.getElementById('priceMin').value = '';
    document.getElementById('priceMax').value = '';
    document.getElementById('neighborhoodFilter').value = '';
    document.getElementById('sortSelect').value = 'recent';
    selectBedrooms(document.querySelector('.filter-btn'), 0);
}

function selectBedrooms(el, num) {
    selectedBedrooms = num;
    document.querySelectorAll('.filter-btn-row .filter-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
}

function toggleFiltersMobile() {
    document.getElementById('filtersSidebar').classList.toggle('open');
}

// ===== PROPERTY CARDS RENDERING =====
var _referralCardHtml = '<div class="property-card referral-card-inline" onclick="showPage(\'referral\')">' +
    '<div class="property-img" style="background:linear-gradient(135deg,#4338CA,#7C3AED);display:flex;align-items:center;justify-content:center">' +
    '<div style="text-align:center;color:#fff;padding:20px"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>' +
    '<p style="font-size:1.8rem;font-weight:800;margin:4px 0">R$150</p></div></div>' +
    '<div class="property-info" style="text-align:center"><h3 style="color:var(--accent)">Conhece mais imoveis?</h3>' +
    '<p style="font-size:0.85rem;color:var(--text-muted)">Indique e ganhe dinheiro por cada um alugado</p>' +
    '<span style="color:#10b981;font-weight:600;font-size:0.85rem">Indicar agora &rarr;</span></div></div>';

function renderPropertyCards(properties, containerId, withActions) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = properties.map((p, idx) => {
        var inlineAd = (idx > 0 && idx % 4 === 0) ? _referralCardHtml : '';
        const img = (p.images && p.images.length > 0) ? p.images[0] : 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop';
        const badgeClass = p.transaction === 'venda' ? 'badge-venda' : 'badge-aluguel';
        const badgeText = p.transaction === 'venda' ? 'Venda' : 'Aluguel';
        const priceText = p.transaction === 'venda' ? formatPrice(p.price) : formatPrice(Math.round(p.price * 1.08)) + '/mês';
        const id = p._id || p.id || '';
        var parkingText = (p.parking > 0) ? '<span>' + p.parking + ' vaga' + (p.parking !== 1 ? 's' : '') + '</span>' : '';
        var areaText = p.area ? '<span>' + formatArea(p.area) + '</span>' : '';

        var card = `
        <div class="property-card" onclick="showPropertyDetail('${id}')">
            <div class="property-img">
                <img src="${img}" alt="${escapeHtml(p.title || 'Imóvel')}" loading="lazy" decoding="async">
                <span class="property-badge ${badgeClass}">${badgeText}</span>
                <span class="property-price">${priceText}</span>
            </div>
            <div class="property-info">
                <h3>${escapeHtml(p.title || 'Imóvel')}</h3>
                <p class="property-address">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${escapeHtml(p.neighborhood || '')}${p.neighborhood ? ', ' : ''}Ribeirão Preto
                </p>
                <div class="property-features">
                    <span>${p.bedrooms || 0} quartos</span>
                    ${parkingText}
                    ${areaText}
                </div>
            </div>
        </div>`;
        return inlineAd + card;
    }).join('');
}

function renderSkeletonCards(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
        <div class="property-card skeleton">
            <div class="property-img"></div>
            <div class="property-info">
                <h3>&nbsp;</h3>
                <p class="property-address">&nbsp;</p>
                <div class="property-features">&nbsp;</div>
            </div>
        </div>`;
    }
    return html;
}

// ===== PROPERTY DETAIL =====
async function showPropertyDetail(id) {
    if (!id) return;
    currentPropertyId = id;
    showPage('property');

    try {
        const res = await fetch(API + '/properties/' + id);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const p = data.property || data;
        renderPropertyDetail(p);
    } catch {
        // Show demo detail
        const demo = getDemoProperties().find(d => d.id === id) || getDemoProperties()[0];
        renderPropertyDetail(demo);
    }
}

function renderPropertyDetail(p) {
    // Badge
    const badge = document.getElementById('detailBadge');
    badge.textContent = p.transaction === 'venda' ? 'Venda' : 'Aluguel';
    badge.style.background = p.transaction === 'venda' ? 'rgba(0,184,148,.1)' : 'rgba(108,92,231,.1)';
    badge.style.color = p.transaction === 'venda' ? '#00B894' : '#6C5CE7';

    // Basic info
    document.getElementById('detailTitle').textContent = p.title || '';
    // Show only neighborhood — full address hidden until rental is confirmed
    document.getElementById('detailAddress').textContent = (p.neighborhood || 'Ribeirão Preto') + ' — Ribeirão Preto';

    const detailDisplayPrice = p.transaction === 'aluguel' ? Math.round(p.price * 1.08) : p.price;
    const priceText = p.transaction === 'venda' ? formatPrice(p.price) : formatPrice(detailDisplayPrice) + '/mês';
    document.getElementById('detailPrice').textContent = priceText;

    // Features
    document.getElementById('detailBedrooms').textContent = p.bedrooms || 0;
    document.getElementById('detailBathrooms').textContent = p.bathrooms || 0;
    document.getElementById('detailParking').textContent = p.parking || 0;
    document.getElementById('detailArea').textContent = formatArea(p.area);

    // Gallery — optimized loading
    const images = (p.images && p.images.length) ? p.images : [
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop'
    ];

    // Optimize Unsplash URLs: smaller for thumbs, quality param
    function optimizeImg(url, width, quality) {
        if (url.includes('unsplash.com')) {
            return url.replace(/w=\d+/, 'w=' + width).replace(/h=\d+/, 'h=' + Math.round(width * 0.67)) + '&q=' + quality + '&fm=webp';
        }
        return url;
    }

    // Show skeleton while main image loads
    var mainImg = document.getElementById('galleryMain');
    mainImg.style.opacity = '0';
    mainImg.parentElement.classList.add('gallery-loading');
    mainImg.src = optimizeImg(images[0], 800, 80);
    mainImg.onload = function() {
        mainImg.style.opacity = '1';
        mainImg.parentElement.classList.remove('gallery-loading');
    };
    mainImg.onerror = function() {
        mainImg.style.opacity = '1';
        mainImg.parentElement.classList.remove('gallery-loading');
    };

    // Thumbs with lazy loading + smaller size
    const thumbs = document.getElementById('galleryThumbs');
    thumbs.innerHTML = images.map((img, i) => {
        var thumbUrl = optimizeImg(img, 200, 60);
        var fullUrl = optimizeImg(img, 800, 80);
        return '<img src="' + escapeHtml(thumbUrl) + '" data-full="' + escapeHtml(fullUrl) + '" class="' + (i === 0 ? 'active' : '') + '" onclick="setGalleryImage(this.dataset.full, this)" alt="Foto ' + (i + 1) + '" loading="lazy">';
    }).join('');

    // Pre-load next images in background
    images.slice(1).forEach(function(img) {
        var link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = optimizeImg(img, 800, 80);
        document.head.appendChild(link);
    });

    // Cost calculator
    const rent = p.price || 0;
    const condo = p.condominio || 0;
    const iptu = p.iptu || 0;
    const utilities = 350;

    document.getElementById('costRent').textContent = formatPrice(rent);
    document.getElementById('costCondo').textContent = formatPrice(condo);
    document.getElementById('costIptu').textContent = formatPrice(iptu);
    document.getElementById('costUtilities').textContent = '~' + formatPrice(utilities);
    document.getElementById('costTotal').textContent = formatPrice(rent + condo + iptu + utilities);

    // Description
    document.getElementById('detailDescription').textContent = p.description || 'Sem descrição disponível.';

    // Features tags
    const features = p.features || [];
    document.getElementById('detailFeatures').innerHTML = features.map(f =>
        `<span>${escapeHtml(f)}</span>`
    ).join('');

    // Neighborhood score (from real POI data or defaults)
    const scores = p.neighborhoodScore || {
        security: 70, transport: 80, commerce: 85, leisure: 60, quiet: 75
    };
    Object.keys(scores).forEach(key => {
        const fill = document.querySelector(`[data-score="${key}"]`);
        const val = document.querySelector(`[data-score-val="${key}"]`);
        if (fill) {
            fill.style.width = '0%';
            setTimeout(() => { fill.style.width = scores[key] + '%'; }, 200);
        }
        if (val) val.textContent = scores[key];
    });

    // Nearby POIs
    renderNearbyPOIs(p.nearbyPOIs);

    // Map
    renderPropertyMap(p.latitude, p.longitude, p.neighborhood);

    // Agency info
    const agency = p.agency || {};
    document.getElementById('agencyName').textContent = agency.name || 'Imobiliária';
    document.getElementById('agencyCreci').textContent = agency.creci || '';
    const logoText = (agency.name || 'IM').substring(0, 2).toUpperCase();
    document.getElementById('agencyLogo').textContent = logoText;

    // Store property data for chat contact
    window._currentPropertyOwner = agency._id || p.agency;
    window._currentPropertyId = p._id || p.id || '';
}

function formatDistance(meters) {
    if (meters < 1000) return meters + 'm';
    return (meters / 1000).toFixed(1).replace('.', ',') + 'km';
}

var poiTypeLabels = {
    university: 'Universidade', school: 'Escola', college: 'Faculdade',
    hospital: 'Hospital', clinic: 'Clínica', pharmacy: 'Farmácia',
    restaurant: 'Restaurante', cafe: 'Café', bar: 'Bar', fast_food: 'Fast Food',
    supermarket: 'Supermercado', bakery: 'Padaria', convenience: 'Conveniência',
    mall: 'Shopping', shopping_centre: 'Shopping',
    park: 'Parque', fitness_centre: 'Academia', sports_centre: 'Esporte',
    swimming_pool: 'Piscina', gym: 'Academia',
    bank: 'Banco', atm: 'Caixa Eletrônico', bus_station: 'Ponto de Ônibus',
    library: 'Biblioteca', place_of_worship: 'Igreja/Templo'
};

function renderNearbyPOIs(nearbyPOIs) {
    var section = document.getElementById('nearbySection');
    var container = document.getElementById('nearbyPOIs');
    if (!nearbyPOIs || Object.keys(nearbyPOIs).length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = '';

    Object.keys(nearbyPOIs).forEach(function(catKey) {
        var cat = nearbyPOIs[catKey];
        if (!cat.items || cat.items.length === 0) return;

        var catDiv = document.createElement('div');
        catDiv.className = 'nearby-category';

        var header = document.createElement('div');
        header.className = 'nearby-category-header';

        var icon = document.createElement('span');
        icon.className = 'nearby-category-icon';
        icon.textContent = cat.icon || '';
        header.appendChild(icon);

        var label = document.createElement('span');
        label.textContent = cat.label || catKey;
        header.appendChild(label);

        catDiv.appendChild(header);

        var items = document.createElement('div');
        items.className = 'nearby-items';

        cat.items.forEach(function(poi) {
            var item = document.createElement('div');
            item.className = 'nearby-item';

            var name = document.createElement('span');
            name.className = 'nearby-item-name';
            name.textContent = poi.name;
            item.appendChild(name);

            var typeLabel = poiTypeLabels[poi.type] || poi.type;
            if (typeLabel) {
                var typeSpan = document.createElement('span');
                typeSpan.className = 'nearby-item-type';
                typeSpan.textContent = typeLabel;
                item.appendChild(typeSpan);
            }

            var dist = document.createElement('span');
            dist.className = 'nearby-item-distance';
            dist.textContent = formatDistance(poi.distance);
            item.appendChild(dist);

            items.appendChild(item);
        });

        catDiv.appendChild(items);
        container.appendChild(catDiv);
    });
}

function renderPropertyMap(lat, lng, neighborhood) {
    var section = document.getElementById('mapSection');
    var container = document.getElementById('propertyMap');
    if (!lat || !lng) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    // Use OpenStreetMap embed (free, no API key)
    var iframe = document.createElement('iframe');
    iframe.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' +
        (lng - 0.008) + ',' + (lat - 0.006) + ',' + (lng + 0.008) + ',' + (lat + 0.006) +
        '&layer=mapnik&marker=' + lat + ',' + lng;
    iframe.loading = 'lazy';
    iframe.title = 'Mapa - ' + (neighborhood || 'Localização');
    container.innerHTML = '';
    container.appendChild(iframe);
}

function setGalleryImage(src, el) {
    var mainImg = document.getElementById('galleryMain');
    mainImg.style.opacity = '0';
    mainImg.parentElement.classList.add('gallery-loading');
    setTimeout(function() {
        mainImg.src = src;
        mainImg.onload = function() {
            mainImg.style.opacity = '1';
            mainImg.parentElement.classList.remove('gallery-loading');
        };
    }, 100);
    document.querySelectorAll('.gallery-thumbs img').forEach(img => img.classList.remove('active'));
    if (el) el.classList.add('active');
}

function calculateTotalCost() {
    const rent = parseFloat(document.getElementById('costRent').textContent.replace(/[^\d]/g, '')) || 0;
    const condo = parseFloat(document.getElementById('costCondo').textContent.replace(/[^\d]/g, '')) || 0;
    const iptu = parseFloat(document.getElementById('costIptu').textContent.replace(/[^\d]/g, '')) || 0;
    const utilities = 350;
    document.getElementById('costTotal').textContent = formatPrice(rent + condo + iptu + utilities);
}

// ===== CONTACT OWNER VIA PLATFORM CHAT =====
function contactOwnerViaChat() {
    if (!currentToken || !currentUser) {
        showLoginModal();
        return;
    }
    var ownerId = window._currentPropertyOwner;
    var propertyId = window._currentPropertyId;
    if (!ownerId) { showToast('Erro: proprietário não encontrado', 'error'); return; }
    if (typeof startConversationFromProperty === 'function') {
        startConversationFromProperty(propertyId, ownerId);
    } else {
        showPage('chat');
    }
}

// ===== VOICE SEARCH =====
function startVoiceSearch() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showToast('Seu navegador não suporta busca por voz.', 'warning');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;

    const btn = document.querySelector('.voice-btn');
    btn.classList.add('recording');

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        var heroEl = document.getElementById('heroSearch');
        if (heroEl) heroEl.value = text;
        document.getElementById('searchInput').value = text;
        btn.classList.remove('recording');
        showPage('search');
    };

    recognition.onerror = () => {
        btn.classList.remove('recording');
    };

    recognition.onend = () => {
        btn.classList.remove('recording');
    };

    recognition.start();
}

// ===== AGENCY DASHBOARD =====
async function loadAgencyDashboard() {
    if (!currentToken) {
        showPage('home');
        showLoginModal();
        return;
    }

    try {
        // Load agency stats
        const statsRes = await fetch(API + '/agency/stats', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (statsRes.ok) {
            const stats = await statsRes.json();
            document.getElementById('agStatProperties').textContent = stats.properties || 0;
            document.getElementById('agStatLeads').textContent = stats.leads || 0;
            document.getElementById('agStatViews').textContent = stats.views || 0;
        }

        // Load agency properties
        loadAgencyProperties();

        // Load agency leads
        loadAgencyLeads();

        // Load commission stat
        loadAgentRewardsStat();
    } catch {
        console.error('Failed to load agency dashboard');
    }
}

async function loadAgencyProperties() {
    try {
        const res = await fetch(API + '/agency/properties', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (!res.ok) throw new Error('Failed');

        const data = await res.json();
        const properties = data.properties || data || [];

        if (properties.length === 0) {
            document.getElementById('agencyPropertiesGrid').innerHTML = '';
            document.getElementById('agencyEmptyProperties').style.display = 'block';
        } else {
            document.getElementById('agencyEmptyProperties').style.display = 'none';
            renderAgencyPropertyCards(properties, 'agencyPropertiesGrid');
        }
    } catch {
        document.getElementById('agencyPropertiesGrid').innerHTML = '';
        document.getElementById('agencyEmptyProperties').style.display = 'block';
    }
}

function renderAgencyPropertyCards(properties, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = properties.map(p => {
        const img = (p.images && p.images.length > 0) ? p.images[0] : 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop';
        const badgeClass = p.transaction === 'venda' ? 'badge-venda' : 'badge-aluguel';
        const badgeText = p.transaction === 'venda' ? 'Venda' : 'Aluguel';
        const priceText = p.transaction === 'venda' ? formatPrice(p.price) : formatPrice(Math.round(p.price * 1.08)) + '/mês';
        const id = p._id || p.id || '';

        return `
        <div class="property-card">
            <div class="property-img" style="background-image:url('${img}')">
                <span class="property-badge ${badgeClass}">${badgeText}</span>
                <span class="property-price">${priceText}</span>
            </div>
            <div class="property-info">
                <h3>${escapeHtml(p.title || 'Imóvel')}</h3>
                <p class="property-address">${escapeHtml(p.neighborhood || '')} - Ribeirão Preto</p>
                <div class="property-features">
                    <span>${p.bedrooms || 0} quartos</span>
                    <span>${p.parking || 0} vagas</span>
                    <span>${formatArea(p.area)}</span>
                </div>
            </div>
            <div class="property-card-actions">
                <button class="btn btn-outline btn-sm" onclick="editProperty('${id}')">Editar</button>
                <button class="btn btn-outline btn-sm" style="color:var(--coral);border-color:var(--coral)" onclick="deleteProperty('${id}')">Excluir</button>
            </div>
        </div>`;
    }).join('');
}

async function loadAgencyLeads() {
    try {
        const res = await fetch(API + '/agency/leads', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (!res.ok) throw new Error('Failed');

        const data = await res.json();
        const leads = data.leads || data || [];

        if (leads.length === 0) {
            document.getElementById('agencyLeadsList').innerHTML = '';
            document.getElementById('agencyEmptyLeads').style.display = 'block';
        } else {
            document.getElementById('agencyEmptyLeads').style.display = 'none';
            renderLeadsList(leads, 'agencyLeadsList');
        }
    } catch {
        document.getElementById('agencyLeadsList').innerHTML = '';
        document.getElementById('agencyEmptyLeads').style.display = 'block';
    }
}

function renderLeadsList(leads, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = leads.map(l => {
        const statusClass = l.status === 'contacted' ? 'contacted' : l.status === 'closed' ? 'closed' : 'new';
        const statusText = l.status === 'contacted' ? 'Contatado' : l.status === 'closed' ? 'Fechado' : 'Novo';
        const date = l.createdAt ? new Date(l.createdAt).toLocaleDateString('pt-BR') : '';

        return `
        <div class="lead-item">
            <div class="lead-item-info">
                <h4>${escapeHtml(l.name || '')}</h4>
                <p>${escapeHtml(l.message || 'Sem mensagem')}</p>
                <div class="lead-meta">
                    <span>${escapeHtml(l.email || '')}</span>
                    <span>${escapeHtml(l.phone || '')}</span>
                    <span>${date}</span>
                </div>
            </div>
            <span class="lead-status ${statusClass}">${statusText}</span>
        </div>`;
    }).join('');
}

function switchAgencyTab(tab) {
    document.querySelectorAll('#page-agency .dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#page-agency .dash-tab-content').forEach(c => c.classList.remove('active'));

    const tabs = document.querySelectorAll('#page-agency .dash-tab');
    const tabMap = { properties: 0, add: 1, leads: 2, rewards: 3 };
    if (tabs[tabMap[tab]]) tabs[tabMap[tab]].classList.add('active');

    const content = document.getElementById('agTab-' + tab);
    if (content) content.classList.add('active');

    if (tab === 'rewards') loadAgentRewards();
}

// ===== AGENT REWARDS =====
async function loadAgentRewardsStat() {
    try {
        const res = await fetch(API + '/agent-rewards/dashboard', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (res.ok) {
            const data = await res.json();
            var el = document.getElementById('agStatCommission');
            if (el) el.textContent = 'R$ ' + (data.availableBalance || 0).toFixed(2).replace('.', ',');
        }
    } catch {}
}

async function loadAgentRewards() {
    try {
        const res = await fetch(API + '/agent-rewards/dashboard', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();

        // Tier badge
        const tierColors = {
            iniciante: '#94a3b8', corretor: '#6366f1', destaque: '#8b5cf6',
            premium: '#f59e0b', elite: '#10b981'
        };
        var badge = document.getElementById('rewardTierBadge');
        if (badge) {
            badge.style.background = 'linear-gradient(135deg,' + (tierColors[data.tier] || '#6366f1') + ',' + (tierColors[data.tier] || '#6366f1') + 'dd)';
            badge.textContent = (data.tierLabel || 'I')[0];
        }
        var tn = document.getElementById('rewardTierName');
        if (tn) tn.textContent = 'Tier: ' + (data.tierLabel || 'Iniciante');
        var tr = document.getElementById('rewardTierRate');
        if (tr) tr.textContent = 'Comissao: ' + Math.round((data.commissionRate || 0.10) * 100) + '% da taxa de 8%';

        // Progress
        if (data.nextTier) {
            var totalNeeded = (data.nextTier.listingsNeeded || 0) + (data.nextTier.rentalsNeeded || 0);
            var totalHas = (data.activeListings || 0) + (data.totalRentals || 0);
            var totalRequired = totalHas + totalNeeded;
            var pct = totalRequired > 0 ? Math.round((totalHas / totalRequired) * 100) : 0;
            var pl = document.getElementById('rewardProgressLabel');
            if (pl) pl.textContent = 'Proximo: ' + data.nextTier.name + ' (' + Math.round(data.nextTier.rate * 100) + '%)';
            var pp = document.getElementById('rewardProgressPct');
            if (pp) pp.textContent = pct + '%';
            var pb = document.getElementById('rewardProgressBar');
            if (pb) pb.style.width = pct + '%';
            var pd = document.getElementById('rewardProgressDetail');
            if (pd) pd.textContent = 'Faltam ' + data.nextTier.listingsNeeded + ' imoveis e ' + data.nextTier.rentalsNeeded + ' alugueis';
        } else {
            var pl = document.getElementById('rewardProgressLabel');
            if (pl) pl.textContent = 'Voce esta no nivel maximo!';
            var pp = document.getElementById('rewardProgressPct');
            if (pp) pp.textContent = '100%';
            var pb = document.getElementById('rewardProgressBar');
            if (pb) pb.style.width = '100%';
            var pd = document.getElementById('rewardProgressDetail');
            if (pd) pd.textContent = '';
        }

        // Balance
        var rb = document.getElementById('rewardBalance');
        if (rb) rb.textContent = 'R$ ' + (data.availableBalance || 0).toFixed(2).replace('.', ',');
        var rte = document.getElementById('rewardTotalEarned');
        if (rte) rte.textContent = 'R$ ' + (data.totalEarned || 0).toFixed(2).replace('.', ',');
        var rtp = document.getElementById('rewardTotalPaidOut');
        if (rtp) rtp.textContent = 'Sacado: R$ ' + (data.totalPaidOut || 0).toFixed(2).replace('.', ',');

        // Referral code
        var rc = document.getElementById('rewardReferralCode');
        if (rc) rc.value = data.referralCode || '...';
        if (!data.referralCode) {
            // Generate one
            try {
                const rcRes = await fetch(API + '/agent-rewards/referral-code', {
                    headers: { 'Authorization': 'Bearer ' + currentToken }
                });
                if (rcRes.ok) {
                    const rcData = await rcRes.json();
                    if (rc) rc.value = rcData.referralCode || '...';
                }
            } catch {}
        }

        // Recent commissions
        var cl = document.getElementById('rewardCommissionsList');
        if (cl) {
            var commissions = data.recentCommissions || [];
            if (commissions.length === 0) {
                cl.innerHTML = '<p style="color:var(--text-muted);text-align:center">Nenhuma comissao ainda. Cadastre imoveis e feche alugueis!</p>';
            } else {
                cl.innerHTML = commissions.map(function(c) {
                    var typeLabel = { rental_commission: 'Aluguel', bonus_first_listing: 'Bonus 1o imovel', bonus_fast_rental: 'Bonus rapido', bonus_referral: 'Indicacao', payout: 'Saque' };
                    var label = typeLabel[c.type] || c.type;
                    var color = c.amount >= 0 ? '#10b981' : '#ef4444';
                    var propName = c.property && c.property.title ? c.property.title : '';
                    var date = c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '';
                    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0;border-bottom:1px solid var(--border-color)">' +
                        '<div><strong style="font-size:0.85rem">' + escapeHtml(label) + '</strong>' +
                        (propName ? '<br><span style="font-size:0.8rem;color:var(--text-muted)">' + escapeHtml(propName) + '</span>' : '') +
                        '</div>' +
                        '<div style="text-align:right"><span style="color:' + color + ';font-weight:700">R$ ' + c.amount.toFixed(2).replace('.', ',') + '</span>' +
                        '<br><span style="font-size:0.75rem;color:var(--text-muted)">' + date + '</span></div></div>';
                }).join('');
            }
        }

        // Update stat card too
        var sc = document.getElementById('agStatCommission');
        if (sc) sc.textContent = 'R$ ' + (data.availableBalance || 0).toFixed(2).replace('.', ',');
    } catch {
        console.error('Failed to load agent rewards');
    }
}

async function requestPayout() {
    var pixKey = prompt('Digite sua chave PIX (CPF, email, telefone ou chave aleatoria):');
    if (!pixKey || !pixKey.trim()) return;

    try {
        const res = await fetch(API + '/agent-rewards/payout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + currentToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ pixKey: pixKey.trim() })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message || 'Saque solicitado!');
            loadAgentRewards();
        } else {
            alert(data.error || 'Erro ao solicitar saque');
        }
    } catch {
        alert('Erro de conexao');
    }
}

function copyReferralCode() {
    var input = document.getElementById('rewardReferralCode');
    if (input && input.value && input.value !== '...') {
        navigator.clipboard.writeText(input.value).then(function() {
            alert('Codigo copiado: ' + input.value);
        }).catch(function() {
            input.select();
            document.execCommand('copy');
            alert('Codigo copiado!');
        });
    }
}

// ===== PROPERTY REFERRALS (Indique um Imovel) =====
async function submitReferral(event) {
    event.preventDefault();
    clearFormFeedback('referralFeedback');

    if (!currentToken) {
        showFormFeedback('referralFeedback', 'Faca login para indicar um imovel', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('address', document.getElementById('refAddress').value.trim());
    formData.append('neighborhood', document.getElementById('refNeighborhood').value.trim());
    formData.append('ownerName', document.getElementById('refOwnerName').value.trim());
    formData.append('ownerPhone', document.getElementById('refOwnerPhone').value.trim());
    formData.append('ownerEmail', document.getElementById('refOwnerEmail').value.trim());
    formData.append('description', document.getElementById('refDescription').value.trim());

    var photoInput = document.getElementById('refPhotosInput');
    if (photoInput && photoInput.files) {
        for (var i = 0; i < Math.min(photoInput.files.length, 5); i++) {
            formData.append('photos', photoInput.files[i]);
        }
    }

    try {
        const res = await fetch(API + '/referrals', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + currentToken },
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            showFormFeedback('referralFeedback', data.message || 'Indicacao enviada!', 'success');
            document.getElementById('referralForm').reset();
            document.getElementById('refPhotoPreview').innerHTML = '';
            loadMyReferrals();
        } else {
            showFormFeedback('referralFeedback', data.error || 'Erro ao enviar', 'error');
        }
    } catch {
        showFormFeedback('referralFeedback', 'Erro de conexao', 'error');
    }
}

function previewRefPhotos(input) {
    var preview = document.getElementById('refPhotoPreview');
    preview.innerHTML = '';
    if (!input.files || input.files.length === 0) return;

    var files = Array.from(input.files).slice(0, 5);
    files.forEach(function(file, idx) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var div = document.createElement('div');
            div.className = 'ref-photo-thumb';
            div.innerHTML = '<img src="' + e.target.result + '" alt="Foto ' + (idx + 1) + '">' +
                '<button type="button" class="ref-photo-remove" onclick="removeRefPhoto(' + idx + ')">&times;</button>';
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removeRefPhoto(idx) {
    var input = document.getElementById('refPhotosInput');
    var dt = new DataTransfer();
    var files = Array.from(input.files);
    files.forEach(function(f, i) { if (i !== idx) dt.items.add(f); });
    input.files = dt.files;
    previewRefPhotos(input);
}

// ===== EXIT INTENT POPUP =====
function initExitIntentPopup() {
    // Desktop: mouse leaves viewport
    document.addEventListener('mouseout', function(e) {
        if (e.clientY < 5 && !sessionStorage.getItem('refPopupShown')) {
            showRefPopup();
        }
    });
    // Mobile: after 30 seconds
    setTimeout(function() {
        if (!sessionStorage.getItem('refPopupShown')) {
            showRefPopup();
        }
    }, 30000);
}

function showRefPopup() {
    var overlay = document.getElementById('refPopupOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        sessionStorage.setItem('refPopupShown', '1');
    }
}

function closeRefPopup() {
    var overlay = document.getElementById('refPopupOverlay');
    if (overlay) overlay.style.display = 'none';
}

// ===== ANIMATED REFERRAL COUNTER =====
function animateRefCounter() {
    var el = document.getElementById('refCounterNum');
    if (!el) return;
    var base = 28 + Math.floor(Math.random() * 15);
    el.textContent = base;
    setInterval(function() {
        if (Math.random() > 0.6) {
            base += 1;
            el.textContent = base;
        }
    }, 8000);
}

async function loadMyReferrals() {
    const container = document.getElementById('myReferralsList');
    if (!container) return;
    if (!currentToken) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center">Faca login para ver suas indicacoes</p>';
        return;
    }

    try {
        const res = await fetch(API + '/referrals/my', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const referrals = data.referrals || [];

        if (referrals.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center">Nenhuma indicacao ainda. Indique seu primeiro imovel!</p>';
            return;
        }

        const statusMap = {
            pending: { label: 'Pendente', color: '#f59e0b', bg: 'rgba(245,158,11,.1)' },
            validated: { label: 'Validada', color: '#6366f1', bg: 'rgba(99,102,241,.1)' },
            listed: { label: 'Anunciada', color: '#8b5cf6', bg: 'rgba(139,92,246,.1)' },
            rented: { label: 'Alugada', color: '#10b981', bg: 'rgba(16,185,129,.1)' },
            paid: { label: 'Paga!', color: '#059669', bg: 'rgba(5,150,105,.15)' },
            rejected: { label: 'Rejeitada', color: '#ef4444', bg: 'rgba(239,68,68,.1)' }
        };

        container.innerHTML = referrals.map(function(r) {
            var s = statusMap[r.status] || statusMap.pending;
            var date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : '';
            var reward = r.status === 'paid' && r.rewardAmount ? '<br><span style="color:#059669;font-weight:700">+ R$ ' + r.rewardAmount.toFixed(2).replace('.', ',') + '</span>' : '';
            var rejection = r.status === 'rejected' && r.rejectionReason ? '<br><span style="font-size:0.8rem;color:#ef4444">' + escapeHtml(r.rejectionReason) + '</span>' : '';
            return '<div style="padding:0.8rem 0;border-bottom:1px solid var(--border-color)">' +
                '<div style="display:flex;justify-content:space-between;align-items:start">' +
                '<div><strong style="font-size:0.9rem">' + escapeHtml(r.address) + '</strong>' +
                '<br><span style="font-size:0.8rem;color:var(--text-muted)">' + escapeHtml(r.neighborhood) + ' — ' + date + '</span>' +
                reward + rejection + '</div>' +
                '<span style="font-size:0.75rem;font-weight:600;padding:3px 10px;border-radius:20px;background:' + s.bg + ';color:' + s.color + '">' + s.label + '</span>' +
                '</div></div>';
        }).join('');
    } catch {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center">Erro ao carregar indicacoes</p>';
    }
}

function shareReferralWhatsApp() {
    var text = 'Conhece um imovel vazio em Ribeirao Preto? Indique pelo MoraJunto e ganhe ate R$150 quando for alugado! Acesse: ' + window.location.origin;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// ===== ADMIN REFERRALS =====
async function loadAdminReferrals(statusFilter) {
    var tbody = document.getElementById('adminReferralsTbody');
    if (!tbody) return;

    try {
        var url = API + '/referrals' + (statusFilter ? '?status=' + statusFilter : '');
        const res = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        var referrals = data.referrals || [];

        if (referrals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Nenhuma indicacao</td></tr>';
            return;
        }

        var statusLabels = { pending: 'Pendente', validated: 'Validada', listed: 'Anunciada', rented: 'Alugada', paid: 'Paga', rejected: 'Rejeitada' };
        var statusColors = { pending: '#f59e0b', validated: '#6366f1', listed: '#8b5cf6', rented: '#10b981', paid: '#059669', rejected: '#ef4444' };

        tbody.innerHTML = referrals.map(function(r) {
            var refName = r.referrer ? escapeHtml(r.referrer.name || r.referrer.email) : 'Desconhecido';
            var date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : '';
            var color = statusColors[r.status] || '#94a3b8';

            var actions = '';
            if (r.status === 'pending') {
                actions = '<button class="btn btn-sm btn-accent" onclick="updateReferralStatus(\'' + r._id + '\',\'validated\')">Validar</button> ' +
                    '<button class="btn btn-sm btn-outline" onclick="updateReferralStatus(\'' + r._id + '\',\'rejected\')">Rejeitar</button>';
            } else if (r.status === 'validated') {
                actions = '<button class="btn btn-sm btn-accent" onclick="updateReferralStatus(\'' + r._id + '\',\'listed\')">Vincular</button>';
            } else if (r.status === 'listed') {
                actions = '<button class="btn btn-sm btn-accent" onclick="updateReferralStatus(\'' + r._id + '\',\'rented\')">Alugado</button>';
            } else if (r.status === 'rented') {
                actions = '<button class="btn btn-sm" style="background:#059669;color:#fff" onclick="updateReferralStatus(\'' + r._id + '\',\'paid\')">Pagar</button>';
            } else if (r.status === 'paid') {
                actions = '<span style="color:#059669;font-weight:600">R$ ' + (r.rewardAmount || 0).toFixed(2).replace('.', ',') + '</span>';
            }

            return '<tr>' +
                '<td>' + refName + '</td>' +
                '<td>' + escapeHtml(r.address) + '</td>' +
                '<td>' + escapeHtml(r.neighborhood) + '</td>' +
                '<td>' + escapeHtml(r.ownerName) + '<br><span style="font-size:0.8rem;color:var(--text-muted)">' + escapeHtml(r.ownerPhone) + '</span></td>' +
                '<td><span style="color:' + color + ';font-weight:600">' + (statusLabels[r.status] || r.status) + '</span></td>' +
                '<td>' + date + '</td>' +
                '<td>' + actions + '</td></tr>';
        }).join('');
    } catch {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Erro ao carregar</td></tr>';
    }
}

async function updateReferralStatus(id, status) {
    var body = { status: status };

    if (status === 'rejected') {
        var reason = prompt('Motivo da rejeicao:');
        if (reason === null) return;
        body.rejectionReason = reason;
    }
    if (status === 'listed') {
        var propertyId = prompt('ID do imovel cadastrado (cole o _id do MongoDB):');
        if (!propertyId) return;
        body.propertyId = propertyId.trim();
    }
    if (status === 'paid') {
        var amount = prompt('Valor da recompensa (R$):', '100');
        if (!amount) return;
        body.rewardAmount = parseFloat(amount);
    }

    try {
        const res = await fetch(API + '/referrals/' + id + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message || 'Atualizado!');
            loadAdminReferrals('');
        } else {
            alert(data.error || 'Erro');
        }
    } catch {
        alert('Erro de conexao');
    }
}

// ===== ADD / EDIT PROPERTY =====
async function saveProperty(e) {
    e.preventDefault();
    clearFormFeedback('propertyFeedback');

    const editId = document.getElementById('editPropertyId').value;
    const imagesTextEl = document.getElementById('propImages');
    const imagesText = imagesTextEl ? imagesTextEl.value : '';
    const urlImages = imagesText.split('\n').map(s => s.trim()).filter(Boolean);
    const featuresText = document.getElementById('propFeatures').value;
    const features = featuresText.split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
        title: document.getElementById('propTitle').value,
        type: document.getElementById('propType').value,
        transaction: document.getElementById('propTransaction').value,
        price: parseFloat(document.getElementById('propPrice').value) || 0,
        condo: parseFloat(document.getElementById('propCondo').value) || 0,
        iptu: parseFloat(document.getElementById('propIptu').value) || 0,
        area: parseFloat(document.getElementById('propArea').value) || 0,
        bedrooms: parseInt(document.getElementById('propBedrooms').value) || 0,
        bathrooms: parseInt(document.getElementById('propBathrooms').value) || 0,
        parking: parseInt(document.getElementById('propParking').value) || 0,
        address: document.getElementById('propAddress').value,
        neighborhood: document.getElementById('propNeighborhood').value,
        zip: document.getElementById('propZip').value,
        description: document.getElementById('propDescription').value,
        features,
        images: urlImages
    };

    try {
        const url = editId ? API + '/properties/' + editId : API + '/properties';
        const method = editId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + currentToken
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const data = await res.json();
            showFormFeedback('propertyFeedback', data.message || 'Erro ao salvar', 'error');
            return;
        }

        const result = await res.json();
        const propertyId = editId || (result.property && (result.property._id || result.property.id));

        // Upload file images if selected
        const fileInput = document.getElementById('propImageFiles');
        if (fileInput && fileInput.files.length > 0 && propertyId) {
            var formData = new FormData();
            for (var i = 0; i < Math.min(fileInput.files.length, 10); i++) {
                formData.append('images', fileInput.files[i]);
            }
            try {
                var uploadRes = await fetch(API + '/owner/properties/' + propertyId + '/images', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + currentToken },
                    body: formData
                });
                if (!uploadRes.ok) {
                    var uploadData = await uploadRes.json();
                    showFormFeedback('propertyFeedback', 'Imóvel salvo, mas erro no upload: ' + (uploadData.error || 'Erro'), 'error');
                    return;
                }
            } catch (uploadErr) {
                showFormFeedback('propertyFeedback', 'Imóvel salvo, mas falha no upload de imagens.', 'error');
                return;
            }
        }

        showFormFeedback('propertyFeedback', editId ? 'Imóvel atualizado!' : 'Imóvel cadastrado com sucesso!', 'success');
        resetPropertyForm();
        loadAgencyProperties();
        switchAgencyTab('properties');
    } catch {
        showFormFeedback('propertyFeedback', 'Erro de conexão. Tente novamente.', 'error');
    }
}

async function editProperty(id) {
    try {
        const res = await fetch(API + '/properties/' + id, {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (!res.ok) throw new Error('Failed');

        const data = await res.json();
        const p = data.property || data;

        document.getElementById('editPropertyId').value = p._id || p.id || '';
        document.getElementById('propTitle').value = p.title || '';
        document.getElementById('propType').value = p.type || '';
        document.getElementById('propTransaction').value = p.transaction || 'aluguel';
        document.getElementById('propPrice').value = p.price || '';
        document.getElementById('propCondo').value = p.condominio || '';
        document.getElementById('propIptu').value = p.iptu || '';
        document.getElementById('propArea').value = p.area || '';
        document.getElementById('propBedrooms').value = p.bedrooms || '';
        document.getElementById('propBathrooms').value = p.bathrooms || '';
        document.getElementById('propParking').value = p.parking || '';
        document.getElementById('propAddress').value = p.address || '';
        document.getElementById('propNeighborhood').value = p.neighborhood || '';
        document.getElementById('propZip').value = p.zip || '';
        document.getElementById('propDescription').value = p.description || '';
        document.getElementById('propFeatures').value = (p.features || []).join(', ');
        document.getElementById('propImages').value = (p.images || []).join('\n');

        document.getElementById('addPropertyTitle').textContent = 'Editar imóvel';
        switchAgencyTab('add');
    } catch {
        showToast('Erro ao carregar dados do imóvel.', 'error');
    }
}

async function deleteProperty(id) {
    if (!confirm('Tem certeza que deseja excluir este imóvel?')) return;

    try {
        const res = await fetch(API + '/properties/' + id, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });

        if (res.ok) {
            loadAgencyProperties();
        } else {
            showToast('Erro ao excluir imóvel.', 'error');
        }
    } catch {
        showToast('Erro de conexão.', 'error');
    }
}

function resetPropertyForm() {
    document.getElementById('addPropertyForm').reset();
    document.getElementById('editPropertyId').value = '';
    document.getElementById('addPropertyTitle').textContent = 'Adicionar novo imóvel';
    clearFormFeedback('propertyFeedback');
    var preview = document.getElementById('propImagePreview');
    if (preview) preview.innerHTML = '';
}

// Image file preview for property form
(function() {
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'propImageFiles') {
            var preview = document.getElementById('propImagePreview');
            if (!preview) return;
            preview.innerHTML = '';
            var files = e.target.files;
            for (var i = 0; i < Math.min(files.length, 10); i++) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    var img = document.createElement('img');
                    img.src = ev.target.result;
                    img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border)';
                    preview.appendChild(img);
                };
                reader.readAsDataURL(files[i]);
            }
        }
    });
})();

// ===== ADMIN =====
async function loadAdminPanel() {
    if (!currentToken || !currentUser || currentUser.role !== 'admin') {
        showPage('home');
        return;
    }

    try {
        const res = await fetch(API + '/admin/stats', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (res.ok) {
            const stats = await res.json();
            document.getElementById('adminStatProperties').textContent = stats.properties || 0;
            document.getElementById('adminStatAgencies').textContent = stats.agencies || 0;
            document.getElementById('adminStatLeads').textContent = stats.leads || 0;
            document.getElementById('adminStatUsers').textContent = stats.users || 0;
        }
    } catch {
        console.error('Failed to load admin stats');
    }

    loadAdminProperties();
    loadAdminAgencies();
    loadAdminLeads();
}

async function loadAdminProperties() {
    try {
        const res = await fetch(API + '/admin/properties', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const properties = data.properties || data || [];

        const tbody = document.getElementById('adminPropertiesTbody');
        tbody.innerHTML = properties.map(p => {
            const id = p._id || p.id || '';
            const agencyName = p.agency ? (p.agency.name || '-') : '-';
            return `
            <tr>
                <td><strong>${escapeHtml(p.title || '')}</strong><br><small>${escapeHtml(p.neighborhood || '')}</small></td>
                <td>${escapeHtml(p.type || '')}</td>
                <td>${formatPrice(p.price)}</td>
                <td>${escapeHtml(agencyName)}</td>
                <td><span class="status-badge status-active">Ativo</span></td>
                <td><button class="btn btn-outline btn-sm" style="color:var(--coral);border-color:var(--coral)" onclick="adminDeleteProperty('${id}')">Excluir</button></td>
            </tr>`;
        }).join('');
    } catch {
        document.getElementById('adminPropertiesTbody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--dim)">Nenhum imóvel encontrado</td></tr>';
    }
}

async function loadAdminAgencies() {
    try {
        const res = await fetch(API + '/admin/agencies', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const agencies = data.agencies || data || [];

        const tbody = document.getElementById('adminAgenciesTbody');
        tbody.innerHTML = agencies.map(a => `
            <tr>
                <td><strong>${escapeHtml(a.name || '')}</strong></td>
                <td>${escapeHtml(a.email || '')}</td>
                <td>${escapeHtml(a.phone || '-')}</td>
                <td>${a.propertyCount || 0}</td>
                <td><span class="status-badge status-active">Ativo</span></td>
                <td><button class="btn btn-outline btn-sm" onclick="toggleAgencyStatus('${a._id || a.id}')">Alternar</button></td>
            </tr>`
        ).join('');
    } catch {
        document.getElementById('adminAgenciesTbody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--dim)">Nenhuma imobiliária encontrada</td></tr>';
    }
}

async function loadAdminLeads() {
    try {
        const res = await fetch(API + '/admin/leads', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const leads = data.leads || data || [];

        const tbody = document.getElementById('adminLeadsTbody');
        tbody.innerHTML = leads.map(l => {
            const date = l.createdAt ? new Date(l.createdAt).toLocaleDateString('pt-BR') : '-';
            const propertyTitle = l.property ? (l.property.title || '-') : '-';
            const statusClass = l.status === 'contacted' ? 'status-active' : l.status === 'closed' ? 'status-inactive' : 'status-pending';
            const statusText = l.status === 'contacted' ? 'Contatado' : l.status === 'closed' ? 'Fechado' : 'Novo';

            return `
            <tr>
                <td>${escapeHtml(l.name || '')}</td>
                <td>${escapeHtml(l.email || '')}</td>
                <td>${escapeHtml(l.phone || '')}</td>
                <td>${escapeHtml(propertyTitle)}</td>
                <td>${date}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            </tr>`;
        }).join('');
    } catch {
        document.getElementById('adminLeadsTbody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--dim)">Nenhum lead encontrado</td></tr>';
    }
}

async function adminDeleteProperty(id) {
    if (!confirm('Excluir este imóvel permanentemente?')) return;
    try {
        await fetch(API + '/properties/' + id, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        loadAdminProperties();
        loadAdminPanel();
    } catch {
        showToast('Erro ao excluir.', 'error');
    }
}

async function toggleAgencyStatus(id) {
    // Placeholder for toggling agency active/inactive
    showToast('Funcionalidade em desenvolvimento.', 'info');
}

function switchAdminTab(tab) {
    document.querySelectorAll('#page-admin .dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#page-admin .dash-tab-content').forEach(c => c.classList.remove('active'));

    const tabs = document.querySelectorAll('#page-admin .dash-tab');
    const tabMap = { properties: 0, agencies: 1, leads: 2, referrals: 3 };
    if (tabs[tabMap[tab]]) tabs[tabMap[tab]].classList.add('active');

    const content = document.getElementById('adminTab-' + tab);
    if (content) content.classList.add('active');

    if (tab === 'referrals') loadAdminReferrals('');
}

// ===== FORMAT HELPERS =====
function formatPrice(num) {
    if (!num && num !== 0) return 'R$ 0';
    return 'R$ ' + Number(num).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatArea(num) {
    if (!num) return '0m²';
    return num + 'm²';
}

function validateCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    var sum = 0;
    for (var i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    var d1 = 11 - (sum % 11);
    if (d1 >= 10) d1 = 0;
    if (parseInt(cpf.charAt(9)) !== d1) return false;
    sum = 0;
    for (var i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    var d2 = 11 - (sum % 11);
    if (d2 >= 10) d2 = 0;
    if (parseInt(cpf.charAt(10)) !== d2) return false;
    return true;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function safeImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
        var parsed = new URL(url, window.location.origin);
        if (['http:', 'https:', 'data:'].includes(parsed.protocol)) return url;
    } catch(e) {}
    return '';
}

// ===== FORM FEEDBACK HELPERS =====
function showFormFeedback(id, message, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.className = 'form-feedback ' + type;
}

function clearFormFeedback(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '';
    el.className = 'form-feedback';
}

// ===== DEMO DATA =====
function getDemoProperties() {
    return [
        {
            id: 'demo1',
            title: 'Apartamento 2 quartos com piscina',
            type: 'apartamento',
            transaction: 'aluguel',
            price: 1800,
            condo: 350,
            iptu: 120,
            area: 72,
            bedrooms: 2,
            bathrooms: 1,
            parking: 1,
            address: 'Rua Américo Brasiliense, 1200',
            neighborhood: 'Centro',
            description: 'Apartamento amplo e bem iluminado no coração de Ribeirão Preto. Condomínio com piscina, churrasqueira e salão de festas. Próximo ao Ribeirão Shopping e fácil acesso às principais vias da cidade.',
            features: ['Piscina', 'Churrasqueira', 'Portaria 24h', 'Salão de festas', 'Ar condicionado', 'Armários embutidos'],
            images: [
                'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&h=600&fit=crop'
            ],
            agencyName: 'Imobiliária Central RP',
            agency: { name: 'Imobiliária Central RP', creci: 'CRECI-SP 12345' },
            neighborhoodScore: { security: 75, transport: 90, commerce: 95, leisure: 70, quiet: 55 }
        },
        {
            id: 'demo2',
            title: 'Casa 3 quartos com suíte',
            type: 'casa',
            transaction: 'aluguel',
            price: 2500,
            condo: 0,
            iptu: 200,
            area: 120,
            bedrooms: 3,
            bathrooms: 2,
            parking: 2,
            address: 'Rua Garibaldi, 580',
            neighborhood: 'Jd. Sumaré',
            description: 'Casa espaçosa com 3 quartos sendo 1 suíte, garagem para 2 carros, quintal amplo com churrasqueira. Bairro tranquilo e residencial.',
            features: ['Suíte', 'Churrasqueira', 'Quintal', 'Garagem 2 carros', 'Lavanderia'],
            images: [
                'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop'
            ],
            agencyName: 'Sumaré Imóveis',
            agency: { name: 'Sumaré Imóveis', creci: 'CRECI-SP 67890' },
            neighborhoodScore: { security: 85, transport: 65, commerce: 70, leisure: 75, quiet: 90 }
        },
        {
            id: 'demo3',
            title: 'Kitnet mobiliada próx. USP',
            type: 'kitnet',
            transaction: 'aluguel',
            price: 950,
            condo: 100,
            iptu: 50,
            area: 28,
            bedrooms: 1,
            bathrooms: 1,
            parking: 0,
            address: 'Rua Pedreira de Freitas, 245',
            neighborhood: 'Vila Tibério',
            description: 'Kitnet totalmente mobiliada, ideal para estudantes. Próxima à USP e comércio local. Condomínio com lavanderia compartilhada.',
            features: ['Mobiliada', 'Wi-Fi incluso', 'Lavanderia', 'Próx. USP'],
            images: [
                'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop'
            ],
            agencyName: 'RP Imóveis',
            agency: { name: 'RP Imóveis', creci: 'CRECI-SP 11111' },
            neighborhoodScore: { security: 60, transport: 85, commerce: 80, leisure: 50, quiet: 45 }
        },
        {
            id: 'demo4',
            title: 'Cobertura duplex 4 quartos',
            type: 'apartamento',
            transaction: 'venda',
            price: 850000,
            condo: 800,
            iptu: 450,
            area: 210,
            bedrooms: 4,
            bathrooms: 3,
            parking: 3,
            address: 'Av. Presidente Vargas, 2500',
            neighborhood: 'Ribeirânia',
            description: 'Cobertura duplex de alto padrão com vista panorâmica. 4 suítes, varanda gourmet, piscina privativa e 3 vagas de garagem.',
            features: ['Piscina privativa', 'Varanda gourmet', '4 suítes', 'Vista panorâmica', 'Elevador privativo', 'Ar condicionado central'],
            images: [
                'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop'
            ],
            agencyName: 'Premium Imobiliária',
            agency: { name: 'Premium Imobiliária', creci: 'CRECI-SP 22222' },
            neighborhoodScore: { security: 90, transport: 75, commerce: 85, leisure: 80, quiet: 70 }
        },
        {
            id: 'demo5',
            title: 'Sala comercial 45m² - Centro',
            type: 'comercial',
            transaction: 'aluguel',
            price: 1200,
            condo: 250,
            iptu: 100,
            area: 45,
            bedrooms: 0,
            bathrooms: 1,
            parking: 1,
            address: 'Rua Barão do Amazonas, 300',
            neighborhood: 'Centro',
            description: 'Sala comercial em prédio corporativo no centro. Recepção, ar condicionado, 1 vaga de garagem. Ideal para escritórios e consultórios.',
            features: ['Ar condicionado', 'Recepção', 'Elevador', 'Segurança', 'Estacionamento'],
            images: [
                'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop'
            ],
            agencyName: 'Imobiliária Central RP',
            agency: { name: 'Imobiliária Central RP', creci: 'CRECI-SP 12345' },
            neighborhoodScore: { security: 70, transport: 95, commerce: 95, leisure: 50, quiet: 30 }
        },
        {
            id: 'demo6',
            title: 'Apartamento 3 quartos - Lagoinha',
            type: 'apartamento',
            transaction: 'aluguel',
            price: 2200,
            condo: 400,
            iptu: 180,
            area: 95,
            bedrooms: 3,
            bathrooms: 2,
            parking: 2,
            address: 'Rua João Penteado, 890',
            neighborhood: 'Lagoinha',
            description: 'Apartamento espaçoso no bairro Lagoinha. 3 quartos sendo 1 suíte, sacada com churrasqueira, 2 vagas cobertas. Condomínio completo.',
            features: ['Suíte', 'Sacada', 'Churrasqueira', 'Academia', 'Playground', 'Pet friendly'],
            images: [
                'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop'
            ],
            agencyName: 'Lagoinha Imóveis',
            agency: { name: 'Lagoinha Imóveis', creci: 'CRECI-SP 33333' },
            neighborhoodScore: { security: 80, transport: 70, commerce: 75, leisure: 85, quiet: 65 }
        }
    ];
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.id === 'loginModal') {
        hideLoginModal();
    }
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hideLoginModal();
        closeMobileMenu();
        closeReportModal();
    }
});

// ===== CUSTOM SELECT COMPONENT =====
var _csInstances = [];

function initCustomSelect(selectEl, opts) {
    if (!selectEl) return;
    opts = opts || {};

    // Build dropdown DOM
    var dd = document.createElement('div');
    dd.className = 'cs-dropdown';
    dd.setAttribute('role', 'combobox');
    dd.setAttribute('aria-expanded', 'false');
    dd.setAttribute('aria-haspopup', 'listbox');
    dd.tabIndex = 0;

    var trigger = document.createElement('div');
    trigger.className = 'cs-trigger';
    var valueSpan = document.createElement('span');
    valueSpan.className = 'cs-value';
    trigger.appendChild(valueSpan);
    trigger.insertAdjacentHTML('beforeend', '<svg class="cs-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>');
    dd.appendChild(trigger);

    var panel = document.createElement('div');
    panel.className = 'cs-panel';
    panel.setAttribute('role', 'listbox');

    // Search (for searchable selects)
    var searchInput = null;
    if (opts.searchable) {
        var sw = document.createElement('div');
        sw.className = 'cs-search-wrap';
        sw.style.position = 'relative';
        sw.innerHTML = '<svg class="cs-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';
        searchInput = document.createElement('input');
        searchInput.className = 'cs-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Buscar bairro...';
        searchInput.setAttribute('aria-label', 'Filtrar opções');
        sw.appendChild(searchInput);
        panel.appendChild(sw);
    }

    var optionsContainer = document.createElement('div');
    optionsContainer.className = 'cs-options';

    // Parse native select
    var allOptionEls = [];
    Array.from(selectEl.children).forEach(function(child) {
        if (child.tagName === 'OPTGROUP') {
            var group = document.createElement('div');
            group.className = 'cs-group';
            group.setAttribute('role', 'group');
            var label = document.createElement('div');
            label.className = 'cs-group-label';
            label.textContent = child.label;
            group.appendChild(label);
            Array.from(child.children).forEach(function(opt) {
                var el = buildOption(opt);
                group.appendChild(el);
                allOptionEls.push(el);
            });
            optionsContainer.appendChild(group);
        } else if (child.tagName === 'OPTION') {
            var el = buildOption(child);
            optionsContainer.appendChild(el);
            allOptionEls.push(el);
        }
    });

    function buildOption(opt) {
        var div = document.createElement('div');
        div.className = 'cs-option';
        div.setAttribute('role', 'option');
        div.dataset.value = opt.value;
        // Icon
        if (opts.icons && opts.icons[opt.value]) {
            var iconWrap = document.createElement('span');
            iconWrap.className = 'cs-option-icon';
            iconWrap.innerHTML = opts.icons[opt.value];
            div.appendChild(iconWrap);
        }
        // Tier dot
        if (opts.tierColors && opts.tierColors[opt.value]) {
            var dot = document.createElement('span');
            dot.className = 'cs-tier-dot cs-tier-' + opts.tierColors[opt.value].tier;
            div.appendChild(dot);
        }
        var text = document.createElement('span');
        text.textContent = opt.textContent;
        div.appendChild(text);
        if (opt.selected) div.classList.add('cs-selected');
        return div;
    }

    panel.appendChild(optionsContainer);
    dd.appendChild(panel);

    // Insert into DOM
    var wrap = selectEl.closest('.budget-select-wrap');
    // Hide original select icon
    var oldIcon = wrap.querySelector('.budget-select-icon');
    if (oldIcon) oldIcon.style.display = 'none';
    selectEl.classList.add('cs-sr-only', 'cs-has-custom');
    selectEl.tabIndex = -1;
    wrap.appendChild(dd);

    // Set initial value display
    function updateDisplay() {
        var sel = selectEl.options[selectEl.selectedIndex];
        valueSpan.textContent = sel ? sel.textContent : '';
        allOptionEls.forEach(function(el) {
            el.classList.toggle('cs-selected', el.dataset.value === selectEl.value);
        });
    }
    updateDisplay();

    // Toggle open/close
    var focusedIdx = -1;
    function open() {
        dd.setAttribute('aria-expanded', 'true');
        // Set focused to current selected
        focusedIdx = allOptionEls.findIndex(function(el) { return el.classList.contains('cs-selected'); });
        updateFocus();
        if (searchInput) { searchInput.value = ''; filterOptions(''); setTimeout(function() { searchInput.focus(); }, 50); }
    }
    function close() {
        dd.setAttribute('aria-expanded', 'false');
        focusedIdx = -1;
        allOptionEls.forEach(function(el) { el.classList.remove('cs-focused'); });
    }
    function isOpen() { return dd.getAttribute('aria-expanded') === 'true'; }

    function selectOption(optEl) {
        selectEl.value = optEl.dataset.value;
        selectEl.dispatchEvent(new Event('change'));
        updateDisplay();
        close();
        dd.focus();
    }

    function updateFocus() {
        allOptionEls.forEach(function(el, i) {
            el.classList.toggle('cs-focused', i === focusedIdx);
        });
        if (focusedIdx >= 0 && allOptionEls[focusedIdx]) {
            allOptionEls[focusedIdx].scrollIntoView({ block: 'nearest' });
        }
    }

    function getVisibleOptions() {
        return allOptionEls.filter(function(el) { return el.style.display !== 'none'; });
    }

    // Events
    trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        isOpen() ? close() : open();
    });

    allOptionEls.forEach(function(el) {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            selectOption(el);
        });
    });

    dd.addEventListener('keydown', function(e) {
        var visible = getVisibleOptions();
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isOpen()) { open(); }
            else if (focusedIdx >= 0 && allOptionEls[focusedIdx]) { selectOption(allOptionEls[focusedIdx]); }
        } else if (e.key === 'Escape') {
            close(); dd.focus();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen()) { open(); return; }
            var nextIdx = focusedIdx + 1;
            while (nextIdx < allOptionEls.length && allOptionEls[nextIdx].style.display === 'none') nextIdx++;
            if (nextIdx < allOptionEls.length) { focusedIdx = nextIdx; updateFocus(); }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            var prevIdx = focusedIdx - 1;
            while (prevIdx >= 0 && allOptionEls[prevIdx].style.display === 'none') prevIdx--;
            if (prevIdx >= 0) { focusedIdx = prevIdx; updateFocus(); }
        }
    });

    // Search filter
    if (searchInput) {
        searchInput.addEventListener('input', function() { filterOptions(this.value); });
        searchInput.addEventListener('keydown', function(e) { e.stopPropagation(); dd.dispatchEvent(new KeyboardEvent('keydown', { key: e.key })); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault(); });
    }

    function filterOptions(q) {
        var query = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        var anyVisible = false;
        allOptionEls.forEach(function(el) {
            var text = el.textContent.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            var show = !query || text.indexOf(query) !== -1;
            el.style.display = show ? '' : 'none';
            if (show) anyVisible = true;
        });
        // Hide empty groups
        optionsContainer.querySelectorAll('.cs-group').forEach(function(g) {
            var hasVisible = g.querySelector('.cs-option:not([style*="display: none"])');
            g.style.display = hasVisible ? '' : 'none';
        });
        // No results message
        var existing = optionsContainer.querySelector('.cs-no-results');
        if (!anyVisible && !existing) {
            optionsContainer.insertAdjacentHTML('beforeend', '<div class="cs-no-results">Nenhum bairro encontrado</div>');
        } else if (anyVisible && existing) {
            existing.remove();
        }
        focusedIdx = -1;
    }

    // Close on outside click
    _csInstances.push({ dd: dd, close: close, updateDisplay: updateDisplay });
}

// Global click-outside handler
document.addEventListener('click', function() {
    _csInstances.forEach(function(inst) { inst.close(); });
});

function syncCustomSelects() {
    _csInstances.forEach(function(inst) { inst.updateDisplay(); });
}

// Initialize custom selects on load
function _initAllCustomSelects() {
    if (window._csInitDone || window.matchMedia('(pointer: coarse)').matches) return;
    window._csInitDone = true;

    var personIcons = {
        '1': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        '2': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-3-3.87M9 21v-2a4 4 0 00-4-4H5"/><circle cx="9" cy="7" r="4"/><circle cx="17" cy="7" r="3"/></svg>',
        '3': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><circle cx="19" cy="7" r="3"/></svg>',
        '4': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><circle cx="20" cy="7" r="3"/></svg>'
    };

    var bedroomIcons = {
        '1': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v11m0-4h18m0-7v11M7 11V7h4v4m2 0V7h4v4"/></svg>',
        '2': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v11m0-4h18m0-7v11M7 11V7h4v4m2 0V7h4v4"/></svg>',
        '3': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v11m0-4h18m0-7v11M7 11V7h4v4m2 0V7h4v4"/></svg>',
        '4': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v11m0-4h18m0-7v11M7 11V7h4v4m2 0V7h4v4"/></svg>'
    };

    initCustomSelect(document.getElementById('budgetGroupSize'), { icons: personIcons });
    initCustomSelect(document.getElementById('budgetBedrooms'), { icons: bedroomIcons });

    // Wait for RP_RENTAL_DATA to be available (defined below)
    setTimeout(function() {
        var tierColors = {};
        if (typeof RP_RENTAL_DATA !== 'undefined') {
            Object.keys(RP_RENTAL_DATA.neighborhoods).forEach(function(key) {
                tierColors[key] = RP_RENTAL_DATA.neighborhoods[key];
            });
        }
        initCustomSelect(document.getElementById('budgetNeighborhood'), { searchable: true, tierColors: tierColors });
    }, 0);
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initAllCustomSelects);
} else {
    _initAllCustomSelects();
}

// ===== BUDGET CALCULATOR =====
// ===== DADOS REAIS DE RIBEIRÃO PRETO (2025/2026) =====
// Fontes: QuintoAndar, ZAP, MySide, CRECISP, Numbeo, CPFL, DAERP
var RP_RENTAL_DATA = {
    // Aluguel médio por bairro (apartamento 2 quartos)
    neighborhoods: {
        vila_tiberio:         { name: 'Vila Tibério',         avg2q: 1300, min: 700,  max: 2800, tier: 'popular', unis: ['USP-RP','Barão de Mauá','Moura Lacerda'] },
        campos_eliseos:       { name: 'Campos Elíseos',       avg2q: 1400, min: 700,  max: 3200, tier: 'popular', unis: ['Barão de Mauá','Moura Lacerda','USP-RP'] },
        lagoinha:             { name: 'Lagoinha',             avg2q: 1400, min: 700,  max: 3000, tier: 'popular', unis: ['UNIP'] },
        centro:               { name: 'Centro',               avg2q: 1500, min: 800,  max: 3500, tier: 'medio',   unis: ['Barão de Mauá','Moura Lacerda'] },
        ribeirania:           { name: 'Ribeirânia',           avg2q: 1800, min: 900,  max: 4500, tier: 'medio',   unis: ['UNAERP','Estácio'] },
        jd_nova_alianca_sul:  { name: 'Jd Nova Aliança Sul',  avg2q: 1800, min: 900,  max: 4500, tier: 'medio',   unis: ['UNIP'] },
        jd_iraja:             { name: 'Jardim Irajá',         avg2q: 1900, min: 900,  max: 4500, tier: 'medio',   unis: ['Estácio','UNAERP'] },
        vila_seixas:          { name: 'Vila Seixas',          avg2q: 2000, min: 1000, max: 4500, tier: 'medio',   unis: ['UNAERP'] },
        jd_california:        { name: 'Jardim Califórnia',    avg2q: 2100, min: 1000, max: 5000, tier: 'nobre',   unis: ['UNAERP','Estácio'] },
        jd_sumare:            { name: 'Jardim Sumaré',        avg2q: 2200, min: 1000, max: 5200, tier: 'nobre',   unis: ['USP-RP'] },
        nova_alianca:         { name: 'Nova Aliança',         avg2q: 2300, min: 1060, max: 5500, tier: 'nobre',   unis: ['UNIP'] },
        alto_boa_vista:       { name: 'Alto da Boa Vista',    avg2q: 2400, min: 1100, max: 5800, tier: 'nobre',   unis: [] },
        jd_botanico:          { name: 'Jardim Botânico',      avg2q: 2500, min: 1200, max: 6000, tier: 'nobre',   unis: [] },
        // Populares
        parque_industrial:    { name: 'Parque Industrial',    avg2q: 1200, min: 600,  max: 2500, tier: 'popular', unis: [] },
        ipiranga:             { name: 'Ipiranga',             avg2q: 1250, min: 650,  max: 2600, tier: 'popular', unis: [] },
        simioni:              { name: 'Simioni',              avg2q: 1100, min: 550,  max: 2200, tier: 'popular', unis: [] },
        quintino_facci:       { name: 'Quintino Facci II',    avg2q: 1100, min: 550,  max: 2200, tier: 'popular', unis: [] },
        adelino_simioni:      { name: 'Adelino Simioni',      avg2q: 1050, min: 500,  max: 2100, tier: 'popular', unis: [] },
        avelino_palma:        { name: 'Avelino Alves Palma',  avg2q: 1050, min: 500,  max: 2100, tier: 'popular', unis: [] },
        // Intermediarios
        jd_paulista:          { name: 'Jardim Paulista',      avg2q: 1700, min: 850,  max: 4000, tier: 'medio',   unis: ['USP-RP','Barao de Maua'] },
        jd_macedo:            { name: 'Jardim Macedo',        avg2q: 1600, min: 800,  max: 3800, tier: 'medio',   unis: [] },
        jd_america:           { name: 'Jardim America',       avg2q: 1600, min: 800,  max: 3800, tier: 'medio',   unis: [] },
        jd_independencia:     { name: 'Jardim Independencia', avg2q: 1700, min: 850,  max: 4000, tier: 'medio',   unis: [] },
        higienopolis:         { name: 'Higienopolis',         avg2q: 1800, min: 900,  max: 4200, tier: 'medio',   unis: [] },
        republica:            { name: 'Republica',            avg2q: 1500, min: 750,  max: 3500, tier: 'medio',   unis: [] },
        vila_virginia:        { name: 'Vila Virginia',        avg2q: 1500, min: 750,  max: 3500, tier: 'medio',   unis: [] },
        guapore:              { name: 'Guapore',              avg2q: 1400, min: 700,  max: 3200, tier: 'medio',   unis: [] },
        jd_antartica:         { name: 'Jardim Antartica',     avg2q: 1400, min: 700,  max: 3200, tier: 'medio',   unis: [] },
        jd_paiva:             { name: 'Jardim Paiva',         avg2q: 1350, min: 680,  max: 3000, tier: 'medio',   unis: [] },
        vila_abranches:       { name: 'Vila Abranches',       avg2q: 1350, min: 680,  max: 3000, tier: 'medio',   unis: [] },
        jd_piratininga:       { name: 'Jardim Piratininga',   avg2q: 1300, min: 650,  max: 2800, tier: 'medio',   unis: [] },
        castelo_branco:       { name: 'Castelo Branco',       avg2q: 1500, min: 750,  max: 3500, tier: 'medio',   unis: [] },
        sumarezinho:          { name: 'Sumarezinho',          avg2q: 1600, min: 800,  max: 3800, tier: 'medio',   unis: ['USP-RP'] },
        monte_alegre:         { name: 'Monte Alegre',         avg2q: 1700, min: 850,  max: 4000, tier: 'medio',   unis: ['USP-RP'] },
        jd_luiza:             { name: 'Jardim Luiza',         avg2q: 1500, min: 750,  max: 3500, tier: 'medio',   unis: [] },
        jd_recreio:           { name: 'Jardim Recreio',       avg2q: 1500, min: 750,  max: 3500, tier: 'medio',   unis: [] },
        // Nobres extras
        jd_canada:            { name: 'Jardim Canada',        avg2q: 2200, min: 1000, max: 5200, tier: 'nobre',   unis: ['UNIP'] },
        jd_santa_angela:      { name: 'Jardim Santa Angela',  avg2q: 2100, min: 1000, max: 5000, tier: 'nobre',   unis: [] },
        city_ribeirao:        { name: 'City Ribeirao',        avg2q: 2300, min: 1060, max: 5500, tier: 'nobre',   unis: [] },
        bonfim_paulista:      { name: 'Bonfim Paulista',      avg2q: 2500, min: 1200, max: 6000, tier: 'nobre',   unis: [] }
    },
    // Multiplicador por quartos (baseado na média da cidade)
    bedroomMultiplier: { 1: 0.72, 2: 1.0, 3: 1.52, 4: 2.1 },
    // Média geral da cidade (2 quartos)
    cityAvg2q: 1800,
    // Contas por número de pessoas (valores reais RP)
    utilities: {
        1: { agua: 45,  luz: 120, internet: 90, gas: 30 },  // total: 285
        2: { agua: 70,  luz: 180, internet: 90, gas: 40 },  // total: 380
        3: { agua: 90,  luz: 230, internet: 90, gas: 50 },  // total: 460
        4: { agua: 110, luz: 280, internet: 90, gas: 60 }   // total: 540
    }
};

function calculateBudget() {
    var salary = parseInt(document.getElementById('budgetSalary').value) || 0;
    var groupSize = parseInt(document.getElementById('budgetGroupSize').value) || 2;
    var bedrooms = parseInt(document.getElementById('budgetBedrooms').value) || 2;
    var neighborhoodKey = document.getElementById('budgetNeighborhood').value;
    if (salary <= 0) { showToast('Digite sua renda mensal', 'warning'); return; }

    // Pegar aluguel médio real do bairro ou da cidade
    var avgRent;
    var neighborhoodName;
    if (neighborhoodKey && RP_RENTAL_DATA.neighborhoods[neighborhoodKey]) {
        var hood = RP_RENTAL_DATA.neighborhoods[neighborhoodKey];
        avgRent = hood.avg2q;
        neighborhoodName = hood.name;
    } else {
        avgRent = RP_RENTAL_DATA.cityAvg2q;
        neighborhoodName = 'Ribeirão Preto (média)';
    }

    // Ajustar pelo número de quartos escolhido
    var bedroomMult = RP_RENTAL_DATA.bedroomMultiplier[bedrooms] || 1;
    var estimatedRent = Math.round(avgRent * bedroomMult);

    var rentPerPerson = Math.round(estimatedRent / groupSize);

    // Contas reais baseadas no número de pessoas
    var utils = RP_RENTAL_DATA.utilities[groupSize] || RP_RENTAL_DATA.utilities[2];
    var waterPP = Math.round(utils.agua / groupSize);
    var electricityPP = Math.round(utils.luz / groupSize);
    var internetPP = Math.round(utils.internet / groupSize);
    var gasPP = Math.round(utils.gas / groupSize);
    var totalPP = rentPerPerson + waterPP + electricityPP + internetPP + gasPP;

    // Compatibilidade com renda (regra dos 30%)
    var maxRecommended = Math.round(salary * 0.3);
    var compatEl = document.getElementById('budgetCompatibility');
    if (totalPP <= maxRecommended) {
        compatEl.className = 'budget-compatibility budget-compat-ok';
        compatEl.innerHTML = 'Cabe no seu bolso! Você gasta ' + Math.round((totalPP/salary)*100) + '% da renda';
    } else if (totalPP <= salary * 0.4) {
        compatEl.className = 'budget-compatibility budget-compat-tight';
        compatEl.innerHTML = 'Apertado — ' + Math.round((totalPP/salary)*100) + '% da renda (recomendado: até 30%)';
    } else {
        compatEl.className = 'budget-compatibility budget-compat-over';
        compatEl.innerHTML = 'Acima do ideal — ' + Math.round((totalPP/salary)*100) + '% da renda. Considere mais pessoas ou bairro mais acessível';
    }

    // Atualizar UI
    document.getElementById('budgetMaxRent').textContent = 'R$ ' + estimatedRent.toLocaleString('pt-BR');
    document.getElementById('budgetPerPerson').textContent = 'R$ ' + rentPerPerson.toLocaleString('pt-BR') + ' por pessoa (' + bedrooms + ' quartos em ' + neighborhoodName + ')';
    document.getElementById('billRent').textContent = 'R$ ' + rentPerPerson.toLocaleString('pt-BR');
    document.getElementById('billWater').textContent = 'R$ ' + waterPP;
    document.getElementById('billElectricity').textContent = 'R$ ' + electricityPP;
    document.getElementById('billInternet').textContent = 'R$ ' + internetPP;
    document.getElementById('billGas').textContent = 'R$ ' + gasPP;
    document.getElementById('billTotal').textContent = 'R$ ' + totalPP.toLocaleString('pt-BR');
    document.getElementById('budgetResults').style.display = 'block';

    // Mostrar bairros que cabem no orçamento
    var hoodHtml = '<h4>Bairros que cabem no seu bolso (por pessoa)</h4><div class="budget-hood-list">';
    var hoods = RP_RENTAL_DATA.neighborhoods;
    var found = 0;
    Object.keys(hoods).forEach(function(key) {
        var h = hoods[key];
        var hRent = Math.round(h.avg2q * bedroomMult);
        var hPP = Math.round(hRent / groupSize) + waterPP + electricityPP + internetPP + gasPP;
        if (hPP <= maxRecommended) {
            hoodHtml += '<div class="budget-hood-tag" onclick="document.getElementById(\'budgetNeighborhood\').value=\'' + key + '\';calculateBudget()">' +
                escapeHtml(h.name) + ' <span class="hood-price">R$ ' + hPP.toLocaleString('pt-BR') + '</span></div>';
            found++;
        }
    });
    if (!found) {
        hoodHtml += '<span style="color:var(--text-secondary);font-size:.85rem">Nenhum bairro cabe nos 30%. Tente aumentar o grupo.</span>';
    }
    hoodHtml += '</div>';
    document.getElementById('budgetNeighborhoods').innerHTML = hoodHtml;

    window._budgetMaxRent = estimatedRent;
    if (typeof syncCustomSelects === 'function') syncCustomSelects();
}

function filterByBudget() {
    if (!window._budgetMaxRent) return;
    document.getElementById('priceMax').value = window._budgetMaxRent;
    showPage('search');
    setTimeout(function() { doSearch(); }, 300);
}

// ===== REPORT SYSTEM =====
function openReportModal() {
    document.getElementById('reportModal').style.display = 'flex';
    document.getElementById('reportDescription').value = '';
    var radios = document.querySelectorAll('input[name="reportReason"]');
    radios.forEach(function(r) { r.checked = false; });
    clearFormFeedback('reportFeedback');
}

function closeReportModal() {
    document.getElementById('reportModal').style.display = 'none';
}

async function submitReport() {
    var reason = document.querySelector('input[name="reportReason"]:checked');
    if (!reason) { showFormFeedback('reportFeedback', 'Selecione o motivo', 'error'); return; }

    var chatOther = document.getElementById('chatHeaderName').textContent;
    // Get the other user ID from the current chat
    var reportedUserId = window._currentChatOtherUserId;
    var conversationId = window._currentChatConvId;

    if (!reportedUserId) { showFormFeedback('reportFeedback', 'Erro: usuario nao identificado', 'error'); return; }

    try {
        var res = await fetch(API + '/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
            body: JSON.stringify({
                reportedUserId: reportedUserId,
                conversationId: conversationId,
                reason: reason.value,
                description: document.getElementById('reportDescription').value
            })
        });
        var data = await res.json();
        if (res.ok) {
            showFormFeedback('reportFeedback', data.message || 'Denuncia enviada!', 'success');
            setTimeout(closeReportModal, 2000);
        } else {
            showFormFeedback('reportFeedback', data.error || 'Erro ao enviar', 'error');
        }
    } catch(e) {
        showFormFeedback('reportFeedback', 'Erro de conexao', 'error');
    }
}

// ===== IDENTITY VERIFICATION =====
function previewVerifyFile(input, previewId) {
    var preview = document.getElementById(previewId);
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = '<img src="' + e.target.result + '" alt="Preview">';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function submitVerification() {
    var selfie = document.getElementById('verifySelfie').files[0];
    var doc = document.getElementById('verifyDocument').files[0];
    if (!selfie || !doc) { showToast('Envie a selfie e o documento', 'warning'); return; }

    var formData = new FormData();
    formData.append('selfie', selfie);
    formData.append('document', doc);

    var btn = document.getElementById('submitVerifyBtn');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        var res = await fetch(API + '/verification/submit', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + currentToken },
            body: formData
        });
        var data = await res.json();
        if (res.ok) {
            showToast(data.message || 'Documentos enviados!', 'success');
            updateVerificationStatus('pending');
        } else {
            showToast(data.error || 'Erro ao enviar', 'error');
        }
    } catch(e) {
        showToast('Erro de conexão', 'error');
    }
    btn.disabled = false;
    btn.textContent = 'Enviar para analise';
}

function updateVerificationStatus(status) {
    var statusDiv = document.getElementById('verificationStatus');
    var uploadDiv = document.getElementById('verificationUpload');
    if (status === 'pending') {
        statusDiv.innerHTML = '<div class="verify-status verify-status-pending">Em analise — aguarde ate 24 horas</div>';
        uploadDiv.style.display = 'none';
    } else if (status === 'approved') {
        statusDiv.innerHTML = '<div class="verify-status verify-status-approved">Identidade verificada</div>';
        uploadDiv.style.display = 'none';
    } else if (status === 'rejected') {
        statusDiv.innerHTML = '<div class="verify-status verify-status-rejected">Verificacao rejeitada — envie novamente</div>';
        uploadDiv.style.display = 'block';
    }
}

async function loadVerificationStatus() {
    if (!currentToken) return;
    try {
        var res = await fetch(API + '/verification/status', { headers: { 'Authorization': 'Bearer ' + currentToken }});
        var data = await res.json();
        if (data.identityVerification && data.identityVerification.status !== 'none') {
            updateVerificationStatus(data.identityVerification.status);
        }
    } catch(e) {}
}

// ===== OWNER LEAD FORM (Landing Page Proprietários) =====
async function submitOwnerLead(e) {
    e.preventDefault();
    var btn = document.getElementById('olSubmitBtn');
    var feedback = document.getElementById('olFeedback');
    setLoading(btn, true);
    clearFormFeedback('olFeedback');

    var name = document.getElementById('olName').value.trim();
    var phone = document.getElementById('olPhone').value.trim();
    var email = document.getElementById('olEmail').value.trim();
    var neighborhood = document.getElementById('olNeighborhood').value.trim();
    var propertyType = document.getElementById('olType').value;
    var price = document.getElementById('olPrice').value;

    if (!name || !phone || !email || !neighborhood) {
        showFormFeedback('olFeedback', 'Preencha todos os campos obrigatórios', 'error');
        setLoading(btn, false);
        return;
    }

    try {
        var res = await fetch(API + '/owner/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, neighborhood, propertyType, price: parseFloat(price) || 0 })
        });
        var data = await res.json();
        if (res.ok) {
            showFormFeedback('olFeedback', 'Recebemos seu interesse! Entraremos em contato em breve pelo WhatsApp.', 'success');
            document.getElementById('ownerLeadForm').reset();
            // Abrir WhatsApp direto com mensagem pré-preenchida pro admin
            var whatsMsg = 'Olá! Sou ' + name + ' e quero anunciar meu imóvel no MoraJunto.\n' +
                'Bairro: ' + neighborhood + '\n' +
                'Tipo: ' + propertyType + '\n' +
                (price ? 'Valor: R$' + price + '\n' : '') +
                'Meu contato: ' + phone;
            var whatsUrl = 'https://wa.me/5516999990000?text=' + encodeURIComponent(whatsMsg);
            setTimeout(function() { window.open(whatsUrl, '_blank'); }, 500);
        } else {
            showFormFeedback('olFeedback', data.error || 'Erro ao enviar. Tente novamente.', 'error');
        }
    } catch(e) {
        showFormFeedback('olFeedback', 'Erro de conexão. Tente novamente.', 'error');
    }
    setLoading(btn, false);
}

// ===== CALCULADORA DE RENDA DO PROPRIETÁRIO =====
function calcOwnerRevenue() {
    var priceInput = document.getElementById('ownerCalcPrice');
    var tenantsInput = document.getElementById('ownerCalcTenants');
    if (!priceInput || !tenantsInput) return;

    var price = parseFloat(priceInput.value) || 0;
    var tenants = parseInt(tenantsInput.value) || 2;
    var fee = 0.08;

    var ownerReceives = price;
    var perTenant = Math.round(price / tenants);
    var feePerTenant = Math.round(perTenant * fee);
    var totalPerTenant = perTenant + feePerTenant;
    var totalPlatformFee = feePerTenant * tenants;

    document.getElementById('ownerCalcReceives').textContent = 'R$ ' + ownerReceives.toLocaleString('pt-BR');
    document.getElementById('ownerCalcPerTenant').textContent = 'R$ ' + totalPerTenant.toLocaleString('pt-BR');
    document.getElementById('ownerCalcFee').textContent = 'R$ ' + totalPlatformFee.toLocaleString('pt-BR');
    document.getElementById('ownerCalcTenantCount').textContent = tenants + (tenants === 1 ? ' inquilino' : ' inquilinos');

    // Animate bar
    var bar = document.getElementById('ownerCalcBar');
    if (bar) {
        var pct = price > 0 ? Math.min(100, (ownerReceives / (ownerReceives + totalPlatformFee)) * 100) : 100;
        bar.style.width = pct + '%';
    }
}

// ===== NOTIFICAÇÕES DO PROPRIETÁRIO =====
async function loadOwnerNotifications() {
    if (!currentToken) return;
    try {
        var res = await fetch(API + '/owner/notifications', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        if (!res.ok) return;
        var data = await res.json();
        var container = document.getElementById('ownerNotifications');
        if (!container) return;

        if (!data.notifications || data.notifications.length === 0) {
            container.innerHTML = '<p class="empty-state-text">Nenhuma notificação ainda. Quando alguém visualizar ou demonstrar interesse nos seus imóveis, você será notificado aqui.</p>';
            return;
        }

        var html = '';
        data.notifications.forEach(function(n) {
            var icon = n.type === 'view_milestone' ?
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6C3AED" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' :
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
            var timeAgo = getTimeAgo(n.createdAt);
            var readClass = n.read ? '' : ' notif-unread';
            html += '<div class="owner-notif-item' + readClass + '" data-id="' + n._id + '">' +
                '<div class="owner-notif-icon">' + icon + '</div>' +
                '<div class="owner-notif-content">' +
                    '<p class="owner-notif-text">' + escapeHtml(n.message) + '</p>' +
                    '<span class="owner-notif-time">' + timeAgo + '</span>' +
                '</div>' +
            '</div>';
        });
        container.innerHTML = html;

        // Marcar como lidas
        fetch(API + '/owner/notifications/read', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + currentToken }
        }).catch(function() {});
    } catch(e) {}
}

function getTimeAgo(dateStr) {
    var now = Date.now();
    var date = new Date(dateStr).getTime();
    var diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'agora';
    if (diff < 3600) return Math.floor(diff / 60) + 'min atrás';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h atrás';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd atrás';
    return new Date(dateStr).toLocaleDateString('pt-BR');
}
