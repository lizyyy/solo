import './style.css';
import { renderApp } from './components/App';

document.addEventListener('DOMContentLoaded', () => {
  renderApp();
});

declare global {
  interface Window {
    stageLightingTool: {
      renderApp: () => void;
    };
  }
}

window.stageLightingTool = {
  renderApp
};
