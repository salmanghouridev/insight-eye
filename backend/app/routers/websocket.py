from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.connection_manager import manager
from app.services.session_service import session_service
from app.schemas.metrics import FrameMetricsSchema
from app.db.session import AsyncSessionLocal
import json

router = APIRouter(tags=["websockets"])

@router.websocket("/ws/gaze/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    role: str = Query("dashboard", description="Client role: 'tracker' or 'dashboard'")
):
    """
    WebSocket endpoint for real-time gaze metric streaming.
    - Trackers stream metrics to the server, which validates and stores them.
    - Observer Dashboards connect to receive live broadcasts of those metrics.
    """
    await manager.connect(websocket, session_id, role)
    try:
        while True:
            # Await data packet from client
            data = await websocket.receive_text()
            
            if role == "tracker":
                try:
                    metrics_dict = json.loads(data)
                    # Validate payload via Pydantic Schema
                    metrics = FrameMetricsSchema(**metrics_dict)
                    
                    # Store frame log into database asynchronously
                    async with AsyncSessionLocal() as db:
                        await session_service.add_frame_metric(db, session_id, metrics)
                    
                    # Broadcast in real-time to observing dashboard clients
                    await manager.broadcast_to_dashboards(metrics_dict, session_id)
                except Exception as e:
                    # Report malformed JSON packets back to tracker
                    await websocket.send_json({"status": "error", "message": f"Validation failed: {str(e)}"})
            else:
                # Dashboard clients are write-inhibited observers
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id, role)
