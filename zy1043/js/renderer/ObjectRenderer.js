/**
 * 对象渲染器
 * 负责创建和更新仓库对象的 Three.js 网格
 */

const ObjectRenderer = {
    createMesh(obj) {
        switch (obj.type) {
            case Constants.OBJECT_TYPES.SHELF:
                return this.createShelfMesh(obj);
            case Constants.OBJECT_TYPES.ZONE:
                return this.createZoneMesh(obj);
            case Constants.OBJECT_TYPES.ENTRANCE:
                return this.createEntranceMesh(obj);
            case Constants.OBJECT_TYPES.FORBIDDEN:
                return this.createForbiddenZoneMesh(obj);
            default:
                return this.createGenericMesh(obj);
        }
    },
    
    createShelfMesh(obj) {
        const group = new THREE.Group();
        group.userData.isWarehouseObject = true;
        group.userData.objectId = obj.id;
        group.userData.objectType = obj.type;
        
        const bodyGeometry = new THREE.BoxGeometry(obj.length, obj.height, obj.width);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: obj.color,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = obj.height / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        body.userData.objectId = obj.id;
        group.add(body);
        
        if (obj.levelCount > 0) {
            const levelSpacing = obj.height / (obj.levelCount + 1);
            for (let i = 1; i <= obj.levelCount; i++) {
                const levelGeometry = new THREE.BoxGeometry(obj.length * 0.95, 0.05, obj.width * 0.95);
                const levelMaterial = new THREE.MeshStandardMaterial({
                    color: this.lightenColor(obj.color, 0.2),
                    roughness: 0.6
                });
                
                const level = new THREE.Mesh(levelGeometry, levelMaterial);
                level.position.y = levelSpacing * i;
                level.castShadow = true;
                level.receiveShadow = true;
                group.add(level);
            }
        }
        
        const edgesGeometry = new THREE.EdgesGeometry(bodyGeometry);
        const edgesMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            opacity: 0.3,
            transparent: true
        });
        const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        edges.position.y = obj.height / 2;
        group.add(edges);
        
        group.position.set(obj.x, 0, obj.z);
        group.rotation.y = Utils.degToRad(obj.rotation);
        
        return group;
    },
    
    createZoneMesh(obj) {
        const group = new THREE.Group();
        group.userData.isWarehouseObject = true;
        group.userData.objectId = obj.id;
        group.userData.objectType = obj.type;
        
        const planeGeometry = new THREE.PlaneGeometry(obj.length, obj.width);
        const planeMaterial = new THREE.MeshStandardMaterial({
            color: obj.color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = 0.02;
        plane.receiveShadow = true;
        plane.userData.objectId = obj.id;
        group.add(plane);
        
        const borderGeometry = new THREE.EdgesGeometry(
            new THREE.BoxGeometry(obj.length, 0.1, obj.width)
        );
        const borderMaterial = new THREE.LineBasicMaterial({ 
            color: obj.color,
            linewidth: 2
        });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        border.position.y = 0.05;
        group.add(border);
        
        group.position.set(obj.x, 0, obj.z);
        group.rotation.y = Utils.degToRad(obj.rotation);
        
        return group;
    },
    
    createEntranceMesh(obj) {
        const group = new THREE.Group();
        group.userData.isWarehouseObject = true;
        group.userData.objectId = obj.id;
        group.userData.objectType = obj.type;
        
        const planeGeometry = new THREE.PlaneGeometry(obj.length, obj.width);
        const planeMaterial = new THREE.MeshStandardMaterial({
            color: obj.color,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = 0.03;
        plane.receiveShadow = true;
        plane.userData.objectId = obj.id;
        group.add(plane);
        
        const arrowGeometry = new THREE.ConeGeometry(0.3, 0.8, 4);
        const arrowMaterial = new THREE.MeshStandardMaterial({
            color: obj.color,
            emissive: obj.color,
            emissiveIntensity: 0.3
        });
        
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.rotation.x = -Math.PI / 2;
        arrow.position.y = 0.5;
        group.add(arrow);
        
        const borderGeometry = new THREE.EdgesGeometry(
            new THREE.BoxGeometry(obj.length, 0.1, obj.width)
        );
        const borderMaterial = new THREE.LineDashedMaterial({ 
            color: obj.color,
            dashSize: 0.3,
            gapSize: 0.15,
            linewidth: 2
        });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        border.position.y = 0.05;
        border.computeLineDistances();
        group.add(border);
        
        group.position.set(obj.x, 0, obj.z);
        group.rotation.y = Utils.degToRad(obj.rotation);
        
        return group;
    },
    
    createForbiddenZoneMesh(obj) {
        const group = new THREE.Group();
        group.userData.isWarehouseObject = true;
        group.userData.objectId = obj.id;
        group.userData.objectType = obj.type;
        
        const height = obj.height || 0.2;
        const boxGeometry = new THREE.BoxGeometry(obj.length, height, obj.width);
        const boxMaterial = new THREE.MeshStandardMaterial({
            color: obj.color,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.y = height / 2;
        box.receiveShadow = true;
        box.userData.objectId = obj.id;
        group.add(box);
        
        const borderGeometry = new THREE.EdgesGeometry(boxGeometry);
        const borderMaterial = new THREE.LineDashedMaterial({ 
            color: obj.color,
            dashSize: 0.2,
            gapSize: 0.2,
            linewidth: 2
        });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        border.position.y = height / 2;
        border.computeLineDistances();
        group.add(border);
        
        const crossGeometry1 = new THREE.BoxGeometry(obj.length * 0.6, 0.02, 0.1);
        const crossGeometry2 = new THREE.BoxGeometry(0.1, 0.02, obj.width * 0.6);
        const crossMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff
        });
        
        const cross1 = new THREE.Mesh(crossGeometry1, crossMaterial);
        cross1.position.y = height + 0.01;
        cross1.rotation.y = Math.PI / 4;
        group.add(cross1);
        
        const cross2 = new THREE.Mesh(crossGeometry2, crossMaterial);
        cross2.position.y = height + 0.01;
        cross2.rotation.y = Math.PI / 4;
        group.add(cross2);
        
        group.position.set(obj.x, 0, obj.z);
        group.rotation.y = Utils.degToRad(obj.rotation);
        
        return group;
    },
    
    createGenericMesh(obj) {
        const geometry = new THREE.BoxGeometry(obj.length, obj.height, obj.width);
        const material = new THREE.MeshStandardMaterial({
            color: obj.color,
            roughness: 0.7
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(obj.x, obj.height / 2, obj.z);
        mesh.rotation.y = Utils.degToRad(obj.rotation);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isWarehouseObject = true;
        mesh.userData.objectId = obj.id;
        mesh.userData.objectType = obj.type;
        
        return mesh;
    },
    
    updateMesh(mesh, obj) {
        if (!mesh) return;
        
        mesh.position.set(obj.x, 0, obj.z);
        mesh.rotation.y = Utils.degToRad(obj.rotation);
        
        mesh.traverse(child => {
            if (child instanceof THREE.Mesh) {
                if (child.material && child.material.color) {
                    child.material.color.setHex(obj.color);
                }
            }
        });
    },
    
    highlightMesh(mesh, highlight = true) {
        if (!mesh) return;
        
        mesh.traverse(child => {
            if (child instanceof THREE.Mesh) {
                if (child.material) {
                    if (highlight) {
                        child.userData.originalEmissive = child.material.emissive ? child.material.emissive.getHex() : 0x000000;
                        if (child.material.emissive) {
                            child.material.emissive.setHex(Constants.COLORS.HIGHLIGHT);
                            child.material.emissiveIntensity = 0.5;
                        }
                    } else {
                        if (child.material.emissive && child.userData.originalEmissive !== undefined) {
                            child.material.emissive.setHex(child.userData.originalEmissive);
                            child.material.emissiveIntensity = 0;
                        }
                    }
                }
            }
        });
    },
    
    lightenColor(color, amount) {
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        
        const newR = Math.min(255, Math.floor(r + (255 - r) * amount));
        const newG = Math.min(255, Math.floor(g + (255 - g) * amount));
        const newB = Math.min(255, Math.floor(b + (255 - b) * amount));
        
        return (newR << 16) | (newG << 8) | newB;
    },
    
    darkenColor(color, amount) {
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        
        const newR = Math.floor(r * (1 - amount));
        const newG = Math.floor(g * (1 - amount));
        const newB = Math.floor(b * (1 - amount));
        
        return (newR << 16) | (newG << 8) | newB;
    }
};
