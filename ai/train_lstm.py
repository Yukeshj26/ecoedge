import pandas as pd
import numpy as np
import joblib
import os
from sklearn.preprocessing import MinMaxScaler
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dropout, Dense

# Ensure reproducibility
np.random.seed(42)
tf.random.set_seed(42)

# -------------------------------------------------------------------------
# DATA PREPROCESSING & SEQUENCE GENERATION FUNCTIONS
# -------------------------------------------------------------------------

def preprocess_data(df, target_col="grid_load_demand"):
    """
    Extracts the univariate time series and fits a MinMaxScaler.
    """
    data = df[[target_col]].values.astype(float)
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(data)
    return scaled_data, scaler

def create_sequences(data, sequence_length=30):
    """
    Creates a sliding window dataset for univariate time series forecasting.
    """
    X, y = [], []
    for i in range(len(data) - sequence_length):
        X.append(data[i : i + sequence_length])
        y.append(data[i + sequence_length])
    return np.array(X), np.array(y)

# -------------------------------------------------------------------------
# MODEL ARCHITECTURE AND TRAINING
# -------------------------------------------------------------------------

def build_lstm_model(input_shape):
    """
    Constructs the Keras LSTM model based on user requirements.
    """
    model = Sequential([
        LSTM(64, return_sequences=True, input_shape=input_shape),
        Dropout(0.2),
        LSTM(32),
        Dropout(0.2),
        Dense(1)
    ])
    model.compile(
        loss="mse",
        optimizer="adam",
        metrics=["mae"]
    )
    return model

def train_and_save_model(csv_path="Renewable_energy_dataset.csv", model_path="lstm_power_model.keras", scaler_path="lstm_scaler.pkl", epochs=50, batch_size=32):
    print(f"Loading dataset from {csv_path}...")
    df_raw = pd.read_csv(csv_path)
    
    # Univariate column: grid_load_demand representing power consumption
    scaled_data, scaler = preprocess_data(df_raw, target_col="grid_load_demand")
    
    # Save the MinMaxScaler
    joblib.dump(scaler, scaler_path)
    print(f"Scaler saved to {scaler_path}")
    
    # Create sequences
    sequence_length = 30
    X, y = create_sequences(scaled_data, sequence_length)
    print(f"Generated {X.shape[0]} sequences of shape {X.shape[1:]}")
    
    # Build model
    model = build_lstm_model(input_shape=(sequence_length, 1))
    model.summary()
    
    # Train model with Early Stopping
    from tensorflow.keras.callbacks import EarlyStopping
    early_stopping = EarlyStopping(
        monitor="val_loss",
        patience=8,
        restore_best_weights=True
    )
    
    print("Training Keras LSTM model...")
    model.fit(
        X,
        y,
        epochs=epochs,
        batch_size=batch_size,
        validation_split=0.1,
        callbacks=[early_stopping],
        verbose=1
    )
    
    # Save model
    model.save(model_path)
    print(f"Model saved to {model_path}")
    return model, scaler

# -------------------------------------------------------------------------
# PREDICTION & INVERSE SCALING UTIL FUNCTIONS
# -------------------------------------------------------------------------

def predict_next_timestep(model, sequence_norm):
    """
    Predicts the next timestep normalized value given a normalized sequence of length 30.
    Expects sequence_norm shape to be (30, 1) or (1, 30, 1)
    """
    if len(sequence_norm.shape) == 2:
        sequence_norm = np.expand_dims(sequence_norm, axis=0) # shape (1, 30, 1)
    pred = model.predict(sequence_norm, verbose=0)
    return pred[0, 0]

def inverse_scale(pred_val, scaler):
    """
    Scales a single normalized prediction value back to original scale.
    """
    pred_2d = np.array([[pred_val]])
    return scaler.inverse_transform(pred_2d)[0, 0]

if __name__ == "__main__":
    # Resolve relative paths based on script location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_file = os.path.join(script_dir, "Renewable_energy_dataset.csv")
    model_file = os.path.join(script_dir, "lstm_power_model.keras")
    scaler_file = os.path.join(script_dir, "lstm_scaler.pkl")
    
    train_and_save_model(csv_path=csv_file, model_path=model_file, scaler_path=scaler_file)
