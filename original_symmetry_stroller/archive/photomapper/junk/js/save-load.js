(function(PM) {
    // Save current state
    PM.saveState = async function() {
        if (PM.photoData.length === 0) {
            PM.elements.statusElement.textContent = 'No photos to save.';
            return;
        }
        
        try {
            PM.elements.statusElement.textContent = 'Creating thumbnails and preparing save file...';
            
            // Show progress
            PM.elements.progressContainer.style.display = 'block';
            PM.elements.progressFill.style.width = '0%';
            PM.elements.progressText.textContent = 'Creating thumbnails...';
            
            // Create thumbnails version of the photo data
            const thumbnailPhotoData = [];
            for (let i = 0; i < PM.photoData.length; i++) {
                const photo = PM.photoData[i];
                
                // Update progress
                PM.elements.progressFill.style.width = `${(i / PM.photoData.length * 100)}%`;
                PM.elements.progressText.textContent = `Processing thumbnail ${i + 1} of ${PM.photoData.length}...`;
                
                // Create thumbnail from the original image
                const thumbnailSrc = await PM.createThumbnail(photo.src, PM.settings.thumbnailSize);
                
                thumbnailPhotoData.push({
                    thumbnailSrc: thumbnailSrc,
                    filename: photo.filename,
                    lat: photo.lat,
                    lng: photo.lng,
                    folderPath: photo.folderPath
                });
            }
            
            // Update progress
            PM.elements.progressFill.style.width = '90%';
            PM.elements.progressText.textContent = 'Creating save file...';
            
            // Create save data object
            const saveData = {
                photos: thumbnailPhotoData,
                mapCenter: PM.map.getCenter(),
                mapZoom: PM.map.getZoom(),
                version: PM.settings.saveVersion,
                savedAt: new Date().toISOString()
            };
            
            // Convert to JSON
            const saveJson = JSON.stringify(saveData);
            
            // Calculate size in KB
            const saveSize = Math.round(saveJson.length / 1024);
            
            // Create blob and download link
            const blob = new Blob([saveJson], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'photo-map-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Complete progress
            PM.elements.progressFill.style.width = '100%';
            setTimeout(() => {
                PM.elements.progressContainer.style.display = 'none';
            }, 1000);
            
            PM.elements.successMessage.textContent = `Saved ${PM.photoData.length} photos to file (${saveSize} KB).`;
            PM.elements.statusElement.textContent = 'Current state saved successfully with thumbnails only.';
        } catch (error) {
            console.error('Error saving state:', error);
            PM.elements.errorMessage.textContent = 'Failed to save state. See console for details.';
            PM.elements.progressContainer.style.display = 'none';
        }
    };

    // Load saved state
    PM.loadState = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Show progress
        PM.elements.progressContainer.style.display = 'block';
        PM.elements.progressFill.style.width = '10%';
        PM.elements.progressText.textContent = 'Reading save file...';
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                // Update progress
                PM.elements.progressFill.style.width = '30%';
                PM.elements.progressText.textContent = 'Parsing save data...';
                
                const saveData = JSON.parse(e.target.result);
                
                // Check if the save file is valid
                if (!saveData.photos || !Array.isArray(saveData.photos)) {
                    throw new Error('Invalid save file format');
                }
                
                // Update progress
                PM.elements.progressFill.style.width = '50%';
                PM.elements.progressText.textContent = 'Clearing current data...';
                
                // Clear current state
                PM.clearAllData();
                
                // Restore map position if available
                if (saveData.mapCenter && saveData.mapZoom) {
                    PM.map.setView([saveData.mapCenter.lat, saveData.mapCenter.lng], saveData.mapZoom);
                }
                
                // Load photos
                const photos = saveData.photos;
                
                // Update progress
                PM.elements.progressFill.style.width = '60%';
                PM.elements.progressText.textContent = `Loading ${photos.length} photos...`;
                
                // Add photos to map
                let loadedCount = 0;
                photos.forEach((photo, index) => {
                    const src = photo.thumbnailSrc || photo.src; // Support both new and old format
                    PM.addSavedPhotoToMap({
                        src: src,
                        filename: photo.filename,
                        lat: photo.lat,
                        lng: photo.lng,
                        folderPath: photo.folderPath || ''
                    });
                    loadedCount++;
                    
                    // Update progress
                    const loadProgress = 60 + (index / photos.length * 40);
                    PM.elements.progressFill.style.width = `${loadProgress}%`;
                    PM.elements.progressText.textContent = `Loaded ${loadedCount} of ${photos.length}...`;
                });
                
                // Complete progress
                PM.elements.progressFill.style.width = '100%';
                setTimeout(() => {
                    PM.elements.progressContainer.style.display = 'none';
                }, 1000);
                
                const fileSize = Math.round(e.target.result.length / 1024);
                PM.elements.successMessage.textContent = `Loaded ${loadedCount} photos from save file (${fileSize} KB).`;
                PM.elements.statusElement.textContent = 'Save file loaded successfully.';
                
                // Fit all photos on screen if we have any
                if (PM.markers.length > 0) {
                    const group = L.featureGroup(PM.markers);
                    PM.map.fitBounds(group.getBounds(), { padding: [50, 50] });
                }
            } catch (error) {
                console.error('Error loading state:', error);
                PM.elements.errorMessage.textContent = 'Failed to load state. The file might be corrupted.';
                PM.elements.progressContainer.style.display = 'none';
            }
        };
        
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    };
})(window.PhotoMap);