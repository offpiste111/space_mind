import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { DoubleSide } from 'three';
import * as THREE from 'three';

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
    const orbitRadius = 100;
    const orbitSpeed = 0.2;
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    
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

const Venus = () => {
    const venusRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/venusmap.jpg'), []);
    
    // 公転の設定
    const orbitRadius = 75; // 太陽からの距離（水星と地球の間）
    const orbitSpeed = 0.35; // 公転速度
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    
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
        <mesh ref={venusRef}>
            <sphereGeometry args={[1.9, 64, 64]} />
            <meshStandardMaterial
                map={texture}
                metalness={0.4}
                roughness={0.7}
            />
        </mesh>
    );
};

const Jupiter = () => {
    const jupiterRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/jupitermap.jpg'), []);
    
    // 公転の設定
    const orbitRadius = 175; // 太陽からの距離（火星と土星の間）
    const orbitSpeed = 0.15; // 公転速度
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    
    useFrame(({ clock }) => {
        if (jupiterRef.current) {
            // 自転（木星は高速自転）
            jupiterRef.current.rotation.y = clock.getElapsedTime() * 0.8;
            
            // 公転（軌道面を少し傾ける）（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
            const orbitAngle = Math.PI / 30; // 6度の傾き
            const x = Math.cos(time) * orbitRadius;
            const y = Math.sin(time) * Math.sin(orbitAngle) * orbitRadius;
            const z = Math.sin(time) * Math.cos(orbitAngle) * orbitRadius;
            
            jupiterRef.current.position.set(x, y, z);
        }
    });
    
    return (
        <mesh ref={jupiterRef}>
            <sphereGeometry args={[2.8, 64, 64]} />
            <meshStandardMaterial
                map={texture}
                metalness={0.4}
                roughness={0.7}
            />
        </mesh>
    );
};

const Mercury = () => {
    const mercuryRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/mercurymap.jpg'), []);
    
    // 公転の設定
    const orbitRadius = 50; // 太陽からの距離（最も内側）
    const orbitSpeed = 0.4; // 公転速度（最も速い）
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    
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
        <mesh ref={mercuryRef}>
            <sphereGeometry args={[0.8, 64, 64]} />
            <meshStandardMaterial
                map={texture}
                metalness={0.4}
                roughness={0.7}
            />
        </mesh>
    );
};

const Phobos = ({ parentPosition }: { parentPosition: THREE.Vector3 }) => {
    const phobosRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/phobosbump.jpg'), []);
    
    // 火星の周りの公転
    const orbitRadius = 3; // 火星からの距離
    const orbitSpeed = 0.8; // 公転速度（火星の衛星なので速め）
    
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
    const orbitSpeed = 0.3; // 公転速度
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    
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
        <>
            <mesh ref={marsRef}>
                <sphereGeometry args={[1.2, 64, 64]} />
                <meshStandardMaterial
                    map={texture}
                    metalness={0.4}
                    roughness={0.7}
                />
            </mesh>
            <Phobos parentPosition={marsPosition.current} />
        </>
    );
};

const Pluto = () => {
    const plutoRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/plutomap1k.jpg'), []);
    
    // 公転の設定
    const orbitRadius = 300; // 太陽からの距離（最も外側）
    const orbitSpeed = 0.03; // 公転速度（最も遅い）
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    
    useFrame(({ clock }) => {
        if (plutoRef.current) {
            // 自転
            plutoRef.current.rotation.y = clock.getElapsedTime() * 0.2;
            
            // 公転（軌道面を大きく傾ける）（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
            const orbitAngle = Math.PI / 10.5; // 約17度の傾き
            const x = Math.cos(time) * orbitRadius;
            const y = Math.sin(time) * Math.sin(orbitAngle) * orbitRadius;
            const z = Math.sin(time) * Math.cos(orbitAngle) * orbitRadius;
            
            plutoRef.current.position.set(x, y, z);
        }
    });
    
    return (
        <mesh ref={plutoRef}>
            <sphereGeometry args={[0.4, 64, 64]} />
            <meshStandardMaterial
                map={texture}
                metalness={0.4}
                roughness={0.7}
            />
        </mesh>
    );
};

const Uranus = () => {
    const uranusRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/uranusmap.jpg'), []);
    
    // 公転の設定
    const orbitRadius = 225; // 太陽からの距離（土星と海王星の間）
    const orbitSpeed = 0.07; // 公転速度
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    
    useFrame(({ clock }) => {
        if (uranusRef.current) {
            // 自転（横倒しになった自転）
            uranusRef.current.rotation.z = clock.getElapsedTime() * 0.3;
            
            // 公転（大きく傾いた軌道）（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
            const orbitAngle = Math.PI / 1.84; // 約98度の傾き
            const x = Math.cos(time) * orbitRadius;
            const y = Math.sin(time) * Math.sin(orbitAngle) * orbitRadius;
            const z = Math.sin(time) * Math.cos(orbitAngle) * orbitRadius;
            
            uranusRef.current.position.set(x, y, z);
        }
    });
    
    return (
        <mesh ref={uranusRef} rotation={[0, 0, Math.PI / 2]}> // 初期姿勢を横倒しに
            <sphereGeometry args={[1.7, 64, 64]} />
            <meshStandardMaterial
                map={texture}
                metalness={0.4}
                roughness={0.7}
            />
        </mesh>
    );
};

const Neptune = () => {
    const neptuneRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load('./assets/neptunemap.jpg'), []);
    
    // 公転の設定
    const orbitRadius = 250; // 太陽からの距離（最も外側）
    const orbitSpeed = 0.05; // 公転速度（最も遅い）
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    
    useFrame(({ clock }) => {
        if (neptuneRef.current) {
            // 自転
            neptuneRef.current.rotation.y = clock.getElapsedTime() * 0.3;
            
            // 公転（軌道面を少し傾ける）（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
            const orbitAngle = Math.PI / 15; // 12度の傾き
            const x = Math.cos(time) * orbitRadius;
            const y = Math.sin(time) * Math.sin(orbitAngle) * orbitRadius;
            const z = Math.sin(time) * Math.cos(orbitAngle) * orbitRadius;
            
            neptuneRef.current.position.set(x, y, z);
        }
    });
    
    return (
        <mesh ref={neptuneRef}>
            <sphereGeometry args={[1.6, 64, 64]} />
            <meshStandardMaterial
                map={texture}
                metalness={0.4}
                roughness={0.7}
            />
        </mesh>
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
    const initialAngle = useMemo(() => Math.random() * Math.PI * 2, []); // 0-2πのランダムな初期角度
    
    useFrame(({ clock }) => {
        if (saturnRef.current && ringsRef.current) {
            // 自転
            saturnRef.current.rotation.y = clock.getElapsedTime() * 0.3;
            ringsRef.current.rotation.y = clock.getElapsedTime() * 0.3;
            
            // 公転（軌道面を傾ける）（初期角度を加算）
            const time = clock.getElapsedTime() * orbitSpeed + initialAngle;
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


export function SpaceScene() {
    // 銀河の設定
    const galaxyCount = 3; // 同時に表示される最大の銀河数
    const galaxyOpacity = 0.15; // より鮮明に表示
    
    return (
        <>
            <MovingStars />
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
