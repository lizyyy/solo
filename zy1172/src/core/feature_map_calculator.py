from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict
import numpy as np


@dataclass
class LayerConfig:
    layer_type: str  
    kernel_size: int = 3
    stride: int = 1
    padding: int = 0
    dilation: int = 1
    out_channels: Optional[int] = None
    name: str = ""
    
    def __post_init__(self):
        if not self.name:
            if self.layer_type == "conv":
                self.name = f"Conv_{self.kernel_size}x{self.kernel_size}"
            elif self.layer_type == "pool":
                self.name = f"Pool_{self.kernel_size}x{self.kernel_size}"
            elif self.layer_type == "fc":
                self.name = "FC"
            else:
                self.name = self.layer_type


@dataclass
class LayerInfo:
    name: str
    layer_type: str
    config: LayerConfig
    input_size: Tuple[int, int, int]  
    output_size: Tuple[int, int, int]  
    receptive_field: Tuple[int, int]  
    receptive_field_start: Tuple[int, int]  
    layer_index: int


class FeatureMapCalculator:
    
    @staticmethod
    def calculate_output_size(
        input_size: int,
        kernel_size: int,
        stride: int,
        padding: int,
        dilation: int = 1
    ) -> int:
        effective_kernel = kernel_size + (kernel_size - 1) * (dilation - 1)
        return int(np.floor((input_size + 2 * padding - effective_kernel) / stride)) + 1
    
    @staticmethod
    def calculate_receptive_field(
        layers: List[LayerConfig],
        input_size: Tuple[int, int, int]
    ) -> List[LayerInfo]:
        layer_infos = []
        
        current_h, current_w, current_c = input_size
        current_rf_h = 1
        current_rf_w = 1
        current_start_h = 0.5  
        current_start_w = 0.5
        
        for i, layer in enumerate(layers):
            input_h, input_w = current_h, current_w
            input_start_h, input_start_w = current_start_h, current_start_w
            
            if layer.layer_type in ["conv", "pool"]:
                output_h = FeatureMapCalculator.calculate_output_size(
                    input_h, layer.kernel_size, layer.stride, layer.padding, layer.dilation
                )
                output_w = FeatureMapCalculator.calculate_output_size(
                    input_w, layer.kernel_size, layer.stride, layer.padding, layer.dilation
                )
                output_c = layer.out_channels if layer.out_channels is not None else current_c
                
                effective_kernel = layer.kernel_size + (layer.kernel_size - 1) * (layer.dilation - 1)
                new_rf_h = current_rf_h + (effective_kernel - 1) * (1 if i == 0 else layer.stride)
                new_rf_w = current_rf_w + (effective_kernel - 1) * (1 if i == 0 else layer.stride)
                
                new_start_h = current_start_h + ((effective_kernel - 1) / 2 - layer.padding) * (1 if i == 0 else layer.stride)
                new_start_w = current_start_w + ((effective_kernel - 1) / 2 - layer.padding) * (1 if i == 0 else layer.stride)
                
            elif layer.layer_type == "fc":
                output_h = 1
                output_w = 1
                output_c = layer.out_channels if layer.out_channels is not None else current_c
                
                new_rf_h = input_h
                new_rf_w = input_w
                new_start_h = 0
                new_start_w = 0
                
            else:
                output_h, output_w, output_c = current_h, current_w, current_c
                new_rf_h, new_rf_w = current_rf_h, current_rf_w
                new_start_h, new_start_w = current_start_h, current_start_w
            
            layer_info = LayerInfo(
                name=layer.name,
                layer_type=layer.layer_type,
                config=layer,
                input_size=(input_h, input_w, current_c),
                output_size=(output_h, output_w, output_c),
                receptive_field=(int(current_rf_h), int(current_rf_w)),
                receptive_field_start=(current_start_h, current_start_w),
                layer_index=i
            )
            
            layer_infos.append(layer_info)
            
            current_h, current_w, current_c = output_h, output_w, output_c
            current_rf_h, current_rf_w = new_rf_h, new_rf_w
            current_start_h, current_start_w = new_start_h, new_start_w
        
        return layer_infos
    
    @staticmethod
    def get_feature_map_position(
        layer_info: LayerInfo,
        feature_y: int,
        feature_x: int
    ) -> Tuple[Tuple[int, int], Tuple[int, int]]:
        rf_h, rf_w = layer_info.receptive_field
        start_h, start_w = layer_info.receptive_field_start
        stride = layer_info.config.stride
        
        top = int(start_h + feature_y * stride)
        left = int(start_w + feature_x * stride)
        bottom = top + rf_h - 1
        right = left + rf_w - 1
        
        return (top, left), (bottom, right)
    
    @staticmethod
    def validate_layer(layer: LayerConfig, input_size: Tuple[int, int, int]) -> Tuple[bool, List[str]]:
        errors = []
        warnings = []
        
        if layer.layer_type in ["conv", "pool"]:
            if layer.kernel_size <= 0:
                errors.append(f"Kernel size must be positive, got {layer.kernel_size}")
            
            if layer.stride <= 0:
                errors.append(f"Stride must be positive, got {layer.stride}")
            
            if layer.padding < 0:
                errors.append(f"Padding cannot be negative, got {layer.padding}")
            
            if layer.dilation <= 0:
                errors.append(f"Dilation must be positive, got {layer.dilation}")
            
            effective_kernel = layer.kernel_size + (layer.kernel_size - 1) * (layer.dilation - 1)
            if effective_kernel > input_size[0] or effective_kernel > input_size[1]:
                warnings.append(f"Kernel size ({effective_kernel}x{effective_kernel}) is larger than input size ({input_size[0]}x{input_size[1]})")
            
            output_h = FeatureMapCalculator.calculate_output_size(
                input_size[0], layer.kernel_size, layer.stride, layer.padding, layer.dilation
            )
            output_w = FeatureMapCalculator.calculate_output_size(
                input_size[1], layer.kernel_size, layer.stride, layer.padding, layer.dilation
            )
            
            if output_h <= 0 or output_w <= 0:
                errors.append(f"Output size would be {output_h}x{output_w}, which is invalid")
            
            if layer.padding > layer.kernel_size // 2:
                warnings.append(f"Padding ({layer.padding}) is larger than kernel/2 ({layer.kernel_size // 2}), which may cause excessive padding")
        
        return len(errors) == 0, errors + [f"Warning: {w}" for w in warnings]
