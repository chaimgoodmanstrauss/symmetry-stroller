(function(PM) {
    // Wait for full DOM content to be loaded
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize references to DOM elements
        PM.elements.photoList = document.getElementById('photo-list');
        PM.elements.fileInput = document.getElementById('file-input');
        PM.elements.loadInput = document.getElementById('load-input');
        PM.elements.dropzone = document.getElementById('dropzone');
        PM.elements.errorMessage = document.getElementById('error-message');
        PM.elements.successMessage = document.getElementById('success-message');
        PM.elements.fitAllButton = document.getElementById('fit-all');
        PM.elements.clearAllButton = document.getElementById('clear-all');
        PM.elements.saveStateButton = document.getElementById('save-state');
        PM.elements.loadStateButton = document.getElementById('load-state');
        PM.elements.statusElement = document.getElementById('status');
        PM.elements.progressContainer = document.getElementById('progress-container');
        PM.elements.progressFill = document.getElementById('progress-fill');
        PM.elements.progressText = document.getElementById('progress-text');
        
        PM.elements.statusElement.textContent = 'Initializing map...';
        
        // Delay map initialization slightly to ensure container is ready
        setTimeout(() => {
            try {
                PM.map = L.map('map').setView([51.505, -0.09], 3);
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 19
                }).addTo(PM.map);
                
                // Force a resize after map is initialized
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                    PM.elements.statusElement.textContent = 'Map loaded successfully. Ready for photos.';
                }, 500);
                
                initEventListeners();
            } catch (error) {
                console.error('Error initializing map:', error);
                PM.elements.statusElement.textContent = 'Error loading map. Please check console for details.';
            }
        }, 100);
    });
    
    function initEventListeners() {
        // Add event listeners for file selection
        PM.elements.fileInput.addEventListener('change', handleFilesAndFolders);
        
        // Drag and drop functionality with folder support
        PM.elements.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            PM.elements.dropzone.style.borderColor = '#66afe9';
            PM.elements.dropzone.style.backgroundColor = '#f0f7ff';
        });
        
        PM.elements.dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            PM.elements.dropzone.style.borderColor = '#ccc';
            PM.elements.dropzone.style.backgroundColor = '';
        });
        
        PM.elements.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            PM.elements.dropzone.style.borderColor = '#ccc';
            PM.elements.dropzone.style.backgroundColor = '';
            
            // Handle dropped folders and files
            const items = e.dataTransfer.items;
            if (items && items.length > 0) {
                handleDroppedItems(items);
            } else {
                // Fallback to simpler file handling if DataTransferItemList is not supported
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    handleFilesAndFolders({ target: { files } });
                }
            }
        });
        
        PM.elements.dropzone.addEventListener('click', () => {
            PM.elements.fileInput.click();
        });
        
        // Fit all markers on screen
        PM.elements.fitAllButton.addEventListener('click', () => {
            if (PM.markers.length > 0) {
                const group = L.featureGroup(PM.markers);
                PM.map.fitBounds(group.getBounds(), { padding: [50, 50] });
                PM.elements.statusElement.textContent = 'Showing all photos on map.';
            } else {
                PM.elements.statusElement.textContent = 'No photos with geolocation data available.';
            }
        });
        
        // Clear all photos
        PM.elements.clearAllButton.addEventListener('click', () => {
            PM.clearAllData();
            PM.elements.statusElement.textContent = 'All photos cleared. Ready for new uploads.';
        });
        
        // Save current state
        PM.elements.saveStateButton.addEventListener('click', PM.saveState);
        
        // Load saved state
        PM.elements.loadStateButton.addEventListener('click', () => {
            PM.elements.loadInput.click();
        });
        
        PM.elements.loadInput.addEventListener('change', PM.loadState);
    }
    
    // Handler for dropped items (files and directories)
    async function handleDroppedItems(items) {
        PM.elements.errorMessage.textContent = '';
        PM.elements.successMessage.textContent = '';
        
        const allFiles = [];
        
        // Show progress indicator
        PM.elements.progressContainer.style.display = 'block';
        PM.elements.progressFill.style.width = '0%';
        PM.elements.progressText.textContent = 'Scanning folders...';
        
        // Function to recursively process entries
        async function processEntry(entry, path = '') {
            if (entry.isFile) {
                // Check if it's an image file by extension
                const name = entry.name.toLowerCase();
                if (name.endsWith('.jpg') || name.endsWith('.jpeg') || 
                    name.endsWith('.png') || name.endsWith('.gif') || 
                    name.endsWith('.bmp') || name.endsWith('.webp') || 
                    name.endsWith('.heic')) {
                    
                    // Get file object
                    return new Promise((resolve) => {
                        entry.file((file) => {
                            // Add path information to the file
                            file.relativePath = path + entry.name;
                            allFiles.push(file);
                            resolve();
                        }, () => resolve()); // Resolve even on error
                    });
                }
                return Promise.resolve();
            } else if (entry.isDirectory) {
                // Get directory reader
                const reader = entry.createReader();
                
                // Read all entries in directory
                const entries = await new Promise((resolve) => {
                    const allEntries = [];
                    
                    function readEntries() {
                        reader.readEntries((entries) => {
                            if (entries.length === 0) {
                                resolve(allEntries);
                            } else {
                                allEntries.push(...entries);
                                readEntries();
                            }
                        }, () => resolve(allEntries));
                    }
                    
                    readEntries();
                });
                
                // Process each entry recursively
                for (const childEntry of entries) {
                    await processEntry(childEntry, path + entry.name + '/');
                }
            }
        }
        
        // Process all dropped items
        const itemsArray = Array.from(items);
        for (let i = 0; i < itemsArray.length; i++) {
            const entry = itemsArray[i].webkitGetAsEntry();
            if (entry) {
                await processEntry(entry);
            }
        }
        
        // Update progress
        PM.elements.progressText.textContent = `Found ${allFiles.length} images...`;
        PM.elements.progressFill.style.width = '30%';
        
        // Process files
        if (allFiles.length > 0) {
            PM.elements.statusElement.textContent = `Processing ${allFiles.length} photos from folders...`;
            processFiles(allFiles);
        } else {
            PM.elements.progressContainer.style.display = 'none';
            PM.elements.errorMessage.textContent = 'No image files found in the folders.';
            PM.elements.statusElement.textContent = 'No images found to process.';
        }
    }
    
    function handleFilesAndFolders(event) {
        const files = event.target.files;
        PM.elements.errorMessage.textContent = '';
        PM.elements.successMessage.textContent = '';
        
        if (files.length === 0) return;
        
        // Filter image files
        const imageFiles = Array.from(files).filter(file => 
            file.type.startsWith('image/') || 
            file.name.toLowerCase().endsWith('.jpg') || 
            file.name.toLowerCase().endsWith('.jpeg') || 
            file.name.toLowerCase().endsWith('.png') || 
            file.name.toLowerCase().endsWith('.gif') || 
            file.name.toLowerCase().endsWith('.webp')
        );
        
        if (imageFiles.length === 0) {
            PM.elements.errorMessage.textContent = 'No image files found in the selection.';
            return;
        }
        
        // Show progress indicator
        PM.elements.progressContainer.style.display = 'block';
        PM.elements.progressFill.style.width = '10%';
        PM.elements.progressText.textContent = `Found ${imageFiles.length} images...`;
        
        PM.elements.statusElement.textContent = `Processing ${imageFiles.length} photos...`;
        
        // Process image files
        processFiles(imageFiles);
        
        // Reset file input
        event.target.value = '';
    }
    
    function processFiles(files) {
        let successCount = 0;
        let errorCount = 0;
        let processedCount = 0;
        
        // Process each file
        files.forEach((file, index) => {
            // Update progress for file reading
            const fileProgress = 30 + (index / files.length * 30);
            PM.elements.progressFill.style.width = `${fileProgress}%`;
            PM.elements.progressText.textContent = `Reading file ${index + 1} of ${files.length}...`;
            
            if (!file.type.startsWith('image/') && 
                !file.name.toLowerCase().endsWith('.jpg') && 
                !file.name.toLowerCase().endsWith('.jpeg') && 
                !file.name.toLowerCase().endsWith('.png') && 
                !file.name.toLowerCase().endsWith('.gif') && 
                !file.name.toLowerCase().endsWith('.webp')) {
                errorCount++;
                processedCount++;
                updateProgress();
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                
                img.onload = () => {
                    // Read EXIF data to get geolocation
                    EXIF.getData(img, function() {
                        let lat = null;
                        let lng = null;
                        
                        if (EXIF.getTag(this, 'GPSLatitude') && EXIF.getTag(this, 'GPSLongitude')) {
                            lat = PM.convertDMSToDD(EXIF.getTag(this, 'GPSLatitude'), EXIF.getTag(this, 'GPSLatitudeRef'));
                            lng = PM.convertDMSToDD(EXIF.getTag(this, 'GPSLongitude'), EXIF.getTag(this, 'GPSLongitudeRef'));
                        }
                        
                        if (lat && lng) {
                            // Get the folder path if available
                            const relativePath = file.relativePath || file.webkitRelativePath || '';
                            const folderPath = relativePath.split('/').slice(0, -1).join('/');
                            
                            PM.addPhotoToMap(img.src, file.name, lat, lng, folderPath);
                            successCount++;
                        } else {
                            errorCount++;
                            console.log(`No geolocation data found in ${file.name}`);
                        }
                        
                        processedCount++;
                        
                        // Update progress for EXIF processing
                        const exifProgress = 60 + (processedCount / files.length * 40);
                        PM.elements.progressFill.style.width = `${exifProgress}%`;
                        PM.elements.progressText.textContent = `Processed ${processedCount} of ${files.length}...`;
                        
                        updateProgress();
                    });
                };
            };
            
            reader.readAsDataURL(file);
        });
        
        function updateProgress() {
            if (processedCount === files.length) {
                // Complete the progress bar
                PM.elements.progressFill.style.width = '100%';
                setTimeout(() => {
                    PM.elements.progressContainer.style.display = 'none';
                }, 1000);
                
                if (errorCount > 0 && successCount > 0) {
                    PM.elements.statusElement.textContent = `Processed ${successCount} photos successfully. ${errorCount} photos had no geolocation data.`;
                    PM.elements.errorMessage.textContent = `${errorCount} photos had no geolocation data.`;
                    
                    // Fit all markers on screen
                    const group = L.featureGroup(PM.markers);
                    PM.map.fitBounds(group.getBounds(), { padding: [50, 50] });
                } else if (errorCount > 0 && successCount === 0) {
                    PM.elements.statusElement.textContent = 'No photos with geolocation data were found.';
                    PM.elements.errorMessage.textContent = `None of the ${errorCount} photos contained geolocation data.`;
                } else if (successCount > 0) {
                    PM.elements.statusElement.textContent = `Successfully added ${successCount} photos to the map.`;
                    PM.elements.successMessage.textContent = `Added ${successCount} photos to the map.`;
                    
                    // Fit all markers on screen
                    const group = L.featureGroup(PM.markers);
                    PM.map.fitBounds(group.getBounds(), { padding: [50, 50] });
                }
            }
        }
    }
})(window.PhotoMap);