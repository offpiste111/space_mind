import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';

const Dragonflies = () => {
    const dragonflyCount = 30;
    const groupRef = useRef<THREE.Group>(null);
    
    // 赤とんぼの初期位置とパラメータを生成
    const dragonfliesData = useMemo(() => {
        return Array.from({ length: dragonflyCount }, () => ({
            position: new THREE.Vector3(
                (Math.random() - 0.5) * 60, // x: -30 to 30
                (Math.random() - 0.5) * 20, // y: -10 to 10
                (Math.random() - 0.5) * 60  // z: -30 to 30
            ),
            speed: 0.05 + Math.random() * 0.05,
            phase: Math.random() * Math.PI * 2,
            wingSpeed: 0.8 + Math.random() * 0.4
        }));
    }, []);

    // とんぼ一つ一つのコンポーネント
    const Dragonfly = ({ data }: { data: any }) => {
        const ref = useRef<THREE.Group>(null);
        const frontWingsRef = useRef<THREE.Group>(null);
        const backWingsRef = useRef<THREE.Group>(null);
        
        useFrame(({ clock }) => {
            if (ref.current && frontWingsRef.current && backWingsRef.current) {
                const time = clock.getElapsedTime();
                
                // 全体的な移動（ゆったりとした8の字や円運動）
                const moveTime = time * data.speed + data.phase;
                ref.current.position.x = data.position.x + Math.sin(moveTime * 0.7) * 10;
                ref.current.position.y = data.position.y + Math.sin(moveTime * 1.3) * 3;
                ref.current.position.z = data.position.z + Math.cos(moveTime * 0.5) * 10;
                
                // 進行方向を向く（簡易的）
                const dx = Math.cos(moveTime * 0.7) * 10 * 0.7;
                const dz = -Math.sin(moveTime * 0.5) * 10 * 0.5;
                ref.current.rotation.y = Math.atan2(dx, dz);
                
                // 羽ばたき（前羽と後羽で少し位相をずらすとリアル）
                const wingSpeed = 40 * data.wingSpeed;
                const frontWingAngle = Math.sin(time * wingSpeed) * 0.5;
                const backWingAngle = Math.sin(time * wingSpeed - Math.PI / 4) * 0.5;
                
                frontWingsRef.current.rotation.z = frontWingAngle;
                backWingsRef.current.rotation.z = backWingAngle;
            }
        });

        return (
            <group ref={ref} scale={[0.5, 0.5, 0.5]}>
                {/* 頭 */}
                <mesh position={[0, 0, 0.3]}>
                    <sphereGeometry args={[0.08, 16, 16]} />
                    <meshStandardMaterial color="#8b0000" />
                </mesh>
                
                {/* 胸部 */}
                <mesh position={[0, 0, 0]}>
                    <sphereGeometry args={[0.1, 16, 16]} />
                    <meshStandardMaterial color="#a52a2a" />
                </mesh>
                
                {/* 腹部（細長い尻尾） */}
                <mesh position={[0, 0, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.03, 0.01, 1.0, 8]} />
                    <meshStandardMaterial color="#ff4500" />
                </mesh>
                
                {/* 前羽 */}
                <group ref={frontWingsRef} position={[0, 0.1, 0.1]}>
                    {/* 左前羽 */}
                    <mesh position={[-0.4, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[0.8, 0.15]} />
                        <meshStandardMaterial color="#ffffff" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
                    </mesh>
                    {/* 右前羽 */}
                    <mesh position={[0.4, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[0.8, 0.15]} />
                        <meshStandardMaterial color="#ffffff" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
                    </mesh>
                </group>
                
                {/* 後羽 */}
                <group ref={backWingsRef} position={[0, 0.1, -0.1]}>
                    {/* 左後羽 */}
                    <mesh position={[-0.35, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[0.7, 0.18]} />
                        <meshStandardMaterial color="#ffffff" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
                    </mesh>
                    {/* 右後羽 */}
                    <mesh position={[0.35, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[0.7, 0.18]} />
                        <meshStandardMaterial color="#ffffff" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
                    </mesh>
                </group>
            </group>
        );
    };

    return (
        <group ref={groupRef}>
            {dragonfliesData.map((data, i) => (
                <Dragonfly key={i} data={data} />
            ))}
        </group>
    );
};

export function SunsetScene() {
    return (
        <>
            {/* 夕暮れの空 */}
            <Sky distance={450000} sunPosition={[0, -0.02, -1]} inclination={0.495} azimuth={0.25} rayleigh={3} turbidity={10} mieCoefficient={0.005} />
            {/* 暖かみのある強い光 */}
            <ambientLight intensity={0.6} color="#ff9e5e" />
            <directionalLight position={[0, -2, -10]} intensity={1.5} color="#ff5e00" />
            
            <Dragonflies />
        </>
    );
}
