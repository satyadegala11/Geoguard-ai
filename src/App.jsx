import { useEffect, useState } from "react";
import "./App.css";
import RiskMap from "./RiskMap";

const API_URL = "http://127.0.0.1:8000";

/* =========================================================
   MONITORED LOCATIONS
========================================================= */

const locations = {
  Guwahati: {
    state: "Assam",
    slope: 10,
    elevation: 50,
    soilMoisture: 33,
    latitude: 26.1445,
    longitude: 91.7362,
  },

  Shillong: {
    state: "Meghalaya",
    slope: 20,
    elevation: 1500,
    soilMoisture: 36,
    latitude: 25.5788,
    longitude: 91.8933,
  },

  Gangtok: {
    state: "Sikkim",
    slope: 25,
    elevation: 1700,
    soilMoisture: 33,
    latitude: 27.3389,
    longitude: 88.6065,
  },

  Aizawl: {
    state: "Mizoram",
    slope: 22,
    elevation: 1100,
    soilMoisture: 33,
    latitude: 23.7271,
    longitude: 92.7176,
  },

  Itanagar: {
    state: "Arunachal Pradesh",
    slope: 18,
    elevation: 500,
    soilMoisture: 31,
    latitude: 27.0844,
    longitude: 93.6053,
  },
};

/* =========================================================
   NORMAL ENVIRONMENTAL RANGES
========================================================= */

const normalRanges = {
  rainfall: {
    min: 0,
    max: 20,
    unit: "mm",
    warning: 20,
    high: 50,
  },

  soilMoisture: {
    min: 20,
    max: 40,
    unit: "%",
    warning: 40,
    high: 60,
  },

  slope: {
    min: 0,
    max: 15,
    unit: "°",
    warning: 15,
    high: 30,
  },

  elevation: {
    min: 0,
    max: 1500,
    unit: "m",
    warning: 1500,
    high: 2500,
  },
};

/* =========================================================
   APP
========================================================= */

function App() {
  const [page, setPage] = useState("home");

  const [selectedLocation, setSelectedLocation] =
    useState("Guwahati");

  const [rainfall, setRainfall] = useState("");

  const [soilMoisture, setSoilMoisture] =
    useState(33);

  const [slope, setSlope] = useState(10);

  const [elevation, setElevation] = useState(50);

  const [riskResult, setRiskResult] = useState("");

  const [riskPercentage, setRiskPercentage] =
    useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [weather, setWeather] = useState(null);

  const [weatherLoading, setWeatherLoading] =
    useState(false);

  const [weatherError, setWeatherError] =
    useState("");

  const [alerts, setAlerts] = useState([]);

  const [alertsLoading, setAlertsLoading] =
    useState(false);

  const [alertsError, setAlertsError] =
    useState("");

  const [reportSubmitted, setReportSubmitted] =
    useState(false);

  const [reportLoading, setReportLoading] =
    useState(false);

  const [reportError, setReportError] =
    useState("");

  /* =========================================================
     LOCATION CHANGE
  ========================================================= */

  const handleLocationChange = (name) => {
    const location = locations[name];

    setSelectedLocation(name);

    setSoilMoisture(location.soilMoisture);
    setSlope(location.slope);
    setElevation(location.elevation);

    setRainfall("");

    setRiskResult("");
    setRiskPercentage(null);

    setWeather(null);

    setError("");
    setWeatherError("");
  };

  /* =========================================================
     GET RISK CLASS
  ========================================================= */

  const getRiskClass = (risk) => {
    if (!risk) return "";

    return risk.toLowerCase();
  };

  /* =========================================================
     AI PREDICTION
  ========================================================= */

  const predictRisk = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    setRiskResult("");
    setRiskPercentage(null);

    try {
      const response = await fetch(
        `${API_URL}/predict`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            rainfall: Number(rainfall),

            soil_moisture:
              Number(soilMoisture),

            slope: Number(slope),

            elevation:
              Number(elevation),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Prediction failed"
        );
      }

      const data =
        await response.json();

      setRiskResult(data.risk_level);

      if (
        data.risk_percentage !==
        undefined
      ) {
        setRiskPercentage(
          Number(data.risk_percentage)
        );
      } else if (
        data.landslide_probability !==
        undefined
      ) {
        setRiskPercentage(
          Math.round(
            Number(
              data.landslide_probability
            ) * 100
          )
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        "Unable to connect to AI server. Make sure FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     LIVE WEATHER + AI
  ========================================================= */

  const getWeather = async () => {
    setWeatherLoading(true);

    setWeatherError("");

    setRiskResult("");

    setRiskPercentage(null);

    try {
      const location =
        locations[selectedLocation];

      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${location.latitude}` +
        `&longitude=${location.longitude}` +
        `&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m`;

      const weatherResponse =
        await fetch(weatherUrl);

      if (!weatherResponse.ok) {
        throw new Error(
          "Weather request failed"
        );
      }

      const weatherData =
        await weatherResponse.json();

      setWeather(
        weatherData.current
      );

      const currentRain =
        Number(
          weatherData.current.rain || 0
        );

      setRainfall(currentRain);

      const predictionResponse =
        await fetch(
          `${API_URL}/predict`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              rainfall:
                currentRain,

              soil_moisture:
                Number(
                  soilMoisture
                ),

              slope:
                Number(slope),

              elevation:
                Number(elevation),
            }),
          }
        );

      if (!predictionResponse.ok) {
        throw new Error(
          "AI prediction failed"
        );
      }

      const prediction =
        await predictionResponse.json();

      setRiskResult(
        prediction.risk_level
      );

      if (
        prediction.risk_percentage !==
        undefined
      ) {
        setRiskPercentage(
          Number(
            prediction.risk_percentage
          )
        );
      } else if (
        prediction.landslide_probability !==
        undefined
      ) {
        setRiskPercentage(
          Math.round(
            Number(
              prediction.landslide_probability
            ) * 100
          )
        );
      }
    } catch (err) {
      console.error(err);

      setWeatherError(
        "Unable to load weather or AI prediction."
      );
    } finally {
      setWeatherLoading(false);
    }
  };

  /* =========================================================
     GENERATE ALERTS
  ========================================================= */

  const generateAlerts = async () => {
    setAlertsLoading(true);

    setAlertsError("");

    try {
      const results =
        await Promise.all(
          Object.entries(
            locations
          ).map(
            async ([
              name,
              location,
            ]) => {
              const weatherUrl =
                `https://api.open-meteo.com/v1/forecast` +
                `?latitude=${location.latitude}` +
                `&longitude=${location.longitude}` +
                `&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m`;

              const weatherResponse =
                await fetch(
                  weatherUrl
                );

              if (
                !weatherResponse.ok
              ) {
                throw new Error(
                  "Weather failed"
                );
              }

              const weatherData =
                await weatherResponse.json();

              const current =
                weatherData.current;

              const currentRain =
                Number(
                  current.rain || 0
                );

              const predictionResponse =
                await fetch(
                  `${API_URL}/predict`,
                  {
                    method: "POST",

                    headers: {
                      "Content-Type":
                        "application/json",
                    },

                    body: JSON.stringify({
                      rainfall:
                        currentRain,

                      soil_moisture:
                        location.soilMoisture,

                      slope:
                        location.slope,

                      elevation:
                        location.elevation,
                    }),
                  }
                );

              if (
                !predictionResponse.ok
              ) {
                throw new Error(
                  "Prediction failed"
                );
              }

              const prediction =
                await predictionResponse.json();

              let probability = 0;

              if (
                prediction.risk_percentage !==
                undefined
              ) {
                probability =
                  Number(
                    prediction.risk_percentage
                  );
              } else if (
                prediction.landslide_probability !==
                undefined
              ) {
                probability =
                  Math.round(
                    Number(
                      prediction.landslide_probability
                    ) * 100
                  );
              }

              let message = "";
              let action = "";

              if (
                prediction.risk_level ===
                "High"
              ) {
                message =
                  "High landslide risk detected.";

                action =
                  "Immediate monitoring and early warning recommended.";
              } else if (
                prediction.risk_level ===
                "Medium"
              ) {
                message =
                  "Moderate landslide risk detected.";

                action =
                  "Continue monitoring environmental conditions.";
              } else {
                message =
                  "No immediate landslide warning.";

                action =
                  "Continue normal monitoring.";
              }

              return {
                location:
                  name,

                state:
                  location.state,

                risk:
                  prediction.risk_level,

                probability,

                rainfall:
                  currentRain,

                soilMoisture:
                  location.soilMoisture,

                humidity:
                  current.relative_humidity_2m,

                temperature:
                  current.temperature_2m,

                slope:
                  location.slope,

                elevation:
                  location.elevation,

                message,

                action,

                time:
                  new Date().toLocaleTimeString(),
              };
            }
          )
        );

      setAlerts(results);
    } catch (err) {
      console.error(err);

      setAlertsError(
        "Unable to load alerts. Make sure FastAPI is running."
      );
    } finally {
      setAlertsLoading(false);
    }
  };

  /* =========================================================
     LOAD ALERTS
  ========================================================= */

  useEffect(() => {
    if (
      page === "alerts" &&
      alerts.length === 0
    ) {
      generateAlerts();
    }
  }, [page]);

  /* =========================================================
     HOME
  ========================================================= */

  const Home = () => (
    <section className="hero">

      <div className="hero-content">

        <span className="badge">
          🛰️ AI-POWERED DISASTER MONITORING
        </span>

        <h1>
          GeoGuard AI
        </h1>

        <h2>
          Predict. Map. Alert. Respond.
        </h2>

        <p>
          An AI-based early warning and
          landslide risk monitoring system
          designed to protect communities
          in landslide-prone regions.
        </p>

        <div className="hero-buttons">

          <button
            onClick={() =>
              setPage("dashboard")
            }
          >
            🚀 Open Dashboard
          </button>

          <button
            className="secondary-btn"
            onClick={() =>
              setPage("riskmap")
            }
          >
            🌍 View Risk Map
          </button>

        </div>

      </div>

      <div className="hero-visual">

        <div className="earth-card">
          🌍
        </div>

        <div className="floating-card">
          🤖 AI Risk Analysis
          <br />
          <strong>
            Real-Time Monitoring
          </strong>
        </div>

      </div>

    </section>
  );

  /* =========================================================
     NORMAL RANGE SECTION
  ========================================================= */

  const NormalRanges = () => (
    <div className="weather-card">

      <h2>
        📊 Normal Environmental Ranges
      </h2>

      <p>
        These are general monitoring thresholds
        used by GeoGuard AI. Values beyond the
        warning range can indicate increasing
        landslide risk.
      </p>

      <div className="weather-grid">

        <div>
          🌧️
          <strong>
            0–20 mm
          </strong>
          <span>
            Normal Rainfall
          </span>
        </div>

        <div>
          💧
          <strong>
            20–40%
          </strong>
          <span>
            Normal Soil Moisture
          </span>
        </div>

        <div>
          ⛰️
          <strong>
            0–15°
          </strong>
          <span>
            Normal Slope
          </span>
        </div>

        <div>
          📏
          <strong>
            0–1500 m
          </strong>
          <span>
            Typical Elevation
          </span>
        </div>

      </div>

      <div className="ai-status">

        ⚠️ <strong>Risk Monitoring Thresholds:</strong>

        <br /><br />

        🌧️ Rainfall:
        Above 20 mm → increased monitoring
        <br />

        💧 Soil Moisture:
        Above 40% → increased monitoring
        <br />

        ⛰️ Slope:
        Above 15° → increased monitoring
        <br />

        📏 Elevation:
        Above 1500 m → increased monitoring

        <br /><br />

        🔴 Multiple parameters exceeding
        thresholds may indicate higher
        landslide risk.

      </div>

    </div>
  );

  /* =========================================================
     DASHBOARD
  ========================================================= */

  const Dashboard = () => (
    <section className="page-section">

      <span className="badge">
        📊 MONITORING DASHBOARD
      </span>

      <h1>
        Landslide Risk Dashboard
      </h1>

      <p>
        Monitor environmental conditions
        and predict landslide risk using AI.
      </p>

      {/* NORMAL RANGES */}

      <NormalRanges />

      {/* WEATHER */}

      <div className="weather-card">

        <div>

          <h2>
            🌦️ Live Weather —
            {" "}
            {selectedLocation}
          </h2>

          <p>
            Current weather conditions
          </p>

        </div>

        <button
          onClick={getWeather}
          disabled={weatherLoading}
        >
          {weatherLoading
            ? "🤖 Analyzing..."
            : "🌦️ Get Live Weather"}
        </button>

        {weather && (

          <div className="weather-grid">

            <div>
              🌡️
              <strong>
                {weather.temperature_2m}°C
              </strong>
              <span>
                Temperature
              </span>
            </div>

            <div>
              💧
              <strong>
                {weather.relative_humidity_2m}%
              </strong>
              <span>
                Humidity
              </span>
            </div>

            <div>
              🌧️
              <strong>
                {weather.rain} mm
              </strong>
              <span>
                Rainfall
              </span>
            </div>

            <div>
              💨
              <strong>
                {weather.wind_speed_10m}
              </strong>
              <span>
                Wind km/h
              </span>
            </div>

          </div>

        )}

        {weatherError && (
          <p className="error">
            {weatherError}
          </p>
        )}

      </div>

      {/* AI PREDICTION */}

      <div className="ai-card">

        <h2>
          🤖 AI Landslide Risk Prediction
        </h2>

        <p>
          Select a location and enter
          environmental parameters to
          calculate its landslide risk.
        </p>

        <form
          onSubmit={predictRisk}
          className="prediction-form"
        >

          <label>
            📍 Location

            <select
              value={selectedLocation}
              onChange={(e) =>
                handleLocationChange(
                  e.target.value
                )
              }
            >

              {Object.keys(
                locations
              ).map((name) => (

                <option
                  key={name}
                  value={name}
                >
                  {name}
                </option>

              ))}

            </select>

          </label>

          <label>
            🌧️ Rainfall (mm)

            <input
              type="number"
              step="0.1"
              placeholder="Enter rainfall"
              value={rainfall}
              onChange={(e) =>
                setRainfall(
                  e.target.value
                )
              }
              required
            />

          </label>

          <label>
            💧 Soil Moisture (%)

            <input
              type="number"
              value={soilMoisture}
              onChange={(e) =>
                setSoilMoisture(
                  e.target.value
                )
              }
              required
            />

          </label>

          <label>
            ⛰️ Slope (degrees)

            <input
              type="number"
              value={slope}
              onChange={(e) =>
                setSlope(
                  e.target.value
                )
              }
              required
            />

          </label>

          <label>
            📏 Elevation (meters)

            <input
              type="number"
              value={elevation}
              onChange={(e) =>
                setElevation(
                  e.target.value
                )
              }
              required
            />

          </label>

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "🤖 Analyzing..."
              : "🔍 Predict Risk"}
          </button>

        </form>

        {error && (
          <p className="error">
            {error}
          </p>
        )}

        {/* RISK RESULT */}

        {riskResult && (

          <div
            className={`risk-result ${getRiskClass(
              riskResult
            )}`}
          >

            <h2>
              📍 {selectedLocation}
              {" "}
              AI Prediction
            </h2>

            <div>

              {riskResult === "High" &&
                "🚨"}

              {riskResult === "Medium" &&
                "⚠️"}

              {riskResult === "Low" &&
                "✅"}

              {" "}
              {riskResult} Risk

            </div>

            {riskPercentage !== null && (

              <p>
                🎯 Landslide Probability:
                {" "}
                <strong>
                  {riskPercentage}%
                </strong>
              </p>

            )}

            <p>

              {riskResult === "High" &&
                "🚨 Immediate attention recommended."}

              {riskResult === "Medium" &&
                "⚠️ Continue monitoring environmental conditions."}

              {riskResult === "Low" &&
                "✅ Environmental conditions are currently within a lower-risk range."}

            </p>

          </div>

        )}

      </div>

      {/* LOCATIONS */}

      <h2 className="section-title">
        📍 Monitored Locations
      </h2>

      <div className="location-grid">

        {Object.entries(
          locations
        ).map(
          ([
            name,
            data,
          ]) => (

            <div
              className="location-card"
              key={name}
            >

              <h3>
                📍 {name}
              </h3>

              <p>
                {data.state}
              </p>

              <p>
                ⛰️ Slope:
                {" "}
                {data.slope}°
              </p>

              <p>
                📏 Elevation:
                {" "}
                {data.elevation} m
              </p>

              <p>
                💧 Soil Moisture:
                {" "}
                {data.soilMoisture}%
              </p>

            </div>

          )
        )}

      </div>

    </section>
  );

  /* =========================================================
     ALERTS
  ========================================================= */

  const Alerts = () => {

    const highCount =
      alerts.filter(
        (a) => a.risk === "High"
      ).length;

    const mediumCount =
      alerts.filter(
        (a) => a.risk === "Medium"
      ).length;

    const lowCount =
      alerts.filter(
        (a) => a.risk === "Low"
      ).length;

    return (

      <section className="page-section">

        <span className="badge">
          🚨 AI EARLY WARNING SYSTEM
        </span>

        <h1>
          Early Warning Alerts
        </h1>

        <p>
          AI-based landslide risk alerts
          using real-time weather data.
        </p>

        {/* NORMAL RANGE FIRST */}

        <NormalRanges />

        {/* RISK LEVEL EXPLANATION */}

        <div className="ai-card">

          <h2>
            🚦 Risk Classification
          </h2>

          <p>
            GeoGuard AI uses the ML model
            probability to classify the
            current landslide risk.
          </p>

          <div className="alert-data">

            <span>
              🟢 Low Risk
              <strong>
                Probability &lt; 40%
              </strong>
            </span>

            <span>
              🟠 Medium Risk
              <strong>
                Probability 40–69%
              </strong>
            </span>

            <span>
              🔴 High Risk
              <strong>
                Probability ≥ 70%
              </strong>
            </span>

          </div>

          <div className="ai-status">

            💡 Important:
            Risk depends on a combination
            of rainfall, soil moisture,
            slope and elevation.
            Crossing one threshold alone
            does not automatically mean
            a landslide will occur.

          </div>

        </div>

        <button
          onClick={generateAlerts}
          disabled={alertsLoading}
        >

          {alertsLoading
            ? "🤖 AI Analyzing..."
            : "🔄 Refresh Alerts"}

        </button>

        {alertsLoading && (

          <div className="ai-status">
            🤖 AI is analyzing monitored
            locations...
          </div>

        )}

        {alertsError && (

          <p className="error">
            {alertsError}
          </p>

        )}

        {/* SUMMARY */}

        {alerts.length > 0 && (

          <div className="alert-summary">

            <div className="alert-stat">

              <strong>
                {highCount}
              </strong>

              <span>
                🔴 High Risk
              </span>

            </div>

            <div className="alert-stat">

              <strong>
                {mediumCount}
              </strong>

              <span>
                🟠 Medium Risk
              </span>

            </div>

            <div className="alert-stat">

              <strong>
                {lowCount}
              </strong>

              <span>
                🟢 Low Risk
              </span>

            </div>

          </div>

        )}

        {/* ALERT CARDS */}

        <div className="alerts-list">

          {alerts.map(
            (alert) => (

              <div
                className={`alert-card ${alert.risk.toLowerCase()}`}
                key={alert.location}
              >

                <div className="alert-icon">

                  {alert.risk === "High" &&
                    "🚨"}

                  {alert.risk === "Medium" &&
                    "⚠️"}

                  {alert.risk === "Low" &&
                    "✅"}

                </div>

                <div className="alert-content">

                  <div className="alert-top">

                    <div>

                      <h2>
                        📍 {alert.location}
                      </h2>

                      <p>
                        {alert.state}
                      </p>

                    </div>

                    <span
                      className={`risk-badge ${alert.risk.toLowerCase()}`}
                    >
                      {alert.risk}
                    </span>

                  </div>

                  <div className="probability-box">

                    <span>
                      🎯 Landslide Probability
                    </span>

                    <strong>
                      {alert.probability}%
                    </strong>

                  </div>

                  <div className="alert-data">

                    <span>
                      🌧️ Current Rainfall

                      <strong>
                        {Number(
                          alert.rainfall
                        ).toFixed(2)}
                        {" "}
                        mm
                      </strong>

                    </span>

                    <span>
                      💧 Soil Moisture

                      <strong>
                        {alert.soilMoisture}%
                      </strong>

                    </span>

                    <span>
                      💦 Humidity

                      <strong>
                        {alert.humidity}%
                      </strong>

                    </span>

                    <span>
                      🌡️ Temperature

                      <strong>
                        {alert.temperature}°C
                      </strong>

                    </span>

                    <span>
                      ⛰️ Slope

                      <strong>
                        {alert.slope}°
                      </strong>

                    </span>

                    <span>
                      📍 Elevation

                      <strong>
                        {alert.elevation} m
                      </strong>

                    </span>

                  </div>

                  <h3>

                    {alert.risk === "High" &&
                      "🚨 HIGH RISK"}

                    {alert.risk === "Medium" &&
                      "⚠️ MEDIUM RISK"}

                    {alert.risk === "Low" &&
                      "✅ LOW RISK"}

                  </h3>

                  <p>
                    {alert.message}
                  </p>

                  <p>
                    <strong>
                      Recommended Action:
                    </strong>
                    {" "}
                    {alert.action}
                  </p>

                  <small>
                    🤖 AI Prediction • 🕐
                    {" "}
                    {alert.time}
                  </small>

                </div>

              </div>

            )
          )}

        </div>

      </section>

    );
  };

  /* =========================================================
     REPORT
  ========================================================= */

  const Report = () => {

    const handleReport = async (e) => {

      e.preventDefault();

      setReportLoading(true);
      setReportError("");

      const form =
        e.target;

      const formData =
        new FormData();

      formData.append(
        "location",
        form.location.value
      );

      formData.append(
        "description",
        form.description.value
      );

      if (
        form.file.files.length > 0
      ) {
        formData.append(
          "file",
          form.file.files[0]
        );
      }

      try {

        const response =
          await fetch(
            `${API_URL}/reports`,
            {
              method: "POST",
              body: formData,
            }
          );

        if (!response.ok) {
          throw new Error(
            "Report submission failed"
          );
        }

        await response.json();

        setReportSubmitted(true);

      } catch (err) {

        console.error(err);

        setReportError(
          "Unable to submit report. Make sure FastAPI is running."
        );

      } finally {

        setReportLoading(false);

      }
    };

    if (reportSubmitted) {

      return (

        <section className="page-section">

          <div className="report-card success-message">

            <div>
              ✅
            </div>

            <h2>
              Report Submitted Successfully
            </h2>

            <p>
              Thank you for helping improve
              landslide monitoring.
            </p>

            <button
              onClick={() =>
                setReportSubmitted(
                  false
                )
              }
            >
              Submit Another Report
            </button>

          </div>

        </section>

      );
    }

    return (

      <section className="page-section">

        <span className="badge">
          📷 CITIZEN REPORTING
        </span>

        <h1>
          📍 Report a Landslide
        </h1>

        <p>
          Help authorities identify
          landslide incidents.
        </p>

        <div className="report-card">

          <form
            onSubmit={handleReport}
            className="report-form"
          >

            <label>
              📍 Location

              <input
                name="location"
                type="text"
                placeholder="Enter location"
                required
              />

            </label>

            <label>
              📝 Description

              <textarea
                name="description"
                rows="6"
                placeholder="Describe the landslide incident..."
                required
              />

            </label>

            <label>
              📷 Upload Photo / Video

              <input
                name="file"
                type="file"
                accept="image/*,video/*"
              />

            </label>

            {reportError && (

              <p className="error">
                {reportError}
              </p>

            )}

            <button
              type="submit"
              disabled={reportLoading}
            >

              {reportLoading
                ? "📤 Submitting..."
                : "🚨 Submit Report"}

            </button>

          </form>

        </div>

      </section>

    );
  };

  /* =========================================================
     ABOUT
  ========================================================= */

  const About = () => (

    <section className="page-section">

      <span className="badge">
        🌍 ABOUT GEOGUARD AI
      </span>

      <h1>
        About GeoGuard AI
      </h1>

      <p>
        GeoGuard AI is an AI-powered
        early warning and landslide risk
        monitoring system designed to
        support communities and
        authorities in landslide-prone
        regions.
      </p>

      <div className="about-grid">

        <div className="about-card">

          <div className="about-icon">
            🤖
          </div>

          <h2>
            Artificial Intelligence
          </h2>

          <p>
            Machine learning analyzes
            rainfall, soil moisture,
            slope and elevation to
            estimate landslide risk.
          </p>

        </div>

        <div className="about-card">

          <div className="about-icon">
            🌦️
          </div>

          <h2>
            Real-Time Weather
          </h2>

          <p>
            Current weather information
            provides updated rainfall,
            humidity, temperature and
            other data.
          </p>

        </div>

        <div className="about-card">

          <div className="about-icon">
            🗺️
          </div>

          <h2>
            Risk Mapping
          </h2>

          <p>
            Geographic visualization
            helps users understand
            vulnerable locations.
          </p>

        </div>

        <div className="about-card">

          <div className="about-icon">
            🚨
          </div>

          <h2>
            Early Warning
          </h2>

          <p>
            Risk alerts classify
            locations into Low,
            Medium and High risk.
          </p>

        </div>

      </div>

      <div className="about-mission">

        <h2>
          🎯 Our Mission
        </h2>

        <p>
          Predict → Map → Alert → Respond
        </p>

        <p>
          GeoGuard AI combines artificial
          intelligence, real-time
          environmental data and
          geographic visualization into
          one disaster monitoring platform.
        </p>

      </div>

      <div className="project-info">

        <h2>
          🏆 Project Information
        </h2>

        <p>
          <strong>
            SIH26001
          </strong>
        </p>

        <p>
          Smart India Hackathon 2026
        </p>

        <p>
          Disaster Management •
          North Eastern Region
        </p>

      </div>

    </section>

  );

  /* =========================================================
     NAVBAR
  ========================================================= */

  const Navbar = () => (

    <nav className="navbar">

      <div
        className="logo"
        onClick={() =>
          setPage("home")
        }
      >
        🌍 GeoGuard AI
      </div>

      <div className="nav-links">

        <button
          className={
            page === "home"
              ? "active"
              : ""
          }
          onClick={() =>
            setPage("home")
          }
        >
          Home
        </button>

        <button
          className={
            page === "dashboard"
              ? "active"
              : ""
          }
          onClick={() =>
            setPage("dashboard")
          }
        >
          Dashboard
        </button>

        <button
          className={
            page === "riskmap"
              ? "active"
              : ""
          }
          onClick={() =>
            setPage("riskmap")
          }
        >
          Risk Map
        </button>

        <button
          className={
            page === "alerts"
              ? "active"
              : ""
          }
          onClick={() =>
            setPage("alerts")
          }
        >
          Alerts
        </button>

        <button
          className={
            page === "report"
              ? "active"
              : ""
          }
          onClick={() =>
            setPage("report")
          }
        >
          Report
        </button>

        <button
          className={
            page === "about"
              ? "active"
              : ""
          }
          onClick={() =>
            setPage("about")
          }
        >
          About
        </button>

      </div>

    </nav>

  );

  /* =========================================================
     FOOTER
  ========================================================= */

  const Footer = () => (

    <footer className="footer">

      <h3>
        🌍 GeoGuard AI
      </h3>

      <p>
        AI-powered landslide early
        warning and risk monitoring system.
      </p>

      <strong>
        Predict → Map → Alert → Respond
      </strong>

      <p>
        SIH26001 • Smart India Hackathon 2026
      </p>

      <p>
        Disaster Management •
        North Eastern Region
      </p>

    </footer>

  );

  /* =========================================================
     MAIN APP
  ========================================================= */

  return (

    <div className="app">

      <Navbar />

      {page === "home" && (
        <Home />
      )}

      {page === "dashboard" && (
        <Dashboard />
      )}

      {page === "riskmap" && (
        <RiskMap />
      )}

      {page === "alerts" && (
        <Alerts />
      )}

      {page === "report" && (
        <Report />
      )}

      {page === "about" && (
        <About />
      )}

      <Footer />

    </div>

  );
}

export default App;