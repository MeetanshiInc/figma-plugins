figma.showUI(__html__, { width: 400, height: 600, title: "Emoji & Sticker Library" });

// Type definitions for our data
interface Item {
  name: string;
  staticImageUrl: string;
  animatedImageUrl: string;
}

interface InsertPayload {
  item: Item;
  size: number;
  rotation: number;
}

interface StickerBombPayload {
  item: Item;
  size: number;
  rotation: number;
  quantity: number;
}

interface StoragePayload {
  favorites: Item[];
  recents: Item[];
}

// --- NEW CACHING LOGIC ---
async function handleLoadEmojis() {
  const CACHE_KEY = 'cachedEmojis';
  const ONE_DAY = 86400000; // Milliseconds in a day

  try {
    const cachedData = await figma.clientStorage.getAsync(CACHE_KEY);

    if (cachedData && (Date.now() - cachedData.timestamp < ONE_DAY)) {
      figma.ui.postMessage({ type: 'emojis-loaded', payload: cachedData.data });
      return;
    }
  } catch (e) {
    console.error("Error reading cache", e);
  }

  try {
    const response = await fetch('https://api.github.com/emojis');
    const data = await response.json();
    const emojiArray = Object.keys(data).map(key => ({
      name: key,
      staticImageUrl: data[key],
      animatedImageUrl: data[key]
    }));

    await figma.clientStorage.setAsync(CACHE_KEY, {
      data: emojiArray,
      timestamp: Date.now()
    });

    figma.ui.postMessage({ type: 'emojis-loaded', payload: emojiArray });
  } catch (error) {
    console.error("Failed to fetch emojis", error);
    figma.ui.postMessage({ type: 'emojis-failed' });
  }
}

// --- MESSAGE HANDLING ---
figma.ui.onmessage = async (msg: { type: string; payload?: any }) => {
  switch (msg.type) {
    case 'load-emojis':
      handleLoadEmojis();
      break;
    case 'insert-item':
      handleInsertItem(msg.payload);
      break;
    case 'sticker-bomb':
      handleStickerBomb(msg.payload);
      break;
    case 'get-storage':
      handleGetStorage();
      break;
    case 'set-storage':
      handleSetStorage(msg.payload);
      break;
  }
};

async function handleInsertItem(payload: InsertPayload) {
  const { item, size, rotation } = payload;
  const notification = figma.notify(`Downloading ${item.name}...`, { timeout: Infinity });

  try {
    const imageBytes = await fetch(item.staticImageUrl).then(res => res.arrayBuffer());
    const imageHash = figma.createImage(new Uint8Array(imageBytes)).hash;
    const rect = figma.createRectangle();

    rect.resize(size, size);
    rect.rotation = rotation;
    rect.x = figma.viewport.center.x - (size / 2);
    rect.y = figma.viewport.center.y - (size / 2);
    rect.fills = [{ type: 'IMAGE', scaleMode: 'FIT', imageHash }];
    rect.name = `Item: ${item.name}`;
    rect.setPluginData('animatedUrl', item.animatedImageUrl);

    figma.currentPage.appendChild(rect);
    figma.currentPage.selection = [rect];

    notification.cancel();
    figma.notify(`'${item.name}' inserted!`);
  } catch (error) {
    notification.cancel();
    figma.notify('Failed to insert item.', { error: true });
  }
}

async function handleStickerBomb(payload: StickerBombPayload) {
  const { item, size, rotation, quantity } = payload;
  const selection = figma.currentPage.selection;

  if (selection.length !== 1) {
    figma.notify('Please select a single frame or shape to fill.', { error: true });
    return;
  }
  const targetNode = selection[0];
  if (!('appendChild' in targetNode)) {
    figma.notify('Please select a valid container like a frame or group.', { error: true });
    return;
  }

  const notification = figma.notify(`Sticker Bombing with ${item.name}...`, { timeout: Infinity });
  try {
    const imageBytes = await fetch(item.staticImageUrl).then(res => res.arrayBuffer());
    const imageHash = figma.createImage(new Uint8Array(imageBytes)).hash;
    
    for (let i = 0; i < quantity; i++) {
        const rect = figma.createRectangle();
        const randomSize = size * (Math.random() * 0.5 + 0.75);
        const randomRotation = rotation + (Math.random() * 60 - 30);

        rect.resize(randomSize, randomSize);
        rect.rotation = randomRotation;
        rect.x = Math.random() * (targetNode.width - randomSize);
        rect.y = Math.random() * (targetNode.height - randomSize);
        rect.fills = [{ type: 'IMAGE', scaleMode: 'FIT', imageHash }];
        rect.name = `Item: ${item.name}`;
        rect.setPluginData('animatedUrl', item.animatedImageUrl);
        
        targetNode.appendChild(rect);
    }
    notification.cancel();
    figma.notify('Sticker Bomb complete! 💥');
  } catch (error) {
    notification.cancel();
    figma.notify('Failed to Sticker Bomb.', { error: true });
  }
}

async function handleGetStorage() {
  const favorites = await figma.clientStorage.getAsync('favorites') || [];
  const recents = await figma.clientStorage.getAsync('recents') || [];
  figma.ui.postMessage({ type: 'storage-result', payload: { favorites, recents } });
}

async function handleSetStorage(payload: StoragePayload) {
  await figma.clientStorage.setAsync('favorites', payload.favorites);
  await figma.clientStorage.setAsync('recents', payload.recents);
}