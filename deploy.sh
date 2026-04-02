#!/bin/bash

# Syft auto-deployment script
echo "Deploying Syft to Spicetify..."

# Ensure directory exists
mkdir -p ~/.config/spicetify/Extensions

# Copy both the main extension and the debug extension
cp /Users/akshit/Code/Syft/extension.js ~/.config/spicetify/Extensions/syft.js
cp /Users/akshit/Code/Syft/debug.js ~/.config/spicetify/Extensions/syft-debug.js

spicetify config extensions syft.js
spicetify config extensions syft-debug.js

# Apply changes to Spotify
spicetify apply

echo "Done! The debug log widget is anchored to the bottom left of Spicetify and can be safely expanded/collapsed."
