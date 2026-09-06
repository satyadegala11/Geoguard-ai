import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report
)

import joblib


# =========================================================
# GEOGUARD AI - LANDSLIDE ML MODEL
# =========================================================

print("===================================")
print("GeoGuard AI ML Training")
print("===================================")


# =========================================================
# CREATE SYNTHETIC DATASET
# =========================================================

np.random.seed(42)

rows = []


for i in range(1500):

    rainfall = np.random.uniform(
        0,
        250
    )

    soil_moisture = np.random.uniform(
        10,
        90
    )

    slope = np.random.uniform(
        0,
        45
    )

    elevation = np.random.uniform(
        0,
        3000
    )


    # =====================================================
    # RISK SCORE
    # =====================================================

    score = 0


    # Rainfall
    if rainfall >= 120:

        score += 3

    elif rainfall >= 60:

        score += 2

    elif rainfall >= 20:

        score += 1


    # Soil moisture
    if soil_moisture >= 70:

        score += 3

    elif soil_moisture >= 45:

        score += 2

    elif soil_moisture >= 30:

        score += 1


    # Slope
    if slope >= 30:

        score += 3

    elif slope >= 20:

        score += 2

    elif slope >= 10:

        score += 1


    # Elevation
    if elevation >= 2000:

        score += 1


    # =====================================================
    # RISK CLASS
    # =====================================================

    if score <= 3:

        risk = 0

    elif score <= 6:

        risk = 1

    else:

        risk = 2


    rows.append([
        rainfall,
        soil_moisture,
        slope,
        elevation,
        risk
    ])


# =========================================================
# DATAFRAME
# =========================================================

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


print(
    "Dataset created successfully!"
)

print(
    "Number of rows:",
    len(df)
)

print(
    df["landslide"]
    .value_counts()
    .sort_index()
)


# =========================================================
# FEATURES
# =========================================================

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


# =========================================================
# TRAIN TEST SPLIT
# =========================================================

X_train, X_test, y_train, y_test = train_test_split(

    X,
    y,

    test_size=0.20,

    random_state=42,

    stratify=y
)


print(
    "Training samples:",
    len(X_train)
)

print(
    "Testing samples:",
    len(X_test)
)


# =========================================================
# RANDOM FOREST
# =========================================================

model = RandomForestClassifier(

    n_estimators=300,

    max_depth=12,

    min_samples_leaf=3,

    random_state=42,

    class_weight="balanced"
)


# =========================================================
# TRAIN
# =========================================================

model.fit(
    X_train,
    y_train
)


# =========================================================
# TEST
# =========================================================

predictions = model.predict(
    X_test
)


accuracy = accuracy_score(
    y_test,
    predictions
)


print(
    "Accuracy:",
    round(
        accuracy * 100,
        2
    ),
    "%"
)


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


# =========================================================
# SAVE MODEL
# =========================================================

MODEL_PATH = "landslide_model.pkl"


joblib.dump(
    model,
    MODEL_PATH
)


print(
    "Model trained successfully!"
)

print(
    "Model saved as:",
    MODEL_PATH
)