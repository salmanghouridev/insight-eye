import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import time
import sys
import os
import urllib.request
import csv

# Import our custom feature extractor
from features import EyeFeatureExtractor, FrameMetrics

# Model Configuration
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
MODEL_PATH = "face_landmarker.task"

# Specific landmark indices
LEFT_IRIS_CENTER = 468
RIGHT_IRIS_CENTER = 473

# Eye contours indices for rendering
LEFT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
RIGHT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
LEFT_IRIS_INDICES = [469, 470, 471, 472]
RIGHT_IRIS_INDICES = [474, 475, 476, 477]

def download_model_if_needed():
    """Downloads the face_landmarker.task model file if not present."""
    if not os.path.exists(MODEL_PATH):
        print(f"Downloading MediaPipe Face Landmarker model from:\n{MODEL_URL}...")
        try:
            def report_progress(block_num, block_size, total_size):
                read_so_far = block_num * block_size
                if total_size > 0:
                    percent = min(100, (read_so_far * 100) // total_size)
                    sys.stdout.write(f"\rProgress: {percent}% completed")
                    sys.stdout.flush()
            urllib.request.urlretrieve(MODEL_URL, MODEL_PATH, report_progress)
            print("\nDownload completed successfully.")
        except Exception as e:
            print(f"\nError downloading model: {e}")
            sys.exit(1)

def initialize_landmarker():
    """Initializes the MediaPipe Tasks FaceLandmarker."""
    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
        num_faces=1,
        running_mode=vision.RunningMode.IMAGE
    )
    return vision.FaceLandmarker.create_from_options(options)

def draw_contour(frame, face_landmarks, indices, color, thickness=1):
    """Draws a closed contour (polyline) through landmark indices."""
    h, w, _ = frame.shape
    pts = []
    for idx in indices:
        lm = face_landmarks[idx]
        px = int(lm.x * w)
        py = int(lm.y * h)
        pts.append((px, py))
    pts = np.array(pts, dtype=np.int32)
    cv2.polylines(frame, [pts], isClosed=True, color=color, thickness=thickness, lineType=cv2.LINE_AA)

def draw_tracking_target(frame, center_px, color_outer, color_inner):
    """Draws a custom crosshair and outer ring over an iris center."""
    cv2.circle(frame, center_px, 8, color_outer, 1, cv2.LINE_AA)
    cv2.circle(frame, center_px, 2, color_inner, -1, cv2.LINE_AA)
    x, y = center_px
    cv2.line(frame, (x - 12, y), (x - 5, y), color_outer, 1, cv2.LINE_AA)
    cv2.line(frame, (x + 5, y), (x + 12, y), color_outer, 1, cv2.LINE_AA)
    cv2.line(frame, (x, y - 12), (x, y - 5), color_outer, 1, cv2.LINE_AA)
    cv2.line(frame, (x, y + 5), (x, y + 12), color_outer, 1, cv2.LINE_AA)

def draw_hud_panel(frame, fps, metrics: FrameMetrics, blink_count: int):
    """
    Renders a premium telemetry dashboard overlay including a 2D gaze visualizer grid 
    and a real-time Eye Aspect Ratio (EAR) metric bar.
    """
    # Main dashboard panel dimensions
    px_w, px_h = 320, 210
    overlay = frame.copy()
    cv2.rectangle(overlay, (10, 10), (10 + px_w, 10 + px_h), (15, 15, 15), -1)
    
    alpha = 0.75
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)

    # Cyan border
    cv2.rectangle(frame, (10, 10), (10 + px_w, 10 + px_h), (0, 255, 255), 1)

    # Core Telemetry
    cv2.putText(frame, "INSIGHTEYE ANALYTICS v2.0", (20, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(frame, f"FPS: {fps:.1f}", (20, 50),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(frame, f"Blinks: {blink_count}", (160, 50),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1, cv2.LINE_AA)

    # State classifications
    fixation_color = (0, 255, 0) if metrics.is_fixating else (0, 255, 255)
    fixation_text = "FIXATED" if metrics.is_fixating else "SEARCHING"
    cv2.putText(frame, f"Gaze State: {fixation_text}", (20, 70),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, fixation_color, 1, cv2.LINE_AA)

    saccade_color = (0, 0, 255) if metrics.is_saccade else (150, 150, 150)
    saccade_text = "SACCADE DETECTED" if metrics.is_saccade else "STABLE"
    cv2.putText(frame, f"Motion:     {saccade_text}", (20, 90),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, saccade_color, 1, cv2.LINE_AA)

    # 1. Draw 2D Gaze Visualizer Grid (relative gaze position mapping)
    grid_x, grid_y = 20, 110
    grid_size = 80
    cv2.rectangle(frame, (grid_x, grid_y), (grid_x + grid_size, grid_y + grid_size), (100, 100, 100), 1)
    # Draw center crosshair in the grid
    cv2.line(frame, (grid_x + grid_size // 2, grid_y), (grid_x + grid_size // 2, grid_y + grid_size), (50, 50, 50), 1)
    cv2.line(frame, (grid_x, grid_y + grid_size // 2), (grid_x + grid_size, grid_y + grid_size // 2), (50, 50, 50), 1)

    # Map Gaze coordinates (typically 0.2 to 0.8) to the 2D grid coordinates
    # Horizontal gaze ratio map: Left edge -> 0.3, Right edge -> 0.7
    norm_gx = (metrics.gaze_x - 0.3) / 0.4
    norm_gy = (metrics.gaze_y - 0.3) / 0.4
    
    # Clip normalized ratios
    norm_gx = max(0.0, min(1.0, norm_gx))
    norm_gy = max(0.0, min(1.0, norm_gy))

    dot_x = int(grid_x + norm_gx * grid_size)
    dot_y = int(grid_y + norm_gy * grid_size)
    cv2.circle(frame, (dot_x, dot_y), 4, (0, 255, 255), -1, cv2.LINE_AA)
    
    # Grid label
    cv2.putText(frame, "Gaze Grid (2D)", (grid_x, grid_y + grid_size + 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.3, (150, 150, 150), 1, cv2.LINE_AA)

    # 2. Draw Real-time EAR Meter Bar
    bar_x, bar_y = 120, 130
    bar_w, bar_h = 190, 15
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (50, 50, 50), -1)
    
    # Map EAR to progress bar: EAR ranges roughly from 0.15 (closed) to 0.38 (open)
    ear_ratio = (metrics.ear_avg - 0.15) / 0.23
    ear_ratio = max(0.0, min(1.0, ear_ratio))
    fill_w = int(ear_ratio * bar_w)
    
    # Draw progress bar (Red if closed/blinking, Green if open)
    bar_color = (0, 0, 255) if metrics.is_blink_active else (0, 255, 0)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h), bar_color, -1)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (100, 100, 100), 1)

    cv2.putText(frame, f"Avg EAR: {metrics.ear_avg:.3f}", (bar_x, bar_y + bar_h + 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1, cv2.LINE_AA)

    # Telemetry coordinate printouts
    cv2.putText(frame, f"X: {metrics.gaze_x:.3f} | Y: {metrics.gaze_y:.3f}", (bar_x, bar_y + bar_h + 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(frame, f"Vel: {metrics.gaze_velocity:.2f} u/s", (bar_x, bar_y + bar_h + 45),
                cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 200), 1, cv2.LINE_AA)

def export_to_csv(metrics_list: list, filename: str = "session_metrics.csv"):
    """
    Exports the captured per-frame telemetry to a CSV file.
    """
    if not metrics_list:
        print("No metrics recorded. Skipping CSV export.")
        return

    print(f"\nExporting {len(metrics_list)} frame logs to '{filename}'...")
    try:
        keys = metrics_list[0].to_dict().keys()
        with open(filename, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            for metric in metrics_list:
                writer.writerow(metric.to_dict())
        print(f"CSV export completed. Saved to '{os.path.abspath(filename)}'.")
    except Exception as e:
        print(f"Error saving CSV file: {e}")

def run_tracker():
    download_model_if_needed()
    
    print("==================================================")
    print("           InsightEye Tracker Phase 2 MVP         ")
    print("==================================================")
    print("Initializing MediaPipe Face Landmarker...")
    detector = initialize_landmarker()

    print("Initializing Eye Analytics Engine...")
    extractor = EyeFeatureExtractor(
        ear_threshold=0.22,
        dispersion_threshold=0.08,
        fixation_window_frames=15,
        saccade_velocity_threshold=2.5
    )

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        print("Please check that your webcam is connected and you have granted camera permissions.")
        sys.exit(1)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    print("\nWebcam capture started successfully.")
    print("Press 'q' or 'Esc' in the window to quit.\n")

    prev_time = time.time()
    frame_id = 0
    window_name = "InsightEye Tracker - Phase 2 MVP"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    # Session storage for CSV export
    session_logs = []

    try:
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                print("Error: Blank frame received from webcam.")
                break

            # Timings
            curr_time = time.time()
            fps = 1.0 / (curr_time - prev_time)
            prev_time = curr_time
            frame_id += 1

            frame = cv2.flip(frame, 1)
            img_h, img_w, _ = frame.shape

            # Convert to RGB (required by MediaPipe)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

            # Perform landmark detection
            detection_result = detector.detect(mp_image)

            # Dummy metrics for frames without detections
            metrics = FrameMetrics(
                frame_id=frame_id,
                timestamp=curr_time,
                ear_left=0.0,
                ear_right=0.0,
                ear_avg=0.0,
                is_blink_active=False,
                gaze_x=0.5,
                gaze_y=0.5,
                gaze_velocity=0.0,
                is_fixating=False,
                is_saccade=False
            )

            if detection_result.face_landmarks:
                for face_landmarks in detection_result.face_landmarks:
                    # 1. Process features and update analytics engine
                    metrics = extractor.process_landmarks(frame_id, curr_time, face_landmarks)
                    session_logs.append(metrics)

                    # 2. Draw eye and iris contours
                    draw_contour(frame, face_landmarks, LEFT_EYE_INDICES, (0, 191, 255), 1)
                    draw_contour(frame, face_landmarks, RIGHT_EYE_INDICES, (255, 105, 180), 1)
                    draw_contour(frame, face_landmarks, LEFT_IRIS_INDICES, (0, 255, 255), 1)
                    draw_contour(frame, face_landmarks, RIGHT_IRIS_INDICES, (255, 255, 0), 1)

                    # 3. Draw crosshair targeting points on screen coordinates
                    _, _, left_px, right_px = extractor.extract_iris_centers(face_landmarks, img_w, img_h) if hasattr(extractor, 'extract_iris_centers') else (None, None, None, None)
                    
                    # If helper is not in extractor, compute manually
                    if left_px is None:
                        left_lm = face_landmarks[LEFT_IRIS_CENTER]
                        right_lm = face_landmarks[RIGHT_IRIS_CENTER]
                        left_px = (int(left_lm.x * img_w), int(left_lm.y * img_h))
                        right_px = (int(right_lm.x * img_w), int(right_lm.y * img_h))

                    draw_tracking_target(frame, left_px, (0, 191, 255), (255, 255, 255))
                    draw_tracking_target(frame, right_px, (255, 105, 180), (255, 255, 255))

                    # Print current console telemetry
                    print(f"[Frame {frame_id:04d}] "
                          f"Avg EAR: {metrics.ear_avg:.4f} | "
                          f"Gaze Ratio: ({metrics.gaze_x:.4f}, {metrics.gaze_y:.4f}) | "
                          f"Blinks: {extractor.blink_count}")

            # Draw HUD
            draw_hud_panel(frame, fps, metrics, extractor.blink_count)
            cv2.imshow(window_name, frame)

            # Keyboard triggers
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == 27:
                print("\nQuit signal received via keyboard. Exiting...")
                break

            if cv2.getWindowProperty(window_name, cv2.WND_PROP_VISIBLE) < 1:
                print("\nWindow closed. Exiting...")
                break

    except KeyboardInterrupt:
        print("\nKeyboard Interrupt (Ctrl+C). Exiting...")
    finally:
        # Release capture
        cap.release()
        cv2.destroyAllWindows()
        detector.close()
        print("Webcam released and all windows destroyed.")

        # Print session summary
        summary = extractor.get_session_summary()
        print("\n================ SESSION SUMMARY ================")
        print(f"Total Blinks Detected: {summary['total_blinks']}")
        print(f"Average Blink Duration: {summary['average_blink_duration_sec']} seconds")
        print(f"Max Blink Duration:     {summary['max_blink_duration_sec']} seconds")
        print("=================================================")

        # Export session metrics to CSV
        export_to_csv(session_logs, "session_metrics.csv")

if __name__ == "__main__":
    run_tracker()
