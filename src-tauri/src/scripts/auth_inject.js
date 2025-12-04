(async function() {
    if (window.location.hostname !== 'app.kiro.dev') return;
    if (window.__kiro_login_done) return;
    if (window.location.pathname.includes('signin')) return;
    
    window.__kiro_login_done = true;
    console.log('Login detected, fetching user info...');
    
    try {
        let metaCsrf = document.querySelector('meta[name="csrf-token"]');
        let csrfToken = metaCsrf ? metaCsrf.getAttribute('content') : '';
        console.log('csrfToken from meta:', csrfToken);
        
        if (!csrfToken) {
            if (!window.location.pathname.includes('/account')) {
                console.log('No csrfToken, redirecting to /account/usage...');
                window.location.href = '/account/usage';
                return;
            }
            await new Promise(r => setTimeout(r, 500));
            metaCsrf = document.querySelector('meta[name="csrf-token"]');
            csrfToken = metaCsrf ? metaCsrf.getAttribute('content') : '';
            if (!csrfToken) throw new Error('No csrfToken found');
        }
        
        const getCookie = (name) => {
            const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            return match ? match[2] : '';
        };
        const accessToken = getCookie('AccessToken') || '';
        const refreshToken = getCookie('RefreshToken') || '';
        const idp = getCookie('Idp') || 'Google';
        
        console.log('accessToken:', accessToken.substring(0, 30) + '...');
        console.log('refreshToken:', refreshToken.substring(0, 30) + '...');
        
        if (!accessToken || !refreshToken) {
            console.log('Cookies not readable, trying RefreshToken API...');
            throw new Error('Cookies are HttpOnly, cannot read');
        }
        
        const userIdMeta = document.querySelector('meta[name="user-id"]');
        const userId = userIdMeta ? userIdMeta.getAttribute('content') : '';
        
        let email = userId || 'unknown';
        let quota = 50, used = 0;
        console.log('userId:', userId, 'idp:', idp);
        
        const tokenData = { email, accessToken, refreshToken, csrfToken, idp, quota, used };
        document.title = 'KIRO_LOGIN_SUCCESS:' + btoa(JSON.stringify(tokenData));
        console.log('Token data encoded to title');
    } catch (err) {
        console.error('Error:', err);
    }
})();
