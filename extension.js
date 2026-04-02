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

    let libraryTracks = [];
    let librarySearchIndex = null;
    let globalBtnEl = null;
    let globalSyftPanel = null;
    let globalResultsContainer = null;

    let statusEl = null;
    let lastUrl = '';

    // Initialize
    function init() {
        console.log('[Syft] Init...');
        createStatusEl();
        updateStatus('Starting up...');
        injectStyles();
        
        // Start polling for page changes (playlist)
        setTimeout(checkPage, 2000);
        
        // Attempt to inject global button next to search bar
        injectGlobalButton();

        // Start indexing library
        setTimeout(loadLibrary, 3000);
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
            box-shadow: none;
            text-shadow: none;
        `;
        document.body.appendChild(statusEl);
    }

    function updateStatus(msg) {
        if (!statusEl) return;
        statusEl.textContent = 'Syft: ' + msg;
        log('Status: ' + msg);
    }

    function injectGlobalButton() {
        if (globalBtnEl) return;

        // Try to find the search container to inject next to it
        const searchBox = document.querySelector('.main-globalNav-searchContainer');
        if (!searchBox) {
            setTimeout(injectGlobalButton, 1000);
            return;
        }

        globalBtnEl = document.createElement('button');
        globalBtnEl.innerHTML = 'Syft Global';
        globalBtnEl.style.cssText = `
            background: #FFFF00; /* NEON YELLOW */
            border: 2px solid #CCCC00;
            border-radius: 24px;
            padding: 8px 16px;
            color: black;
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
            z-index: 999998;
            box-shadow: none;
            text-shadow: none;
            transition: transform 0.2s;
            margin-left: 12px;
            height: 48px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            -webkit-app-region: no-drag;
            pointer-events: auto;
        `;
        
        globalBtnEl.onmouseover = () => { globalBtnEl.style.transform = 'scale(1.05)'; };
        globalBtnEl.onmouseout = () => { globalBtnEl.style.transform = 'scale(1)'; };

        globalBtnEl.onclick = function () {
            if (!globalSyftPanel) createGlobalPanel();
            globalSyftPanel.style.display = globalSyftPanel.style.display === 'block' ? 'none' : 'block';
        };

        // Append next to the search box (as a sibling)
        if (searchBox.parentNode) {
            searchBox.parentNode.insertBefore(globalBtnEl, searchBox.nextSibling);
        }

        log('Global Button injected');
    }

    function createGlobalPanel() {
        globalSyftPanel = document.createElement('div');
        globalSyftPanel.style.cssText = `
            display: none;
            position: fixed;
            top: 70px;
            left: 50%;
            transform: translateX(-50%);
            width: 400px;
            max-height: 60vh;
            background: #181818;
            border: 2px solid #FFFF00;
            border-radius: 12px;
            z-index: 999997;
            overflow: hidden;
        `;

        globalSyftPanel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#282828;">
                <span style="font-weight:bold;font-size:15px;color:black;background:#FFFF00;padding:4px 8px;border-radius:4px;">Library Search</span>
                <button id="syft-global-x" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;">×</button>
            </div>
            <div style="padding:10px;background:#121212;">
                <input type="text" id="syft-global-input" placeholder="Search your entire library..." style="width:100%;padding:10px;background:#282828;border:2px solid #FFFF00;border-radius:6px;color:#fff;font-size:14px;box-sizing:border-box;">
            </div>
            <div id="syft-global-results" style="max-height:calc(60vh - 90px);overflow-y:auto;"></div>
        `;

        document.body.appendChild(globalSyftPanel);
        globalResultsContainer = document.getElementById('syft-global-results');

        document.getElementById('syft-global-x').onclick = () => globalSyftPanel.style.display = 'none';
        document.getElementById('syft-global-input').oninput = debounce(e => performSearch(e.target.value, librarySearchIndex, libraryTracks, globalResultsContainer), 150);

        if (libraryTracks.length > 0) {
            showState(globalResultsContainer, libraryTracks.length + ' library songs indexed. Type to search.');
        } else {
            showState(globalResultsContainer, '<div class="spin"></div>Indexing library...');
        }

        log('Global Panel created');
    }

    async function loadLibrary() {
        updateStatus('Indexing library...');
        if (globalResultsContainer) showState(globalResultsContainer, '<div class="spin"></div>Indexing library...');
        
        try {
            libraryTracks = await fetchLibraryTracks();
            librarySearchIndex = buildIndex(libraryTracks);
            log('Indexed ' + libraryTracks.length + ' library tracks');
            updateStatus(`Library Ready (${libraryTracks.length} tracks)`);
            if (globalResultsContainer) {
                showState(globalResultsContainer, libraryTracks.length + ' library songs indexed. Type to search.');
            }
        } catch (e) {
            updateStatus('Library Error: ' + e.message);
            log('Library Error: ' + e.message);
            if (globalResultsContainer) showState(globalResultsContainer, 'Error: ' + e.message);
        }
    }

    async function fetchLibraryTracks() {
        let tracks = [];
        let seenUris = new Set();
        
        try {
            log('Fetching playlists to aggregate library');
            let playlistIds = [];
            
            // Try Spicetify RootlistAPI if available
            if (Spicetify?.Platform?.RootlistAPI?.getContents) {
                try {
                    const rootlist = await Spicetify.Platform.RootlistAPI.getContents();
                    function extractIds(items) {
                        if (!items) return;
                        for (const item of items) {
                            if (item.type === 'playlist') {
                                playlistIds.push(item.uri.split(':').pop());
                            } else if (item.type === 'folder' && item.items) {
                                extractIds(item.items);
                            }
                        }
                    }
                    if (rootlist?.items) {
                        extractIds(rootlist.items);
                    }
                } catch (e) { pushDebug('RootlistAPI_Err', e.message); }
            }
            
            if (playlistIds.length === 0) {
                try {
                    let url = 'https://api.spotify.com/v1/me/playlists?limit=50';
                    while (url) {
                        const d = await Spicetify.CosmosAsync.get(url);
                        if (!d || !d.items) break;
                        for (const p of d.items) {
                            if (p && p.id) playlistIds.push(p.id);
                        }
                        url = d.next;
                    }
                } catch(e) { pushDebug('PlaylistWebAPI_Err', e.message); }
            }

            log('Found ' + playlistIds.length + ' playlists. Aggregating tracks...');
            
            for (let i = 0; i < playlistIds.length; i++) {
                if (i % 5 === 0) {
                    updateStatus(`Indexing library... (${i}/${playlistIds.length} playlists)`);
                }
                const pTracks = await fetchTracks(playlistIds[i], true);
                for (const t of pTracks) {
                    if (t && t.uri && !seenUris.has(t.uri)) {
                        seenUris.add(t.uri);
                        tracks.push(t);
                    }
                }
            }
            
            if (tracks.length > 0) return tracks;
        } catch (e) {
            pushDebug('LibraryFetch_Err', e.message);
        }
        
        return tracks;
    }

    function checkPage() {
        let pathname = window.location.href;

        if (typeof Spicetify !== 'undefined' && Spicetify?.Platform?.History?.location) {
            pathname = Spicetify.Platform.History.location.pathname;
        }

        if (pathname !== lastUrl) {
            lastUrl = pathname;
            log('Path: ' + pathname.substring(0, 60));
        }

        // Keep trying to inject global button just in case UI redrew it
        injectGlobalButton();

        let playlistId = null;

        const match1 = pathname.match(/\/playlist\/([a-zA-Z0-9]+)/);
        if (match1) playlistId = match1[1];

        if (!playlistId) {
            const match2 = pathname.match(/spotify:playlist:([a-zA-Z0-9]+)/);
            if (match2) playlistId = match2[1];
        }

        if (playlistId) {
            if (!btnEl) createButton();

            if (playlistId !== currentPlaylist) {
                updateStatus('Loading playlist...');
                currentPlaylist = playlistId;
                playlistTracks = [];
                searchIndex = null;
                loadPlaylist(playlistId);
            }
        } else {
            if (btnEl) {
                btnEl.remove();
                btnEl = null;
            }
        }

        setTimeout(checkPage, 2500);
    }

    function createButton() {
        btnEl = document.createElement('button');
        btnEl.innerHTML = 'Syft';
        btnEl.style.cssText = `
            position: fixed;
            top: 70px;
            right: 24px;
            background: #BF40FF;
            border: 2px solid #D173FF;
            border-radius: 24px;
            padding: 14px 24px;
            color: white;
            font-size: 16px;
            font-weight: 800;
            cursor: pointer;
            z-index: 999998;
            box-shadow: none;
            text-shadow: none;
            transition: transform 0.2s;
        `;
        btnEl.onmouseover = () => {
            btnEl.style.transform = 'scale(1.05)';
        };
        btnEl.onmouseout = () => {
            btnEl.style.transform = 'scale(1)';
        };
        btnEl.onclick = function () {
            if (!syftPanel) createPanel();
            syftPanel.style.display = syftPanel.style.display === 'block' ? 'none' : 'block';
        };
        document.body.appendChild(btnEl);
        log('Playlist Button created');
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

        syftPanel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#282828;">
                <span style="color:#FF6B00;font-weight:bold;font-size:15px;">Syft Search</span>
                <button id="syft-x" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;">×</button>
            </div>
            <div style="padding:10px;background:#121212;">
                <input type="text" id="syft-input" placeholder="Search playlist..." style="width:100%;padding:10px;background:#282828;border:2px solid #FF6B00;border-radius:6px;color:#fff;font-size:14px;box-sizing:border-box;">
            </div>
            <div id="syft-results" style="max-height:calc(60vh - 90px);overflow-y:auto;"></div>
        `;

        document.body.appendChild(syftPanel);
        resultsContainer = document.getElementById('syft-results');

        document.getElementById('syft-x').onclick = () => syftPanel.style.display = 'none';
        document.getElementById('syft-input').oninput = debounce(e => performSearch(e.target.value, searchIndex, playlistTracks, resultsContainer), 150);

        log('Playlist Panel created');
    }

    function injectStyles() {
        if (document.getElementById('syft-css')) return;
        const css = document.createElement('style');
        css.id = 'syft-css';
        css.textContent = `
            .item{display:flex;align-items:center;padding:10px;gap:10px;cursor:pointer;border-radius:4px}
            .item:hover{background:#282828}
            .art{width:40px;height:40px;background:#333;border-radius:4px;flex-shrink:0}
            .info{flex:1;min-width:0}
            .name{color:#fff;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .artist{color:#888;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .state{padding:24px;text-align:center;color:#666}
            .spin{width:20px;height:20px;border:2px solid #444;border-top:2px solid #FF6B00;border-radius:50%;animation:sspin .8s linear infinite;margin:0 auto 8px}
            @keyframes sspin{to{transform:rotate(360deg)}}
        `;
        document.head.appendChild(css);
    }

    async function loadPlaylist(id) {
        showState(resultsContainer, '<div class="spin"></div>Indexing...');
        updateStatus('Indexing tracks...');
        try {
            playlistTracks = await fetchTracks(id);
            searchIndex = buildIndex(playlistTracks);
            log('Indexed ' + playlistTracks.length + ' tracks');
            updateStatus(`Ready (${playlistTracks.length} tracks)`);
            showState(resultsContainer, playlistTracks.length + ' songs indexed. Type to search.');
        } catch (e) {
            updateStatus('Error: ' + e.message);
            log('Error: ' + e.message);
            showState(resultsContainer, 'Error: ' + e.message);
        }
    }

    function pushDebug(tag, dump) {
        log(tag + ' -> ' + dump);

        if (window.SyftDebug && window.SyftDebug.push) {
            window.SyftDebug.push(tag, dump);
        }
    }

    async function fetchTracks(id, isLibrary = false) {
        let tracks = [];
        if (!isLibrary && resultsContainer) resultsContainer.innerHTML = '';

        try {
            if (Spicetify?.Platform?.PlaylistAPI?.getContents) {
                const res = await Spicetify.Platform.PlaylistAPI.getContents(`spotify:playlist:${id}`);
                const list = res?.items || res?.tracks || (res?.data?.items) || res;

                if (Array.isArray(list) && list.length > 0) {
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
                }
            }
        } catch (e) { pushDebug('PlaylistAPI_Err', e.message); }

        try {
            let url = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`;
            while (url) {
                const d = await Spicetify.CosmosAsync.get(url);
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
        } catch (e) { pushDebug('CosmosWebAPI_Err', e.message); }

        try {
            const t = await Spicetify.CosmosAsync.get('sp://auth/v1/token');
            let url = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`;
            while (url) {
                const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t.accessToken } });
                if (!r.ok) break;
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

    function performSearch(query, index, tracks, container) {
        if (!query.trim() || !index) {
            showState(container, tracks.length ? (tracks.length + ' songs. Type to search.') : 'No tracks loaded');
            return;
        }
        const tokens = query.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(x => x.length > 1);
        if (!tokens.length) { showState(container, tracks.length + ' songs. Type to search.'); return; }

        const results = tracks.map(t => ({ t, s: score(t, tokens, index) })).sort((a, b) => b.s - a.s).filter(r => r.s > 0).slice(0, 25);
        if (!results.length) showState(container, 'No results for "' + query + '"');
        else showResults(container, results.map(r => r.t));
    }

    function score(track, qtokens, index) {
        if (!index || !qtokens.length) return 0;
        const toks = `${track.name} ${track.artist}`.toLowerCase().split(/\s+/);
        let sc = 0;
        for (const q of qtokens) {
            const tf = toks.filter(t => t.includes(q) || q.includes(t)).length;
            sc += (index.idf[q] || 0) * (tf * (BM25_K1 + 1)) / (tf + BM25_K1);
        }
        return sc;
    }

    function showState(container, html) { 
        if (container) container.innerHTML = '<div class="state">' + html + '</div>'; 
    }

    function showResults(container, tracks) {
        if (!container) return;
        container.innerHTML = tracks.map(t => '<div class="item" data-uri="' + t.uri + '"><div class="art"></div><div class="info"><div class="name">' + esc(t.name) + '</div><div class="artist">' + esc(t.artist) + '</div></div></div>').join('');
        container.querySelectorAll('.item').forEach(item => {
            item.onclick = () => { if (item.dataset.uri && Spicetify?.Player) Spicetify.Player.playUri(item.dataset.uri); };
        });
    }

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function debounce(fn, w) { let to; return (...a) => { clearTimeout(to); to = setTimeout(() => fn(...a), w); }; }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    console.log('[Syft] Loaded');
})();