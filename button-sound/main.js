import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRHandModelFactory } from "three/addons/webxr/XRHandModelFactory.js";

let camera, scene, renderer;
let hand1, hand2;
let button;
let audio;
let analyser;
let dataArray;
let visualizerGroup;
let bars = [];

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
    const buttonGeometry = new THREE.SphereGeometry(0.1, 32, 32); // 半径0.1mの球体
    const buttonMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.5,
        shininess: 100, // 光沢を追加
    });
    button = new THREE.Mesh(buttonGeometry, buttonMaterial);
    button.position.set(0, 1.2, -0.3);
    scene.add(button);

    // ボタンの枠を追加
    const buttonFrameGeometry = new THREE.SphereGeometry(0.11, 32, 32); // 少し大きい球体
    const buttonFrameMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
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
            audio.setVolume(1.0);
            console.log("音声ファイルの読み込みが完了しました");

            // アナライザーの設定
            analyser = new THREE.AudioAnalyser(audio, 32);
            dataArray = new Uint8Array(analyser.analyser.frequencyBinCount);
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
        },
        function (error) {
            console.error("音声ファイルの読み込みに失敗しました:", error);
        }
    );

    // ビジュアライザーの作成
    visualizerGroup = new THREE.Group();
    visualizerGroup.position.copy(button.position);
    visualizerGroup.position.y -= 0.2; // ボタンより少し下に
    visualizerGroup.position.z -= 0.2; // ボタンより奥に
    scene.add(visualizerGroup);

    // 周波数バーの作成
    const barCount = 32;
    const barWidth = 0.02;
    const barHeight = 0.1;
    const radius = 0.3; // 円の半径

    for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2; // 円周上の角度
        const barGeometry = new THREE.BoxGeometry(barWidth, barHeight, 0.1);
        const barMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5,
        });
        const bar = new THREE.Mesh(barGeometry, barMaterial);

        // バーを反円形に配置（Y軸を反転）
        bar.position.x = Math.cos(angle) * radius;
        bar.position.z = Math.sin(angle) * radius;
        bar.position.y = -Math.abs(Math.sin(angle)) * 0.1; // 下向きのカーブを作成
        bar.rotation.y = -angle; // バーを円の接線方向に向ける
        visualizerGroup.add(bar);
        bars.push(bar);
    }

    // VRボタンの追加
    document.body.appendChild(VRButton.createButton(renderer));

    window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function getIntersections(hand) {
    // 人差し指の先端と親指の先端の両方をチェック
    const indexTip = hand.joints["index-finger-tip"];
    const thumbTip = hand.joints["thumb-tip"];

    if (!indexTip || !thumbTip) return [];

    const indexPosition = new THREE.Vector3();
    const thumbPosition = new THREE.Vector3();
    indexTip.getWorldPosition(indexPosition);
    thumbTip.getWorldPosition(thumbPosition);

    // 人差し指と親指の中点を計算
    const pinchPosition = new THREE.Vector3()
        .addVectors(indexPosition, thumbPosition)
        .multiplyScalar(0.5);

    // ボタンの位置を取得
    const buttonPosition = new THREE.Vector3();
    button.getWorldPosition(buttonPosition);

    // ピンチ位置とボタンの距離を計算
    const distance = pinchPosition.distanceTo(buttonPosition);

    // デバッグ用のログ
    console.log("Distance to button:", distance);

    // 判定距離を広げる（0.2m）
    if (distance < 0.2) {
        return [
            {
                object: button,
                distance: distance,
            },
        ];
    }

    return [];
}

function onPinchStart() {
    const hand = this;
    const intersections = getIntersections(hand);

    if (intersections.length > 0) {
        const intersection = intersections[0];
        const object = intersection.object;

        if (object === button) {
            console.log("Button pressed!"); // デバッグ用のログ
            button.material.color.setHex(0xff0000);
            button.material.emissive.setHex(0xff0000);
            button.material.emissiveIntensity = 0.8;
            button.scale.set(0.9, 0.9, 0.9);

            if (audio && audio.buffer) {
                audio.stop();
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
    button.material.emissiveIntensity = 0.5; // 通常時の発光強度も上げる
    button.scale.set(1, 1, 1);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render() {
    if (analyser && audio.isPlaying) {
        analyser.getFrequencyData(dataArray);

        // 各バーの高さと色を更新
        for (let i = 0; i < bars.length; i++) {
            const value = dataArray[i] / 255; // 0-1の範囲に正規化
            const bar = bars[i];

            // 高さを更新（より大きな変化を付ける）
            const minHeight = 0.05; // 最小高さ
            const maxHeight = 0.3; // 最大高さ
            bar.scale.y = minHeight + value * (maxHeight - minHeight);

            // 色は固定（発光効果は維持）
            const hue = i / bars.length;
            const color = new THREE.Color().setHSL(hue, 1, 0.5);
            bar.material.color.copy(color);
            bar.material.emissive.copy(color);
            bar.material.emissiveIntensity = 0.5; // 固定の発光強度
        }
    }

    renderer.render(scene, camera);
}
