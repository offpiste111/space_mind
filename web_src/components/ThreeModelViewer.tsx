/**
 * ThreeModelViewer.tsx
 *
 * CSS3DレイヤーのHTML要素内に独立したThree.jsレンダラーを持ち、
 * 3Dオブジェクトを描画するコンポーネント。
 * これにより、3Dオブジェクトノードが通常ノード（HTML）と同じレイヤーに配置され、
 * 雲・オーラ（WebGLレイヤー）よりも必ず手前に表示されるようになる。
 *
 * 外部からのカメラ追従（lookAt）・Shiftドラッグ回転もサポートする。
 */
import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';

export interface ThreeModelViewerHandle {
    /** カメラ追従OFF時にメインカメラのクォータニオンを適用して向きを固定する */
    alignToCamera: (cameraQuaternion: THREE.Quaternion) => void;
    /** Shiftドラッグ回転を適用する */
    setRotation: (rotX: number, rotY: number) => void;
    /** 選択状態の発光エフェクトを切り替える */
    setSelected: (selected: boolean) => void;
}

export interface ThreeModelViewerProps {
    /** Three.jsのObject3D（モデル本体）。外部でロード済みのcloneを渡す */
    model: THREE.Object3D;
    /** モデルのスタイルID */
    styleId: number;
    /** 表示サイズ (px) */
    size: number;
    /** カメラ追従フラグ */
    cameraTracking: boolean;
    /** ラベルテキスト */
    label?: string;
}

const ThreeModelViewer = forwardRef<ThreeModelViewerHandle, ThreeModelViewerProps>(
    ({ model, styleId, size, cameraTracking, label }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
        const sceneRef = useRef<THREE.Scene | null>(null);
        const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
        const rotationGroupRef = useRef<THREE.Group | null>(null);
        const animFrameRef = useRef<number>(0);
        const selectedRef = useRef<boolean>(false);

        // ユーザー回転とカメラ回転を保持するための ref
        const userRotationRef = useRef<{ rotX: number, rotY: number }>({ rotX: 0, rotY: 0 });
        const cameraQuaternionRef = useRef<THREE.Quaternion>(new THREE.Quaternion());

        // 回転の更新処理
        const updateModelRotation = () => {
            if (!rotationGroupRef.current) return;
            const rotX = userRotationRef.current.rotX;
            const rotY = userRotationRef.current.rotY;
            const qUser = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, 0, 'YXZ'));

            if (!cameraTracking) {
                // カメラ追従OFF（空間固定）: メインカメラの逆回転を乗算する
                const qCamInverse = cameraQuaternionRef.current.clone().invert();
                rotationGroupRef.current.quaternion.multiplyQuaternions(qCamInverse, qUser);
            } else {
                // カメラ追従ON（常に正面）: ユーザー回転のみ適用
                rotationGroupRef.current.quaternion.copy(qUser);
            }
        };

        // cameraTracking の変更を検知して回転を再計算
        useEffect(() => {
            updateModelRotation();
        }, [cameraTracking]);

        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            // ---- Three.jsセットアップ ----
            const renderer = new THREE.WebGLRenderer({
                canvas,
                antialias: true,
                alpha: true,       // 背景を透明に
            });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(size, size);
            renderer.setClearColor(0x000000, 0); // 完全透明背景
            rendererRef.current = renderer;

            const scene = new THREE.Scene();
            sceneRef.current = scene;

            // ライティング
            const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
            scene.add(ambientLight);
            const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
            dirLight.position.set(5, 10, 7);
            scene.add(dirLight);

            // カメラ
            const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
            cameraRef.current = camera;

            // モデルを配置するグループ（回転制御用）
            const rotationGroup = new THREE.Group();
            rotationGroupRef.current = rotationGroup;
            scene.add(rotationGroup);

            // モデルのクローンを配置
            const modelClone = model.clone(true);
            // モデルを中央に寄せる
            const box = new THREE.Box3().setFromObject(modelClone);
            const center = new THREE.Vector3();
            box.getCenter(center);
            modelClone.position.sub(center);
            rotationGroup.add(modelClone);

            // カメラ距離をバウンディングスフィアから自動調整
            const sphere = new THREE.Sphere();
            box.getBoundingSphere(sphere);
            const dist = sphere.radius * 2.8;
            camera.position.set(0, 0, dist);
            camera.lookAt(0, 0, 0);

            // アニメーションループ
            const animate = () => {
                animFrameRef.current = requestAnimationFrame(animate);

                // 選択発光
                if (selectedRef.current) {
                    rotationGroup.traverse((child: any) => {
                        if (child.isMesh && child.material && 'emissive' in child.material) {
                            child.material.emissive = new THREE.Color(0x444444);
                        }
                    });
                } else {
                    rotationGroup.traverse((child: any) => {
                        if (child.isMesh && child.material && 'emissive' in child.material) {
                            child.material.emissive = new THREE.Color(0x000000);
                        }
                    });
                }

                renderer.render(scene, camera);
            };
            animate();

            return () => {
                cancelAnimationFrame(animFrameRef.current);
                renderer.dispose();
            };
        }, [styleId, !!model]);

        // sizeが更新されたときは renderer のサイズのみを更新し、WebGLコンテキストの再作成を防ぐ
        useEffect(() => {
            if (rendererRef.current) {
                rendererRef.current.setSize(size, size);
            }
        }, [size]);

        useImperativeHandle(ref, () => ({
            alignToCamera(cameraQuaternion: THREE.Quaternion) {
                cameraQuaternionRef.current.copy(cameraQuaternion);
                updateModelRotation();
            },
            setRotation(rotX: number, rotY: number) {
                userRotationRef.current = { rotX, rotY };
                updateModelRotation();
            },
            setSelected(selected: boolean) {
                selectedRef.current = selected;
            },
        }), [cameraTracking]);

        return (
            <div
                style={{
                    width: size,
                    height: size,
                    position: 'relative',
                    display: 'inline-block',
                    cursor: 'pointer',
                }}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        width: size,
                        height: size,
                        display: 'block',
                    }}
                />
                {label && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 4,
                            left: 0,
                            right: 0,
                            textAlign: 'center',
                            color: '#ffffff',
                            fontSize: 12,
                            textShadow: '0 0 4px #000, 0 0 4px #000',
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}
                    >
                        {label}
                    </div>
                )}
            </div>
        );
    }
);

ThreeModelViewer.displayName = 'ThreeModelViewer';
export default ThreeModelViewer;
