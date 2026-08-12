/**
 * FileHandler class to process photo files and extract metadata
 */
export class FileHandler {
    constructor() {
        // Maximum dimension for thumbnails
        this.thumbnailSize = 200;
    }
    
    /**
     * Process multiple files and extract photo data
     * @param {FileList} files List of files from input element
     * @returns {Promise<Array>} Promise resolving to array of photo data objects
     */
    async processFiles(files) {
        const photoPromises = Array.from(files).map(file => this.processFile(file));
        return Promise.all(photoPromises);
    }
    
    /**
     * Process a single file and extract photo data
     * @param {File} file File object from input element
     * @returns {Promise<Object>} Promise resolving to photo data object
     */
    async processFile(file) {
        try {
            // Extract location data from EXIF
            const exifData = await this.extractExifData(file);
            
            // Create thumbnail
            const thumbnail = await this.createThumbnail(file);
            
            return {
                name: file.name,
                size: file.size,
                type: file.type,
                date: exifData.date,
                lat: exifData.lat,
                lng: exifData.lng,
                thumbnail
            };
        } catch (error) {
            console.error('Error processing file:', error);
            return {
                name: file.name,
                error: 'Failed to process file'
            };
        }
    }
    
    /**
     * Extract EXIF data from photo
     * @param {File} file Photo file
     * @returns {Promise<Object>} Promise resolving to object with lat, lng, date
     */
    extractExifData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    EXIF.getData(reader.result, function() {
                        const exifData = {
                            lat: null,
                            lng: null,
                            date: null
                        };
                        
                        // Extract GPS data if available
                        if (EXIF.getTag(this, 'GPSLatitude') && EXIF.getTag(this, 'GPSLongitude')) {
                            // Extract latitude
                            const latArray = EXIF.getTag(this, 'GPSLatitude');
                            const latRef = EXIF.getTag(this, 'GPSLatitudeRef') || 'N';
                            
                            // Extract longitude
                            const lngArray = EXIF.getTag(this, 'GPSLongitude');
                            const lngRef = EXIF.getTag(this, 'GPSLongitudeRef') || 'E';
                            
                            // Calculate decimal degrees
                            let lat = this.convertDMSToDD(latArray[0], latArray[1], latArray[2], latRef);
                            let lng = this.convertDMSToDD(lngArray[0], lngArray[1], lngArray[2], lngRef);
                            
                            exifData.lat = lat;
                            exifData.lng = lng;
                        }
                        
                        // Extract date if available
                        if (EXIF.getTag(this, 'DateTimeOriginal')) {
                            exifData.date = EXIF.getTag(this, 'DateTimeOriginal');
                        }
                        
                        resolve(exifData);
                    }.bind(reader.result));
                } catch (error) {
                    console.error('Error extracting EXIF data:', error);
                    resolve({ lat: null, lng: null, date: null });
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Error reading file'));
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * Convert EXIF GPS coordinates to decimal degrees
     * @param {Number} degrees Degrees
     * @param {Number} minutes Minutes
     * @param {Number} seconds Seconds
     * @param {String} direction N, S, E, W
     * @returns {Number} Decimal degrees
     */
    convertDMSToDD(degrees, minutes, seconds, direction) {
        let dd = degrees + minutes / 60 + seconds / 3600;
        
        if (direction === 'S' || direction === 'W') {
            dd = dd * -1;
        }
        
        return dd;
    }
    
    /**
     * Create a thumbnail from a photo file
     * @param {File} file Photo file
     * @returns {Promise<String>} Promise resolving to data URL of thumbnail
     */
    createThumbnail(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                const img = new Image();
                
                img.onload = () => {
                    // Calculate thumbnail dimensions
                    let width = img.width;
                    let height = img.height;
                    const max = this.thumbnailSize;
                    
                    if (width > height) {
                        if (width > max) {
                            height = height * (max / width);
                            width = max;
                        }
                    } else {
                        if (height > max) {
                            width = width * (max / height);
                            height = max;
                        }
                    }
                    
                    // Create canvas and draw scaled image
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convert to data URL
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                };
                
                img.onerror = () => {
                    reject(new Error('Error loading image'));
                };
                
                img.src = event.target.result;
            };
            
            reader.onerror = () => {
                reject(new Error('Error reading file'));
            };
            
            reader.readAsDataURL(file);
        });
    }
}