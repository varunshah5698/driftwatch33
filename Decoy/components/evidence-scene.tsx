"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Interactive 3D evidence scene — "the role boundary".
 *
 * A wireframe sphere is the boundary an agent's declared role allows. Every
 * step in the taint chain sits on that surface; a step that broke role is
 * thrown outside it, so "out of role" is something you see rather than read.
 * The untrusted source burns at the core and pulses travel outward along the
 * causal chain. Selecting a step turns the globe to face it and rings it.
 * Reduced motion stops all of it without losing any information.
 */

const LIME = new THREE.Color("#c9f76f");
const ORANGE = new THREE.Color("#f2a35a");
const RED = new THREE.Color("#ff6a58");
const WHITE = new THREE.Color("#f4f4ee");

const SHELL = 2.3; // role boundary radius
const BROKEN = 1.35; // out-of-role steps are pushed this far outside it

export type SceneNode = {
  label: string;
  kind: string;
  source: boolean;
  suspicious: boolean;
};

/** Even coverage over a sphere (Fibonacci), so nodes never clump. */
function sphereLayout(count: number) {
  const points: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < count; index++) {
    const y = count === 1 ? 0 : 1 - (index / (count - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * index;
    points.push(new THREE.Vector3(Math.cos(theta) * ring, y * 0.82, Math.sin(theta) * ring));
  }
  return points;
}

/* ------------------------------------------------------------- star field */
function Starfield({ count = 520 }: { count?: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      const u = (index + 0.5) / count;
      const v = (index * 0.61803398875) % 1;
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const radius = 3.6 + Math.random() * 2.6;
      positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[index * 3 + 1] = Math.cos(phi) * radius * 0.8;
      positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.022}
        color={WHITE}
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ---------------------------------------------------------------- one hop */
function Hop({
  position,
  node,
  index,
  selected,
  onSelect,
}: {
  position: THREE.Vector3;
  node: SceneNode;
  index: number;
  selected: boolean;
  onSelect: (index: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const tone = node.suspicious ? RED : LIME;

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const pulse = selected ? 1.25 + Math.sin(clock.getElapsedTime() * 3.2) * 0.12 : hovered ? 1.18 : 1;
    group.current.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.16);
  });

  return (
    <group ref={group} position={position}>
      {/* visible dot */}
      <mesh>
        <sphereGeometry args={[0.13, 18, 18]} />
        <meshBasicMaterial color={tone} />
      </mesh>
      {/* glow */}
      <mesh>
        <sphereGeometry args={[0.34, 16, 16]} />
        <meshBasicMaterial
          color={tone}
          transparent
          opacity={selected ? 0.4 : hovered ? 0.3 : 0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* generous invisible hit target so a tap is easy on any screen */}
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(index);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------- globe */
function Globe({
  nodes,
  selected,
  onSelect,
  reduced,
}: {
  nodes: SceneNode[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const pulses = useRef<(THREE.Mesh | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null);

  // Positions are fixed for the whole chain, including deselection, so the
  // globe does not reshuffle when a node fades out.
  const layout = useMemo(() => {
    const hops = nodes.filter((node) => !node.source);
    const unit = sphereLayout(hops.length);
    const points: THREE.Vector3[] = [];
    let hop = 0;
    for (const node of nodes) {
      if (node.source) {
        points.push(new THREE.Vector3(0, 0, 0));
      } else {
        const base = unit[Math.min(hop, unit.length - 1)] ?? new THREE.Vector3(0, 1, 0);
        points.push(base.clone().multiplyScalar(SHELL * (node.suspicious ? BROKEN : 1)));
        hop += 1;
      }
    }
    return points;
  }, [nodes]);

  const chain = useMemo(
    () => layout.filter((_, index) => !nodes[index]?.source),
    [layout, nodes],
  );

  const segments = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    for (let index = 1; index < layout.length; index++) {
      const a = layout[index - 1];
      const b = layout[index];
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const tone = nodes[index]?.suspicious ? RED : ORANGE;
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
    if (!group.current) return;

    // Turn the selected step toward the viewer; otherwise drift slowly.
    if (selected != null && layout[selected] && !reduced) {
      const target = -Math.atan2(layout[selected].x, layout[selected].z);
      const delta = ((target - group.current.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
      group.current.rotation.y += delta * 0.07;
    } else if (!reduced) {
      group.current.rotation.y = t * 0.075;
    }
    group.current.rotation.x = reduced ? 0 : Math.sin(t * 0.14) * 0.07;

    chain.forEach((target, index) => {
      const pulse = pulses.current[index];
      if (!pulse) return;
      const from = index === 0 ? layout[0] : chain[index - 1];
      const u = reduced ? 0.5 : (t * 0.3 + index * 0.22) % 1;
      pulse.position.lerpVectors(from, target, u);
    });

    // Billboard the selection ring so it always reads as a circle.
    if (ring.current && selected != null && layout[selected]) {
      ring.current.position.copy(layout[selected]);
      ring.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <group
      ref={group}
      onPointerMissed={() => onSelect(null)}
    >
      {/* the declared role: a boundary you can see steps break through */}
      <mesh>
        <icosahedronGeometry args={[SHELL, 2]} />
        <meshBasicMaterial color={LIME} wireframe transparent opacity={0.16} />
      </mesh>
      <mesh>
        <sphereGeometry args={[SHELL * 0.99, 24, 24]} />
        <meshBasicMaterial
          color={LIME}
          transparent
          opacity={0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* causal links */}
      <lineSegments geometry={segments}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* core: the untrusted source */}
      <mesh>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshBasicMaterial color={ORANGE} wireframe transparent opacity={0.65} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.17, 20, 20]} />
        <meshBasicMaterial color={WHITE} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.85, 20, 20]} />
        <meshBasicMaterial
          color={ORANGE}
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* steps */}
      {layout.map((point, index) =>
        nodes[index]?.source ? null : (
          <Hop
            key={index}
            index={index}
            position={point}
            node={nodes[index]}
            selected={selected === index}
            onSelect={onSelect}
          />
        ),
      )}

      {selected != null && layout[selected] ? (
        <mesh ref={ring} visible>
          <ringGeometry args={[0.36, 0.42, 48]} />
          <meshBasicMaterial
            color={nodes[selected]?.suspicious ? RED : LIME}
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}

      {/* travelling energy */}
      {chain.map((_, index) => (
        <mesh key={`pulse-${index}`} ref={(node) => void (pulses.current[index] = node)}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial
            color={WHITE}
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------- camera rig */
function CameraRig({ reduced }: { reduced: boolean }) {
  const { camera, pointer } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const goalX = reduced ? 0 : pointer.x * 0.5;
    const goalY = reduced ? 0.6 : pointer.y * 0.35 + 0.6;
    camera.position.x += (goalX - camera.position.x) * 0.045;
    camera.position.y += (goalY - camera.position.y) * 0.045;
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
  onSelect: (index: number | null) => void;
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
    <div className={className} role="img" aria-label="Role boundary globe. Select a step to inspect it.">
      <Canvas
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.6, 7], fov: 46 }}
      >
        <CameraRig reduced={reduced} />
        <Starfield />
        <Globe nodes={nodes} selected={selected} onSelect={onSelect} reduced={reduced} />
      </Canvas>
    </div>
  );
}
