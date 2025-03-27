// Global Variables
let map;
let drawnItems;
let drawControl;
let activeMarkers = new Map();
let isAreaSelectionMode = false;
let selectedArea = null;
let trendChart = null;
let riskChart = null;

// Constants
const MAP_CENTER = [20.5937, 78.9629]; // India
const MAP_ZOOM = 5;
const API_ENDPOINT = '/api/analyze-area';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    initializeCharts();
    setupEventListeners();
});

// Initialize Leaflet Map
function initializeMap() {
    // Create map instance
    map = L.map('map', {
        center: MAP_CENTER,
        zoom: MAP_ZOOM,
        zoomControl: false
    });

    // Add zoom control to top-right
    L.control.zoom({
        position: 'topright'
    }).addTo(map);

    // Add tile layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    // Add layer control
    const baseMaps = {
        "OpenStreetMap": osmLayer,
        "Satellite": satelliteLayer
    };

    L.control.layers(baseMaps).addTo(map);
    osmLayer.addTo(map); // Set default layer

    // Initialize drawing controls
    initializeDrawControls();
}

// Initialize Drawing Controls
function initializeDrawControls() {
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    drawControl = new L.Control.Draw({
        draw: {
            polygon: {
                allowIntersection: false,
                drawError: {
                    color: '#e74c3c',
                    timeout: 1000
                },
                shapeOptions: {
                    color: '#2ecc71'
                }
            },
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });

    // Add draw control to map
    map.addControl(drawControl);

    // Handle draw events
    map.on(L.Draw.Event.CREATED, handleAreaCreated);
    map.on(L.Draw.Event.DRAWSTART, handleDrawStart);
    map.on(L.Draw.Event.DRAWSTOP, handleDrawStop);
}

// Initialize Charts
function initializeCharts() {
    // Trend Chart
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Deforestation Trend',
                data: [],
                borderColor: '#2ecc71',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        font: {
                            size: 11
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: {
                            size: 10
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });

    // Risk Distribution Chart
    const riskCtx = document.getElementById('riskChart').getContext('2d');
    riskChart = new Chart(riskCtx, {
        type: 'doughnut',
        data: {
            labels: ['High Risk', 'Medium Risk', 'Low Risk'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#e74c3c', '#f39c12', '#2ecc71']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // Select Area Button
    document.getElementById('selectAreaBtn').addEventListener('click', toggleAreaSelection);
    
    // Clear Button
    document.getElementById('clearBtn').addEventListener('click', clearDetection);
    
    // Detection Mode Change
    document.getElementById('detectionMode').addEventListener('change', handleModeChange);
    
    // Sensitivity Change
    document.getElementById('sensitivitySlider').addEventListener('input', handleSensitivityChange);
    
    // Time Range Change
    document.getElementById('timeRange').addEventListener('change', handleTimeRangeChange);
}

// Handle Area Creation
async function handleAreaCreated(e) {
    try {
        // Clear any existing areas
        drawnItems.clearLayers();
        
        // Add the new area
        selectedArea = e.layer;
        drawnItems.addLayer(selectedArea);
        
        // Get coordinates of the selected area
        const coordinates = selectedArea.getLatLngs()[0].map(latLng => [latLng.lat, latLng.lng]);
        
        // Reset area selection mode
        isAreaSelectionMode = false;
        const button = document.getElementById('selectAreaBtn');
        button.classList.remove('active');
        button.innerHTML = '<i class="fas fa-draw-polygon"></i> Select Area';
        
        // Show loading overlay
        showLoadingOverlay();
        
        // Get current settings
        const settings = {
            coordinates: coordinates,
            detectionMode: document.getElementById('detectionMode').value,
            timeRange: document.getElementById('timeRange').value,
            sensitivity: parseFloat(document.getElementById('sensitivitySlider').value)
        };
        
        // Send request to backend
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to analyze area: ${response.statusText}`);
        }
        
        const results = await response.json();
        
        // Update UI with results
        updateResults(results);
        
    } catch (error) {
        console.error('Error analyzing area:', error);
        showError('Failed to analyze the selected area. Please try again.');
    } finally {
        hideLoadingOverlay();
    }
}

// Update Results
function updateResults(results) {
    // Clear existing markers
    clearMarkers();
    
    // Update statistics
    updateStatistics(results);
    
    // Add new markers
    addDetectionMarkers(results.detectedAreas);
    
    // Update charts
    updateCharts(results);
}

// Update Statistics
function updateStatistics(results) {
    const stats = ['totalSites', 'highRisk', 'mediumRisk', 'lowRisk'];
    stats.forEach(stat => {
        const element = document.getElementById(stat);
        if (element) {
            animateNumber(element, 0, results[stat]);
        }
    });
}

// Animate Number
function animateNumber(element, start, end) {
    const duration = 1000;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const value = Math.floor(start + (end - start) * progress);
        element.textContent = value;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// Add Detection Markers
function addDetectionMarkers(detectedAreas) {
    detectedAreas.forEach(area => {
        // Create marker
        const marker = L.marker(area.coordinates, {
            icon: L.divIcon({
                className: `custom-marker ${area.riskLevel}-risk`,
                html: `<div class="marker-content">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span class="confidence">${Math.round(area.confidence)}%</span>
                       </div>`,
                iconSize: [30, 30]
            })
        });
        
        // Create impact circle
        const circle = L.circle(area.coordinates, {
            radius: area.size * 100,
            color: getRiskColor(area.riskLevel),
            fillColor: getRiskColor(area.riskLevel),
            fillOpacity: 0.2
        });
        
        // Create popup
        const popup = createPopup(area);
        
        // Bind popup to both marker and circle
        marker.bindPopup(popup);
        circle.bindPopup(popup);
        
        // Add to map
        marker.addTo(map);
        circle.addTo(map);
        
        // Store references
        activeMarkers.set(area.coordinates.toString(), { marker, circle });
    });
}

// Create Popup Content
function createPopup(area) {
    return L.popup().setContent(`
        <div class="popup-content">
            <h3>${area.type} Detection</h3>
            <div class="popup-details">
                <p><strong>Risk Level:</strong> <span class="${area.riskLevel}-risk">${area.riskLevel}</span></p>
                <p><strong>Confidence:</strong> ${Math.round(area.confidence)}%</p>
                <p><strong>Area:</strong> ${area.size.toFixed(2)} km²</p>
                <p><strong>Vegetation Density:</strong> ${area.vegetationDensity}%</p>
                <p><strong>Description:</strong> ${area.description}</p>
            </div>
        </div>
    `);
}

// Update Charts
function updateCharts(results) {
    // Update Risk Distribution Chart
    riskChart.data.datasets[0].data = [
        results.highRisk,
        results.mediumRisk,
        results.lowRisk
    ];
    riskChart.update();
    
    // Update Trend Chart (example data)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const data = months.map(() => Math.floor(Math.random() * 100));
    
    trendChart.data.labels = months;
    trendChart.data.datasets[0].data = data;
    trendChart.update();
}

// Utility Functions
function showLoadingOverlay() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

function hideLoadingOverlay() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

function clearMarkers() {
    activeMarkers.forEach(({ marker, circle }) => {
        marker.remove();
        circle.remove();
    });
    activeMarkers.clear();
}

function getRiskColor(riskLevel) {
    const colors = {
        high: '#e74c3c',
        medium: '#f39c12',
        low: '#2ecc71'
    };
    return colors[riskLevel] || colors.low;
}

// Event Handlers
function toggleAreaSelection() {
    const button = document.getElementById('selectAreaBtn');
    isAreaSelectionMode = !isAreaSelectionMode;
    
    if (isAreaSelectionMode) {
        button.classList.add('active');
        button.innerHTML = '<i class="fas fa-times"></i> Cancel Selection';
        new L.Draw.Polygon(map).enable();
    } else {
        button.classList.remove('active');
        button.innerHTML = '<i class="fas fa-draw-polygon"></i> Select Area';
        map.fire(L.Draw.Event.DRAWSTOP);
    }
}

function clearDetection() {
    drawnItems.clearLayers();
    clearMarkers();
    
    // Reset statistics
    ['totalSites', 'highRisk', 'mediumRisk', 'lowRisk'].forEach(id => {
        document.getElementById(id).textContent = '0';
    });
    
    // Reset charts
    riskChart.data.datasets[0].data = [0, 0, 0];
    riskChart.update();
    
    trendChart.data.datasets[0].data = [];
    trendChart.update();
}

function handleDrawStart() {
    drawnItems.clearLayers();
}

function handleDrawStop() {
    if (!isAreaSelectionMode) {
        const button = document.getElementById('selectAreaBtn');
        button.classList.remove('active');
        button.innerHTML = '<i class="fas fa-draw-polygon"></i> Select Area';
    }
}

function handleModeChange() {
    clearDetection();
}

function handleSensitivityChange() {
    // Optional: Add real-time sensitivity feedback
}

function handleTimeRangeChange() {
    if (selectedArea) {
        handleAreaCreated({ layer: selectedArea });
    }
} 