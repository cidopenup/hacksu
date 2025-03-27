import tensorflow as tf
import numpy as np
from model import unet_model
import os
from datetime import datetime

# compile model architecture
def dice_coef(y_true, y_pred, smooth=1):
    intersection = K.sum(y_true * y_pred, axis=[1,2,3])
    union = K.sum(y_true, axis=[1,2,3]) + K.sum(y_pred, axis=[1,2,3])
    return K.mean( (2. * intersection + smooth) / (union + smooth), axis=0)

def dice_loss(in_gt, in_pred):
    return 1-dice_coef(in_gt, in_pred)

def train_model(train_dataset, valid_dataset, epochs=40, batch_size=32):
    """Train the deforestation detection model"""
    # Create model
    model = unet_model(1)
    
    # Compile model
    model.compile(optimizer='adam',
                  loss=dice_loss,
                  metrics=[dice_coef, 'binary_accuracy'])
    
    # Create model directory if it doesn't exist
    model_dir = os.path.join(os.path.dirname(__file__), 'saved_models')
    if not os.path.exists(model_dir):
        os.makedirs(model_dir)
    
    # Define callbacks
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_path = os.path.join(model_dir, f'deforestation_model_{timestamp}')
    
    callbacks = [
        # Save best model weights
        tf.keras.callbacks.ModelCheckpoint(
            filepath=os.path.join(model_dir, 'best_weights.h5'),
            save_best_only=True,
            monitor='val_binary_accuracy',
            mode='max'
        ),
        # Early stopping
        tf.keras.callbacks.EarlyStopping(
            patience=4,
            restore_best_weights=True,
            monitor='val_binary_accuracy'
        ),
        # TensorBoard logging
        tf.keras.callbacks.TensorBoard(
            log_dir=os.path.join(model_dir, 'logs', timestamp),
            histogram_freq=1
        )
    ]
    
    # Calculate steps per epoch
    TRAIN_LENGTH = sum(1 for _ in train_dataset)
    STEPS_PER_EPOCH = TRAIN_LENGTH // batch_size
    
    # Train model
    history = model.fit(
        train_dataset, 
        epochs=epochs,
        steps_per_epoch=STEPS_PER_EPOCH,
        validation_data=valid_dataset,
        callbacks=callbacks
    )
    
    # Save the entire model (architecture + weights + optimizer state)
    model.save(model_path)
    
    # Save model as TensorFlow SavedModel format (for deployment)
    tf.saved_model.save(model, os.path.join(model_dir, 'saved_model'))
    
    # Save model as TensorFlow Lite format
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    tflite_model = converter.convert()
    with open(os.path.join(model_dir, 'model.tflite'), 'wb') as f:
        f.write(tflite_model)
    
    return model, history

if __name__ == "__main__":
    # Load and preprocess your data here
    # train_dataset, valid_dataset = load_and_preprocess_data()
    
    # Train the model
    model, history = train_model(train_dataset, valid_dataset)
    
    print("Training completed! Model saved in 'saved_models' directory.")

# print model
model.summary()

# define visualization params
def visualize(display_list):
    plt.figure(figsize=(12,12))
    title = ['Input Image', 'True Mask', 'Predicted Mask']
    for i in range(len(display_list)):
        plt.subplot(1, len(display_list), i+1)
        plt.title(title[i])
        plt.imshow(tf.keras.preprocessing.image.array_to_img(display_list[i]))
        plt.axis('off')
    plt.show()

# show some predictions before training
def show_predictions(sample_image, sample_mask):
    pred_mask = model.predict(sample_image[tf.newaxis, ...])
    pred_mask = pred_mask.reshape(img_size[0],img_size[1],1)
    visualize([sample_image, sample_mask, pred_mask])
	
for i in range(5):
    for images, masks in train_dataset.take(i):
        for img, mask in zip(images, masks):
            sample_image = img
            sample_mask = mask
            show_predictions(sample_image, sample_mask)
            break

# predict on test data
for i in range(8):
    for images, masks in test_dataset.take(i):
        for img, mask in zip(images, masks):
            tsample_image = img
            tsample_mask = mask
            show_predictions(tsample_image, tsample_mask)
            break