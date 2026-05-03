/**
 * 路线渲染器
 * 负责创建拣货路线的可视化
 */

const RouteRenderer = {
    createRoute(route, warehouse) {
        const meshes = [];
        
        if (!route || !route.points || route.points.length < 2) {
            return meshes;
        }
        
        const lineMesh = this.createRouteLine(route.points);
        if (lineMesh) {
            meshes.push(lineMesh);
        }
        
        route.points.forEach((point, index) => {
            const marker = this.createPointMarker(point, index, route.points.length);
            if (marker) {
                meshes.push(marker);
            }
        });
        
        if (route.segments) {
            route.segments.forEach(segment => {
                const arrow = this.createDirectionArrow(segment);
                if (arrow) {
                    meshes.push(arrow);
                }
            });
        }
        
        return meshes;
    },
    
    createRouteLine(points) {
        const positions = [];
        
        points.forEach(point => {
            positions.push(point.x, 0.1, point.z);
        });
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        const material = new THREE.LineBasicMaterial({
            color: Constants.COLORS.ROUTE_LINE,
            linewidth: 3
        });
        
        const line = new THREE.Line(geometry, material);
        line.userData.isRoute = true;
        line.userData.routeType = 'line';
        
        return line;
    },
    
    createPointMarker(point, index, total) {
        const group = new THREE.Group();
        group.userData.isRoute = true;
        group.userData.routeType = 'marker';
        group.userData.pointIndex = index;
        
        let color, size;
        
        if (index === 0) {
            color = 0x4ade80;
            size = 0.5;
        } else if (index === total - 1) {
            color = 0xef4444;
            size = 0.5;
        } else {
            color = 0xfbbf24;
            size = 0.35;
        }
        
        const markerGeometry = new THREE.CylinderGeometry(size, size, 0.05, 16);
        const markerMaterial = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.8
        });
        
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.y = 0.025;
        group.add(marker);
        
        if (index > 0 && index < total - 1) {
            const ringGeometry = new THREE.RingGeometry(size * 0.3, size * 0.5, 16);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.6
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.06;
            group.add(ring);
        }
        
        const sphereGeometry = new THREE.SphereGeometry(size * 0.3, 16, 16);
        const sphereMaterial = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.y = 0.5 + index * 0.05;
        group.add(sphere);
        
        group.position.set(point.x, 0, point.z);
        
        return group;
    },
    
    createDirectionArrow(segment) {
        if (!segment.from || !segment.to) return null;
        
        const from = segment.from;
        const to = segment.to;
        
        const midX = (from.x + to.x) / 2;
        const midZ = (from.z + to.z) / 2;
        
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const angle = Math.atan2(dx, dz);
        
        const group = new THREE.Group();
        group.userData.isRoute = true;
        group.userData.routeType = 'arrow';
        
        const arrowGeometry = new THREE.ConeGeometry(0.15, 0.4, 4);
        const arrowMaterial = new THREE.MeshStandardMaterial({
            color: Constants.COLORS.ROUTE_LINE,
            emissive: Constants.COLORS.ROUTE_LINE,
            emissiveIntensity: 0.3
        });
        
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.rotation.x = -Math.PI / 2;
        group.add(arrow);
        
        group.position.set(midX, 0.3, midZ);
        group.rotation.y = angle;
        
        return group;
    },
    
    createPlayerMarker(position, color = 0xffffff) {
        const group = new THREE.Group();
        group.userData.isRoute = true;
        group.userData.routeType = 'player';
        
        const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.8, 8, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.8;
        group.add(body);
        
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.45;
        group.add(head);
        
        group.position.set(position.x, 0, position.z);
        
        return group;
    },
    
    createPathAnimation(route, duration = 5000) {
        if (!route || !route.points || route.points.length < 2) {
            return null;
        }
        
        return {
            route: route,
            duration: duration,
            currentTime: 0,
            isPlaying: false,
            isPaused: false,
            
            play() {
                this.isPlaying = true;
                this.isPaused = false;
            },
            
            pause() {
                this.isPaused = true;
            },
            
            stop() {
                this.isPlaying = false;
                this.isPaused = false;
                this.currentTime = 0;
            },
            
            update(deltaTime) {
                if (!this.isPlaying || this.isPaused) return null;
                
                this.currentTime += deltaTime;
                
                if (this.currentTime >= this.duration) {
                    this.isPlaying = false;
                    this.currentTime = this.duration;
                }
                
                const progress = this.currentTime / this.duration;
                const position = this.getPositionAtProgress(progress);
                
                return {
                    progress: progress,
                    position: position,
                    isComplete: progress >= 1
                };
            },
            
            getPositionAtProgress(progress) {
                const points = this.route.points;
                const totalSegments = points.length - 1;
                const segmentProgress = progress * totalSegments;
                const segmentIndex = Math.min(Math.floor(segmentProgress), totalSegments - 1);
                const segmentT = segmentProgress - segmentIndex;
                
                const from = points[segmentIndex];
                const to = points[Math.min(segmentIndex + 1, points.length - 1)];
                
                return {
                    x: Utils.lerp(from.x, to.x, segmentT),
                    z: Utils.lerp(from.z, to.z, segmentT),
                    segmentIndex: segmentIndex,
                    segmentT: segmentT
                };
            }
        };
    }
};
