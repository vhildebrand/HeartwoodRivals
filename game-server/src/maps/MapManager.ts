export interface TilesetInfo {
    name: string;
    image: string;
    tileWidth: number;
    tileHeight: number;
    columns: number;
    tileCount: number;
    firstGid: number;
    tiles?: { [key: number]: TileProperties };
}

export interface TileProperties {
    type?: string;
    collision?: boolean;
    [key: string]: any;
}

export interface MapLayer {
    name: string;
    type: 'tilelayer' | 'objectgroup';
    data?: number[];
    width: number;
    height: number;
    visible: boolean;
    opacity: number;
}

export interface MapData {
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
    infinite: boolean;
    layers: MapLayer[];
    tilesets: TilesetInfo[];
    properties?: { [key: string]: any };
}

export class MapManager {
    private static instance: MapManager;
    private maps: Map<string, MapData> = new Map();
    private collisionMaps: Map<string, number[][]> = new Map();

    private constructor() {}

    static getInstance(): MapManager {
        if (!MapManager.instance) {
            MapManager.instance = new MapManager();
        }
        return MapManager.instance;
    }

    /**
     * Load a map from Tiled JSON format
     */
    loadMap(mapId: string, tiledJson: any): MapData {
        const mapData: MapData = {
            width: tiledJson.width,
            height: tiledJson.height,
            tileWidth: tiledJson.tilewidth,
            tileHeight: tiledJson.tileheight,
            infinite: tiledJson.infinite || false,
            layers: tiledJson.layers.map((layer: any) => ({
                name: layer.name,
                type: layer.type,
                data: layer.data,
                width: layer.width,
                height: layer.height,
                visible: layer.visible,
                opacity: layer.opacity
            })),
            tilesets: tiledJson.tilesets.map((tileset: any) => ({
                name: tileset.name,
                image: tileset.image,
                tileWidth: tileset.tilewidth,
                tileHeight: tileset.tileheight,
                columns: tileset.columns,
                tileCount: tileset.tilecount,
                firstGid: tileset.firstgid,
                tiles: tileset.tiles ? tileset.tiles.reduce((acc: any, tile: any) => {
                    acc[tile.id] = {
                        type: tile.type,
                        collision: tile.type === 'water' || tile.type === 'wall'
                    };
                    return acc;
                }, {}) : {}
            })),
            properties: tiledJson.properties || {}
        };

        this.maps.set(mapId, mapData);
        this.generateCollisionMap(mapId);
        return mapData;
    }

    /**
     * Generate collision map from map layers
     */
    private generateCollisionMap(mapId: string): void {
        const mapData = this.maps.get(mapId);
        if (!mapData) return;

        const collisionMap: number[][] = [];
        
        // Initialize collision map with all walkable (0)
        for (let y = 0; y < mapData.height; y++) {
            collisionMap[y] = new Array(mapData.width).fill(0);
        }

        // Check each layer for collision tiles
        mapData.layers.forEach(layer => {
            if (layer.type === 'tilelayer' && layer.data) {
                layer.data.forEach((tileId, index) => {
                    if (tileId === 0) return; // Empty tile

                    const x = index % mapData.width;
                    const y = Math.floor(index / mapData.width);

                    // Find the tileset for this tile
                    const tileset = mapData.tilesets.find(ts => 
                        tileId >= ts.firstGid && tileId < ts.firstGid + ts.tileCount
                    );

                    if (tileset) {
                        const localTileId = tileId - tileset.firstGid;
                        const tileProps = tileset.tiles?.[localTileId];
                        
                        // Set collision based on tile properties or layer name
                        if (tileProps?.collision || 
                            tileProps?.type === 'water' || 
                            tileProps?.type === 'wall' ||
                            layer.name.toLowerCase().includes('wall') ||
                            layer.name.toLowerCase().includes('collision')) {
                            collisionMap[y][x] = 1;
                        }
                    }
                });
            }
        });

        this.collisionMaps.set(mapId, collisionMap);
    }

    /**
     * Get map data
     */
    getMap(mapId: string): MapData | undefined {
        return this.maps.get(mapId);
    }

    /**
     * Get collision map
     */
    getCollisionMap(mapId: string): number[][] | undefined {
        return this.collisionMaps.get(mapId);
    }

    /**
     * Check if a tile position is walkable
     */
    isTileWalkable(mapId: string, x: number, y: number): boolean {
        const collisionMap = this.collisionMaps.get(mapId);
        const mapData = this.maps.get(mapId);
        
        if (!collisionMap || !mapData) return false;

        // Check bounds
        if (x < 0 || x >= mapData.width || y < 0 || y >= mapData.height) {
            return false;
        }

        // Check collision map
        return collisionMap[y][x] === 0;
    }

    /**
     * Convert pixel coordinates to tile coordinates
     */
    pixelToTile(mapId: string, pixelX: number, pixelY: number): { tileX: number; tileY: number } {
        const mapData = this.maps.get(mapId);
        if (!mapData) return { tileX: 0, tileY: 0 };

        return {
            tileX: Math.floor(pixelX / mapData.tileWidth),
            tileY: Math.floor(pixelY / mapData.tileHeight)
        };
    }

    /**
     * Convert tile coordinates to pixel coordinates
     */
    tileToPixel(mapId: string, tileX: number, tileY: number): { pixelX: number; pixelY: number } {
        const mapData = this.maps.get(mapId);
        if (!mapData) return { pixelX: 0, pixelY: 0 };

        return {
            pixelX: tileX * mapData.tileWidth,
            pixelY: tileY * mapData.tileHeight
        };
    }

    /**
     * Get all loaded map IDs
     */
    getLoadedMaps(): string[] {
        return Array.from(this.maps.keys());
    }
} 