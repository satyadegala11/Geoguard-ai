from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import joblib
import os
import json
import httpx


# =========================================================
# APP
# =========================================================

app = FastAPI(title="GeoGuard AI")


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# LOAD ML MODEL
# =========================================================

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "ml",
    "landslide_model.pkl"
)

model = joblib.load(MODEL_PATH)


# =========================================================
# INPUT MODELS
# =========================================================

class LandslideData(BaseModel):
    rainfall: float
    soil_moisture: float
    slope: float
    elevation: float


class MapLocation(BaseModel):
    latitude: float
    longitude: float


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():
    return {
        "message": "GeoGuard AI Landslide Prediction API is running!"
    }


# =========================================================
# NORMAL AI PREDICTION
# =========================================================

@app.post("/predict")
def predict(data: LandslideData):

    input_data = [[
        data.rainfall,
        data.soil_moisture,
        data.slope,
        data.elevation
    ]]

    prediction = int(
        model.predict(input_data)[0]
    )

    probabilities = model.predict_proba(
        input_data
    )[0]

    classes = list(model.classes_)

    if 2 in classes:
        high_index = classes.index(2)

        landslide_probability = float(
            probabilities[high_index]
        )
    else:
        landslide_probability = float(
            max(probabilities)
        )

    risk_percentage = round(
        landslide_probability * 100,
        2
    )

    if risk_percentage >= 70:
        risk = "High"
    elif risk_percentage >= 40:
        risk = "Medium"
    else:
        risk = "Low"

    return {
        "risk_level": risk,
        "prediction": prediction,
        "landslide_probability": round(
            landslide_probability,
            4
        ),
        "risk_percentage": risk_percentage,
        "rainfall": data.rainfall,
        "soil_moisture": data.soil_moisture,
        "slope": data.slope,
        "elevation": data.elevation
    }


# =========================================================
# AI LANDSLIDE LOCATION PREDICTION
# =========================================================
#
# Gets live environmental information based on
# the selected latitude and longitude.
#
# Weather / soil moisture:
# Open-Meteo
#
# Elevation:
# Open-Meteo elevation API
#
# Slope:
# Prototype terrain estimate for now.
#
# =========================================================

@app.post("/predict-location")
async def predict_location(data: MapLocation):

    latitude = data.latitude
    longitude = data.longitude

    # -----------------------------------------------------
    # INDIA BOUNDING BOX VALIDATION
    # -----------------------------------------------------

    if latitude < 6 or latitude > 38:
        raise HTTPException(
            status_code=400,
            detail="Please select a location within India."
        )

    if longitude < 68 or longitude > 98:
        raise HTTPException(
            status_code=400,
            detail="Please select a location within India."
        )

    # -----------------------------------------------------
    # FETCH LIVE WEATHER DATA
    # -----------------------------------------------------

    weather_url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={latitude}"
        f"&longitude={longitude}"
        "&current="
        "temperature_2m,"
        "relative_humidity_2m,"
        "rain,"
        "precipitation,"
        "wind_speed_10m,"
        "soil_moisture_0_to_1cm"
        "&timezone=auto"
    )

    # -----------------------------------------------------
    # FETCH ELEVATION
    # -----------------------------------------------------

    elevation_url = (
        "https://api.open-meteo.com/v1/elevation"
        f"?latitude={latitude}"
        f"&longitude={longitude}"
    )

    try:

        async with httpx.AsyncClient(
            timeout=15.0
        ) as client:

            weather_response = await client.get(
                weather_url
            )

            elevation_response = await client.get(
                elevation_url
            )

        # Check weather response
        if weather_response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Unable to retrieve live weather data."
            )

        # Check elevation response
        if elevation_response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Unable to retrieve elevation data."
            )

        weather_data = (
            weather_response.json()
        )

        elevation_data = (
            elevation_response.json()
        )

    except httpx.RequestError as exc:

        raise HTTPException(
            status_code=502,
            detail=f"Environmental data service unavailable: {str(exc)}"
        )


    # =====================================================
    # EXTRACT WEATHER VALUES
    # =====================================================

    current = weather_data.get(
        "current",
        {}
    )

    temperature = float(
        current.get(
            "temperature_2m",
            0
        )
    )

    humidity = float(
        current.get(
            "relative_humidity_2m",
            0
        )
    )

    rainfall = float(
        current.get(
            "rain",
            0
        )
    )

    wind_speed = float(
        current.get(
            "wind_speed_10m",
            0
        )
    )

    # Open-Meteo soil moisture is returned
    # as m³/m³.
    #
    # Example:
    # 0.35 = 35%

    soil_moisture_raw = float(
        current.get(
            "soil_moisture_0_to_1cm",
            0
        )
    )

    soil_moisture = (
        soil_moisture_raw * 100
    )


    # =====================================================
    # ELEVATION
    # =====================================================

    elevation_values = (
        elevation_data.get(
            "elevation",
            [0]
        )
    )

    if elevation_values:

        elevation = float(
            elevation_values[0]
        )

    else:

        elevation = 0.0


    # =====================================================
    # SLOPE
    # =====================================================
    #
    # IMPORTANT:
    # This is currently an estimated terrain value.
    #
    # It is NOT presented as measured slope.
    #
    # We can later replace this with DEM-based
    # terrain slope calculation.
    #
    # =====================================================

    slope = estimate_slope(
        latitude,
        longitude
    )


    # =====================================================
    # AI MODEL INPUT
    # =====================================================

    input_data = [[
        rainfall,
        soil_moisture,
        slope,
        elevation
    ]]

    prediction = int(
        model.predict(input_data)[0]
    )

    probabilities = model.predict_proba(
        input_data
    )[0]

    classes = list(
        model.classes_
    )


    # =====================================================
    # LANDSLIDE PROBABILITY
    # =====================================================

    if 2 in classes:

        high_index = classes.index(2)

        landslide_probability = float(
            probabilities[high_index]
        )

    else:

        landslide_probability = float(
            max(probabilities)
        )


    risk_percentage = round(
        landslide_probability * 100,
        2
    )


    # =====================================================
    # RISK LEVEL
    # =====================================================

    if risk_percentage >= 70:

        risk = "High"

    elif risk_percentage >= 40:

        risk = "Medium"

    else:

        risk = "Low"


    # =====================================================
    # RESPONSE
    # =====================================================

    return {

        "latitude": latitude,

        "longitude": longitude,

        "risk_level": risk,

        "prediction": prediction,

        "landslide_probability": round(
            landslide_probability,
            4
        ),

        "risk_percentage": risk_percentage,

        "rainfall": round(
            rainfall,
            2
        ),

        "soil_moisture": round(
            soil_moisture,
            2
        ),

        "humidity": round(
            humidity,
            2
        ),

        "temperature": round(
            temperature,
            2
        ),

        "wind_speed": round(
            wind_speed,
            2
        ),

        "slope": round(
            slope,
            2
        ),

        "elevation": round(
            elevation,
            2
        )
    }


# =========================================================
# SLOPE ESTIMATION
# =========================================================

def estimate_slope(latitude, longitude):

    # Temporary prototype estimate.
    #
    # DO NOT describe this as measured slope.
    #
    # This will be replaced later with
    # DEM-based slope calculation.

    if latitude >= 27:
        return 25.0

    if latitude >= 24:
        return 20.0

    if latitude >= 20:
        return 15.0

    return 8.0


# =========================================================
# RISK DATA
# =========================================================

@app.get("/risk-data")
def get_risk_data():

    return {
        "message": "Risk data endpoint is working"
    }


# =========================================================
# LANDSLIDE REPORT SYSTEM
# =========================================================

REPORTS_FILE = os.path.join(
    os.path.dirname(__file__),
    "reports.json"
)


def load_reports():

    if not os.path.exists(
        REPORTS_FILE
    ):
        return []

    try:

        with open(
            REPORTS_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    except Exception:

        return []


def save_reports(reports):

    with open(
        REPORTS_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            reports,
            file,
            indent=4
        )


# =========================================================
# CREATE REPORT
# =========================================================

@app.post("/reports")
async def create_report(
    location: str = Form(...),
    description: str = Form(...),
    file: UploadFile | None = File(None)
):

    reports = load_reports()

    report_id = len(reports) + 1

    file_name = None

    if file is not None:

        upload_folder = os.path.join(
            os.path.dirname(__file__),
            "uploads"
        )

        os.makedirs(
            upload_folder,
            exist_ok=True
        )

        original_name = (
            file.filename or
            "uploaded_file"
        )

        file_name = (
            f"{report_id}_{original_name}"
        )

        file_path = os.path.join(
            upload_folder,
            file_name
        )

        contents = await file.read()

        with open(
            file_path,
            "wb"
        ) as output_file:

            output_file.write(
                contents
            )


    report = {

        "id": report_id,

        "location": location,

        "description": description,

        "file": file_name,

        "status": "Submitted",

        "time": datetime.now().isoformat()
    }

    reports.append(report)

    save_reports(reports)

    return {

        "message":
            "Landslide report submitted successfully!",

        "report": report
    }


# =========================================================
# GET REPORTS
# =========================================================

@app.get("/reports")
def get_reports():

    reports = load_reports()

    return {

        "count": len(reports),

        "reports": reports
    }