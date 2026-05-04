from typing import List, Tuple, Optional
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas

from src.core.feature_map_calculator import LayerInfo
from src.detection.detector import BoundingBox


class Visualizer:
    
    @staticmethod
    def draw_bounding_boxes(
        image: np.ndarray,
        boxes: List[BoundingBox],
        show_labels: bool = True,
        show_confidence: bool = True,
        color: Tuple[int, int, int] = (0, 255, 0)
    ) -> np.ndarray:
        img = Image.fromarray(image.astype(np.uint8))
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype("Arial.ttf", 12)
        except:
            font = ImageFont.load_default()
        
        for box in boxes:
            x1, y1, x2, y2 = box.x1, box.y1, box.x2, box.y2
            
            draw.rectangle([x1, y1, x2, y2], outline=color, width=2)
            
            if show_labels or show_confidence:
                label = ""
                if show_labels:
                    label += box.class_name
                if show_confidence:
                    label += f" {box.confidence:.2f}"
                
                if label:
                    bbox = draw.textbbox((x1, y1), label, font=font)
                    text_width = bbox[2] - bbox[0]
                    text_height = bbox[3] - bbox[1]
                    
                    draw.rectangle([x1, y1 - text_height - 2, x1 + text_width + 4, y1], fill=color)
                    draw.text((x1 + 2, y1 - text_height - 1), label, fill=(0, 0, 0), font=font)
        
        return np.array(img)
    
    @staticmethod
    def draw_receptive_field(
        image: np.ndarray,
        top_left: Tuple[int, int],
        bottom_right: Tuple[int, int],
        color: Tuple[int, int, int] = (255, 0, 0),
        alpha: float = 0.3
    ) -> np.ndarray:
        img = Image.fromarray(image.astype(np.uint8))
        draw = ImageDraw.Draw(img, "RGBA")
        
        t, l = top_left
        b, r = bottom_right
        
        fill_color = (*color, int(alpha * 255))
        draw.rectangle([l, t, r, b], outline=color, fill=fill_color, width=2)
        
        return np.array(img)
    
    @staticmethod
    def draw_feature_map_grid(
        feature_map_size: Tuple[int, int],
        stride: int,
        image_size: Tuple[int, int],
        highlight_positions: Optional[List[Tuple[int, int]]] = None
    ) -> np.ndarray:
        fm_h, fm_w = feature_map_size
        img_h, img_w = image_size
        
        fig, ax = plt.subplots(figsize=(8, 8))
        ax.set_xlim(0, img_w)
        ax.set_ylim(img_h, 0)
        ax.set_aspect('equal')
        
        for y in range(fm_h + 1):
            ax.plot([0, img_w], [y * stride, y * stride], 'k--', alpha=0.3)
        
        for x in range(fm_w + 1):
            ax.plot([x * stride, x * stride], [0, img_h], 'k--', alpha=0.3)
        
        if highlight_positions:
            for fy, fx in highlight_positions:
                cx = fx * stride + stride / 2
                cy = fy * stride + stride / 2
                circle = patches.Circle((cx, cy), stride / 4, color='red', alpha=0.5)
                ax.add_patch(circle)
        
        ax.set_xlabel('Image X')
        ax.set_ylabel('Image Y')
        ax.set_title(f'Feature Map Grid (Size: {fm_w}x{fm_h}, Stride: {stride})')
        
        canvas = FigureCanvas(fig)
        canvas.draw()
        buf = canvas.buffer_rgba()
        img = np.asarray(buf)
        plt.close(fig)
        
        return img
    
    @staticmethod
    def create_nms_comparison_visualization(
        image: np.ndarray,
        raw_boxes: List[BoundingBox],
        nms_boxes: List[BoundingBox],
        suppressed_boxes: List[Tuple[BoundingBox, str]]
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        raw_img = Visualizer.draw_bounding_boxes(
            image, raw_boxes, color=(0, 0, 255)
        )
        
        nms_img = Visualizer.draw_bounding_boxes(
            image, nms_boxes, color=(0, 255, 0)
        )
        
        suppressed_only = [box for box, _ in suppressed_boxes]
        suppressed_img = Visualizer.draw_bounding_boxes(
            image, suppressed_only, color=(255, 165, 0)
        )
        
        return raw_img, nms_img, suppressed_img
    
    @staticmethod
    def plot_layer_info_chart(
        layer_infos: List[LayerInfo],
        metric: str = "output_size"
    ) -> np.ndarray:
        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        
        layer_names = [li.name for li in layer_infos]
        x = np.arange(len(layer_names))
        
        output_h = [li.output_size[0] for li in layer_infos]
        output_w = [li.output_size[1] for li in layer_infos]
        output_c = [li.output_size[2] for li in layer_infos]
        
        axes[0].bar(x - 0.2, output_h, 0.4, label='Height', alpha=0.8)
        axes[0].bar(x + 0.2, output_w, 0.4, label='Width', alpha=0.8)
        axes[0].set_xlabel('Layers')
        axes[0].set_ylabel('Size (pixels)')
        axes[0].set_title('Feature Map Size by Layer')
        axes[0].set_xticks(x)
        axes[0].set_xticklabels(layer_names, rotation=45, ha='right')
        axes[0].legend()
        
        axes[1].bar(x, output_c, color='green', alpha=0.7)
        axes[1].set_xlabel('Layers')
        axes[1].set_ylabel('Channels')
        axes[1].set_title('Number of Channels by Layer')
        axes[1].set_xticks(x)
        axes[1].set_xticklabels(layer_names, rotation=45, ha='right')
        
        rf_h = [li.receptive_field[0] for li in layer_infos]
        rf_w = [li.receptive_field[1] for li in layer_infos]
        
        axes[2].plot(x, rf_h, 'o-', label='RF Height', linewidth=2)
        axes[2].plot(x, rf_w, 's-', label='RF Width', linewidth=2)
        axes[2].set_xlabel('Layers')
        axes[2].set_ylabel('Receptive Field Size (pixels)')
        axes[2].set_title('Receptive Field Growth')
        axes[2].set_xticks(x)
        axes[2].set_xticklabels(layer_names, rotation=45, ha='right')
        axes[2].legend()
        axes[2].grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        canvas = FigureCanvas(fig)
        canvas.draw()
        buf = canvas.buffer_rgba()
        img = np.asarray(buf)
        plt.close(fig)
        
        return img
    
    @staticmethod
    def create_sample_image(
        size: Tuple[int, int] = (224, 224),
        pattern: str = "checkerboard"
    ) -> np.ndarray:
        h, w = size
        img = np.zeros((h, w, 3), dtype=np.uint8)
        
        if pattern == "checkerboard":
            tile_size = 32
            for y in range(h):
                for x in range(w):
                    if (y // tile_size + x // tile_size) % 2 == 0:
                        img[y, x] = [255, 255, 255]
                    else:
                        img[y, x] = [100, 100, 100]
        
        elif pattern == "gradient":
            for y in range(h):
                for x in range(w):
                    r = int(255 * (y / h))
                    g = int(255 * (x / w))
                    b = int(255 * (1 - (y + x) / (h + w)))
                    img[y, x] = [r, g, b]
        
        elif pattern == "shapes":
            img.fill(200)
            img = Image.fromarray(img)
            draw = ImageDraw.Draw(img)
            
            draw.rectangle([50, 50, 120, 120], fill=(255, 0, 0), outline=(0, 0, 0))
            draw.ellipse([150, 80, 200, 130], fill=(0, 255, 0), outline=(0, 0, 0))
            draw.polygon([(30, 150), (80, 180), (50, 200)], fill=(0, 0, 255), outline=(0, 0, 0))
            
            img = np.array(img)
        
        return img
