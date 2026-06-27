import os
import joblib
import pandas as pd
import numpy as np
import tensorflow as tf
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import matplotlib.pyplot as plt

# Set seeds for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

def mean_absolute_percentage_error(y_true, y_pred):
    y_true, y_pred = np.array(y_true), np.array(y_pred)
    safe_true = np.where(y_true == 0, 1e-5, y_true)
    return np.mean(np.abs((y_true - y_pred) / safe_true)) * 100

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, "Renewable_energy_dataset_large.csv")
    model_path = os.path.join(script_dir, "best_attention_lstm.keras")
    if not os.path.exists(model_path):
        model_path = os.path.join(script_dir, "lstm_power_model.keras")
    scaler_path = os.path.join(script_dir, "lstm_scaler.pkl")

    print(f"Loading dataset from {csv_path}...")
    df = pd.read_csv(csv_path)

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

    raw_data = df[features_cols].values.astype(float)
    
    # Load MinMaxScaler
    print(f"Loading MinMaxScaler from {scaler_path}...")
    scaler = joblib.load(scaler_path)
    scaled_data = scaler.transform(raw_data)

    # Generate sliding window sequences (lookback = 48)
    sequence_length = 48
    X, y = [], []
    for i in range(len(scaled_data) - sequence_length):
        X.append(scaled_data[i : i + sequence_length, :])
        y.append(scaled_data[i + sequence_length, 0])
    
    X = np.array(X)
    y = np.array(y)

    # Train/Test Split (80% Train, 20% Test)
    split_idx = int(len(X) * 0.8)
    X_test = X[split_idx:]
    y_test_raw = raw_data[sequence_length + split_idx:, 0]

    # Load LSTM model
    print(f"Loading LSTM model from {model_path}...")
    model = tf.keras.models.load_model(model_path)

    # Predict
    print("Running test set inference...")
    pred_scaled = model.predict(X_test, verbose=1, batch_size=1024)

    # Inverse scale predictions
    dummy = np.zeros((len(pred_scaled), 10))
    dummy[:, 0] = pred_scaled.squeeze()
    pred_raw = scaler.inverse_transform(dummy)[:, 0]

    # Calculate metrics
    mae = mean_absolute_error(y_test_raw, pred_raw)
    rmse = np.sqrt(mean_squared_error(y_test_raw, pred_raw))
    mape = mean_absolute_percentage_error(y_test_raw, pred_raw)
    r2 = r2_score(y_test_raw, pred_raw)

    print("\nCalculated Metrics:")
    print(f"  MAE:  {mae:.2f} W")
    print(f"  RMSE: {rmse:.2f} W")
    print(f"  MAPE: {mape:.2f} %")
    print(f"  R2:   {r2:.4f}")

    # Write textual report
    report_path = os.path.join(script_dir, "lstm_metrics_report.txt")
    with open(report_path, "w") as f:
        f.write("==================================================\n")
        f.write("            LSTM MODEL TRAINING REPORT            \n")
        f.write("==================================================\n")
        f.write(f"Model File           : {os.path.basename(model_path)}\n")
        f.write(f"Scaler File          : {os.path.basename(scaler_path)}\n")
        f.write(f"Lookback Window Size : {sequence_length}\n")
        f.write(f"Evaluation Samples   : {len(X_test)}\n")
        f.write("--------------------------------------------------\n")
        f.write(f"Mean Absolute Error (MAE)       : {mae:.4f} W\n")
        f.write(f"Root Mean Squared Error (RMSE)  : {rmse:.4f} W\n")
        f.write(f"Mean Abs Percentage Error (MAPE): {mape:.4f} %\n")
        f.write(f"R-squared (R2 Score)            : {r2:.4f}\n")
        f.write("==================================================\n")
    print(f"Report saved to {report_path}")

    # Set matplotlib style for aesthetic premium look (Light Theme)
    plt.rcParams["figure.facecolor"] = "#ffffff"
    plt.rcParams["axes.facecolor"] = "#ffffff"
    plt.rcParams["text.color"] = "#0f172a"
    plt.rcParams["axes.labelcolor"] = "#0f172a"
    plt.rcParams["xtick.color"] = "#475569"
    plt.rcParams["ytick.color"] = "#475569"
    plt.rcParams["grid.color"] = "#e2e8f0"
    plt.rcParams["font.size"] = 10

    # 1. Plot: Actual vs Predicted (first 120 samples for clarity)
    plt.figure(figsize=(12, 5))
    plot_len = 120
    plt.plot(y_test_raw[:plot_len], label="Actual Power Load", color="#2563eb", linewidth=2)
    plt.plot(pred_raw[:plot_len], label="LSTM Predicted Power", color="#10b981", linestyle="--", linewidth=2)
    plt.title("Actual vs. LSTM Predicted Power Load (First 120 Test Timesteps)", pad=15)
    plt.xlabel("Time Step (Index)")
    plt.ylabel("Power Demand (Watts)")
    plt.legend(frameon=True, facecolor="#ffffff", edgecolor="#cbd5e1")
    plt.grid(True, linestyle=":", alpha=0.6)
    plt.tight_layout()
    plot1_path = os.path.join(script_dir, "lstm_actual_vs_predicted.png")
    plt.savefig(plot1_path, dpi=150, facecolor="#ffffff")
    plt.close()
    print(f"Plot saved to {plot1_path}")

    # 2. Plot: Correlation Scatter Plot
    plt.figure(figsize=(7, 6))
    # Downsample points for cleaner scatter plot
    scatter_indices = np.random.choice(len(y_test_raw), size=min(1500, len(y_test_raw)), replace=False)
    plt.scatter(y_test_raw[scatter_indices], pred_raw[scatter_indices], color="#2563eb", alpha=0.3, edgecolors='none', label="Test Samples")
    # Ideal line
    min_val = min(y_test_raw.min(), pred_raw.min())
    max_val = max(y_test_raw.max(), pred_raw.max())
    plt.plot([min_val, max_val], [min_val, max_val], color="#ef4444", linestyle="--", linewidth=2, label="Ideal Line (y = x)")
    
    plt.title(f"Prediction Correlation ($R^2$: {r2:.4f})", pad=15)
    plt.xlabel("Actual Power Load (Watts)")
    plt.ylabel("LSTM Predicted Power (Watts)")
    plt.legend(frameon=True, facecolor="#ffffff", edgecolor="#cbd5e1")
    plt.grid(True, linestyle=":", alpha=0.6)
    plt.tight_layout()
    plot2_path = os.path.join(script_dir, "lstm_correlation.png")
    plt.savefig(plot2_path, dpi=150, facecolor="#ffffff")
    plt.close()
    print(f"Plot saved to {plot2_path}")

    # 3. Plot: Error Distribution (Residuals)
    plt.figure(figsize=(8, 5))
    errors = y_test_raw - pred_raw
    plt.hist(errors, bins=50, color="#8b5cf6", alpha=0.75, rwidth=0.85, label="Residual Errors")
    plt.axvline(x=0, color="#ef4444", linestyle="--", linewidth=1.5, label="Zero Error Line")
    
    plt.title("LSTM Forecast Error Residuals Distribution", pad=15)
    plt.xlabel("Residual Error (Actual - Predicted) in Watts")
    plt.ylabel("Frequency")
    plt.legend(frameon=True, facecolor="#ffffff", edgecolor="#cbd5e1")
    plt.grid(True, linestyle=":", alpha=0.6)
    plt.tight_layout()
    plot3_path = os.path.join(script_dir, "lstm_error_distribution.png")
    plt.savefig(plot3_path, dpi=150, facecolor="#ffffff")
    plt.close()
    print(f"Plot saved to {plot3_path}")

if __name__ == "__main__":
    main()
