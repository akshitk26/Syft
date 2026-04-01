# Syft - Natural Language Search for Playlists

A Spicetify extension that adds natural language search to Spotify playlist views.

## Features

- Search within any playlist using natural language ("punjabi songs", "arijit singh", "2020 hits")
- Fast BM25-based search algorithm
- Instant results as you type
- Click any result to play it

## Installation

1. Copy the extension file:
```bash
mkdir -p ~/.config/spicetify/Extensions
cp /Users/akshit/Code/Syft/extension.js ~/.config/spicetify/Extensions/syft.js
```

2. Enable the extension:
```bash
spicetify config extensions syft
spicetify apply
```

3. Restart Spotify

## Usage

1. Open any playlist in Spotify
2. A search bar will appear at the top of the playlist
3. Type natural language queries like:
   - "punjabi songs"
   - "arijit singh"
   - "sad romantic"
   - "2020"
4. Click any result to play it
5. Press Escape or clear the search to show all tracks

## Debug Mode

Add `?debug=true` to any Spotify URL to see console logs:
```
spotify:?debug=true
```

Or look for `[Syft]` logs in the browser console (Ctrl+Shift+I).

## Uninstall

```bash
spicetify config extensions ""
spicetify apply
```