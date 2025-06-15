"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { useProgress, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { TextureLoader } from "three";
import { CiDesktopMouse1 } from "react-icons/ci";
import { FaKeyboard } from "react-icons/fa";
import { GiFishEscape } from "react-icons/gi";

// Create a shared octree instance
const worldOctree = new Octree();
const SCALE = 5;

// Player constants
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.35;
const EYE_HEIGHT = 3; // Camera eye level from ground
const GRAVITY = 30;
const PLAYER_SPEED = 5;

interface SharedModelProps {
  modelPath: string;
  position?: [number, number, number];
  scale?: [number, number, number];
  addToOctree?: boolean;
  onLoad?: () => void;
  collisionOnly?: boolean;
}

function Crosshair() {
  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        width: "24px",
        height: "24px",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      <svg width="24" height="24">
        <line x1="12" y1="6" x2="12" y2="18" stroke="#fff" strokeWidth="2" />
        <line x1="6" y1="12" x2="18" y2="12" stroke="#fff" strokeWidth="2" />
      </svg>
    </div>
  );
}

function SharedModel({
  modelPath,
  position = [0, 0, 0],
  scale = [SCALE, SCALE, SCALE],
  addToOctree = false,
  onLoad,
  collisionOnly = false,
}: SharedModelProps) {
  const { scene } = useGLTF(modelPath) as { scene: THREE.Group };

  useEffect(() => {
    if (addToOctree) {
      // Clone and scale the scene for collision detection
      const scaledScene = scene.clone();
      scaledScene.scale.set(SCALE, SCALE, SCALE);
      scaledScene.updateMatrixWorld(true);

      // Add the scaled ground to the octree
      worldOctree.fromGraphNode(scaledScene);
    }
    onLoad?.();
  }, [scene, addToOctree, onLoad]);

  if (collisionOnly) return null;
  return <primitive object={scene} position={position} scale={scale} />;
}

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
  const playerCollider = useRef(
    new Capsule(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, PLAYER_HEIGHT, 0),
      PLAYER_RADIUS,
    ),
  );

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

    velocity.current.y -= GRAVITY * delta;

    // Get camera's forward and right vectors
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion,
    );
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

    // Reset horizontal velocity
    velocity.current.x = 0;
    velocity.current.z = 0;

    // Calculate movement direction
    if (moveForward.current) {
      velocity.current.addScaledVector(forward, PLAYER_SPEED * delta);
    }
    if (moveBackward.current) {
      velocity.current.addScaledVector(forward, -PLAYER_SPEED * delta);
    }
    if (moveRight.current) {
      velocity.current.addScaledVector(right, PLAYER_SPEED * delta);
    }
    if (moveLeft.current) {
      velocity.current.addScaledVector(right, -PLAYER_SPEED * delta);
    }

    // Update player collider to follow camera position
    playerCollider.current.start.set(
      camera.position.x,
      camera.position.y - EYE_HEIGHT,
      camera.position.z,
    );
    playerCollider.current.end.set(
      camera.position.x,
      camera.position.y - EYE_HEIGHT + PLAYER_HEIGHT,
      camera.position.z,
    );

    // Apply velocity to camera position
    camera.position.x += velocity.current.x;
    camera.position.y += velocity.current.y * delta;
    camera.position.z += velocity.current.z;

    // Check for collisions
    const result = worldOctree.capsuleIntersect(playerCollider.current);
    if (result) {
      if (result.normal.y > 0) {
        // Ground collision
        canJump.current = true;
        velocity.current.y = 0;
        // Position camera at eye level above ground
        // camera.position.y = result.depth + EYE_HEIGHT;
        camera.position.y += result.depth;
      } else {
        // Wall/ceiling collision
        velocity.current.addScaledVector(
          result.normal,
          -result.normal.dot(velocity.current),
        );
        // Prevent clipping through surfaces
        camera.position.addScaledVector(result.normal, result.depth);
      }
    }

    prevTime.current = time;

    // Respawn if fallen below -10
    if (camera.position.y < -10) {
      camera.position.set(-11.3, EYE_HEIGHT, 23);
      velocity.current.set(0, 0, 0);
    }
  });

  return null;
}

function CanvasLoader({ setReady }: { setReady: (ready: boolean) => void }) {
  const { progress } = useProgress();
  useEffect(() => {
    if (progress === 100) {
      setReady(true);
    }
  }, [progress, setReady]);

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

function FloatingHologramImage({
  position,
  imageUrl,
}: {
  position: [number, number, number];
  imageUrl: string;
}) {
  const texture = useLoader(TextureLoader, imageUrl);
  const meshRef = useRef<THREE.Mesh>(null);
  const borderRef = useRef<THREE.Mesh>(null);
  const [scale, setScale] = useState(1);
  const [hovered, setHovered] = useState(false);

  const SCALE = hovered ? 3 : 1;
  const BASE_WIDTH = 0.4 * SCALE;
  const BASE_HEIGHT = BASE_WIDTH * scale;

  useLayoutEffect(() => {
    const image = new Image();
    image.src = imageUrl;
    image.onload = () => {
      setScale(image.height / image.width);
    };
  }, [imageUrl]);

  // Animate floating and billboard
  useFrame(({ camera, clock }) => {
    const y = position[1] + Math.sin(clock.getElapsedTime() * 2) * 0.05 + 1.5;
    const lookAt = new THREE.Vector3(camera.position.x, y, camera.position.z);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    if (meshRef.current) {
      const intersect = raycaster.intersectObject(meshRef.current);
      if (intersect.length > 0) setHovered(true);
      else setHovered(false);

      meshRef.current.position.y = y;
      meshRef.current.lookAt(lookAt);
    }

    if (borderRef.current) {
      borderRef.current.position.copy(
        new THREE.Vector3(position[0], y, position[2]),
      );
      borderRef.current.position.y = y;
      borderRef.current.lookAt(lookAt);

      // Move border slightly behind the image
      const cameraDirection = new THREE.Vector3()
        .subVectors(camera.position, borderRef.current.position)
        .normalize();
      borderRef.current.position.addScaledVector(cameraDirection, -0.01);
    }
  });

  return (
    <>
      <mesh ref={borderRef}>
        <planeGeometry args={[BASE_WIDTH + 0.05, BASE_HEIGHT + 0.05]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={meshRef} position={position}>
        <planeGeometry args={[BASE_WIDTH, BASE_HEIGHT]} />
        <meshBasicMaterial map={texture} transparent opacity={1} color="#fff" />
      </mesh>
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);

  // Pointer lock event listener
  useEffect(() => {
    const handlePointerLockChange = () => {
      setPointerLocked(document.pointerLockElement === document.body);
    };
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    return () => {
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange,
      );
    };
  }, []);

  return (
    <div
      className="w-full h-screen bg-white"
      style={{ cursor: pointerLocked ? "none" : "default" }}
    >
      {/* Crosshair */}
      {ready && pointerLocked && <Crosshair />}
      {/* Click to focus overlay */}
      {!pointerLocked && ready && (
        <div
          className="absolute inset-0 flex items-center justify-center font-bold text-white text-4xl z-50 cursor-pointer select-none"
          onClick={() => document.body.requestPointerLock()}
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <CiDesktopMouse1 className="w-10 h-10" /> Click to focus
            </div>
            <div className="flex items-center gap-2">
              <FaKeyboard className="w-10 h-10" /> WASD to move
            </div>
            <div className="flex items-center gap-2">
              <GiFishEscape className="w-10 h-10" /> Escape to unlock cursor
            </div>
          </div>
        </div>
      )}
      <Canvas camera={{ fov: 75, position: [-11.3, EYE_HEIGHT, 23] }}>
        <color attach="background" args={[ready ? "#9a9392" : "#000000"]} />
        <ambientLight intensity={2} />
        <Suspense fallback={<CanvasLoader setReady={setReady} />}>
          <SharedModel modelPath="/donner.glb" onLoad={() => setLoaded(true)} />
          <SharedModel
            modelPath="/ground.glb"
            position={[0, -2, 0]}
            addToOctree
            onLoad={() => setLoaded(true)}
            collisionOnly
          />
          {/* Floating hologram image at world spawn */}
          <FloatingHologramImage
            position={[-10, EYE_HEIGHT, 24]}
            imageUrl="/constitution.jpg"
          />
        </Suspense>
        {loaded && <FPSControls />}
      </Canvas>
    </div>
  );
}
