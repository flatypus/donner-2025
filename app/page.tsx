"use client";

import { Suspense } from "react";
import { Canvas } from "react-three-fiber";
import { OrbitControls, useProgress, Html } from "@react-three/drei";
import { useGLTF } from "@react-three/drei";

function CanvasLoader() {
  const { progress } = useProgress();
  return (
    <mesh>
      <Html center>
        <div className="w-64">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-white text-center mt-2 font-medium">
            Loading... {Math.round(progress)}%
          </div>
        </div>
      </Html>
    </mesh>
  );
}

function Model() {
  const { scene } = useGLTF("/donner.glb");
  return <primitive object={scene} position={[0, 0, 0]} scale={[1, 1, 1]} />;
}

export default function App() {
  return (
    <div className="w-full h-screen bg-gray-200">
      <Canvas camera={{ fov: 75, position: [0, 0, 5] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={2} />
        <Suspense fallback={<CanvasLoader />}>
          <Model />
        </Suspense>
        <OrbitControls />
      </Canvas>
    </div>
  );
}
