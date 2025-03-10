import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { DoubleSide } from 'three';
import * as THREE from 'three';

interface GalaxyProps {
    opacity: number;
    key?: number;  // keyをオプショナルプロパティとして追加
}

const Galaxy = ({ opacity }: GalaxyProps): JSX.Element => {
    const galaxyRef = useRef<THREE.Points>(null);
    
    // 銀河のパラメータ
    const params = useMemo(() => ({
        count: 15000,           // 星の数
        size: 0.02,            // 星のサイズを小さく調整
        radius: 50,            // 銀河の半径を小さく
        branches: 10 + Math.floor(Math.random() * 3), // 渦巻きの腕の数
        spin: Math.random() * 2 - 1,    // 渦の回転度合い（-1から1）
        randomness: 0.5,        // ランダム性を増加（メッシュの広がりを強く）
        randomnessPower: 2.5,   // ランダム性の指数を調整
        insideColor: new THREE.Color(Math.random() < 0.5 ? '#ff6030' : '#ffae30'), // 内側の色
        outsideColor: new THREE.Color(Math.random() < 0.5 ? '#1b3984' : '#50a5dd'), // 外側の色
        // 銀河の位置（より近くに配置）
        position: new THREE.Vector3(
            (Math.random() - 0.5) * 100, 
            (Math.random() - 0.5) * 100, 
            -50 - Math.random() * 50
        ),
        // 銀河の回転（ランダムな向き）
        rotation: new THREE.Euler(
            Math.random() * Math.PI, 
            Math.random() * Math.PI, 
            Math.random() * Math.PI
        ),
        // スケール（より小さく）
        scale: 0.3 + Math.random() * 0.5
    }), []);
    
    // 銀河の星の位置、色、サイズを生成
    const [positions, colors, sizes] = useMemo(() => {
        const positions = new Float32Array(params.count * 3);
        const colors = new Float32Array(params.count * 3); // RGBのために3つの要素
        const sizes = new Float32Array(params.count);
        
        for (let i = 0; i < params.count; i++) {
            const i3 = i * 3;
            
            // 銀河の中心からの距離（二乗分布で端に向かって密度が下がるように）
            const radiusRatio = Math.pow(Math.random(), 1.5); // 1.5乗にすることで端に向かって星が少なくなる
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
    
    // 銀河をゆっくり回転させる
    useFrame(({ clock }) => {
        if (galaxyRef.current) {
            // より遅い回転速度
            galaxyRef.current.rotation.y = clock.getElapsedTime() * 0.02;
        }
    });
    
    return (
        <points 
            ref={galaxyRef} 
            position={[params.position.x, params.position.y, params.position.z]}
            rotation={[params.rotation.x, params.rotation.y, params.rotation.z]}
            scale={params.scale}
        >
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
                sizeAttenuation={true}
                depthWrite={false}
                vertexColors={true}
                blending={THREE.AdditiveBlending}
                transparent={true}
                opacity={opacity * 0.25} // より薄く
                alphaTest={0.001} // 透明度の閾値を設定
            />
        </points>
    );
};

const Moon = ({ parentPosition }: { parentPosition: THREE.Vector3 }) => {
    const moonRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/moonmap1k.jpg'), []);
    
    // 地球の周りの公転
    const orbitRadius = 4; // 地球からの距離
    const orbitSpeed = 0.5; // 公転速度
    
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
    const orbitSpeed = 0.2;
    
    useFrame(({ clock }) => {
        if (earthRef.current) {
            // 自転 (Y軸周り)
            earthRef.current.rotation.y = clock.getElapsedTime() * 0.5;
            
            // 公転 (XZ平面上で円運動)
            const time = clock.getElapsedTime() * orbitSpeed;
            const x = Math.cos(time) * orbitRadius;
            const z = Math.sin(time) * orbitRadius;
            
            earthRef.current.position.set(x, 0, z);
            earthPosition.current.set(x, 0, z);
        }
    });
  
    return (
        <>
            <mesh ref={earthRef}>
                <sphereGeometry args={[2, 64, 64]} />
                <meshStandardMaterial
                    map={texture}
                    metalness={0.4}
                    roughness={0.7}
                />
            </mesh>
            <Moon parentPosition={earthPosition.current} />
        </>
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
                opacity={0.7}
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
                count={5000}
                factor={4}
                saturation={0}
                fade={true}
            />
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
    const orbitSpeed = 0.1; // 公転速度
    
    useFrame(({ clock }) => {
        if (saturnRef.current && ringsRef.current) {
            // 自転
            saturnRef.current.rotation.y = clock.getElapsedTime() * 0.3;
            ringsRef.current.rotation.y = clock.getElapsedTime() * 0.3;
            
            // 公転（軌道面を傾ける）
            const time = clock.getElapsedTime() * orbitSpeed;
            const orbitAngle = Math.PI / 12; // 15度の傾き
            const x = Math.cos(time) * orbitRadius;
            const y = Math.sin(time) * Math.sin(orbitAngle) * orbitRadius;
            const z = Math.sin(time) * Math.cos(orbitAngle) * orbitRadius;
            
            saturnRef.current.position.set(x, y, z);
            ringsRef.current.position.set(x, y, z);
        }
    });
    
    return (
        <>
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
        </>
    );
};

interface GalaxyInstance {
    id: number;
    opacity: number;
}

const MovingGalaxies = ({ galaxyCount, opacity }: { galaxyCount: number; opacity: number }) => {
    const galaxiesRef = useRef<THREE.Group>(null);
    const [galaxies, setGalaxies] = useState<GalaxyInstance[]>([]);
    const spawnGalaxy = useCallback(() => {
        const newId = Date.now();
        setGalaxies(prev => {
            const newGalaxies = [...prev, { id: newId, opacity }];
            return newGalaxies.slice(-galaxyCount); // 最大数を維持
        });
    }, [galaxyCount, opacity]);

    useFrame(({ clock }) => {
        if (galaxiesRef.current) {
            galaxiesRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.03) * 0.1;
            galaxiesRef.current.rotation.y = clock.getElapsedTime() * 0.02;

            // ランダムな確率で銀河を生成（毎フレーム0.5%の確率）
            if (Math.random() < 0.005) {
                spawnGalaxy();
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

export function SpaceScene() {
    // 銀河の設定
    const galaxyCount = 3; // 同時に表示される最大の銀河数
    const galaxyOpacity = 0.15; // より鮮明に表示
    
    return (
        <>
            <MovingStars />
            <Earth />
            <Saturn />
            <ShootingStarMesh />
            <MovingGalaxies galaxyCount={galaxyCount} opacity={galaxyOpacity} />
            <ambientLight intensity={0.8} />
            <pointLight position={[15, 15, 15]} intensity={1.5} />
            <pointLight position={[-15, -15, -15]} intensity={1.0} />
        </>
    );
}
