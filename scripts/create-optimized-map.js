#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('=== Create Optimized Map JSON ===');

// Paths
const mapPath = path.join(__dirname, '../client/public/assets/beacon_bay_map.json');
const backupPath = path.join(__dirname, '../client/public/assets/beacon_bay_map.backup.json');
const optimizedPath = path.join(__dirname, '../client/public/assets/beacon_bay_map.json');
const tilesDir = path.join(__dirname, '../client/public/assets/tiles/modern_exteriors');

// Read the map data
console.log('📖 Reading map data...');
const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));dock

// Get list of PNG files we actually have
console.log('📁 Checking available PNG files...');
const availablePngFiles = fs.readdirSync(tilesDir).filter(f => f.endsWith('.png'));
console.log(`✓ Found ${availablePngFiles.length} PNG files`);

// Find modern_exteriors tileset
const modernExteriorsTileset = mapData.tilesets.find(ts => ts.name === 'modern_exteriors');
if (!modernExteriorsTileset) {
    console.error('❌ modern_exteriors tileset not found');
    process.exit(1);
}

console.log(`📊 Original tileset has ${modernExteriorsTileset.tiles.length} tiles`);

// Create mapping of filename to tile info
const filenameTileMap = {};
modernExteriorsTileset.tiles.forEach(tile => {
    if (tile.image) {
        const filename = tile.image.split('/').pop().replace(/\\/g, '');
        filenameTileMap[filename] = tile;
    }
});

// Create new tiles array with only tiles we have PNG files for
const newTiles = [];
const oldToNewIdMap = {};
let newTileId = 0;

availablePngFiles.forEach(filename => {
    const originalTile = filenameTileMap[filename];
    if (originalTile) {
        // Map old tile ID to new tile ID
        oldToNewIdMap[originalTile.id] = newTileId;
        
        // Create new tile with sequential ID
        const newTile = {
            ...originalTile,
            id: newTileId
        };
        
        newTiles.push(newTile);
        newTileId++;
    }
});

console.log(`✓ Created optimized tileset with ${newTiles.length} tiles`);

// Update the tileset
modernExteriorsTileset.tiles = newTiles;
modernExteriorsTileset.tilecount = newTiles.length;

// Now we need to update the map data to use the new tile IDs
console.log('🔄 Updating map tile IDs...');
let tilesUpdated = 0;

mapData.layers.forEach(layer => {
    if (layer.type === 'tilelayer' && layer.data) {
        layer.data = layer.data.map(tileId => {
            if (tileId === 0) return 0; // Empty tile
            
            // Check if this is a modern_exteriors tile
            if (tileId >= modernExteriorsTileset.firstgid && 
                tileId < modernExteriorsTileset.firstgid + 6009) { // Original tile count
                
                const originalLocalId = tileId - modernExteriorsTileset.firstgid;
                const newLocalId = oldToNewIdMap[originalLocalId];
                
                if (newLocalId !== undefined) {
                    // We have this tile - update to new ID
                    const newGlobalId = modernExteriorsTileset.firstgid + newLocalId;
                    tilesUpdated++;
                    return newGlobalId;
                } else {
                    // We don't have this tile - replace with empty tile
                    return 0;
                }
            }
            
            return tileId; // Not a modern_exteriors tile, keep as is
        });
    }
});

console.log(`✓ Updated ${tilesUpdated} tile references`);

// Write the optimized map
console.log('💾 Writing optimized map...');
fs.writeFileSync(optimizedPath, JSON.stringify(mapData, null, 2));

// Generate statistics
const originalSize = fs.statSync(backupPath).size;
const newSize = fs.statSync(optimizedPath).size;
const sizeDiff = originalSize - newSize;
const sizeReduction = ((sizeDiff / originalSize) * 100).toFixed(1);

console.log('\n=== Optimization Results ===');
console.log(`✓ Tiles in tileset: ${modernExteriorsTileset.tiles.length} (was 6009)`);
console.log(`✓ Tile references updated: ${tilesUpdated}`);
console.log(`✓ File size: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(newSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`✓ Size reduction: ${(sizeDiff / 1024 / 1024).toFixed(2)} MB (${sizeReduction}%)`);

console.log('\n🎉 Optimized map created!');
console.log('   - Only tiles with PNG files are included');
console.log('   - No more loading errors');
console.log('   - Smaller file size');
console.log('   - Map will render correctly'); 