// HeiGIT API Key
const orsApiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImEyZWYwODZkMTUwNjQwMjBiZjhmMTU2NzNlYjYzY2EyIiwiaCI6Im11cm11cjY0In0="; 

// 1. FUNCTION TO FETCH AND RENDER ROAD CATCHMENT POLYGON //
async function generateMillCatchment(lng, lat, millName) {
  // HeiGIT Endpoint URL
  const url = "https://api.heigit.org/openrouteservice/v2/isochrones/driving-car";

  // Payload explicitly declaring range_type as distance
  const payload = {
    locations: [[lng, lat]],
    range: [75000],          // 75,000 meters (75 km)
    range_type: "distance",  // Evaluates range in distance, not time
    units: "m"
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": orsApiKey.trim(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("HeiGIT API Error Detail:", errData);
      throw new Error(`ORS API Error ${response.status}: ${errData.error?.message || response.statusText}`);
    }

    const isochroneGeoJSON = await response.json();

    if (!isochroneGeoJSON.features || isochroneGeoJSON.features.length === 0) {
      console.warn("No catchment polygon returned for this location.");
      return;
    }

    isochroneGeoJSON.features[0].properties.millName = millName;

    // Check layer checkbox state before rendering
    const catchmentCheckbox = document.getElementById("layer-catchment");
    const initialVisibility = catchmentCheckbox && catchmentCheckbox.checked ? "visible" : "none";

    // Render or update source in MapLibre
    if (map.getSource("mill-catchment")) {
      map.getSource("mill-catchment").setData(isochroneGeoJSON);
      
      if (map.getLayer("mill-catchment-fill")) {
        map.setLayoutProperty("mill-catchment-fill", "visibility", initialVisibility);
      }
      if (map.getLayer("mill-catchment-outline")) {
        map.setLayoutProperty("mill-catchment-outline", "visibility", initialVisibility);
      }
    } else {
      map.addSource("mill-catchment", {
        type: "geojson",
        data: isochroneGeoJSON
      });

      // Fill Layer - Positioned UNDER "po-mill-circle"
      map.addLayer({
        id: "mill-catchment-fill",
        type: "fill",
        source: "mill-catchment",
        layout: {
          "visibility": initialVisibility
        },
        paint: {
          "fill-color": "#d6d19d",
          "fill-opacity": 0.50
        }
      }, "po-mill-circle");

      // Outline Layer - Positioned UNDER "po-mill-circle"
      map.addLayer({
        id: "mill-catchment-outline",
        type: "line",
        source: "mill-catchment",
        layout: {
          "visibility": initialVisibility
        },
        paint: {
          "line-color": "#818944",
          "line-width": 1.5
        }
      }, "po-mill-circle");
    }

    // Refresh dynamic legend
    updateLegend();

    // Safely fit map bounds to the catchment feature
    const bounds = new maplibregl.LngLatBounds();
    const geom = isochroneGeoJSON.features[0].geometry;

    if (geom.type === "Polygon") {
      geom.coordinates[0].forEach(coord => bounds.extend(coord));
    } else if (geom.type === "MultiPolygon") {
      geom.coordinates.forEach(poly => poly[0].forEach(coord => bounds.extend(coord)));
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60 });
    }

  } catch (err) {
    console.error("Failed to generate catchment area:", err);
  }
}

const apiKey = "9I6oBIXgdrDiB3xhRfd4";

// MAP BASEMAP LIST //
const basemaps = {
  dataviz: `https://api.maptiler.com/maps/dataviz-v4/style.json?key=${apiKey}`,
  satellite: `https://api.maptiler.com/maps/hybrid-v4/style.json?key=${apiKey}`,
  lightbase: `https://api.maptiler.com/maps/base-v4-light/style.json?key=${apiKey}`,
  topo: `https://api.maptiler.com/maps/topo-v2/style.json?key=${apiKey}`
};

const map = new maplibregl.Map({
  container: "map",
  style: basemaps.dataviz,
  center: [0, 0],
  zoom: 1,
  attributionControl: false
});

// Surface MapLibre errors
map.on("error", (e) => console.error("MapLibre error:", e.error));

// MAP CONTROLS //
map.addControl(new maplibregl.NavigationControl(), "top-right");
map.addControl(new maplibregl.FullscreenControl(), "top-right");
map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-right");
map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), "bottom-right");
map.addControl(new maplibregl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true
}), "top-right");

// HEATMAP CONFIGURATION //
const heatmapClasses = {
  IP: {
    title: "Identity Preserved (IP)",
    breaks: [0, 1, 2, 4, 11],
    colors: ["#E4DFD9", "#c9df8a", "#95b369", "#65894b", "#234d20"],
    labels: ["0 mill", "1 mill", "2-3 mills", "4-10 mills", "11-56 mills"]
  },
  IP_MB: {
    title: "IP/MB",
    breaks: [0, 1, 2, 17, 28],
    colors: ["#E4DFD9", "#a6bcdd", "#768cb3", "#495e8a", "#00214f"],
    labels: ["0 mill", "1 mill", "2-16 mills", "17-27 mills", "28-55 mills"]
  },
  MB: {
    title: "Mass Balance (MB)",
    breaks: [0, 1, 2, 3, 4],
    colors: ["#E4DFD9", "#a17e61", "#826450", "#634b3f", "#362925"],
    labels: ["0 mill", "1 mill", "2 mills", "3 mills", "4-179 mills"]
  },
  AllCert: {
    title: "All Certification",
    breaks: [0, 1, 2, 4, 8],
    colors: ["#E4DFD9", "#fdc70c", "#ffa212", "#fb7c24", "#e93e3a"],
    labels: ["0 mill", "1 mill", "2-3 mills", "4-7 mills", "8-290 mills"]
  }
};

let currentHeatmap = "AllCert";

function getHeatmapPaintExpression(field) {
  const config = heatmapClasses[field];
  return [
    "interpolate",
    ["linear"],
    ["to-number", ["get", field]],
    config.breaks[0], config.colors[0],
    config.breaks[1], config.colors[1],
    config.breaks[2], config.colors[2],
    config.breaks[3], config.colors[3],
    config.breaks[4], config.colors[4]
  ];
}

// HANDLER FOR HEATMAP SELECTOR DROPDOWN //
function changeHeatmap(selectedField) {
  currentHeatmap = selectedField;
  if (map.getLayer("certified-fill")) {
    map.setPaintProperty("certified-fill", "fill-color", getHeatmapPaintExpression(currentHeatmap));
  }
  updateLegend();
}

// 0. BIOPAMA GEE OIL PALM LAND COVER LAYER //
function addBIOPAMAOilPalmLayer() {
  try {
    if (!map.getSource("biopama-oil-palm")) {
      map.addSource("biopama-oil-palm", {
        type: "raster",
        tiles: ["https://earthengine.googleapis.com/v1/projects/learn-gee09/maps/16e6225dd2b53febe061e460ffda2808-ee5aeca017c93345d9d98925c94c7d1f/tiles/{z}/{x}/{y}"],
        tileSize: 256
      });
    }

    if (!map.getLayer("biopama-oil-palm-layer")) {
      const beforeLayer = map.getLayer("concession-fill") 
        ? "concession-fill" 
        : (map.getLayer("po-mill-circle") ? "po-mill-circle" : undefined);
      
      const biopamaCheckbox = document.getElementById("layer-biopama");
      const initialVisibility = biopamaCheckbox && biopamaCheckbox.checked ? "visible" : "none";

      map.addLayer({
        id: "biopama-oil-palm-layer",
        type: "raster",
        source: "biopama-oil-palm",
        layout: {
          "visibility": initialVisibility
        },
        paint: {
          "raster-opacity": 0.85
        }
      }, beforeLayer);
    }
  } catch (err) {
    console.error("Failed to add BIOPAMA oil palm layer:", err);
  }
}

// 1. CERTIFIED MILL COUNT LAYER //
function addCertifiedMillLayer() {
  try {
    if (!map.getSource("certified-mill-count")) {
      map.addSource("certified-mill-count", {
        type: "geojson",
        data: "data/CertifiedMillCount.geojson",
        generateId: true
      });
    }

    const certCheckbox = document.getElementById("layer-certified");
    const initialVisibility = certCheckbox && certCheckbox.checked ? "visible" : "none";

    if (!map.getLayer("certified-fill")) {
      map.addLayer({
        id: "certified-fill",
        type: "fill",
        source: "certified-mill-count",
        layout: {
          "visibility": initialVisibility
        },
        paint: {
          "fill-color": getHeatmapPaintExpression(currentHeatmap),
          "fill-opacity": 0.8
        }
      });
    }

    if (!map.getLayer("certified-outline")) {
      map.addLayer({
        id: "certified-outline",
        type: "line",
        source: "certified-mill-count",
        layout: {
          "visibility": initialVisibility
        },
        paint: {
          "line-color": "#D3C2E3",
          "line-width": 1
        }
      });
    }

    if (!map.getLayer("certified-hover")) {
      map.addLayer({
        id: "certified-hover",
        type: "line",
        source: "certified-mill-count",
        layout: {
          "visibility": initialVisibility
        },
        paint: {
          "line-color": "#f5f5f2",
          "line-width": 3
        },
        filter: ["==", ["id"], -1]
      });
    }
  } catch (err) {
    console.error("Failed to add certified mill layer:", err);
  }
}

// 2. RSPO CONCESSION LAYER //
function addConcessionLayer() {
  try {
    if (!map.getSource("rspo-concession")) {
      map.addSource("rspo-concession", {
        type: "geojson",
        data: "data/CertifiedRSPOConcession.geojson",
        generateId: true
      });
    }

    const concessionCheckbox = document.getElementById("layer-concession");
    const initialVisibility = concessionCheckbox && concessionCheckbox.checked ? "visible" : "none";

    if (!map.getLayer("concession-fill")) {
      map.addLayer({
        id: "concession-fill",
        type: "fill",
        source: "rspo-concession",
        layout: {
          "visibility": initialVisibility
        },
        paint: {
          "fill-color": [
            "match",
            ["get", "MemberCat"],
            "Grower", "#2ECC71",
            "Independent Smallholders", "#F39C12",
            "Scheme Outgrower", "#3498DB",
            "Scheme Smallholder", "#9B59B6",
            "#BDBDBD"
          ],
          "fill-opacity": 0.5
        }
      });
    }

    if (!map.getLayer("concession-outline")) {
      map.addLayer({
        id: "concession-outline",
        type: "line",
        source: "rspo-concession",
        layout: {
          "visibility": initialVisibility
        },
        paint: {
          "line-color": [
            "match",
            ["get", "MemberCat"],
            "Grower", "#2ECC71",
            "Independent Smallholders", "#F39C12",
            "Scheme Outgrower", "#3498DB",
            "Scheme Smallholder", "#9B59B6",
            "#BDBDBD"
          ],
          "line-width": 1
        }
      });
    }

    if (!map.getLayer("concession-hover")) {
      map.addLayer({
        id: "concession-hover",
        type: "line",
        source: "rspo-concession",
        layout: {
          "visibility": initialVisibility
        },
        paint: {
          "line-color": "#FFFFFF",
          "line-width": 3
        },
        filter: ["==", ["id"], -1]
      });
    }
  } catch (err) {
    console.error("Failed to add concession layer:", err);
  }
}

// 3. PO MILL LAYER //
function addPOMillLayer() {
  try {
    if (!map.getSource("po-mill")) {
      map.addSource("po-mill", {
        type: "geojson",
        data: "data/POMill_UML_RA.geojson",
        generateId: true
      });
    }

    const poMillCheckbox = document.getElementById("layer-pomill");
    const initialVisibility = poMillCheckbox && poMillCheckbox.checked ? "visible" : "none";

    if (!map.getLayer("po-mill-circle")) {
      map.addLayer({
        id: "po-mill-circle",
        type: "circle",
        source: "po-mill",
        layout: {
          "visibility": initialVisibility
        },
        paint: {
          "circle-color": [
            "match",
            ["get", "RSPO_Certification"],
            "IP", "#1B9E77",
            "IP, MB", "#D95F02",
            "MB", "#2C7FB8",
            "Not Certified", "#BDBDBD",
            "#666666"
          ],
          "circle-radius": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            8,
            5
          ],
          "circle-stroke-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            2,
            1
          ],
          "circle-stroke-color": "#FFFFFF"
        }
      });
    }
  } catch (err) {
    console.error("Failed to add PO mill layer:", err);
  }
}

function addAllCustomLayers() {
  addBIOPAMAOilPalmLayer();
  addCertifiedMillLayer();
  addConcessionLayer();
  addPOMillLayer();
}

// MAP INITIALIZATION //
map.on("load", () => {
  addAllCustomLayers();
  addPopups();
  addHoverEffect();
  zoomToCertifiedMill();
  showWelcomePopup();
  setupLayerControl();
});

// BASEMAP SWITCHER WITH LAYER VISIBILITY PRESERVATION //
function changeBasemap(type) {
  if (!basemaps[type]) return;

  const layerVisibilities = {
    "biopama-oil-palm-layer": map.getLayer("biopama-oil-palm-layer") ? map.getLayoutProperty("biopama-oil-palm-layer", "visibility") || "visible" : "visible",
    "certified-fill": map.getLayer("certified-fill") ? map.getLayoutProperty("certified-fill", "visibility") || "visible" : "visible",
    "certified-outline": map.getLayer("certified-outline") ? map.getLayoutProperty("certified-outline", "visibility") || "visible" : "visible",
    "certified-hover": map.getLayer("certified-hover") ? map.getLayoutProperty("certified-hover", "visibility") || "visible" : "visible",
    "concession-fill": map.getLayer("concession-fill") ? map.getLayoutProperty("concession-fill", "visibility") || "visible" : "visible",
    "concession-outline": map.getLayer("concession-outline") ? map.getLayoutProperty("concession-outline", "visibility") || "visible" : "visible",
    "concession-hover": map.getLayer("concession-hover") ? map.getLayoutProperty("concession-hover", "visibility") || "visible" : "visible",
    "po-mill-circle": map.getLayer("po-mill-circle") ? map.getLayoutProperty("po-mill-circle", "visibility") || "visible" : "visible",
    "mill-catchment-fill": map.getLayer("mill-catchment-fill") ? map.getLayoutProperty("mill-catchment-fill", "visibility") || "visible" : "visible",
    "mill-catchment-outline": map.getLayer("mill-catchment-outline") ? map.getLayoutProperty("mill-catchment-outline", "visibility") || "visible" : "visible"
  };

  const existingCatchment = map.getSource("mill-catchment") 
    ? map.getSource("mill-catchment")._data 
    : null;

  map.setStyle(basemaps[type]);

  map.once("styledata", () => {
    addAllCustomLayers();

    Object.keys(layerVisibilities).forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", layerVisibilities[layerId]);
      }
    });

    if (existingCatchment) {
      map.addSource("mill-catchment", { type: "geojson", data: existingCatchment });
      map.addLayer({
        id: "mill-catchment-fill",
        type: "fill",
        source: "mill-catchment",
        layout: {
          "visibility": layerVisibilities["mill-catchment-fill"] || "visible"
        },
        paint: { "fill-color": "#d6d19d", "fill-opacity": 0.50 }
      }, "po-mill-circle");

      map.addLayer({
        id: "mill-catchment-outline",
        type: "line",
        source: "mill-catchment",
        layout: {
          "visibility": layerVisibilities["mill-catchment-outline"] || "visible"
        },
        paint: { "line-color": "#818944", "line-width": 1.5 }
      }, "po-mill-circle");
    }

    updateLegend();
  });
}

// DYNAMIC LEGEND BUILDER //
function updateLegend() {
  const legendContainer = document.getElementById("legend-content");
  if (!legendContainer) return;

  legendContainer.innerHTML = "";

  const certCheckbox = document.getElementById("layer-certified");
  if (certCheckbox && certCheckbox.checked) {
    const config = heatmapClasses[currentHeatmap];
    if (config) {
      let itemsHTML = "";
      config.colors.forEach((color, i) => {
        const label = config.labels
          ? config.labels[i]
          : (i < 4 ? `${config.breaks[i]} – ${config.breaks[i+1]}` : `${config.breaks[4]}+`);

        itemsHTML += `
          <div class="legend-item">
            <span class="legend-swatch" style="background: ${color};"></span>
            <span class="legend-label">${label}</span>
          </div>`;
      });

      legendContainer.innerHTML += `
        <div class="legend-section">
          <h3 class="legend-main-title">Palm Oil Producer Country</h3>
          <h4 class="legend-subtitle">${config.title}</h4>
          <p class="legend-subtitle-note">
            Ranges are grouped based on dataset quantiles.
          </p>
          ${itemsHTML}
        </div>`;
    }
  }

  const concessionCheckbox = document.getElementById("layer-concession");
  if (concessionCheckbox && concessionCheckbox.checked) {
    const concessions = [
      { label: "Grower", color: "#2ECC71" },
      { label: "Independent Smallholders", color: "#F39C12" },
      { label: "Scheme Outgrower", color: "#3498DB" },
      { label: "Scheme Smallholder", color: "#9B59B6" }
    ];

    let itemsHTML = "";
    concessions.forEach(item => {
      itemsHTML += `
        <div class="legend-item">
          <span class="legend-swatch" style="background: ${item.color}; opacity: 0.8;"></span>
          <span class="legend-label">${item.label}</span>
        </div>`;
    });

    legendContainer.innerHTML += `
      <div class="legend-section">
        <h4>RSPO Certified Concession</h4>
        <div class="legend-subheading">Member Category</div>
        ${itemsHTML}
      </div>`;
  }

  const poMillCheckbox = document.getElementById("layer-pomill");
  if (poMillCheckbox && poMillCheckbox.checked) {
    const mills = [
      { label: "IP", color: "#1B9E77" },
      { label: "IP, MB", color: "#D95F02" },
      { label: "MB", color: "#2C7FB8" },
      { label: "Not Certified", color: "#BDBDBD" }
    ];

    let itemsHTML = "";
    mills.forEach(item => {
      itemsHTML += `
        <div class="legend-item">
          <span class="legend-circle" style="background: ${item.color};"></span>
          <span class="legend-label">${item.label}</span>
        </div>`;
    });

    legendContainer.innerHTML += `
      <div class="legend-section">
        <h4>Palm Oil Mill</h4>
        <div class="legend-subheading">RSPO Certification</div>
        ${itemsHTML}
      </div>`;
  }

  const catchmentCheckbox = document.getElementById("layer-catchment");
  if (catchmentCheckbox && catchmentCheckbox.checked && map.getSource("mill-catchment") && map.getLayer("mill-catchment-fill")) {
    legendContainer.innerHTML += `
      <div class="legend-section">
        <h4>Mill Potential Sourcing Area</h4>
        <div class="legend-item">
          <span class="legend-swatch" style="background: #d6d19d; border: 1.5px solid #818944;"></span>
          <span class="legend-label">Defined by 75 km road network</span>
        </div>
      </div>`;
  }

  const biopamaCheckbox = document.getElementById("layer-biopama");
  if (biopamaCheckbox && biopamaCheckbox.checked) {
    legendContainer.innerHTML += `
      <div class="legend-section">
        <h4>Land Cover (2019)</h4>
        <div class="legend-item">
          <span class="legend-swatch" style="background: #FBD48B; opacity: 0.85;"></span>
          <span class="legend-label">Oil Palm</span>
        </div>
      </div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateLegend();
});

// FIT MAP BOUNDS TO INITIAL DATA //
function zoomToCertifiedMill() {
  fetch("data/CertifiedMillCount.geojson")
    .then(response => response.json())
    .then(data => {
      const bounds = new maplibregl.LngLatBounds();

      data.features.forEach(feature => {
        const geometry = feature.geometry;
        if (geometry.type === "Polygon") {
          geometry.coordinates[0].forEach(coord => bounds.extend(coord));
        }
        if (geometry.type === "MultiPolygon") {
          geometry.coordinates.forEach(polygon => {
            polygon[0].forEach(coord => bounds.extend(coord));
          });
        }
      });

      map.fitBounds(bounds, { padding: 40 });
    })
    .catch(err => console.error("Error loading GeoJSON bounds:", err));
}

// UNIFIED SINGLE TOPMOST POPUP SYSTEM //
function addPopups() {
  const targetLayers = ["po-mill-circle", "concession-fill", "certified-fill"];

  map.on("click", (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: targetLayers });

    if (!features.length) return;

    const visibleFeatures = features.filter(f => {
      return map.getLayoutProperty(f.layer.id, "visibility") !== "none";
    });

    if (!visibleFeatures.length) return;

    const topFeature = visibleFeatures[0];
    const props = topFeature.properties;
    const layerId = topFeature.layer.id;

    if (layerId === "po-mill-circle") {
      let lng = e.lngLat.lng;
      let lat = e.lngLat.lat;

      if (topFeature.geometry && topFeature.geometry.type === "Point") {
        lng = topFeature.geometry.coordinates[0];
        lat = topFeature.geometry.coordinates[1];
      }

      const millName = props.Mill_Name || props.Parent_Company || "Palm Oil Mill";

      // Trigger Isochrone fetch via HeiGIT
      generateMillCatchment(lng, lat, millName);

      new maplibregl.Popup({ closeButton: true, closeOnClick: true })
        .setLngLat([lng, lat])
        .setHTML(`
          <h3 class="popup-title">${millName}</h3>
          <table class="popup-table">
            <tr><td><b>Company Group</b></td><td>${props.Group_Name || "N/A"}</td></tr>
            <tr><td><b>RSPO Certification</b></td><td>${props.RSPO_Certification || "N/A"}</td></tr>
            <tr><td><b>UML ID</b></td><td>${props.UML_ID || "N/A"}</td></tr>
          </table>
        `)
        .addTo(map);

    } else if (layerId === "concession-fill") {
      new maplibregl.Popup({ closeButton: true, closeOnClick: true })
        .setLngLat(e.lngLat)
        .setHTML(`
          <h3 class="popup-title">${props.Parent || "N/A"}</h3>
          <table class="popup-table">
            <tr><td><b>Category</b></td><td>${props.MemberCat || "N/A"}</td></tr>
            <tr><td><b>Subsidiary</b></td><td>${props.Subsidiary || "N/A"}</td></tr>
            <tr><td><b>Manage Unit</b></td><td>${props.ManageUnit || "N/A"}</td></tr>
            <tr><td><b>Supply Base</b></td><td>${props.SupplyBase || "N/A"}</td></tr>
            <tr><td><b>Certified Area (ha)</b></td><td>${props.SUM_AreaHa != null ? Math.round(props.SUM_AreaHa).toLocaleString() : "N/A"}</td></tr>
          </table>
        `)
        .addTo(map);

    } else if (layerId === "certified-fill") {
      new maplibregl.Popup({ closeButton: true, closeOnClick: true })
        .setLngLat(e.lngLat)
        .setHTML(`
          <h3 class="popup-title">${props.CPMname || "Country"}</h3>
          <table class="popup-table">
            <tr><td><b>Total Palm Oil Mill</b></td><td>${props.TotalMill ?? "N/A"}</td></tr>
            <tr><td><b>Total Certified Mill</b></td><td>${props.AllCert ?? "N/A"}</td></tr>
            <tr><td><b>Identity Preserved (IP)</b></td><td>${props.IP ?? "N/A"}</td></tr>
            <tr><td><b>IP/MB</b></td><td>${props.IP_MB ?? "N/A"}</td></tr>
            <tr><td><b>Mass Balance (MB)</b></td><td>${props.MB ?? "N/A"}</td></tr>
          </table>
        `)
        .addTo(map);
    }
  });
}

// HOVER HIGHLIGHTING //
function addHoverEffect() {
  let hoveredCertId = null;
  let hoveredConcessionId = null;
  let hoveredMillId = null;

  const interactiveLayers = ["certified-fill", "concession-fill", "po-mill-circle"];

  interactiveLayers.forEach(layer => {
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  });

  map.on("mousemove", "certified-fill", (e) => {
    if (e.features.length > 0) {
      const id = e.features[0].id;
      if (id !== hoveredCertId) {
        hoveredCertId = id;
        map.setFilter("certified-hover", ["==", ["id"], id]);
      }
    }
  });

  map.on("mouseleave", "certified-fill", () => {
    hoveredCertId = null;
    map.setFilter("certified-hover", ["==", ["id"], -1]);
  });

  map.on("mousemove", "concession-fill", (e) => {
    if (e.features.length > 0) {
      const id = e.features[0].id;
      if (id !== hoveredConcessionId) {
        hoveredConcessionId = id;
        map.setFilter("concession-hover", ["==", ["id"], id]);
      }
    }
  });

  map.on("mouseleave", "concession-fill", () => {
    hoveredConcessionId = null;
    map.setFilter("concession-hover", ["==", ["id"], -1]);
  });

  map.on("mousemove", "po-mill-circle", (e) => {
    if (e.features.length > 0) {
      if (hoveredMillId !== null) {
        map.setFeatureState(
          { source: "po-mill", id: hoveredMillId },
          { hover: false }
        );
      }
      hoveredMillId = e.features[0].id;
      map.setFeatureState(
        { source: "po-mill", id: hoveredMillId },
        { hover: true }
      );
    }
  });

  map.on("mouseleave", "po-mill-circle", () => {
    if (hoveredMillId !== null) {
      map.setFeatureState(
        { source: "po-mill", id: hoveredMillId },
        { hover: false }
      );
    }
    hoveredMillId = null;
  });
}

// WELCOME POPUP //
function showWelcomePopup() {
  new maplibregl.Popup({
    closeButton: true,
    closeOnClick: true,
    maxWidth: "780px"
  })
    .setLngLat([35, 42])
    .setHTML(`
      <div style="font-family: sans-serif; padding: 4px;">
        <h3 style="margin: 0 0 12px 0; color: #124734; font-size: 1.25rem; font-weight: 700;">
          🌴 Welcome to the Global Palm Oil Dashboard! 🌴
        </h3>
        
        <p style="margin: 0 0 12px 0; line-height: 1.5; color: #2C3E50;">
          Ever wondered where your everyday essentials come from? Palm oil is <b>nature's most versatile raw material</b>, found in everything from your favorite snacks to everyday soaps! Dive in and explore global production, locate processing mills, oil palm plantation and trace sustainability on the map.
        </p>

        <p style="margin: 0 0 12px 0; line-height: 1; color: #2C3E50;">
          <b>What you can do here:</b>
        </p>
        <ul style="margin: 6px 0 0 0; padding: 0; line-height: 1.5; color: #2C3E50; list-style: none;">
          <li style="margin-bottom: 6px;">✔️ Explore global palm oil production hubs and palm oil processing mills.</li>
          <li style="margin-bottom: 6px;">✔️ Uncover which plantations are leading the way in sustainability through <b>RSPO certification</b>.</li>
          <li style="margin-bottom: 6px;">✔️ Click any mill point to calculate its <b>potential sourcing area of fresh fruit bunch (FFB) </b><a href="https://www.wri.org/insights/palm-oil-mill-data-step-towards-transparency" target="_blank" style="color: #C0392B; text-decoration: underline;">[1]</a>.</li>
          <li style="margin-bottom: 4px; margin-left: 24px; color: #D35400;"><b>⚠️ Notes:</b></li>
          <li style="margin-bottom: 4px; margin-left: 40px; color: #555;">• Please wait a moment for the analysis to process 🌍</li>
          <li style="margin-bottom: 6px; margin-left: 40px; color: #555; line-height: 1.4;">• The mill potential sourcing area is calculated using <i>OpenStreetMap</i> road network. In remote or rural areas, unmapped plantation roads or private transport networks may not be fully represented, which can result in an underestimation of the actual potential sourcing area.</li>
        </ul>

        <div style="background-color: #FDF2F2; border-left: 4px solid #E74C3C; padding: 10px 12px; margin-top: 12px; border-radius: 4px;">
          <p style="margin: 0 0 6px 0; font-weight: 700; color: #C0392B;">
            🚨 Important Notes on the Data:
          </p>
          <ol style="margin: 0 0 0 16px; padding: 0; font-size: 0.9rem; line-height: 1.45; color: #2C3E50;">
            <li style="margin-bottom: 6px;">
              <b>Producer Country Layer:</b> A value of <b>0</b> means the country actively produces palm oil, but hasn't certified any mills under RSPO standards yet.
            </li>
            <li>
              <b>Missing Indonesian Concessions:</b> Even though Indonesia is the largest producer of RSPO-certified sustainable palm oil in the world, public concession data for the country is completely missing here <a href="https://rspo.org/as-an-organisation/tools/georspo/" target="_blank" style="color: #C0392B; text-decoration: underline;">[2]</a>. Following orders under President Joko Widodo, palm oil companies were instructed not to share their concession boundary data, dealing a massive blow to public transparency in the sector <a href="https://www.greenpeace.org/southeastasia/press/2448/indonesian-government-actively-blocking-efforts-to-reform-palm-oil-industry/" target="_blank" style="color: #C0392B; text-decoration: underline;">[3]</a>. <span style="color: #FF0000; font-weight: bold;">Free Indonesia!</span>
            </li>
          </ol>
        </div>
      </div>
    `)
    .addTo(map);
}

function toggleGallery(){
  document.getElementById("basemap-panel").classList.toggle("hidden");
}

// LAYER CONTROLS //
function setupLayerControl() {
  const biopamaCheckbox = document.getElementById("layer-biopama");
  if (biopamaCheckbox) {
    biopamaCheckbox.addEventListener("change", function () {
      const visibility = this.checked ? "visible" : "none";
      if (map.getLayer("biopama-oil-palm-layer")) {
        map.setLayoutProperty("biopama-oil-palm-layer", "visibility", visibility);
      }
      updateLegend();
    });
  }

  const certCheckbox = document.getElementById("layer-certified");
  if (certCheckbox) {
    certCheckbox.addEventListener("change", function () {
      const visibility = this.checked ? "visible" : "none";
      if (map.getLayer("certified-fill")) map.setLayoutProperty("certified-fill", "visibility", visibility);
      if (map.getLayer("certified-outline")) map.setLayoutProperty("certified-outline", "visibility", visibility);
      if (map.getLayer("certified-hover")) map.setLayoutProperty("certified-hover", "visibility", visibility);
      updateLegend();
    });
  }

  const boundaryCheckbox = document.getElementById("layer-boundary");
  if (boundaryCheckbox) {
    boundaryCheckbox.addEventListener("change", function () {
      const visibility = this.checked ? "visible" : "none";
      if (map.getLayer("certified-outline")) map.setLayoutProperty("certified-outline", "visibility", visibility);
    });
  }

  const concessionCheckbox = document.getElementById("layer-concession");
  if (concessionCheckbox) {
    concessionCheckbox.addEventListener("change", function () {
      const visibility = this.checked ? "visible" : "none";
      if (map.getLayer("concession-fill")) map.setLayoutProperty("concession-fill", "visibility", visibility);
      if (map.getLayer("concession-outline")) map.setLayoutProperty("concession-outline", "visibility", visibility);
      if (map.getLayer("concession-hover")) map.setLayoutProperty("concession-hover", "visibility", visibility);
      updateLegend();
    });
  }

  const poMillCheckbox = document.getElementById("layer-pomill");
  if (poMillCheckbox) {
    poMillCheckbox.addEventListener("change", function () {
      const visibility = this.checked ? "visible" : "none";
      if (map.getLayer("po-mill-circle")) map.setLayoutProperty("po-mill-circle", "visibility", visibility);
      updateLegend();
    });
  }

  const catchmentCheckbox = document.getElementById("layer-catchment");
  if (catchmentCheckbox) {
    catchmentCheckbox.addEventListener("change", function () {
      const visibility = this.checked ? "visible" : "none";
      if (map.getLayer("mill-catchment-fill")) {
        map.setLayoutProperty("mill-catchment-fill", "visibility", visibility);
      }
      if (map.getLayer("mill-catchment-outline")) {
        map.setLayoutProperty("mill-catchment-outline", "visibility", visibility);
      }
      updateLegend();
    });
  }

  updateLegend();
}