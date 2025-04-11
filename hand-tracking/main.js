let xrSession = null;
let xrReferenceSpace = null;

// ハンドトラッキングの初期化
async function initXR() {
    if (!navigator.xr) {
        console.error("WebXR not supported");
        return;
    }

    try {
        // ハンドトラッキング機能を要求
        xrSession = await navigator.xr.requestSession("immersive-ar", {
            requiredFeatures: ["local"],
            optionalFeatures: ["hand-tracking"],
        });

        // セッションのイベントリスナーを設定
        xrSession.addEventListener("end", onSessionEnd);
        xrSession.addEventListener("select", onSelect);
        xrSession.addEventListener("selectstart", onSelectStart);
        xrSession.addEventListener("selectend", onSelectEnd);

        // 参照空間を取得
        xrReferenceSpace = await xrSession.requestReferenceSpace("local");

        // レンダリングループを開始
        xrSession.requestAnimationFrame(onXRFrame);
    } catch (error) {
        console.error("Error initializing XR:", error);
    }
}

// セッション終了時の処理
function onSessionEnd() {
    xrSession = null;
    xrReferenceSpace = null;
}

// フレーム更新時の処理
function onXRFrame(timestamp, frame) {
    if (!xrSession) return;

    // 入力ソースを取得
    const inputSources = frame.session.inputSources;

    // 各入力ソースに対して処理
    for (const inputSource of inputSources) {
        if (inputSource.hand) {
            // ハンドトラッキングデータを取得
            const hand = inputSource.hand;

            // 各関節の位置を取得して処理
            for (const jointName of hand.keys()) {
                const joint = hand.get(jointName);
                if (joint) {
                    const jointPose = frame.getPose(joint, xrReferenceSpace);
                    if (jointPose) {
                        // ここで関節の位置を使用して何らかの処理を行う
                        console.log(
                            `Joint ${jointName}:`,
                            jointPose.transform.position
                        );
                    }
                }
            }
        }
    }

    // 次のフレームを要求
    xrSession.requestAnimationFrame(onXRFrame);
}

// イベントハンドラー
function onSelect(event) {
    console.log("Select event:", event);
}

function onSelectStart(event) {
    console.log("Select start:", event);
}

function onSelectEnd(event) {
    console.log("Select end:", event);
}

// スタートボタンのイベントリスナーを設定
document.getElementById("startAR").addEventListener("click", initXR);
