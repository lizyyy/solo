import * as THREE from '/node_modules/three/build/three.module.js';
import { OrbitControls } from '/js/renderer/OrbitControls.js';
import * as TWEEN from '/node_modules/@tweenjs/tween.js/dist/tween.esm.js';

window.THREE = THREE;
window.OrbitControls = OrbitControls;
window.TWEEN = TWEEN;

document.dispatchEvent(new CustomEvent('three-ready', { detail: { THREE, OrbitControls, TWEEN } }));
