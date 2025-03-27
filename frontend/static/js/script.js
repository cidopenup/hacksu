// Initialize map
let map;
let selectedArea = null;
let chart = null;

// Initialize the map when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize map
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Initialize views
    const views = document.querySelectorAll('.view');
    const buttons = document.querySelectorAll('nav button');

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const targetView = button.id;
            
            // Update active button
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show target view
            views.forEach(view => {
                view.classList.remove('active');
                if (view.id === targetView) {
                    view.classList.add('active');
                }
            });
        });
    });

    // Initialize file upload
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const preview = document.getElementById('preview');
    const previewImage = document.getElementById('previewImage');
    const analyzeButton = document.getElementById('analyzeImage');
    const results = document.getElementById('results');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // Handle drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleFile(file);
        }
    });

    // Handle click to upload
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    });

    // Handle file upload
    function handleFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            preview.style.display = 'block';
            results.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    // Handle image analysis
    analyzeButton.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) return;

        loadingOverlay.style.display = 'flex';
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/detect-deforestation', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Analysis failed');
            }

            const data = await response.json();
            displayResults(data);
            results.style.display = 'block';
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to analyze image. Please try again.');
        } finally {
            loadingOverlay.style.display = 'none';
        }
    });

    // Display analysis results
    function displayResults(data) {
        document.getElementById('deforestationPercentage').textContent = 
            `${data.deforestation_percentage.toFixed(1)}%`;
        document.getElementById('confidenceLevel').textContent = 
            `${(data.confidence * 100).toFixed(1)}%`;
        document.getElementById('maskImage').src = 
            `data:image/png;base64,${data.mask}`;
        
        const riskLevel = document.getElementById('riskLevel');
        riskLevel.textContent = getRiskLevel(data.deforestation_percentage);
        riskLevel.className = `risk-level ${getRiskClass(data.deforestation_percentage)}`;
    }

    // Helper functions
    function getRiskLevel(percentage) {
        if (percentage < 20) return 'Low';
        if (percentage < 50) return 'Medium';
        return 'High';
    }

    function getRiskClass(percentage) {
        if (percentage < 20) return 'low-risk';
        if (percentage < 50) return 'medium-risk';
        return 'high-risk';
    }

    // Initialize area selection
    const analyzeAreaButton = document.getElementById('analyzeArea');
    analyzeAreaButton.addEventListener('click', async () => {
        if (!selectedArea) {
            alert('Please select an area on the map first');
            return;
        }

        loadingOverlay.style.display = 'flex';
        try {
            const response = await fetch('/api/analyze-area', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    coordinates: selectedArea.getLatLngs()[0].map(latLng => [latLng.lat, latLng.lng])
                })
            });

            if (!response.ok) {
                throw new Error('Analysis failed');
            }

            const data = await response.json();
            updateAnalysisView(data);
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to analyze area. Please try again.');
        } finally {
            loadingOverlay.style.display = 'none';
        }
    });

    // Update analysis view with results
    function updateAnalysisView(data) {
        // Update risk stats
        const riskStats = document.getElementById('riskStats');
        riskStats.innerHTML = `
            <div class="risk-item ${data.risk_level.toLowerCase()}">
                <h4>Risk Level</h4>
                <p>${data.risk_level}</p>
            </div>
            <div class="risk-item">
                <h4>Detection Type</h4>
                <p>${data.detection_type}</p>
            </div>
        `;

        // Update detection stats
        const detectionStats = document.getElementById('detectionStats');
        detectionStats.innerHTML = `
            <div class="stat-item">
                <h4>Deforestation</h4>
                <p>${data.deforestation_percentage.toFixed(1)}%</p>
            </div>
            <div class="stat-item">
                <h4>Confidence</h4>
                <p>${(data.confidence * 100).toFixed(1)}%</p>
            </div>
        `;

        // Update chart
        if (chart) {
            chart.destroy();
        }

        const ctx = document.getElementById('deforestationChart').getContext('2d');
        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Deforestation', 'Forest Cover'],
                datasets: [{
                    data: [data.deforestation_percentage, 100 - data.deforestation_percentage],
                    backgroundColor: ['#ff4444', '#00C851']
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }
}); 