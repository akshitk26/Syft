# Syft - Natural Language Playlist Search for Spicetify

## 1. Project Overview

**Project Name:** Syft
**Type:** Spicetify Custom App / Spotify Desktop Extension

**Core Functionality:** A natural language search interface that allows users to find songs within their Spotify playlists using conversational queries like "punjabi songs" or "arijit singh sad songs" — without needing to know exact song titles or artist names.

**Target Users:** Spotify users with large playlist collections who want smarter, faster search within their own music library.

---

## 2. Problem Statement

### The Problem
- Spotify's native search only matches exact keywords in titles/artists
- Users with thousands of songs across many playlists can't find music by mood, genre, or context
- Foreign language songs (Hindi, Punjabi, etc.) lack metadata that would make them discoverable
- No way to search "songs from 2015" or "upbeat workout music" within personal playlists

### Why It Matters
- Users spend minutes scrolling through playlists instead of finding songs instantly
- Playlist organization is only as good as how users tagged songs (，大部分没tag)
- Natural language is how people think — "punjabi songs" is easier than remembering artist names

---

## 3. Goals & Non-Goals

### Goals
1. **Fast Search:** Return results in <500ms for users with 10,000+ songs
2. **Natural Language Understanding:** Parse queries like "sad songs", "2020 hits", "party music"
3. **Phase 1:** Search user's playlists only (MVP)
4. **Phase 2:** Search Spotify's full catalog
5. **Easy Installation:** Users install via Spicetify CLI or marketplace

### Non-Goals
- LLM integration (too slow, too expensive, unnecessary for this use case)
- Generating playlists or recommendations (just search)
- Social features, sharing, or sync
- Mobile support (desktop-only via Spicetify)

---

## 4. Technical Approach

### Search Algorithm: BM25 + Smart Tokenization

**Why BM25?**
- Used by Elasticsearch, Solr, and search engines worldwide
- Ranks results by keyword relevance without neural networks
- Runs entirely in-browser, no API calls needed
- Handles 10,000+ songs in milliseconds

**How it works:**
1. Index all playlist tracks locally: artist, track name, album, genre tags (if available)
2. Tokenize user query: "punjabi songs" → tokens ["punjabi", "song"]
3. Score each track based on BM25 formula (term frequency × inverse document frequency)
4. Rank and return top results

**Handling Foreign Languages:**
- BM25 works on any text — it doesn't "understand" language, just matches tokens
- For best results, users should search in the language of the artist/music (e.g., "punjabi" works because it's English; "bollywood" works)
- For songs without metadata, fallback to exact title/artist matching

**Caching Strategy:**
- Index stored in memory during session
- Optionally cache to localStorage for faster reloads (user can clear in settings)

### Rate Limiting (Phase 2)
- Spotify API: 180 requests/minute (authenticated), 30/min (unauthenticated)
- Implement request queue with exponential backoff
- Cache frequent searches for 5 minutes

---

## 5. User Experience

### Phase 1: MVP — Playlist Search Only

**Where it lives:**
- Appears as "Syft" in Spotify sidebar under custom apps
- Opens as a panel/overlay within Spotify

**Initial Load:**
1. On first open, show progress: "Indexing your playlists..."
2. Fetch all user playlists → all tracks (via Spicetify API)
3. Build BM25 index in memory
4. Cache to localStorage for next session

**Search Flow:**
1. User types query in search bar (e.g., "punjabi songs")
2. Press Enter or click search
3. Results appear below (loading spinner if >100ms)
4. Each result shows: album art, track name, artist, "From: [playlist]", play button
5. Click track → starts playing

**Empty States:**
- "Indexing your playlists..." during initial load
- "No results found" if query returns nothing
- "Start typing to search your playlists"

### Phase 2: Full Spotify Catalog

**Mode Toggle:**
- "My Playlists" (default) — Phase 1 behavior
- "Spotify" — Search full Spotify catalog via API
- "All" — Merge both sources

**UI:**
- Toggle switch or dropdown in search bar area
- Results show source: "From your playlists" vs "From Spotify"

---

## 6. UI/UX Specification

### Layout
- Single page, vertically stacked:
  1. Header: App name + mode toggle (Phase 2)
  2. Search bar: Full-width input with search button
  3. Results: Scrollable list of track cards

### Visual Design
- **Theme:** Dark mode matching Spotify's aesthetic
- **Colors:**
  - Background: `#121212` (Spotify dark)
  - Surface: `#181818`
  - Text primary: `#FFFFFF`
  - Text secondary: `#B3B3B3`
  - Accent: `#1DB954` (Spotify green)
- **Typography:** Spotify font stack (Circular, fallback to sans-serif)
- **Spacing:** 8px grid system

### Components

| Component | Description |
|-----------|-------------|
| SearchBar | Input field with placeholder "Search your playlists..." + search icon + Enter key support |
| ModeToggle | Segmented control: "My Playlists" / "Spotify" / "All" (Phase 2) |
| ResultsList | Scrollable container, shows loading state, results, or empty state |
| TrackCard | Album art (40x40), track name (bold), artist (secondary), playlist source, play button |
| IndexProgress | Progress bar + text during initial indexing |
| EmptyState | Icon + message for no results / not loaded |

---

## 7. Technical Architecture

### File Structure
```
sift/
├── manifest.json          # Spicetify app registration
├── index.js               # Entry point, exports render()
├── style.css              # All styles
└── src/
    ├── App.jsx            # Main component, state orchestration
    ├── components/
    │   ├── SearchBar.jsx
    │   ├── ModeToggle.jsx
    │   ├── ResultsList.jsx
    │   ├── TrackCard.jsx
    │   ├── IndexProgress.jsx
    │   └── EmptyState.jsx
    └── services/
        ├── QueryParser.js     # Intent/entity extraction, query tokenization
        ├── SpotifyAPI.js      # Spicetify API wrapper (get playlists, tracks, search)
        ├── PlaylistIndex.js   # Track indexing + BM25 index building
        └── SearchEngine.js    # BM25 scoring + ranking
```

### Key Modules

**QueryParser.js**
- Input: Natural language query string
- Output: Tokenized array + extracted entities (artist, genre, year, mood)
- Logic:
  1. Lowercase + normalize
  2. Remove stop words (the, a, an, my)
  3. Extract patterns: 4-digit years, known moods, known genres
  4. Return tokens for BM25 + metadata for filtering

**SpotifyAPI.js**
- `getAccessToken()` — Get token from Spicetify
- `getUserPlaylists()` — Fetch all user playlists
- `getPlaylistTracks(playlistId)` — Fetch tracks from a playlist
- `searchSpotify(query)` — Phase 2: Search Spotify catalog

**PlaylistIndex.js**
- `buildIndex(playlists)` — Index all tracks
- `getTrackCount()` — Return indexed track count
- `clearCache()` / `loadFromCache()` — localStorage management

**SearchEngine.js**
- `search(query, limit)` — Run BM25 scoring, return top results
- BM25 params: k1=1.5, b=0.75 (standard defaults)

### Data Flow
```
User Input → QueryParser → SearchEngine → BM25 Score → ResultsList → TrackCard
                     ↑
              PlaylistIndex (pre-built)
                     ↑
              SpotifyAPI (initial load)
```

---

## 8. Installation & Distribution

### Spicetify Installation
1. User clones repo or downloads release
2. Places in `~/.config/spicetify/CustomApps/sift/`
3. Runs: `spicetify config custom-apps sift`
4. Runs: `spicetify apply`
5. "Syft" appears in Spotify sidebar

### Spicetify Marketplace (Future)
- Publish to Spicetify's marketplace listing
- Users can browse and install from within Spicetify
- Provides version updates, star ratings

### GitHub Release
- Tag releases with version numbers
- Provide .zip downloads for manual installation
- Include installation instructions in README

---

## 9. Performance Targets

| Metric | Target |
|--------|--------|
| Initial index build (10,000 songs) | < 10 seconds |
| Search latency | < 200ms |
| Memory usage | < 50MB for 10,000 songs |
| localStorage cache | < 5MB |

---

## 10. Edge Cases

1. **No playlists:** Show friendly empty state "Create some playlists to search!"
2. **Very large library (50,000+ songs):** Paginate indexing, show progress
3. **No search results:** "No songs match 'query'. Try different keywords."
4. **API rate limit (Phase 2):** Queue requests, show "Searching Spotify..." with delay
5. **Playlist with no tracks:** Skip, don't index
6. **Duplicate tracks across playlists:** Show source playlist for each
7. **Network failure:** Cache protects against some failures, show error if critical

---

## 11. Future Considerations (Out of Scope)

- Generate playlists based on mood/genres (AI recommendation)
- Mobile companion app
- Web-based version without Spicetify
- Sync index across devices
- User-defined custom tags for tracks

---

## 12. Developer Debug Panel

For testing and debugging without relying on Spotify's disabled dev tools.

### How to Activate
- **URL parameter:** Add `?debug=true` to the app URL
- Example: `sp://syft?debug=true`
- This toggles the debug panel on/off

### What's Displayed

The debug panel appears as a collapsible overlay (bottom-right corner):

| Info Shown | Description |
|------------|-------------|
| Index Size | Total tracks indexed (e.g., "1,234 tracks") |
| Last Search | The query just searched |
| Latency | Time to return results (e.g., "89ms") |
| Search Count | Total searches this session |
| Recent Events | Last 5 events (search, click, error, etc.) |
| Errors | Any errors that occurred |

### Logged Events (for debugging)
| Event | Description |
|-------|-------------|
| `Indexing started` | Beginning of playlist index build |
| `Index complete` | Index built, track count |
| `Search: <query>` | User search query |
| `Results: <count> in <ms>ms` | Results count + latency |
| `Play: <track>` | User clicked play |
| `Error: <type>` | Any error message |

### Visual Style
- Semi-transparent dark panel (background: `rgba(0,0,0,0.8)`)
- Monospace font for data
- Collapsed by default, click to expand
- Doesn't interfere with normal app usage

---

## 13. Success Metrics

- Users can find songs using natural language queries
- Search returns relevant results in < 500ms
- Installation works via Spicetify CLI
- Published to Spicetify marketplace
- Users can toggle between "My Playlists" / "Spotify" / "All" (Phase 2)
- Analytics track key user interactions

---

## 14. Questions for Clarification

1. Should Phase 2 include a "Play" button that plays from Spotify catalog (vs user's playlist)?
2. Should the app show a keyboard shortcut to open Syft? (e.g., Ctrl+Shift+F)
3. Any specific genres/moods to hardcode for better parsing? (workout, party, sad, etc.)