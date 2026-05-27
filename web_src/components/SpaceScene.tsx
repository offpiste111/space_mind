import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Cloud } from '@react-three/drei';
import { DoubleSide } from 'three';
import * as THREE from 'three';

const createGalaxyTexture = (): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // 円状のグラデーションを作成
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.4, 'rgba(128, 200, 255, 0.4)'); // ほんのり青い光彩
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
};

interface GalaxyProps {
    opacity: number;
    key?: number;  // keyをオプショナルプロパティとして追加
}

const Galaxy = ({ opacity }: GalaxyProps): JSX.Element => {
    const galaxyRef = useRef<THREE.Group>(null);
    const galaxyTexture = useMemo(() => createGalaxyTexture(), []);
    
    // 銀河のパラメータ
    const params = useMemo(() => ({
        count: 15000,           // 星の数
        size: 0.02,            // 星のサイズを小さく調整
        radius: 100,            // 銀河の半径を小さく
        branches: 100, // 渦巻きの腕の数
        spin:  0,    // 渦の回転度合い（-1から1）
        randomness: 0.05,        // ランダム性を増加（メッシュの広がりを強く）
        randomnessPower: 2.5,   // ランダム性の指数を調整
        insideColor: new THREE.Color(Math.random() < 0.5 ? '#ff6030' : '#ffae30'), // 内側の色
        outsideColor: new THREE.Color(Math.random() < 0.5 ? '#1b3984' : '#50a5dd'), // 外側の色
        // 銀河の位置（遠くに配置）
        position: new THREE.Vector3(
            (Math.random() - 0.5) * 400, 
            (Math.random() - 0.5) * 200, 
            -300 - Math.random() * 200
        ),
        // 銀河の回転（ランダムな向き）
        rotation: new THREE.Euler(
            Math.random() * Math.PI, 
            Math.random() * Math.PI, 
            Math.random() * Math.PI
        ),
        // スケール（大きく）
        scale: 1.5 + Math.random() * 1.0
    }), []);
    
    // 銀河の星の位置、色、サイズを生成
    const [positions, colors, sizes] = useMemo(() => {
        const positions = new Float32Array(params.count * 3);
        const colors = new Float32Array(params.count * 3); // RGBのために3つの要素
        const sizes = new Float32Array(params.count);
        
        for (let i = 0; i < params.count; i++) {
            const i3 = i * 3;
            
            // 銀河の中心からの距離（二乗分布で端に向かって密度が下がるように）
            const radiusRatio = Math.pow(Math.random(), 2); // 1.5乗にすることで端に向かって星が少なくなる
            const radius = radiusRatio * params.radius;
            
            // 渦巻きの角度
            const branchAngle = ((i % params.branches) / params.branches) * Math.PI * 2;
            
            // 渦の回転を適用
            const spinAngle = radius * params.spin;
            
            // ランダム性を追加（端に向かってランダム性を増加）
            const randomFactor = 1 + radiusRatio * 3; // 端に向かってさらにランダム性を増加
            const randomX = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius * randomFactor;
            const randomY = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius * randomFactor;
            const randomZ = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius * randomFactor;
            
            // 位置を設定
            positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
            positions[i3 + 1] = randomY;
            positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;
            
            // 色を設定（中心から外側に向かってグラデーション）
            const colorInside = params.insideColor;
            const colorOutside = params.outsideColor;
            
            const mixedColor = colorInside.clone();
            mixedColor.lerp(colorOutside, radiusRatio);
            
            // 色を設定（外側ほど暗く）
            const fadeOut = Math.pow(1 - radiusRatio, 2); // 2乗で自然な減衰
            const intensity = Math.max(0.02, fadeOut); // より暗く
            const darkColor = mixedColor.clone().multiplyScalar(intensity);
            colors[i3] = darkColor.r;
            colors[i3 + 1] = darkColor.g;
            colors[i3 + 2] = darkColor.b;

            // サイズを設定（中心から外側に向かって小さくなる）
            sizes[i] = params.size * (1 - radiusRatio * 0.5); // 端に向かって星のサイズが小さくなる
        }
        
        return [positions, colors, sizes];
    }, [params]);
    
    // 銀河をゆっくり回転・移動させる
    useFrame(({ clock }) => {
        if (galaxyRef.current) {
            const time = clock.getElapsedTime();
            // より遅い回転速度
            galaxyRef.current.rotation.y = time * 0.002;
            galaxyRef.current.rotation.x = time * 0.001;
            
            // 少しずつ移動する（遠景でのゆっくりとした漂い）
            galaxyRef.current.position.x = params.position.x + Math.sin(time * 0.05) * 20;
            galaxyRef.current.position.y = params.position.y + Math.cos(time * 0.03) * 15;
            galaxyRef.current.position.z = params.position.z + Math.sin(time * 0.02) * 10;
        }
    });
    
    return (
        <group 
            ref={galaxyRef} 
            position={[params.position.x, params.position.y, params.position.z]}
            rotation={[params.rotation.x, params.rotation.y, params.rotation.z]}
            scale={params.scale}
        >
            <points>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[positions, 3]}
                        count={positions.length / 3}
                        array={positions}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-color"
                        args={[colors, 3]}
                        count={colors.length / 3}
                        array={colors}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-size"
                        args={[sizes, 1]}
                        count={sizes.length}
                        array={sizes}
                        itemSize={1}
                    />
                </bufferGeometry>
                <pointsMaterial
                    size={0.8}
                    sizeAttenuation={true}
                    depthWrite={false}
                    vertexColors={true}
                    blending={THREE.AdditiveBlending}
                    transparent={true}
                    opacity={opacity * 0.7}
                    map={galaxyTexture}
                />
            </points>
            {/* 雲のようなネビュラ（星雲）表現 - より広く薄く */}
            <Cloud
                opacity={opacity * 0.05}
                speed={0.05}
                bounds={[params.radius * 3, params.radius * 0.5, params.radius * 3]}
                volume={params.radius * 2}
                segments={80}
                color="#00ffff" // シアン
                position={[0, 0, 0]}
            />
            <Cloud
                opacity={opacity * 0.1}
                speed={0.08}
                bounds={[params.radius * 2.5, params.radius * 0.8, params.radius * 2.5]}
                volume={params.radius * 1.5}
                segments={60}
                color="#ff1493" // 鮮やかなピンク
                position={[params.radius * 0.5, 0, params.radius * 0.5]}
            />
            <Cloud
                opacity={opacity * 0.3}
                speed={0.03}
                bounds={[params.radius * 3.5, params.radius * 0.6, params.radius * 3.5]}
                volume={params.radius * 2.5}
                segments={90}
                color="#1b3984" // 深い青
                position={[-params.radius * 0.5, params.radius * 0.2, -params.radius * 0.5]}
            />
        </group>
    );
};

const Moon = ({ parentPosition }: { parentPosition: THREE.Vector3 }) => {
    const moonRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/moonmap1k.jpg'), []);
    
    // 地球の周りの公転
    const orbitRadius = 4; // 地球からの距離
    const orbitSpeed = 0.25; // 公転速度
    
    useFrame(({ clock }) => {
        if (moonRef.current) {
            // 自転
            moonRef.current.rotation.y = clock.getElapsedTime() * 0.3;
            
            // 地球を中心とした公転
            const time = clock.getElapsedTime() * orbitSpeed;
            moonRef.current.position.x = parentPosition.x + Math.cos(time) * orbitRadius;
            moonRef.current.position.y = parentPosition.y;
            moonRef.current.position.z = parentPosition.z + Math.sin(time) * orbitRadius;
        }
    });
    
    return (
        <mesh ref={moonRef}>
            <sphereGeometry args={[0.5, 32, 32]} />
            <meshStandardMaterial
                map={texture}
                metalness={0.4}
                roughness={0.7}
            />
        </mesh>
    );
};

const Earth = () => {
    const earthRef = useRef<THREE.Mesh>(null);
    const earthPosition = useRef(new THREE.Vector3());
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/earthmap1k.jpg'), []);
    
    // 公転の中心座標
    const orbitRadius = 150;
    const orbitSpeed = 0.02;
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    const orbitTiltX = useMemo(() => (Math.random() - 0.5) * Math.PI / 6, []);
    const orbitTiltZ = useMemo(() => (Math.random() - 0.5) * Math.PI / 6, []);
    
    useFrame(({ clock }) => {
        if (earthRef.current) {
            // 自転 (Y軸周り)
            earthRef.current.rotation.y = clock.getElapsedTime() * 0.5;
            
            // 公転 (XZ平面上で円運動)（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
            const x = Math.cos(time) * orbitRadius;
            const z = Math.sin(time) * orbitRadius;
            
            earthRef.current.position.set(x, 0, z);
            earthPosition.current.set(x, 0, z);
        }
    });
  
    return (
        <group rotation={[orbitTiltX, 0, orbitTiltZ]}>
            <mesh ref={earthRef}>
                <sphereGeometry args={[2, 64, 64]} />
                <meshStandardMaterial
                    map={texture}
                    metalness={0.4}
                    roughness={0.7}
                />
            </mesh>
            <Moon parentPosition={earthPosition.current} />
        </group>
    );
};

const ShootingStarMesh = () => {
    const starCount = 3; // 流れ星の数を変数として定義
    const particlesRef = useRef<THREE.Points>(null);
    const positions = useMemo(() => {
        const pos = new Float32Array(starCount * 3); // starCount個の流れ星 x (x,y,z)
        for (let i = 0; i < starCount; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 80;   // x: -40 to 40
            pos[i * 3 + 1] = 40 + Math.random() * 20;  // y: 40 to 60
            pos[i * 3 + 2] = (Math.random() - 0.5) * 80;   // z: -40 to 40
        }
        return pos;
    }, []);

    // 速度を初期化（斜め上から斜め下に流れるように）
    const initSpeeds = () => {
        let angle;
        // 左上から右下または右上から左下のランダムな方向
        if (Math.random() < 0.5) {
            // 左上から右下：30度から60度
            angle = (Math.random() * (Math.PI/6)) + (Math.PI/6); // 30-60度（π/6=30度, π/3=60度）
        } else {
            // 右上から左下：120度から150度
            angle = (Math.random() * (Math.PI/6)) + (2*Math.PI/3); // 120-150度（2π/3=120度, 5π/6=150度）
        }
        const speed = Math.random() * 0.2 + 0.2; // 0.2-0.4の範囲
        return {
            dx: Math.cos(angle) * speed,  // x方向の速度
            dy: -Math.sin(angle) * speed  // y方向の速度（負の値で下向き）
        };
    };

    const speeds = useMemo(() => {
        const arr = new Float32Array(starCount * 2);
        for (let i = 0; i < starCount; i++) {
            const { dx, dy } = initSpeeds();
            arr[i * 2] = dx;
            arr[i * 2 + 1] = dy;
        }
        return arr;
    }, []);

    useFrame(({ clock }) => {
        if (particlesRef.current) {
            const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
            const time = clock.getElapsedTime();

            for (let i = 0; i < positions.length; i += 3) {
                positions[i] += speeds[Math.floor(i / 3) * 2];     // x方向に移動
                positions[i + 1] += speeds[Math.floor(i / 3) * 2 + 1];  // y方向に移動

                // 画面外に出たらリセット
                if (positions[i] > 50 || positions[i] < -50 || positions[i + 1] < -25) {
                    // 画面上部にリセット
                    positions[i] = (Math.random() - 0.5) * 80;  // x位置はランダム
                    positions[i + 1] = 40 + Math.random() * 20;  // 上部（y: 40-60）
                    positions[i + 2] = (Math.random() - 0.5) * 80;  // z位置はランダム

                    // 新しい速度を設定（左上から右下または右上から左下）
                    let angle;
                    if (Math.random() < 0.5) {
                        // 左上から右下：30度から60度
                        angle = (Math.random() * (Math.PI/6)) + (Math.PI/6); // 30-60度
                    } else {
                        // 右上から左下：120度から150度
                        angle = (Math.random() * (Math.PI/6)) + (2*Math.PI/3); // 120-150度
                    }
                    const speed = Math.random() * 0.2 + 0.2;
                    speeds[Math.floor(i / 3) * 2] = Math.cos(angle) * speed;
                    speeds[Math.floor(i / 3) * 2 + 1] = -Math.sin(angle) * speed; // 負の値で下向き
                }
            }
            particlesRef.current.geometry.attributes.position.needsUpdate = true;
        }
    });

    return (
        <points ref={particlesRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                    count={positions.length / 3}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.12}
                color="#ffffff"
                transparent
                opacity={0.9}
                sizeAttenuation={false}  // 距離に関係なく一定サイズ
                blending={THREE.AdditiveBlending}  // 光が重なって明るく見える
                depthWrite={false}  // 深度バッファに書き込まない
            />
        </points>
    );
};

const MovingStars = () => {
    const starsRef = useRef<THREE.Group | null>(null);
  
    useFrame(({ clock }) => {
        if (starsRef.current) {
            starsRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.1) * 0.2;
            starsRef.current.rotation.y = clock.getElapsedTime() * 0.05;
        }
    });
  
    return (
        <group ref={starsRef}>
            <Stars 
                radius={100}
                depth={50}
                count={500}
                factor={4}
                saturation={0}
                fade={true}
            />
        </group>
    );
};

const Venus = () => {
    const venusRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/venusmap.jpg'), []);
    
    // 公転の設定
    const orbitRadius = 75; // 太陽からの距離（水星と地球の間）
    const orbitSpeed = 0.1725; // 公転速度
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    const orbitTiltX = useMemo(() => (Math.random() - 0.5) * Math.PI / 4, []);
    const orbitTiltZ = useMemo(() => (Math.random() - 0.5) * Math.PI / 4, []);
    
    useFrame(({ clock }) => {
        if (venusRef.current) {
            // 自転（金星は逆回転）
            venusRef.current.rotation.y = -clock.getElapsedTime() * 0.4;
            
            // 公転（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
            const x = Math.cos(time) * orbitRadius;
            const z = Math.sin(time) * orbitRadius;
            
            venusRef.current.position.set(x, 0, z);
        }
    });
    
    return (
        <group rotation={[orbitTiltX, 0, orbitTiltZ]}>
            <mesh ref={venusRef}>
                <sphereGeometry args={[1.9, 64, 64]} />
                <meshStandardMaterial
                    map={texture}
                    metalness={0.4}
                    roughness={0.7}
                />
            </mesh>
        </group>
    );
};

const Jupiter = () => {
    const jupiterRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/jupitermap.jpg'), []);
    
    // 公転の設定
    const orbitRadius = 175; // 太陽からの距離（火星と土星の間）
    const orbitSpeed = 0.075; // 公転速度
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    const orbitTiltX = useMemo(() => (Math.random() - 0.5) * Math.PI / 5, []);
    const orbitTiltZ = useMemo(() => (Math.random() - 0.5) * Math.PI / 5, []);
    
    useFrame(({ clock }) => {
        if (jupiterRef.current) {
            // 自転（木星は高速自転）
            jupiterRef.current.rotation.y = clock.getElapsedTime() * 0.8;
            
            // 公転（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
            const x = Math.cos(time) * orbitRadius;
            const z = Math.sin(time) * orbitRadius;
            
            jupiterRef.current.position.set(x, 0, z);
        }
    });
    
    return (
        <group rotation={[orbitTiltX, 0, orbitTiltZ]}>
            <mesh ref={jupiterRef}>
                <sphereGeometry args={[2.8, 64, 64]} />
                <meshStandardMaterial
                    map={texture}
                    metalness={0.4}
                    roughness={0.7}
                />
            </mesh>
        </group>
    );
};

const Mercury = () => {
    const mercuryRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/mercurymap.jpg'), []);
    
    // 公転の設定
    const orbitRadius = 50; // 太陽からの距離（最も内側）
    const orbitSpeed = 0.2; // 公転速度（最も速い）
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    const orbitTiltX = useMemo(() => (Math.random() - 0.5) * Math.PI / 3, []);
    const orbitTiltZ = useMemo(() => (Math.random() - 0.5) * Math.PI / 3, []);
    
    useFrame(({ clock }) => {
        if (mercuryRef.current) {
            // 自転
            mercuryRef.current.rotation.y = clock.getElapsedTime() * 0.5;
            
            // 公転（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
            const x = Math.cos(time) * orbitRadius;
            const z = Math.sin(time) * orbitRadius;
            
            mercuryRef.current.position.set(x, 0, z);
        }
    });
    
    return (
        <group rotation={[orbitTiltX, 0, orbitTiltZ]}>
            <mesh ref={mercuryRef}>
                <sphereGeometry args={[0.8, 64, 64]} />
                <meshStandardMaterial
                    map={texture}
                    metalness={0.4}
                    roughness={0.7}
                />
            </mesh>
        </group>
    );
};

const Phobos = ({ parentPosition }: { parentPosition: THREE.Vector3 }) => {
    const phobosRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/phobosbump.jpg'), []);
    
    // 火星の周りの公転
    const orbitRadius = 3; // 火星からの距離
    const orbitSpeed = 0.4; // 公転速度（火星の衛星なので速め）
    
    useFrame(({ clock }) => {
        if (phobosRef.current) {
            // 自転
            phobosRef.current.rotation.y = clock.getElapsedTime() * 0.4;
            
            // 火星を中心とした公転
            const time = clock.getElapsedTime() * orbitSpeed;
            phobosRef.current.position.x = parentPosition.x + Math.cos(time) * orbitRadius;
            phobosRef.current.position.y = parentPosition.y;
            phobosRef.current.position.z = parentPosition.z + Math.sin(time) * orbitRadius;
        }
    });
    
    return (
        <mesh ref={phobosRef}>
            <sphereGeometry args={[0.3, 32, 32]} />
            <meshStandardMaterial
                map={texture}
                metalness={0.4}
                roughness={0.7}
            />
        </mesh>
    );
};

const Mars = () => {
    const marsRef = useRef<THREE.Mesh>(null);
    const marsPosition = useRef(new THREE.Vector3());
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/marsmap1k.jpg'), []);
    
    // 公転の設定
    const orbitRadius = 125; // 太陽からの距離（地球と木星の間）
    const orbitSpeed = 0.15; // 公転速度
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    const orbitTiltX = useMemo(() => (Math.random() - 0.5) * Math.PI / 4.5, []);
    const orbitTiltZ = useMemo(() => (Math.random() - 0.5) * Math.PI / 4.5, []);
    
    useFrame(({ clock }) => {
        if (marsRef.current) {
            // 自転
            marsRef.current.rotation.y = clock.getElapsedTime() * 0.4;
            
            // 公転（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
            const x = Math.cos(time) * orbitRadius;
            const z = Math.sin(time) * orbitRadius;
            
            marsRef.current.position.set(x, 0, z);
            marsPosition.current.set(x, 0, z);
        }
    });
    
    return (
        <group rotation={[orbitTiltX, 0, orbitTiltZ]}>
            <mesh ref={marsRef}>
                <sphereGeometry args={[1.2, 64, 64]} />
                <meshStandardMaterial
                    map={texture}
                    metalness={0.4}
                    roughness={0.7}
                />
            </mesh>
            <Phobos parentPosition={marsPosition.current} />
        </group>
    );
};

const Pluto = () => {
    const plutoRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/plutomap1k.jpg'), []);
    
    // 公転の設定
    const orbitRadius = 300; // 太陽からの距離（最も外側）
    const orbitSpeed = 0.015; // 公転速度（最も遅い）
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    const orbitTiltX = useMemo(() => (Math.random() - 0.5) * Math.PI / 2.5, []);
    const orbitTiltZ = useMemo(() => (Math.random() - 0.5) * Math.PI / 2.5, []);
    
    useFrame(({ clock }) => {
        if (plutoRef.current) {
            // 自転
            plutoRef.current.rotation.y = clock.getElapsedTime() * 0.2;
            
            // 公転（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
            const x = Math.cos(time) * orbitRadius;
            const z = Math.sin(time) * orbitRadius;
            
            plutoRef.current.position.set(x, 0, z);
        }
    });
    
    return (
        <group rotation={[orbitTiltX, 0, orbitTiltZ]}>
            <mesh ref={plutoRef}>
                <sphereGeometry args={[0.4, 64, 64]} />
                <meshStandardMaterial
                    map={texture}
                    metalness={0.4}
                    roughness={0.7}
                />
            </mesh>
        </group>
    );
};

const Uranus = () => {
    const uranusRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/uranusmap.jpg'), []);
    
    // 公転の設定
    const orbitRadius = 225; // 太陽からの距離（土星と海王星の間）
    const orbitSpeed = 0.035; // 公転速度
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    const orbitTiltX = useMemo(() => (Math.random() - 0.5) * Math.PI / 3, []);
    const orbitTiltZ = useMemo(() => (Math.random() - 0.5) * Math.PI / 3, []);
    
    useFrame(({ clock }) => {
        if (uranusRef.current) {
            // 自転（横倒しになった自転）
            uranusRef.current.rotation.z = clock.getElapsedTime() * 0.3;
            
            // 公転（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
            const x = Math.cos(time) * orbitRadius;
            const z = Math.sin(time) * orbitRadius;
            
            uranusRef.current.position.set(x, 0, z);
        }
    });
    
    return (
        <group rotation={[orbitTiltX, 0, orbitTiltZ]}>
            <mesh ref={uranusRef} rotation={[0, 0, Math.PI / 2]}> // 初期姿勢を横倒しに
                <sphereGeometry args={[1.7, 64, 64]} />
                <meshStandardMaterial
                    map={texture}
                    metalness={0.4}
                    roughness={0.7}
                />
            </mesh>
        </group>
    );
};

const Neptune = () => {
    const neptuneRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/neptunemap.jpg'), []);
    
    // 公転の設定
    const orbitRadius = 250; // 太陽からの距離（最も外側）
    const orbitSpeed = 0.025; // 公転速度（最も遅い）
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    const orbitTiltX = useMemo(() => (Math.random() - 0.5) * Math.PI / 4, []);
    const orbitTiltZ = useMemo(() => (Math.random() - 0.5) * Math.PI / 4, []);
    
    useFrame(({ clock }) => {
        if (neptuneRef.current) {
            // 自転
            neptuneRef.current.rotation.y = clock.getElapsedTime() * 0.3;
            
            // 公転（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
            const x = Math.cos(time) * orbitRadius;
            const z = Math.sin(time) * orbitRadius;
            
            neptuneRef.current.position.set(x, 0, z);
        }
    });
    
    return (
        <group rotation={[orbitTiltX, 0, orbitTiltZ]}>
            <mesh ref={neptuneRef}>
                <sphereGeometry args={[1.6, 64, 64]} />
                <meshStandardMaterial
                    map={texture}
                    metalness={0.4}
                    roughness={0.7}
                />
            </mesh>
        </group>
    );
};

const Saturn = () => {
    const saturnRef = useRef<THREE.Mesh>(null);
    const ringsRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/saturnmap.jpg'), []);
    const ringsTexture = useMemo(() => new THREE.TextureLoader().load('./assets/saturnringpattern.gif'), []);
    
    // 公転の設定
    const orbitRadius = 200; // 太陽からの距離
    const orbitSpeed = 0.05; // 公転速度
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    const orbitTiltX = useMemo(() => (Math.random() - 0.5) * Math.PI / 4, []);
    const orbitTiltZ = useMemo(() => (Math.random() - 0.5) * Math.PI / 4, []);
   
    useFrame(({ clock }) => {
        if (saturnRef.current && ringsRef.current) {
            // 自転
            saturnRef.current.rotation.y = clock.getElapsedTime() * 0.3;
            ringsRef.current.rotation.y = clock.getElapsedTime() * 0.3;
            
            // 公転（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
            const x = Math.cos(time) * orbitRadius;
            const z = Math.sin(time) * orbitRadius;
            
            saturnRef.current.position.set(x, 0, z);
            ringsRef.current.position.set(x, 0, z);
        }
    });
    
    return (
        <group rotation={[orbitTiltX, 0, orbitTiltZ]}>
            <mesh ref={saturnRef}>
                <sphereGeometry args={[1.8, 64, 64]} />
                <meshStandardMaterial
                    map={texture}
                    metalness={0.4}
                    roughness={0.7}
                />
            </mesh>
            <mesh ref={ringsRef} rotation={[Math.PI / 6, 0, 0]}>
                <ringGeometry args={[3.5, 5, 64]} />
                <meshStandardMaterial
                    map={ringsTexture}
                    transparent={true}
                    side={DoubleSide}
                    opacity={0.8}
                />
            </mesh>
        </group>
    );
};

interface GalaxyInstance {
    id: number;
    opacity: number;
}

const MovingGalaxies = ({ galaxyCount, opacity }: { galaxyCount: number; opacity: number }) => {
    const galaxiesRef = useRef<THREE.Group>(null);
    
    // 最初は1つだけ生成
    const [galaxies, setGalaxies] = useState<GalaxyInstance[]>([{
        id: Date.now(),
        opacity: opacity
    }]);
    
    useFrame(({ clock }) => {
        if (galaxiesRef.current) {
            // 全体的なゆっくりとした揺らぎ
            galaxiesRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.05) * 0.1;
            galaxiesRef.current.rotation.y = clock.getElapsedTime() * 0.02;

            // 最大数に達していない場合、ランダムなタイミングで新しい銀河を追加
            if (galaxies.length < galaxyCount) {
                // 毎フレームごく低確率（例: 0.1%の確率）で追加判定
                if (Math.random() < 0.001) {
                    setGalaxies(prev => {
                        if (prev.length < galaxyCount) {
                            return [...prev, { id: Date.now(), opacity: opacity }];
                        }
                        return prev;
                    });
                }
            }
        }
    });

    return (
        <group ref={galaxiesRef}>
            {galaxies.map(galaxy => (
                <Galaxy key={galaxy.id} opacity={galaxy.opacity} />
            ))}
        </group>
    );
};

const BackgroundNebula = () => {
    const nebulaRef = useRef<THREE.Group>(null);
    const group1 = useRef<THREE.Group>(null);
    const group2 = useRef<THREE.Group>(null);
    const group3 = useRef<THREE.Group>(null);
    
    // ランダムな渦のパラメータを生成
    const swirls = useMemo(() => {
        return [
            { speed: 0.01 + Math.random() * 0.01, phase: Math.random() * Math.PI * 2 },
            { speed: -0.015 - Math.random() * 0.01, phase: Math.random() * Math.PI * 2 },
            { speed: 0.005 + Math.random() * 0.01, phase: Math.random() * Math.PI * 2 }
        ];
    }, []);

    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();
        if (nebulaRef.current) {
            // 全体をゆっくり回転・揺らぐ
            nebulaRef.current.rotation.y = time * 0.005;
            nebulaRef.current.rotation.x = Math.sin(time * 0.01) * 0.02;
        }
        
        // 個別の雲グループをランダムな速度と位相で渦巻かせる（Y軸回転）
        if (group1.current) {
            group1.current.rotation.y = time * swirls[0].speed + swirls[0].phase;
            // 上下にも少し揺らすことで複雑な渦を表現
            group1.current.position.y = Math.sin(time * 0.05 + swirls[0].phase) * 20;
        }
        if (group2.current) {
            group2.current.rotation.y = time * swirls[1].speed + swirls[1].phase;
            group2.current.position.y = Math.cos(time * 0.04 + swirls[1].phase) * 15;
        }
        if (group3.current) {
            group3.current.rotation.y = time * swirls[2].speed + swirls[2].phase;
            group3.current.position.y = Math.sin(time * 0.06 + swirls[2].phase) * 25;
        }
    });

    return (
        <group ref={nebulaRef} position={[0, -100, -100]}>
            <group ref={group1}>
                <Cloud
                    opacity={0.02}
                    speed={0.02}
                    bounds={[800, 100, 800]}
                    volume={300}
                    segments={80}
                    color="#66ffff" // シアン
                    position={[100, 0, 0]}
                />
            </group>
            <group ref={group2}>
                <Cloud
                    opacity={0.02}
                    speed={0.015}
                    bounds={[1000, 120, 1000]}
                    volume={400}
                    segments={80}
                    color="#ff1493" // 鮮やかなピンク
                    position={[-50, -20, -50]}
                />
            </group>
            <group ref={group3}>
                <Cloud
                    opacity={0.08}
                    speed={0.01}
                    bounds={[1200, 150, 1200]}
                    volume={500}
                    segments={120}
                    color="#1b3984" // 深い青
                    position={[0, -50, -100]}
                />
            </group>
        </group>
    );
};

export function SpaceScene() {
    // 銀河の設定
    const galaxyCount = 1; // 同時に表示される最大の銀河数
    const galaxyOpacity = 0.8; // より鮮明に表示 (元は0.05)
    
    return (
        <>
            <BackgroundNebula />
            <MovingStars />
            <MovingGalaxies galaxyCount={galaxyCount} opacity={galaxyOpacity} />
            <Mercury />
            <Venus />
            <Earth />
            <Mars />
            <Jupiter />
            <Saturn />
            <Uranus />
            <Neptune />
            <Pluto />
            <ShootingStarMesh />
            <ambientLight intensity={0.8} />
            <pointLight position={[15, 15, 15]} intensity={1.5} />
            <pointLight position={[-15, -15, -15]} intensity={1.0} />
        </>
    );
}
