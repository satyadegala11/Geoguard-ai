import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

// =========================================================
// LEAFLET MARKER FIX
// =========================================================

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const API_URL = "https://geoguard-ai-backend.onrender.com";

// =========================================================
// INDIA BOUNDARY
// =========================================================

const isInIndia = (latitude, longitude) => {
  return (
    latitude >= 6 &&
    latitude <= 38 &&
    longitude >= 68 &&
    longitude <= 98
  );
};

// =========================================================
// MAP MOVEMENT COMPONENT
// =========================================================

function MapController({ selectedPoint }) {
  const map = useMap();

  if (selectedPoint) {
    map.flyTo(
      [selectedPoint.latitude, selectedPoint.longitude],
      10,
      {
        duration: 1.2,
      }
    );
  }

  return null;
}

// =========================================================
// MAP CLICK HANDLER
// =========================================================

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(event) {
      onLocationSelect(
        event.latlng.lat,
        event.latlng.lng,
        "Map Location"
      );
    },
  });

  return null;
}

// =========================================================
// RISK MAP
// =========================================================

function RiskMap() {
  const [selectedPoint, setSelectedPoint] =
    useState(null);

  const [result, setResult] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [searchText, setSearchText] =
    useState("");

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [locationName, setLocationName] =
    useState("");

  // =======================================================
  // ANALYZE LOCATION
  // =======================================================

  const analyzeLocation = async (
    latitude,
    longitude,
    name = "Selected Location"
  ) => {
    setSelectedPoint({
      latitude,
      longitude,
    });

    setLocationName(name);

    setResult(null);
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/predict-location`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            latitude,
            longitude,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Location prediction failed."
        );
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
    } catch (err) {
      console.error(
        "Prediction error:",
        err
      );

      setError(
        err.message ||
          "Unable to calculate risk. Make sure FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  };

  // =======================================================
  // SEARCH LOCATION
  // =======================================================

  const searchLocation = async (event) => {
    event.preventDefault();

    const query =
      searchText.trim();

    if (!query) {
      setError(
        "Please enter a location in India."
      );
      return;
    }

    setSearchLoading(true);
    setError("");
    setResult(null);

    try {
      // Open-Meteo Geocoding API
      const url =
        `https://geocoding-api.open-meteo.com/v1/search` +
        `?name=${encodeURIComponent(query)}` +
        `&count=10` +
        `&language=en` +
        `&format=json` +
        `&countryCode=IN`;

      const response =
        await fetch(url);

      if (!response.ok) {
        throw new Error(
          "Location search failed."
        );
      }

      const data =
        await response.json();

      if (
        !data.results ||
        data.results.length === 0
      ) {
        throw new Error(
          "Location not found. Try a city, district or state in India."
        );
      }

      // Find an Indian result
      const indianResult =
        data.results.find(
          (item) =>
            item.country_code === "IN"
        );

      if (!indianResult) {
        throw new Error(
          "Please search for a location in India."
        );
      }

      const latitude =
        Number(indianResult.latitude);

      const longitude =
        Number(indianResult.longitude);

      if (
        !isInIndia(
          latitude,
          longitude
        )
      ) {
        throw new Error(
          "The selected location is outside the India map area."
        );
      }

      const nameParts = [
        indianResult.name,
        indianResult.admin2,
        indianResult.admin1,
      ].filter(Boolean);

      const fullName =
        [...new Set(nameParts)]
          .join(", ");

      setSearchText(
        fullName
      );

      await analyzeLocation(
        latitude,
        longitude,
        fullName
      );
    } catch (err) {
      console.error(
        "Search error:",
        err
      );

      setError(
        err.message ||
          "Unable to find this location."
      );
    } finally {
      setSearchLoading(false);
    }
  };

  // =======================================================
  // RISK CSS CLASS
  // =======================================================

  const getRiskClass = () => {
    if (!result) {
      return "";
    }

    return result.risk_level
      ? result.risk_level.toLowerCase()
      : "";
  };

  // =======================================================
  // RISK ICON
  // =======================================================

  const getRiskIcon = () => {
    if (!result) {
      return "📍";
    }

    if (
      result.risk_level === "High"
    ) {
      return "🚨";
    }

    if (
      result.risk_level === "Medium"
    ) {
      return "⚠️";
    }

    return "✅";
  };

  // =======================================================
  // UI
  // =======================================================

  return (
    <section className="page-section risk-map-page">

      <span className="badge">
        🗺️ AI LANDSLIDE RISK MAP
      </span>

      <h1>
        Landslide Risk Map
      </h1>

      <p>
        Search any location in India or click
        directly on the map to analyze landslide
        risk.
      </p>

      {/* =================================================
          SEARCH
      ================================================= */}

      <div className="map-search-card">

        <form
          onSubmit={searchLocation}
          className="map-search-form"
        >

          <input
            type="text"
            value={searchText}
            onChange={(e) =>
              setSearchText(
                e.target.value
              )
            }
            placeholder="🔎 Search any location in India..."
            className="map-search-input"
          />

          <button
            type="submit"
            disabled={searchLoading}
            className="map-search-button"
          >
            {searchLoading
              ? "🔄 Searching..."
              : "🔎 Search"}
          </button>

        </form>

        <p className="search-help">
          Examples: Hyderabad, Visakhapatnam,
          Gangtok, Shimla, Kerala, Darjeeling,
          Mumbai
        </p>

      </div>

      {/* =================================================
          INSTRUCTION
      ================================================= */}

      <div className="map-instruction">

        📍{" "}
        <strong>
          Search or click any location in India
        </strong>{" "}
        to get AI-powered landslide risk
        prediction.

      </div>

      {/* =================================================
          MAP
      ================================================= */}

      <div className="risk-map-container">

        <MapContainer
          center={[
            22.5937,
            78.9629,
          ]}
          zoom={5}
          minZoom={4}
          maxZoom={14}
          scrollWheelZoom={true}
          style={{
            height: "600px",
            width: "100%",
          }}
        >

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler
            onLocationSelect={
              analyzeLocation
            }
          />

          <MapController
            selectedPoint={
              selectedPoint
            }
          />

          {selectedPoint && (
            <Marker
              position={[
                selectedPoint.latitude,
                selectedPoint.longitude,
              ]}
            >

              <Popup>

                <strong>
                  {locationName ||
                    "Selected Location"}
                </strong>

                <br />

                Latitude:{" "}
                {selectedPoint.latitude.toFixed(
                  5
                )}

                <br />

                Longitude:{" "}
                {selectedPoint.longitude.toFixed(
                  5
                )}

              </Popup>

            </Marker>
          )}

        </MapContainer>

      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="error">

          ❌ {error}

        </div>
      )}

      {/* =================================================
          SELECTED LOCATION
      ================================================= */}

      {selectedPoint && (

        <div className="selected-location-card">

          <h2>
            📍{" "}
            {locationName ||
              "Selected Location"}
          </h2>

          <p>
            <strong>
              Latitude:
            </strong>{" "}
            {selectedPoint.latitude.toFixed(
              5
            )}
          </p>

          <p>
            <strong>
              Longitude:
            </strong>{" "}
            {selectedPoint.longitude.toFixed(
              5
            )}
          </p>

          {/* =================================================
              LOADING
          ================================================= */}

          {loading && (

            <div className="ai-status">

              🤖 AI is analyzing this location...

              <br />

              <small>
                Fetching environmental data
                and calculating landslide risk.
              </small>

            </div>

          )}

          {/* =================================================
              RESULT
          ================================================= */}

          {result && !loading && (

            <div
              className={`location-risk-result ${getRiskClass()}`}
            >

              <h2>

                {getRiskIcon()}{" "}

                {result.risk_level} Risk

              </h2>

              {/* RISK PROBABILITY */}

              <div className="risk-probability">

                🎯 Landslide Probability

                <strong>
                  {Number(
                    result.risk_percentage
                  ).toFixed(2)}
                  %
                </strong>

              </div>

              {/* =================================================
                  ENVIRONMENTAL DATA
              ================================================= */}

              <div className="location-weather-grid">

                <div>

                  🌧️

                  <strong>
                    {Number(
                      result.rainfall ?? 0
                    ).toFixed(2)}{" "}
                    mm
                  </strong>

                  <span>
                    Rainfall
                  </span>

                </div>

                <div>

                  💧

                  <strong>
                    {Number(
                      result.soil_moisture ?? 0
                    ).toFixed(1)}
                    %
                  </strong>

                  <span>
                    Soil Moisture
                  </span>

                </div>

                <div>

                  💦

                  <strong>
                    {Number(
                      result.humidity ?? 0
                    ).toFixed(1)}
                    %
                  </strong>

                  <span>
                    Humidity
                  </span>

                </div>

                <div>

                  🌡️

                  <strong>
                    {Number(
                      result.temperature ?? 0
                    ).toFixed(1)}
                    °C
                  </strong>

                  <span>
                    Temperature
                  </span>

                </div>

                <div>

                  💨

                  <strong>
                    {Number(
                      result.wind_speed ?? 0
                    ).toFixed(1)}
                    km/h
                  </strong>

                  <span>
                    Wind Speed
                  </span>

                </div>

                <div>

                  ⛰️

                  <strong>
                    {Number(
                      result.slope ?? 0
                    ).toFixed(1)}
                    °
                  </strong>

                  <span>
                    Slope
                  </span>

                </div>

                <div>

                  📍

                  <strong>
                    {Number(
                      result.elevation ?? 0
                    ).toFixed(0)}{" "}
                    m
                  </strong>

                  <span>
                    Elevation
                  </span>

                </div>

              </div>

              {/* =================================================
                  RISK MESSAGE
              ================================================= */}

              <div className="risk-message">

                {result.risk_level ===
                  "High" && (
                  <>
                    <h3>
                      🚨 HIGH RISK
                    </h3>

                    <p>
                      High landslide risk
                      detected. Immediate
                      monitoring and early
                      warning is recommended.
                    </p>
                  </>
                )}

                {result.risk_level ===
                  "Medium" && (
                  <>
                    <h3>
                      ⚠️ MEDIUM RISK
                    </h3>

                    <p>
                      Moderate landslide risk
                      detected. Continue
                      monitoring environmental
                      conditions.
                    </p>
                  </>
                )}

                {result.risk_level ===
                  "Low" && (
                  <>
                    <h3>
                      ✅ LOW RISK
                    </h3>

                    <p>
                      No immediate landslide
                      warning detected.
                      Continue normal monitoring.
                    </p>
                  </>
                )}

              </div>

              {/* =================================================
                  DATA SOURCE NOTE
              ================================================= */}

              <div className="risk-observation">

                🌐{" "}
                <strong>
                  Environmental data:
                </strong>{" "}
                Live weather, soil moisture
                and elevation data are retrieved
                for the selected coordinates.

              </div>

            </div>

          )}

        </div>

      )}

      {/* =================================================
          EMPTY STATE
      ================================================= */}

      {!selectedPoint && !loading && (

        <div className="map-empty-state">

          <h2>
            📍 Select a Location
          </h2>

          <p>
            Search for an Indian location above
            or click anywhere on the map to start
            AI risk analysis.
          </p>

        </div>

      )}

    </section>
  );
}

export default RiskMap;