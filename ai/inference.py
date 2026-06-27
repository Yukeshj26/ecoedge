import os
import numpy as np
import joblib
from tensorflow.keras.models import load_model

# Get current script directory
script_dir = os.path.dirname(os.path.abspath(__file__))

# Global model and scaler instances
_lstm_model = None
_lstm_scaler = None

def init_model():
    """Load Keras model and scaler if not already loaded."""
    global _lstm_model, _lstm_scaler
    if _lstm_model is None or _lstm_scaler is None:
        model_path = os.path.join(script_dir, "lstm_power_model.keras")
        scaler_path = os.path.join(script_dir, "lstm_scaler.pkl")
        
        print(f"[Inference] Loading Keras LSTM model from: {model_path}")
        _lstm_model = load_model(model_path)
        
        print(f"[Inference] Loading MinMaxScaler from: {scaler_path}")
        _lstm_scaler = joblib.load(scaler_path)
        print("[Inference] Model and scaler loaded successfully.")

def predict_power(sequence):
    """
    Predict next power value based on a 3D sequence of 48 timesteps and 10 features.
    sequence: array-like of shape (48, 10)
    """
    init_model()
    
    # Format sequence as 2D numpy array: (48, 10)
    seq_arr = np.array(sequence).astype(float)
    if seq_arr.shape != (48, 10):
        raise ValueError(f"[Inference] Expected input sequence shape (48, 10), got {seq_arr.shape}")
    
    # Scale sequence using the fitted 10-feature MinMaxScaler
    seq_norm = _lstm_scaler.transform(seq_arr)
    
    # Expand dims to match Keras input: (1, 48, 10)
    seq_norm = np.expand_dims(seq_norm, axis=0)
    
    # Run model prediction
    pred_norm = _lstm_model.predict(seq_norm, verbose=0)[0, 0]
    
    # Inverse transform to get predicted power in Watts
    # MinMaxScaler requires a 2D array of shape (N, 10). 
    # We place the predicted normalized power in the target column (index 0).
    dummy = np.zeros((1, 10))
    dummy[0, 0] = pred_norm
    predicted_power = _lstm_scaler.inverse_transform(dummy)[0, 0]
    
    # Clamp to ensure a realistic non-zero value
    return max(1.0, float(predicted_power))
