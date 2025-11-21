// This file runs in Figma's "main" context.
// It has access to the Figma API.

// Show the UI window.
figma.showUI(__html__, { width: 320, height: 420, title: "Image Converter" });

// This function gets the selected image and sends its data to the UI.
async function sendSelectedImageToUI() {
  const selection = figma.currentPage.selection;
  
  // 1. Check if exactly one item is selected
  if (selection.length !== 1) {
    figma.ui.postMessage({ type: 'selection-error', message: 'Please select a single image layer.' });
    return;
  }

  const node = selection[0];
  
  // 2. Check if the item can have an image fill
  if (
    !('fills' in node) || 
    node.fills === figma.mixed || // Check for mixed fills
    node.fills.length === 0 ||     // Check if there are any fills
    node.fills[0].type !== 'IMAGE' // Check if the first fill is an image
  ) {
    figma.ui.postMessage({ type: 'selection-error', message: 'Please select a layer with an image fill.' });
    return;
  }

  // 3. Get the image data
  const imageFill = node.fills[0] as ImagePaint; // We know it's an ImagePaint
  const imageHash = imageFill.imageHash;

  if (imageHash) {
    try {
      const image = figma.getImageByHash(imageHash);
      
      // 4. Safety check if image data can be retrieved
      if (!image) {
        throw new Error("Could not find image from hash.");
      }
      
      const bytes = await image.getBytesAsync(); // Get the raw image bytes
      
      // 5. Send the raw image bytes to the UI
      figma.ui.postMessage({ type: 'image-data', bytes: bytes });

    } catch (err) {
      console.error(err);
      figma.ui.postMessage({ type: 'selection-error', message: 'Could not load image data.' });
    }
  }
}

// Listen for messages coming *from* the UI (ui.html)
figma.ui.onmessage = async (msg) => {
  
  // Case: The UI is asking to "Convert and Replace"
  if (msg.type === 'convert-and-replace') {
    const { bytes } = msg; // Get the new converted bytes from the UI
    
    try {
      // 1. Create a new image fill in Figma from the bytes
      const newImage = figma.createImage(bytes);
      
      // 2. Get the currently selected node (must still be one)
      const selection = figma.currentPage.selection;
      if (selection.length !== 1) return;
      
      const node = selection[0];

      // 3. CRITICAL: We must re-validate the node before replacing
      if (
        !('fills' in node) || 
        node.fills === figma.mixed || 
        node.fills.length === 0 || 
        node.fills[0].type !== 'IMAGE'
      ) {
        figma.notify('Error: Selected layer is no longer a valid image.', { error: true });
        return;
      }

      // 4. Clone the old fills to preserve settings (like Fit/Fill/Crop)
      //    We use JSON.parse(JSON.stringify()) for a deep clone.
      const originalFills = JSON.parse(JSON.stringify(node.fills));
      
      // 5. Update the clone with the new image hash
      originalFills[0].imageHash = newImage.hash;
      
      // 6. Apply the new fill settings back to the node
      node.fills = originalFills;
      
      figma.notify('Image replaced successfully!');

    } catch (err) {
      console.error(err);
      figma.notify('Error replacing image.', { error: true });
    }
  }

  // Case: The UI just loaded and is requesting the initial image
  if (msg.type === 'request-initial-image') {
    await sendSelectedImageToUI();
  }
  
  // Case: The UI wants to send a generic notification
  if (msg.type === 'notify') {
    figma.notify(msg.message, { error: msg.isError || false });
  }
};

// Listen for when the user changes their selection in Figma
figma.on('selectionchange', () => {
  // When the user clicks something else, send the new data to the UI.
  sendSelectedImageToUI();
});