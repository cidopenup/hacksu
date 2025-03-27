from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import numpy as np
import cv2
import base64
from PIL import Image
import io
import tensorflow as tf

# Initialize Flask app with static folder
app = Flask(__name__, static_folder='static')
CORS(app)

# Global variable to store the model
model = None

def preprocess_image(image_bytes, target_size=(256, 256)):
    """Preprocess the input image"""
    try:
        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Resize image
        img = cv2.resize(img, target_size)
        
        # Normalize image
        img = img.astype(np.float32) / 255.0
        
        # Add batch dimension
        img = np.expand_dims(img, axis=0)
        
        return img
    except Exception as e:
        print(f"Error preprocessing image: {str(e)}")
        return None

def encode_mask_to_base64(mask):
    """Convert mask to base64 string"""
    try:
        # Convert mask to uint8
        mask = (mask * 255).astype(np.uint8)
        
        # Convert to PIL Image
        mask_image = Image.fromarray(mask)
        
        # Convert to base64
        buffered = io.BytesIO()
        mask_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return img_str
    except Exception as e:
        print(f"Error encoding mask: {str(e)}")
        return None

@app.route('/')
def serve_index():
    """Serve the main index.html file"""
    return send_from_directory('static', 'index.html')

@app.route('/css/<path:filename>')
def serve_css(filename):
    """Serve CSS files"""
    return send_from_directory('static', 'styles.css')

@app.route('/js/<path:filename>')
def serve_js(filename):
    """Serve JavaScript files"""
    return send_from_directory('static', 'script.js')

@app.route('/api/analyze-area', methods=['POST'])
def analyze_area():
    """Analyze a selected area for deforestation"""
    try:
        data = request.get_json()
        if not data or 'coordinates' not in data:
            return jsonify({'error': 'No coordinates provided'}), 400

        # Generate simulated detection results
        results = {
            'deforestation_percentage': round(np.random.uniform(0, 100), 2),
            'risk_level': np.random.choice(['Low', 'Medium', 'High']),
            'detection_type': np.random.choice(['Clear-cut', 'Selective logging', 'Forest degradation']),
            'confidence': round(np.random.uniform(0.7, 0.95), 2),
            'timestamp': '2024-03-27T12:00:00Z'
        }

        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/detect-deforestation', methods=['POST'])
def detect_deforestation():
    """Detect deforestation in uploaded image"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Read and preprocess image
        image_bytes = file.read()
        processed_image = preprocess_image(image_bytes)
        
        if processed_image is None:
            return jsonify({'error': 'Failed to process image'}), 400

        # For now, return simulated results since we don't have the model
        results = {
            'deforestation_percentage': round(np.random.uniform(0, 100), 2),
            'mask': encode_mask_to_base64(np.random.rand(256, 256)),
            'confidence': round(np.random.uniform(0.7, 0.95), 2),
            'detection_type': np.random.choice(['Clear-cut', 'Selective logging', 'Forest degradation'])
        }

        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Print current working directory and list files
    print(f"Current working directory: {os.getcwd()}")
    print("Files in directory:")
    for file in os.listdir('.'):
        print(f"- {file}")
    
    app.run(debug=True, port=5000) 