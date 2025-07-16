# Beacon Bay Map Documentation

## Overview
Beacon Bay is a 300x300 tile coastal town map designed for Project Heartwood Valley. The map includes all the required locations from the PRD organized into logical zones.

## Map Details
- **Size**: 300x300 tiles (16x16 pixels per tile)
- **Total Buildings**: 35 structures
- **File**: `client/public/assets/beacon_bay_map.json`
- **Locations**: `beacon_bay_locations.json`

## Tile Types
- **Grass (ID: 1)**: Green grass areas using `Grass_Middle.png`
- **Path/Buildings (ID: 5)**: Brown areas for paths and buildings using `Path_Middle.png`
- **Water (ID: 6)**: Blue water areas using `Water_Middle.png`

## Zone Layout

### 1. Farm Zone (Northwest)
- **Farmhouse** (20, 20): 12x10 tiles
- **Barn** (35, 20): 15x12 tiles
- **Crop Fields**: Multiple field areas for farming activities

### 2. Civic Core (North-Central)
- **Town Hall** (130, 45): 15x10 tiles - Administrative center
- **Hospital** (150, 45): 20x15 tiles - Medical facility
- **Police Station** (125, 60): 12x8 tiles - Law enforcement
- **Fire Station** (140, 60): 12x8 tiles - Emergency services
- **Post Office** (155, 60): 8x6 tiles - Mail services
- **Library** (165, 60): 12x10 tiles - Public library
- **Empty Slots**: 2 additional civic building slots for future expansion

### 3. Downtown Commercial (Central)
- **Cafe** (110, 95): 12x8 tiles - Social hub
- **Gym** (125, 95): 15x10 tiles - Fitness center
- **Music Store** (145, 95): 10x8 tiles - Music equipment
- **Butcher** (160, 95): 8x6 tiles - Meat shop
- **Empty Slots**: 2 additional commercial building slots for future expansion

### 4. Residential District (Central-South)
- **Apartments** (90, 140): 20x25 tiles - Multi-family housing
- **Suburban Houses**: 13 individual houses (8x6 tiles each) scattered throughout
- **Small Pond** (180, 160): 12x8 tiles - Decorative water feature

### 5. Waterfront & Recreation (South)
- **Beach** (50, 240): 200x10 tiles - Sandy beach area
- **Recreation Center** (80, 230): 25x15 tiles - Community center
- **Playground** (110, 235): 15x10 tiles - Children's play area
- **DJ Stage** (150, 240): 10x8 tiles - Performance venue
- **Fishing Docks**: 3 dock areas extending into the water
- **Main Bay**: Large water area for fishing and recreation

### 6. Outskirts
- **Mansion** (205, 55): 20x15 tiles - Luxury residence on elevated ground
- **Mad Science Lab** (250, 25): 25x20 tiles - Isolated research facility

## Road Network
The map includes a comprehensive road system connecting all zones:
- **Main Roads**: Connect civic core to downtown and residential areas
- **Beach Access**: Multiple paths leading to the waterfront
- **Farm Access**: Dedicated road to the farming area
- **Residential Streets**: Internal paths throughout the housing district

## NPC Schedule Integration
All buildings are positioned to support the agent scheduling system:
- **Work Locations**: Civic buildings, commercial shops, farm, lab
- **Social Spaces**: Cafe, gym, rec center, beach, playground
- **Residential Areas**: Houses and apartments for agent living spaces
- **Recreation**: Beach, fishing docks, DJ stage for entertainment

## Usage Notes
- Buildings are currently represented as brown/path-colored rectangles
- Future sprints can replace these with detailed building sprites
- Location coordinates are provided for NPC positioning and pathfinding
- Water areas support fishing activities
- Beach area supports recreation and DJ events
- Farm fields support agricultural activities

## Future Expansion
The map includes designated empty building slots in both civic and commercial zones for future development as the game grows. 