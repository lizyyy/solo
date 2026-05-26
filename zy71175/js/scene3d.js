export class BookshelfScene {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.books = [];
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.bookshelf = null;
        this.bookMeshes = [];
        this.animationId = null;
        
        this.init();
    }

    init() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xe8f4f8);

        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(0, 5, 12);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        this.addLights();
        this.createBookshelf();
        this.addFloor();

        window.addEventListener('resize', () => this.onResize());
        
        this.animate();
    }

    addLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0xffeedd, 0.5);
        pointLight.position.set(-5, 5, 5);
        this.scene.add(pointLight);
    }

    createBookshelf() {
        this.bookshelf = new THREE.Group();

        const shelfMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const shelfDepth = 2;
        const shelfWidth = 10;
        const shelfHeight = 0.3;
        const shelfSpacing = 2.2;

        for (let i = 0; i < 3; i++) {
            const shelfGeometry = new THREE.BoxGeometry(shelfWidth, shelfHeight, shelfDepth);
            const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
            shelf.position.y = i * shelfSpacing - 2;
            shelf.castShadow = true;
            shelf.receiveShadow = true;
            this.bookshelf.add(shelf);
        }

        const sideMaterial = new THREE.MeshLambertMaterial({ color: 0x6B3510 });
        const sideGeometry = new THREE.BoxGeometry(0.2, shelfSpacing * 2.5, shelfDepth);
        
        const leftSide = new THREE.Mesh(sideGeometry, sideMaterial);
        leftSide.position.set(-shelfWidth / 2, shelfSpacing * 0.5 - 2, 0);
        this.bookshelf.add(leftSide);

        const rightSide = new THREE.Mesh(sideGeometry, sideMaterial);
        rightSide.position.set(shelfWidth / 2, shelfSpacing * 0.5 - 2, 0);
        this.bookshelf.add(rightSide);

        const backGeometry = new THREE.BoxGeometry(shelfWidth, shelfSpacing * 2.5, 0.1);
        const backMaterial = new THREE.MeshLambertMaterial({ color: 0x5D2906 });
        const back = new THREE.Mesh(backGeometry, backMaterial);
        back.position.set(0, shelfSpacing * 0.5 - 2, -shelfDepth / 2);
        this.bookshelf.add(back);

        this.scene.add(this.bookshelf);
    }

    addFloor() {
        const floorGeometry = new THREE.PlaneGeometry(20, 15);
        const floorMaterial = new THREE.MeshLambertMaterial({ color: 0xd4c4a8 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -4;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    createBookMesh(book, index, shelfIndex = 0) {
        const colors = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22];
        const color = colors[index % colors.length];
        
        const bookWidth = 0.8;
        const bookHeight = 1.5;
        const bookDepth = 0.3;

        const geometry = new THREE.BoxGeometry(bookWidth, bookHeight, bookDepth);
        const material = new THREE.MeshLambertMaterial({ color });
        
        const bookMesh = new THREE.Mesh(geometry, material);
        
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 128, 256);
        
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(book.callNumber, 64, 80);
        
        ctx.font = '16px Arial';
        ctx.fillText(book.title.substring(0, 8), 64, 130);

        const texture = new THREE.CanvasTexture(canvas);
        const spineMaterial = new THREE.MeshLambertMaterial({ map: texture });
        
        const materials = [
            material,
            material,
            material,
            material,
            spineMaterial,
            material
        ];
        
        bookMesh.material = materials;

        const shelfSpacing = 2.2;
        const startX = -3.5;
        const spacing = bookWidth + 0.15;
        
        bookMesh.position.set(
            startX + index * spacing,
            shelfIndex * shelfSpacing - 2 + 0.9,
            0
        );
        
        bookMesh.castShadow = true;
        bookMesh.userData = { bookId: book.id };

        return bookMesh;
    }

    updateBooks(books) {
        this.bookMeshes.forEach(mesh => this.scene.remove(mesh));
        this.bookMeshes = [];

        const booksPerShelf = 8;
        books.forEach((book, index) => {
            const shelfIndex = Math.floor(index / booksPerShelf);
            const positionOnShelf = index % booksPerShelf;
            const bookMesh = this.createBookMesh(book, positionOnShelf, Math.min(shelfIndex, 2));
            this.scene.add(bookMesh);
            this.bookMeshes.push(bookMesh);
        });
    }

    animateBooksIn(books) {
        this.updateBooks(books);
        
        this.bookMeshes.forEach((mesh, index) => {
            const targetY = mesh.position.y;
            mesh.position.y = 5;
            
            setTimeout(() => {
                this.animateBookDrop(mesh, targetY);
            }, index * 100);
        });
    }

    animateBookDrop(mesh, targetY) {
        const duration = 500;
        const startY = mesh.position.y;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOut = 1 - Math.pow(1 - progress, 3);
            mesh.position.y = startY + (targetY - startY) * easeOut;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const time = Date.now() * 0.001;
        this.bookMeshes.forEach((mesh, index) => {
            mesh.rotation.z = Math.sin(time + index * 0.5) * 0.01;
        });

        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }
    }
}
