from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import joblib
import os
import json
import httpx


# =========================================================
# APP CONFIGURATION
# =========================================================

app = FastAPI(
    title="GeoGuard AI",
    description="AI-Based Early Warning & Landslide Risk Monitoring System",
    version="1.0.0"
)


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
# MACHINE LEARNING MODEL
# =========================================================

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "ml",
    "landslide_model.pkl"
)

try:
    model = joblib.load(MODEL_PATH)
    print("ML model loaded successfully.")
except Exception as exc:
    print("ERROR loading ML model:", exc)
    raise


# =========================================================
# DATA MODELS
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
        "message": "GeoGuard AI Landslide Prediction API is running!",
        "status": "online",
        "version": "1.0.0"
    }


# =========================================================
# NORMAL LANDSLIDE PREDICTION
# =========================================================

@app.post("/predict")
def predict(data: LandslideData):

    input_data = [[
        data.rainfall,
        data.soil_moisture,
        data.slope,
        data.elevation
    ]]

    # ML prediction
    prediction = int(model.predict(input_data)[0])

    # Probability
    probabilities = model.predict_proba(input_data)[0]

    classes = list(model.classes_)

    # Class 2 = High landslide class, if available
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

    # Risk classification
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
# LIVE LOCATION-BASED PREDICTION
# =========================================================

@app.post("/predict-location")
async def predict_location(data: MapLocation):

    latitude = data.latitude
    longitude = data.longitude

    # -----------------------------------------------------
    # INDIA VALIDATION
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
    # OPEN-METEO WEATHER API
    # -----------------------------------------------------

    weather_url = "https://api.open-meteo.com/v1/forecast"

    weather_params = {
        "latitude": latitude,
        "longitude": longitude,

        "current": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "rain,"
            "wind_speed_10m,"
            "soil_moisture_0_to_1cm"
        ),

        "timezone": "auto"
    }

    # -----------------------------------------------------
    # OPEN-METEO ELEVATION API
    # -----------------------------------------------------

    elevation_url = "https://api.open-meteo.com/v1/elevation"

    elevation_params = {
        "latitude": latitude,
        "longitude": longitude
    }

    # -----------------------------------------------------
    # GET LIVE ENVIRONMENTAL DATA
    # -----------------------------------------------------

    try:

        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True
        ) as client:

            weather_response = await client.get(
                weather_url,
                params=weather_params
            )

            elevation_response = await client.get(
                elevation_url,
                params=elevation_params
            )

        # -------------------------------------------------
        # WEATHER ERROR
        # -------------------------------------------------

        if weather_response.status_code != 200:

            print(
                "OPEN-METEO WEATHER ERROR:",
                weather_response.status_code,
                weather_response.text
            )

            raise HTTPException(
                status_code=502,
                detail=(
                    "Unable to retrieve live weather data. "
                    f"Open-Meteo returned "
                    f"{weather_response.status_code}."
                )
            )

        # -------------------------------------------------
        # ELEVATION ERROR
        # -------------------------------------------------

        if elevation_response.status_code != 200:

            print(
                "OPEN-METEO ELEVATION ERROR:",
                elevation_response.status_code,
                elevation_response.text
            )

            raise HTTPException(
                status_code=502,
                detail=(
                    "Unable to retrieve elevation data. "
                    f"Open-Meteo returned "
                    f"{elevation_response.status_code}."
                )
            )

        # -------------------------------------------------
        # CONVERT RESPONSE TO JSON
        # -------------------------------------------------

        try:
            weather_data = weather_response.json()
            elevation_data = elevation_response.json()

        except Exception as exc:

            print(
                "JSON PARSING ERROR:",
                str(exc)
            )

            raise HTTPException(
                status_code=502,
                detail="Environmental data service returned invalid data."
            )

    # -----------------------------------------------------
    # NETWORK ERROR
    # -----------------------------------------------------

    except httpx.RequestError as exc:

        print(
            "OPEN-METEO REQUEST ERROR:",
            str(exc)
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Environmental data service unavailable."
            )
        )

    # =====================================================
    # EXTRACT WEATHER DATA
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

    # Soil moisture is returned as m³/m³
    soil_moisture_raw = float(
        current.get(
            "soil_moisture_0_to_1cm",
            0
        )
    )

    # Convert to percentage
    soil_moisture = (
        soil_moisture_raw * 100
    )

    # =====================================================
    # EXTRACT ELEVATION
    # =====================================================

    elevation_values = elevation_data.get(
        "elevation",
        []
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
    # This is a prototype estimate.
    # It is NOT measured terrain slope.
    #
    # For a production disaster-management system,
    # replace this with DEM/GIS-derived slope.
    #
    # =====================================================

    slope = estimate_slope(
        latitude,
        longitude
    )

    # =====================================================
    # MACHINE LEARNING INPUT
    # =====================================================

    input_data = [[
        rainfall,
        soil_moisture,
        slope,
        elevation
    ]]

    # =====================================================
    # ML PREDICTION
    # =====================================================

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

    # =====================================================
    # RISK PERCENTAGE
    # =====================================================

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
    # FINAL RESPONSE
    # =====================================================

    return {

        "latitude": round(
            latitude,
            6
        ),

        "longitude": round(
            longitude,
            6
        ),

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
# PROTOTYPE SLOPE ESTIMATION
# =========================================================

def estimate_slope(
    latitude: float,
    longitude: float
):

    # Northern Himalayan region
    if latitude >= 27:
        return 25.0

    # North-East / Himalayan foothills
    if latitude >= 24:
        return 20.0

    # Central / Western regions
    if latitude >= 20:
        return 15.0

    # Southern / lower latitude regions
    return 8.0


# =========================================================
# RISK DATA ENDPOINT
# =========================================================

@app.get("/risk-data")
def get_risk_data():

    return {
        "message": "Risk data endpoint is working"
    }


# =========================================================
# CITIZEN REPORTING
# =========================================================

REPORTS_FILE = os.path.join(
    os.path.dirname(__file__),
    "reports.json"
)


# =========================================================
# LOAD REPORTS
# =========================================================

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


# =========================================================
# SAVE REPORTS
# =========================================================

def save_reports(
    reports
):

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
# CREATE CITIZEN REPORT
# =========================================================

@app.post("/reports")
async def create_report(

    location: str = Form(...),

    description: str = Form(...),

    file: UploadFile | None = File(None)

):

    reports = load_reports()

    # Generate report ID
    report_id = len(reports) + 1

    file_name = None

    # -----------------------------------------------------
    # SAVE UPLOADED FILE
    # -----------------------------------------------------

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
            file.filename
            or "uploaded_file"
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

    # -----------------------------------------------------
    # CREATE REPORT OBJECT
    # -----------------------------------------------------

    report = {

        "id": report_id,

        "location": location,

        "description": description,

        "file": file_name,

        "status": "Submitted",

        "time": datetime.now().isoformat()

    }

    reports.append(
        report
    )

    save_reports(
        reports
    )

    return {

        "message":
            "Landslide report submitted successfully!",

        "report": report
    }


# =========================================================
# GET ALL REPORTS
# =========================================================

@app.get("/reports")
def get_reports():

    reports = load_reports()

    return {

        "count": len(reports),

        "reports": reports

    }