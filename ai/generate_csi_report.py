"""
EcoEdge — CSI (Consumer Sustainability Index) Report Generator
==============================================================
Computes actual CSI values from the Renewable Energy Dataset using
the exact formula defined in analytics.py, then generates publication-
quality plots and a statistical summary.
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import FancyBboxPatch
from datetime import datetime

# --- CSI Calculation (mirrors analytics.py exactly) --------------------------

def calculate_csi(
    renewable_ratio: float,
    battery: float,
    power_history: list,
    grid_present: bool
) -> tuple:
    """
    Calculate the Consumer Sustainability Index (CSI).
    Weights:
      30% Renewable Usage
      25% Battery SOC
      25% Load Stability (inverse of coefficient of variation)
      20% Grid Independence
    """
    # 1. Renewable Usage Score (0-100)
    renewable_score = min(100.0, max(0.0, renewable_ratio * 100.0))

    # 2. Battery SOC Score (0-100)
    battery_score = min(100.0, max(0.0, battery))

    # 3. Load Stability Score (0-100)
    if len(power_history) >= 2:
        mean_power = np.mean(power_history)
        std_power = np.std(power_history)
        if mean_power > 0:
            coef_variation = std_power / mean_power
            stability_score = max(0.0, min(100.0, (1.0 - coef_variation) * 100.0))
        else:
            stability_score = 100.0
    else:
        stability_score = 80.0

    # 4. Grid Independence Score (0-100)
    if not grid_present:
        grid_score = 100.0
    else:
        grid_score = min(100.0, max(0.0, renewable_ratio * 100.0))

    # Weighted CSI Sum
    csi_val = (
        (renewable_score * 0.30) +
        (battery_score * 0.25) +
        (stability_score * 0.25) +
        (grid_score * 0.20)
    )
    csi = int(round(csi_val))
    csi = max(0, min(100, csi))

    if csi >= 80:
        status = "Excellent"
    elif csi >= 60:
        status = "Good"
    elif csi >= 40:
        status = "Moderate"
    else:
        status = "Poor"

    return csi, status, renewable_score, battery_score, stability_score, grid_score


# --- Main Report Generation -------------------------------------------------

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, "Renewable_energy_dataset.csv")
    output_dir = script_dir

    print("=" * 60)
    print("       ECOEDGE CSI REPORT GENERATOR")
    print("=" * 60)

    # Load dataset
    df = pd.read_csv(csv_path, parse_dates=["timestamp"])
    print(f"Loaded {len(df)} records from dataset.")

    # --- Compute CSI for every row ---------------------------------------
    POWER_WINDOW = 12  # Rolling window of 12 timesteps for load stability

    csi_values = []
    renewable_scores = []
    battery_scores = []
    stability_scores = []
    grid_scores = []
    statuses = []

    for i in range(len(df)):
        row = df.iloc[i]

        # Renewable ratio = total renewable energy / grid load demand
        load = row["grid_load_demand"]
        renewable = row["total_renewable_energy"]
        if load > 0:
            renewable_ratio = min(1.0, renewable / load)
        else:
            renewable_ratio = 0.0

        battery = row["battery_state_of_charge"]

        # Rolling power history window
        start_idx = max(0, i - POWER_WINDOW + 1)
        power_history = df["grid_load_demand"].iloc[start_idx:i + 1].tolist()

        # Grid present heuristic: if power_exchange > 0 (importing from grid), grid is present
        grid_present = row["power_exchange"] > 0

        csi, status, r_score, b_score, s_score, g_score = calculate_csi(
            renewable_ratio, battery, power_history, grid_present
        )

        csi_values.append(csi)
        renewable_scores.append(r_score)
        battery_scores.append(b_score)
        stability_scores.append(s_score)
        grid_scores.append(g_score)
        statuses.append(status)

    df["csi"] = csi_values
    df["csi_status"] = statuses
    df["renewable_score"] = renewable_scores
    df["battery_score"] = battery_scores
    df["stability_score"] = stability_scores
    df["grid_score"] = grid_scores

    # --- Statistics ------------------------------------------------------
    print(f"\n{'-' * 50}")
    print("  CSI STATISTICS SUMMARY")
    print(f"{'-' * 50}")
    print(f"  Total Records:      {len(df)}")
    print(f"  Mean CSI:           {df['csi'].mean():.2f}")
    print(f"  Median CSI:         {df['csi'].median():.2f}")
    print(f"  Std Dev:            {df['csi'].std():.2f}")
    print(f"  Min CSI:            {df['csi'].min()}")
    print(f"  Max CSI:            {df['csi'].max()}")
    print(f"{'-' * 50}")
    print("  STATUS DISTRIBUTION:")
    status_counts = df["csi_status"].value_counts()
    for s, c in status_counts.items():
        pct = c / len(df) * 100
        print(f"    {s:12s}  {c:5d}  ({pct:.1f}%)")
    print(f"{'-' * 50}")
    print("  COMPONENT AVERAGES (0-100):")
    print(f"    Renewable Usage:   {df['renewable_score'].mean():.2f}")
    print(f"    Battery SOC:       {df['battery_score'].mean():.2f}")
    print(f"    Load Stability:    {df['stability_score'].mean():.2f}")
    print(f"    Grid Independence: {df['grid_score'].mean():.2f}")
    print(f"{'-' * 50}")

    # --- Plot Styling ----------------------------------------------------
    plt.rcParams.update({
        "font.family": "sans-serif",
        "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
        "font.size": 11,
        "axes.facecolor": "#FAFBFC",
        "figure.facecolor": "#FFFFFF",
        "axes.grid": True,
        "grid.alpha": 0.3,
        "grid.color": "#CBD5E1",
    })

    COLOR_EXCELLENT = "#10B981"
    COLOR_GOOD = "#06B6D4"
    COLOR_MODERATE = "#F59E0B"
    COLOR_POOR = "#EF4444"
    COLOR_CSI_LINE = "#059669"
    COLOR_RENEWABLE = "#10B981"
    COLOR_BATTERY = "#06B6D4"
    COLOR_STABILITY = "#F59E0B"
    COLOR_GRID = "#EC4899"

    # ═══════════════════════════════════════════════════════════════════════
    # PLOT 1: CSI Trend Over Time (Full Timeline)
    # ═══════════════════════════════════════════════════════════════════════
    fig, ax = plt.subplots(figsize=(16, 6))

    ax.fill_between(df["timestamp"], df["csi"], alpha=0.15, color=COLOR_CSI_LINE)
    ax.plot(df["timestamp"], df["csi"], color=COLOR_CSI_LINE, linewidth=1.5, alpha=0.9, label="CSI Score")

    # Classification zone shading
    ax.axhspan(80, 100, alpha=0.06, color=COLOR_EXCELLENT)
    ax.axhspan(60, 80, alpha=0.06, color=COLOR_GOOD)
    ax.axhspan(40, 60, alpha=0.06, color=COLOR_MODERATE)
    ax.axhspan(0, 40, alpha=0.06, color=COLOR_POOR)

    # Reference lines
    ax.axhline(y=80, color=COLOR_EXCELLENT, linestyle="--", linewidth=1, alpha=0.6)
    ax.axhline(y=60, color=COLOR_GOOD, linestyle="--", linewidth=1, alpha=0.6)
    ax.axhline(y=40, color=COLOR_MODERATE, linestyle="--", linewidth=1, alpha=0.6)

    ax.text(df["timestamp"].iloc[-1], 82, " Excellent", fontsize=9, fontweight="bold", color=COLOR_EXCELLENT, va="bottom")
    ax.text(df["timestamp"].iloc[-1], 62, " Good", fontsize=9, fontweight="bold", color=COLOR_GOOD, va="bottom")
    ax.text(df["timestamp"].iloc[-1], 42, " Moderate", fontsize=9, fontweight="bold", color=COLOR_MODERATE, va="bottom")
    ax.text(df["timestamp"].iloc[-1], 5, " Poor", fontsize=9, fontweight="bold", color=COLOR_POOR, va="bottom")

    # Mean line
    mean_csi = df["csi"].mean()
    ax.axhline(y=mean_csi, color="#6366F1", linestyle="-.", linewidth=1.5, alpha=0.7, label=f"Mean CSI = {mean_csi:.1f}")

    ax.set_ylim(0, 105)
    ax.set_xlabel("Timestamp", fontsize=12, fontweight="bold")
    ax.set_ylabel("CSI Score", fontsize=12, fontweight="bold")
    ax.set_title("Consumer Sustainability Index (CSI) — Actual Values Over Time", fontsize=15, fontweight="black", pad=15)
    ax.legend(loc="lower left", fontsize=10, framealpha=0.9)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(interval=2))
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()

    path1 = os.path.join(output_dir, "csi_trend_actual.png")
    fig.savefig(path1, dpi=180, bbox_inches="tight")
    print(f"\n[Saved] {path1}")
    plt.close(fig)

    # ═══════════════════════════════════════════════════════════════════════
    # PLOT 2: CSI Component Breakdown Over Time (Stacked Area)
    # ═══════════════════════════════════════════════════════════════════════
    fig, ax = plt.subplots(figsize=(16, 6))

    # Weighted components for stacking
    r_weighted = df["renewable_score"] * 0.30
    b_weighted = df["battery_score"] * 0.25
    s_weighted = df["stability_score"] * 0.25
    g_weighted = df["grid_score"] * 0.20

    ax.fill_between(df["timestamp"], 0, r_weighted, alpha=0.5, color=COLOR_RENEWABLE, label="Renewable (30%)")
    ax.fill_between(df["timestamp"], r_weighted, r_weighted + b_weighted, alpha=0.5, color=COLOR_BATTERY, label="Battery SOC (25%)")
    ax.fill_between(df["timestamp"], r_weighted + b_weighted, r_weighted + b_weighted + s_weighted, alpha=0.5, color=COLOR_STABILITY, label="Load Stability (25%)")
    ax.fill_between(df["timestamp"], r_weighted + b_weighted + s_weighted, r_weighted + b_weighted + s_weighted + g_weighted, alpha=0.5, color=COLOR_GRID, label="Grid Independence (20%)")

    ax.plot(df["timestamp"], df["csi"], color="#0F172A", linewidth=1.2, alpha=0.7, label="CSI Total")

    ax.set_ylim(0, 105)
    ax.set_xlabel("Timestamp", fontsize=12, fontweight="bold")
    ax.set_ylabel("Weighted Score Contribution", fontsize=12, fontweight="bold")
    ax.set_title("CSI Component Breakdown — Weighted Contributions Over Time", fontsize=15, fontweight="black", pad=15)
    ax.legend(loc="lower left", fontsize=9, framealpha=0.9, ncol=3)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(interval=2))
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()

    path2 = os.path.join(output_dir, "csi_component_breakdown.png")
    fig.savefig(path2, dpi=180, bbox_inches="tight")
    print(f"[Saved] {path2}")
    plt.close(fig)

    # ═══════════════════════════════════════════════════════════════════════
    # PLOT 3: CSI Distribution Histogram
    # ═══════════════════════════════════════════════════════════════════════
    fig, ax = plt.subplots(figsize=(10, 6))

    bins = np.arange(0, 105, 5)
    n, bin_edges, patches = ax.hist(df["csi"], bins=bins, edgecolor="white", linewidth=0.8)

    # Color bars by CSI classification zone
    for patch, left_edge in zip(patches, bin_edges[:-1]):
        if left_edge >= 80:
            patch.set_facecolor(COLOR_EXCELLENT)
        elif left_edge >= 60:
            patch.set_facecolor(COLOR_GOOD)
        elif left_edge >= 40:
            patch.set_facecolor(COLOR_MODERATE)
        else:
            patch.set_facecolor(COLOR_POOR)
        patch.set_alpha(0.8)

    ax.axvline(x=mean_csi, color="#6366F1", linestyle="-.", linewidth=2, label=f"Mean = {mean_csi:.1f}")
    ax.axvline(x=df["csi"].median(), color="#8B5CF6", linestyle=":", linewidth=2, label=f"Median = {df['csi'].median():.1f}")

    ax.set_xlabel("CSI Score", fontsize=12, fontweight="bold")
    ax.set_ylabel("Frequency", fontsize=12, fontweight="bold")
    ax.set_title("CSI Score Distribution — Actual Values", fontsize=15, fontweight="black", pad=15)
    ax.legend(fontsize=11, framealpha=0.9)
    plt.tight_layout()

    path3 = os.path.join(output_dir, "csi_distribution.png")
    fig.savefig(path3, dpi=180, bbox_inches="tight")
    print(f"[Saved] {path3}")
    plt.close(fig)

    # ═══════════════════════════════════════════════════════════════════════
    # PLOT 4: Daily Average CSI with Status Color-Coding
    # ═══════════════════════════════════════════════════════════════════════
    daily = df.set_index("timestamp").resample("D")["csi"].mean().dropna()

    fig, ax = plt.subplots(figsize=(16, 5))

    colors = []
    for v in daily.values:
        if v >= 80:
            colors.append(COLOR_EXCELLENT)
        elif v >= 60:
            colors.append(COLOR_GOOD)
        elif v >= 40:
            colors.append(COLOR_MODERATE)
        else:
            colors.append(COLOR_POOR)

    ax.bar(daily.index, daily.values, width=0.8, color=colors, alpha=0.85, edgecolor="white", linewidth=0.5)
    ax.axhline(y=mean_csi, color="#6366F1", linestyle="-.", linewidth=1.5, alpha=0.7, label=f"Overall Mean = {mean_csi:.1f}")

    ax.set_ylim(0, 105)
    ax.set_xlabel("Date", fontsize=12, fontweight="bold")
    ax.set_ylabel("Daily Average CSI", fontsize=12, fontweight="bold")
    ax.set_title("Daily Average CSI — Color-Coded by Status", fontsize=15, fontweight="black", pad=15)
    ax.legend(fontsize=10, framealpha=0.9)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(interval=2))
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()

    path4 = os.path.join(output_dir, "csi_daily_average.png")
    fig.savefig(path4, dpi=180, bbox_inches="tight")
    print(f"[Saved] {path4}")
    plt.close(fig)

    # --- Save CSI data to CSV --------------------------------------------
    csi_output_path = os.path.join(output_dir, "csi_report_data.csv")
    df[["timestamp", "csi", "csi_status", "renewable_score", "battery_score", "stability_score", "grid_score"]].to_csv(
        csi_output_path, index=False
    )
    print(f"[Saved] {csi_output_path}")

    print("\n" + "=" * 60)
    print("  CSI REPORT GENERATION COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
