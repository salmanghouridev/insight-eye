from fastapi import WebSocket
from typing import Dict, Set

class ConnectionManager:
    def __init__(self):
        # Maps session_id -> { "tracker": Set[WebSocket], "dashboard": Set[WebSocket] }
        self.active_connections: Dict[str, Dict[str, Set[WebSocket]]] = {}

    async def connect(self, websocket: WebSocket, session_id: str, role: str):
        """Accepts connection and maps client by session and role (tracker/dashboard)."""
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = {"tracker": set(), "dashboard": set()}
        
        role_key = role if role in ["tracker", "dashboard"] else "dashboard"
        self.active_connections[session_id][role_key].add(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str, role: str):
        """Removes connection from active session pools and sweeps clean if empty."""
        if session_id in self.active_connections:
            role_key = role if role in ["tracker", "dashboard"] else "dashboard"
            if websocket in self.active_connections[session_id][role_key]:
                self.active_connections[session_id][role_key].remove(websocket)
            
            # Garbage collect clean-up
            if not self.active_connections[session_id]["tracker"] and not self.active_connections[session_id]["dashboard"]:
                del self.active_connections[session_id]

    async def broadcast_to_dashboards(self, data: dict, session_id: str):
        """Sends real-time frame payloads to all dashboards monitoring this session ID."""
        if session_id in self.active_connections:
            dashboards = self.active_connections[session_id]["dashboard"]
            for connection in list(dashboards):
                try:
                    await connection.send_json(data)
                except Exception:
                    # Clean up broken pipes silently
                    self.disconnect(connection, session_id, "dashboard")

# Global singleton instance
manager = ConnectionManager()
