import { useEffect, useState } from "react";

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


// ======================================================
// 1. BACKEND URL
// ======================================================

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://geoguard-ai-backend.onrender.com";


// ======================================================
// 2. LEAFLET MARKER FIX
// ======================================================

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});


// ======================================================
// 3. CHECK INDIA
// ======================================================

const isInIndia = (latitude, longitude) => {
  return (
    latitude >= 6 &&
    latitude <= 38 &&
    longitude >= 68 &&
    longitude <= 98
  );
};


// ======================================================
// 4. MAP CONTROLLER
// ======================================================

function MapController({ selectedPoint }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedPoint) return;

    map.flyTo(
      [
        selectedPoint.latitude,
        selectedPoint.longitude,
      ],
      10,
      {
        duration: 1.2,
      }
    );
  }, [selectedPoint, map]);

  return null;
}


// ======================================================
// 5. MAP CLICK HANDLER
// ======================================================

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(event) {
      const latitude = event.latlng.lat;
      const longitude = event.latlng.lng;

      if (!isInIndia(latitude, longitude)) {
        onLocationSelect(
          null,
          null,
          "Outside India"
        );

        return;
      }

      onLocationSelect(
        latitude,
        longitude,
        "Map Location"
      );
    },
  });

  return null;
}


// ======================================================
// 6. MAIN COMPONENT
// ======================================================

function RiskMap() {

  // ====================================================
  // LOCATION
  // ====================================================

  const [
    selectedPoint,
    setSelectedPoint,
  ] = useState(null);

  const [
    locationName,
    setLocationName,
  ] = useState("");


  // ====================================================
  // SEARCH
  // ====================================================

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const [
    searchLoading,
    setSearchLoading,
  ] = useState(false);


  // ====================================================
  // CURRENT RISK
  // ====================================================

  const [
    riskData,
    setRiskData,
  ] = useState(null);

  const [
    riskLoading,
    setRiskLoading,
  ] = useState(false);


  // ====================================================
  // TOMORROW RISK
  // ====================================================

  const [
    tomorrowData,
    setTomorrowData,
  ] = useState(null);

  const [
    tomorrowLoading,
    setTomorrowLoading,
  ] = useState(false);


  // ====================================================
  // ERROR
  // ====================================================

  const [
    error,
    setError,
  ] = useState("");


  // ====================================================
  // 7. CURRENT RISK PREDICTION
  // ====================================================

  const getRiskPrediction = async (
    latitude,
    longitude
  ) => {

    setRiskLoading(true);
    setRiskData(null);

    try {

      const response = await fetch(
        `${API_URL}/predict-location`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },

          body: JSON.stringify({
            latitude,
            longitude,
          }),
        }
      );


      if (!response.ok) {

        let message =
          "Unable to get current landslide risk.";

        try {

          const errorData =
            await response.json();

          if (errorData.detail) {

            message =
              typeof errorData.detail === "string"
                ? errorData.detail
                : JSON.stringify(
                    errorData.detail
                  );
          }

        } catch {
          // Ignore JSON parsing error
        }

        throw new Error(message);
      }


      const data =
        await response.json();


      console.log(
        "CURRENT PREDICTION:",
        data
      );


      if (data.error) {
        throw new Error(data.error);
      }


      setRiskData(data);

    }

    catch (err) {

      console.error(
        "Current risk error:",
        err
      );

      setError(
        err.message ||
        "Unable to retrieve current landslide risk."
      );

    }

    finally {

      setRiskLoading(false);

    }
  };


  // ====================================================
  // 8. TOMORROW PREDICTION
  // ====================================================

  const getTomorrowPrediction = async (
    latitude,
    longitude
  ) => {

    setTomorrowLoading(true);
    setTomorrowData(null);

    try {

      console.log(
        "Requesting tomorrow prediction..."
      );

      console.log(
        "API URL:",
        `${API_URL}/tomorrow-predict`
      );


      const response = await fetch(
        `${API_URL}/tomorrow-predict`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },

          body: JSON.stringify({
            latitude: latitude,
            longitude: longitude,
          }),
        }
      );


      console.log(
        "Tomorrow response status:",
        response.status
      );


      if (!response.ok) {

        let message =
          "Unable to get tomorrow's prediction.";

        try {

          const errorData =
            await response.json();

          console.error(
            "Tomorrow backend error:",
            errorData
          );


          if (errorData.detail) {

            message =
              typeof errorData.detail === "string"
                ? errorData.detail
                : JSON.stringify(
                    errorData.detail
                  );
          }

        } catch {
          // Ignore JSON parsing error
        }

        throw new Error(message);
      }


      const data =
        await response.json();


      console.log(
        "TOMORROW PREDICTION:",
        data
      );


      if (data.error) {
        throw new Error(data.error);
      }


      setTomorrowData(data);

    }

    catch (err) {

      console.error(
        "Tomorrow prediction error:",
        err
      );

      setError(
        err.message ||
        "Unable to get tomorrow's prediction."
      );

    }

    finally {

      setTomorrowLoading(false);

    }
  };


  // ====================================================
  // 9. SELECT LOCATION
  // ====================================================

  const selectLocation = (
    latitude,
    longitude,
    name = "Selected Location"
  ) => {

    if (
      latitude === null ||
      longitude === null
    ) {

      setSelectedPoint(null);

      setLocationName("");

      setRiskData(null);

      setTomorrowData(null);

      setError(
        "Please select a location within India."
      );

      return;
    }


    setSelectedPoint({
      latitude,
      longitude,
    });


    setLocationName(name);

    setError("");


    // --------------------------------------------------
    // CURRENT PREDICTION
    // --------------------------------------------------

    getRiskPrediction(
      latitude,
      longitude
    );


    // --------------------------------------------------
    // TOMORROW PREDICTION
    // --------------------------------------------------

    getTomorrowPrediction(
      latitude,
      longitude
    );
  };


  // ====================================================
  // 10. SEARCH LOCATION
  // ====================================================

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

    setRiskData(null);

    setTomorrowData(null);

    setSelectedPoint(null);


    try {

      const url =
        "https://nominatim.openstreetmap.org/search" +
        "?q=" +
        encodeURIComponent(
          query + ", India"
        ) +
        "&format=json" +
        "&limit=10" +
        "&addressdetails=1";


      const response =
        await fetch(
          url,
          {
            headers: {
              Accept:
                "application/json",
            },
          }
        );


      if (!response.ok) {

        throw new Error(
          "Location search service is temporarily unavailable."
        );
      }


      const results =
        await response.json();


      if (
        !results ||
        results.length === 0
      ) {

        throw new Error(
          "Location not found. Try a city, district or state in India."
        );
      }


      const indianResult =
        results.find((item) => {

          const address =
            item.address || {};

          return (
            address.country_code === "in" ||
            (
              address.country &&
              address.country
                .toLowerCase()
                .includes("india")
            )
          );

        });


      if (!indianResult) {

        throw new Error(
          "Please search for a location in India."
        );
      }


      const latitude =
        Number(
          indianResult.lat
        );

      const longitude =
        Number(
          indianResult.lon
        );


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


      const address =
        indianResult.address || {};


      const nameParts = [
        address.city,
        address.town,
        address.village,
        address.municipality,
        address.county,
        address.state,
      ].filter(Boolean);


      const uniqueNames = [
        ...new Set(nameParts),
      ];


      const fullName =
        uniqueNames.length > 0
          ? uniqueNames.join(", ")
          : indianResult.display_name;


      setSearchText(fullName);


      selectLocation(
        latitude,
        longitude,
        fullName
      );

    }

    catch (err) {

      console.error(
        "Location search error:",
        err
      );

      setError(
        err.message ||
        "Unable to find this location."
      );

    }

    finally {

      setSearchLoading(false);

    }
  };


  // ====================================================
  // 11. RISK CLASS
  // ====================================================

  const getRiskClass = (
    riskLevel
  ) => {

    if (!riskLevel) {
      return "";
    }

    return riskLevel
      .toLowerCase()
      .replace(
        /\s+/g,
        "-"
      );
  };


  // ====================================================
  // 12. RISK LABEL
  // ====================================================

  const getRiskLabel = (
    riskLevel
  ) => {

    if (
      riskLevel === "High"
    ) {

      return "🔴 HIGH RISK";
    }


    if (
      riskLevel === "Medium"
    ) {

      return "🟡 MEDIUM RISK";
    }


    return "🟢 LOW RISK";
  };


  // ====================================================
  // 13. PROBABILITY
  // ====================================================

  const getProbability = (data) => {

    if (!data) {
      return 0;
    }


    if (
      data.risk_percentage !==
      undefined &&
      data.risk_percentage !==
      null
    ) {

      return Number(
        data.risk_percentage
      );
    }


    if (
      data.landslide_probability !==
      undefined &&
      data.landslide_probability !==
      null
    ) {

      const probability =
        Number(
          data.landslide_probability
        );


      // Backend may return 0-1
      if (
        probability >= 0 &&
        probability <= 1
      ) {

        return probability * 100;
      }


      // Backend may return 0-100
      return probability;
    }


    return 0;
  };


  // ====================================================
  // 14. UI
  // ====================================================

  return (

    <section
      className="page-section risk-map-page"
    >

      {/* =================================================
          HEADER
      ================================================= */}

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
            onChange={(event) =>
              setSearchText(
                event.target.value
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

          Examples: Hyderabad,
          Visakhapatnam,
          Gangtok,
          Shimla,
          Kerala,
          Darjeeling,
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

        to select the location.

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
              selectLocation
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
                <br />

                📍 Latitude:{" "}

                {selectedPoint.latitude.toFixed(
                  5
                )}

                <br />

                📍 Longitude:{" "}

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
              "Selected Map Location"}

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


          <div className="ai-status">

            🗺️ Location Selected Successfully

            <br />

            <small>

              {riskLoading ||
              tomorrowLoading

                ? "🤖 AI is analyzing the location..."

                : riskData ||
                  tomorrowData

                ? "✅ Risk analysis completed."

                : "The location is ready for analysis."}

            </small>

          </div>

        </div>

      )}


      {/* =================================================
          CURRENT RISK LOADING
      ================================================= */}

      {riskLoading && (

        <div className="risk-result-card">

          <h2>
            🤖 Current Landslide Risk
          </h2>

          <p>

            🔄 Retrieving environmental data
            and calculating current risk...

          </p>

        </div>

      )}


      {/* =================================================
          CURRENT RISK RESULT
      ================================================= */}

      {riskData &&
      !riskLoading && (

        <div
          className={`risk-result-card ${getRiskClass(
            riskData.risk_level
          )}`}
        >

          <h2>
            🤖 Current Landslide Risk
          </h2>


          {/* CURRENT RISK LEVEL */}

          <div className="risk-level-box">

            <span>
              Current Risk Level
            </span>

            <strong>

              {getRiskLabel(
                riskData.risk_level
              )}

            </strong>

          </div>


          {/* CURRENT PROBABILITY */}

          <div className="risk-probability">

            <h3>
              Landslide Probability
            </h3>

            <div className="risk-percentage">

              {getProbability(
                riskData
              ).toFixed(2)}

              %

            </div>

          </div>


          {/* CURRENT ENVIRONMENTAL DATA */}

          <div className="risk-info-grid">

            <div className="risk-info-item">

              <span>
                🌧️ Rainfall
              </span>

              <strong>

                {riskData.rainfall ??
                  "N/A"}

                {riskData.rainfall !==
                  undefined &&
                  " mm"}

              </strong>

            </div>


            <div className="risk-info-item">

              <span>
                💧 Soil Moisture
              </span>

              <strong>

                {riskData.soil_moisture ??
                  "N/A"}

              </strong>

            </div>


            <div className="risk-info-item">

              <span>
                ⛰️ Elevation
              </span>

              <strong>

                {riskData.elevation ??
                  "N/A"}

                {riskData.elevation !==
                  undefined &&
                  " m"}

              </strong>

            </div>


            <div className="risk-info-item">

              <span>
                📐 Slope
              </span>

              <strong>

                {riskData.slope ??
                  "N/A"}

                {riskData.slope !==
                  undefined &&
                  "°"}

              </strong>

            </div>

          </div>


          {/* DATA SOURCE */}

          <div className="risk-data-source">

            📡 Data Source:{" "}

            <strong>

              {riskData.data_source ||
                "live"}

            </strong>

          </div>


          <div className="risk-disclaimer">

            ⚠️ This is an AI-based risk prediction
            for informational purposes. It is not
            an official government warning.

          </div>

        </div>

      )}


      {/* =================================================
          TOMORROW LOADING
      ================================================= */}

      {tomorrowLoading && (

        <div className="risk-result-card tomorrow-card">

          <h2>
            🔮 Tomorrow's Landslide Prediction
          </h2>

          <p>

            🌦️ Analyzing tomorrow's environmental
            conditions...

          </p>

        </div>

      )}


      {/* =================================================
          TOMORROW RESULT
      ================================================= */}

      {tomorrowData &&
      !tomorrowLoading && (

        <div
          className={`risk-result-card tomorrow-card ${getRiskClass(
            tomorrowData.risk_level
          )}`}
        >

          <h2>
            🔮 Tomorrow's Landslide Risk
          </h2>


          {/* TOMORROW RISK LEVEL */}

          <div className="risk-level-box">

            <span>
              Tomorrow's Risk Level
            </span>

            <strong>

              {getRiskLabel(
                tomorrowData.risk_level
              )}

            </strong>

          </div>


          {/* TOMORROW PROBABILITY */}

          <div className="risk-probability">

            <h3>
              Predicted Landslide Probability
            </h3>

            <div className="risk-percentage">

              {getProbability(
                tomorrowData
              ).toFixed(2)}

              %

            </div>

          </div>


          {/* TOMORROW ENVIRONMENTAL DATA */}

          <div className="risk-info-grid">

            <div className="risk-info-item">

              <span>
                🌧️ Expected Rainfall
              </span>

              <strong>

                {tomorrowData.rainfall ??
                  "N/A"}

                {tomorrowData.rainfall !==
                  undefined &&
                  " mm"}

              </strong>

            </div>


            <div className="risk-info-item">

              <span>
                💧 Soil Moisture
              </span>

              <strong>

                {tomorrowData.soil_moisture ??
                  "N/A"}

              </strong>

            </div>


            <div className="risk-info-item">

              <span>
                ⛰️ Elevation
              </span>

              <strong>

                {tomorrowData.elevation ??
                  "N/A"}

                {tomorrowData.elevation !==
                  undefined &&
                  " m"}

              </strong>

            </div>


            <div className="risk-info-item">

              <span>
                📐 Slope
              </span>

              <strong>

                {tomorrowData.slope ??
                  "N/A"}

                {tomorrowData.slope !==
                  undefined &&
                  "°"}

              </strong>

            </div>

          </div>


          {/* TOMORROW SOURCE */}

          <div className="risk-data-source">

            🔮 Forecast:{" "}

            <strong>
              {tomorrowData.forecast ||
                "Tomorrow"}
            </strong>

            {" | "}

            Source:{" "}

            <strong>

              {tomorrowData.data_source ||
                "prototype forecast"}

            </strong>

          </div>


          {/* TOMORROW DISCLAIMER */}

          <div className="risk-disclaimer">

            ⚠️ Tomorrow's prediction is an
            AI-based forecast for informational
            purposes and should not be treated as
            an official government warning.

          </div>

        </div>

      )}


      {/* =================================================
          EMPTY STATE
      ================================================= */}

      {!selectedPoint && (

        <div className="map-empty-state">

          <h2>
            📍 Select a Location
          </h2>

          <p>

            Search for an Indian location above
            or click anywhere inside India on
            the map.

          </p>

        </div>

      )}

    </section>
  );
}


// ======================================================
// EXPORT
// ======================================================

export default RiskMap;