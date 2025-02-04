let scene, camera, renderer, controls;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let score = 0;
const targets = [];

init();
animate();

function init() {
    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Camera position
    camera.position.y = 1.6;
    camera.position.z = 5;

    // Lighting
    const light = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(light);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 10, 0);
    scene.add(directionalLight);

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshPhongMaterial({ color: 0x808080 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Create targets
    createTargets();

    // Event listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', shoot);
    document.addEventListener('mousemove', onMouseMove);
}

function createTargets() {
    const targetGeometry = new THREE.BoxGeometry(1, 2, 0.1);
    const targetMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    
    for (let i = 0; i < 5; i++) {
        const target = new THREE.Mesh(targetGeometry, targetMaterial);
        target.position.x = (Math.random() - 0.5) * 20;
        target.position.z = -Math.random() * 20 - 5;
        target.position.y = 1;
        scene.add(target);
        targets.push(target);
    }
}

function onMouseMove(event) {
    camera.rotation.y -= event.movementX * 0.002;
    camera.rotation.x -= event.movementY * 0.002;
    camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
}

function onKeyDown(event) {
    switch (event.key.toLowerCase()) {
        case 'w': moveForward = true; break;
        case 's': moveBackward = true; break;
        case 'a': moveLeft = true; break;
        case 'd': moveRight = true; break;
    }
}

function onKeyUp(event) {
    switch (event.key.toLowerCase()) {
        case 'w': moveForward = false; break;
        case 's': moveBackward = false; break;
        case 'a': moveLeft = false; break;
        case 'd': moveRight = false; break;
    }
}

function shoot() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(), camera);
    
    const intersects = raycaster.intersectObjects(targets);
    if (intersects.length > 0) {
        scene.remove(intersects[0].object);
        targets.splice(targets.indexOf(intersects[0].object), 1);
        score++;
        document.getElementById('score').textContent = `Score: ${score}`;
    }
}

function updateMovement() {
    const speed = 0.1;
    const direction = new THREE.Vector3();
    
    const rotation = camera.rotation.y;
    if (moveForward) {
        direction.x -= Math.sin(rotation) * speed;
        direction.z -= Math.cos(rotation) * speed;
    }
    if (moveBackward) {
        direction.x += Math.sin(rotation) * speed;
        direction.z += Math.cos(rotation) * speed;
    }
    if (moveLeft) {
        direction.x -= Math.cos(rotation) * speed;
        direction.z += Math.sin(rotation) * speed;
    }
    if (moveRight) {
        direction.x += Math.cos(rotation) * speed;
        direction.z -= Math.sin(rotation) * speed;
    }
    
    camera.position.add(direction);
}

function animate() {
    requestAnimationFrame(animate);
    updateMovement();
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
