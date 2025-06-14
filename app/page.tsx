"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "react-three-fiber";
import { useProgress, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";

function FPSControls() {
  const { camera } = useThree();
  const moveForward = useRef(false);
  const moveBackward = useRef(false);
  const moveLeft = useRef(false);
  const moveRight = useRef(false);
  const canJump = useRef(false);
  const velocity = useRef(new THREE.Vector3());
  const prevTime = useRef(performance.now());
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyW":
          moveForward.current = true;
          break;
        case "KeyS":
          moveBackward.current = true;
          break;
        case "KeyA":
          moveLeft.current = true;
          break;
        case "KeyD":
          moveRight.current = true;
          break;
        case "Space":
          if (canJump.current) {
            velocity.current.y = 10;
            canJump.current = false;
          }
          break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyW":
          moveForward.current = false;
          break;
        case "KeyS":
          moveBackward.current = false;
          break;
        case "KeyA":
          moveLeft.current = false;
          break;
        case "KeyD":
          moveRight.current = false;
          break;
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement === document.body) {
        euler.current.y -= event.movementX * 0.002;
        euler.current.x -= event.movementY * 0.002;
        euler.current.x = Math.max(
          -Math.PI / 2,
          Math.min(Math.PI / 2, euler.current.x),
        );
        camera.quaternion.setFromEuler(euler.current);
      }
    };

    const onMouseDown = () => {
      document.body.requestPointerLock();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [camera]);

  useFrame(() => {
    const time = performance.now();
    const delta = (time - prevTime.current) / 1000;

    velocity.current.y -= 9.8 * delta; // gravity

    // Get camera's forward and right vectors
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion,
    );
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

    // Reset velocity
    velocity.current.x = 0;
    velocity.current.z = 0;

    // Calculate movement direction
    if (moveForward.current) {
      velocity.current.addScaledVector(forward, 10.0 * delta);
    }
    if (moveBackward.current) {
      velocity.current.addScaledVector(forward, -10.0 * delta);
    }
    if (moveRight.current) {
      velocity.current.addScaledVector(right, 10.0 * delta);
    }
    if (moveLeft.current) {
      velocity.current.addScaledVector(right, -10.0 * delta);
    }

    // Apply velocity to camera position
    camera.position.x += velocity.current.x;
    camera.position.y += velocity.current.y * delta;
    camera.position.z += velocity.current.z;

    // Simple ground collision
    if (camera.position.y < 1.6) {
      velocity.current.y = 0;
      camera.position.y = 1.6;
      canJump.current = true;
    }

    prevTime.current = time;
  });

  return null;
}

function Model() {
  const { scene } = useGLTF("/donner.glb");
  const scale = 10;
  return (
    <primitive
      object={scene}
      position={[0, 0, 0]}
      scale={[scale, scale, scale]}
    />
  );
}

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

export default function App() {
  return (
    <div className="w-full h-screen bg-white">
      <Canvas camera={{ fov: 75, position: [0, 1.6, 5] }}>
        <color attach="background" args={["#ffffff"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={2} />
        <Suspense fallback={<CanvasLoader />}>
          <Model />
        </Suspense>
        <FPSControls />
      </Canvas>
    </div>
  );
}
