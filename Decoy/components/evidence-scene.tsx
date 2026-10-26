"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Evidence 3D scene — "the taint orbit".
 *
 * The untrusted source glows at the core; every causal hop spirals outward as a
 * node (red = out-of-role). Energy pulses travel along the chain, and two
 * counter-rotating orbit rings frame it. Motion stops under reduced-motion.
 */

const LIME = new THREE.Color("#c9f76f");
const ORANGE = new THREE.Color("#f2a35a");
const RED = new THREE.Color("#ff6a58");
const WHITE = new THREE.Color("#f4f4ee");
const DIM = new THREE.Color("#6b6b5e");

export type SceneNode = { source: boolean; suspicious: boolean };

/* ------------------------------------------------------------- taint orb */
function TaintOrb({ nodes, reduced }: { nodes: SceneNode[]; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const pulses = useRef<(THREE.Mesh | null)[]>([]);

  // Chain layout: source at the core, hops spiralling outward.
  const layout = useMemo(() => {
    const points: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];
    for (let i = 1; i < nodes.length; i++) {
      const angle = i * 2.2;
      const radius = 1.25 + i * 0.55;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(i * 1.15) * 0.75,
          Math.sin(angle) * radius,
        ),
      );
    }
    return points;
  }, [nodes]);

  const segments = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    for (let i = 1; i < layout.length; i++) {
      const a = layout[i - 1];
      const b = layout[i];
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const tone = nodes[i]?.suspicious ? RED : ORANGE;
      for (let k = 0; k < 2; k++) colors.push(tone.r, tone.g, tone.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [layout, nodes]);

  useEffect(() => () => segments.dispose(), [segments]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = reduced ? 0 : clock.getElapsedTime();
    group.current.rotation.y = t * 0.16;
    group.current.rotation.x = Math.sin(t * 0.12) * 0.12;
    // Energy pulses travel each chain segment on a loop.
    layout.slice(1).forEach((target, index) => {
      const pulse = pulses.current[index];
      if (!pulse) return;
      const from = layout[index];
      const u = reduced ? 0.5 : (t * 0.35 + index * 0.18) % 1;
      pulse.position.lerpVectors(from, target, u);
    });
  });

  return (
    <group ref={group}>
      {/* chain */}
      <lineSegments geometry={segments}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* core — the untrusted source */}
      <mesh>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshBasicMaterial color={ORANGE} wireframe transparent opacity={0.7} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.17, 20, 20]} />
        <meshBasicMaterial color={WHITE} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.75, 20, 20]} />
        <meshBasicMaterial
          color={ORANGE}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* causal hops */}
      {layout.slice(1).map((point, index) => {
        const node = nodes[index + 1];
        const tone = node?.suspicious ? RED : DIM;
        return (
          <group key={index} position={point}>
            <mesh>
              <sphereGeometry args={[0.12, 14, 14]} />
              <meshBasicMaterial color={tone} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.3, 14, 14]} />
              <meshBasicMaterial
                color={tone}
                transparent
                opacity={0.22}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}

      {/* traveling pulses */}
      {layout.slice(1).map((_, index) => (
        <mesh key={`pulse-${index}`} ref={(node) => void (pulses.current[index] = node)}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial
            color={WHITE}
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* counter-rotating orbit rings */}
      <mesh rotation={[Math.PI / 2.6, 0.3, 0]}>
        <torusGeometry args={[3.4, 0.012, 12, 180]} />
        <meshBasicMaterial
          color={LIME}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 1.8, -0.5, 0.2]}>
        <torusGeometry args={[3.9, 0.01, 12, 180]} />
        <meshBasicMaterial
          color={WHITE}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------ camera rig */
function CameraRig({ reduced }: { reduced: boolean }) {
  const { camera, pointer } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const goalX = reduced ? 0 : pointer.x * 0.7;
    const goalY = reduced ? 0 : pointer.y * 0.4;
    camera.position.x += (goalX - camera.position.x) * 0.05;
    camera.position.y += (goalY - camera.position.y) * 0.05;
    camera.lookAt(target.current);
  });

  return null;
}

export function EvidenceScene({
  nodes,
  className = "",
}: {
  nodes: SceneNode[];
  className?: string;
}) {
  const [reduced, setReduced] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  if (!mounted) return <div className={className} aria-hidden />;

  return (
    <div className={className} aria-hidden role="presentation">
      <Canvas
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 1.2, 8.4], fov: 46 }}
      >
        <CameraRig reduced={reduced} />
        <TaintOrb nodes={nodes} reduced={reduced} />
      </Canvas>
    </div>
  );
}
