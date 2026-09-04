import { useState, useEffect, useCallback } from "react";
import "./App.css";
import RiskMap from "./RiskMap";

const API_URL = "https://geoguard-ai-backend.onrender.com";

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

function App() {
  const [page, setPage] = useState("home");

  /* =========================
     DASHBOARD STATES
  ========================= */

  const [selectedLocation, setSelectedLocation] =
    useState("Guwahati");

  const [rainfall, setRainfall] = useState("");

  const [soilMoisture, setSoilMoisture] = useState(
    locations.Guwahati.soilMoisture
  );

  const [slope, setSlope] = useState(
    locations.Guwahati.slope
  );

  const [elevation, setElevation] = useState(
    locations.Guwahati.elevation
  );

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

  /* =========================
     ALERT STATES
  ========================= */

  const [alerts, setAlerts] = useState([]);

  const [alertsLoading, setAlertsLoading] =
    useState(false);

  const [alertsError, setAlertsError] =
    useState("");

  const [alertsLoaded, setAlertsLoaded] =
    useState(false);

  /* =========================
     LOCATION CHANGE
  ========================= */

  const handleLocationChange = (locationName) => {
    const location = locations[locationName];

    setSelectedLocation(locationName);

    setSlope(location.slope);

    setElevation(location.elevation);

    setSoilMoisture(location.soilMoisture);

    setRiskResult("");

    setRiskPercentage(null);

    setWeather(null);

    setWeatherError("");

    setError("");
  };

  /* =========================
     AI RISK PREDICTION
  ========================= */

  const predictRisk = async (e) => {
    e.preventDefault();

    setLoading(true);
    setRiskResult("");
    setRiskPercentage(null);
    setError("");

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
            soil_moisture: Number(soilMoisture),
            slope: Number(slope),
            elevation: Number(elevation),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Prediction failed");
      }

      const data = await response.json();

      setRiskResult(data.risk_level);

      if (data.risk_percentage !== undefined) {
        setRiskPercentage(data.risk_percentage);
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

  /* =========================
     LIVE WEATHER
  ========================= */

  const getWeather = async () => {
    setWeatherLoading(true);
    setWeatherError("");
    setRiskResult("");
    setRiskPercentage(null);

    try {
      const location = locations[selectedLocation];

      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${location.latitude}` +
        `&longitude=${location.longitude}` +
        `&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Weather request failed");
      }

      const data = await response.json();

      setWeather(data.current);

      const liveRainfall =
        Number(data.current.rain || 0);

      setRainfall(liveRainfall);

      /* Send weather data to AI */

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
              rainfall: liveRainfall,

              soil_moisture:
                Number(soilMoisture),

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

      const predictionData =
        await predictionResponse.json();

      setRiskResult(
        predictionData.risk_level
      );

      if (
        predictionData.risk_percentage !==
        undefined
      ) {
        setRiskPercentage(
          predictionData.risk_percentage
        );
      }
    } catch (err) {
      console.error(err);

      setWeatherError(
        "Unable to load live weather or AI prediction."
      );
    } finally {
      setWeatherLoading(false);
    }
  };

  /* =========================
     GENERATE AI ALERTS
  ========================= */

  const generateAlerts = useCallback(
    async () => {
      setAlertsLoading(true);
      setAlertsError("");

      const newAlerts = [];

      try {
        for (
          const [name, location]
          of Object.entries(locations)
        ) {
          try {
            /* =========================
               GET LIVE WEATHER
            ========================= */

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

            const current =
              weatherData.current;

            const currentRain =
              Number(current.rain || 0);

            const currentHumidity =
              Number(
                current.relative_humidity_2m ||
                  0
              );

            const currentTemperature =
              Number(
                current.temperature_2m || 0
              );

            /* =========================
               AI PREDICTION
            ========================= */

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
                        location.soilMoisture
                      ),

                    slope:
                      Number(
                        location.slope
                      ),

                    elevation:
                      Number(
                        location.elevation
                      ),
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
                "Landslide risk is currently low.";

              action =
                "No immediate landslide warning.";
            }

            newAlerts.push({
              location: name,

              state: location.state,

              risk:
                prediction.risk_level,

              probability:
                prediction.landslide_probability ??
                0,

              riskPercentage:
                prediction.risk_percentage ??
                0,

              rainfall:
                currentRain,

              soilMoisture:
                location.soilMoisture,

              humidity:
                currentHumidity,

              temperature:
                currentTemperature,

              slope:
                location.slope,

              elevation:
                location.elevation,

              message:
                message,

              action:
                action,

              time:
                new Date().toLocaleTimeString(),
            });
          } catch (locationError) {
            console.error(
              `Error for ${name}:`,
              locationError
            );

            /*
              Continue with other locations
              instead of breaking the entire page.
            */
          }
        }

        if (newAlerts.length === 0) {
          throw new Error(
            "No alert data received"
          );
        }

        setAlerts(newAlerts);
        setAlertsLoaded(true);
      } catch (error) {
        console.error(error);

        setAlertsError(
          "Unable to load AI alerts. Check that FastAPI is running."
        );
      } finally {
        setAlertsLoading(false);
      }
    },
    []
  );

  /* =========================
     LOAD ALERTS ONLY
     WHEN ALERT PAGE OPENS
  ========================= */

  useEffect(() => {
    if (
      page === "alerts" &&
      !alertsLoaded &&
      !alertsLoading
    ) {
      generateAlerts();
    }
  }, [
    page,
    alertsLoaded,
    alertsLoading,
    generateAlerts,
  ]);

  /* =========================
     HOME
  ========================= */

  const Home = () => {
    return (
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
  };

  /* =========================
     DASHBOARD
  ========================= */

  const Dashboard = () => {
    return (
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

        {/* WEATHER */}

        <div className="weather-card">

          <div>

            <h2>
              🌦️ Live Weather —{" "}
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
              ? "Loading..."
              : "🌦️ Get Live Weather"}
          </button>

          {weather && (
            <div className="weather-grid">

              <div>
                🌡️

                <strong>
                  {weather.temperature_2m}
                  °C
                </strong>

                <span>
                  Temperature
                </span>
              </div>

              <div>
                💧

                <strong>
                  {weather.relative_humidity_2m}
                  %
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
                  Rain
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
            Enter environmental parameters
            to calculate landslide risk.
          </p>

          <form
            onSubmit={predictRisk}
            className="prediction-form"
          >

            <label>
              Location

              <select
                value={selectedLocation}
                onChange={(e) =>
                  handleLocationChange(
                    e.target.value
                  )
                }
              >

                {Object.keys(locations).map(
                  (name) => (
                    <option
                      key={name}
                      value={name}
                    >
                      {name}
                    </option>
                  )
                )}

              </select>

            </label>

            <label>
              Rainfall (mm)

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
              Soil Moisture (%)

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
              Slope (degrees)

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
              Elevation (meters)

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

          {riskResult && (
            <div
              className={`risk-result ${riskResult.toLowerCase()}`}
            >

              <h2>
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
                  Landslide Probability:{" "}
                  <strong>
                    {riskPercentage}%
                  </strong>
                </p>
              )}

            </div>
          )}

        </div>

        {/* LOCATIONS */}

        <h2 className="section-title">
          📍 Monitored Locations
        </h2>

        <div className="location-grid">

          {Object.entries(locations).map(
            ([name, data]) => (

              <div
                className="location-card"
                key={name}
              >

                <h3>
                  📍 {name}
                </h3>

                <p>
                  ⛰️ Slope:{" "}
                  {data.slope}°
                </p>

                <p>
                  📏 Elevation:{" "}
                  {data.elevation} m
                </p>

                <p>
                  💧 Soil Moisture:{" "}
                  {data.soilMoisture}%
                </p>

              </div>

            )
          )}

        </div>

      </section>
    );
  };

  /* =========================
     ALERTS PAGE
  ========================= */

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

        {/* REFRESH */}

        <button
          onClick={() => {
            setAlertsLoaded(false);
            generateAlerts();
          }}
          disabled={alertsLoading}
        >
          {alertsLoading
            ? "🤖 Analyzing..."
            : "🔄 Refresh Alerts"}
        </button>

        {/* LOADING */}

        {alertsLoading && (
          <div className="ai-status">
            🤖 AI is analyzing monitored
            locations...
          </div>
        )}

        {/* ERROR */}

        {alertsError && (
          <p className="error">
            {alertsError}
          </p>
        )}

        {/* SUMMARY */}

        {!alertsLoading &&
          alerts.length > 0 && (
            <div className="alert-summary">

              <div className="alert-stat high-stat">

                <strong>
                  {highCount}
                </strong>

                <span>
                  🔴 High Risk
                </span>

              </div>

              <div className="alert-stat medium-stat">

                <strong>
                  {mediumCount}
                </strong>

                <span>
                  🟠 Medium Risk
                </span>

              </div>

              <div className="alert-stat low-stat">

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

                  {/* PROBABILITY */}

                  <div className="probability-box">

                    🎯 Landslide Probability

                    <strong>
                      {alert.riskPercentage}%
                    </strong>

                  </div>

                  {/* WEATHER DATA */}

                  <div className="alert-data">

                    <div>
                      🌧️
                      <span>
                        Current Rainfall
                      </span>

                      <strong>
                        {alert.rainfall.toFixed(
                          2
                        )} mm
                      </strong>
                    </div>

                    <div>
                      💧
                      <span>
                        Soil Moisture
                      </span>

                      <strong>
                        {alert.soilMoisture}%
                      </strong>
                    </div>

                    <div>
                      💦
                      <span>
                        Humidity
                      </span>

                      <strong>
                        {alert.humidity}%
                      </strong>
                    </div>

                    <div>
                      🌡️
                      <span>
                        Temperature
                      </span>

                      <strong>
                        {alert.temperature} °C
                      </strong>
                    </div>

                    <div>
                      ⛰️
                      <span>
                        Slope
                      </span>

                      <strong>
                        {alert.slope}°
                      </strong>
                    </div>

                    <div>
                      📍
                      <span>
                        Elevation
                      </span>

                      <strong>
                        {alert.elevation} m
                      </strong>
                    </div>

                  </div>

                  {/* WARNING */}

                  <div
                    className={`warning-box ${alert.risk.toLowerCase()}`}
                  >

                    <strong>

                      {alert.risk ===
                        "High" &&
                        "🚨 HIGH RISK"}

                      {alert.risk ===
                        "Medium" &&
                        "⚠️ MEDIUM RISK"}

                      {alert.risk ===
                        "Low" &&
                        "✅ LOW RISK"}

                    </strong>

                    <p>
                      {alert.message}
                    </p>

                  </div>

                  <p>
                    <strong>
                      Recommended Action:
                    </strong>{" "}
                    {alert.action}
                  </p>

                  <small>
                    🤖 AI Prediction • 🕐{" "}
                    {alert.time}
                  </small>

                </div>

              </div>
            )
          )}

        </div>

        {/* EMPTY */}

        {!alertsLoading &&
          alerts.length === 0 &&
          !alertsError && (
            <div className="ai-status">
              No prediction results available.
            </div>
          )}

      </section>
    );
  };

  /* =========================
     REPORT
  ========================= */

  const Report = () => {

    const [submitted, setSubmitted] =
      useState(false);

    const handleReport = (e) => {
      e.preventDefault();

      setSubmitted(true);

      e.target.reset();
    };

    return (
      <section className="page-section">

        <span className="badge">
          📷 CITIZEN REPORTING
        </span>

        <h1>
          Report a Landslide
        </h1>

        <p>
          Help authorities identify
          landslide events by submitting
          field information.
        </p>

        <div className="report-card">

          {submitted ? (

            <div className="success-message">

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
                  setSubmitted(false)
                }
              >
                Submit Another Report
              </button>

            </div>

          ) : (

            <form
              onSubmit={handleReport}
              className="report-form"
            >

              <label>
                📍 Location

                <input
                  type="text"
                  placeholder="Enter location"
                  required
                />

              </label>

              <label>
                📅 Date

                <input
                  type="date"
                  required
                />

              </label>

              <label>
                ⚠️ Severity

                <select required>

                  <option value="">
                    Select severity
                  </option>

                  <option value="Low">
                    Low
                  </option>

                  <option value="Medium">
                    Medium
                  </option>

                  <option value="High">
                    High
                  </option>

                </select>

              </label>

              <label>
                📷 Upload Photo

                <input
                  type="file"
                  accept="image/*"
                />

              </label>

              <label>
                📝 Description

                <textarea
                  rows="5"
                  placeholder="Describe the landslide..."
                  required
                />

              </label>

              <button type="submit">
                🚀 Submit Report
              </button>

            </form>

          )}

        </div>

      </section>
    );
  };

  /* =========================
     MAIN APP
  ========================= */

  return (
    <div className="app">

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
            onClick={() =>
              setPage("home")
            }
          >
            Home
          </button>

          <button
            onClick={() =>
              setPage("dashboard")
            }
          >
            Dashboard
          </button>

          <button
            onClick={() =>
              setPage("riskmap")
            }
          >
            Risk Map
          </button>

          <button
            onClick={() =>
              setPage("alerts")
            }
          >
            Alerts
          </button>

          <button
            onClick={() =>
              setPage("report")
            }
          >
            Report
          </button>

        </div>

      </nav>

      {page === "home" && <Home />}

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

      <footer className="footer">

        <h3>
          🌍 GeoGuard AI
        </h3>

        <p>
          AI-powered landslide early warning
          and risk monitoring system.
        </p>

        <strong>
          SIH26001 • Smart India Hackathon 2026
        </strong>

      </footer>

    </div>
  );
}

export default App;