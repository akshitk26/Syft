// Syft - Natural Language Search Extension for Spicetify

(function Syft() {
    'use strict';

    if (window.syftFinal) return;
    window.syftFinal = true;

    console.log('[Syft] Starting...');

    const BM25_K1 = 1.5;
    const BM25_B = 0.75;

    let currentPlaylist = null;
    let playlistTracks = [];
    let searchIndex = null;
    let syftPanel = null;
    let resultsContainer = null;
    let btnEl = null;
    let statusEl = null;
    let lastUrl = '';

    // Initialize
    function init() {
        console.log('[Syft] Init...');
        createStatusEl();
        updateStatus('Starting up...');
        setTimeout(checkPage, 2000);
    }

    function log(msg) {
        console.log('[Syft]', msg);
    }

    function createStatusEl() {
        statusEl = document.createElement('div');
        statusEl.id = 'syft-status';
        statusEl.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #FF4500;
            border: 2px solid #FFA500;
            padding: 10px 16px;
            color: #fff;
            font-size: 13px;
            font-weight: 800;
            z-index: 999999;
            border-radius: 8px;
            pointer-events: none;
            box-shadow: 0 0 15px #FF4500, 0 0 30px #FF8C00;
            text-shadow: 0 0 5px rgba(255,255,255,0.5);
        `;
        document.body.appendChild(statusEl);
    }

    function updateStatus(msg) {
        if (!statusEl) return;
        statusEl.textContent = 'Syft: ' + msg;
        log('Status: ' + msg);
    }

    function checkPage() {
        let pathname = window.location.href;

        // In modern Spicetify, window.location.href is constant (xpui.app.spotify.com)
        // We must use the Spicetify History API to get the real path.
        if (typeof Spicetify !== 'undefined' && Spicetify?.Platform?.History?.location) {
            pathname = Spicetify.Platform.History.location.pathname;
        }

        if (pathname !== lastUrl) {
            lastUrl = pathname;
            log('Path: ' + pathname.substring(0, 60));
        }

        // Find playlist ID from path
        let playlistId = null;

        const match1 = pathname.match(/\/playlist\/([a-zA-Z0-9]+)/);
        if (match1) playlistId = match1[1];

        if (!playlistId) {
            const match2 = pathname.match(/spotify:playlist:([a-zA-Z0-9]+)/);
            if (match2) playlistId = match2[1];
        }

        if (playlistId) {
            log('Found playlist: ' + playlistId.substring(0, 10));

            // Show button when on playlist
            if (!btnEl) createButton();

            // Load playlist if changed
            if (playlistId !== currentPlaylist) {
                updateStatus('Loading playlist...');
                currentPlaylist = playlistId;
                playlistTracks = [];
                searchIndex = null;
                loadPlaylist(playlistId);
            }
        } else {
            // Not on playlist - remove button
            if (btnEl) {
                btnEl.remove();
                btnEl = null;
            }
            updateStatus('Not a playlist: ' + pathname.substring(0, 30));
        }

        setTimeout(checkPage, 2500);
    }

    function createButton() {
        btnEl = document.createElement('button');
        btnEl.innerHTML = '🔍 Syft';
        btnEl.style.cssText = `
            position: fixed;
            top: 70px;
            right: 24px;
            background: #BF40FF; /* NEON PURPLE */
            border: 2px solid #D173FF;
            border-radius: 24px;
            padding: 14px 24px;
            color: white;
            font-size: 16px;
            font-weight: 800;
            cursor: pointer;
            z-index: 999998;
            box-shadow: 0 0 15px #BF40FF, 0 0 30px #D173FF; /* NEON GLOW */
            text-shadow: 0 0 5px rgba(255,255,255,0.5);
            transition: transform 0.2s, box-shadow 0.2s;
        `;
        btnEl.onmouseover = () => {
            btnEl.style.transform = 'scale(1.05)';
            btnEl.style.boxShadow = '0 0 25px #BF40FF, 0 0 45px #D173FF';
        };
        btnEl.onmouseout = () => {
            btnEl.style.transform = 'scale(1)';
            btnEl.style.boxShadow = '0 0 15px #BF40FF, 0 0 30px #D173FF';
        };
        btnEl.onclick = function () {
            if (!syftPanel) createPanel();
            syftPanel.style.display = syftPanel.style.display === 'block' ? 'none' : 'block';
        };
        document.body.appendChild(btnEl);
        log('Button created');
    }

    function createPanel() {
        syftPanel = document.createElement('div');
        syftPanel.style.cssText = `
            display: none;
            position: fixed;
            top: 115px;
            right: 24px;
            width: 320px;
            max-height: 60vh;
            background: #181818;
            border: 2px solid #FF6B00;
            border-radius: 12px;
            z-index: 999997;
            overflow: hidden;
        `;

        injectStyles();

        syftPanel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#282828;">
                <span style="color:#FF6B00;font-weight:bold;font-size:15px;">🔍 Syft Search</span>
                <button id="syft-x" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;">×</button>
            </div>
            <div style="padding:10px;background:#121212;">
                <input type="text" id="syft-input" placeholder="Search songs..." style="width:100%;padding:10px;background:#282828;border:2px solid #FF6B00;border-radius:6px;color:#fff;font-size:14px;box-sizing:border-box;">
            </div>
            <div id="syft-results" style="max-height:calc(60vh - 90px);overflow-y:auto;"></div>
        `;

        document.body.appendChild(syftPanel);
        resultsContainer = document.getElementById('syft-results');

        document.getElementById('syft-x').onclick = () => syftPanel.style.display = 'none';
        document.getElementById('syft-input').oninput = debounce(e => search(e.target.value), 150);

        log('Panel created');
    }

    function injectStyles() {
        if (document.getElementById('syft-css')) return;
        const css = document.createElement('style');
        css.id = 'syft-css';
        css.textContent = `
            #syft-results .item{display:flex;align-items:center;padding:10px;gap:10px;cursor:pointer;border-radius:4px}
            #syft-results .item:hover{background:#282828}
            #syft-results .art{width:40px;height:40px;background:#333;border-radius:4px;flex-shrink:0}
            #syft-results .info{flex:1;min-width:0}
            #syft-results .name{color:#fff;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            #syft-results .artist{color:#888;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            #syft-results .state{padding:24px;text-align:center;color:#666}
            #syft-results .spin{width:20px;height:20px;border:2px solid #444;border-top:2px solid #FF6B00;border-radius:50%;animation:sspin .8s linear infinite;margin:0 auto 8px}
            @keyframes sspin{to{transform:rotate(360deg)}}
        `;
        document.head.appendChild(css);
    }

    async function loadPlaylist(id) {
        showState('<div class="spin"></div>Indexing...');
        updateStatus('Indexing tracks...');
        try {
            playlistTracks = await fetchTracks(id);
            searchIndex = buildIndex(playlistTracks);
            log('Indexed ' + playlistTracks.length + ' tracks');
            updateStatus(`Ready (${playlistTracks.length} tracks)`);
            showState(playlistTracks.length + ' songs indexed. Type to search.');
        } catch (e) {
            updateStatus('Error: ' + e.message);
            log('Error: ' + e.message);
            showState('Error: ' + e.message);
        }
    }

    // Visual debugger helper (delegates to debug.js if present)
    function pushDebug(tag, dump) {
        log(tag + ' -> ' + dump);

        if (window.SyftDebug && window.SyftDebug.push) {
            window.SyftDebug.push(tag, dump);
        }
    }

    async function fetchTracks(id) {
        let tracks = [];

        // Let's clear the panel to show debug output just in case
        if (resultsContainer) resultsContainer.innerHTML = '';

        // Strategy 1: Modern Spicetify Playlist API (v3+)
        try {
            if (Spicetify?.Platform?.PlaylistAPI?.getContents) {
                log('Using Spicetify Platform PlaylistAPI');
                const res = await Spicetify.Platform.PlaylistAPI.getContents(`spotify:playlist:${id}`);

                // Flexible nested unwrapping
                const list = res?.items || res?.tracks || (res?.data?.items) || res;
                pushDebug('PlaylistAPI_ResKeys', Object.keys(res || {}).join(','));

                if (Array.isArray(list) && list.length > 0) {
                    pushDebug('PlaylistAPI_FirstItemKeys', Object.keys(list[0] || {}).join(','));

                    const extracted = list.map(i => {
                        const target = i.item || i.track || i;
                        return {
                            id: target.uri ? target.uri.split(':').pop() : (target.id || ''),
                            name: target.name || '?',
                            artist: target.artists ? target.artists.map(a => a.name).join(', ') : '?',
                            uri: target.uri || ''
                        };
                    }).filter(t => t.uri && t.uri.includes('track'));

                    if (extracted.length > 0) return extracted;
                    else pushDebug('PlaylistAPI', 'List found but filtered to 0 (no valid tracks)');
                } else {
                    pushDebug('PlaylistAPI', 'No valid list found in response');
                }
            } else {
                pushDebug('PlaylistAPI', 'Platform API not available on this Spicetify version');
            }
        } catch (e) { pushDebug('PlaylistAPI_Err', e.message); }

        // Strategy 2: Spicetify CosmosAsync to Web API
        try {
            log('Using CosmosAsync to api.spotify.com');
            let url = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`;
            while (url) {
                const d = await Spicetify.CosmosAsync.get(url);
                if (!d || !d.items) {
                    pushDebug('CosmosWebAPI', 'No items in response. Keys: ' + Object.keys(d || {}).join(','));
                    break;
                }

                tracks.push(...d.items.map(i => i.track).filter(Boolean).map(t => ({
                    id: t.id,
                    name: t.name,
                    artist: t.artists ? t.artists.map(a => a.name).join(', ') : '',
                    uri: t.uri
                })));
                url = d.next;
            }
            if (tracks.length > 0) return tracks;
        } catch (e) { pushDebug('CosmosWebAPI_Err', e.message); }

        // Strategy 3: Legacy sp:// auth token fetch
        try {
            log('Using legacy sp:// auth token fetch');
            const t = await Spicetify.CosmosAsync.get('sp://auth/v1/token');
            let url = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`;
            while (url) {
                const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t.accessToken } });
                if (!r.ok) {
                    const txt = await r.text();
                    pushDebug('LegacyTokenAPI_Err', `Status ${r.status}: ${txt.substring(0, 50)}`);
                    break;
                }
                const d = await r.json();
                if (!d || !d.items) break;
                tracks.push(...d.items.map(i => i.track).filter(Boolean).map(t => ({
                    id: t.id,
                    name: t.name,
                    artist: t.artists ? t.artists.map(a => a.name).join(', ') : '',
                    uri: t.uri
                })));
                url = d.next;
            }
            if (tracks.length > 0) return tracks;
        } catch (e) { pushDebug('LegacyAPI_Err', e.message); }

        return tracks;
    }

    function buildIndex(tracks) {
        if (!tracks.length) return null;
        const df = {};
        tracks.forEach(t => {
            const toks = `${t.name} ${t.artist}`.toLowerCase().split(/\s+/);
            new Set(toks).forEach(x => df[x] = (df[x] || 0) + 1);
        });
        const idf = {};
        const N = tracks.length;
        for (const k in df) idf[k] = Math.log((N - df[k] + 0.5) / (df[k] + 0.5) + 1);
        return { idf, tracks };
    }

    function search(query) {
        if (!query.trim() || !searchIndex) {
            showState(playlistTracks.length ? (playlistTracks.length + ' songs. Type to search.') : 'No playlist loaded');
            return;
        }
        const tokens = query.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(x => x.length > 1);
        if (!tokens.length) { showState(playlistTracks.length + ' songs. Type to search.'); return; }

        const results = playlistTracks.map(t => ({ t, s: score(t, tokens) })).sort((a, b) => b.s - a.s).filter(r => r.s > 0).slice(0, 25);
        if (!results.length) showState('No results for "' + query + '"');
        else showResults(results.map(r => r.t));
    }

    function score(track, qtokens) {
        if (!searchIndex || !qtokens.length) return 0;
        const toks = `${track.name} ${track.artist}`.toLowerCase().split(/\s+/);
        let sc = 0;
        for (const q of qtokens) {
            const tf = toks.filter(t => t.includes(q) || q.includes(t)).length;
            sc += (searchIndex.idf[q] || 0) * (tf * (BM25_K1 + 1)) / (tf + BM25_K1);
        }
        return sc;
    }

    function showState(html) { if (resultsContainer) resultsContainer.innerHTML = '<div class="state">' + html + '</div>'; }

    function showResults(tracks) {
        if (!resultsContainer) return;
        resultsContainer.innerHTML = tracks.map(t => '<div class="item" data-uri="' + t.uri + '"><div class="art"></div><div class="info"><div class="name">' + esc(t.name) + '</div><div class="artist">' + esc(t.artist) + '</div></div></div>').join('');
        resultsContainer.querySelectorAll('.item').forEach(item => {
            item.onclick = () => { if (item.dataset.uri && Spicetify?.Player) Spicetify.Player.playUri(item.dataset.uri); };
        });
    }

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function debounce(fn, w) { let to; return (...a) => { clearTimeout(to); to = setTimeout(() => fn(...a), w); }; }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    console.log('[Syft] Loaded');
})();