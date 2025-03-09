import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
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
    const orbitRadius = 20;
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
    const particlesRef = useRef<THREE.Points>(null);
    const positions = useMemo(() => {
        const pos = new Float32Array(18); // 6個の流れ星 x (x,y,z)
        for (let i = 0; i < 6; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 80;   // x: -40 to 40
            pos[i * 3 + 1] = 40 + Math.random() * 20;  // y: 40 to 60
            pos[i * 3 + 2] = (Math.random() - 0.5) * 80;   // z: -40 to 40
        }
        return pos;
    }, []);

    // 速度を初期化
    const initSpeeds = () => {
        const angle = (Math.random() * Math.PI / 4) + Math.PI / 4; // 45-90度
        const speed = Math.random() * 0.2 + 0.2; // 0.2-0.4の範囲
        return {
            dx: -Math.cos(angle) * speed,
            dy: -Math.sin(angle) * speed
        };
    };

    const speeds = useMemo(() => {
        const arr = new Float32Array(6 * 2);
        for (let i = 0; i < 6; i++) {
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

                // 画面外に出たら上部にリセット
                if (positions[i + 1] < -25) {
                    // 上部のランダムな位置に移動
                    positions[i] = (Math.random() - 0.5) * 80;
                    positions[i + 1] = 40 + Math.random() * 20;
                    positions[i + 2] = (Math.random() - 0.5) * 80;

                    // 新しい速度を設定
                    const { dx, dy } = initSpeeds();
                    speeds[Math.floor(i / 3) * 2] = dx;
                    speeds[Math.floor(i / 3) * 2 + 1] = dy;
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

export function SpaceScene() {
    return (
        <>
            <MovingStars />
            <Earth />
            <ambientLight intensity={0.8} />
            <pointLight position={[15, 15, 15]} intensity={1.5} />
            <pointLight position={[-15, -15, -15]} intensity={1.0} />
        </>
    );
}
