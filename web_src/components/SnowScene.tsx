import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';

const SnowParticles = () => {
    const snowCount = 1200;
    const particlesRef = useRef<THREE.Points>(null);
    
    // 雪の初期位置を生成
    const [positions, speeds] = useMemo(() => {
        const pos = new Float32Array(snowCount * 3);
        const spd = new Float32Array(snowCount * 2); // 落下速度と横揺れ
        
        for (let i = 0; i < snowCount; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 100; // x: -50 to 50
            pos[i * 3 + 1] = Math.random() * 100 - 50; // y: -50 to 50
            pos[i * 3 + 2] = (Math.random() - 0.5) * 100; // z: -50 to 50
            
            spd[i * 2] = 0.05 + Math.random() * 0.05; // 落下速度
            spd[i * 2 + 1] = Math.random() * Math.PI * 2; // 横揺れの初期フェーズ
        }
        return [pos, spd];
    }, []);

    // 雪のテクスチャを生成（円形で周囲をぼかす）
    const snowTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext('2d');
        if (context) {
            const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // 黒の透明（AdditiveBlending用）
            context.fillStyle = gradient;
            context.fillRect(0, 0, 32, 32);
        }
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }, []);

    useFrame(({ clock }) => {
        if (particlesRef.current) {
            const posArray = particlesRef.current.geometry.attributes.position.array as Float32Array;
            const time = clock.getElapsedTime();
            
            for (let i = 0; i < snowCount; i++) {
                const i3 = i * 3;
                
                // 下に降る
                posArray[i3 + 1] -= speeds[i * 2];
                // 左右に揺れる
                posArray[i3] += Math.sin(time + speeds[i * 2 + 1]) * 0.02;
                
                // 下まで行ったら上に戻す
                if (posArray[i3 + 1] < -50) {
                    posArray[i3 + 1] = 50;
                    posArray[i3] = (Math.random() - 0.5) * 100;
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
                    count={snowCount}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.6}
                color="#ffffff"
                transparent
                opacity={0.8}
                map={snowTexture}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                sizeAttenuation={true}
            />
        </points>
    );
};

export function SnowScene() {
    return (
        <>
            {/* 早朝の薄暗い空。太陽はまだ低い位置 */}
            <Sky distance={450000} sunPosition={[0, -0.05, -1]} inclination={0.49} azimuth={0.25} rayleigh={0.1} turbidity={10} mieCoefficient={0.005} mieDirectionalG={0.8} />
            {/* 薄暗い青白い光 */}
            <ambientLight intensity={0.4} color="#a0c0e0" />
            <directionalLight position={[10, 5, 10]} intensity={0.2} color="#c0d0f0" />
            <SnowParticles />
        </>
    );
}
