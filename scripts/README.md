# Heartwood Valley Map Generation Tools

This directory contains tools for generating and managing the Beacon Bay map for the Heartwood Valley game.

## Files

- `generateMap.js` - Main script for map generation and validation
- `package.json` - Package configuration and scripts
- `README.md` - This documentation

## Usage

### Install Dependencies

```bash
cd scripts
npm install
```

### Validate Location Data

Before generating a map, you can validate that all locations are properly configured:

```bash
npm run validate
```

This will check:
- All locations have required properties (x, y, width, height)
- No locations extend beyond map boundaries
- Water areas are properly configured

### Generate Map

Generate a new `beacon_bay_map.json` file from the locations data:

```bash
npm run generate
```

This will:
1. Validate the location data
2. Create a new map with all buildings and water areas
3. Generate statistics about tile usage
4. Save the map to both client and server directories

### Direct Script Usage

You can also run the script directly:

```bash
node generateMap.js validate
node generateMap.js generate
```

## Location Data Format

The map is generated from `beacon_bay_locations.json`, which contains:

```json
{
  "building_name": {
    "x": 137,
    "y": 50,
    "name": "Building Name",
    "width": 15,
    "height": 10,
    "type": "civic",
    "tileId": 11,
    "description": "Building description"
  },
  "water_areas": [
    {
      "name": "Water Area Name",
      "x": 180,
      "y": 160,
      "width": 40,
      "height": 25,
      "type": "water",
      "tileId": 12,
      "description": "Water area description"
    }
  ]
}
```

### Building Types

- `civic` - Town hall, hospital, police station, etc.
- `commercial` - Shops, restaurants, businesses
- `residential` - Houses, apartments, mansions
- `recreational` - Parks, playgrounds, entertainment
- `agricultural` - Farms, barns, farming structures
- `waterfront` - Docks, piers, maritime structures
- `natural` - Beaches, natural areas
- `special` - Unique locations like the Mad Science Lab

### Tile IDs

- `10` - Grass tiles (green background)
- `11` - Building/path tiles (brown structures)
- `12` - Water tiles (blue water)

## Map Configuration

- **Map Size**: 300x300 tiles
- **Tile Size**: 16x16 pixels
- **Total Pixels**: 4800x4800 pixels

## Output Files

The script generates two identical files:
- `client/public/assets/beacon_bay_map.json` - Used by the Phaser client
- `game-server/src/maps/beacon_bay_map.json` - Used by the Colyseus server

## Adding New Buildings

1. Edit `beacon_bay_locations.json` in either directory
2. Add your new building with required properties
3. Run `npm run validate` to check for errors
4. Run `npm run generate` to create the new map
5. The building label will automatically appear in the game

## Building Labels

The game automatically creates text overlays for all buildings using the `name` property from the locations data. These labels appear centered over each building and are visible in the game world.

## Troubleshooting

### Validation Errors

- **"Location extends beyond map boundaries"**: Reduce the width/height or move the location
- **"Missing required properties"**: Ensure x, y, width, height are all defined
- **"Water area missing properties"**: Check that water areas have all required fields

### Map Generation Issues

- Ensure the locations file is valid JSON
- Check that all paths exist and are writable
- Verify that x, y coordinates are within 0-299 range
- Ensure width/height don't cause locations to extend beyond map edges

### Game Integration

- The PreloaderScene loads the locations data
- The GameScene creates building labels automatically
- Labels appear at the center of each building
- Labels scale with camera zoom and appear above buildings

## Statistics

The script provides statistics about the generated map:
- Total tiles: 90,000 (300x300)
- Grass tiles: ~87.8% (background)
- Building tiles: ~3.9% (structures)
- Water tiles: ~8.3% (water areas) 