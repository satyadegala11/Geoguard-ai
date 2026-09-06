from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import joblib
import os
import json
import requests


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="GeoGuard AI",
    version="1.0.0",
    description="AI-Based Early Warning & Landslide Risk Monitoring System"
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

model = joblib.load(MODEL_PATH)

print("ML model loaded successfully.")


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
# COMMON ML PREDICTION FUNCTION
# =========================================================

def run_prediction(
    rainfall,
    soil_moisture,
    slope,
    elevation
):

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

    classes = list(model.classes_)

    # -----------------------------------------------------
    # Probability of high-risk class
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # Risk classification
    # -----------------------------------------------------

    if risk_percentage >= 70:

        risk = "High"

    elif risk_percentage >= 40:

        risk = "Medium"

    else:

        risk = "Low"

    return {
        "prediction": prediction,

        "risk_level": risk,

        "landslide_probability": round(
            landslide_probability,
            4
        ),

        "risk_percentage": risk_percentage
    }


# =========================================================
# NORMAL PREDICTION
# =========================================================

@app.post("/predict")
def predict(data: LandslideData):

    result = run_prediction(
        data.rainfall,
        data.soil_moisture,
        data.slope,
        data.elevation
    )

    return {
        **result,

        "rainfall": data.rainfall,

        "soil_moisture": data.soil_moisture,

        "slope": data.slope,

        "elevation": data.elevation
    }


# =========================================================
# LIVE WEATHER
# =========================================================

def get_live_weather(latitude, longitude):

    try:

        url = "https://api.open-meteo.com/v1/forecast"

        params = {
            "latitude": latitude,
            "longitude": longitude,

            "current": (
                "temperature_2m,"
                "relative_humidity_2m,"
                "precipitation,"
                "rain"
            ),

            "hourly": (
                "precipitation,"
                "soil_moisture_0_to_1cm,"
                "soil_moisture_1_to_3cm,"
                "soil_moisture_3_to_9cm"
            ),

            "forecast_days": 1,

            "timezone": "auto"
        }

        response = requests.get(
            url,
            params=params,
            timeout=15
        )

        response.raise_for_status()

        weather = response.json()

        current = weather.get(
            "current",
            {}
        )

        hourly = weather.get(
            "hourly",
            {}
        )

        precipitation = current.get(
            "precipitation",
            0
        )

        rain = current.get(
            "rain",
            0
        )

        # -------------------------------------------------
        # Soil moisture
        # -------------------------------------------------

        soil_values = []

        for key in [
            "soil_moisture_0_to_1cm",
            "soil_moisture_1_to_3cm",
            "soil_moisture_3_to_9cm"
        ]:

            values = hourly.get(
                key,
                []
            )

            if values:

                valid_values = [
                    float(v)
                    for v in values
                    if v is not None
                ]

                if valid_values:

                    soil_values.extend(
                        valid_values
                    )

        if soil_values:

            soil_moisture = (
                sum(soil_values) /
                len(soil_values)
            ) * 100

        else:

            soil_moisture = 0

        return {

            "rainfall": round(
                float(
                    max(
                        precipitation,
                        rain
                    )
                ),
                2
            ),

            "soil_moisture": round(
                soil_moisture,
                2
            ),

            "weather_source":
                "Open-Meteo"

        }

    except Exception as error:

        print(
            "Weather API error:",
            error
        )

        return None


# =========================================================
# TOMORROW WEATHER FORECAST
# =========================================================

def get_tomorrow_weather(
    latitude,
    longitude
):

    try:

        url = "https://api.open-meteo.com/v1/forecast"

        params = {

            "latitude": latitude,

            "longitude": longitude,

            "daily": (
                "precipitation_sum,"
                "rain_sum"
            ),

            "forecast_days": 2,

            "timezone": "auto"

        }

        response = requests.get(
            url,
            params=params,
            timeout=15
        )

        response.raise_for_status()

        weather = response.json()

        daily = weather.get(
            "daily",
            {}
        )

        precipitation_values = daily.get(
            "precipitation_sum",
            []
        )

        rain_values = daily.get(
            "rain_sum",
            []
        )

        # -------------------------------------------------
        # Tomorrow is index 1
        # -------------------------------------------------

        tomorrow_precipitation = 0

        tomorrow_rain = 0

        if len(
            precipitation_values
        ) > 1:

            tomorrow_precipitation = (
                precipitation_values[1] or 0
            )

        if len(
            rain_values
        ) > 1:

            tomorrow_rain = (
                rain_values[1] or 0
            )

        tomorrow_rainfall = max(
            float(tomorrow_precipitation),
            float(tomorrow_rain)
        )

        return {

            "rainfall": round(
                tomorrow_rainfall,
                2
            ),

            "weather_source":
                "Open-Meteo forecast"

        }

    except Exception as error:

        print(
            "Tomorrow weather API error:",
            error
        )

        return None


# =========================================================
# REAL ELEVATION
# =========================================================

def get_real_elevation(
    latitude,
    longitude
):

    try:

        url = (
            "https://api.open-meteo.com/v1/forecast"
        )

        params = {

            "latitude": latitude,

            "longitude": longitude,

            "current": "elevation"

        }

        response = requests.get(
            url,
            params=params,
            timeout=15
        )

        response.raise_for_status()

        data = response.json()

        elevation = data.get(
            "elevation"
        )

        if elevation is None:

            return None

        return round(
            float(elevation),
            2
        )

    except Exception as error:

        print(
            "Elevation API error:",
            error
        )

        return None


# =========================================================
# SLOPE ESTIMATION
# =========================================================

def estimate_slope(
    latitude,
    longitude
):

    if latitude >= 27:

        return 25.0

    if latitude >= 24:

        return 20.0

    if latitude >= 20:

        return 15.0

    return 8.0


# =========================================================
# FALLBACK ELEVATION
# =========================================================

def estimate_elevation(
    latitude,
    longitude
):

    if latitude >= 28:

        return 1800.0

    if latitude >= 25:

        return 1200.0

    if latitude >= 22:

        return 600.0

    if latitude >= 18:

        return 300.0

    return 150.0


# =========================================================
# FALLBACK WEATHER
# =========================================================

def estimate_rainfall(
    latitude,
    longitude
):

    if latitude >= 24 and longitude >= 88:

        return 20.0

    if latitude >= 25 and longitude >= 80:

        return 12.0

    if latitude >= 20 and longitude >= 85:

        return 8.0

    return 5.0


def estimate_soil_moisture(
    latitude,
    longitude
):

    if latitude >= 24 and longitude >= 88:

        return 60.0

    if latitude >= 20:

        return 50.0

    return 40.0


# =========================================================
# MAP PREDICTION
# =========================================================

@app.post("/predict-location")
def predict_location(
    data: MapLocation
):

    latitude = data.latitude

    longitude = data.longitude

    # -----------------------------------------------------
    # India validation
    # -----------------------------------------------------

    if latitude < 6 or latitude > 38:

        return {
            "error":
                "Please select a location within India."
        }

    if longitude < 68 or longitude > 98:

        return {
            "error":
                "Please select a location within India."
        }

    # -----------------------------------------------------
    # LIVE WEATHER
    # -----------------------------------------------------

    weather = get_live_weather(
        latitude,
        longitude
    )

    if weather:

        rainfall = weather[
            "rainfall"
        ]

        soil_moisture = weather[
            "soil_moisture"
        ]

        weather_source = weather[
            "weather_source"
        ]

    else:

        rainfall = estimate_rainfall(
            latitude,
            longitude
        )

        soil_moisture = estimate_soil_moisture(
            latitude,
            longitude
        )

        weather_source = (
            "prototype fallback"
        )

    # -----------------------------------------------------
    # REAL ELEVATION
    # -----------------------------------------------------

    elevation = get_real_elevation(
        latitude,
        longitude
    )

    if elevation is None:

        elevation = estimate_elevation(
            latitude,
            longitude
        )

        elevation_source = (
            "prototype fallback"
        )

    else:

        elevation_source = (
            "Open-Meteo Elevation API"
        )

    # -----------------------------------------------------
    # SLOPE
    # -----------------------------------------------------

    slope = estimate_slope(
        latitude,
        longitude
    )

    # -----------------------------------------------------
    # ML
    # -----------------------------------------------------

    result = run_prediction(
        rainfall,
        soil_moisture,
        slope,
        elevation
    )

    return {

        "latitude": latitude,

        "longitude": longitude,

        **result,

        "rainfall": round(
            rainfall,
            2
        ),

        "soil_moisture": round(
            soil_moisture,
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

        "data_source":
            "live weather + real elevation",

        "weather_source":
            weather_source,

        "elevation_source":
            elevation_source
    }


# =========================================================
# TOMORROW SOIL MOISTURE
# =========================================================

def estimate_tomorrow_soil_moisture(
    latitude,
    longitude
):

    weather = get_live_weather(
        latitude,
        longitude
    )

    if weather:

        current = weather[
            "soil_moisture"
        ]

        return round(
            current,
            2
        )

    return round(
        estimate_soil_moisture(
            latitude,
            longitude
        ),
        2
    )


# =========================================================
# TOMORROW PREDICTION
# =========================================================

@app.post("/tomorrow-predict")
def tomorrow_predict(
    data: MapLocation
):

    latitude = data.latitude

    longitude = data.longitude

    # -----------------------------------------------------
    # India validation
    # -----------------------------------------------------

    if latitude < 6 or latitude > 38:

        return {
            "error":
                "Please select a location within India."
        }

    if longitude < 68 or longitude > 98:

        return {
            "error":
                "Please select a location within India."
        }

    # -----------------------------------------------------
    # REAL TOMORROW RAINFALL FORECAST
    # -----------------------------------------------------

    tomorrow_weather = get_tomorrow_weather(
        latitude,
        longitude
    )

    if tomorrow_weather:

        rainfall = tomorrow_weather[
            "rainfall"
        ]

        weather_source = tomorrow_weather[
            "weather_source"
        ]

    else:

        current = estimate_rainfall(
            latitude,
            longitude
        )

        rainfall = round(
            current * 0.40,
            2
        )

        weather_source = (
            "prototype forecast fallback"
        )

    # -----------------------------------------------------
    # TOMORROW SOIL MOISTURE
    # -----------------------------------------------------

    soil_moisture = (
        estimate_tomorrow_soil_moisture(
            latitude,
            longitude
        )
    )

    # -----------------------------------------------------
    # REAL ELEVATION
    # -----------------------------------------------------

    elevation = get_real_elevation(
        latitude,
        longitude
    )

    if elevation is None:

        elevation = estimate_elevation(
            latitude,
            longitude
        )

        elevation_source = (
            "prototype fallback"
        )

    else:

        elevation_source = (
            "Open-Meteo Elevation API"
        )

    # -----------------------------------------------------
    # SLOPE
    # -----------------------------------------------------

    slope = estimate_slope(
        latitude,
        longitude
    )

    # -----------------------------------------------------
    # ML PREDICTION
    # -----------------------------------------------------

    result = run_prediction(
        rainfall,
        soil_moisture,
        slope,
        elevation
    )

    return {

        "latitude": latitude,

        "longitude": longitude,

        "forecast":
            "Tomorrow",

        **result,

        "rainfall": round(
            rainfall,
            2
        ),

        "soil_moisture": round(
            soil_moisture,
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

        "data_source":
            "live weather forecast + real elevation",

        "weather_source":
            weather_source,

        "elevation_source":
            elevation_source
    }


# =========================================================
# RISK DATA
# =========================================================

@app.get("/risk-data")
def get_risk_data():

    return {
        "message":
            "Risk data endpoint is working"
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

    report_id = len(
        reports
    ) + 1

    file_name = None

    # -----------------------------------------------------
    # Save uploaded file
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

    # -----------------------------------------------------
    # Create report
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

        "report":
            report
    }


# =========================================================
# GET REPORTS
# =========================================================

@app.get("/reports")
def get_reports():

    reports = load_reports()

    return {

        "count":
            len(reports),

        "reports":
            reports
    }