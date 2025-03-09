import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

export function Earth() {
  const earthRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (earthRef.current) {
      earthRef.current.rotation.y = clock.getElapsedTime() * 0.2;
    }
  });

  return (
    <Sphere ref={earthRef} args={[1, 32, 32]}>
      <meshStandardMaterial
        color="#4444ff"
        metalness={0.4}
        roughness={0.7}
        emissive="#000066"
        emissiveIntensity={0.2}
      />
    </Sphere>
  );
}
