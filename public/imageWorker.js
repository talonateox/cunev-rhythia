
self.onmessage = function(e) {
  const { imageData, mapId } = e.data;
  
  try {
    const blob = new Blob([imageData], { type: 'image/png' });
    const blobUrl = URL.createObjectURL(blob);
    
    self.postMessage({
      mapId: mapId,
      blobUrl: blobUrl
    });
  } catch (error) {
    self.postMessage({
      mapId: mapId,
      error: error.message
    });
  }
};