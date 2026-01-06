let canvas;
let ctx;

// Wird in DOMContentLoaded initialisiert

function initCanvas() {
    if (canvas && ctx) return; // Bereits initialisiert
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('gameCanvas nicht gefunden');
        return false;
    }
    ctx = canvas.getContext('2d');
    
    // Pixel-Art Rendering aktivieren
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    return true;
}

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
    fridgeSkin: 'green', // default: immer grüner Kühlschrank
    magnets: [],
    inventory: {}, // { seriesName: [{ id, imageData, value }] }
    marketMagnets: [], // Verfügbare Magnete auf dem Markt
    ownershipCount: {} // { seriesName: count }
};

let fridgeOpen = false;
let draggedMagnet = null;

// Kühlschrank Eigenschaften (vereinfacht: nur grün/weiß)
const fridges = {
    green: {
        closed: 'Fridges - Green/Fridge 1_sprites/Fridge 1_000.png',
        empty: 'Fridges - Green/Fridge 1_sprites/Fridge 1_000.png'
    },
    white: {
        closed: 'Fridges - White/Fridge 1 _sprites/Fridge 1 _000.png',
        empty: 'Fridges - White/Fridge 1 _sprites/Fridge 1 _000.png'
    }
};

const fridge = {
    x: 300,  // centered: (1000 - 400) / 2
    y: 20,   // reduced top margin for bigger fridge
    width: 400,
    height: 510
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
        this.stuckToFridge = false;

        // Sanfte Magnet-Physik Parameter (träge, weniger "Zoomen")
        this.magnetRange = 100;       // Reichweite, ab der Anziehung einsetzt (px)
        this.magnetStrength = 0.05;   // Federkonstante (kleiner = sanfter)
        this.magnetDamping = 0.22;    // Dämpfung (größer = weniger Überschwingen)
        this.magnetAccelMax = 0.6;    // Maximale Beschleunigung durch Magnet pro Frame
        this.airDrag = 0.985;         // Luftwiderstand (für X und Y)
        this.hasPlayedStickSound = false; // Sound nur einmal beim Festkleben

        // Wurf-/Boden-Handling
        this.onGround = false;        // Liegt auf dem Boden auf
        this.attractionCooldown = 0;  // Wird beim Loslassen gesetzt
        this.throwScale = 0.75;       // Skaliert Maus-Wurfkraft runter
        this.maxThrowSpeed = 12;      // Max. Startgeschwindigkeit (px/frame)
    }
    
    isOnFridge() {
        return this.x + this.width > fridge.x &&
               this.x < fridge.x + fridge.width &&
               this.y + this.height > fridge.y &&
               this.y < fridge.y + fridge.height;
    }
    
    update() {
        // Apply physics nur wenn nicht dragging
        if (!this.dragging) {
            // Wenn fest, nichts bewegen
            if (this.stuckToFridge) return;

            // Schwerkraft nur, wenn nicht am Boden
            if (!this.onGround) {
                this.velocityY += this.gravity;
            }

            // Sanfte Magnet-Anziehung in der Nähe des Kühlschranks
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            const targetX = Math.max(fridge.x, Math.min(cx, fridge.x + fridge.width));
            const targetY = Math.max(fridge.y, Math.min(cy, fridge.y + fridge.height));
            const dx = targetX - cx;
            const dy = targetY - cy;
            const dist = Math.hypot(dx, dy);

            // Anziehung nur, wenn Cooldown vorbei und nicht am Boden
            if (dist < this.magnetRange && this.attractionCooldown <= 0 && !this.onGround) {
                // Federkraft Richtung nächster Punkt am Kühlschrank (mit Begrenzung)
                let ax = dx * this.magnetStrength - this.velocityX * this.magnetDamping;
                let ay = dy * this.magnetStrength - this.velocityY * this.magnetDamping;
                const aMag = Math.hypot(ax, ay);
                if (aMag > this.magnetAccelMax && aMag > 0) {
                    const scale = this.magnetAccelMax / aMag;
                    ax *= scale; ay *= scale;
                }
                this.velocityX += ax;
                this.velocityY += ay;
            }

            // Luftwiderstand anwenden (träges Verhalten)
            this.velocityX *= this.airDrag;
            this.velocityY *= this.airDrag;
            // Reibung anwenden (wirkt v.a. auf X)
            this.velocityX *= this.friction;

            // Position aktualisieren
            this.x += this.velocityX;
            this.y += this.velocityY;

            // Wände abprallen
            if (this.x < 0) {
                this.x = 0;
                this.velocityX = -this.velocityX * 0.5;
            }
            if (this.x + this.width > canvas.width) {
                this.x = canvas.width - this.width;
                this.velocityX = -this.velocityX * 0.5;
            }

            // Boden (canvas height - magnet height): Kein Bounce, realistische Haftung
            const floorY = canvas.height - this.height - 10;
            if (this.y > floorY) {
                this.y = floorY;
                // Vertikale Bewegung stoppen
                if (this.velocityY > 0) this.velocityY = 0;
                this.onGround = true;
                // Kinetische Reibung auf dem Boden
                this.velocityX *= 0.85;
                if (Math.abs(this.velocityX) < 0.05) this.velocityX = 0;
            } else {
                this.onGround = false;
            }

            // Wenn wir im Kühlschrank-Bereich sind und fast still stehen, „haften“
            const onFridge = this.isOnFridge();
            const speed = Math.hypot(this.velocityX, this.velocityY);
            if (onFridge && dist < 4 && speed < 0.35) {
                this.stuckToFridge = true;
                this.velocityX = 0;
                this.velocityY = 0;
                if (!this.hasPlayedStickSound) {
                    playMagnetSound();
                    this.hasPlayedStickSound = true;
                }
            } else if (!onFridge) {
                // Außerhalb des Kühlschranks: Sound wieder erlauben
                this.hasPlayedStickSound = false;
            }

            // Anziehungs-Cooldown herunterzählen
            if (this.attractionCooldown > 0) this.attractionCooldown--;
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

// (alt) render() nicht mehr benötigt

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
    updateSettingsUI();
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
                <button class="card-button" onclick="openDeleteModal('${series}', '${magnet.id}')">
                    Delete
                </button>
            `;
            grid.appendChild(card);
        });
    });
}

// Settings-UI steuern (Green/White)
function updateSettingsUI() {
    const greenRadio = document.querySelector('input[name="fridgeColor"][value="green"]');
    const whiteRadio = document.querySelector('input[name="fridgeColor"][value="white"]');
    if (greenRadio && whiteRadio) {
        if (gameState.fridgeSkin === 'white') {
            whiteRadio.checked = true;
        } else {
            greenRadio.checked = true;
        }
    }
}

// ========== TRANSAKTIONEN ==========

function setFridgeColor(color) {
    if (!['green', 'white'].includes(color)) return;
    gameState.fridgeSkin = color;
    try { localStorage.setItem('fridgeColor', color); } catch (_) {}
    draw();
    updateSettingsUI();
}

// ========== CANVAS EVENTS ==========
let lastMouseX = 0;
let lastMouseY = 0;
let mouseVelocityX = 0;
let mouseVelocityY = 0;

function initEventListeners() {
    if (!canvas) return; // Canvas muss initialisiert sein
    
    canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Reset Wurfmessung beim Start des Drags
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    mouseVelocityX = 0;
    mouseVelocityY = 0;
    
    for (let i = gameState.magnets.length - 1; i >= 0; i--) {
        if (gameState.magnets[i].contains(mouseX, mouseY)) {
            draggedMagnet = gameState.magnets[i];
            draggedMagnet.dragging = true;
            draggedMagnet.stuckToFridge = false; // Remove from fridge when grabbed
            draggedMagnet.hasPlayedStickSound = false; // Erlaubt späteren Stick-Sound erneut
            break;
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (draggedMagnet && draggedMagnet.dragging) {
        // Wurfgeschwindigkeit nur während des Drags messen
        mouseVelocityX = mouseX - lastMouseX;
        mouseVelocityY = mouseY - lastMouseY;
        lastMouseX = mouseX;
        lastMouseY = mouseY;
        draggedMagnet.x = mouseX - draggedMagnet.width / 2;
        draggedMagnet.y = mouseY - draggedMagnet.height / 2;
        
        draw();
    } else {
        // Außerhalb eines Drags nur die letzte Position aktualisieren
        lastMouseX = mouseX;
        lastMouseY = mouseY;
    }
});

canvas.addEventListener('mouseup', () => {
    if (draggedMagnet) {
        // Berechne Wurf-Geschwindigkeit basierend auf Maus-Velocity
        let vx = mouseVelocityX * draggedMagnet.throwScale;
        let vy = mouseVelocityY * draggedMagnet.throwScale;
        const vMag = Math.hypot(vx, vy);
        if (vMag > draggedMagnet.maxThrowSpeed) {
            const s = draggedMagnet.maxThrowSpeed / vMag;
            vx *= s; vy *= s;
        }
        draggedMagnet.velocityX = vx;
        draggedMagnet.velocityY = vy;

        draggedMagnet.dragging = false;
        // Kurzer Cooldown, damit die Wurfparabel sichtbar ist, bevor Magnetkraft greift
        draggedMagnet.attractionCooldown = 24; // ~400ms bei 60 FPS
        draggedMagnet.onGround = false; // Neustart Flugphase
        // Kein sofortiges Festkleben mehr – die Update-Physik übernimmt sanftes Haften
        draggedMagnet = null;
    }
    });

// ========== BUTTONS ==========
    const toggleDoor = document.getElementById('toggleDoor');
    if (toggleDoor) {
        toggleDoor.addEventListener('click', () => {
            document.getElementById('imageUpload').click();
        });
    }
}

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

function initImageUploadListener() {
    const imageUpload = document.getElementById('imageUpload');
    if (imageUpload) {
        imageUpload.addEventListener('change', (e) => {
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
    }
}

// Alte Stelle: Wird jetzt in DOMContentLoaded aufgerufen

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
        // Browser-Alert entfernt; stilles Update
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
document.addEventListener('DOMContentLoaded', () => {
    // Canvas initialisieren
    initCanvas();
    // Event-Listener initialisieren
    initEventListeners();
    initImageUploadListener();
    
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
    // Settings Cog öffnen
    const openBtn = document.getElementById('openSettings');
    if (openBtn) {
        openBtn.addEventListener('click', () => openSettingsModal());
    }
    // Settings Radio-Listener (im Modal)
    const radios = document.querySelectorAll('input[name="fridgeColor"]');
    radios.forEach(r => r.addEventListener('change', (e) => setFridgeColor(e.target.value)));
    // Persistierte Farbe laden
    try {
        const saved = localStorage.getItem('fridgeColor');
        if (saved) gameState.fridgeSkin = saved;
    } catch (_) {}
    updateSettingsUI();
    
    // Start init
    updateUI();
    requestAnimationFrame(draw);
});

// Falls DOMContentLoaded schon vorbei ist, führe direkt aus
if (document.readyState !== 'loading') {
    // Bereits geladen
    setTimeout(() => {
        initCanvas();
        updateUI();
        requestAnimationFrame(draw);
    }, 10);
}

// Settings-Modal API
function openSettingsModal() {
    const m = document.getElementById('settingsModal');
    if (m) {
        m.style.display = 'flex';
        updateSettingsUI();
    }
}
function closeSettingsModal() {
    const m = document.getElementById('settingsModal');
    if (m) m.style.display = 'none';
}

// Delete-Confirm Modal API
let pendingDelete = null; // { series, id }
function openDeleteModal(series, id) {
    pendingDelete = { series, id };
    const m = document.getElementById('deleteConfirmModal');
    if (m) m.style.display = 'flex';
}
function closeDeleteModal() {
    pendingDelete = null;
    const m = document.getElementById('deleteConfirmModal');
    if (m) m.style.display = 'none';
}
function confirmDeleteMagnet() {
    if (!pendingDelete) return;
    const { series, id } = pendingDelete;
    if (gameState.inventory[series]) {
        gameState.inventory[series] = gameState.inventory[series].filter(m => String(m.id) !== String(id));
        if (gameState.inventory[series].length === 0) {
            delete gameState.inventory[series];
        }
    }
    closeDeleteModal();
    updateUI();
}

// ========== INIT ==========
// Wird durch DOMContentLoaded oben aufgerufen

