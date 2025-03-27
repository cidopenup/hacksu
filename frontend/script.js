// Initialize maps
let map;
let riskMap;

// Global variables
let activeMarkers = new Map(); // Store active markers
let historicalData = new Map(); // Store historical data
let isMonitoring = false;
let monitoringInterval;
let trendChart = null;
let impactChart = null;
let isDetectionActive = false;
let userSelectedArea = null;
let drawControl = null;
let drawnItems = null;
let isAreaSelectionMode = false;
let areaInstructions = null;
let currentMode = 'deforestation'; // Default mode
let selectedArea = null;

// Add new global variables for water reservoir detection
const waterReservoirData = {
    markers: [],
    polygons: [],
    statistics: {
        totalVolume: 0,
        waterQuality: 'Good',
        reservoirCount: 0
    }
};

// Add new global variables for charts
let carbonTrendChart = null;
let waterTrendChart = null;

// Data source configuration
const dataSources = {
    deforestation: {
        api: 'https://api.example.com/deforestation',
        updateInterval: 3600000, // 1 hour
        lastUpdate: null
    },
    biodiversity: {
        api: 'https://api.example.com/biodiversity',
        updateInterval: 7200000, // 2 hours
        lastUpdate: null
    },
    carbon: {
        api: 'https://api.example.com/carbon',
        updateInterval: 1800000, // 30 minutes
        lastUpdate: null
    }
};

// Detection configuration
let detectionConfig = {
    minConfidence: 0.7,
    temporalThreshold: 7, // days
    spatialThreshold: 0.5, // km
    changeThreshold: 0.15 // 15% change
};

// Common chart options
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
        padding: {
            top: 5,
            right: 5,
            bottom: 5,
            left: 5
        }
    },
    plugins: {
        legend: {
            display: true,
            position: 'top',
            labels: {
                boxWidth: 8,
                padding: 6,
                font: {
                    size: 11
                }
            }
        },
        title: {
            display: true,
            padding: 3,
            font: {
                size: 12
            }
        }
    },
    scales: {
        x: {
            ticks: {
                font: {
                    size: 10
                },
                maxRotation: 45,
                minRotation: 45
            },
            title: {
                display: true,
                font: {
                    size: 11
                }
            }
        },
        y: {
            ticks: {
                font: {
                    size: 10
                }
            },
            title: {
                display: true,
                font: {
                    size: 11
                }
            }
        }
    }
};

// ML Model Integration and Application Initialization
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Show loading indicator
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }

        // Wait for all resources to load
        await Promise.all([
            loadLeaflet(),
            loadChartJS()
        ]);

        // Initialize components
        initMap();
        initializeCharts();
        
        // Hide loading indicator
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    } catch (error) {
        console.error('Error during initialization:', error);
        showError('Failed to initialize the application. Please refresh the page.');
    }
});

// Load Leaflet and dependencies
async function loadLeaflet() {
    return new Promise((resolve, reject) => {
        try {
            // Check if Leaflet is already loaded
            if (typeof L !== 'undefined' && L.version) {
                resolve();
                return;
            }

            // Create and load Leaflet script
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
            script.crossOrigin = '';
            
            script.onload = () => {
                // Load Leaflet.draw after Leaflet
                const drawScript = document.createElement('script');
                drawScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js';
                drawScript.onload = resolve;
                drawScript.onerror = reject;
                document.head.appendChild(drawScript);
            };
            
            script.onerror = reject;
            document.head.appendChild(script);
        } catch (error) {
            reject(error);
        }
    });
}

// Load Chart.js
async function loadChartJS() {
    return new Promise((resolve, reject) => {
        try {
            // Check if Chart.js is already loaded
            if (typeof Chart !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.7.0/dist/chart.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        } catch (error) {
            reject(error);
        }
    });
}

// Show error message
function showError(message) {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.innerHTML = `
            <div class="loading-content error">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
                <button onclick="location.reload()" class="reload-button">
                    <i class="fas fa-sync-alt"></i> Reload Page
                </button>
            </div>
        `;
    }
}

// Initialize the main map
function initMap() {
    try {
        // Default center (India)
        const defaultCenter = [20.5937, 78.9629];
        
        // Define tile layers with green shade
        const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            name: 'Street View'
        });

        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri',
            name: 'Satellite View'
        });

        const waterLayer = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg', {
            attribution: '© Stamen Design'
        });

        // Initialize main detection map
        map = L.map('map', {
            center: defaultCenter,
            zoom: 5,
            layers: [streetLayer],
            zoomControl: true,
            attributionControl: true
        });
        
        // Add layer controls
        L.control.layers({
            'Street View': streetLayer,
            'Satellite View': satelliteLayer,
            'Water Bodies': waterLayer
        }).addTo(map);

        // Initialize drawing controls
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
                        color: '#2ecc71',
                        fillOpacity: 0.2,
                        weight: 2
                    },
                    showArea: true
                },
                rectangle: false,
                circle: false,
                circlemarker: false,
                marker: false,
                polyline: false
            },
            edit: {
                featureGroup: drawnItems,
                remove: true,
                edit: false
            }
        });

        // Add draw control to map
        map.addControl(drawControl);

        // Event handlers for drawing
        map.on('draw:created', handleAreaCreated);
        map.on('draw:drawstart', () => showInstructions('Click on the map to start drawing. Double-click to complete.'));
        map.on('draw:drawstop', () => hideInstructions());

        // Add click handler to cancel drawing on right-click
        map.on('contextmenu', () => {
            if (isAreaSelectionMode) {
                toggleAreaSelection();
            }
        });

        // Add map controls
        addMapControls();

        initializeAreaSelection(map);

        return true;
    } catch (error) {
        console.error('Error initializing map:', error);
        showError('Failed to initialize the map. Please check your internet connection.');
        return false;
    }
}

// Handle area creation
function handleAreaCreated(e) {
    try {
        // Clear any existing areas
        drawnItems.clearLayers();
        
        // Add the new area
        selectedArea = e.layer;
        drawnItems.addLayer(selectedArea);
        
        // Get coordinates of the selected area
        const latLngs = selectedArea.getLatLngs()[0];
        const coordinates = latLngs.map(latLng => [latLng.lat, latLng.lng]);
        
        // Reset area selection mode
        isAreaSelectionMode = false;
        const button = document.querySelector('.detection-button');
        if (button) {
            button.classList.remove('active');
            button.innerHTML = '<i class="fas fa-draw-polygon"></i> Select Area';
        }
        
        // Show loading overlay
        showLoadingOverlay('Analyzing selected area...');
        
        // Analyze the selected area
        analyzeSelectedArea(coordinates)
            .then(results => {
                if (results) {
                    // Update UI with results
                    updateAnalysisResults(results);
                }
            })
            .catch(error => {
                console.error('Error in area analysis:', error);
                const errorMessage = document.createElement('div');
                errorMessage.className = 'error-message';
                errorMessage.textContent = 'Failed to analyze the selected area. Please try again.';
                document.body.appendChild(errorMessage);
                setTimeout(() => errorMessage.remove(), 3000);
            })
            .finally(() => {
                hideLoadingOverlay();
            });
    } catch (error) {
        console.error('Error handling area creation:', error);
        showError('Failed to process selected area. Please try again.');
    }
}

// Add instruction display functions
function showInstructions(message) {
    let instructions = document.querySelector('.area-instructions');
    if (!instructions) {
        instructions = document.createElement('div');
        instructions.className = 'area-instructions';
        document.body.appendChild(instructions);
    }
    instructions.textContent = message;
    instructions.style.display = 'block';
}

function hideInstructions() {
    const instructions = document.querySelector('.area-selection-instructions');
    if (instructions) {
        instructions.style.display = 'none';
    }
}

// Add map controls
function addMapControls() {
    // Add scale control
    L.control.scale({
        imperial: false,
        position: 'bottomright'
    }).addTo(map);

    // Add zoom control with custom position
    map.zoomControl.setPosition('topright');

    // Add custom control for detection mode
    const detectionControl = L.Control.extend({
        options: {
            position: 'topleft'
        },
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            const button = L.DomUtil.create('a', '', container);
            button.innerHTML = '<i class="fas fa-tree"></i>';
            button.title = 'Toggle Detection Mode';
            button.href = '#';
            
            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                toggleDetectionMode();
            });
            
            return container;
        }
    });
    map.addControl(new detectionControl());
}

// Toggle detection mode
function toggleDetectionMode() {
    const button = document.querySelector('.detection-button');
    isDetectionActive = !isDetectionActive;
    
    if (isDetectionActive) {
        // Start detection
        button.classList.add('active');
        button.innerHTML = '<i class="fas fa-stop"></i> Stop Detection';
        
        // Show loading state
        showLoadingOverlay('Starting detection...');
        
        // Start monitoring
        startMonitoring();
        
        // Perform initial detection
        setTimeout(() => {
            if (selectedArea) {
                performDetectionInArea(selectedArea);
            } else {
                performDetectionInViewport();
            }
            hideLoadingOverlay();
        }, 1000);
    } else {
        // Stop detection
        button.classList.remove('active');
        button.innerHTML = '<i class="fas fa-search"></i> Start Detection';
        stopMonitoring();
        clearDetectionResults();
    }
}

// Update detection sensitivity
function updateDetectionSensitivity(value) {
    detectionConfig.minConfidence = value / 10;
}

// Perform detection in selected area
function performDetectionInArea(area) {
    if (!area) return;
    
    showLoadingOverlay('Analyzing selected area...');
    
    setTimeout(() => {
        if (currentMode === 'water') {
            detectWaterReservoirs(area);
        } else {
            // Existing deforestation detection code
            const bounds = area.getBounds();
            const sites = generateDeforestationData();
            
            // Filter sites within the selected area
            const filteredSites = sites.filter(site => {
                const point = L.latLng(site.lat, site.lng);
                return bounds.contains(point);
            });
            
            displayDetectionResults(filteredSites, analyzeDetectionPatterns(filteredSites, historicalData.get('deforestation') || []));
        }
        hideLoadingOverlay();
    }, 1500);
}

// Perform detection in current viewport
function performDetectionInViewport() {
    showLoadingOverlay('Analyzing current viewport...');
    
    setTimeout(() => {
        const bounds = map.getBounds();
        const sites = generateDeforestationData();
        
        // Filter sites within the viewport
        const filteredSites = sites.filter(site => {
            const point = L.latLng(site.lat, site.lng);
            return bounds.contains(point);
        });
        
        displayDetectionResults(filteredSites, analyzeDetectionPatterns(filteredSites, historicalData.get('deforestation') || []));
        hideLoadingOverlay();
    }, 1500);
}

// Display detection results
function displayDetectionResults(sites, analysis) {
    // Clear existing markers
    clearDetectionResults();
    
    // Update map with new markers
    sites.forEach(site => {
        const marker = createCustomMarker(site);
        const circle = createImpactCircle(site);
        const popup = createDetailedPopup(site);
        
        marker.bindPopup(popup);
        marker.addTo(map);
        circle.addTo(map);
        
        activeMarkers.set(site.id, { marker, circle });
    });
    
    // Update statistics
    updateStatCards({
        totalSites: sites.length,
        highRisk: sites.filter(site => site.riskLevel === 'high').length,
        mediumRisk: sites.filter(site => site.riskLevel === 'medium').length,
        lowRisk: sites.filter(site => site.riskLevel === 'low').length
    });
    
    // Update charts
    updateCharts(document.getElementById('timeRange').value, currentMode);
}

// Clear detection results
function clearDetectionResults() {
    activeMarkers.forEach(({ marker, circle }) => {
        map.removeLayer(marker);
        map.removeLayer(circle);
    });
    activeMarkers.clear();
}

// Toggle area selection mode
function toggleAreaSelection() {
    const button = document.querySelector('.detection-button');
    
    if (isAreaSelectionMode) {
        // Cancel selection
        map.fire('draw:canceled');
        new L.Draw.Polygon(map).disable();
        isAreaSelectionMode = false;
        button.classList.remove('active');
        button.innerHTML = '<i class="fas fa-draw-polygon"></i> Select Area';
    } else {
        // Start selection
        new L.Draw.Polygon(map).enable();
        isAreaSelectionMode = true;
        button.classList.add('active');
        button.innerHTML = '<i class="fas fa-times"></i> Cancel Selection';
    }
}

// Generate deforestation data
function generateDeforestationData(timeframe = 'current') {
    const sites = [];
    const center = [20.5937, 78.9629]; // Center of India
    
    // Generate random sites around India
    for (let i = 0; i < 10; i++) {
        const randomOffset = () => (Math.random() - 0.5) * 2;
        const lat = center[0] + randomOffset();
        const lng = center[1] + randomOffset();
        
        sites.push({
            id: `site-${i}`,
            lat,
            lng,
            area: Math.random() * 100,
            confidence: Math.random(),
            timestamp: new Date().toISOString(),
            riskLevel: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
            description: generateDescription({ lat, lng, area: Math.random() * 100 })
        });
    }
    
    return sites;
}

// Helper function to create custom markers
function createCustomMarker(area) {
    const icon = L.divIcon({
        className: `custom-marker ${area.riskLevel}-risk`,
        html: `<div class="marker-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span class="confidence">${area.confidence}%</span>
               </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    return L.marker(area.coordinates, { icon });
}

// Helper function to create impact circles
function createImpactCircle(area) {
    const radius = area.size / 100; // Scale the radius based on size
    const color = area.riskLevel === 'high' ? '#e74c3c' : 
                  area.riskLevel === 'medium' ? '#f39c12' : '#2ecc71';
    
    return L.circle(area.coordinates, {
        radius: radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.2,
        weight: 2
    });
}

// Helper function to create detailed popups
function createDetailedPopup(area) {
    const riskLevelClass = area.riskLevel === 'high' ? 'high-risk' : 
                          area.riskLevel === 'medium' ? 'medium-risk' : 'low-risk';
    
    return L.popup({
        className: `custom-popup ${riskLevelClass}`,
        maxWidth: 300
    }).setContent(`
        <div class="popup-content">
            <h3>${area.type === 'deforestation' ? 'Deforestation' : 'Water Body'} Detection</h3>
            <div class="popup-details">
                <p><strong>Risk Level:</strong> <span class="${riskLevelClass}">${area.riskLevel}</span></p>
                <p><strong>Confidence:</strong> ${area.confidence}%</p>
                <p><strong>Size:</strong> ${area.size} hectares</p>
                <p><strong>Vegetation Density:</strong> ${area.vegetationDensity}%</p>
            </div>
            <div class="popup-actions">
                <button onclick="focusOnArea(${area.coordinates[0]}, ${area.coordinates[1]})">
                    Focus View
                </button>
                <button onclick="generateReport(${area.coordinates[0]}, ${area.coordinates[1]})">
                    Generate Report
                </button>
            </div>
        </div>
    `);
}

// Helper function to focus map on specific coordinates
function focusOnArea(lat, lng) {
    map.setView([lat, lng], 15);
}

// Helper function to generate reports
function generateReport(lat, lng) {
    // This would typically open a modal with detailed report
    console.log('Generating report for coordinates:', lat, lng);
}

// Generate description for a site
function generateDescription(area) {
    const descriptions = [
        `Significant deforestation detected in this area, affecting approximately ${area.area.toFixed(2)} km² of forest cover.`,
        `Moderate deforestation activity observed, impacting ${area.area.toFixed(2)} km² of forest area.`,
        `Minor deforestation detected, affecting ${area.area.toFixed(2)} km² of forest cover.`
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
}

// Initialize charts
function initializeCharts() {
    // Deforestation Trend Chart
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Deforestation Rate',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                borderWidth: 1.5,
                pointRadius: 2
            }]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                title: {
                    ...commonOptions.plugins.title,
                    text: 'Deforestation Rate Over Time'
                }
            }
        }
    });

    // Biodiversity Impact Chart
    const impactCtx = document.getElementById('impactChart').getContext('2d');
    impactChart = new Chart(impactCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Biodiversity Impact',
                data: [],
                backgroundColor: 'rgba(153, 102, 255, 0.5)',
                borderColor: 'rgb(153, 102, 255)',
                borderWidth: 1
            }]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                title: {
                    ...commonOptions.plugins.title,
                    text: 'Biodiversity Impact Analysis'
                }
            },
            scales: {
                ...commonOptions.scales,
                x: {
                    ...commonOptions.scales.x,
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    // Carbon Trend Chart
    const carbonCtx = document.getElementById('carbonTrendChart').getContext('2d');
    carbonTrendChart = new Chart(carbonCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Carbon Emissions',
                data: [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderWidth: 1.5,
                pointRadius: 2,
                fill: true
            }]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                title: {
                    ...commonOptions.plugins.title,
                    text: 'Carbon Emissions Trend'
                }
            }
        }
    });

    // Water Reservoir Chart
    const waterCtx = document.getElementById('waterTrendChart').getContext('2d');
    waterTrendChart = new Chart(waterCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Water Level',
                data: [],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderWidth: 1.5,
                pointRadius: 2,
                fill: true
            }]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                title: {
                    ...commonOptions.plugins.title,
                    text: 'Water Reservoir Level Trend'
                }
            }
        }
    });
}

function updateCharts(timeRange, metric) {
    const timestamps = generateTimeLabels(timeRange);
    
    switch(metric) {
        case 'deforestation':
            updateDeforestationChart(timestamps);
            break;
        case 'biodiversity':
            updateBiodiversityChart(timestamps);
            break;
        case 'carbon':
            updateCarbonChart(timestamps);
            break;
        case 'water':
            updateWaterChart(timestamps);
            break;
    }
}

function generateTimeLabels(hours) {
    const labels = [];
    const now = new Date();
    for (let i = hours; i >= 0; i--) {
        const date = new Date(now - i * 60 * 60 * 1000);
        labels.push(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    return labels;
}

function updateDeforestationChart(timestamps) {
    const data = timestamps.map(() => Math.random() * 100);
    trendChart.data.labels = timestamps;
    trendChart.data.datasets[0].data = data;
    trendChart.update();
}

function updateBiodiversityChart(timestamps) {
    const data = timestamps.map(() => Math.random() * 100);
    impactChart.data.labels = timestamps;
    impactChart.data.datasets[0].data = data;
    impactChart.update();
}

function updateCarbonChart(timestamps) {
    const data = timestamps.map(() => Math.random() * 1000);
    carbonTrendChart.data.labels = timestamps;
    carbonTrendChart.data.datasets[0].data = data;
    carbonTrendChart.update();
}

function updateWaterChart(timestamps) {
    const data = timestamps.map(() => Math.random() * 100);
    waterTrendChart.data.labels = timestamps;
    waterTrendChart.data.datasets[0].data = data;
    waterTrendChart.update();
}

// Start monitoring
function startMonitoring() {
    if (!monitoringInterval) {
        monitoringInterval = setInterval(performDetection, 300000); // Check every 5 minutes
    }
}

// Stop monitoring
function stopMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
}

// Perform detection
function performDetection() {
    if (selectedArea) {
        performDetectionInArea();
    } else {
        performDetectionInViewport();
    }
}

// Update map with new data
function updateMap(deforestationSites) {
    // Clear existing markers
    clearDetectionResults();
    
    // Add new markers
    deforestationSites.forEach(site => {
        const marker = createCustomMarker(site);
        const circle = createImpactCircle(site);
        const popup = createDetailedPopup(site);
        
        marker.bindPopup(popup);
        marker.addTo(map);
        circle.addTo(map);
        
        activeMarkers.set(site.id, { marker, circle });
    });
}

// Update statistics cards
function updateStatCards(data) {
    updateStatWithAnimation('totalSites', data.totalSites);
    updateStatWithAnimation('highRisk', data.highRisk);
    updateStatWithAnimation('mediumRisk', data.mediumRisk);
    updateStatWithAnimation('lowRisk', data.lowRisk);
}

// Update statistic with animation
function updateStatWithAnimation(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    const targetValue = value;
    const duration = 1000; // 1 second
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const current = Math.round(currentValue + (targetValue - currentValue) * progress);
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// Add trend indicator
function addTrendIndicator(elementId, isPositive) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const indicator = document.createElement('span');
    indicator.className = `trend ${isPositive ? 'positive' : 'negative'}`;
    indicator.innerHTML = `${isPositive ? '↑' : '↓'} ${Math.random() * 10}%`;
    
    element.appendChild(indicator);
}

// Analyze detection patterns
function analyzeDetectionPatterns(sites, historicalData) {
    // Implementation of analyzeDetectionPatterns function
}

// Update detection mode options
function updateDetectionMode(mode) {
    currentMode = mode;
    clearDetectionResults();
    
    const button = document.querySelector('.detection-button');
    button.innerHTML = '<i class="fas fa-search"></i> Start Detection';
    button.classList.remove('active');
    isDetectionActive = false;
    
    // Update button color based on mode
    button.style.backgroundColor = mode === 'water' ? 'var(--water-color)' : 'var(--primary-color)';
    
    // Update controls visibility
    const waterControls = document.querySelector('.water-specific-controls');
    if (waterControls) {
        waterControls.style.display = mode === 'water' ? 'block' : 'none';
    }
    
    // Stop any ongoing detection
    stopMonitoring();
}

// Add water reservoir detection function
function detectWaterReservoirs(area) {
    const sensitivity = document.querySelector('.sensitivity-slider').value;
    const minSize = document.querySelector('.min-size-input').value;
    const qualityCheck = document.querySelector('.water-quality-select').value;
    
    showLoadingOverlay('Analyzing water bodies...');
    
    // Simulate water detection process
    setTimeout(() => {
        const results = analyzeWaterBodies(area, sensitivity, minSize, qualityCheck);
        displayWaterResults(results);
        hideLoadingOverlay();
    }, 2000);
}

function analyzeWaterBodies(area, sensitivity, minSize, qualityCheck) {
    // Simulate water body analysis
    const results = {
        reservoirs: [
            {
                location: area.getBounds().getCenter(),
                size: Math.random() * 100 + 50,
                quality: Math.random() > 0.5 ? 'Good' : 'Moderate',
                depth: Math.random() * 30 + 10,
                volume: Math.random() * 1000000 + 500000
            }
        ],
        statistics: {
            totalVolume: 0,
            averageQuality: 'Good',
            count: 0
        }
    };
    
    // Calculate statistics
    results.statistics.count = results.reservoirs.length;
    results.statistics.totalVolume = results.reservoirs.reduce((sum, res) => sum + res.volume, 0);
    
    return results;
}

function displayWaterResults(results) {
    clearDetectionResults();
    
    // Add markers for each reservoir
    results.reservoirs.forEach(reservoir => {
        const marker = L.marker(reservoir.location, {
            icon: L.divIcon({
                className: 'water-marker',
                html: '<i class="fas fa-water"></i>'
            })
        });
        
        const popupContent = `
            <div class="reservoir-info">
                <h3>Water Reservoir</h3>
                <p>Size: ${reservoir.size.toFixed(2)} hectares</p>
                <p>Water Quality: ${reservoir.quality}</p>
                <p>Average Depth: ${reservoir.depth.toFixed(1)} meters</p>
                <p>Volume: ${(reservoir.volume / 1000000).toFixed(2)} million m³</p>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        marker.addTo(map);
        waterReservoirData.markers.push(marker);
    });
    
    // Update statistics display
    updateWaterStatistics(results.statistics);
}

function updateWaterStatistics(statistics) {
    const statsContainer = document.querySelector('.results-stats');
    statsContainer.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">Total Reservoirs</span>
            <span class="stat-value">${statistics.count}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Total Volume</span>
            <span class="stat-value">${(statistics.totalVolume / 1000000).toFixed(2)}M m³</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Water Quality</span>
            <span class="stat-value">${statistics.averageQuality}</span>
        </div>
    `;
}

// Add loading overlay functions
function showLoadingOverlay(message) {
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <i class="fas fa-spinner"></i>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Add event listener for mode selection
document.addEventListener('DOMContentLoaded', function() {
    // ... existing initialization code ...
    
    // Add mode selection handler
    const modeSelect = document.getElementById('detectionMode');
    if (modeSelect) {
        modeSelect.addEventListener('change', function() {
            updateDetectionMode(this.value);
        });
    }
});

// Add CSS styles for instructions
const style = document.createElement('style');
style.textContent = `
    .area-instructions {
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 1000;
        display: none;
        pointer-events: none;
    }
`;
document.head.appendChild(style);

// Add event listeners for chart controls
document.addEventListener('DOMContentLoaded', function() {
    // ... existing initialization code ...
    
    // Add time range handler
    const timeRangeSelect = document.getElementById('timeRange');
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener('change', function() {
            updateCharts(this.value, currentMode);
        });
    }
    
    // Add metric selection handler
    const metricSelect = document.getElementById('metricSelect');
    if (metricSelect) {
        metricSelect.addEventListener('change', function() {
            updateCharts(timeRangeSelect.value, this.value);
        });
    }
});

// Add carbon impact data generation function
function generateCarbonImpactData() {
    const totalEmissions = 50000; // Total CO₂ emissions in tons
    const highImpactPercentage = 0.4; // 40% high impact
    const mediumImpactPercentage = 0.35; // 35% medium impact
    
    return [
        Math.round(totalEmissions * highImpactPercentage), // High Impact
        Math.round(totalEmissions * mediumImpactPercentage), // Medium Impact
        totalEmissions - Math.round(totalEmissions * (highImpactPercentage + mediumImpactPercentage)) // Low Impact
    ];
}

// Add new data generation functions
function generateCarbonTrendData() {
    const data = [];
    let currentValue = 1000; // Starting value in tons CO₂
    const trend = -15; // Decreasing trend
    const volatility = 50; // Random variation

    for (let i = 0; i < 30; i++) {
        currentValue += trend;
        const randomFactor = 1 + (Math.random() - 0.5) * volatility;
        data.push(Math.max(0, currentValue * randomFactor));
    }

    return data;
}

function generateWaterTrendData() {
    const data = [];
    let currentValue = 30; // Starting water level in meters
    const trend = -0.2; // Slight decreasing trend
    const volatility = 0.5; // Random variation

    for (let i = 0; i < 30; i++) {
        currentValue += trend;
        const randomFactor = 1 + (Math.random() - 0.5) * volatility;
        data.push(Math.max(0, currentValue * randomFactor));
    }

    return data;
}

// Modal Handling
function initializeModals() {
    const features = document.querySelectorAll('.feature');
    const modals = document.querySelectorAll('.feature-modal');
    const closeButtons = document.querySelectorAll('.close-modal');

    // Add click event to features
    features.forEach(feature => {
        feature.addEventListener('click', () => {
            const featureType = feature.querySelector('h4').textContent.toLowerCase().replace(/\s+/g, '');
            const modalId = featureType.replace('monitoring', '') + 'Modal';
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'flex';
                // Add class to body to prevent scrolling
                document.body.style.overflow = 'hidden';
            }
        });
    });

    // Close modal when clicking close button
    closeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const modal = button.closest('.feature-modal');
            if (modal) {
                modal.style.display = 'none';
                // Restore scrolling
                document.body.style.overflow = '';
            }
        });
    });

    // Close modal when clicking outside
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                // Restore scrolling
                document.body.style.overflow = '';
            }
        });
    });

    // Prevent modal content clicks from closing the modal
    const modalContents = document.querySelectorAll('.modal-content');
    modalContents.forEach(content => {
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            modals.forEach(modal => {
                if (modal.style.display === 'flex') {
                    modal.style.display = 'none';
                    document.body.style.overflow = '';
                }
            });
        }
    });
}

// Call initializeModals when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeModals();
    // ... other initialization code ...
});

function initializeAreaSelection(map) {
    // Initialize the FeatureGroup to store editable layers
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Initialize draw control
    drawControl = new L.Control.Draw({
        draw: {
            polygon: {
                allowIntersection: false,
                drawError: {
                    color: '#e1e100',
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

async function analyzeSelectedArea(coordinates) {
    try {
        // Show loading overlay
        showLoadingOverlay('Analyzing selected area...');
        
        // Get detection settings
        const detectionMode = document.getElementById('detectionMode')?.value || 'deforestation';
        const timeRange = document.querySelector('.time-range-control select')?.value || 'Last Month';
        const sensitivity = document.querySelector('.sensitivity-slider')?.value || 0.7;
        
        // Prepare request data
        const requestData = {
            coordinates: coordinates,
            timeRange: timeRange,
            detectionMode: detectionMode,
            sensitivity: parseFloat(sensitivity)
        };

        console.log('Sending request with data:', requestData);
        
        // Send request to backend
        const response = await fetch('/api/analyze-area', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to analyze area: ${response.statusText}. ${errorText}`);
        }
        
        const results = await response.json();
        console.log('Received results:', results);
        
        // Update UI with results
        updateAnalysisResults(results);
        
        // Hide loading overlay
        hideLoadingOverlay();
        
        return results;
        
    } catch (error) {
        console.error('Error analyzing area:', error);
        // Show error message
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = 'Failed to analyze the selected area. Please try again.';
        document.body.appendChild(errorMessage);
        
        // Remove error message after 3 seconds
        setTimeout(() => {
            errorMessage.remove();
        }, 3000);
        
        // Hide loading overlay
        hideLoadingOverlay();
        return null;
    }
}

function updateAnalysisResults(results) {
    try {
        // Clear existing markers
        if (activeMarkers) {
            activeMarkers.forEach(({ marker, circle }) => {
                if (marker) marker.remove();
                if (circle) circle.remove();
            });
            activeMarkers.clear();
        }
        
        // Update statistics with animation
        updateStatWithAnimation('totalSites', results.totalSites);
        updateStatWithAnimation('highRisk', results.highRisk);
        updateStatWithAnimation('mediumRisk', results.mediumRisk);
        updateStatWithAnimation('lowRisk', results.lowRisk);
        
        // Add markers for detected areas
        if (results.detectedAreas && Array.isArray(results.detectedAreas)) {
            results.detectedAreas.forEach(area => {
                const coords = area.coordinates || [area.lat, area.lng];
                
                // Create marker
                const marker = L.marker(coords, {
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
                const circle = L.circle(coords, {
                    radius: (area.size || area.area) * 100,
                    color: area.riskLevel === 'high' ? '#e74c3c' : 
                           area.riskLevel === 'medium' ? '#f39c12' : '#2ecc71',
                    fillColor: area.riskLevel === 'high' ? '#e74c3c' : 
                              area.riskLevel === 'medium' ? '#f39c12' : '#2ecc71',
                    fillOpacity: 0.2
                });
                
                // Create popup
                const popup = L.popup().setContent(`
                    <div class="popup-content">
                        <h3>${area.type || 'Deforestation'} Detection</h3>
                        <div class="popup-details">
                            <p><strong>Risk Level:</strong> <span class="${area.riskLevel}-risk">${area.riskLevel}</span></p>
                            <p><strong>Confidence:</strong> ${Math.round(area.confidence)}%</p>
                            <p><strong>Area:</strong> ${(area.size || area.area).toFixed(2)} km²</p>
                            ${area.vegetationDensity ? `<p><strong>Vegetation Density:</strong> ${area.vegetationDensity}%</p>` : ''}
                            ${area.waterQuality ? `<p><strong>Water Quality:</strong> ${area.waterQuality}</p>` : ''}
                        </div>
                    </div>
                `);
                
                // Bind popup to both marker and circle
                marker.bindPopup(popup);
                circle.bindPopup(popup);
                
                // Add to map
                marker.addTo(map);
                circle.addTo(map);
                
                // Store references
                activeMarkers.set(coords.toString(), { marker, circle });
            });
        }
        
        // Update charts if they exist
        if (typeof updateCharts === 'function') {
            const timeRange = document.getElementById('timeRange')?.value || 24;
            updateCharts(timeRange, currentMode);
        }
    } catch (error) {
        console.error('Error updating analysis results:', error);
        showError('Failed to update results. Please try again.');
    }
}

function showLoading(message) {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="loading-content">
            <div class="spinner"></div>
            <p>${message || 'Loading...'}</p>
        </div>
    `;
    document.body.appendChild(loadingOverlay);
}

function hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Image Analysis Functions
function initializeImageAnalysis() {
    const uploadBox = document.getElementById('uploadBox');
    const imageInput = document.getElementById('imageInput');
    const analysisSpinner = document.getElementById('analysisSpinner');
    
    // Handle drag and drop
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = '#2ecc71';
    });
    
    uploadBox.addEventListener('dragleave', () => {
        uploadBox.style.borderColor = '';
    });
    
    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = '';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageUpload(file);
        }
    });
    
    // Handle click to upload
    uploadBox.addEventListener('click', () => {
        imageInput.click();
    });
    
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImageUpload(file);
        }
    });
}

async function handleImageUpload(file) {
    try {
        showLoading('Analyzing image...');
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('http://localhost:5000/api/detect-deforestation', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to analyze image');
        }
        
        const data = await response.json();
        
        // Display results
        displayMLResults(data);
        
    } catch (error) {
        console.error('Error analyzing image:', error);
        showError('Failed to analyze image. Please try again.');
    } finally {
        hideLoading();
    }
}

function displayMLResults(data) {
    const resultsContainer = document.getElementById('ml-results');
    if (!resultsContainer) return;
    
    // Create results HTML
    const resultsHTML = `
        <div class="ml-results">
            <h3>Deforestation Analysis Results</h3>
            <div class="result-grid">
                <div class="result-item">
                    <h4>Deforestation Percentage</h4>
                    <div class="percentage">${data.deforestation_percentage.toFixed(2)}%</div>
                </div>
                <div class="result-item">
                    <h4>Detection Mask</h4>
                    <img src="data:image/png;base64,${data.mask_base64}" alt="Deforestation Mask" class="mask-image">
                </div>
            </div>
            <div class="risk-assessment">
                <h4>Risk Assessment</h4>
                <div class="risk-level ${getRiskLevel(data.deforestation_percentage)}">
                    ${getRiskDescription(data.deforestation_percentage)}
                </div>
            </div>
        </div>
    `;
    
    resultsContainer.innerHTML = resultsHTML;
}

function getRiskLevel(percentage) {
    if (percentage < 10) return 'low-risk';
    if (percentage < 30) return 'medium-risk';
    return 'high-risk';
}

function getRiskDescription(percentage) {
    if (percentage < 10) return 'Low Risk: Minimal deforestation detected';
    if (percentage < 30) return 'Medium Risk: Moderate deforestation detected';
    return 'High Risk: Significant deforestation detected';
}

// Add event listener for file input
document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('image-upload');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                handleImageUpload(file);
            }
        });
    }
});

// Initialize image analysis when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    initializeImageAnalysis();
}); 