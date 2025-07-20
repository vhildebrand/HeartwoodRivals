// client/src/config.ts
class AppConfig {
    private static instance: AppConfig;
    private config: {
        API_BASE_URL: string;
        WEBSOCKET_URL: string;
        HOST: string;
    };

    private constructor() {
        this.config = this.initializeConfig();
    }

    public static getInstance(): AppConfig {
        if (!AppConfig.instance) {
            AppConfig.instance = new AppConfig();
        }
        return AppConfig.instance;
    }

    private initializeConfig() {
        // Get the current host from window location
        const hostname = window.location.hostname;
        
        // For localhost/development, allow override via environment or use localhost
        // For production/network access, use the actual hostname
        const host = hostname === 'localhost' ? 
            (import.meta.env.VITE_HOST || 'localhost') : 
            hostname;

        // API runs on port 3000, WebSocket on port 2567
        const apiPort = import.meta.env.VITE_API_PORT || '3000';
        const wsPort = import.meta.env.VITE_WS_PORT || '2567';

        return {
            HOST: host,
            API_BASE_URL: `http://${host}:${apiPort}`,
            WEBSOCKET_URL: `ws://${host}:${wsPort}`
        };
    }

    public get API_BASE_URL(): string {
        return this.config.API_BASE_URL;
    }

    public get WEBSOCKET_URL(): string {
        return this.config.WEBSOCKET_URL;
    }

    public get HOST(): string {
        return this.config.HOST;
    }

    // Method to get full API URL for a specific endpoint
    public getApiUrl(endpoint: string): string {
        // Remove leading slash if present to avoid double slashes
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        return `${this.API_BASE_URL}/${cleanEndpoint}`;
    }

    // Debug method to log current configuration
    public logConfig(): void {
        console.log('🌐 [CONFIG] Current configuration:', {
            HOST: this.HOST,
            API_BASE_URL: this.API_BASE_URL,
            WEBSOCKET_URL: this.WEBSOCKET_URL
        });
    }
}

export default AppConfig; 