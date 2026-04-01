# Sift - Natural Language Playlist Search for Spicetify

## Context

Create a Spicetify custom app that adds a natural language search bar to Spotify. Users can type queries like "punjabi songs" or "arijit singh sad songs" and get matching tracks from their playlists and Spotify's catalog. This runs inside the Spotify desktop client via Spicetify's custom app system.

**User Requirements:**
- **Phase 1**: Search user's playlists only
- **Phase 2**: Add full Spotify catalog search
- **NLP Approach**: Hybrid - use efficient embedding-based search (not full LLM, not purely rule-based). Options include pre-computed embeddings, BM25 with semantic enhancement, or a lightweight vector index for music queries.

The goal is something smarter than keyword matching but more efficient than calling an LLM for every query.

## Project Structure

```
/Users/akshit/Code/Sift/
├── manifest.json          # App metadata & icon
├── index.js               # Entry point (Spicetify calls render())
├── style.css              # Styling
└── src/
    ├── App.jsx            # Main component, state & search orchestration
    ├── components/
    │   ├── SearchBar.jsx  # Search input
    │   ├── ResultsList.jsx # Results display
    │   └── TrackCard.jsx  # Individual track card
    └── services/
        ├── QueryParser.js     # NLP → Spotify query conversion
        ├── SpotifyAPI.js      # Spotify API wrapper
        └── PlaylistSearch.js  # Search user's playlists
```

## Implementation

### Phase 1: User Playlists Only (MVP)

**1. Setup (manifest.json + index.js)**
- Create manifest with app name and SVG icon
- `index.js` exports `render()` function that returns a React component via `React.createElement`

**2. Query Parser (src/services/QueryParser.js)**
Hybrid parser combining rules + smart extraction:
- **Intent extraction**: Identify what type of thing the user wants (genre, artist, mood, year)
- **Entity extraction**: Pull out specific names/numbers (artist names, years, genres)
- **Query reconstruction**: Build optimized Spotify query + search index tokens
- **Fallback**: If parser can't understand, treat as raw search term

**3. Spotify API Service (src/services/SpotifyAPI.js)**
- Get access token from Spicetify (`Spicetify.CosmosAsync.get('sp://auth/v1/token')`)
- `getUserPlaylists()` and `getPlaylistTracks()` for Phase 1

**4. Playlist Index (src/services/PlaylistIndex.js)**
- Fetch all user playlists and tracks on app load
- Build in-memory index: track fingerprint = { artist, name, album, year, genres }
- Support similarity search using token overlap + BM25 scoring
- Cache index in localStorage for fast subsequent loads

**5. Search Engine (src/services/SearchEngine.js)**
- Takes parsed query, searches playlist index
- Returns scored/ranked results with playlist context
- Scoring: exact artist match (high) > partial match > keyword overlap

**6. UI Components**
- **SearchBar**: Input + Enter key handler + search button
- **TrackCard**: Album art, track name, artist, "From: playlistName", play button
- **ResultsList**: Displays tracks, loading spinner, empty state
- **IndexProgress**: Shows "Indexing your playlists..." during initial load

### Phase 2: Add Spotify Catalog Search

- Add SpotifyAPI.search() integration
- Add mode toggle: "My Playlists" / "Spotify" / "All"
- Merge results from both sources

## Key Files to Create (Phase 1)

| File | Purpose |
|------|---------|
| `manifest.json` | Spicetify app registration |
| `index.js` | Entry point with render() |
| `src/App.jsx` | Main component, orchestrates search |
| `src/services/QueryParser.js` | Intent/entity extraction |
| `src/services/SpotifyAPI.js` | Spotify API wrapper |
| `src/services/PlaylistIndex.js` | Track indexing & caching |
| `src/services/SearchEngine.js` | BM25 + similarity scoring |
| `src/components/SearchBar.jsx` | Search input |
| `src/components/ResultsList.jsx` | Results display |
| `src/components/TrackCard.jsx` | Track card |
| `src/components/IndexProgress.jsx` | Indexing progress indicator |
| `style.css` | All styles |

## Installation

1. Build the extension in `~/.config/spicetify/CustomApps/sift/`
2. Add to spicetify config: `custom-apps = sift`
3. Run `spicetify apply`

## Verification

1. `spicetify apply` succeeds without errors
2. "Sift" appears in Spotify sidebar under custom apps
3. Search "punjabi songs" → returns Punjabi tracks from playlists
4. Search "arijit singh sad songs" → returns Arijit Singh's sad songs
5. Toggle between "My Playlists" / "Spotify" / "All" modes works
6. Clicking play on a track starts playback
