import { Room, Client } from "colyseus";

export class HeartwoodRoom extends Room {
    maxClients = 10;

    onCreate(options: any) {
        console.log("HeartwoodRoom created!", options);
        
        // Initialize room state
        this.setState({
            players: {},
            timestamp: Date.now()
        });
    }

    onJoin(client: Client, options: any) {
        console.log(`Player ${client.sessionId} joined the heartwood_room`);
        
        // Add player to state
        this.state.players[client.sessionId] = {
            id: client.sessionId,
            x: Math.random() * 480, // Random starting position
            y: Math.random() * 320,
            timestamp: Date.now()
        };
    }

    onLeave(client: Client, consented: boolean) {
        console.log(`Player ${client.sessionId} left the heartwood_room`);
        
        // Remove player from state
        delete this.state.players[client.sessionId];
    }

    onDispose() {
        console.log("HeartwoodRoom disposed");
    }
} 