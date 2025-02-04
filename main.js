// main.js
let scene, camera, renderer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let score = 0, health = 100, gameTime = 0;
let targets = [];
let gameActive = false;
let clock = new THREE.Clock();

// Audio
const shootSound = new AudioContext();
const hitSound = new AudioContext();

init();
animate();

function init() {
    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Pointer Lock setup
    const startButton = document.getElementById('startButton');
    startButton.addEventListener('click', () => {
        document.body.requestPointerLock();
        gameActive = true;
        document.getElementById('startScreen').classList.add('hidden');
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === document.body) {
            document.addEventListener('mousemove', onMouseMove, false);
        } else {
            document.removeEventListener('mousemove', onMouseMove, false);
            gameActive = false;
            document.getElementById('gameOver').classList.remove('hidden');
        }
    });

    // Camera position
    camera.position.set(0, 1.6, 5);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 10, 5);
    scene.add(directionalLight);

    // Floor
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshPhongMaterial({ color: 0x808080 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Walls
    createWalls();

    // Create initial targets
    createTargets(5);

    // Event listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', shoot);
}

function createWalls() {
    const wallMaterial = new THREE.MeshPhongMaterial({ color: 0x606060 });
    const walls = [
        new THREE.Mesh(new THREE.BoxGeometry(100, 10, 1), wallMaterial), // back
        new THREE.Mesh(new THREE.BoxGeometry(1, 10, 100), wallMaterial), // left
        new THREE.Mesh(new THREE.BoxGeometry(1, 10, 100), wallMaterial), // right
    ];

    walls[0].position.z = -50;
    walls[1].position.x = -50;
    walls[2].position.x = 50;

    walls.forEach(wall => {
        wall.position.y = 5;
        scene.add(wall);
    });
}

function createTargets(count) {
    const targetGeometry = new THREE.BoxGeometry(1, 2, 0.1);
    const targetMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    
    for (let i = 0; i < count; i++) {
        const target = new THREE.Mesh(targetGeometry, targetMaterial);
        resetTargetPosition(target);
        scene.add(target);
        targets.push(target);
    }
}

function resetTargetPosition(target) {
    target.position.set(
        (Math.random() - 0.5) * 40,
        1,
        -Math.random() * 40 - 5
    );
    target.speed = Math.random() * 0.02 + 0.01;
}

function onMouseMove(event) {
    if (gameActive) {
        camera.rotation.y -= event.movementX * 0.002;
        camera.rotation.x -= event.movementY * 0.002;
        camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
    }
}

function onKeyDown(event) {
    if (!gameActive) return;
    
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
    if (!gameActive) return;
    
    // Play shoot sound
    const oscillator = shootSound.createOscillator();
    const gainNode = shootSound.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(shootSound.destination);
    oscillator.frequency.value = 1000;
    gainNode.gain.value = 0.1;
    oscillator.start();
    oscillator.stop(shootSound.currentTime + 0.1);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(), camera);
    
    const intersects = raycaster.intersectObjects(targets);
    if (intersects.length > 0) {
        const target = intersects[0].object;
        scene.remove(target);
        targets.splice(targets.indexOf(target), 1);
        score += 10;
        document.getElementById('score').textContent = `Score: ${score}`;
        
        // Create new target
        const newTarget = new THREE.Mesh(target.geometry, target.material);
        resetTargetPosition(newTarget);
        scene.add(newTarget);
        targets.push(newTarget);

        // Play hit sound
        const hitOscillator = hitSound.createOscillator();
        const hitGain = hitSound.createGain();
        hitOscillator.connect(hitGain);
        hitGain.connect(hitSound.destination);
        hitOscillator.frequency.value = 500;
        hitGain.gain.value = 0.1;
        hitOscillator.start();
        hitOscillator.stop(hitSound.currentTime + 0.1);
    }
}

function updateMovement() {
    const delta = clock.getDelta();
    const speed = 5 * delta;
    const direction = new THREE.Vector3();

    if (moveForward) direction.z -= speed;
    if (moveBackward) direction.z += speed;
    if (moveLeft) direction.x -= speed;
    if (moveRight) direction.x += speed;

    direction.applyEuler(new THREE.Euler(0, camera.rotation.y, 0));
    camera.position.add(direction);

    // Target movement
    targets.forEach(target => {
        target.position.x += target.speed;
        if (target.position.x > 20 || target.position.x < -20) {
            target.speed *= -1;
        }

        // Check collision with player
        const distance = camera.position.distanceTo(target.position);
        if (distance < 2) {
            health = Math.max(0, health - 1);
            document.getElementById('health').textContent = `Health: ${health}`;
            if (health <= 0) {
                gameActive = false;
                document.exitPointerLock();
                document.getElementById('finalScore').textContent = score;
                document.getElementById('gameOver').classList.remove('hidden');
            }
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    if (gameActive) {
        gameTime += clock.getDelta();
        document.getElementById('timer').textContent = `Time: ${Math.floor(gameTime)}`;
        updateMovement();
    }
    
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
