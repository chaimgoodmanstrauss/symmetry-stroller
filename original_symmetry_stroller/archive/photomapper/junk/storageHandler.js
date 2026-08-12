/**
 * StorageHandler class to manage saving and loading map data
 */
export class StorageHandler {
    constructor() {
        this.storageKey = 'photoMapData';
    }
    
    /**
     * Save map data to local storage
     * @param {Array} mapData Array of photo data objects
     */
    saveMapData(mapData) {
        try {
            const serializedData = JSON.stringify(mapData);
            localStorage.setItem(this.storageKey, serializedData);
            return true;
        } catch (error) {
            console.error('Error saving map data:', error);
            return false;
        }
    }
    
    /**
     * Load map data from local storage
     * @returns {Array|null} Array of photo data objects or null if not found
     */
    loadMapData() {
        try {
            const serializedData = localStorage.getItem(this.storageKey);
            if (!serializedData) return null;
            
            return JSON.parse(serializedData);
        } catch (error) {
            console.error('Error loading map data:', error);
            return null;
        }
    }
    
    /**
     * Export map data to a file for download
     * @param {Array} mapData Array of photo data objects
     */
    exportMapData(mapData) {
        try {
            const serializedData = JSON.stringify(mapData, null, 2);
            const blob = new Blob([serializedData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'photo-map-data.json';
            a.click();
            
            URL.revokeObjectURL(url);
            return true;
        } catch (error) {
            console.error('Error exporting map data:', error);
            return false;
        }
    }
    
    /**
     * Import map data from a file
     * @param {File} file JSON file containing map data
     * @returns {Promise<Array>} Promise resolving to array of photo data objects
     */
    importMapData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const mapData = JSON.parse(event.target.result);
                    resolve(mapData);
                } catch (error) {
                    reject(new Error('Invalid map data file'));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Error reading file'));
            };
            
            reader.readAsText(file);
        });
    }
}