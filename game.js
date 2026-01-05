const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Pixel-Art Rendering aktivieren
ctx.imageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled = false;

// Pixel-Palette
const PIXEL_BG = 'rgb(215, 228, 222)';
const PIXEL_PANEL = 'rgb(188, 204, 197)';
const PIXEL_BORDER = 'rgb(44, 62, 60)';

// Cache für Kühlschrank-Bilder, damit der Sprite beim Drag nicht flackert
const fridgeImageCache = {};

// Sound für Magnete
function playMagnetSound() {
    // Dateiname korrigiert: audiomass-output.mp3 (liegt im Projekt-Root)
    const audio = new Audio('audiomass-output.mp3');
    // Variierende Tonhöhe zwischen 0.9 und 1.1 (±10%)
    audio.playbackRate = 0.9 + Math.random() * 0.2;
    audio.volume = 0.5;
    audio.play().catch(err => console.log('Audio playback failed:', err));
}

// ========== SPIEL-STATE ==========
let gameState = {
    money: 0,
    fridgeSkin: 'green1',
    magnets: [],
    inventory: {}, // { seriesName: [{ id, imageData, value }] }
    marketMagnets: [], // Verfügbare Magnete auf dem Markt
    ownershipCount: {} // { seriesName: count }
};

let fridgeOpen = false;
let draggedMagnet = null;

// Kühlschrank Eigenschaften
const fridges = {
    green1: {
        closed: 'Fridges - Green/Fridge 1_sprites/Fridge 1_000.png',
        empty: 'Fridges - Green/Fridge 1_sprites/Fridge 1_000.png'
    },
    green2: {
        closed: 'Fridges - Green/Fridge 2 _sprites/Fridge 2 _000.png',
        empty: 'Fridges - Green/Fridge 2 _sprites/Fridge 2 _000.png'
    },
    green3: {
        closed: 'Fridges - Green/Fridge 3_sprites/Fridge 3_000.png',
        empty: 'Fridges - Green/Fridge 3_sprites/Fridge 3_000.png'
    },
    green4: {
        closed: 'Fridges - Green/Fridge 4 _sprites/Fridge 4 _000.png',
        empty: 'Fridges - Green/Fridge 4 _sprites/Fridge 4 _000.png'
    },
    green5: {
        closed: 'Fridges - Green/Fridge 5_sprites/Fridge 5_000.png',
        empty: 'Fridges - Green/Fridge 5_sprites/Fridge 5_000.png'
    },
    white1: {
        closed: 'Fridges - White/Fridge 1 _sprites/Fridge 1 _000.png',
        empty: 'Fridges - White/Fridge 1 _sprites/Fridge 1 _000.png'
    },
    white2: {
        closed: 'Fridges - White/Fridge 2_sprites/Fridge 2_000.png',
        empty: 'Fridges - White/Fridge 2_sprites/Fridge 2_000.png'
    },
    white3: {
        closed: 'Fridges - White/Fridge 3_sprites/Fridge 3_000.png',
        empty: 'Fridges - White/Fridge 3_sprites/Fridge 3_000.png'
    },
    white4: {
        closed: 'Fridges - White/Fridge 4_sprites/Fridge 4_000.png',
        empty: 'Fridges - White/Fridge 4_sprites/Fridge 4_000.png'
    },
    white5: {
        closed: 'Fridges - White/Fridge 5_sprites/Fridge 5_000.png',
        empty: 'Fridges - White/Fridge 5_sprites/Fridge 5_000.png'
    }
};

function getFridgeImage(skinId) {
    if (!fridges[skinId]) return null;
    if (fridgeImageCache[skinId]) return fridgeImageCache[skinId];

    const img = new Image();
    img.src = fridges[skinId].closed;
    fridgeImageCache[skinId] = { img, loaded: false, error: false };

    img.onload = () => {
        fridgeImageCache[skinId].loaded = true;
        draw(); // erneut zeichnen, sobald das Bild fertig ist
    };
    img.onerror = () => {
        fridgeImageCache[skinId].error = true;
    };

    return fridgeImageCache[skinId];
}

const fridge = {
    x: 300,  // centered: (1000 - 400) / 2
    y: 20,   // reduced top margin for bigger fridge
    width: 400,
    height: 510
};

// ========== MAGNET KLASSE ==========
class Magnet {
    constructor(imageData, x, y, series = 'Custom') {
        this.imageData = imageData;
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 80;
        this.dragging = false;
        this.series = series;
        this.id = Date.now() + Math.random();
        this.velocityY = 0;
        this.velocityX = 0;
        this.gravity = 0.6;
        this.friction = 0.98;
        this.lastX = x;
        this.lastY = y;
    }
    
    update() {
        // Apply physics wenn nicht dragging
        if (!this.dragging) {
            // Gravity
            this.velocityY += this.gravity;
            
            // Apply friction
            this.velocityX *= this.friction;
            
            // Update position
            this.x += this.velocityX;
            this.y += this.velocityY;
            
            // Bounce off walls
            if (this.x < 0) {
                this.x = 0;
                this.velocityX = -this.velocityX * 0.5;
            }
            if (this.x + this.width > canvas.width) {
                this.x = canvas.width - this.width;
                this.velocityX = -this.velocityX * 0.5;
            }
            
            // Stoppe am Boden (canvas height - magnet height)
            const floorY = canvas.height - this.height - 10;
            if (this.y > floorY) {
                this.y = floorY;
                this.velocityY = -this.velocityY * 0.3; // Bounce
                this.velocityX *= 0.7; // Slow down on bounce
                
                // Stop completely if bounce is too small
                if (Math.abs(this.velocityY) < 0.5) {
                    this.velocityY = 0;
                }
                if (Math.abs(this.velocityX) < 0.2) {
                    this.velocityX = 0;
                }
            }
        } else {
            // Track position for velocity calculation
            this.lastX = this.x;
            this.lastY = this.y;
        }
    }

    draw() {
        if (!fridgeOpen) {
            try {
                const img = new Image();
                img.src = this.imageData;
                ctx.drawImage(img, this.x, this.y, this.width, this.height);
            } catch (e) {
                ctx.fillStyle = '#ddd';
                ctx.fillRect(this.x, this.y, this.width, this.height);
                ctx.fillStyle = '#666';
                ctx.font = '12px Arial';
                ctx.fillText('Image', this.x + 20, this.y + 40);
            }
        }
    }

    contains(mouseX, mouseY) {
        return mouseX >= this.x && mouseX <= this.x + this.width &&
               mouseY >= this.y && mouseY <= this.y + this.height;
    }
}

// ========== DRAW FRIDGE WITH SPRITES ==========
function drawFridge() {
    const fridgeConfig = fridges[gameState.fridgeSkin];

    if (!fridgeConfig) {
        console.error('Fridge skin not found:', gameState.fridgeSkin);
        return;
    }

    const cached = getFridgeImage(gameState.fridgeSkin);

    if (cached && cached.loaded && !cached.error) {
        ctx.drawImage(cached.img, fridge.x, fridge.y, fridge.width, fridge.height);
    } else {
        // Fallback: Draw simple graphics while the image lädt oder fehlschlägt
        ctx.fillStyle = gameState.fridgeSkin.includes('white') ? '#e8e8e8' : '#a8c8d8';
        ctx.fillRect(fridge.x, fridge.y, fridge.width, fridge.height);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 3;
        ctx.strokeRect(fridge.x, fridge.y, fridge.width, fridge.height);
    }
}

// ========== DRAW GAME ==========
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    ctx.fillStyle = PIXEL_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fridge first (background)
    drawFridge();

    // Magnets - Update gravity und zeichnen (on top)
    gameState.magnets.forEach(magnet => {
        magnet.update();
        magnet.draw();
    });
    
    // Weiterzeichnen
    requestAnimationFrame(draw);
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1) Kühlschrank zeichnen (Hintergrund)
    drawFridge();

    // 2) Magnete oben drauf
    gameState.magnets.forEach(m => drawMagnet(m));

    requestAnimationFrame(render);
}

// ========== MAGNET KAUFEN/VERKAUFEN ==========
function getMagnetValue(series) {
    const baseValue = 50;
    const ownerCount = gameState.ownershipCount[series] || 1;
    // Weniger Besitzer = höherer Wert
    return Math.max(baseValue, 200 - ownerCount * 5);
}

// ========== UI UPDATES ==========
function updateUI() {
    document.getElementById('money').textContent = gameState.money;
    updateInventory();
    updateSkins();
}

function updateInventory() {
    const grid = document.getElementById('inventoryGrid');
    grid.innerHTML = '';
    
    const totalMagnets = Object.values(gameState.inventory).reduce((sum, arr) => sum + arr.length, 0);
    const totalSeries = Object.keys(gameState.inventory).length;
    
    document.getElementById('totalMagnets').textContent = totalMagnets;
    document.getElementById('totalSeries').textContent = totalSeries;
    
    if (totalMagnets === 0) {
        grid.innerHTML = '<div class="empty-message">Your inventory is empty. Create magnets by importing images!</div>';
        return;
    }
    
    Object.entries(gameState.inventory).forEach(([series, magnets]) => {
        magnets.forEach(magnet => {
            const value = magnet.value || getMagnetValue(series);
            const card = document.createElement('div');
            card.className = 'magnet-card';
            const rarityClass = `rarity-${magnet.rarity || 'common'}`;
            card.innerHTML = `
                <img src="${magnet.imageData}" alt="${series}">
                <div class="magnet-series">${series}</div>
                <div class="magnet-rarity ${rarityClass}">${(magnet.rarity || 'common').toUpperCase()}</div>
                <div style="font-size: 10px; color: #666;">Präzision: ${Math.round(magnet.precision || 0)}%</div>
                <div class="magnet-value">${value}€</div>
                <button class="card-button" onclick="sellMagnet('${magnet.id}', ${value}, '${series}')">
                    Sell
                </button>
            `;
            grid.appendChild(card);
        });
    });
}

function updateSkins() {
    const grid = document.getElementById('skinsGrid');
    grid.innerHTML = '';
    
    Object.entries(fridges).forEach(([skinId, skinConfig]) => {
        const card = document.createElement('div');
        card.className = 'skin-card';
        const isActive = gameState.fridgeSkin === skinId;
        
        // Lade Preview-Bild
        const img = new Image();
        img.src = skinConfig.closed;
        
        const imgElement = document.createElement('img');
        imgElement.src = skinConfig.closed;
        imgElement.style.width = '100%';
        imgElement.style.height = '100px';
        imgElement.style.objectFit = 'cover';
        imgElement.style.borderRadius = '0';
        imgElement.style.marginBottom = '8px';
        imgElement.style.border = '1px solid #999';
        imgElement.style.imageRendering = 'pixelated';
        imgElement.style.imageRendering = 'crisp-edges';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'magnet-series';
        nameDiv.textContent = skinId.replace('green', 'Green ').replace('white', 'White ');
        
        const buttonDiv = document.createElement('button');
        buttonDiv.className = 'card-button';
        buttonDiv.onclick = () => selectFridgeSkin(skinId);
        buttonDiv.textContent = isActive ? '✓ Active' : 'Select';
        
        card.appendChild(imgElement);
        card.appendChild(nameDiv);
        card.appendChild(buttonDiv);
        
        grid.appendChild(card);
    });
}

// ========== TRANSAKTIONEN ==========

function selectFridgeSkin(skinId) {
    gameState.fridgeSkin = skinId;
    draw();
    updateSkins();
}

// ========== CANVAS EVENTS ==========
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    for (let i = gameState.magnets.length - 1; i >= 0; i--) {
        if (gameState.magnets[i].contains(mouseX, mouseY)) {
            draggedMagnet = gameState.magnets[i];
            draggedMagnet.dragging = true;
            break;
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (draggedMagnet && draggedMagnet.dragging) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        draggedMagnet.x = mouseX - draggedMagnet.width / 2;
        draggedMagnet.y = mouseY - draggedMagnet.height / 2;
        
        draw();
    }
});

canvas.addEventListener('mouseup', () => {
    if (draggedMagnet) {
        // Berechne Wurf-Geschwindigkeit basierend auf letzter Bewegung
        const velocityX = draggedMagnet.x - draggedMagnet.lastX;
        const velocityY = draggedMagnet.y - draggedMagnet.lastY;
        
        draggedMagnet.velocityX = velocityX * 1.2; // Amplify throw
        draggedMagnet.velocityY = velocityY * 1.2;
        
        // Prüfe ob Magnet auf dem Kühlschrank ist
        const onFridge = draggedMagnet.x + draggedMagnet.width > fridge.x &&
                         draggedMagnet.x < fridge.x + fridge.width &&
                         draggedMagnet.y + draggedMagnet.height > fridge.y &&
                         draggedMagnet.y < fridge.y + fridge.height;
        
        draggedMagnet.dragging = false;
        draggedMagnet = null;
        
        // Sound nur wenn auf Kühlschrank
        if (onFridge) {
            playMagnetSound();
        }
    }
});

// ========== BUTTONS ==========
document.getElementById('toggleDoor').addEventListener('click', () => {
    document.getElementById('imageUpload').click();
});

// ========== IMAGE MODAL SYSTEM ==========
let currentImageData = null;
let selectedShape = 'square';
let cuttingState = {
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    precision: 0,
    rarity: 'common',
    value: 0
};
let cuttingCanvas, cuttingGameCanvas;
let isCutting = false;

document.getElementById('imageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentImageData = event.target.result;
            openImageModal();
        };
        reader.readAsDataURL(file);
    }
});

function openImageModal() {
    document.getElementById('imageModal').style.display = 'flex';
    selectedShape = 'square';
    document.querySelectorAll('.shape-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-shape="square"]').classList.add('active');
    
    setTimeout(() => {
        cuttingCanvas = document.getElementById('cuttingCanvas');
        cuttingGameCanvas = document.getElementById('cuttingGameCanvas');
        document.getElementById('imageZoom').value = 1;
        document.getElementById('imageX').value = 0;
        document.getElementById('imageY').value = 0;
        updateCuttingPreview();
        initCuttingGame();
    }, 50);
}

function closeImageModal() {
    document.getElementById('imageModal').style.display = 'none';
    currentImageData = null;
    cuttingState = {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        precision: 0,
        rarity: 'common',
        value: 0
    };
}

function selectShape(shape) {
    selectedShape = shape;
    document.querySelectorAll('.shape-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-shape="${shape}"]`).classList.add('active');
    updateCuttingPreview();
    initCuttingGame(); // Redraw trace game with new shape
}

function updateCuttingPreview() {
    if (!cuttingCanvas) return;
    
    cuttingState.zoom = parseFloat(document.getElementById('imageZoom').value);
    cuttingState.offsetX = parseInt(document.getElementById('imageX').value);
    cuttingState.offsetY = parseInt(document.getElementById('imageY').value);
    
    const ctx = cuttingCanvas.getContext('2d');
    ctx.clearRect(0, 0, cuttingCanvas.width, cuttingCanvas.height);
    
    // Draw background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, cuttingCanvas.width, cuttingCanvas.height);
    
    // Draw shape
    drawShape(ctx, 200, 200, 120, selectedShape, '#ddd', '#ccc');
    
    // Draw image
    const img = new Image();
    img.src = currentImageData;
    img.onload = () => {
        const w = img.width * cuttingState.zoom;
        const h = img.height * cuttingState.zoom;
        const x = 200 - w/2 + cuttingState.offsetX;
        const y = 200 - h/2 + cuttingState.offsetY;
        
        ctx.save();
        ctx.beginPath();
        drawShape(ctx, 200, 200, 120, selectedShape, null, null);
        ctx.clip();
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
    };
}

function drawShapePath(ctx, x, y, size, shape) {
    switch(shape) {
        case 'square':
            ctx.rect(x - size/2, y - size/2, size, size);
            break;
        case 'circle':
            ctx.arc(x, y, size/2, 0, Math.PI * 2);
            break;
        case 'hexagon':
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI / 3);
                const px = x + (size / 2) * Math.cos(angle);
                const py = y + (size / 2) * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            break;
        case 'triangle':
            ctx.moveTo(x, y - size/2);
            ctx.lineTo(x + size/2, y + size/2);
            ctx.lineTo(x - size/2, y + size/2);
            ctx.closePath();
            break;
        case 'star':
            for (let i = 0; i < 10; i++) {
                const radius = (i % 2 === 0) ? (size / 2) : (size / 4);
                const angle = (i * Math.PI) / 5 - Math.PI / 2;
                const px = x + radius * Math.cos(angle);
                const py = y + radius * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            break;
    }
}

function drawShape(ctx, x, y, size, shape, fillStyle, strokeStyle) {
    if (fillStyle) ctx.fillStyle = fillStyle;
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 2;
    }
    
    switch(shape) {
        case 'square':
            ctx.fillRect(x - size/2, y - size/2, size, size);
            if (strokeStyle) ctx.strokeRect(x - size/2, y - size/2, size, size);
            break;
        case 'circle':
            ctx.beginPath();
            ctx.arc(x, y, size/2, 0, Math.PI * 2);
            ctx.fill();
            if (strokeStyle) ctx.stroke();
            break;
        case 'hexagon':
            drawHexagon(ctx, x, y, size/2, fillStyle, strokeStyle);
            break;
        case 'triangle':
            drawTriangle(ctx, x, y, size, fillStyle, strokeStyle);
            break;
        case 'star':
            drawStar(ctx, x, y, 5, size/2, size/4, fillStyle, strokeStyle);
            break;
    }
}

function drawHexagon(ctx, x, y, size, fillStyle, strokeStyle) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI / 3);
        const px = x + size * Math.cos(angle);
        const py = y + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fillStyle) ctx.fill();
    if (strokeStyle) ctx.stroke();
}

function drawTriangle(ctx, x, y, size, fillStyle, strokeStyle) {
    ctx.beginPath();
    ctx.moveTo(x, y - size/2);
    ctx.lineTo(x + size/2, y + size/2);
    ctx.lineTo(x - size/2, y + size/2);
    ctx.closePath();
    if (fillStyle) ctx.fill();
    if (strokeStyle) ctx.stroke();
}

function drawStar(ctx, x, y, points, outerRadius, innerRadius, fillStyle, strokeStyle) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const px = x + radius * Math.cos(angle);
        const py = y + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fillStyle) ctx.fill();
    if (strokeStyle) ctx.stroke();
}

function initCuttingGame() {
    const ctx = cuttingGameCanvas.getContext('2d');
    
    // Draw white canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cuttingGameCanvas.width, cuttingGameCanvas.height);
    
    // Draw ONLY the outline of the target shape (no gray fill)
    ctx.fillStyle = 'transparent';
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 4;
    drawShape(ctx, 200, 200, 140, selectedShape, null, '#999');
    
    // Label
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Trace the shape accurately on the line', 200, 30);
    
    // Starte Drawing
    let isDrawing = false;
    let drawnPoints = [];
    
    cuttingGameCanvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        drawnPoints = [];
    });
    
    cuttingGameCanvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        
        const rect = cuttingGameCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        drawnPoints.push({x, y});
        
        // Draw user line
        ctx.strokeStyle = '#0078d7';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (drawnPoints.length === 1) {
            ctx.beginPath();
            ctx.moveTo(drawnPoints[0].x, drawnPoints[0].y);
        } else {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    });
    
    cuttingGameCanvas.addEventListener('mouseup', (e) => {
        if (!isDrawing) return;
        isDrawing = false;
        
        if (drawnPoints.length < 10) {
            alert('Please trace the shape!');
            initCuttingGame();
            return;
        }
        
        // Berechne Präzision basierend auf Nähe zur idealen Linie
        const precision = calculateEdgePrecision(drawnPoints, selectedShape);
        cuttingState.precision = precision;
        
        // Determine rarity (extremely strict thresholds)
        if (precision >= 98) {
            cuttingState.rarity = 'legendary';
            cuttingState.value = Math.floor(2000 + precision * 50);
        } else if (precision >= 90) {
            cuttingState.rarity = 'epic';
            cuttingState.value = Math.floor(700 + precision * 15);
        } else if (precision >= 75) {
            cuttingState.rarity = 'rare';
            cuttingState.value = Math.floor(250 + precision * 4);
        } else {
            cuttingState.rarity = 'common';
            cuttingState.value = Math.floor(20 + precision * 0.3);
        }
        
        // Update display
        const precisionDisplay = document.getElementById('precisionDisplay');
        const rarityColor = {
            'common': '#888',
            'rare': '#4a90e2',
            'epic': '#9b59b6',
            'legendary': '#f39c12'
        };
        
        precisionDisplay.innerHTML = `
            <div>Precision: <span style="color: ${rarityColor[cuttingState.rarity]}; font-size: 16px;">${Math.round(precision)}%</span></div>
            <div style="font-size: 11px; color: ${rarityColor[cuttingState.rarity]};">Rarity: ${cuttingState.rarity.toUpperCase()}</div>
            <div style="font-size: 12px; color: #27ae60;">Value: ${cuttingState.value}€</div>
        `;
        
        // Show result on canvas (highlight drawn line)
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#0078d7';
        ctx.lineWidth = 15;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (drawnPoints.length > 0) {
            ctx.moveTo(drawnPoints[0].x, drawnPoints[0].y);
            for (let i = 1; i < drawnPoints.length; i++) {
                ctx.lineTo(drawnPoints[i].x, drawnPoints[i].y);
            }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
    });
}

function calculateEdgePrecision(drawnPoints, shape) {
    // Generiere ideale Kantenpunkte für die Form
    const idealEdgePoints = generateShapeEdgePoints(shape, 200, 200, 70);
    
    if (drawnPoints.length === 0 || idealEdgePoints.length === 0) return 0;
    
    // Berechne durchschnittlichen Abstand zur idealen Kante
    let totalDistance = 0;
    let pointsNearEdge = 0;
    const tolerance = 5; // Extrem enge Toleranz - nur 5px gelten als "auf der Kante"
    
    for (let drawnPoint of drawnPoints) {
        let minDist = Infinity;
        for (let idealPoint of idealEdgePoints) {
            const dist = Math.sqrt(
                Math.pow(drawnPoint.x - idealPoint.x, 2) +
                Math.pow(drawnPoint.y - idealPoint.y, 2)
            );
            minDist = Math.min(minDist, dist);
        }
        totalDistance += minDist;
        if (minDist <= tolerance) {
            pointsNearEdge++;
        }
    }
    
    const avgDistance = totalDistance / drawnPoints.length;
    
    // Sehr strenge Bewertung: max 100% bei 0px Abstand, fällt extrem schnell ab
    let precision = Math.max(0, 100 - (avgDistance * 8));
    
    // Check für Linienglätte (bestraft eckige/zittrige Linien)
    let smoothnessScore = 100;
    if (drawnPoints.length > 3) {
        let totalAngleChange = 0;
        for (let i = 1; i < drawnPoints.length - 1; i++) {
            const dx1 = drawnPoints[i].x - drawnPoints[i-1].x;
            const dy1 = drawnPoints[i].y - drawnPoints[i-1].y;
            const dx2 = drawnPoints[i+1].x - drawnPoints[i].x;
            const dy2 = drawnPoints[i+1].y - drawnPoints[i].y;
            
            const angle1 = Math.atan2(dy1, dx1);
            const angle2 = Math.atan2(dy2, dx2);
            let angleDiff = Math.abs(angle2 - angle1);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
            
            totalAngleChange += angleDiff;
        }
        const avgAngleChange = totalAngleChange / (drawnPoints.length - 2);
        smoothnessScore = Math.max(0, 100 - (avgAngleChange * 200)); // Bestraft Richtungswechsel
    }
    
    // Strafe: Wie viel % der Punkte waren NICHT auf der Kante?
    const edgeCoverage = (pointsNearEdge / drawnPoints.length) * 100;
    
    // Kombiniere alle Faktoren (alle müssen gut sein)
    precision = (precision * 0.2) + (edgeCoverage * 0.5) + (smoothnessScore * 0.3);
    
    // Sehr strenger Bonus für geschlossene Form
    if (drawnPoints.length > 5) {
        const firstPoint = drawnPoints[0];
        const lastPoint = drawnPoints[drawnPoints.length - 1];
        const closureDistance = Math.sqrt(
            Math.pow(firstPoint.x - lastPoint.x, 2) +
            Math.pow(firstPoint.y - lastPoint.y, 2)
        );
        
        if (closureDistance < 10) {
            precision += 5;
        } else if (closureDistance > 30) {
            precision -= 25; // Harte Strafe für offene Form
        }
    }
    
    return Math.min(100, Math.max(0, precision));
}

function generateShapeEdgePoints(shape, x, y, radius) {
    let points = [];
    
    switch(shape) {
        case 'circle':
            for (let i = 0; i < 360; i += 2) {
                const angle = (i * Math.PI) / 180;
                points.push({
                    x: x + radius * Math.cos(angle),
                    y: y + radius * Math.sin(angle)
                });
            }
            break;
            
        case 'square':
            const half = radius;
            // Top
            for (let i = -half; i <= half; i += 2) {
                points.push({x: x + i, y: y - half});
            }
            // Right
            for (let i = -half; i <= half; i += 2) {
                points.push({x: x + half, y: y + i});
            }
            // Bottom
            for (let i = half; i >= -half; i -= 2) {
                points.push({x: x + i, y: y + half});
            }
            // Left
            for (let i = half; i >= -half; i -= 2) {
                points.push({x: x - half, y: y + i});
            }
            break;
            
        case 'hexagon':
            for (let i = 0; i < 6; i++) {
                const angle1 = (i * Math.PI / 3);
                const angle2 = ((i + 1) * Math.PI / 3);
                const steps = 30;
                for (let s = 0; s <= steps; s++) {
                    const angle = angle1 + (angle2 - angle1) * (s / steps);
                    points.push({
                        x: x + radius * Math.cos(angle),
                        y: y + radius * Math.sin(angle)
                    });
                }
            }
            break;
            
        case 'triangle':
            for (let i = 0; i < 3; i++) {
                const angle1 = (i * 2 * Math.PI / 3) - Math.PI / 2;
                const angle2 = ((i + 1) * 2 * Math.PI / 3) - Math.PI / 2;
                const steps = 30;
                for (let s = 0; s <= steps; s++) {
                    const angle = angle1 + (angle2 - angle1) * (s / steps);
                    points.push({
                        x: x + radius * Math.cos(angle),
                        y: y + radius * Math.sin(angle)
                    });
                }
            }
            break;
            
        case 'star':
            for (let i = 0; i < 10; i++) {
                const radius1 = (i % 2 === 0) ? radius : (radius / 2);
                const angle1 = (i * Math.PI) / 5 - Math.PI / 2;
                const radius2 = ((i + 1) % 2 === 0) ? radius : (radius / 2);
                const angle2 = ((i + 1) * Math.PI) / 5 - Math.PI / 2;
                const steps = 20;
                for (let s = 0; s <= steps; s++) {
                    const r = radius1 + (radius2 - radius1) * (s / steps);
                    const angle = angle1 + (angle2 - angle1) * (s / steps);
                    points.push({
                        x: x + r * Math.cos(angle),
                        y: y + r * Math.sin(angle)
                    });
                }
            }
            break;
    }
    
    return points;
}

// ========== TRANSAKTIONEN ==========

function finalizeMagnet() {
    if (cuttingState.precision === 0) {
        alert('Please trace the shape first!');
        return;
    }
    
    // Erstelle Magnet mit allen Daten
    const img = new Image();
    img.src = currentImageData;
    img.onload = () => {
        const w = img.width * cuttingState.zoom;
        const h = img.height * cuttingState.zoom;
        const x = 200 - w/2 + cuttingState.offsetX;
        const y = 200 - h/2 + cuttingState.offsetY;
        
        // Erstelle Canvas mit der Form
        const magnetCanvas = document.createElement('canvas');
        magnetCanvas.width = 80;
        magnetCanvas.height = 80;
        const magnetCtx = magnetCanvas.getContext('2d');
        
        // Draw shape with image
        magnetCtx.save();
        magnetCtx.beginPath();
        drawShapePath(magnetCtx, 40, 40, 80, selectedShape);
        magnetCtx.clip();
        
        // Scale image for 80x80
        const scale = 80 / 160;
        magnetCtx.drawImage(img, 
            (x - 200) * scale + 40, 
            (y - 200) * scale + 40, 
            w * scale, 
            h * scale);
        magnetCtx.restore();
        
        const magnetImage = magnetCanvas.toDataURL();
        
        // Add to inventory
        const series = `${cuttingState.rarity.toUpperCase()}-${Date.now()}`;
        if (!gameState.inventory[series]) {
            gameState.inventory[series] = [];
        }
        
        gameState.inventory[series].push({
            id: Date.now(),
            imageData: magnetImage,
            precision: cuttingState.precision,
            shape: selectedShape,
            rarity: cuttingState.rarity,
            value: cuttingState.value
        });
        
        gameState.money += cuttingState.value;
        gameState.ownershipCount[series] = 1;
        
        // Add magnet to fridge
        gameState.magnets.push(new Magnet(magnetImage, 100 + Math.random() * 200, 100, series));
        
        closeImageModal();
        updateUI();
        draw();
        
        alert(`Magnet Created!\nPrecision: ${Math.round(cuttingState.precision)}%\nValue: ${cuttingState.value}€ (${cuttingState.rarity.toUpperCase()})`);
    };
}

document.getElementById('imageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentImageData = event.target.result;
            openImageModal();
        };
        reader.readAsDataURL(file);
    }
});

// ========== TAB NAVIGATION ==========
setTimeout(() => {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.getAttribute('data-tab');
            
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            
            e.target.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            if (tabName === 'game') {
                draw();
            }
        });
    });
}, 100);

// ========== INIT ==========
updateUI();
draw();
