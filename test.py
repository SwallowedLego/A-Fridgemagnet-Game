import pygame
import os
from PIL import Image

pygame.init()

WIDTH, HEIGHT = 1000, 700
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Kühlschrank Magnet Spiel")
clock = pygame.time.Clock()

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (200, 200, 200)
LIGHT_GRAY = (220, 220, 220)

class Magnet:
    def __init__(self, image_path, x, y):
        self.image = pygame.image.load(image_path)
        self.image = pygame.transform.scale(self.image, (80, 80))
        self.rect = self.image.get_rect(topleft=(x, y))
        self.dragging = False
    
    def draw(self, surface):
        surface.blit(self.image, self.rect)
    
    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            if self.rect.collidepoint(event.pos):
                self.dragging = True
        elif event.type == pygame.MOUSEBUTTONUP:
            self.dragging = False
        elif event.type == pygame.MOUSEMOTION and self.dragging:
            self.rect.x += event.rel[0]
            self.rect.y += event.rel[1]

class SkinSelector:
    def __init__(self, x, y):
        self.position = (x, y)
        self.skins = []
        self.selected_skin = None
        self.load_skins()
        self.icon_size = 80
        self.button_width = 60
        self.button_height = 30
        self.spacing = 20
    
    def load_skins(self):
        """Lade alle verfügbaren Kühlschrank Skins"""
        base_dir = os.path.dirname(__file__)
        fridge_dirs = ["Fridges - Green", "Fridges - White"]
        
        for fridge_dir in fridge_dirs:
            dir_path = os.path.join(base_dir, fridge_dir)
            if os.path.exists(dir_path):
                # Finde alle Fridge X - Empty.png Dateien
                for file in sorted(os.listdir(dir_path)):
                    if "Empty" in file and file.endswith(".png"):
                        fridge_num = file.split()[1]  # z.B. "1", "2", etc.
                        
                        closed_path = os.path.join(dir_path, file)
                        # Finde die entsprechende offene Variante
                        open_file = f"Fridge {fridge_num}.png"
                        open_path = os.path.join(dir_path, open_file)
                        
                        if os.path.exists(open_path):
                            try:
                                self.skins.append({
                                    'name': f"{fridge_dir.split()[-1]} - Fridge {fridge_num}",
                                    'closed': closed_path,
                                    'open': open_path,
                                    'dir': fridge_dir
                                })
                            except:
                                pass
    
    def draw(self, surface):
        # Bereich für Skin Selector
        selector_height = self.icon_size + 2 * self.spacing
        pygame.draw.rect(surface, LIGHT_GRAY, (self.position[0], self.position[1], WIDTH - self.position[0] - 20, selector_height))
        pygame.draw.rect(surface, BLACK, (self.position[0], self.position[1], WIDTH - self.position[0] - 20, selector_height), 2)
        
        # Zeichne Skins
        x_offset = self.position[0] + self.spacing
        for i, skin in enumerate(self.skins):
            # Lade und skaliere Icon
            try:
                icon = pygame.image.load(skin['closed'])
                icon = pygame.transform.scale(icon, (self.icon_size, self.icon_size))
                surface.blit(icon, (x_offset, self.position[1] + self.spacing))
                
                # Select Button
                button_rect = pygame.Rect(
                    x_offset,
                    self.position[1] + self.spacing + self.icon_size + 5,
                    self.button_width,
                    self.button_height
                )
                
                if self.selected_skin == i:
                    pygame.draw.rect(surface, (100, 200, 100), button_rect)
                else:
                    pygame.draw.rect(surface, GRAY, button_rect)
                
                pygame.draw.rect(surface, BLACK, button_rect, 2)
                
                # Button Text
                font = pygame.font.Font(None, 16)
                text = font.render("Select", True, BLACK)
                text_rect = text.get_rect(center=button_rect.center)
                surface.blit(text, text_rect)
                
            except:
                pass
            
            x_offset += self.icon_size + self.spacing
    
    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            x_offset = self.position[0] + self.spacing
            for i, skin in enumerate(self.skins):
                button_rect = pygame.Rect(
                    x_offset,
                    self.position[1] + self.spacing + self.icon_size + 5,
                    self.button_width,
                    self.button_height
                )
                
                if button_rect.collidepoint(event.pos):
                    self.selected_skin = i
                    return i  # Return selected skin index
                
                x_offset += self.icon_size + self.spacing
        
        return None
    
    def get_selected_skin(self):
        if self.selected_skin is not None and self.selected_skin < len(self.skins):
            return self.skins[self.selected_skin]
        return None

class Fridge:
    def __init__(self, skin=None):
        self.is_open = False
        self.magnets = []
        self.position = (50, 150)
        
        if skin:
            self.closed_image = pygame.image.load(skin['closed'])
            self.open_image = pygame.image.load(skin['open'])
        else:
            # Default Fallback
            base_dir = os.path.dirname(__file__)
            fridge_closed_path = os.path.join(base_dir, "Fridges - Green", "Fridge 1 - Empty.png")
            fridge_open_path = os.path.join(base_dir, "Fridges - Green", "Fridge 1.png")
            
            try:
                self.closed_image = pygame.image.load(fridge_closed_path)
                self.open_image = pygame.image.load(fridge_open_path)
            except:
                self.closed_image = pygame.Surface((350, 450))
                self.closed_image.fill((150, 150, 200))
                self.open_image = pygame.Surface((350, 450))
                self.open_image.fill((100, 100, 150))
    
    def set_skin(self, skin):
        """Ändere den Skin des Kühlschranks"""
        if skin:
            self.closed_image = pygame.image.load(skin['closed'])
            self.open_image = pygame.image.load(skin['open'])
    
    def draw(self, surface):
        if not self.is_open:
            surface.blit(self.closed_image, self.position)
            # Magneten zeichnen
            for magnet in self.magnets:
                magnet.draw(surface)
        else:
            # Tür offen - zeige offene Grafik
            surface.blit(self.open_image, self.position)
            # Essen/Items werden hier angezeigt
    
    def toggle_door(self):
        self.is_open = not self.is_open

# Spiel-Variablen
skin_selector = SkinSelector(450, 10)
fridge = Fridge()

# Test-Magnet
# fridge.magnets.append(Magnet("path/to/image.png", 100, 100))

# UI für Knopf
button_rect = pygame.Rect(500, 600, 150, 50)

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.MOUSEBUTTONDOWN:
            if button_rect.collidepoint(event.pos):
                fridge.toggle_door()
            
            # Skin Selector
            selected = skin_selector.handle_event(event)
            if selected is not None:
                skin = skin_selector.get_selected_skin()
                fridge.set_skin(skin)
        
        for magnet in fridge.magnets:
            magnet.handle_event(event)
    
    screen.fill(WHITE)
    
    # Skin Selector zeichnen
    skin_selector.draw(screen)
    
    # Fridge zeichnen
    fridge.draw(screen)
    
    # Button zeichnen
    pygame.draw.rect(screen, (50, 150, 50), button_rect)
    font = pygame.font.Font(None, 24)
    text = font.render("Tür öffnen", True, WHITE)
    screen.blit(text, (button_rect.x + 10, button_rect.y + 15))
    
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
