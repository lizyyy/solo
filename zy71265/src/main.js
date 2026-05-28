import { GalleryApp } from './core/GalleryApp.js';

const app = new GalleryApp();

window.addEventListener('DOMContentLoaded', () => {
  app.init();
});

window.addEventListener('resize', () => {
  app.onResize();
});

window.galleryApp = app;
