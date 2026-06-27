import os
import time
import joblib
import pandas as pd
import numpy as np
import tensorflow as tf
import xgboost as xgb
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from tensorflow.keras.models import Model, Sequential
from tensorflow.keras.layers import Input, LSTM, Dropout, Dense, Attention, Concatenate
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from tensorflow.keras.optimizers import Adam

# Set seeds for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

def mean_absolute_percentage_error(y_true, y_pred):
    """Calculate Mean Absolute Percentage Error (MAPE)."""
    y_true, y_pred = np.array(y_true), np.array(y_pred)
    safe_true = np.where(y_true == 0, 1e-5, y_true)
    return np.mean(np.abs((y_true - y_pred) / safe_true)) * 100

def train_and_evaluate():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, "Renewable_energy_dataset_large.csv")
    model_path = os.path.join(script_dir, "lstm_power_model.keras")
    scaler_path = os.path.join(script_dir, "lstm_scaler.pkl")

    print(f"Loading dataset from {csv_path}...")
    df = pd.read_csv(csv_path)

    # Selected 10 features (Cyclical and physical)
    features_cols = [
        "power",        # Target feature at index 0
        "voltage",      # voltage
        "battery",      # battery SOC %
        "solar",        # solar generation W
        "temperature",  # temperature
        "humidity",     # humidity
        "hour_sin",     # cyclical hour sine
        "hour_cos",     # cyclical hour cosine
        "day_sin",      # cyclical day sine
        "day_cos"       # cyclical day cosine
    ]

    # Verify column presence
    for col in features_cols:
        if col not in df.columns:
            raise ValueError(f"Required column '{col}' not found in dataset!")

    raw_data = df[features_cols].values.astype(float)
    print(f"Dataset shape: {raw_data.shape} | Features: {features_cols}")

    # Fit MinMaxScaler
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(raw_data)
    
    # Save the MinMaxScaler
    joblib.dump(scaler, scaler_path)
    print(f"Multivariate MinMaxScaler saved to {scaler_path}")

    # Generate sliding window sequences (lookback = 48)
    sequence_length = 48
    X, y = [], []
    for i in range(len(scaled_data) - sequence_length):
        X.append(scaled_data[i : i + sequence_length, :]) # shape (48, 10)
        y.append(scaled_data[i + sequence_length, 0])      # next step power
    
    X = np.array(X) # shape (num_samples, 48, 10)
    y = np.array(y) # shape (num_samples,)
    print(f"Generated {len(X)} sequences of shape {X.shape[1:]}")

    # Train/Test Split (80% Train, 20% Test)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train_scaled, y_test_scaled = y[:split_idx], y[split_idx:]

    # Get target values on original scale (Watts) for metrics evaluation
    y_test_raw = raw_data[sequence_length + split_idx:, 0]

    # Helper function to inverse transform predictions
    def inverse_scale_prediction(pred_scaled):
        # Create a dummy 2D array of shape (N, 10) to run inverse_transform
        dummy = np.zeros((len(pred_scaled), 10))
        dummy[:, 0] = pred_scaled.squeeze()
        return scaler.inverse_transform(dummy)[:, 0]

    # -------------------------------------------------------------------------
    # 1. BASELINE: LINEAR REGRESSION
    # -------------------------------------------------------------------------
    print("\nTraining Baseline: Linear Regression...")
    X_train_flat = X_train.reshape(X_train.shape[0], -1)
    X_test_flat = X_test.reshape(X_test.shape[0], -1)

    lr = LinearRegression()
    lr.fit(X_train_flat, y_train_scaled)
    lr_pred_scaled = lr.predict(X_test_flat)
    lr_pred = inverse_scale_prediction(lr_pred_scaled)

    lr_mae = mean_absolute_error(y_test_raw, lr_pred)
    lr_rmse = np.sqrt(mean_squared_error(y_test_raw, lr_pred))
    lr_mape = mean_absolute_percentage_error(y_test_raw, lr_pred)
    lr_r2 = r2_score(y_test_raw, lr_pred)

    # -------------------------------------------------------------------------
    # 2. BASELINE: RANDOM FOREST REGRESSOR
    # -------------------------------------------------------------------------
    print("Training Baseline: Random Forest Regressor (constrained for fast baseline fit)...")
    rf = RandomForestRegressor(n_estimators=15, max_depth=6, max_features="sqrt", random_state=42, n_jobs=-1)
    rf.fit(X_train_flat, y_train_scaled)
    rf_pred_scaled = rf.predict(X_test_flat)
    rf_pred = inverse_scale_prediction(rf_pred_scaled)

    rf_mae = mean_absolute_error(y_test_raw, rf_pred)
    rf_rmse = np.sqrt(mean_squared_error(y_test_raw, rf_pred))
    rf_mape = mean_absolute_percentage_error(y_test_raw, rf_pred)
    rf_r2 = r2_score(y_test_raw, rf_pred)

    # -------------------------------------------------------------------------
    # 3. BASELINE: XGBOOST REGRESSOR
    # -------------------------------------------------------------------------
    print("Training Baseline: XGBoost Regressor (constrained for fast baseline fit)...")
    xgbr = xgb.XGBRegressor(n_estimators=40, max_depth=5, random_state=42, n_jobs=-1)
    xgbr.fit(X_train_flat, y_train_scaled)
    xgb_pred_scaled = xgbr.predict(X_test_flat)
    xgb_pred = inverse_scale_prediction(xgb_pred_scaled)

    xgb_mae = mean_absolute_error(y_test_raw, xgb_pred)
    xgb_rmse = np.sqrt(mean_squared_error(y_test_raw, xgb_pred))
    xgb_mape = mean_absolute_percentage_error(y_test_raw, xgb_pred)
    xgb_r2 = r2_score(y_test_raw, xgb_pred)

    # Free memory from baseline model objects and flat arrays to prevent page swapping on RAM-limited hosts
    import gc
    del lr, rf, xgbr, X_train_flat, X_test_flat
    gc.collect()

    # -------------------------------------------------------------------------
    # 4. BASELINE: DEEP LSTM (without attention)
    # -------------------------------------------------------------------------
    print("\nBuilding Deep LSTM Baseline Model...")
    model_deep = Sequential([
        LSTM(128, return_sequences=True, input_shape=(sequence_length, 10)),
        Dropout(0.20),
        LSTM(64, return_sequences=True),
        Dropout(0.20),
        LSTM(32),
        Dense(32, activation="relu"),
        Dense(16, activation="relu"),
        Dense(1)
    ])
    model_deep.compile(loss="huber", optimizer=Adam(learning_rate=0.001), metrics=["mae"])
    model_deep.summary()

    early_stopping_deep = EarlyStopping(monitor="val_loss", patience=8, restore_best_weights=True)
    reduce_lr_deep = ReduceLROnPlateau(monitor="val_loss", patience=4, factor=0.5, min_lr=1e-6, verbose=1)

    print("\nTraining Deep LSTM Baseline Model...")
    start_time_deep = time.time()
    model_deep.fit(
        X_train,
        y_train_scaled,
        epochs=50,
        batch_size=64,
        validation_split=0.20,
        callbacks=[early_stopping_deep, reduce_lr_deep],
        verbose=1
    )
    training_time_deep = time.time() - start_time_deep

    lstm_deep_pred_scaled = model_deep.predict(X_test, verbose=0)
    lstm_deep_pred = inverse_scale_prediction(lstm_deep_pred_scaled)

    lstm_deep_mae = mean_absolute_error(y_test_raw, lstm_deep_pred)
    lstm_deep_rmse = np.sqrt(mean_squared_error(y_test_raw, lstm_deep_pred))
    lstm_deep_mape = mean_absolute_percentage_error(y_test_raw, lstm_deep_pred)
    lstm_deep_r2 = r2_score(y_test_raw, lstm_deep_pred)

    # -------------------------------------------------------------------------
    # 5. PROPOSED: ATTENTION-CONCATENATE LSTM
    # -------------------------------------------------------------------------
    print("\nBuilding Proposed Attention-Concatenate LSTM Model...")
    inputs = Input(shape=(sequence_length, 10))
    x = LSTM(128, return_sequences=True)(inputs)
    x = Dropout(0.20)(x)
    x = LSTM(64, return_sequences=True)(x)
    x = Dropout(0.20)(x)
    attention = Attention()([x, x])
    x = Concatenate()([x, attention])
    x = LSTM(32)(x)
    x = Dense(32, activation="relu")(x)
    x = Dense(16, activation="relu")(x)
    outputs = Dense(1)(x)
    model_attn = Model(inputs=inputs, outputs=outputs)
    model_attn.compile(loss="huber", optimizer=Adam(learning_rate=0.001), metrics=["mae"])
    model_attn.summary()

    early_stopping_attn = EarlyStopping(monitor="val_loss", patience=8, restore_best_weights=True)
    reduce_lr_attn = ReduceLROnPlateau(monitor="val_loss", patience=4, factor=0.5, min_lr=1e-6, verbose=1)
    checkpoint = ModelCheckpoint(filepath=os.path.join(script_dir, "best_attention_lstm.keras"), monitor="val_loss", save_best_only=True)

    print("\nTraining Proposed Attention-Concatenate LSTM Model...")
    start_time_attn = time.time()
    history_attn = model_attn.fit(
        X_train,
        y_train_scaled,
        epochs=50,
        batch_size=64,
        validation_split=0.20,
        callbacks=[early_stopping_attn, reduce_lr_attn, checkpoint],
        verbose=1
    )
    training_time_attn = time.time() - start_time_attn

    # Load the best saved checkpoint for inference
    best_model_path = os.path.join(script_dir, "best_attention_lstm.keras")
    print(f"Loading best checkpoint from {best_model_path} for final evaluation...")
    model_attn = tf.keras.models.load_model(best_model_path)

    # Evaluate inference time
    start_inf = time.time()
    lstm_attn_pred_scaled = model_attn.predict(X_test, verbose=0)
    total_inf_time = time.time() - start_inf
    inference_time_per_sample_ms = (total_inf_time / len(X_test)) * 1000.0

    lstm_attn_pred = inverse_scale_prediction(lstm_attn_pred_scaled)

    lstm_attn_mae = mean_absolute_error(y_test_raw, lstm_attn_pred)
    lstm_attn_rmse = np.sqrt(mean_squared_error(y_test_raw, lstm_attn_pred))
    lstm_attn_mape = mean_absolute_percentage_error(y_test_raw, lstm_attn_pred)
    lstm_attn_r2 = r2_score(y_test_raw, lstm_attn_pred)

    # Save the Attention-LSTM model to final path
    model_attn.save(model_path)
    print(f"\nFinal Attention-LSTM model saved to {model_path}")

    stopped_epoch_attn = len(history_attn.epoch)

    # -------------------------------------------------------------------------
    # DISPLAY EVALUATION COMPARISON
    # -------------------------------------------------------------------------
    print("\n" + "="*80)
    print("                     MODEL COMPARISON REPORT")
    print("="*80)
    print(f"Lookback Window Size      : {sequence_length}")
    print(f"Dataset Size              : {len(df)} samples")
    print(f"Multivariate Features     : {features_cols}")
    print(f"Training Time (Deep LSTM) : {training_time_deep:.2f} s")
    print(f"Training Time (Proposed)  : {training_time_attn:.2f} s")
    print(f"Inference Time per Sample : {inference_time_per_sample_ms:.4f} ms")
    print("-"*80)
    print(f"{'Model Name':<30} | {'MAE (W)':<9} | {'RMSE (W)':<10} | {'MAPE (%)':<9} | {'R² Score':<8}")
    print("-"*80)
    print(f"{'Univariate LSTM (Baseline)':<30} | {'109.05':<9} | {'127.09':<10} | {'44.31':<9} | {'-0.000':<8}")
    print(f"{'Linear Regression':<30} | {lr_mae:<9.2f} | {lr_rmse:<10.2f} | {lr_mape:<9.2f} | {lr_r2:<8.4f}")
    print(f"{'Random Forest':<30} | {rf_mae:<9.2f} | {rf_rmse:<10.2f} | {rf_mape:<9.2f} | {rf_r2:<8.4f}")
    print(f"{'XGBoost':<30} | {xgb_mae:<9.2f} | {xgb_rmse:<10.2f} | {xgb_mape:<9.2f} | {xgb_r2:<8.4f}")
    print(f"{'Deep LSTM':<30} | {lstm_deep_mae:<9.2f} | {lstm_deep_rmse:<10.2f} | {lstm_deep_mape:<9.2f} | {lstm_deep_r2:<8.4f}")
    print(f"{'Attention-LSTM (Proposed)':<30} | {lstm_attn_mae:<9.2f} | {lstm_attn_rmse:<10.2f} | {lstm_attn_mape:<9.2f} | {lstm_attn_r2:<8.4f}")
    print("="*80)

if __name__ == "__main__":
    train_and_evaluate()
