# Syft Search Algorithm Design

## 1. Overview

### Purpose
Enhance Syft's search capabilities to allow users to find songs using natural language queries like "punjabi songs", "sad arijit singh songs", or "late night car drive songs". Also add functionality to play all matching results together.

### Goals
1. **Search within current playlist** — Keep existing behavior, improve relevance
2. **Search across all playlists** — New feature to search user's entire library
3. **Smart tag-based matching** — Support queries beyond exact keyword matching (language, mood, vibe, region)
4. **Play all matching songs** — Add all search results to queue or create temp playlist
5. **Maintain performance** — Search latency < 200ms for 10,000+ tracks

### Non-Goals
- Full LLM integration (too expensive, too slow)
- Real-time API calls for every search
- Mobile support
- Social features

---

## 2. Current Implementation

The existing `extension.js` already has:
- BM25-based search scoring (k1=1.5, b=0.75)
- Per-playlist indexing on load
- Simple token matching on track name + artist
- Click-to-play functionality

**What's missing:**
- Cross-playlist search
- Enhanced tag/mood/language matching
- "Play all" functionality

---

## 3. Search Scope Modes

| Mode | Description | Implementation Priority |
|------|-------------|------------------------|
| Current Playlist | Search only the playlist currently being viewed | Already exists |
| All Playlists | Search across all playlists in user's library | Phase 1 |
| Spotify Catalog | Search full Spotify (Phase 2, out of scope) | Future |

---

## 4. Approach Options

### Approach 1: Enhanced BM25 with Tag Vocabulary (Recommended)

Build on current BM25 but add **query expansion** via tag vocabulary.

**How it works:**
1. **Tag Vocabulary**: Predefined dictionary mapping natural language to tags
   ```
   punjabi → [punjabi, bhangra, diljit]
   sad → [sad, emotional, heartbreak, melancholic]
   workout → [workout, energetic, upbeat, power, gym]
   party → [party, upbeat, dance, celebratory]
   late night → [late night, moody, chill, lowkey]
   car drive → [road trip, driving, cruise, highway]
   chill → [chill, relaxed, mellow, laid back]
   ```
2. **Query Expansion**: Before BM25 scoring, expand query tokens
   - "punjabi songs" → search for "punjabi" + known Punjabi artist names
   - "late night car drive" → expand to mood tags: "moody", "chill", "lowkey"
3. **Metadata Extraction**: During indexing, extract available Spotify metadata (genre, artist)
4. **Score Boosting**: Give higher weight to exact tag matches vs partial text matches

**Pros:**
- Fast (<100ms), no external calls
- Incremental improvement on existing code
- Tag vocabulary can be expanded gradually
- Works offline after initial indexing

**Cons:**
- Limited semantic understanding
- Requires building/maintaining tag vocabulary
- No true "understanding" of phrases like "late night car drive"

---

### Approach 2: Lightweight In-Browser Embeddings

Use a small embedding model that runs entirely in-browser.

**How it works:**
1. **Load Model**: On first use, download lightweight embedding model (~10-50MB)
2. **Pre-compute**: Generate embeddings for all tracks during indexing
3. **Query Embed**: Embed the search query
4. **Cosine Similarity**: Find nearest tracks by embedding distance

**Pros:**
- Excellent semantic matching ("late night drive" → "chill/moody")
- Handles synonyms naturally
- No API dependencies

**Cons:**
- Initial load: 5-15 seconds to download model + compute embeddings
- Memory: ~50MB+ for embeddings of 10k tracks
- Model download on first use

**Tools:**
- `sentence-transformers.js` (ONNX-based)
- TensorFlow.js with small model
- Custom lightweight model (~4MB)

---

### Approach 3: Hybrid - BM25 + External Tag API

Combine BM25 with external metadata enrichment.

**How it works:**
1. **On First Search**: For tracks without sufficient metadata, query external API
2. **Cache Results**: Store enriched metadata in localStorage
3. **Include in Index**: Add language, genre, mood tags to searchable fields
4. **Hybrid Search**: Use BM25 on all text + tag fields

**External APIs to consider:**
- Last.fm (genre, tags, mood)
- Musixmatch (lyrics language detection)
- Spotify Audio Features API (tempo, energy, danceability)
- Custom JSON file with common artist/tag mappings

**Pros:**
- Rich metadata from authoritative sources
- Handles "punjabi" via artist lookup
- Can detect language from track name or audio features

**Cons:**
- API rate limits
- Network dependency = slower first-time queries
- Requires handling API failures gracefully

---

### Approach 4: User-Defined Tags (Manual)

Allow users to tag songs themselves.

**How it works:**
1. **Tag Editor UI**: Right-click or long-press track → "Add Tags"
2. **Tag Storage**: Store in localStorage (keyed by track URI)
3. **Search Integration**: Include user tags in BM25 index

**Pros:**
- 100% accurate (user-defined)
- No API calls needed

**Cons:**
- High user effort required
- Users won't tag their entire library
- Best as supplement to other approaches

---

## 5. Recommended Approach

**Start with Approach 1 (Enhanced BM25)** for these reasons:

1. **Lowest risk**: Incremental improvement on working code
2. **Fast**: Meets <200ms latency target
3. **Offline**: Works without network after indexing
4. **Iterative**: Can add Approach 2 or 3 later as enhancements
5. **Practical**: Handles "punjabi songs", "arijit singh", etc. with current metadata

**Implementation Order:**
1. Add cross-playlist search (index all playlists, not just current)
2. Build tag vocabulary for common queries
3. Add query expansion logic
4. Then optionally: embeddings or external API

---

## 6. "Play All" Feature

### Option A: Add to Queue (Randomized) — Recommended for MVP

**Implementation:**
```
1. User clicks "Play All" button
2. Get all matching track URIs
3. Shuffle the array (optional, configurable)
4. Clear current queue or append
5. Start playing first track
```

**Pros:**
- Simple to implement (1 function call)
- No playlist cleanup needed
- Good UX for "shuffle play all matching"

**Cons:**
- No persistence if user closes app
- Can't easily save as playlist

---

### Option B: Temporary Sub-Playlist

**Implementation:**
```
1. User clicks "Play All" button
2. Create new Spotify playlist: "Syft: {query}" (hidden from user)
3. Add all matching tracks to it
4. Play that playlist
5. On app close, optionally delete the temp playlist
```

**Pros:**
- Full playlist controls (save, reorder, etc.)
- Better for "save this search result"

**Cons:**
- More API calls (create playlist, add tracks, delete later)
- Playlist appears in user's library (cleanup needed)
- More complex error handling

---

**Recommendation:** Start with Option A (Add to Queue). Add Option B later if users want persistent results.

---

## 7. Search Optimization Guidelines

### Indexing Strategy
- **On-demand indexing**: Index current playlist on page load
- **Background indexing**: For "All Playlists" mode, index in background with progress UI
- **Cache to localStorage**: Persist index for faster reload (clearable in settings)

### Query Performance
- **Debounce input**: 150-200ms delay before searching
- **Limit results**: Return top 25-50 results, load more on scroll
- **Web Worker**: Move search computation to Web Worker if needed for >10k tracks

### Memory Management
- **Lazy load**: Don't index playlists until user switches to "All Playlists" mode
- **Stream large playlists**: Fetch tracks in chunks (100 at a time)
- **LRU cache**: Keep recent searches cached

---

## 8. Tag Vocabulary (Initial)

Build this into the code as a starting point:

```javascript
const TAG_VOCABULARY = {
  // Languages / Regions
  punjabi: ['punjabi', 'panjabi', 'bhangra', 'diljit', 'sidhu'],
  hindi: ['hindi', 'bollywood', 'hindi', 'arijit', 'atif'],
  tamil: ['tamil', 'tamil', 'dhanush', 'anirudh'],
  telugu: ['telugu', 'telugu', 'ssr', 'devi'],

  // Moods / Vibes
  sad: ['sad', 'emotional', 'heartbreak', 'melancholy', 'tearful'],
  happy: ['happy', 'joyful', 'cheerful', 'upbeat', 'feel good'],
  party: ['party', 'dance', 'celebratory', 'club', 'dhun'],
  workout: ['workout', 'gym', 'energetic', 'power', 'pump'],
  chill: ['chill', 'relaxed', 'mellow', 'laid back', 'lowkey'],
  romantic: ['romantic', 'love', 'romance', 'couple', 'valentine'],

  // Contexts
  'late night': ['late night', 'moody', 'introspective', 'night drive'],
  'car drive': ['road trip', 'driving', 'cruise', 'highway', 'travel'],
  workout: ['gym', 'fitness', 'running', 'exercise', 'training'],
  commute: ['commute', 'morning', 'travel', 'journey', 'transit'],

  // Eras
  '90s': ['1990s', '90s', 'retro', 'nostalgia'],
  '2000s': ['2000s', '00s', 'y2k'],
  '2010s': ['2010s', '2010', '2015', 'recent'],

  // Generic genre mappings
  rock: ['rock', 'guitar', 'band', 'classic rock'],
  pop: ['pop', 'mainstream', 'chart'],
  hiphop: ['hip hop', 'rap', 'hiphop', 'desi hip hop'],
};
```

---

## 9. Query Expansion Logic

```javascript
function expandQuery(query) {
  const tokens = query.toLowerCase().split(/\s+/);
  const expanded = [...tokens];

  for (const token of tokens) {
    if (TAG_VOCABULARY[token]) {
      // Add all tag synonyms to search
      expanded.push(...TAG_VOCABULARY[token]);
    }

    // Also check for partial matches
    for (const [key, values] of Object.entries(TAG_VOCABULARY)) {
      if (token.includes(key) || key.includes(token)) {
        expanded.push(...values);
      }
    }
  }

  return [...new Set(expanded)]; // Dedupe
}
```

---

## 10. Architecture

### Files to Modify/Create

```
src/
├── services/
│   ├── SearchEngine.js      # BM25 + tag expansion (modify existing)
│   ├── PlaylistIndex.js     # Cross-playlist indexing (modify)
│   ├── QueryParser.js       # Query tokenization + expansion (modify)
│   └── TagVocabulary.js     # NEW: Tag vocabulary dictionary
├── components/
│   ├── SearchBar.jsx        # Add mode toggle
│   ├── PlayAllButton.jsx    # NEW: "Play All" button
│   └── ResultsList.jsx      # May need pagination updates
└── App.jsx                  # Add "All Playlists" mode
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `buildIndex(playlists)` | Index all tracks from multiple playlists |
| `expandQuery(query)` | Apply tag vocabulary to expand query |
| `search(query, mode)` | Run search in current/all playlist mode |
| `playAllMatches(tracks)` | Add all matches to queue |
| `createTempPlaylist(tracks)` | (Future) Create temp playlist |

---

## 11. Edge Cases

1. **No playlists**: Show "Create playlists to search"
2. **Empty search results**: "No songs match '{query}'. Try different keywords."
3. **Very large library (50k+)**: Show indexing progress, paginate
4. **Network failure during indexing**: Show error, allow retry
5. **Duplicate tracks**: Show source playlist for each
6. **No metadata available**: Fall back to title/artist exact match

---

## 12. Performance Targets

| Metric | Target |
|--------|--------|
| Index 10,000 tracks | < 10 seconds |
| Search latency | < 200ms |
| Memory usage | < 50MB for 10k tracks |
| localStorage cache | < 5MB |

---

## 13. Future Enhancements (Post-MVP)

- Approach 2: Lightweight embeddings for better semantic matching
- Approach 3: External API for metadata enrichment
- Option B: Temporary playlist creation
- User-defined custom tags
- Search history / recent searches

---

## 14. Questions for Implementation

1. Should "Play All" shuffle by default or play in relevance order?
2. Should the tag vocabulary be user-editable (add custom tags)?
3. How to handle playlists with >10,000 tracks — paginate indexing with progress UI?