# Syft: Dynamic Search Implementation Guide

This document outlines two approaches for implementing dynamic, tagless semantic search in the Syft Spicetify extension, eliminating the need for a hardcoded tag vocabulary.

---

## Approach 1: Lightweight In-Browser Vector Search (Transformers.js)

This approach uses a small, quantized machine learning model running entirely locally in the Spotify client via WebAssembly. It calculates the "vibe" or semantic meaning of a query and matches it against your library.

### The Tech Stack
* **Library:** `Transformers.js` (by HuggingFace)
* **Model:** `Xenova/all-MiniLM-L6-v2` (quantized, ~22MB)
* **Storage:** `IndexedDB` (for storing track embeddings)
* **Concurrency:** Web Worker (Blob URL stringified)

### Implementation Steps

#### 1. Setup the Web Worker
Since Spicetify injects scripts directly, you cannot easily load external local worker files. You must stringify the worker and create a Blob URL.

\`\`\`javascript
const workerCode = \`
    import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0';
    env.allowLocalModels = false; // Force fetching from HuggingFace Hub

    let extractor;

    self.onmessage = async (e) => {
        const { type, data } = e.data;
        
        if (type === 'init') {
            extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true });
            self.postMessage({ status: 'ready' });
        } 
        
        if (type === 'embed') {
            const output = await extractor(data.text, { pooling: 'mean', normalize: true });
            self.postMessage({ status: 'embedded', id: data.id, vector: Array.from(output.data) });
        }
    };
\`;

const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
\`\`\`

#### 2. Indexing to IndexedDB
When loading the library, pass track strings (`"\${track.name} \${track.artist}"`) to the worker. Store the returned 384-dimensional vectors in IndexedDB. *Do not use `localStorage` as you will exceed the 5MB quota.*

#### 3. Cosine Similarity Search
When the user queries "late night car drive":
1.  Send the query to the worker to get its embedding vector.
2.  Retrieve all track vectors from IndexedDB.
3.  Calculate the dot product (cosine similarity) between the query vector and each track vector.

\`\`\`javascript
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }
    return dotProduct; // Assumes vectors are already normalized
}
\`\`\`
4.  Sort tracks by the highest score and return the top 50.

### Pros & Cons
* **Pros:** True semantic understanding. Works offline after initial load. Extremely accurate for "vibes."
* **Cons:** First-time setup downloads ~22MB. Requires async IndexedDB management. High CPU usage during initial indexing.

---

## Approach 2: On-the-Fly Lexical Query Expansion (Datamuse API)

This approach keeps your existing, highly optimized BM25 algorithm but makes the input query smarter by silently querying a lexical database for related terms and triggers before searching.

### The Tech Stack
* **API:** Datamuse (`https://api.datamuse.com`)
* **Search Engine:** Existing BM25 implementation
* **Storage:** In-memory LRU Cache (to prevent duplicate API calls)

### Implementation Steps

#### 1. The Expansion Function
Create a function that intercepts the user's query and fetches statistically correlated words, synonyms, or triggers.

\`\`\`javascript
const expansionCache = new Map();

async function expandQuery(query) {
    if (expansionCache.has(query)) return expansionCache.get(query);

    try {
        // rel_trg: words that are statistically associated with the query string
        // ml: words with similar meaning
        const res = await fetch(\`https://api.datamuse.com/words?ml=\${encodeURIComponent(query)}&max=5\`);
        const data = await res.json();
        
        const expandedTerms = data.map(item => item.word);
        const finalQuery = \`\${query} \${expandedTerms.join(' ')}\`;
        
        expansionCache.set(query, finalQuery);
        return finalQuery;
    } catch (e) {
        console.error("Expansion failed, falling back to original query", e);
        return query;
    }
}
\`\`\`

#### 2. Integrate with BM25
Modify your `performSearch` listener to await the expanded query before executing the BM25 scoring.

\`\`\`javascript
// Inside your UI listener
document.getElementById('syft-input').oninput = debounce(async (e) => {
    const rawQuery = e.target.value;
    if (!rawQuery.trim()) {
        showState(resultsContainer, 'Type to search.');
        return;
    }

    // Expand "late night drive" -> "late night drive midnight chill dark"
    const smartQuery = await expandQuery(rawQuery);
    
    // Pass the expanded query to your existing BM25 logic
    performSearch(smartQuery, searchIndex, playlistTracks, resultsContainer);
}, 200); // Slightly higher debounce to accommodate network request
\`\`\`

### Pros & Cons
* **Pros:** Zero impact on extension bundle size. Extremely fast to implement. Keeps indexing instant.
* **Cons:** Requires an active internet connection to expand queries. Rate limits apply (though Datamuse is generous, caching is required). Doesn't perfectly capture entire phrases as well as vector embeddings.