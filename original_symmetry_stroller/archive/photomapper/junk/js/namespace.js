// Create global namespace
window.PhotoMap = {
    // Map and data
    map: null,
    markers: [],
    photoData: [],
    
    // DOM elements
    elements: {
        photoList: null,
        fileInput: null,
        loadInput: null,
        dropzone: null,
        errorMessage: null,
        successMessage: null,
        fitAllButton: null,
        clearAllButton: null,
        saveStateButton: null,
        loadStateButton: null,
        statusElement: null,
        progressContainer: null,
        progressFill: null,
        progressText: null
    },
    
    // Settings
    settings: {
        thumbnailSize: 100,
        saveVersion: '1.0'
    }
};