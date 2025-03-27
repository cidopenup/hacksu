import tensorflow as tf
import numpy as np
import cv2
import matplotlib.pyplot as plt
from model import unet_model
import os
import tkinter as tk
from tkinter import filedialog, messagebox
from PIL import Image, ImageTk

class DeforestationDetectorGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Deforestation Detection System")
        self.root.geometry("800x600")
        
        # Create main frame
        self.main_frame = tk.Frame(self.root, padx=20, pady=20)
        self.main_frame.pack(expand=True, fill='both')
        
        # Title
        title = tk.Label(self.main_frame, text="Deforestation Detection System", 
                        font=('Arial', 20, 'bold'))
        title.pack(pady=20)
        
        # Description
        description = tk.Label(self.main_frame, 
                             text="Upload a satellite image to detect deforestation",
                             font=('Arial', 12))
        description.pack(pady=10)
        
        # Upload button
        self.upload_btn = tk.Button(self.main_frame, text="Upload Image", 
                                  command=self.upload_image,
                                  font=('Arial', 12), padx=20, pady=10)
        self.upload_btn.pack(pady=20)
        
        # Image preview
        self.preview_label = tk.Label(self.main_frame)
        self.preview_label.pack(pady=10)
        
        # Result label
        self.result_label = tk.Label(self.main_frame, text="", font=('Arial', 12))
        self.result_label.pack(pady=10)
        
        # Initialize model
        try:
            self.model = unet_model(1)
            if os.path.exists('model_weights.h5'):
                self.model.load_weights('model_weights.h5')
                print("Model loaded successfully!")
            else:
                messagebox.showwarning("Warning", "Model weights not found. Please ensure 'model_weights.h5' is in the same directory.")
        except Exception as e:
            messagebox.showerror("Error", f"Error loading model: {str(e)}")
    
    def preprocess_image(self, image_path, target_size=(256, 256)):
        """Preprocess the input image for prediction."""
        # Read the image
        img = cv2.imread(image_path, cv2.IMREAD_COLOR)  # Read as color image
        if img is None:
            raise ValueError(f"Could not read image at {image_path}")
        
        # Convert BGR to RGB
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Resize the image
        img = cv2.resize(img, target_size)
        
        # Normalize the image
        img = img / 255.0
        
        # Add batch dimension
        img = np.expand_dims(img, axis=0)
        
        return img
    
    def update_preview(self, image_path):
        """Update the image preview in GUI"""
        # Open and resize image for preview
        image = Image.open(image_path)
        # Calculate new size while maintaining aspect ratio
        display_size = (300, 300)
        image.thumbnail(display_size, Image.Resampling.LANCZOS)
        # Convert to PhotoImage
        photo = ImageTk.PhotoImage(image)
        # Update label
        self.preview_label.configure(image=photo)
        self.preview_label.image = photo  # Keep a reference!
    
    def upload_image(self):
        """Handle image upload and prediction"""
        try:
            # Open file dialog
            file_path = filedialog.askopenfilename(
                title="Select Image",
                filetypes=[("Image files", "*.png *.jpg *.jpeg *.tif *.tiff")]
            )
            
            if file_path:
                # Update preview
                self.update_preview(file_path)
                
                # Preprocess image
                processed_image = self.preprocess_image(file_path)
                
                # Make prediction
                prediction = self.model.predict(processed_image)
                
                # Convert prediction to binary mask
                predicted_mask = (prediction[0, :, :, 0] > 0.5).astype(np.uint8)
                
                # Calculate deforestation percentage
                deforestation_percentage = (np.sum(predicted_mask) / predicted_mask.size) * 100
                
                # Update result label
                self.result_label.config(
                    text=f"Predicted deforestation: {deforestation_percentage:.2f}%"
                )
                
                # Show the prediction visualization in a new window
                plt.figure(figsize=(10, 5))
                plt.subplot(1, 2, 1)
                plt.title('Original Image')
                plt.imshow(processed_image[0])
                plt.axis('off')
                
                plt.subplot(1, 2, 2)
                plt.title('Deforestation Mask')
                plt.imshow(predicted_mask, cmap='gray')
                plt.axis('off')
                
                plt.tight_layout()
                plt.show()
                
        except Exception as e:
            messagebox.showerror("Error", f"Error processing image: {str(e)}")

def main():
    root = tk.Tk()
    app = DeforestationDetectorGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main() 