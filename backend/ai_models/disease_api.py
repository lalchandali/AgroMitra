# ============================================================
#   AgroMitra — Disease Detection API Endpoint
#   Add this to your existing main.py
# ============================================================
#
#   1. pip install python-multipart pillow
#   2. Copy এই routes গুলো main.py-তে add করো
#
# ============================================================

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import json
import io
import os
from PIL import Image

# ── Disease Classes (from training) ──────────────────────────
DISEASE_CLASSES = {
    'Tomato___Bacterial_spot':           {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Copper-based bactericide spray every 7 days'},
    'Tomato___Early_blight':             {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Remove infected leaves, apply mancozeb fungicide'},
    'Tomato___Late_blight':              {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'High',   'treatment': 'Apply chlorothalonil immediately, remove infected plants'},
    'Tomato___Leaf_Mold':                {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Improve ventilation, apply copper fungicide'},
    'Tomato___Septoria_leaf_spot':       {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Remove lower leaves, apply mancozeb weekly'},
    'Tomato___Spider_mites':             {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Apply neem oil or miticide spray'},
    'Tomato___Target_Spot':              {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Apply azoxystrobin fungicide'},
    'Tomato___Tomato_Yellow_Leaf_Curl_Virus': {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'High', 'treatment': 'Remove infected plants, control whitefly population'},
    'Tomato___Tomato_mosaic_virus':      {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'High',   'treatment': 'Remove infected plants, use virus-resistant varieties'},
    'Tomato___healthy':                  {'crop': 'Tomato', 'status': 'Healthy',  'severity': 'None',   'treatment': 'Your plant is healthy! No treatment needed.'},
    'Potato___Early_blight':             {'crop': 'Potato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Apply mancozeb or chlorothalonil every 10 days'},
    'Potato___Late_blight':              {'crop': 'Potato', 'status': 'Diseased', 'severity': 'High',   'treatment': 'Apply metalaxyl immediately, remove affected leaves'},
    'Potato___healthy':                  {'crop': 'Potato', 'status': 'Healthy',  'severity': 'None',   'treatment': 'Your plant is healthy! No treatment needed.'},
    'Rice___Brown_Spot':                 {'crop': 'Rice',   'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Apply tricyclazole or isoprothiolane fungicide'},
    'Rice___Leaf_Blast':                 {'crop': 'Rice',   'status': 'Diseased', 'severity': 'High',   'treatment': 'Apply tricyclazole at tillering and heading stage'},
    'Rice___Neck_Blast':                 {'crop': 'Rice',   'status': 'Diseased', 'severity': 'High',   'treatment': 'Apply carbendazim fungicide at heading'},
    'Rice___healthy':                    {'crop': 'Rice',   'status': 'Healthy',  'severity': 'None',   'treatment': 'Your plant is healthy! No treatment needed.'},
    'Corn_(maize)___Common_rust_':       {'crop': 'Corn',   'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Apply mancozeb or trifloxystrobin fungicide'},
    'Corn_(maize)___Northern_Leaf_Blight': {'crop': 'Corn',  'status': 'Diseased', 'severity': 'High',   'treatment': 'Apply azoxystrobin at tasseling stage'},
    'Corn_(maize)___healthy':            {'crop': 'Corn',   'status': 'Healthy',  'severity': 'None',   'treatment': 'Your plant is healthy! No treatment needed.'},
}

IMG_SIZE = 224
MODEL_PATH = 'models/disease_detection_final.keras'
IDX_PATH = 'models/idx_to_class.json'

# Load model once at startup
_disease_model = None
_idx_to_class_map = None


def load_disease_model():
    global _disease_model, _idx_to_class_map

    try:
        import tensorflow as tf
        if os.path.exists(MODEL_PATH):
            _disease_model = tf.keras.models.load_model(MODEL_PATH)
            print(f"  ✅ Disease model loaded: {MODEL_PATH}")
        else:
            print(f"  ⚠️  Disease model not found at {MODEL_PATH}")
            print(f"     Run disease_detection.py first to train!")
    except Exception as e:
        print(f"  ⚠️  Could not load disease model: {e}")

    try:
        if os.path.exists(IDX_PATH):
            with open(IDX_PATH) as f:
                _idx_to_class_map = json.load(f)
    except:
        pass


# ── FastAPI App ───────────────────────────────────────────────
app = FastAPI(
    title="🌿 AgroMitra Disease Detection API",
    description="AI-powered plant disease detection for Bangladesh farmers",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"],
    allow_headers=["*"], allow_credentials=True
)


@app.on_event("startup")
async def startup_event():
    # Load model in background so startup isn't blocked by heavy TF import
    try:
        import threading
        threading.Thread(target=load_disease_model, daemon=True).start()
    except Exception:
        # Fallback to synchronous load if threading isn't available
        load_disease_model()


# ── ROOT ─────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "message":   "🌿 AgroMitra Disease Detection API",
        "version":   "1.0.0",
        "endpoints": {
            "detect":     "/api/v1/disease/detect",
            "crops":      "/api/v1/disease/crops",
            "diseases":   "/api/v1/disease/list",
            "health":     "/health",
        }
    }


# ── HEALTH ───────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status":       "healthy",
        "model_loaded": _disease_model is not None,
        "model_path":   MODEL_PATH,
        "num_classes":  len(_idx_to_class_map) if _idx_to_class_map else 0,
    }


# ── DISEASE LIST ─────────────────────────────────────────────
@app.get("/api/v1/disease/list")
async def get_disease_list():
    """সব disease classes এবং treatment দেখাও।"""
    return {
        "diseases": [
            {
                "class":     k,
                "crop":      v['crop'],
                "disease":   k.split('___')[-1].replace('_', ' ') if '___' in k else k,
                "status":    v['status'],
                "severity":  v['severity'],
                "treatment": v['treatment'],
            }
            for k, v in DISEASE_CLASSES.items()
        ],
        "total": len(DISEASE_CLASSES)
    }


# ── CROP LIST ────────────────────────────────────────────────
@app.get("/api/v1/disease/crops")
async def get_supported_crops():
    crops = list(set(v['crop'] for v in DISEASE_CLASSES.values()))
    return {
        "crops":      crops,
        "total_crops": len(crops),
        "supported_diseases": len(DISEASE_CLASSES),
    }


# ── DISEASE DETECTION ────────────────────────────────────────
@app.post("/api/v1/disease/detect")
async def detect_disease(file: UploadFile = File(...)):
    """
    🌿 Plant Disease Detection
    - Leaf image upload করো
    - AI model disease identify করবে
    - Treatment advice দেবে
    """
    # Validate file
    if not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=400, detail="Only image files accepted (jpg, png, jpeg)")

    try:
        # Read and preprocess image
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert('RGB')
        img_resized = img.resize((IMG_SIZE, IMG_SIZE))
        img_array = np.array(img_resized) / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        if _disease_model is None:
            # Model not loaded — return demo response
            return _demo_response(file.filename)

        # Predict
        import tensorflow as tf
        predictions = _disease_model.predict(img_array, verbose=0)[0]
        top_3_idx = np.argsort(predictions)[-3:][::-1]

        results = []
        for idx in top_3_idx:
            class_name = _idx_to_class_map.get(
                str(idx), f'Class_{idx}') if _idx_to_class_map else f'Class_{idx}'
            confidence = float(predictions[idx]) * 100
            disease_info = DISEASE_CLASSES.get(class_name, {
                'crop': 'Unknown', 'status': 'Unknown',
                'severity': 'Unknown', 'treatment': 'Consult an agricultural expert'
            })
            results.append({
                'rank':       len(results) + 1,
                'class_name': class_name,
                'crop':       disease_info['crop'],
                'disease':    class_name.split('___')[-1].replace('_', ' ') if '___' in class_name else class_name,
                'status':     disease_info['status'],
                'severity':   disease_info['severity'],
                'confidence': round(confidence, 2),
                'treatment':  disease_info['treatment'],
            })

        top = results[0]
        return {
            "filename":      file.filename,
            "top_prediction": top,
            "all_predictions": results,
            "summary": {
                "detected_crop":    top['crop'],
                "disease_status":   top['status'],
                "severity":         top['severity'],
                "confidence":       top['confidence'],
                "recommended_action": top['treatment'],
                "urgent":           top['severity'] == 'High' and top['status'] == 'Diseased',
            },
            "model": "MobileNetV2 Transfer Learning",
            "note": "Upload a clear photo of the affected leaf for best results"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Detection failed: {str(e)}")


def _demo_response(filename):
    """Model না থাকলে demo response দাও।"""
    return {
        "filename": filename,
        "top_prediction": {
            "rank": 1, "class_name": "Tomato___Early_blight",
            "crop": "Tomato", "disease": "Early Blight",
            "status": "Diseased", "severity": "Medium",
            "confidence": 87.5,
            "treatment": "Remove infected leaves, apply mancozeb fungicide",
        },
        "summary": {
            "detected_crop": "Tomato", "disease_status": "Diseased",
            "severity": "Medium", "confidence": 87.5,
            "recommended_action": "Remove infected leaves, apply mancozeb fungicide",
            "urgent": False,
        },
        "note": "⚠️ Demo mode — Train disease_detection.py for real predictions",
        "model": "MobileNetV2 Transfer Learning (Demo)"
    }


# ── RUN ──────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
