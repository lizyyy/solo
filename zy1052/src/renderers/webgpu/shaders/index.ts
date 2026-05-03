export const textureUtilsShader = `
fn getRGBA(tex: texture_2d<f32>, samp: sampler, coord: vec2<f32>) -> vec4<f32> {
  return textureSample(tex, samp, coord);
}

fn getRGBAatIndex(data: array<vec4<f32>>, width: u32, x: u32, y: u32) -> vec4<f32> {
  let idx = y * width + x;
  return data[idx];
}

fn toSRGB(linear: f32) -> f32 {
  if (linear <= 0.0031308) {
    return 12.92 * linear;
  } else {
    return 1.055 * pow(linear, 1.0 / 2.4) - 0.055;
  }
}

fn toLinear(srgb: f32) -> f32 {
  if (srgb <= 0.04045) {
    return srgb / 12.92;
  } else {
    return pow((srgb + 0.055) / 1.055, 2.4);
  }
}

fn clamp01(v: f32) -> f32 {
  return clamp(v, 0.0, 1.0);
}
`

export const grayscaleShader = `
struct GrayscaleParams {
  method: u32,
  intensity: f32,
}

@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: GrayscaleParams;
@group(0) @binding(3) var outputTex: texture_storage_2d<rgba8unorm, write>;

fn calculateGray(color: vec4<f32>, method: u32) -> f32 {
  switch (method) {
    case 0u: {
      return (color.r + color.g + color.b) / 3.0;
    }
    case 1u: {
      return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
    }
    case 2u: {
      let maxVal = max(max(color.r, color.g), color.b);
      let minVal = min(min(color.r, color.g), color.b);
      return (maxVal + minVal) / 2.0;
    }
    default: {
      return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
    }
  }
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let size = textureDimensions(inputTex);
  let outputSize = textureDimensions(outputTex);
  
  if (global_id.x >= outputSize.x || global_id.y >= outputSize.y) {
    return;
  }
  
  let texCoord = vec2<f32>(
    (f32(global_id.x) + 0.5) / f32(size.x),
    (f32(global_id.y) + 0.5) / f32(size.y)
  );
  
  var color = textureSample(inputTex, inputSampler, texCoord);
  
  let gray = calculateGray(color, params.method);
  let grayColor = vec4<f32>(gray, gray, gray, color.a);
  
  var result = mix(color, grayColor, params.intensity);
  result = clamp(result, 0.0, 1.0);
  
  textureStore(outputTex, vec2<i32>(global_id.xy), result);
}
`

export const levelsShader = `
struct LevelsParams {
  inputBlack: f32,
  inputWhite: f32,
  gamma: f32,
  outputBlack: f32,
  outputWhite: f32,
  padding: vec2<f32>,
}

@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: LevelsParams;
@group(0) @binding(3) var outputTex: texture_storage_2d<rgba8unorm, write>;

fn applyLevels(channel: f32, inputBlack: f32, inputWhite: f32, gamma: f32, outputBlack: f32, outputWhite: f32) -> f32 {
  let inputRange = inputWhite - inputBlack;
  let outputRange = outputWhite - outputBlack;
  
  var value = (channel - inputBlack) / inputRange;
  value = clamp(value, 0.0, 1.0);
  
  value = pow(value, 1.0 / gamma);
  
  value = value * outputRange + outputBlack;
  
  return clamp(value, 0.0, 1.0);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let size = textureDimensions(inputTex);
  let outputSize = textureDimensions(outputTex);
  
  if (global_id.x >= outputSize.x || global_id.y >= outputSize.y) {
    return;
  }
  
  let texCoord = vec2<f32>(
    (f32(global_id.x) + 0.5) / f32(size.x),
    (f32(global_id.y) + 0.5) / f32(size.y)
  );
  
  var color = textureSample(inputTex, inputSampler, texCoord);
  
  let inputBlack = params.inputBlack / 255.0;
  let inputWhite = params.inputWhite / 255.0;
  let outputBlack = params.outputBlack / 255.0;
  let outputWhite = params.outputWhite / 255.0;
  
  var result = vec4<f32>(
    applyLevels(color.r, inputBlack, inputWhite, params.gamma, outputBlack, outputWhite),
    applyLevels(color.g, inputBlack, inputWhite, params.gamma, outputBlack, outputWhite),
    applyLevels(color.b, inputBlack, inputWhite, params.gamma, outputBlack, outputWhite),
    color.a
  );
  
  textureStore(outputTex, vec2<i32>(global_id.xy), result);
}
`

export const cropShader = `
struct CropParams {
  srcX: u32,
  srcY: u32,
  dstWidth: u32,
  dstHeight: u32,
}

@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: CropParams;
@group(0) @binding(3) var outputTex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let outputSize = textureDimensions(outputTex);
  
  if (global_id.x >= outputSize.x || global_id.y >= outputSize.y) {
    return;
  }
  
  let srcX = f32(params.srcX + global_id.x);
  let srcY = f32(params.srcY + global_id.y);
  
  let inputSize = textureDimensions(inputTex);
  
  if (srcX >= f32(inputSize.x) || srcY >= f32(inputSize.y)) {
    textureStore(outputTex, vec2<i32>(global_id.xy), vec4<f32>(0.0, 0.0, 0.0, 1.0));
    return;
  }
  
  let texCoord = vec2<f32>(
    (srcX + 0.5) / f32(inputSize.x),
    (srcY + 0.5) / f32(inputSize.y)
  );
  
  let color = textureSample(inputTex, inputSampler, texCoord);
  
  textureStore(outputTex, vec2<i32>(global_id.xy), color);
}
`

export const resizeShader = `
struct ResizeParams {
  srcWidth: u32,
  srcHeight: u32,
  dstWidth: u32,
  dstHeight: u32,
  mode: u32,
}

@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: ResizeParams;
@group(0) @binding(3) var outputTex: texture_storage_2d<rgba8unorm, write>;

fn sampleNearest(texCoord: vec2<f32>) -> vec4<f32> {
  return textureSample(inputTex, inputSampler, texCoord);
}

fn sampleBilinear(texCoord: vec2<f32>) -> vec4<f32> {
  let size = textureDimensions(inputTex);
  let srcX = texCoord.x * f32(size.x) - 0.5;
  let srcY = texCoord.y * f32(size.y) - 0.5;
  
  let x0 = u32(floor(srcX));
  let y0 = u32(floor(srcY));
  let x1 = x0 + 1u;
  let y1 = y0 + 1u;
  
  let fx = srcX - floor(srcX);
  let fy = srcY - floor(srcY);
  
  let coord00 = vec2<f32>(
    (f32(x0) + 0.5) / f32(size.x),
    (f32(y0) + 0.5) / f32(size.y)
  );
  let coord10 = vec2<f32>(
    (f32(x1) + 0.5) / f32(size.x),
    (f32(y0) + 0.5) / f32(size.y)
  );
  let coord01 = vec2<f32>(
    (f32(x0) + 0.5) / f32(size.x),
    (f32(y1) + 0.5) / f32(size.y)
  );
  let coord11 = vec2<f32>(
    (f32(x1) + 0.5) / f32(size.x),
    (f32(y1) + 0.5) / f32(size.y)
  );
  
  let c00 = textureSample(inputTex, inputSampler, coord00);
  let c10 = textureSample(inputTex, inputSampler, coord10);
  let c01 = textureSample(inputTex, inputSampler, coord01);
  let c11 = textureSample(inputTex, inputSampler, coord11);
  
  let c0 = mix(c00, c10, fx);
  let c1 = mix(c01, c11, fx);
  
  return mix(c0, c1, fy);
}

fn cubicWeight(t: f32) -> f32 {
  let abs_t = abs(t);
  if (abs_t <= 1.0) {
    return 1.5 * abs_t * abs_t * abs_t - 2.5 * abs_t * abs_t + 1.0;
  } else if (abs_t <= 2.0) {
    return -0.5 * abs_t * abs_t * abs_t + 2.5 * abs_t * abs_t - 4.0 * abs_t + 2.0;
  } else {
    return 0.0;
  }
}

fn sampleBicubic(texCoord: vec2<f32>) -> vec4<f32> {
  let size = textureDimensions(inputTex);
  let srcX = texCoord.x * f32(size.x) - 0.5;
  let srcY = texCoord.y * f32(size.y) - 0.5;
  
  let centerX = floor(srcX);
  let centerY = floor(srcY);
  
  var result = vec4<f32>(0.0);
  var totalWeight = 0.0;
  
  for (var dy = -2; dy <= 2; dy++) {
    let y = centerY + f32(dy);
    let weightY = cubicWeight(srcY - y);
    
    for (var dx = -2; dx <= 2; dx++) {
      let x = centerX + f32(dx);
      let weightX = cubicWeight(srcX - x);
      let weight = weightX * weightY;
      
      let clampedX = clamp(x, 0.0, f32(size.x) - 1.0);
      let clampedY = clamp(y, 0.0, f32(size.y) - 1.0);
      
      let coord = vec2<f32>(
        (clampedX + 0.5) / f32(size.x),
        (clampedY + 0.5) / f32(size.y)
      );
      
      let color = textureSample(inputTex, inputSampler, coord);
      result += color * weight;
      totalWeight += weight;
    }
  }
  
  if (totalWeight > 0.0) {
    result = result / totalWeight;
  }
  
  return clamp(result, 0.0, 1.0);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let outputSize = textureDimensions(outputTex);
  
  if (global_id.x >= outputSize.x || global_id.y >= outputSize.y) {
    return;
  }
  
  let texCoord = vec2<f32>(
    (f32(global_id.x) + 0.5) / f32(outputSize.x),
    (f32(global_id.y) + 0.5) / f32(outputSize.y)
  );
  
  var color: vec4<f32>;
  
  switch (params.mode) {
    case 0u: {
      color = sampleNearest(texCoord);
    }
    case 1u: {
      color = sampleBilinear(texCoord);
    }
    case 2u: {
      color = sampleBicubic(texCoord);
    }
    default: {
      color = sampleBilinear(texCoord);
    }
  }
  
  textureStore(outputTex, vec2<i32>(global_id.xy), color);
}
`

export const mosaicShader = `
struct MosaicParams {
  blockSize: u32,
  method: u32,
  regionX: u32,
  regionY: u32,
  regionWidth: u32,
  regionHeight: u32,
}

@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: MosaicParams;
@group(0) @binding(3) var outputTex: texture_storage_2d<rgba8unorm, write>;

fn isInRegion(x: u32, y: u32, size: vec2<u32>) -> bool {
  if (params.regionWidth == 0u && params.regionHeight == 0u) {
    return true;
  }
  
  let regionW = select(params.regionWidth, size.x - params.regionX, params.regionWidth == 0u);
  let regionH = select(params.regionHeight, size.y - params.regionY, params.regionHeight == 0u);
  
  return x >= params.regionX && 
         y >= params.regionY && 
         x < params.regionX + regionW && 
         y < params.regionY + regionH;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let size = textureDimensions(inputTex);
  let outputSize = textureDimensions(outputTex);
  
  if (global_id.x >= outputSize.x || global_id.y >= outputSize.y) {
    return;
  }
  
  if (!isInRegion(global_id.x, global_id.y, size)) {
    let texCoord = vec2<f32>(
      (f32(global_id.x) + 0.5) / f32(size.x),
      (f32(global_id.y) + 0.5) / f32(size.y)
    );
    let color = textureSample(inputTex, inputSampler, texCoord);
    textureStore(outputTex, vec2<i32>(global_id.xy), color);
    return;
  }
  
  let blockX = (global_id.x / params.blockSize) * params.blockSize;
  let blockY = (global_id.y / params.blockSize) * params.blockSize;
  
  var blockColor = vec4<f32>(0.0);
  var count = 0.0;
  var maxColor = vec4<f32>(-1.0);
  var minColor = vec4<f32>(2.0);
  
  for (var dy = 0u; dy < params.blockSize && blockY + dy < size.y; dy++) {
    for (var dx = 0u; dx < params.blockSize && blockX + dx < size.x; dx++) {
      let texCoord = vec2<f32>(
        (f32(blockX + dx) + 0.5) / f32(size.x),
        (f32(blockY + dy) + 0.5) / f32(size.y)
      );
      let color = textureSample(inputTex, inputSampler, texCoord);
      
      blockColor += color;
      count += 1.0;
      
      maxColor = max(maxColor, color);
      minColor = min(minColor, color);
    }
  }
  
  var resultColor: vec4<f32>;
  
  switch (params.method) {
    case 0u: {
      resultColor = blockColor / count;
    }
    case 1u: {
      let centerX = blockX + params.blockSize / 2u;
      let centerY = blockY + params.blockSize / 2u;
      let texCoord = vec2<f32>(
        (f32(min(centerX, size.x - 1u)) + 0.5) / f32(size.x),
        (f32(min(centerY, size.y - 1u)) + 0.5) / f32(size.y)
      );
      resultColor = textureSample(inputTex, inputSampler, texCoord);
    }
    case 2u: {
      resultColor = maxColor;
    }
    case 3u: {
      resultColor = minColor;
    }
    default: {
      resultColor = blockColor / count;
    }
  }
  
  textureStore(outputTex, vec2<i32>(global_id.xy), resultColor);
}
`

export const sharpenShader = `
struct SharpenParams {
  amount: f32,
  radius: u32,
  threshold: f32,
  padding: f32,
}

@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: SharpenParams;
@group(0) @binding(3) var outputTex: texture_storage_2d<rgba8unorm, write>;

fn gaussianWeight(dx: i32, dy: i32, sigma: f32) -> f32 {
  let sigma2 = sigma * sigma;
  return exp(-f32(dx * dx + dy * dy) / (2.0 * sigma2)) / (2.0 * 3.14159265 * sigma2);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let size = textureDimensions(inputTex);
  let outputSize = textureDimensions(outputTex);
  
  if (global_id.x >= outputSize.x || global_id.y >= outputSize.y) {
    return;
  }
  
  let centerCoord = vec2<f32>(
    (f32(global_id.x) + 0.5) / f32(size.x),
    (f32(global_id.y) + 0.5) / f32(size.y)
  );
  let centerColor = textureSample(inputTex, inputSampler, centerCoord);
  
  let radius = i32(params.radius);
  let sigma = f32(radius) / 2.0;
  
  var blurredColor = vec4<f32>(0.0);
  var totalWeight = 0.0;
  
  for (var dy = -radius; dy <= radius; dy++) {
    for (var dx = -radius; dx <= radius; dx++) {
      let weight = gaussianWeight(dx, dy, sigma);
      
      let sampleX = clamp(i32(global_id.x) + dx, 0, i32(size.x) - 1);
      let sampleY = clamp(i32(global_id.y) + dy, 0, i32(size.y) - 1);
      
      let texCoord = vec2<f32>(
        (f32(sampleX) + 0.5) / f32(size.x),
        (f32(sampleY) + 0.5) / f32(size.y)
      );
      
      let color = textureSample(inputTex, inputSampler, texCoord);
      blurredColor += color * weight;
      totalWeight += weight;
    }
  }
  
  blurredColor = blurredColor / totalWeight;
  
  let edge = centerColor - blurredColor;
  
  let threshold = params.threshold / 255.0;
  let edgeMagnitude = length(edge.rgb);
  var sharpenAmount = params.amount;
  
  if (edgeMagnitude < threshold) {
    sharpenAmount = 0.0;
  }
  
  var result = centerColor + edge * sharpenAmount;
  result = clamp(result, 0.0, 1.0);
  
  textureStore(outputTex, vec2<i32>(global_id.xy), result);
}
`

export const shaderModules: Record<string, string> = {
  grayscale: grayscaleShader,
  levels: levelsShader,
  crop: cropShader,
  resize: resizeShader,
  mosaic: mosaicShader,
  sharpen: sharpenShader
}
