
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

// =========================================================
// INDIA AREA
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
// MAP CONTROLLER
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
      const latitude = event.latlng.lat;
      const longitude = event.latlng.lng;

      if (!isInIndia(latitude, longitude)) {
        onLocationSelect(null, null, "Outside India");
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

// =========================================================
// RISK MAP
// =========================================================

function RiskMap() {
  const [selectedPoint, setSelectedPoint] =
    useState(null);

  const [searchText, setSearchText] =
    useState("");

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [locationName, setLocationName] =
    useState("");

  // =======================================================
  // SELECT LOCATION
  // =======================================================

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
  };

  // =======================================================
  // SEARCH LOCATION
  // =======================================================

  const searchLocation = async (event) => {
    event.preventDefault();

    const query = searchText.trim();

    if (!query) {
      setError(
        "Please enter a location in India."
      );

      return;
    }

    setSearchLoading(true);
    setError("");
    setSelectedPoint(null);

    try {
      const url =
        `https://geocoding-api.open-meteo.com/v1/search` +
        `?name=${encodeURIComponent(query)}` +
        `&count=10` +
        `&language=en` +
        `&format=json` +
        `&countryCode=IN`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          "Location search service is temporarily unavailable."
        );
      }

      const data = await response.json();

      if (
        !data.results ||
        data.results.length === 0
      ) {
        throw new Error(
          "Location not found. Try a city, district or state in India."
        );
      }

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
        [...new Set(nameParts)].join(", ");

      setSearchText(fullName);

      selectLocation(
        latitude,
        longitude,
        fullName
      );
    } catch (err) {
      console.error(
        "Location search error:",
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
  // UI
  // =======================================================

  return (
    <section className="page-section risk-map-page">

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
        directly on the map to select a location.
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
        to select the location on the map.

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

          {/* =================================================
              MARKER
          ================================================= */}

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
              MAP STATUS
          ================================================= */}

          <div className="ai-status">

            🗺️ Location Selected Successfully

            <br />

            <small>
              The location is ready for
              landslide risk analysis.
            </small>

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

export default RiskMap;
