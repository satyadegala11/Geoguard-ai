
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
import joblib

# =========================================================
# GEOGUARD AI - LANDSLIDE ML MODEL
# =========================================================

print("===================================")
print("GeoGuard AI ML Training")
print("===================================")

# ---------------------------------------------------------
# Create training dataset
#
# 0 = Low
# 1 = Medium
# 2 = High
#
# This is a prototype/synthetic dataset.
# Real deployment should use validated historical
# landslide and environmental observations.
# ---------------------------------------------------------

np.random.seed(42)

rows = []

for i in range(1500):

    rainfall = np.random.uniform(0, 250)
    soil_moisture = np.random.uniform(10, 90)
    slope = np.random.uniform(0, 45)
    elevation = np.random.uniform(0, 3000)

    # -----------------------------------------------------
    # Prototype risk score
    # -----------------------------------------------------

    score = 0

    # Rainfall contribution
    if rainfall >= 120:
        score += 3
    elif rainfall >= 60:
        score += 2
    elif rainfall >= 20:
        score += 1

    # Soil moisture contribution
    if soil_moisture >= 70:
        score += 3
    elif soil_moisture >= 45:
        score += 2
    elif soil_moisture >= 30:
        score += 1

    # Slope contribution
    if slope >= 30:
        score += 3
    elif slope >= 20:
        score += 2
    elif slope >= 10:
        score += 1

    # Elevation contribution
    # Elevation alone should not determine landslide risk.
    if elevation >= 2000:
        score += 1

    # -----------------------------------------------------
    # Convert score to risk class
    # -----------------------------------------------------

    if score <= 3:
        risk = 0       # Low
    elif score <= 6:
        risk = 1       # Medium
    else:
        risk = 2       # High

    rows.append([
        rainfall,
        soil_moisture,
        slope,
        elevation,
        risk
    ])


# ---------------------------------------------------------
# Create DataFrame
# ---------------------------------------------------------

df = pd.DataFrame(
    rows,
    columns=[
        "rainfall",
        "soil_moisture",
        "slope",
        "elevation",
        "landslide"
    ]
)

print("Dataset created successfully!")
print("Number of rows:", len(df))
print()
print("Risk distribution:")
print(df["landslide"].value_counts().sort_index())


# ---------------------------------------------------------
# Input features
# ---------------------------------------------------------

X = df[
    [
        "rainfall",
        "soil_moisture",
        "slope",
        "elevation"
    ]
]

# Target
y = df["landslide"]


# ---------------------------------------------------------
# Train / Test split
# ---------------------------------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print()
print("Training samples:", len(X_train))
print("Testing samples:", len(X_test))


# ---------------------------------------------------------
# Random Forest Model
# ---------------------------------------------------------

model = RandomForestClassifier(
    n_estimators=300,
    max_depth=12,
    min_samples_leaf=3,
    random_state=42,
    class_weight="balanced"
)

model.fit(X_train, y_train)


# ---------------------------------------------------------
# Test model
# ---------------------------------------------------------

predictions = model.predict(X_test)

accuracy = accuracy_score(
    y_test,
    predictions
)

print()
print("Accuracy:", round(accuracy * 100, 2), "%")

print()
print("Classification Report:")
print(
    classification_report(
        y_test,
        predictions,
        target_names=[
            "Low",
            "Medium",
            "High"
        ]
    )
)


# ---------------------------------------------------------
# Save model
# ---------------------------------------------------------

MODEL_PATH = "landslide_model.pkl"

joblib.dump(
    model,
    MODEL_PATH
)

print()
print("===================================")
print("Model trained successfully!")
print("Model saved as:", MODEL_PATH)
print("===================================")

