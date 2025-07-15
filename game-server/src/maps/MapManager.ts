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
    
    // Collision cache to avoid repeated lookups
    private collisionCache: Map<string, Map<string, boolean>> = new Map();
    private cacheHits: number = 0;
    private cacheMisses: number = 0;

    private constructor() {}

    public static getInstance(): MapManager {
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
        
        // Initialize collision cache for this map
        this.collisionCache.set(mapId, new Map());
        
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
     * Check if a tile position is walkable with caching
     */
    isTileWalkable(mapId: string, x: number, y: number): boolean {
        const cacheKey = `${x},${y}`;
        const mapCache = this.collisionCache.get(mapId);
        
        if (mapCache && mapCache.has(cacheKey)) {
            this.cacheHits++;
            return mapCache.get(cacheKey)!;
        }

        this.cacheMisses++;
        const collisionMap = this.collisionMaps.get(mapId);
        const mapData = this.maps.get(mapId);
        
        if (!collisionMap || !mapData) {
            if (mapCache) mapCache.set(cacheKey, false);
            return false;
        }

        // Check bounds - ensure within map boundaries
        if (x < 0 || x >= mapData.width || y < 0 || y >= mapData.height) {
            if (mapCache) mapCache.set(cacheKey, false);
            return false;
        }

        // Check collision map
        const isWalkable = collisionMap[y][x] === 0;
        if (mapCache) mapCache.set(cacheKey, isWalkable);
        
        return isWalkable;
    }

    /**
     * Batch check multiple tiles for walkability (optimized for path finding)
     */
    areMultipleTilesWalkable(mapId: string, tiles: Array<{x: number, y: number}>): boolean[] {
        const results: boolean[] = [];
        const mapCache = this.collisionCache.get(mapId);
        const collisionMap = this.collisionMaps.get(mapId);
        const mapData = this.maps.get(mapId);
        
        if (!collisionMap || !mapData) {
            return tiles.map(() => false);
        }

        tiles.forEach(tile => {
            const cacheKey = `${tile.x},${tile.y}`;
            
            if (mapCache && mapCache.has(cacheKey)) {
                this.cacheHits++;
                results.push(mapCache.get(cacheKey)!);
            } else {
                this.cacheMisses++;
                
                // Check bounds
                if (tile.x < 0 || tile.x >= mapData.width || tile.y < 0 || tile.y >= mapData.height) {
                    results.push(false);
                    if (mapCache) mapCache.set(cacheKey, false);
                } else {
                    const isWalkable = collisionMap[tile.y][tile.x] === 0;
                    results.push(isWalkable);
                    if (mapCache) mapCache.set(cacheKey, isWalkable);
                }
            }
        });

        return results;
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { hits: number, misses: number, hitRate: number } {
        const total = this.cacheHits + this.cacheMisses;
        return {
            hits: this.cacheHits,
            misses: this.cacheMisses,
            hitRate: total > 0 ? (this.cacheHits / total) * 100 : 0
        };
    }

    /**
     * Clear collision cache (useful for debugging or memory management)
     */
    clearCollisionCache(mapId?: string): void {
        if (mapId) {
            this.collisionCache.get(mapId)?.clear();
        } else {
            this.collisionCache.clear();
        }
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }

    /**
     * Check if a pixel position is within map bounds
     */
    isPixelInBounds(mapId: string, pixelX: number, pixelY: number): boolean {
        const mapData = this.maps.get(mapId);
        if (!mapData) return false;

        const mapPixelWidth = mapData.width * mapData.tileWidth;
        const mapPixelHeight = mapData.height * mapData.tileHeight;

        return pixelX >= 0 && pixelX < mapPixelWidth && pixelY >= 0 && pixelY < mapPixelHeight;
    }

    /**
     * Clamp pixel coordinates to map bounds
     */
    clampPixelToBounds(mapId: string, pixelX: number, pixelY: number): { pixelX: number; pixelY: number } {
        const mapData = this.maps.get(mapId);
        if (!mapData) return { pixelX: 0, pixelY: 0 };

        const mapPixelWidth = mapData.width * mapData.tileWidth;
        const mapPixelHeight = mapData.height * mapData.tileHeight;

        return {
            pixelX: Math.max(0, Math.min(pixelX, mapPixelWidth - 1)),
            pixelY: Math.max(0, Math.min(pixelY, mapPixelHeight - 1))
        };
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