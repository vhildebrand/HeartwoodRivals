import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "http";
import { HeartwoodRoom } from "./rooms/HeartwoodRoom";

const port = Number(process.env.PORT) || 2567;

const gameServer = new Server({
    transport: new WebSocketTransport({
        server: createServer()
    })
});

// Register the heartwood_room
gameServer.define('heartwood_room', HeartwoodRoom);

gameServer.listen(port);

console.log(`Game Server running on port ${port}!`);
