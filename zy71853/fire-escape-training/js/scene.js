const FireEscapeScene = (() => {
  let scene, camera, renderer, animationId;
  let routeLines = [];
  let fireParticles = [];
  let clock;
  let container;
  let isInitialized = false;

  const ROUTE_COLORS = {
    '默认路线': 0x4fc3f7,
    '东侧楼梯': 0x66bb6a,
    '西侧楼梯': 0xffa726,
    '中央通道': 0xef5350,
    '紧急出口A': 0xab47bc,
    '紧急出口B': 0x26c6da
  };

  function init(containerId) {
    container = document.getElementById(containerId);
    if (!container) return;

    if (isInitialized) {
      dispose();
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.015);

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(25, 20, 25);
    camera.lookAt(0, 2, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    _buildBuilding();
    _addFireEffects();
    _addGround();

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 2, 0);

    window.addEventListener('resize', _onResize);
    isInitialized = true;
    animate();

    return controls;
  }

  function _buildBuilding() {
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.8 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.7, transparent: true, opacity: 0.6 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.5 });

    for (let floor = 0; floor < 3; floor++) {
      const y = floor * 4;

      const floorGeom = new THREE.BoxGeometry(20, 0.3, 16);
      const floorMesh = new THREE.Mesh(floorGeom, floorMat);
      floorMesh.position.set(0, y, 0);
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      const wallConfigs = [
        { pos: [0, y + 2, -8], size: [20, 4, 0.2] },
        { pos: [0, y + 2, 8], size: [20, 4, 0.2] },
        { pos: [-10, y + 2, 0], size: [0.2, 4, 16] },
        { pos: [10, y + 2, 0], size: [0.2, 4, 16] }
      ];

      for (const wc of wallConfigs) {
        const wGeom = new THREE.BoxGeometry(...wc.size);
        const wMesh = new THREE.Mesh(wGeom, wallMat);
        wMesh.position.set(...wc.pos);
        scene.add(wMesh);
      }

      const exits = [
        { pos: [-10, y + 1, 6], label: '紧急出口A' },
        { pos: [10, y + 1, 6], label: '紧急出口B' }
      ];

      for (const ex of exits) {
        const doorGeom = new THREE.BoxGeometry(0.3, 2, 2.5);
        const doorMesh = new THREE.Mesh(doorGeom, doorMat);
        doorMesh.position.set(...ex.pos);
        scene.add(doorMesh);

        const signGeom = new THREE.PlaneGeometry(1.2, 0.5);
        const signMat = new THREE.MeshBasicMaterial({ color: 0x4caf50, side: THREE.DoubleSide });
        const signMesh = new THREE.Mesh(signGeom, signMat);
        signMesh.position.set(ex.pos[0] + (ex.pos[0] < 0 ? -0.3 : 0.3), ex.pos[1] + 1.5, ex.pos[2]);
        signMesh.rotation.y = ex.pos[0] < 0 ? Math.PI / 2 : -Math.PI / 2;
        scene.add(signMesh);
      }

      const stairGeom = new THREE.BoxGeometry(2, 4, 3);
      const stairMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.6, transparent: true, opacity: 0.4 });
      const stairLeft = new THREE.Mesh(stairGeom, stairMat);
      stairLeft.position.set(-8, y + 2, -5);
      scene.add(stairLeft);

      const stairRight = new THREE.Mesh(stairGeom, stairMat);
      stairRight.position.set(8, y + 2, -5);
      scene.add(stairRight);
    }

    const roofGeom = new THREE.BoxGeometry(22, 0.3, 18);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.9 });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(0, 12, 0);
    scene.add(roof);
  }

  function _addFireEffects() {
    const firePositions = [
      { x: 3, y: 0.3, z: 2, floor: 0 },
      { x: -2, y: 4.3, z: -1, floor: 1 }
    ];

    for (const fp of firePositions) {
      const particleCount = 80;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = fp.x + (Math.random() - 0.5) * 1.5;
        positions[i * 3 + 1] = fp.y + Math.random() * 2;
        positions[i * 3 + 2] = fp.z + (Math.random() - 0.5) * 1.5;

        const t = Math.random();
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 0.3 + t * 0.5;
        colors[i * 3 + 2] = t * 0.2;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const particles = new THREE.Points(geometry, material);
      particles.userData = { baseY: fp.y, floor: fp.floor };
      scene.add(particles);
      fireParticles.push(particles);
    }

    for (const fp of firePositions) {
      const light = new THREE.PointLight(0xff6600, 2, 8);
      light.position.set(fp.x, fp.y + 1, fp.z);
      scene.add(light);
    }
  }

  function _addGround() {
    const groundGeom = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 1 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    scene.add(ground);
  }

  function updateRoutes(records) {
    for (const line of routeLines) {
      scene.remove(line);
    }
    routeLines = [];

    const routeGroups = {};
    for (const r of records) {
      const routeName = r.route || '默认路线';
      if (!routeGroups[routeName]) routeGroups[routeName] = 0;
      routeGroups[routeName]++;
    }

    const routeDefs = {
      '默认路线': { path: [[0, 0.5, 0], [-5, 0.5, -3], [-10, 0.5, 6]] },
      '东侧楼梯': { path: [[0, 0.5, 0], [5, 0.5, -3], [8, 0.5, -5], [10, 0.5, 6]] },
      '西侧楼梯': { path: [[0, 0.5, 0], [-5, 0.5, -3], [-8, 0.5, -5], [-10, 0.5, 6]] },
      '中央通道': { path: [[0, 0.5, 0], [0, 0.5, -6], [0, 0.5, 6]] },
      '紧急出口A': { path: [[0, 0.5, 0], [-6, 0.5, 3], [-10, 0.5, 6]] },
      '紧急出口B': { path: [[0, 0.5, 0], [6, 0.5, 3], [10, 0.5, 6]] }
    };

    for (const [routeName, count] of Object.entries(routeGroups)) {
      const def = routeDefs[routeName] || routeDefs['默认路线'];
      const color = ROUTE_COLORS[routeName] || ROUTE_COLORS['默认路线'];

      const points = def.path.map(p => new THREE.Vector3(p[0], p[1], p[2]));
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeom = new THREE.TubeGeometry(curve, 32, 0.08 + count * 0.01, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
      const tube = new THREE.Mesh(tubeGeom, tubeMat);
      scene.add(tube);
      routeLines.push(tube);

      const glowGeom = new THREE.TubeGeometry(curve, 32, 0.2 + count * 0.02, 8, false);
      const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending });
      const glow = new THREE.Mesh(glowGeom, glowMat);
      scene.add(glow);
      routeLines.push(glow);

      const lastPt = def.path[def.path.length - 1];
      const markerGeom = new THREE.SphereGeometry(0.3, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.set(lastPt[0], lastPt[1], lastPt[2]);
      scene.add(marker);
      routeLines.push(marker);
    }
  }

  function _animateFire(elapsed) {
    for (const p of fireParticles) {
      const pos = p.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i);
        y += 0.02 + Math.random() * 0.02;
        if (y > p.userData.baseY + 3) {
          y = p.userData.baseY + Math.random() * 0.3;
        }
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.02);
      }
      pos.needsUpdate = true;
    }
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    _animateFire(elapsed);

    for (const line of routeLines) {
      if (line.material.opacity < 1) {
        line.material.opacity = line.material.userData?.baseOpacity || line.material.opacity;
      }
    }

    renderer.render(scene, camera);
  }

  function _onResize() {
    if (!container || !camera || !renderer) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function dispose() {
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('resize', _onResize);
    if (renderer) {
      renderer.dispose();
    }
    routeLines = [];
    fireParticles = [];
    isInitialized = false;
  }

  function resetCamera() {
    if (!camera) return;
    camera.position.set(25, 20, 25);
    camera.lookAt(0, 2, 0);
  }

  return { init, updateRoutes, dispose, resetCamera };
})();
