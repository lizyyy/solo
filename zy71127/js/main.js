let visualization;
let lastTime = 0;

function init() {
    const canvas = document.getElementById('mainCanvas');
    visualization = new Visualization(canvas);

    simulation.loadConfig(EXAMPLES.normal);
    visualization.createGates();
    visualization.createClosedAreas();

    ui.updateGateList();
    ui.updateBatchList();
    ui.updateStats();

    window.addEventListener('load', () => {
        visualization.resize();
    });

    animate();
}

function animate(currentTime = 0) {
    requestAnimationFrame(animate);

    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    simulation.update(deltaTime);
    ui.update();
    visualization.render();
}

document.addEventListener('DOMContentLoaded', init);
