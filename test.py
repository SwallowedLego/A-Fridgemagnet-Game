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

class Fridge:
    def __init__(self):
        self.is_open = False
        # Lade echte Kühlschrank Sprites
        fridge_closed_path = os.path.join(os.path.dirname(__file__), "Fridges - Green", "Fridge 1 - Empty.png")
        fridge_open_path = os.path.join(os.path.dirname(__file__), "Fridges - Green", "Fridge 1.png")
        
        try:
            self.closed_image = pygame.image.load(fridge_closed_path)
            self.open_image = pygame.image.load(fridge_open_path)
        except:
            # Fallback wenn Bilder nicht gefunden
            self.closed_image = pygame.Surface((350, 450))
            self.closed_image.fill((150, 150, 200))
            self.open_image = pygame.Surface((350, 450))
            self.open_image.fill((100, 100, 150))
        
        self.magnets = []
        self.position = (50, 50)
    
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
fridge = Fridge()

# Test-Magnet
# fridge.magnets.append(Magnet("path/to/image.png", 100, 100))

# UI für Knopf
button_rect = pygame.Rect(500, 100, 150, 50)

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.MOUSEBUTTONDOWN:
            if button_rect.collidepoint(event.pos):
                fridge.toggle_door()
        
        for magnet in fridge.magnets:
            magnet.handle_event(event)
    
    screen.fill(WHITE)
    fridge.draw(screen)
    
    # Button zeichnen
    pygame.draw.rect(screen, (50, 150, 50), button_rect)
    font = pygame.font.Font(None, 24)
    text = font.render("Tür öffnen", True, WHITE)
    screen.blit(text, (button_rect.x + 10, button_rect.y + 15))
    
    pygame.display.flip()
    clock.tick(60)

pygame.quit()