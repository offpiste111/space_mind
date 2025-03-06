import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sky, Cloud, Stars } from "@react-three/drei";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";

// 動く星空のコンポーネント
const MovingStars = () => {
  const starsRef = useRef();

  useFrame(({ clock }) => {
    if (starsRef.current) {
      // 星を回転させる
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

const GraphScene = () => {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Force Graphのレイヤー */}
      <div style={{ 
        position: "absolute", 
        top: 0, 
        left: 0, 
        width: "100%", 
        height: "100%", 
        zIndex: 1 
      }}>
        <ForceGraph3D
          backgroundColor="rgba(0,0,0,0)"
          graphData={{
            nodes: [
              { id: "1", name: "Node 1" },
              { id: "2", name: "Node 2" },
              { id: "3", name: "Node 3" }
            ],
            links: [
              { source: "1", target: "2" },
              { source: "2", target: "3" },
              { source: "3", target: "1" }
            ]
          }}
          nodeLabel="name"
          showNavInfo={false}
        />
      </div>
      
      {/* R3Fのレイヤー */}
      <div style={{ 
        position: "absolute", 
        top: 0, 
        left: 0, 
        width: "100%", 
        height: "100%", 
        zIndex: 0,
        pointerEvents: "none" 
      }}>
        <Canvas
          style={{ background: "transparent" }}
          camera={{ position: [0, 0, 40], near: 0.1, far: 1000 }}
        >
          <MovingStars />
          <Sky 
            distance={45000}
            sunPosition={[0, 1, 0]}
            inclination={0.6}
            azimuth={0.25}
          />
          <Cloud 
            position={[-20, 10, -10]}
            speed={0.2}
            opacity={0.7}
            width={10}
            depth={1.5}
          />
          <Cloud 
            position={[15, 5, -15]}
            speed={0.1}
            opacity={0.5}
            width={8}
            depth={2}
          />
          <Cloud 
            position={[0, 15, -20]}
            speed={0.3}
            opacity={0.6}
            width={12}
            depth={1.8}
          />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <mesh>
            <boxGeometry />
            <meshStandardMaterial color="orange" />
          </mesh>
        </Canvas>
      </div>
    </div>
  );
};

export default GraphScene;
