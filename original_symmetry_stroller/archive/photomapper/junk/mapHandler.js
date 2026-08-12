/**
 * MapHandler class to manage the map display and markers
 */
export class MapHandler {
    constructor(mapElementId) {
        this.map = L.map(mapElementId).setView([0, 0], 2);
        this.markers = [];
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
        
        // Initialize empty marker layer group
        this.markerLayer = L.layerGroup().addTo(this.map);
    }
    
    /**
     * Add a photo marker to the map
     * @param {Object} photo Photo object with lat, lng, thumbnail properties
     */
    addPhotoMarker(photo) {
        // Create custom icon with photo thumbnail
        const icon = L.divIcon({
            html: `<img src="${photo.thumbnail}" class="photo-thumbnail" alt="Photo thumbnail">`,
            className: '',
            iconSize: [50, 50],
            iconAnchor: [25, 25]
        });
        
        // Create marker with custom icon
        const marker = L.marker([photo.lat, photo.lng], { icon }).addTo(this.markerLayer);
        
        // Add popup with larger photo thumbnail
        marker.bindPopup(`
            <div class="custom-pin-popup">
                <img src="${photo.thumbnail}" alt="Photo">
                <p>${photo.name || 'Photo'}</p>
                ${photo.date ? `<p>Date: ${photo.date}</p>` : ''}
            </div>
        `);
        
        // Store marker and photo data for later retrieval
        this.markers.push({
            marker,
            photo
        });
        
        // If this is the first photo, center map on it
        if (this.markers.length === 1) {
            this.map.setView([photo.lat, photo.lng], 13);
        }
    }
    
    /**
     * Clear all markers from the map
     */
    clearMap() {
        this.markerLayer.clearLayers();
        this.markers = [];
    }
    
    /**
     * Get current map data for saving
     * @returns {Array} Array of photo data objects
     */
    getMapData() {
        return this.markers.map(item => item.photo);
    }
    
    /**
     * Load map data from saved state
     * @param {Array} mapData Array of photo data objects
     */
    loadMapData(mapData) {
        mapData.forEach(photo => {
            this.addPhotoMarker(photo);
        });
        
        // Fit map to bounds of all markers
        if (this.markers.length > 0) {
            const latLngs = this.markers.map(item => [item.photo.lat, item.photo.lng]);
            this.map.fitBounds(L.latLngBounds(latLngs));
        }
    }
}