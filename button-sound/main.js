import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRHandModelFactory } from "three/addons/webxr/XRHandModelFactory.js";

let camera, scene, renderer;
let hand1, hand2;
let button;
let audio;

init();
animate();

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.01,
        20
    );

    // レンダラーの設定
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    // ライトの追加
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    // ハンドトラッキングの設定
    const handModelFactory = new XRHandModelFactory();
    hand1 = renderer.xr.getHand(0);
    hand2 = renderer.xr.getHand(1);
    scene.add(hand1);
    scene.add(hand2);

    hand1.addEventListener("pinchstart", onPinchStart);
    hand1.addEventListener("pinchend", onPinchEnd);
    hand2.addEventListener("pinchstart", onPinchStart);
    hand2.addEventListener("pinchend", onPinchEnd);

    // ハンドモデルの追加
    const handModel1 = handModelFactory.createHandModel(hand1, "mesh");
    const handModel2 = handModelFactory.createHandModel(hand2, "mesh");
    hand1.add(handModel1);
    hand2.add(handModel2);

    // ボタンの作成
    const buttonGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const buttonMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    button = new THREE.Mesh(buttonGeometry, buttonMaterial);
    button.position.set(0, 1.4, -0.3);
    scene.add(button);

    // 音声の設定
    const listener = new THREE.AudioListener();
    camera.add(listener);
    audio = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load("button-sound.mp3", function (buffer) {
        audio.setBuffer(buffer);
    });

    // VRボタンの追加
    document.body.appendChild(VRButton.createButton(renderer));

    window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPinchStart() {
    const hand = this;
    const intersections = getIntersections(hand);

    if (intersections.length > 0) {
        const intersection = intersections[0];
        const object = intersection.object;

        if (object === button) {
            button.material.color.setHex(0xff0000);
            if (audio && !audio.isPlaying) {
                audio.play();
            }
        }
    }
}

function onPinchEnd() {
    button.material.color.setHex(0x00ff00);
}

function getIntersections(hand) {
    const indexTip = hand.joints["index-finger-tip"];
    if (!indexTip) return [];

    const position = new THREE.Vector3();
    indexTip.getWorldPosition(position);

    const direction = new THREE.Vector3();
    indexTip.getWorldDirection(direction);

    const raycaster = new THREE.Raycaster(position, direction);
    raycaster.far = 0.1; // 検出距離を10cmに制限
    return raycaster.intersectObjects([button]);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render() {
    renderer.render(scene, camera);
}
