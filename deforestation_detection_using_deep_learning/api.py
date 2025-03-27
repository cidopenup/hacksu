from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tensorflow as tf
import numpy as np
import cv2
import io
from PIL import Image
import os
from typing import Dict
import base64

app = FastAPI(
    title="Deforestation Detection API",
    description="API for detecting deforestation in satellite imagery using deep learning",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Global variable for model
model = None

def load_model():
    """Load the trained model"""
    global model
    model_dir = os.path.join(os.path.dirname(__file__), 'saved_models')
    saved_model_path = os.path.join(model_dir, 'saved_model')
    
    if os.path.exists(saved_model_path):
        model = tf.saved_model.load(saved_model_path)
    else:
        raise HTTPException(
            status_code=500,
            detail="Model not found. Please ensure the model is properly trained and saved."
        )

def preprocess_image(image_bytes: bytes, target_size=(256, 256)):
    """Preprocess the input image for prediction"""
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Could not decode image")
        
        # Convert BGR to RGB
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Resize image
        img = cv2.resize(img, target_size)
        
        # Normalize
        img = img / 255.0
        
        # Add batch dimension
        img = np.expand_dims(img, axis=0)
        
        return img
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error processing image: {str(e)}"
        )

def encode_mask_to_base64(mask: np.ndarray) -> str:
    """Convert numpy array mask to base64 string"""
    # Convert to uint8
    mask_uint8 = (mask * 255).astype(np.uint8)
    
    # Convert to PIL Image
    mask_img = Image.fromarray(mask_uint8)
    
    # Save to bytes
    buffer = io.BytesIO()
    mask_img.save(buffer, format="PNG")
    
    # Convert to base64
    mask_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return mask_base64

@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    load_model()

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Welcome to the Deforestation Detection API"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> Dict:
    """
    Predict deforestation in the uploaded image
    
    Parameters:
    - file: Image file (supported formats: PNG, JPG, JPEG, TIF, TIFF)
    
    Returns:
    - prediction: Dictionary containing deforestation percentage and mask
    """
    try:
        # Read image file
        contents = await file.read()
        
        # Preprocess image
        processed_image = preprocess_image(contents)
        
        # Make prediction
        prediction = model(processed_image)
        
        # Convert prediction to binary mask
        predicted_mask = (prediction[0, :, :, 0] > 0.5).numpy()
        
        # Calculate deforestation percentage
        deforestation_percentage = float((np.sum(predicted_mask) / predicted_mask.size) * 100)
        
        # Convert mask to base64 for frontend display
        mask_base64 = encode_mask_to_base64(predicted_mask)
        
        return {
            "deforestation_percentage": deforestation_percentage,
            "mask_base64": mask_base64,
            "status": "success"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing request: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 