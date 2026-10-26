"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Interactive 3D evidence scene — "the taint globe".
 *
 * The untrusted source burns at the core. Every causal hop spirals outward as a
 * node: red means out of role. Tap a node and the camera eases toward it while
 * the detail panel and the AI analyst take over. Energy pulses travel the chain
 * so the direction of causality is readable without a legend.
 */

const LIME = new THREE.Color("#c9f76f");
const ORANGE = new THREE.Color("#f2a35a");
const RED = new THREE.Color("#ff6a58");
const WHITE = new THREE.Color("#f4f4ee");
const DIM = new THREE.Color("#6b6b5e");

export type SceneNode = {
  label: string;
  source: boolean;
  suspicious: boolean;
  kind: string;
};

/* ---------------------------------------------------------------- geometry */
function chainLayout(count: number) {
  const points = [new THREE.Vector3(0, 0, 0)];
  for (let i = 1; i < count; i++) {
    const angle = i * 2.2;
    const radius = 1.25 + i * 0.55;
    points.push(
      new THREE.Vector3(Math.cos(angle) * radius, Math.sin(i * 1.15) * 0.75, Math.sin(angle) * radius),
    );
  }
  return points;
}

function Shell({ count = 900 }: { count?: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // even scatter on a sphere so the field reads as depth, not clumps
      const u = (i + 0.5) / count;
      const v = (i * 0.61803398875) % 1;
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const radius = 4.4 + Math.random() * 1.6;
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[i * 3 + 1] = Math.cos(phi) * radius;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.035}
        color={WHITE}
        transparent
        opacity={0.32}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* --------------------------------------------------------------- one node */
function HopNode({
  position,
  node,
  selected,
  onSelect,
  reduced,
}: {
  position: THREE.Vector3;
  node: SceneNode;
  selected: boolean;
  onSelect: () => void;
  reduced: boolean;
}) {
  const mesh = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const tone = node.source ? ORANGE : node.suspicious ? RED : DIM;

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = reduced ? 0 : clock.getElapsedTime();
    const pulse = selected ? 1 + Math.sin(t * 3) * 0.08 : 1;
    const target = (hovered ? 1.3 : 1) * pulse;
    mesh.current.scale.lerp(new THREE.Vector3(target, target, target), 0.18);
    if (selected) mesh.current.rotation.y = t * 0.6;
  });

  return (
    <group ref={mesh} position={position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.19, 18, 18]} />
        <meshBasicMaterial color={tone} />
      </mesh>

      {/* glow */}
      <mesh>
        <sphereGeometry args={[0.38, 16, 16]} />
        <meshBasicMaterial
          color={tone}
          transparent
          opacity={selected ? 0.34 : hovered ? 0.26 : 0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* selection ring */}
      {selected ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.44, 0.5, 40]} />
          <meshBasicMaterial
            color={LIME}
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/* ------------------------------------------------------------------- scene */
function Scene({
  nodes,
  selected,
  onSelect,
  reduced,
}: {
  nodes: SceneNode[];
  selected: number | null;
  onSelect: (index: number) => void;
  reduced: boolean;
}) {
  const layout = useMemo(() => chainLayout(nodes.length), [nodes.length]);
  const group = useRef<THREE.Group>(null);
  const pulses = useRef<(THREE.Mesh | null)[]>([]);

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

  useFrame(({ clock, camera }) => {
    const t = reduced ? 0 : clock.getElapsedTime();
    if (group.current && !reduced) {
      group.current.rotation.y = t * 0.11;
      group.current.rotation.x = Math.sin(t * 0.16) * 0.1;
    }
    // causal energy flowing outward along each link
    layout.slice(1).forEach((target, index) => {
      const pulse = pulses.current[index];
      if (!pulse) return;
      const from = layout[index];
      const u = reduced ? 0.5 : (t * 0.32 + index * 0.19) % 1;
      pulse.position.lerpVectors(from, target, u);
    });
    // gentle drift toward the selected hop so the tap feels like a focus pull
    const goal = selected != null && layout[selected] ? layout[selected] : null;
    if (goal) {
      camera.position.x += (goal.x * 0.22 - camera.position.x) * 0.03;
      camera.position.y += (goal.y * 0.22 + 1 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
    }
  });

  return (
    <>
      <Shell />
      <group ref={group}>
        {/* causal links */}
        <lineSegments geometry={segments}>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </lineSegments>

        {/* core: the untrusted source */}
        <mesh>
          <icosahedronGeometry args={[0.52, 1]} />
          <meshBasicMaterial color={ORANGE} wireframe transparent opacity={0.55} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.21, 22, 22]} />
          <meshBasicMaterial color={WHITE} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.95, 22, 22]} />
          <meshBasicMaterial
            color={ORANGE}
            transparent
            opacity={0.1}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* hops */}
        {layout.map((point, index) => (
          <HopNode
            key={index}
            position={point}
            node={nodes[index]}
            selected={selected === index}
            onSelect={() => onSelect(index)}
            reduced={reduced}
          />
        ))}

        {/* travelling energy */}
        {layout.slice(1).map((_, index) => (
          <mesh key={`pulse-${index}`} ref={(node) => void (pulses.current[index] = node)}>
            <sphereGeometry args={[0.075, 10, 10]} />
            <meshBasicMaterial
              color={WHITE}
              transparent
              opacity={0.85}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}

        {/* framing orbits */}
        <mesh rotation={[Math.PI / 2.6, 0.3, 0]}>
          <torusGeometry args={[3.6, 0.012, 12, 180]} />
          <meshBasicMaterial
            color={LIME}
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[Math.PI / 1.8, -0.5, 0.2]}>
          <torusGeometry args={[4.1, 0.01, 12, 180]} />
          <meshBasicMaterial
            color={WHITE}
            transparent
            opacity={0.16}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  );
}

/* ------------------------------------------------------------- camera rig */
function CameraRig({ reduced }: { reduced: boolean }) {
  const { camera, pointer } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const goalX = reduced ? 0 : pointer.x * 0.9;
    const goalY = reduced ? 0 : pointer.y * 0.5;
    camera.position.x += (goalX - camera.position.x) * 0.045;
    camera.position.y += (goalY + 1 - camera.position.y) * 0.045;
    camera.lookAt(target.current);
  });

  return null;
}

export function EvidenceScene({
  nodes,
  selected,
  onSelect,
  className = "",
}: {
  nodes: SceneNode[];
  selected: number | null;
  onSelect: (index: number) => void;
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
    <div className={className} role="img" aria-label="Interactive taint chain. Select a node to inspect it.">
      <Canvas
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 1, 8.6], fov: 46 }}
      >
        <CameraRig reduced={reduced} />
        <Scene nodes={nodes} selected={selected} onSelect={onSelect} reduced={reduced} />
      </Canvas>
    </div>
  );
}
