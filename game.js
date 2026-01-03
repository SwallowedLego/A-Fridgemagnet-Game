const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Spielvariablen
let fridgeOpen = false;
let magnets = [];
let draggedMagnet = null;

// Kühlschrank Eigenschaften
const fridge = {
    x: 50,
    y: 50,
    width: 350,
    height: 450,
    closedColor: '#96a6c8',
    openColor: '#6474a0'
};

// Magnet Klasse
class Magnet {
    constructor(image, x, y) {
        this.image = image;
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 80;
        this.dragging = false;
    }

    draw() {
        if (!fridgeOpen) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        }
    }

    contains(mouseX, mouseY) {
        return mouseX >= this.x && mouseX <= this.x + this.width &&
               mouseY >= this.y && mouseY <= this.y + this.height;
    }
}

// Kühlschrank zeichnen
function drawFridge() {
    const color = fridgeOpen ? fridge.openColor : fridge.closedColor;
    
    // Kühlschrank Körper
    ctx.fillStyle = color;
    ctx.fillRect(fridge.x, fridge.y, fridge.width, fridge.height);
    
    // Rahmen
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.strokeRect(fridge.x, fridge.y, fridge.width, fridge.height);
    
    // Türgriff
    if (!fridgeOpen) {
        ctx.fillStyle = '#333';
        ctx.fillRect(fridge.x + fridge.width - 20, fridge.y + fridge.height / 2 - 40, 10, 80);
    }
    
    // Innenansicht wenn offen
    if (fridgeOpen) {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(fridge.x + 20, fridge.y + 20, fridge.width - 40, fridge.height - 40);
        
        // Regale
        ctx.fillStyle = '#ccc';
        for (let i = 1; i < 4; i++) {
            const y = fridge.y + (fridge.height / 4) * i;
            ctx.fillRect(fridge.x + 20, y, fridge.width - 40, 3);
        }
        
        ctx.fillStyle = '#333';
        ctx.font = '20px Arial';
        ctx.fillText('Innenansicht', fridge.x + 100, fridge.y + fridge.height / 2);
    }
}

// Zeichne alles
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Hintergrund
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Kühlschrank
    drawFridge();
    
    // Magneten (nur wenn Tür zu ist)
    magnets.forEach(magnet => magnet.draw());
}

// Event Listeners
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Prüfe ob ein Magnet angeklickt wurde
    for (let i = magnets.length - 1; i >= 0; i--) {
        if (magnets[i].contains(mouseX, mouseY) && !fridgeOpen) {
            draggedMagnet = magnets[i];
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

// Button Events
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
            const img = new Image();
            img.onload = () => {
                const x = Math.random() * (canvas.width - 100) + 50;
                const y = Math.random() * (canvas.height - 100) + 50;
                magnets.push(new Magnet(img, x, y));
                draw();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Erste Zeichnung
draw();
