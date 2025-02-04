let scene, camera, renderer, composer, clock;
let moveState = { forward: false, backward: false, left: false, right: false };
let score = 0, health = 100, gameTime = 0, targets = [];
let gameActive = false, audioListener, shootSound, hitSound, bgMusic;
let particleSystem, weaponModel, screenShakeIntensity = 0;
let mixer, recoilAction;

// Asset loading progress
let assetsLoaded = 0;
const totalAssets = 6; // Update this based on your assets

async function init() {
    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    document.body.appendChild(renderer.domElement);

    // Post-processing
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));

    const bloomPass = new THREE.BloomPass(1.5, 25, 5, 512);
    composer.addPass(bloomPass);

    const fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
    fxaaPass.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
    composer.addPass(fxaaPass);

    const copyPass = new THREE.ShaderPass(THREE.CopyShader);
    copyPass.renderToScreen = true;
    composer.addPass(copyPass);

    // Load assets
    await loadAssets();
    setupGame();
    animate();
}

async function loadAssets() {
    const loader = new THREE.GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    const audioLoader = new THREE.AudioLoader();

    // Load audio
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);

    shootSound = new THREE.Audio(audioListener);
    hitSound = new THREE.Audio(audioListener);
    bgMusic = new THREE.Audio(audioListener);

    await Promise.all([
        loadAudio('sounds/shoot.wav', shootSound),
        loadAudio('sounds/hit.wav', hitSound),
        loadAudio('sounds/background.mp3', bgMusic),
        loadTexture('textures/floor.jpeg'),
        loadTexture('textures/wall.jpeg'),
        loadModel('models/weapon.glb'),
        loadModel('models/target.glb')
    ]);

    // Hide loading screen and show start screen
    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
}

async function loadAudio(url, audio) {
    return new Promise(resolve => {
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load(url, buffer => {
            audio.setBuffer(buffer);
            if (url.includes('background')) {
                audio.setLoop(true);
                audio.setVolume(0.3);
            }
            updateProgress();
            resolve();
        });
    });
}

async function loadTexture(url) {
    return new Promise(resolve => {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(url, texture => {
            updateProgress();
            resolve(texture);
        });
    });
}

async function loadModel(url) {
    return new Promise(resolve => {
        const loader = new THREE.GLTFLoader();
        loader.load(url, gltf => {
            if (url.includes('weapon')) {
                weaponModel = gltf.scene;
                weaponModel.position.set(0.5, -0.5, -1);
                weaponModel.scale.set(0.1, 0.1, 0.1);
                camera.add(weaponModel);

                mixer = new THREE.AnimationMixer(weaponModel);
                recoilAction = mixer.clipAction(gltf.animations[0]);
            } else if (url.includes('target')) {
                window.targetModel = gltf.scene;
            }
            updateProgress();
            resolve(gltf);
        });
    });
}

function updateProgress() {
    assetsLoaded++;
    const progress = (assetsLoaded / totalAssets) * 100;
    document.querySelector('.progress').style.width = `${progress}%`;
}

function setupGame() {
    // Pointer Lock setup
    const startButton = document.getElementById('startButton');
    startButton.addEventListener('click', async () => {
        await document.body.requestPointerLock();
        gameActive = true;
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('crosshair').classList.remove('hidden');
        bgMusic.play();
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === document.body) {
            document.addEventListener('mousemove', onMouseMove, false);
        } else {
            gameActive = false;
            bgMusic.stop();
            document.getElementById('gameOver').classList.remove('hidden');
            document.getElementById('hud').classList.add('hidden');
            document.getElementById('crosshair').classList.add('hidden');
        }
    });

    // Scene setup
    camera.position.set(0, 1.6, 5);
    setupLighting();
    createEnvironment();
    createTargets(8);
    setupEventListeners();
    setupParticles();
}

function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x00ff88, 1, 50);
    pointLight.position.set(0, 10, 0);
    pointLight.castShadow = true;
    scene.add(pointLight);
}

function createEnvironment() {
    // Floor
    const floorTexture = new THREE.TextureLoader().load('textures/floor.jpeg');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(10, 10);

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.8, metalness: 0.2 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Walls
    const wallTexture = new THREE.TextureLoader().load('textures/wall.jpeg');
    const walls = [
        new THREE.Mesh(new THREE.BoxGeometry(100, 10, 2), new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.7, metalness: 0.3 })),
        new THREE.Mesh(new THREE.BoxGeometry(2, 10, 100), new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.7, metalness: 0.3 })),
        new THREE.Mesh(new THREE.BoxGeometry(2, 10, 100), new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.7, metalness: 0.3 }))
    ];

    walls[0].position.z = -50;
    walls[1].position.x = -50;
    walls[2].position.x = 50;
    walls.forEach(wall => {
        wall.position.y = 5;
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
    });
}

function setupParticles() {
    const particleCount = 1000;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 100;
        positions[i * 3 + 1] = Math.random() * 10;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

        colors[i * 3] = Math.random();
        colors[i * 3 + 1] = Math.random();
        colors[i * 3 + 2] = Math.random();
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.5
    });

    particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (gameActive) {
        gameTime += delta;
        document.getElementById('timer').textContent = `Time: ${Math.floor(gameTime)}`;
        handleInput();
        updateTargets();
        updateScreenShake(delta);
        updateParticles(delta);
        if (mixer) mixer.update(delta);
    }
    composer.render();
}

function updateScreenShake(delta) {
    if (screenShakeIntensity > 0) {
        camera.position.x += (Math.random() - 0.5) * screenShakeIntensity;
        camera.position.y += (Math.random() - 0.5) * screenShakeIntensity;
        screenShakeIntensity -= delta * 5;
    }
}

function updateParticles(delta) {
    const positions = particleSystem.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= delta * 0.1;
        if (positions[i + 1] < 0) {
            positions[i + 1] = 10;
        }
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
}

function handleInput() {
    const delta = clock.getDelta();
    const speed = 5 * delta;
    const direction = new THREE.Vector3();

    if (moveState.forward) direction.z -= speed;
    if (moveState.backward) direction.z += speed;
    if (moveState.left) direction.x -= speed;
    if (moveState.right) direction.x += speed;

    direction.applyEuler(new THREE.Euler(0, camera.rotation.y, 0));
    camera.position.add(direction);
}

function onMouseMove(event) {
    if (gameActive) {
        camera.rotation.y -= event.movementX * 0.002;
        camera.rotation.x -= event.movementY * 0.002;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    }
}

function shoot() {
    if (!gameActive) return;

    shootSound.play();
    screenShakeIntensity = 0.5;
    if (recoilAction) recoilAction.play();

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(), camera);

    const intersects = raycaster.intersectObjects(targets, true);
    if (intersects.length > 0) {
        const target = intersects[0].object.parent;
        target.health--;

        if (target.health <= 0) {
            scene.remove(target);
            targets.splice(targets.indexOf(target), 1);
            createTargets(1);
            score += 100;
        } else {
            hitSound.play();
            score += 25;
        }

        document.getElementById('score').textContent = `Score: ${score}`;
    }
}

function setupEventListeners() {
    document.addEventListener('keydown', e => {
        switch (e.key.toLowerCase()) {
            case 'w': moveState.forward = true; break;
            case 's': moveState.backward = true; break;
            case 'a': moveState.left = true; break;
            case 'd': moveState.right = true; break;
        }
    });

    document.addEventListener('keyup', e => {
        switch (e.key.toLowerCase()) {
            case 'w': moveState.forward = false; break;
            case 's': moveState.backward = false; break;
            case 'a': moveState.left = false; break;
            case 'd': moveState.right = false; break;
        }
    });

    document.addEventListener('mousedown', shoot);
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// Initialize the game
init();
