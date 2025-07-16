#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const MAP_WIDTH = 300;
const MAP_HEIGHT = 300;
const TILE_SIZE = 16;

// Tile IDs (adjusted for firstgid = 1)
const TILES = {
  GRASS: 10,    // Green grass (default background)
  BUILDING: 11, // Brown buildings/paths
  WATER: 12     // Blue water
};

// File paths
const LOCATIONS_FILE = path.join(__dirname, '../game-server/src/maps/beacon_bay_locations.json');
const OUTPUT_FILE = path.join(__dirname, '../client/public/assets/beacon_bay_map.json');
const SERVER_OUTPUT_FILE = path.join(__dirname, '../game-server/src/maps/beacon_bay_map.json');

/**
 * Generate a new beacon bay map using the location data
 */
function generateMap() {
  console.log('🗺️  Generating Beacon Bay map...');
  
  // Initialize map with grass tiles
  const mapData = new Array(MAP_WIDTH * MAP_HEIGHT).fill(TILES.GRASS);
  
  // Load locations data
  const locationsData = JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
  
  // Process buildings and structures
  Object.entries(locationsData).forEach(([key, location]) => {
    if (key === 'water_areas') return; // Handle water areas separately
    
    if (location.x !== undefined && location.y !== undefined && 
        location.width !== undefined && location.height !== undefined) {
      
      console.log(`📍 Placing ${location.name} at (${location.x}, ${location.y}) [${location.width}x${location.height}]`);
      
      // Place the building tiles
      for (let y = location.y; y < location.y + location.height; y++) {
        for (let x = location.x; x < location.x + location.width; x++) {
          // Ensure we're within map bounds
          if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
            const index = y * MAP_WIDTH + x;
            mapData[index] = location.tileId || TILES.BUILDING;
          }
        }
      }
    }
  });
  
  // Process water areas
  if (locationsData.water_areas) {
    locationsData.water_areas.forEach(waterArea => {
      console.log(`🌊 Placing ${waterArea.name} at (${waterArea.x}, ${waterArea.y}) [${waterArea.width}x${waterArea.height}]`);
      
      for (let y = waterArea.y; y < waterArea.y + waterArea.height; y++) {
        for (let x = waterArea.x; x < waterArea.x + waterArea.width; x++) {
          // Ensure we're within map bounds
          if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
            const index = y * MAP_WIDTH + x;
            mapData[index] = waterArea.tileId || TILES.WATER;
          }
        }
      }
    });
  }
  
  // Create the Tiled map structure
  const tiledMap = {
    "compressionlevel": -1,
    "height": MAP_HEIGHT,
    "infinite": false,
    "layers": [
      {
        "data": mapData,
        "height": MAP_HEIGHT,
        "id": 1,
        "name": "ground",
        "opacity": 1,
        "type": "tilelayer",
        "visible": true,
        "width": MAP_WIDTH,
        "x": 0,
        "y": 0
      }
    ],
    "nextlayerid": 2,
    "nextobjectid": 1,
    "orientation": "orthogonal",
    "renderorder": "right-down",
    "tiledversion": "1.11.2",
    "tileheight": TILE_SIZE,
    "tilesets": [
      {
        "columns": 16,
        "firstgid": 1,
        "image": "tileset.png",
        "imageheight": 16,
        "imagewidth": 256,
        "margin": 0,
        "name": "tileset",
        "spacing": 0,
        "tilecount": 16,
        "tileheight": TILE_SIZE,
        "tilewidth": TILE_SIZE,
        "tiles": [
          {
            "id": 9,
            "type": "grass"
          },
          {
            "id": 10,
            "type": "path"
          },
          {
            "id": 11,
            "type": "water"
          }
        ]
      }
    ],
    "tilewidth": TILE_SIZE,
    "type": "map",
    "version": "1.10",
    "width": MAP_WIDTH
  };
  
  // Ensure output directories exist
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.mkdirSync(path.dirname(SERVER_OUTPUT_FILE), { recursive: true });
  
  // Write the map files
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tiledMap, null, 2));
  fs.writeFileSync(SERVER_OUTPUT_FILE, JSON.stringify(tiledMap, null, 2));
  
  console.log('✅ Map generation complete!');
  console.log(`📁 Client map: ${OUTPUT_FILE}`);
  console.log(`📁 Server map: ${SERVER_OUTPUT_FILE}`);
  
  // Generate statistics
  const stats = {
    totalTiles: mapData.length,
    grassTiles: mapData.filter(tile => tile === TILES.GRASS).length,
    buildingTiles: mapData.filter(tile => tile === TILES.BUILDING).length,
    waterTiles: mapData.filter(tile => tile === TILES.WATER).length
  };
  
  console.log('\n📊 Map Statistics:');
  console.log(`   Total tiles: ${stats.totalTiles}`);
  console.log(`   Grass tiles: ${stats.grassTiles} (${(stats.grassTiles / stats.totalTiles * 100).toFixed(1)}%)`);
  console.log(`   Building tiles: ${stats.buildingTiles} (${(stats.buildingTiles / stats.totalTiles * 100).toFixed(1)}%)`);
  console.log(`   Water tiles: ${stats.waterTiles} (${(stats.waterTiles / stats.totalTiles * 100).toFixed(1)}%)`);
  
  return tiledMap;
}

// Validation function
function validateLocations() {
  console.log('🔍 Validating location data...');
  
  const locationsData = JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
  let errors = [];
  
  Object.entries(locationsData).forEach(([key, location]) => {
    if (key === 'water_areas') {
      // Validate water areas
      if (Array.isArray(location)) {
        location.forEach((waterArea, index) => {
          if (waterArea.x === undefined || waterArea.y === undefined || waterArea.width === undefined || waterArea.height === undefined) {
            errors.push(`Water area ${index} is missing required properties`);
          }
          if (waterArea.x + waterArea.width > MAP_WIDTH || waterArea.y + waterArea.height > MAP_HEIGHT) {
            errors.push(`Water area ${waterArea.name} extends beyond map boundaries`);
          }
        });
      }
    } else {
      // Validate buildings
      if (location.x === undefined || location.y === undefined || location.width === undefined || location.height === undefined) {
        errors.push(`Location ${key} is missing required properties`);
      }
      if (location.x + location.width > MAP_WIDTH || location.y + location.height > MAP_HEIGHT) {
        errors.push(`Location ${location.name} extends beyond map boundaries`);
      }
    }
  });
  
  if (errors.length > 0) {
    console.error('❌ Validation errors found:');
    errors.forEach(error => console.error(`   - ${error}`));
    return false;
  }
  
  console.log('✅ All locations are valid!');
  return true;
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'validate':
      validateLocations();
      break;
    case 'generate':
    default:
      if (validateLocations()) {
        generateMap();
      } else {
        console.error('❌ Map generation aborted due to validation errors');
        process.exit(1);
      }
      break;
  }
}

module.exports = { generateMap, validateLocations }; 