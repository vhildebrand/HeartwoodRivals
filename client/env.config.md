# Network Configuration Guide

To allow other devices on your local WiFi network to connect to the game:

## Option 1: Automatic Detection (Recommended)
The client will automatically detect the hostname from your browser's address bar. Simply access the game using your machine's IP address instead of localhost.

## Option 2: Manual Configuration
Create a `.env.local` file in the client directory with your machine's IP:

```env
# Replace 192.168.1.100 with your actual machine's IP address
VITE_HOST=192.168.1.100
VITE_API_PORT=3000
VITE_WS_PORT=2567
```

## Finding Your Machine's IP Address

### On macOS/Linux:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### On Windows:
```cmd
ipconfig | findstr "IPv4"
```

### Alternative method:
```bash
hostname -I
```

## Usage
1. Find your machine's IP address (e.g., 192.168.1.100)
2. Other devices on your network can access the game at:
   - http://192.168.1.100:5173

The client will automatically connect to the correct API and WebSocket servers. 