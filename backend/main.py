
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import joblib
import os
import json
import asyncio
import time
import httpx


# =========================================================
# APP
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
# LOAD ML MODEL
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
# REQUEST MODELS
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
# SIMPLE ENVIRONMENT DATA CACHE
# =========================================================

# Cache lifetime: 5 minutes
CACHE_DURATION = 300

# Stores:
# {
#   "lat,lon": {
#       "timestamp": ...,
#       "weather": {...},
#       "elevation": ...
#   }
# }
environment_cache = {}


def get_cache_key(latitude: float, longitude: float):
    """
    Round coordinates so nearby clicks don't create
    hundreds of different API requests.
    """
    rounded_lat = round(latitude, 3)
    rounded_lon = round(longitude, 3)

    return f"{rounded_lat},{rounded_lon}"


def get_cached_data(cache_key):
    """
    Return cached data if it is still valid.
    """
    cached = environment_cache.get(cache_key)

    if cached is None:
        return None

    age = time.time() - cached["timestamp"]

    if age <= CACHE_DURATION:
        print(
            f"Using cached environmental data "
            f"(age: {round(age)} seconds)"
        )
        return cached

    print("Cached data expired.")
    environment_cache.pop(cache_key, None)

    return None


def save_cached_data(
    cache_key,
    weather_data,
    elevation_data
):
    """
    Save successful API response in memory.
    """

    environment_cache[cache_key] = {
        "timestamp": time.time(),
        "weather": weather_data,
        "elevation": elevation_data
    }

    print(
        f"Environmental data cached for {cache_key}"
    )


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
# BASIC ML PREDICTION
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

    probabilities = model.predict_proba(input_data)[0]
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
# PROTOTYPE SLOPE ESTIMATION
# =========================================================

def estimate_slope(
    latitude: float,
    longitude: float
):
    """
    Prototype slope estimation.

    IMPORTANT:
    This is NOT actual GIS-derived slope.
    Replace with DEM/GIS slope calculation
    for production-level accuracy.
    """

    if latitude >= 27:
        return 25.0

    if latitude >= 24:
        return 20.0

    if latitude >= 20:
        return 15.0

    return 8.0


# =========================================================
# OPEN-METEO REQUEST WITH RETRIES
# =========================================================

async def get_open_meteo_data(
    latitude: float,
    longitude: float
):

    weather_url = (
        "https://api.open-meteo.com/v1/forecast"
    )

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

    elevation_url = (
        "https://api.open-meteo.com/v1/elevation"
    )

    elevation_params = {
        "latitude": latitude,
        "longitude": longitude
    }

    async with httpx.AsyncClient(
        timeout=30.0,
        follow_redirects=True,
        headers={
            "User-Agent": "GeoGuard-AI/1.0"
        }
    ) as client:

        weather_response = None
        elevation_response = None

        # -------------------------------------------------
        # WEATHER REQUEST
        # -------------------------------------------------

        for attempt in range(3):

            print(
                f"Open-Meteo weather request "
                f"{attempt + 1}/3"
            )

            weather_response = await client.get(
                weather_url,
                params=weather_params
            )

            print(
                "Weather status:",
                weather_response.status_code
            )

            if weather_response.status_code != 429:
                break

            if attempt < 2:

                wait_time = 3 * (attempt + 1)

                print(
                    f"Rate limited. "
                    f"Waiting {wait_time} seconds..."
                )

                await asyncio.sleep(
                    wait_time
                )

        # -------------------------------------------------
        # ELEVATION REQUEST
        # -------------------------------------------------

        for attempt in range(3):

            print(
                f"Open-Meteo elevation request "
                f"{attempt + 1}/3"
            )

            elevation_response = await client.get(
                elevation_url,
                params=elevation_params
            )

            print(
                "Elevation status:",
                elevation_response.status_code
            )

            if elevation_response.status_code != 429:
                break

            if attempt < 2:

                wait_time = 3 * (attempt + 1)

                print(
                    f"Elevation rate limited. "
                    f"Waiting {wait_time} seconds..."
                )

                await asyncio.sleep(
                    wait_time
                )

        # -------------------------------------------------
        # CHECK WEATHER
        # -------------------------------------------------

        if weather_response.status_code != 200:

            print(
                "OPEN-METEO WEATHER ERROR:",
                weather_response.status_code,
                weather_response.text
            )

            if weather_response.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Open-Meteo returned 429"
                )

            raise HTTPException(
                status_code=502,
                detail="Unable to retrieve live weather data."
            )

        # -------------------------------------------------
        # CHECK ELEVATION
        # -------------------------------------------------

        if elevation_response.status_code != 200:

            print(
                "OPEN-METEO ELEVATION ERROR:",
                elevation_response.status_code,
                elevation_response.text
            )

            if elevation_response.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Open-Meteo elevation returned 429"
                )

            raise HTTPException(
                status_code=502,
                detail="Unable to retrieve elevation data."
            )

        # -------------------------------------------------
        # PARSE JSON
        # -------------------------------------------------

        try:

            weather_data = (
                weather_response.json()
            )

            elevation_data = (
                elevation_response.json()
            )

        except Exception as exc:

            print(
                "JSON PARSING ERROR:",
                str(exc)
            )

            raise HTTPException(
                status_code=502,
                detail=(
                    "Environmental data service "
                    "returned invalid data."
                )
            )

        return (
            weather_data,
            elevation_data
        )


# =========================================================
# LOCATION BASED PREDICTION
# =========================================================

@app.post("/predict-location")
async def predict_location(
    data: MapLocation
):

    latitude = data.latitude
    longitude = data.longitude

    # -----------------------------------------------------
    # INDIA BOUNDARY CHECK
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
    # CACHE KEY
    # -----------------------------------------------------

    cache_key = get_cache_key(
        latitude,
        longitude
    )

    cached = get_cached_data(
        cache_key
    )

    # -----------------------------------------------------
    # TRY CACHE FIRST
    # -----------------------------------------------------

    data_source = "live"

    if cached is not None:

        weather_data = cached["weather"]
        elevation_data = cached["elevation"]

        data_source = "cached"

    else:

        # -------------------------------------------------
        # GET LIVE OPEN-METEO DATA
        # -------------------------------------------------

        try:

            (
                weather_data,
                elevation_data
            ) = await get_open_meteo_data(
                latitude,
                longitude
            )

            # Save successful response
            save_cached_data(
                cache_key,
                weather_data,
                elevation_data
            )

        except HTTPException as exc:

            # -------------------------------------------------
            # IF OPEN-METEO IS RATE LIMITED,
            # TRY OLD CACHE EVEN IF EXPIRED
            # -------------------------------------------------

            if exc.status_code == 429:

                old_cache = (
                    environment_cache.get(
                        cache_key
                    )
                )

                if old_cache is not None:

                    print(
                        "Open-Meteo rate limited."
                    )

                    print(
                        "Using previous cached data."
                    )

                    weather_data = (
                        old_cache["weather"]
                    )

                    elevation_data = (
                        old_cache["elevation"]
                    )

                    data_source = "cached"

                else:

                    raise HTTPException(
                        status_code=503,
                        detail=(
                            "Live environmental "
                            "data service is temporarily "
                            "rate-limited. Please try "
                            "again after a few seconds."
                        )
                    )

            else:

                raise exc

        except httpx.RequestError as exc:

            print(
                "OPEN-METEO REQUEST ERROR:",
                str(exc)
            )

            old_cache = (
                environment_cache.get(
                    cache_key
                )
            )

            if old_cache is not None:

                print(
                    "Using previous cached data "
                    "because Open-Meteo is unavailable."
                )

                weather_data = (
                    old_cache["weather"]
                )

                elevation_data = (
                    old_cache["elevation"]
                )

                data_source = "cached"

            else:

                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Environmental data service "
                        "is temporarily unavailable."
                    )
                )

    # =====================================================
    # EXTRACT WEATHER
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

    soil_moisture_raw = float(
        current.get(
            "soil_moisture_0_to_1cm",
            0
        )
    )

    # Convert m³/m³ to percentage
    soil_moisture = (
        soil_moisture_raw * 100
    )

    # =====================================================
    # ELEVATION
    # =====================================================

    elevation_values = (
        elevation_data.get(
            "elevation",
            []
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

    slope = estimate_slope(
        latitude,
        longitude
    )

    # =====================================================
    # ML INPUT
    # =====================================================

    input_data = [[
        rainfall,
        soil_moisture,
        slope,
        elevation
    ]]

    # =====================================================
    # PREDICTION
    # =====================================================

    prediction = int(
        model.predict(input_data)[0]
    )

    probabilities = (
        model.predict_proba(input_data)[0]
    )

    classes = list(
        model.classes_
    )

    if 2 in classes:

        high_index = (
            classes.index(2)
        )

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

        "risk_percentage": (
            risk_percentage
        ),

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
        ),

        "data_source": data_source,

        "cache_duration_minutes": 5
    }


# =========================================================
# RISK DATA
# =========================================================

@app.get("/risk-data")
def get_risk_data():

    return {
        "message": "Risk data endpoint is working"
    }


# =========================================================
# REPORT SYSTEM
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

    report_id = (
        len(reports) + 1
    )

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
    # CREATE REPORT
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
# GET REPORTS
# =========================================================

@app.get("/reports")
def get_reports():

    reports = load_reports()

    return {

        "count": len(reports),

        "reports": reports
    }
