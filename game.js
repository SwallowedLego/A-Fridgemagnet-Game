const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ========== SPIEL-STATE ==========
let gameState = {
    money: 1000,
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
        closed: 'Fridges - Green/Fridge 1.png',
        empty: 'Fridges - Green/Fridge 1 - Empty.png'
    },
    green2: {
        closed: 'Fridges - Green/Fridge 2 .png',
        empty: 'Fridges - Green/Fridge 2 - Empty.png'
    },
    green3: {
        closed: 'Fridges - Green/Fridge 3.png',
        empty: 'Fridges - Green/Fridge 3 - Empty.png'
    },
    green4: {
        closed: 'Fridges - Green/Fridge 4 .png',
        empty: 'Fridges - Green/Fridge 4 - Empty.png'
    },
    green5: {
        closed: 'Fridges - Green/Fridge 5.png',
        empty: 'Fridges - Green/Fridge 5 - Empty.png'
    },
    white1: {
        closed: 'Fridges - White/Fridge 1.png',
        empty: 'Fridges - White/Fridge 1 - Empty.png'
    }
};

const fridge = {
    x: 50,
    y: 50,
    width: 350,
    height: 450
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
                ctx.fillText('Bild', this.x + 20, this.y + 40);
            }
        }
    }

    contains(mouseX, mouseY) {
        return mouseX >= this.x && mouseX <= this.x + this.width &&
               mouseY >= this.y && mouseY <= this.y + this.height;
    }
}

// ========== KÜHLSCHRANK ZEICHNEN ==========
function drawFridge() {
    const fridgeConfig = fridges[gameState.fridgeSkin];
    
    if (fridgeOpen) {
        // Tür offen - einfache Grafik
        ctx.fillStyle = '#6474a0';
        ctx.fillRect(fridge.x, fridge.y, fridge.width, fridge.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 5;
        ctx.strokeRect(fridge.x, fridge.y, fridge.width, fridge.height);
        
        // Regale
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(fridge.x + 20, fridge.y + 20, fridge.width - 40, fridge.height - 40);
        
        ctx.fillStyle = '#ccc';
        for (let i = 1; i < 4; i++) {
            const y = fridge.y + (fridge.height / 4) * i;
            ctx.fillRect(fridge.x + 20, y, fridge.width - 40, 3);
        }
    } else {
        // Tür zu
        ctx.fillStyle = '#96a6c8';
        ctx.fillRect(fridge.x, fridge.y, fridge.width, fridge.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 5;
        ctx.strokeRect(fridge.x, fridge.y, fridge.width, fridge.height);
        
        // Türgriff
        ctx.fillStyle = '#333';
        ctx.fillRect(fridge.x + fridge.width - 20, fridge.y + fridge.height / 2 - 40, 10, 80);
    }
}

// ========== SPIEL ZEICHNEN ==========
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Hintergrund
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Kühlschrank
    drawFridge();
    
    // Magneten
    gameState.magnets.forEach(magnet => magnet.draw());
}

// ========== MAGNET KAUFEN/VERKAUFEN ==========
function getMagnetValue(series) {
    const baseValue = 50;
    const ownerCount = gameState.ownershipCount[series] || 1;
    // Weniger Besitzer = höherer Wert
    return Math.max(baseValue, 200 - ownerCount * 5);
}

function generateMarketMagnets() {
    gameState.marketMagnets = [];
    const series = ['Fruit', 'Animals', 'Space', 'Retro', 'Cartoon'];
    
    series.forEach(s => {
        for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) {
            gameState.marketMagnets.push({
                id: Date.now() + Math.random(),
                series: s,
                value: getMagnetValue(s),
                imageData: generateMagnetImage(s)
            });
        }
    });
}

function generateMagnetImage(series) {
    const magnetCanvas = document.createElement('canvas');
    magnetCanvas.width = 80;
    magnetCanvas.height = 80;
    const magnetCtx = magnetCanvas.getContext('2d');
    
    // Farbschema basierend auf Serie
    const colors = {
        'Fruit': ['#ff6b6b', '#ffd93d', '#6bcf7f'],
        'Animals': ['#8B4513', '#D2691E', '#FFA500'],
        'Space': ['#1a1a2e', '#0f3460', '#e94560'],
        'Retro': ['#ff006e', '#fb5607', '#ffbe0b'],
        'Cartoon': ['#00f5ff', '#ff006e', '#3a86ff']
    };
    
    const colorsToUse = colors[series] || colors['Fruit'];
    
    magnetCtx.fillStyle = colorsToUse[0];
    magnetCtx.fillRect(0, 0, 80, 80);
    
    magnetCtx.fillStyle = colorsToUse[1];
    magnetCtx.beginPath();
    magnetCtx.arc(40, 40, 25, 0, Math.PI * 2);
    magnetCtx.fill();
    
    magnetCtx.fillStyle = colorsToUse[2];
    magnetCtx.font = 'bold 14px Arial';
    magnetCtx.textAlign = 'center';
    magnetCtx.fillText(series[0], 40, 48);
    
    return magnetCanvas.toDataURL();
}

// ========== UI UPDATES ==========
function updateUI() {
    document.getElementById('money').textContent = gameState.money;
    updateMarket();
    updateInventory();
    updateSkins();
}

function updateMarket() {
    generateMarketMagnets();
    const grid = document.getElementById('marketGrid');
    grid.innerHTML = '';
    
    if (gameState.marketMagnets.length === 0) {
        grid.innerHTML = '<div class="empty-message">Keine Magnete verfügbar</div>';
        return;
    }
    
    gameState.marketMagnets.forEach(magnet => {
        const card = document.createElement('div');
        card.className = 'magnet-card';
        card.innerHTML = `
            <img src="${magnet.imageData}" alt="${magnet.series}">
            <div class="magnet-series">${magnet.series}</div>
            <div class="magnet-value">${magnet.value}€</div>
            <div class="magnet-ownership">Besitzer: ${gameState.ownershipCount[magnet.series] || 0}</div>
            <button class="card-button" onclick="buyMagnet('${magnet.id}', ${magnet.value}, '${magnet.series}')">
                Kaufen
            </button>
        `;
        grid.appendChild(card);
    });
}

function updateInventory() {
    const grid = document.getElementById('inventoryGrid');
    grid.innerHTML = '';
    
    const totalMagnets = Object.values(gameState.inventory).reduce((sum, arr) => sum + arr.length, 0);
    const totalSeries = Object.keys(gameState.inventory).length;
    
    document.getElementById('totalMagnets').textContent = totalMagnets;
    document.getElementById('totalSeries').textContent = totalSeries;
    
    if (totalMagnets === 0) {
        grid.innerHTML = '<div class="empty-message">Dein Lager ist leer. Kaufe Magnete auf dem Markt!</div>';
        return;
    }
    
    Object.entries(gameState.inventory).forEach(([series, magnets]) => {
        magnets.forEach(magnet => {
            const value = getMagnetValue(series);
            const card = document.createElement('div');
            card.className = 'magnet-card';
            card.innerHTML = `
                <img src="${magnet.imageData}" alt="${series}">
                <div class="magnet-series">${series}</div>
                <div class="magnet-value">${value}€</div>
                <button class="card-button" onclick="sellMagnet('${magnet.id}', ${value}, '${series}')">
                    Verkaufen
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
        card.innerHTML = `
            <div style="background: ${skinId.includes('white') ? '#fff' : '#96a6c8'}; padding: 20px; border-radius: 8px;">
                <div style="font-size: 40px; margin: 10px 0;">🧊</div>
            </div>
            <div class="magnet-series">${skinId}</div>
            <button class="card-button" onclick="selectFridgeSkin('${skinId}')">
                ${isActive ? '✓ Aktiv' : 'Auswählen'}
            </button>
        `;
        grid.appendChild(card);
    });
}

// ========== TRANSAKTIONEN ==========
function buyMagnet(magnetId, price, series) {
    if (gameState.money < price) {
        alert('Nicht genug Geld! Du hast ' + gameState.money + '€');
        return;
    }
    
    const magnet = gameState.marketMagnets.find(m => m.id === magnetId);
    if (!magnet) return;
    
    gameState.money -= price;
    
    if (!gameState.inventory[series]) {
        gameState.inventory[series] = [];
    }
    
    gameState.inventory[series].push({
        id: magnetId,
        imageData: magnet.imageData
    });
    
    gameState.ownershipCount[series] = (gameState.ownershipCount[series] || 0) + 1;
    
    // Magnet auch auf dem Kühlschrank hinzufügen
    gameState.magnets.push(new Magnet(magnet.imageData, 100 + Math.random() * 200, 100, series));
    
    updateUI();
    draw();
}

function sellMagnet(magnetId, value, series) {
    if (!gameState.inventory[series]) return;
    
    const index = gameState.inventory[series].findIndex(m => m.id === magnetId);
    if (index === -1) return;
    
    gameState.inventory[series].splice(index, 1);
    gameState.money += value;
    gameState.ownershipCount[series] = Math.max(0, (gameState.ownershipCount[series] || 1) - 1);
    
    // Von Kühlschrank entfernen
    gameState.magnets = gameState.magnets.filter(m => m.id !== magnetId);
    
    if (gameState.inventory[series].length === 0) {
        delete gameState.inventory[series];
    }
    
    updateUI();
    draw();
}

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
        if (gameState.magnets[i].contains(mouseX, mouseY) && !fridgeOpen) {
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
        draggedMagnet.dragging = false;
        draggedMagnet = null;
    }
});

// ========== BUTTONS ==========
document.getElementById('toggleDoor').addEventListener('click', () => {
    fridgeOpen = !fridgeOpen;
    draw();
});

document.getElementById('addMagnet').addEventListener('click', () => {
    document.getElementById('imageUpload').click();
});

document.getElementById('imageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const x = Math.random() * (canvas.width - 100) + 50;
            const y = Math.random() * (canvas.height - 100) + 50;
            gameState.magnets.push(new Magnet(event.target.result, x, y, 'Custom'));
            draw();
        };
        reader.readAsDataURL(file);
    }
});

// ========== TAB NAVIGATION ==========
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        
        e.target.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        if (tabName === 'game') {
            draw();
        }
    });
});

// ========== INIT ==========
generateMarketMagnets();
updateUI();
draw();
