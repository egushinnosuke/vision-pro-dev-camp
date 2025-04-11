import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";

let camera, scene, renderer;
let controller1, controller2;
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

    // コントローラーの設定
    const controllerModelFactory = new XRControllerModelFactory();
    controller1 = renderer.xr.getController(0);
    controller2 = renderer.xr.getController(1);
    scene.add(controller1);
    scene.add(controller2);

    controller1.addEventListener("selectstart", onSelectStart);
    controller1.addEventListener("selectend", onSelectEnd);
    controller2.addEventListener("selectstart", onSelectStart);
    controller2.addEventListener("selectend", onSelectEnd);

    // ボタンの作成
    const buttonGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const buttonMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    button = new THREE.Mesh(buttonGeometry, buttonMaterial);
    button.position.set(0, 1.6, -0.5);
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

function onSelectStart() {
    const controller = this;
    const intersections = getIntersections(controller);

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

function onSelectEnd() {
    button.material.color.setHex(0x00ff00);
}

function getIntersections(controller) {
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(
        controller.quaternion
    );
    const raycaster = new THREE.Raycaster(controller.position, direction);
    return raycaster.intersectObjects([button]);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render() {
    renderer.render(scene, camera);
}
