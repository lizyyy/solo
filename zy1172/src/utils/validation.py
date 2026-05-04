from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict, Any
import re

from src.core.feature_map_calculator import LayerConfig, FeatureMapCalculator


@dataclass
class ValidationMessage:
    level: str  
    message: str
    field: Optional[str] = None
    suggestion: Optional[str] = None


class ParameterValidator:
    
    DEFAULT_CLASS_LABELS = [
        "airplane", "automobile", "bird", "cat", "deer",
        "dog", "frog", "horse", "ship", "truck"
    ]
    
    DEFAULT_DETECTION_LABELS = [
        "person", "bicycle", "car", "motorcycle", "airplane",
        "bus", "train", "truck", "boat", "traffic light"
    ]
    
    @staticmethod
    def validate_input_size(
        size: Tuple[int, int, int]
    ) -> List[ValidationMessage]:
        messages = []
        
        h, w, c = size
        
        if h <= 0 or w <= 0 or c <= 0:
            messages.append(ValidationMessage(
                level="error",
                message="Input dimensions must be positive integers",
                field="input_size",
                suggestion="Try values like (224, 224, 3) for RGB images"
            ))
        
        if h > 2048 or w > 2048:
            messages.append(ValidationMessage(
                level="warning",
                message=f"Input size ({h}x{w}) is quite large, which may cause slow calculations",
                field="input_size",
                suggestion="Consider using smaller sizes like 224x224 or 512x512 for visualization"
            ))
        
        if c not in [1, 3, 4]:
            messages.append(ValidationMessage(
                level="warning",
                message=f"Unusual number of channels: {c}. Typical values are 1 (grayscale), 3 (RGB), or 4 (RGBA)",
                field="input_size",
                suggestion="Most CNN models use 3 channels for RGB images"
            ))
        
        return messages
    
    @staticmethod
    def validate_layer(
        layer: LayerConfig,
        input_size: Tuple[int, int, int],
        layer_index: int
    ) -> List[ValidationMessage]:
        messages = []
        
        if layer.layer_type not in ["conv", "pool", "fc"]:
            messages.append(ValidationMessage(
                level="error",
                message=f"Unknown layer type: {layer.layer_type}",
                field=f"layers[{layer_index}].layer_type",
                suggestion="Use 'conv' for convolutional, 'pool' for pooling, or 'fc' for fully connected layers"
            ))
            return messages
        
        if layer.layer_type in ["conv", "pool"]:
            if layer.kernel_size <= 0:
                messages.append(ValidationMessage(
                    level="error",
                    message=f"Kernel size must be positive, got {layer.kernel_size}",
                    field=f"layers[{layer_index}].kernel_size",
                    suggestion="Common kernel sizes: 1, 3, 5, 7"
                ))
            
            if layer.stride <= 0:
                messages.append(ValidationMessage(
                    level="error",
                    message=f"Stride must be positive, got {layer.stride}",
                    field=f"layers[{layer_index}].stride",
                    suggestion="Common strides: 1 or 2"
                ))
            
            if layer.padding < 0:
                messages.append(ValidationMessage(
                    level="error",
                    message=f"Padding cannot be negative, got {layer.padding}",
                    field=f"layers[{layer_index}].padding",
                    suggestion="Use 'same' padding (padding = kernel//2) to preserve spatial dimensions"
                ))
            
            if layer.dilation <= 0:
                messages.append(ValidationMessage(
                    level="error",
                    message=f"Dilation must be positive, got {layer.dilation}",
                    field=f"layers[{layer_index}].dilation",
                    suggestion="Dilation = 1 is standard; larger values are used in atrous convolutions"
                ))
            
            effective_kernel = layer.kernel_size + (layer.kernel_size - 1) * (layer.dilation - 1)
            if effective_kernel > input_size[0] or effective_kernel > input_size[1]:
                messages.append(ValidationMessage(
                    level="warning",
                    message=f"Effective kernel size ({effective_kernel}x{effective_kernel}) is larger than input size ({input_size[0]}x{input_size[1]})",
                    field=f"layers[{layer_index}].kernel_size",
                    suggestion="The kernel will cover the entire input in one step"
                ))
            
            output_h = FeatureMapCalculator.calculate_output_size(
                input_size[0], layer.kernel_size, layer.stride, layer.padding, layer.dilation
            )
            output_w = FeatureMapCalculator.calculate_output_size(
                input_size[1], layer.kernel_size, layer.stride, layer.padding, layer.dilation
            )
            
            if output_h <= 0 or output_w <= 0:
                messages.append(ValidationMessage(
                    level="error",
                    message=f"Output size would be {output_h}x{output_w}, which is invalid",
                    field=f"layers[{layer_index}]",
                    suggestion=f"Increase padding or decrease stride/kernel size. Current: k={layer.kernel_size}, s={layer.stride}, p={layer.padding}"
                ))
            
            if layer.padding > layer.kernel_size // 2:
                messages.append(ValidationMessage(
                    level="warning",
                    message=f"Padding ({layer.padding}) is larger than kernel/2 ({layer.kernel_size // 2})",
                    field=f"layers[{layer_index}].padding",
                    suggestion="This may cause excessive border artifacts. Consider padding = kernel//2 for 'same' padding"
                ))
            
            if layer.out_channels is not None and layer.out_channels <= 0:
                messages.append(ValidationMessage(
                    level="error",
                    message=f"Output channels must be positive, got {layer.out_channels}",
                    field=f"layers[{layer_index}].out_channels",
                    suggestion="Common channel counts: 32, 64, 128, 256, 512, 1024"
                ))
        
        if layer.layer_type == "fc":
            if layer.out_channels is None or layer.out_channels <= 0:
                messages.append(ValidationMessage(
                    level="error",
                    message="Fully connected layers require output_channels to be specified",
                    field=f"layers[{layer_index}].out_channels",
                    suggestion="Set output_channels to the number of classes or desired feature dimension"
                ))
        
        return messages
    
    @staticmethod
    def validate_layers(
        layers: List[LayerConfig],
        input_size: Tuple[int, int, int]
    ) -> List[ValidationMessage]:
        messages = []
        
        if not layers:
            messages.append(ValidationMessage(
                level="warning",
                message="No layers specified",
                field="layers",
                suggestion="Add at least one layer to create a network"
            ))
            return messages
        
        current_size = input_size
        
        for i, layer in enumerate(layers):
            layer_messages = ParameterValidator.validate_layer(layer, current_size, i)
            messages.extend(layer_messages)
            
            has_error = any(m.level == "error" for m in layer_messages)
            if not has_error and layer.layer_type in ["conv", "pool"]:
                output_h = FeatureMapCalculator.calculate_output_size(
                    current_size[0], layer.kernel_size, layer.stride, layer.padding, layer.dilation
                )
                output_w = FeatureMapCalculator.calculate_output_size(
                    current_size[1], layer.kernel_size, layer.stride, layer.padding, layer.dilation
                )
                output_c = layer.out_channels if layer.out_channels is not None else current_size[2]
                current_size = (output_h, output_w, output_c)
            
            elif layer.layer_type == "fc":
                output_c = layer.out_channels if layer.out_channels is not None else current_size[2]
                current_size = (1, 1, output_c)
        
        if current_size[0] <= 0 or current_size[1] <= 0:
            messages.append(ValidationMessage(
                level="error",
                message=f"Final output size is invalid: {current_size}",
                field="layers",
                suggestion="Review your network architecture - the feature map becomes too small"
            ))
        
        return messages
    
    @staticmethod
    def validate_anchor_config(
        ratios: List[float],
        scales: List[float],
        base_size: int
    ) -> List[ValidationMessage]:
        messages = []
        
        if not ratios:
            messages.append(ValidationMessage(
                level="error",
                message="No anchor ratios specified",
                field="anchor_ratios",
                suggestion="Common ratios: [0.5, 1.0, 2.0]"
            ))
        
        for i, r in enumerate(ratios):
            if r <= 0:
                messages.append(ValidationMessage(
                    level="error",
                    message=f"Anchor ratio must be positive, got {r}",
                    field=f"anchor_ratios[{i}]",
                    suggestion="Use positive values like 0.5, 1.0, or 2.0"
                ))
        
        if not scales:
            messages.append(ValidationMessage(
                level="error",
                message="No anchor scales specified",
                field="anchor_scales",
                suggestion="Common scales: [1.0, 2.0, 4.0] or [8.0, 16.0, 32.0]"
            ))
        
        for i, s in enumerate(scales):
            if s <= 0:
                messages.append(ValidationMessage(
                    level="error",
                    message=f"Anchor scale must be positive, got {s}",
                    field=f"anchor_scales[{i}]",
                    suggestion="Use positive values"
                ))
        
        if base_size <= 0:
            messages.append(ValidationMessage(
                level="error",
                message=f"Base size must be positive, got {base_size}",
                field="base_size",
                suggestion="Common base sizes: 16 (for 16x stride) or 32"
            ))
        
        return messages
    
    @staticmethod
    def validate_nms_params(
        iou_threshold: float,
        confidence_threshold: float
    ) -> List[ValidationMessage]:
        messages = []
        
        if iou_threshold <= 0 or iou_threshold >= 1:
            messages.append(ValidationMessage(
                level="warning",
                message=f"IoU threshold {iou_threshold} is outside typical range (0.3-0.7)",
                field="iou_threshold",
                suggestion="Typical values: 0.4, 0.5, or 0.7"
            ))
        
        if confidence_threshold < 0 or confidence_threshold > 1:
            messages.append(ValidationMessage(
                level="error",
                message=f"Confidence threshold must be between 0 and 1, got {confidence_threshold}",
                field="confidence_threshold",
                suggestion="Use values like 0.25, 0.5, or 0.7"
            ))
        
        if confidence_threshold >= 0.9:
            messages.append(ValidationMessage(
                level="warning",
                message=f"High confidence threshold ({confidence_threshold}) may filter out most detections",
                field="confidence_threshold",
                suggestion="Consider a lower threshold if you want more detections"
            ))
        
        return messages
    
    @staticmethod
    def validate_class_labels(
        labels: List[str],
        workflow_type: str
    ) -> List[ValidationMessage]:
        messages = []
        
        if not labels:
            messages.append(ValidationMessage(
                level="error",
                message="No class labels specified",
                field="class_labels",
                suggestion=f"At least 2 classes are needed for {workflow_type}"
            ))
            return messages
        
        if len(labels) < 2:
            messages.append(ValidationMessage(
                level="warning",
                message=f"Only {len(labels)} class specified. Most models need at least 2 classes",
                field="class_labels",
                suggestion="Add more classes or use background + 1 object class"
            ))
        
        seen = set()
        for i, label in enumerate(labels):
            if not label.strip():
                messages.append(ValidationMessage(
                    level="error",
                    message=f"Empty class label at index {i}",
                    field=f"class_labels[{i}]",
                    suggestion="Provide a valid class name"
                ))
            
            if label in seen:
                messages.append(ValidationMessage(
                    level="error",
                    message=f"Duplicate class label: '{label}'",
                    field=f"class_labels",
                    suggestion="Each class should have a unique name"
                ))
            seen.add(label)
        
        return messages
    
    @staticmethod
    def format_messages(messages: List[ValidationMessage]) -> Dict[str, List[Dict[str, str]]]:
        result = {"errors": [], "warnings": [], "infos": []}
        
        for msg in messages:
            entry = {
                "message": msg.message,
                "field": msg.field or "",
                "suggestion": msg.suggestion or ""
            }
            
            if msg.level == "error":
                result["errors"].append(entry)
            elif msg.level == "warning":
                result["warnings"].append(entry)
            else:
                result["infos"].append(entry)
        
        return result
