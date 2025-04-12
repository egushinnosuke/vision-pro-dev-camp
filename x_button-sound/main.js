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
let targetScales = []; // 各バーの目標スケール値
let currentScales = []; // 各バーの現在のスケール値

// 補間・高さパラメータ
const smoothFactor = 0.5; // 補間係数（大きいほど反応が速い）
const minHeight = 0.1; // バーの最小高さ（常に見える高さ）
const maxHeight = 1.0; // バーの最大高さ

init();
animate();

function init() {
    // シーン, カメラ, レンダラーの作成
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.01,
        20
    );
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    // ライトを追加
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    // ハンドトラッキング（VR対応）
    const handModelFactory = new XRHandModelFactory();
    hand1 = renderer.xr.getHand(0);
    hand2 = renderer.xr.getHand(1);
    scene.add(hand1);
    scene.add(hand2);
    hand1.addEventListener("pinchstart", onPinchStart);
    hand1.addEventListener("pinchend", onPinchEnd);
    hand2.addEventListener("pinchstart", onPinchStart);
    hand2.addEventListener("pinchend", onPinchEnd);
    const handModel1 = handModelFactory.createHandModel(hand1, "mesh");
    const handModel2 = handModelFactory.createHandModel(hand2, "mesh");
    hand1.add(handModel1);
    hand2.add(handModel2);

    // ボタンの作成（押下時に音声再生）
    const buttonGeometry = new THREE.SphereGeometry(0.1, 32, 32);
    const buttonMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.5,
        shininess: 100,
    });
    button = new THREE.Mesh(buttonGeometry, buttonMaterial);
    button.position.set(0, 1.2, -0.3);
    scene.add(button);

    // ボタン枠
    const buttonFrameGeometry = new THREE.SphereGeometry(0.11, 32, 32);
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

    // AudioListener の作成・追加
    const listener = new THREE.AudioListener();
    camera.add(listener);
    console.log("初期 AudioContext state:", listener.context.state); // ここで AudioContext 状態を確認

    // Three.js Audio オブジェクトの作成
    audio = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();

    audioLoader.load(
        "music.mp3",
        function (buffer) {
            audio.setBuffer(buffer);
            audio.setVolume(1.0);
            console.log("音声ファイルの読み込みが完了しました");

            // アナライザーの設定
            analyser = new THREE.AudioAnalyser(audio, 64);
            dataArray = new Uint8Array(analyser.analyser.frequencyBinCount);
            console.log(
                "アナライザーの設定完了: バッファサイズ",
                analyser.analyser.frequencyBinCount
            );

            // アナライザーの追加設定
            analyser.analyser.smoothingTimeConstant = 0.3;
            analyser.analyser.minDecibels = -100;
            analyser.analyser.maxDecibels = 0;
            analyser.analyser.fftSize = 64;

            console.log("アナライザーの設定が完了しました");
        },
        (xhr) => {
            console.log("読み込み進捗:", (xhr.loaded / xhr.total) * 100 + "%");
        },
        (err) => {
            console.error("音声ファイルの読み込み失敗:", err);
        }
    );

    // ビジュアライザーグループを作成（ボタンの下かつ奥に配置）
    visualizerGroup = new THREE.Group();
    visualizerGroup.position.copy(button.position);
    visualizerGroup.position.y -= 0.2;
    visualizerGroup.position.z -= 0.2;
    scene.add(visualizerGroup);

    // 周波数バーの作成
    const barCount = 32;
    const barWidth = 0.02;
    const barHeight = 0.1;
    const radius = 0.3;
    // 各バーの初期値設定（常に minHeight で表示）
    for (let i = 0; i < barCount; i++) {
        targetScales[i] = minHeight;
        currentScales[i] = minHeight;
    }
    for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2;
        const barGeometry = new THREE.BoxGeometry(barWidth, barHeight, 0.1);
        // 下端を原点とするため translate
        barGeometry.translate(0, barHeight / 2, 0);
        const barMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5,
        });
        const bar = new THREE.Mesh(barGeometry, barMaterial);
        bar.position.x = Math.cos(angle) * radius;
        bar.position.z = Math.sin(angle) * radius;
        bar.position.y = -Math.abs(Math.sin(angle)) * 0.1;
        bar.rotation.y = -angle;
        visualizerGroup.add(bar);
        bars.push(bar);
    }

    // カメラの初期位置
    camera.position.set(0, 1.6, 1);
    camera.lookAt(0, 1.2, -0.3);

    // VR ボタンの追加
    document.body.appendChild(VRButton.createButton(renderer));

    // VR 非対応時はマウス操作でも再生できるよう設定
    if (!renderer.xr.isPresenting) {
        setupMouseInteraction();
    }
    window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ユーザー操作時に AudioContext を resume() し、音声再生を開始する関数
function startAudio() {
    const context = audio.listener.context;
    console.log("startAudio: AudioContext state before resume:", context.state);

    // 再生中なら一度停止
    if (audio.isPlaying) {
        audio.stop();
    }

    if (context.state === "suspended") {
        context.resume().then(() => {
            console.log("AudioContext resumed, state:", context.state);
            audio.play();
            console.log(
                "Audio.play() 呼び出し後, audio.isPlaying:",
                audio.isPlaying
            );
        });
    } else {
        audio.play();
        console.log("Audio.play() 呼び出し (context already running)");
    }
}

function getIntersections(hand) {
    const indexTip = hand.joints["index-finger-tip"];
    const thumbTip = hand.joints["thumb-tip"];
    if (!indexTip || !thumbTip) return [];
    const indexPos = new THREE.Vector3();
    const thumbPos = new THREE.Vector3();
    indexTip.getWorldPosition(indexPos);
    thumbTip.getWorldPosition(thumbPos);
    const pinchPos = new THREE.Vector3()
        .addVectors(indexPos, thumbPos)
        .multiplyScalar(0.5);
    const buttonPos = new THREE.Vector3();
    button.getWorldPosition(buttonPos);
    const distance = pinchPos.distanceTo(buttonPos);
    console.log("ピンチとボタンの距離:", distance);
    if (distance < 0.2) {
        return [{ object: button, distance }];
    }
    return [];
}

function onPinchStart() {
    const hand = this;
    const intersections = getIntersections(hand);
    if (intersections.length > 0 && intersections[0].object === button) {
        console.log("ピンチでボタン押下検出。Audio 再生を開始します。");
        button.material.color.setHex(0xff0000);
        button.material.emissive.setHex(0xff0000);
        button.material.emissiveIntensity = 0.8;
        button.scale.set(0.9, 0.9, 0.9);
        if (audio && audio.buffer) {
            startAudio();
        }
    }
}

function onPinchEnd() {
    button.material.color.setHex(0x00ff00);
    button.material.emissive.setHex(0x00ff00);
    button.material.emissiveIntensity = 0.5;
    button.scale.set(1, 1, 1);
}

function animate() {
    renderer.setAnimationLoop(render);
}

let frameCounter = 0;
function render() {
    frameCounter++;
    // 1秒毎に状態ログを出力（60フレーム毎）
    if (frameCounter % 60 === 0) {
        console.log(
            "Render status: audio.isPlaying =",
            audio && audio.isPlaying
        );
        if (analyser && dataArray) {
            console.log(
                "Frequency array (最初の10要素):",
                Array.from(dataArray.slice(0, 10))
            );
        }
    }

    if (analyser && audio.isPlaying) {
        analyser.getFrequencyData(dataArray);

        // 各バーの高さと色を更新
        for (let i = 0; i < bars.length; i++) {
            // データ配列のインデックスを調整（低周波数から高周波数まで均等に分布）
            const dataIndex = Math.floor((i / bars.length) * dataArray.length);
            const rawValue = dataArray[dataIndex];
            // -100〜0 dBの範囲を0〜1に正規化
            const value = Math.max(0, Math.min(1, (rawValue + 100) / 100));
            const bar = bars[i];

            // 目標の高さを計算
            const minHeight = 0.1; // 最小高さを0.1に変更
            const maxHeight = 1.5; // 最大高さを1.5に変更
            const targetHeight = minHeight + value * (maxHeight - minHeight);

            // 目標値を更新
            targetScales[i] = targetHeight;

            // 現在の値を目標値に向かって補間（補間係数を0.3に変更）
            currentScales[i] += (targetScales[i] - currentScales[i]) * 0.3;

            // 補間された値でバーの高さを更新
            bar.scale.y = currentScales[i];

            // 色は固定（発光効果は維持）
            const hue = i / bars.length;
            const color = new THREE.Color().setHSL(hue, 1, 0.5);
            bar.material.color.copy(color);
            bar.material.emissive.copy(color);
            bar.material.emissiveIntensity = 0.5;

            // デバッグ用のログ
            if (i === 0) {
                console.log(
                    "Frequency value:",
                    value.toFixed(3),
                    "Raw data:",
                    rawValue,
                    "Height scale:",
                    currentScales[i].toFixed(3)
                );
            }
        }
    } else {
        // 音が再生されていない場合は、すべてのバーを最小高さに戻す
        for (let i = 0; i < bars.length; i++) {
            const bar = bars[i];
            targetScales[i] = 0.1; // 最小高さを0.1に変更
            currentScales[i] += (targetScales[i] - currentScales[i]) * 0.3;
            bar.scale.y = currentScales[i];
        }
    }

    renderer.render(scene, camera);
}

function setupMouseInteraction() {
    let isClickable = true; // クリック可能フラグ

    renderer.domElement.addEventListener("click", function () {
        if (!isClickable) return; // クリック不可なら何もしない

        console.log("マウスクリック検出: Audio 再生を開始します。");
        button.material.color.setHex(0xff0000);
        button.material.emissive.setHex(0xff0000);
        button.material.emissiveIntensity = 0.8;
        button.scale.set(0.9, 0.9, 0.9);

        if (audio && audio.buffer) {
            isClickable = false; // クリック不可に設定
            startAudio();

            // 音声の長さ分待ってからクリック可能に戻す
            setTimeout(() => {
                isClickable = true;
            }, audio.buffer.duration * 1000); // duration は秒単位なので1000倍
        }

        // 0.2秒後にボタンの色・スケールを戻す
        setTimeout(() => {
            button.material.color.setHex(0x00ff00);
            button.material.emissive.setHex(0x00ff00);
            button.material.emissiveIntensity = 0.5;
            button.scale.set(1, 1, 1);
        }, 200);
    });
}

animate();
