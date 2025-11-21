figma.showUI(__html__, { width: 240, height: 380 }); // Increased height for new field

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'wrap-text') {

    const selection = figma.currentPage.selection;
    if (selection.length !== 2) { /* ... */ return; }
    const textNode = selection.find((node: SceneNode) => node.type === 'TEXT') as TextNode;
    const imageNode = selection.find((node: SceneNode) => node.type !== 'TEXT');
    if (!textNode || !imageNode || !textNode.parent) { /* ... */ return; }
    
    await figma.loadFontAsync(textNode.fontName as FontName);
    const imageBounds = imageNode.absoluteBoundingBox;
    const textBounds = textNode.absoluteBoundingBox;
    if (!imageBounds || !textBounds) { /* ... */ return; }
    
    // USE SPACING VALUE FROM UI
    const PADDING = (typeof msg.spacing === 'number') ? msg.spacing : 10;

    let wrapHeightPercent = msg.wrapHeightPercent || 100;
    if (wrapHeightPercent < 1) wrapHeightPercent = 1;
    if (wrapHeightPercent > 100) wrapHeightPercent = 100;
    const effectiveImageHeight = imageBounds.height * (wrapHeightPercent / 100);

    textNode.visible = false;
    const imageIsOnTheLeft = (imageBounds.x + imageBounds.width / 2) < (textBounds.x + textBounds.width / 2);

    const sideNode = figma.createText();
    textNode.parent.appendChild(sideNode);
    await figma.loadFontAsync(textNode.fontName as FontName);
    sideNode.fontName = textNode.fontName as FontName;
    sideNode.fontSize = textNode.fontSize as number;
    sideNode.lineHeight = textNode.lineHeight as LineHeight;
    sideNode.fills = textNode.fills;
    sideNode.textAlignVertical = 'TOP';

    if (imageIsOnTheLeft) {
      const sideWidth = textBounds.width - (imageBounds.x - textBounds.x) - imageBounds.width - PADDING;
      sideNode.resize(sideWidth, imageBounds.height);
      sideNode.x = textNode.x + (imageBounds.x - textBounds.x) + imageBounds.width + PADDING;
      sideNode.y = textNode.y + (imageBounds.y - textBounds.y);
    } else {
      const sideWidth = (imageBounds.x - textBounds.x) - PADDING;
      sideNode.resize(sideWidth, imageBounds.height);
      sideNode.x = textNode.x;
      sideNode.y = textNode.y + (imageBounds.y - textBounds.y);
    }
    sideNode.textAutoResize = 'HEIGHT';
    
    let splitIndex = 0;
    const originalChars = textNode.characters;
    let low = 0, high = originalChars.length;
    while (low <= high) {
        const mid = Math.floor(low + (high - low) / 2);
        sideNode.characters = originalChars.substring(0, mid);
        await new Promise(resolve => setTimeout(resolve, 5));
        if (sideNode.height <= effectiveImageHeight) {
            splitIndex = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    sideNode.characters = originalChars.substring(0, splitIndex);
    
    const bottomNode = figma.createText();
    textNode.parent.appendChild(bottomNode);
    await figma.loadFontAsync(textNode.fontName as FontName);
    bottomNode.fontName = textNode.fontName as FontName;
    bottomNode.fontSize = textNode.fontSize as number;
    bottomNode.lineHeight = textNode.lineHeight as LineHeight;
    bottomNode.fills = textNode.fills;
    bottomNode.textAlignVertical = 'TOP';
    
    bottomNode.characters = originalChars.substring(splitIndex);
    bottomNode.resize(textBounds.width, 1);
    bottomNode.textAutoResize = 'HEIGHT';
    bottomNode.x = textNode.x;
    bottomNode.y = textNode.y + (imageBounds.y - textBounds.y) + effectiveImageHeight + PADDING;

    figma.notify("Wrap complete!");
    figma.closePlugin();
  }
};