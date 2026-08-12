(function(PM) {
    // Function to create a thumbnail from an image
    PM.createThumbnail = function(src, maxSize = PM.settings.thumbnailSize) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calculate thumbnail dimensions while maintaining aspect ratio
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height) {
                        if (width > maxSize) {
                            height = Math.round(height * maxSize / width);
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width = Math.round(width * maxSize / height);
                            height = maxSize;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Draw the image on the canvas
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Get the data URL from the canvas
                    const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(thumbnailDataUrl);
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = function() {
                reject(new Error('Failed to load image'));
            };
            img.src = src;
        });
    };

    // Convert GPS coordinates from degrees, minutes, seconds to decimal degrees
    PM.convertDMSToDD = function(dms, ref) {
        const degrees = dms[0];
        const minutes = dms[1];
        const seconds = dms[2];
        
        let dd = degrees + minutes/60 + seconds/3600;
        
        if (ref === 'S' || ref === 'W') {
            dd = -dd;
        }
        
        return dd;
    };

    // Add a photo to the map
    PM.addPhotoToMap = function(src, filename, lat, lng, folderPath = '') {
        // Create photo data object for saving
        const photo = {
            src: src,
            filename: filename,
            lat: lat,
            lng: lng,
            folderPath: folderPath
        };
        
        // Add to photo data array
        PM.photoData.push(photo);
        
        // Create sidebar item
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        
        const thumbnail = document.createElement('img');
        thumbnail.src = src;
        thumbnail.className = 'thumbnail';
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'photo-info';
        
        const photoName = document.createElement('p');
        photoName.textContent = filename;
        
        const coords = document.createElement('small');
        coords.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        
        infoDiv.appendChild(photoName);
        infoDiv.appendChild(coords);
        
        // Add folder path if available
        if (folderPath) {
            const pathElement = document.createElement('div');
            pathElement.className = 'folder-path';
            pathElement.textContent = folderPath;
            infoDiv.appendChild(pathElement);
        }
        
        photoItem.appendChild(thumbnail);
        photoItem.appendChild(infoDiv);
        PM.elements.photoList.appendChild(photoItem);
        
        // Create custom icon with the image thumbnail
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<img src="${src}" style="width:40px;height:40px;border-radius:50%;border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.5);object-fit:cover;" />`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        
        // Add marker to map
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(PM.map);
        PM.markers.push(marker);
        
        // Add popup with larger image
        marker.bindPopup(`
            <div class="custom-pin">
                <img src="${src}" />
                <div style="padding:10px">
                    <strong>${filename}</strong><br>
                    <small>${lat.toFixed(6)}, ${lng.toFixed(6)}</small>
                    ${folderPath ? `<div class="folder-path">${folderPath}</div>` : ''}
                </div>
            </div>
        `, { maxWidth: 300 });
        
        // Link sidebar item to map marker
        photoItem.addEventListener('click', () => {
            PM.map.setView([lat, lng], 16);
            marker.openPopup();
        });
        
        // Add hover effect between marker and sidebar
        photoItem.addEventListener('mouseenter', () => {
            marker.setZIndexOffset(1000); // Bring to front
            if (marker._icon) {
                marker._icon.style.transform = marker._icon.style.transform.replace('translate3d', 'scale(1.2) translate3d');
            }
        });
        
        photoItem.addEventListener('mouseleave', () => {
            marker.setZIndexOffset(0);
            if (marker._icon) {
                marker._icon.style.transform = marker._icon.style.transform.replace('scale(1.2) translate3d', 'translate3d');
            }
        });
    };

    // Add a saved photo to the map
    PM.addSavedPhotoToMap = function(photo) {
        // Add to photo data array
        PM.photoData.push(photo);
        
        // Create sidebar item
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        
        const thumbnail = document.createElement('img');
        thumbnail.src = photo.src;
        thumbnail.className = 'thumbnail';
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'photo-info';
        
        const photoName = document.createElement('p');
        photoName.textContent = photo.filename;
        
        const coords = document.createElement('small');
        coords.textContent = `${photo.lat.toFixed(6)}, ${photo.lng.toFixed(6)}`;
        
        infoDiv.appendChild(photoName);
        infoDiv.appendChild(coords);
        
        // Add folder path if available
        if (photo.folderPath) {
            const pathElement = document.createElement('div');
            pathElement.className = 'folder-path';
            pathElement.textContent = photo.folderPath;
            infoDiv.appendChild(pathElement);
        }
        
        photoItem.appendChild(thumbnail);
        photoItem.appendChild(infoDiv);
        PM.elements.photoList.appendChild(photoItem);
        
        // Create custom icon with the image thumbnail
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<img src="${photo.src}" style="width:40px;height:40px;border-radius:50%;border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.5);object-fit:cover;" />`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        
        // Add marker to map
        const marker = L.marker([photo.lat, photo.lng], { icon: customIcon }).addTo(PM.map);
        PM.markers.push(marker);
        
        // Add popup with image
        marker.bindPopup(`
            <div class="custom-pin">
                <img src="${photo.src}" />
                <div style="padding:10px">
                    <strong>${photo.filename}</strong><br>
                    <small>${photo.lat.toFixed(6)}, ${photo.lng.toFixed(6)}</small>
                    ${photo.folderPath ? `<div class="folder-path">${photo.folderPath}</div>` : ''}
                </div>
            </div>
        `, { maxWidth: 300 });
        
        // Link sidebar item to map marker
        photoItem.addEventListener('click', () => {
            PM.map.setView([photo.lat, photo.lng], 16);
            marker.openPopup();
        });
        
        // Add hover effect between marker and sidebar
        photoItem.addEventListener('mouseenter', () => {
            marker.setZIndexOffset(1000); // Bring to front
            if (marker._icon) {
                marker._icon.style.transform = marker._icon.style.transform.replace('translate3d', 'scale(1.2) translate3d');
            }
        });
        
        photoItem.addEventListener('mouseleave', () => {
            marker.setZIndexOffset(0);
            if (marker._icon) {
                marker._icon.style.transform = marker._icon.style.transform.replace('scale(1.2) translate3d', 'translate3d');
            }
        });
        
        return marker;
    };

    // Clear all data
    PM.clearAllData = function() {
        // Clear markers from map
        PM.markers.forEach(marker => PM.map.removeLayer(marker));
        PM.markers.length = 0;
        
        // Clear photo data array
        PM.photoData.length = 0;
        
        // Clear photo list
        PM.elements.photoList.innerHTML = '';
        
        // Clear messages
        PM.elements.errorMessage.textContent = '';
        PM.elements.successMessage.textContent = '';
        PM.elements.progressContainer.style.display = 'none';
        
        // Reset view
        PM.map.setView([51.505, -0.09], 3);
    };
})(window.PhotoMap);