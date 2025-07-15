import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "http";
import { HeartwoodRoom } from "./rooms/HeartwoodRoom";

const port = Number(process.env.PORT) || 2567;

const httpServer = createServer();

const gameServer = new Server({
    transport: new WebSocketTransport({
        server: httpServer
    })
});

// Register the heartwood_room
gameServer.define('heartwood_room', HeartwoodRoom);

// Listen on all interfaces (0.0.0.0) so it's accessible from outside the container
httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Game Server running on port ${port}!`);
});
