import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, Cloud } from '@react-three/drei';
import * as THREE from 'three';

const MovingClouds = () => {
    const cloudsRef = useRef<THREE.Group>(null);
    
    useFrame(({ clock }) => {
        if (cloudsRef.current) {
            cloudsRef.current.rotation.y = clock.getElapsedTime() * 0.02;
        }
    });
    
    return (
        <group ref={cloudsRef}>
            <Cloud
                opacity={0.5}
                speed={0.4} // Rotation speed
                bounds={[10, 2, 2]}
                volume={10}
                segments={20} // Number of particles
                position={[0, -10, -20]}
            />
            <Cloud
                opacity={0.5}
                speed={0.4}
                bounds={[20, 2, 2]}
                volume={15}
                segments={30}
                position={[20, -15, 0]}
            />
            <Cloud
                opacity={0.5}
                speed={0.4}
                bounds={[15, 2, 2]}
                volume={10}
                segments={20}
                position={[-20, -5, 10]}
            />
            {/* Added 3 more clouds to double the amount */}
            <Cloud
                opacity={0.5}
                speed={0.4}
                bounds={[15, 2, 2]}
                volume={12}
                segments={25}
                position={[-15, -12, -10]}
            />
            <Cloud
                opacity={0.5}
                speed={0.4}
                bounds={[18, 2, 2]}
                volume={14}
                segments={28}
                position={[0, -8, 20]}
            />
            <Cloud
                opacity={0.5}
                speed={0.4}
                bounds={[12, 2, 2]}
                volume={10}
                segments={20}
                position={[15, -6, -15]}
            />
        </group>
    );
};

export function SkyScene() {
    return (
        <>
            <Sky distance={450000} sunPosition={[0, 1, 0]} inclination={0} azimuth={0.25} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} />
            <MovingClouds />
        </>
    );
}