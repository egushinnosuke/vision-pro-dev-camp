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
    const buttonGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const buttonMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.2,
    });
    button = new THREE.Mesh(buttonGeometry, buttonMaterial);
    button.position.set(0, 1.4, -0.3);
    scene.add(button);

    // ボタンの枠を追加
    const buttonFrameGeometry = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const buttonFrameMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        wireframe: true,
    });
    const buttonFrame = new THREE.Mesh(
        buttonFrameGeometry,
        buttonFrameMaterial
    );
    buttonFrame.position.copy(button.position);
    scene.add(buttonFrame);

    // 音声の設定
    const listener = new THREE.AudioListener();
    camera.add(listener);
    audio = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();

    // 音声ファイルの読み込みを確実にする
    audioLoader.load(
        "button-sound.mp3",
        function (buffer) {
            audio.setBuffer(buffer);
            audio.setVolume(1.0); // 音量を最大に
            console.log("音声ファイルの読み込みが完了しました");
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
        },
        function (error) {
            console.error("音声ファイルの読み込みに失敗しました:", error);
        }
    );

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
            button.material.emissive.setHex(0xff0000);
            button.material.emissiveIntensity = 0.5;
            button.scale.set(0.9, 0.9, 0.9);

            // 音声再生の処理を改善
            if (audio && audio.buffer) {
                audio.stop(); // 前の再生を停止
                audio.play();
                console.log("音声を再生します");
            } else {
                console.warn("音声バッファが読み込まれていません");
            }
        }
    }
}

function onPinchEnd() {
    button.material.color.setHex(0x00ff00);
    button.material.emissive.setHex(0x00ff00);
    button.material.emissiveIntensity = 0.2;
    button.scale.set(1, 1, 1);
}

function getIntersections(hand) {
    const indexTip = hand.joints["index-finger-tip"];
    if (!indexTip) return [];

    const position = new THREE.Vector3();
    indexTip.getWorldPosition(position);

    const direction = new THREE.Vector3();
    indexTip.getWorldDirection(direction);

    const raycaster = new THREE.Raycaster(position, direction);
    raycaster.far = 0.2;
    return raycaster.intersectObjects([button]);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render() {
    renderer.render(scene, camera);
}
