"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Hero 3D scene — "the orbital telemetry globe".
 *
 * A structured geodesic sphere of 360 nodes connected by clean constellation
 * edges, an inner atmospheric core with dual counter-rotating wireframes, and
 * three precision-machined concentric orbit rings with glowing telemetry
 * satellites. All motion stops under prefers-reduced-motion.
 */

const LIME = new THREE.Color("#c9f76f");
const ORANGE = new THREE.Color("#f2a35a");
const RED = new THREE.Color("#ff6a58");
const WHITE = new THREE.Color("#f4f4ee");
const SOFT_LIME = new THREE.Color("#88a84a");

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ShellPoint = { position: THREE.Vector3; color: THREE.Color; scale: number };

/** Exact Fibonacci-sphere shell so particles and edges form a crisp globe. */
function makeShell(count: number, seed: number): ShellPoint[] {
  const rand = seededRandom(seed);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const radius = 2.4;
  const points: ShellPoint[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const position = new THREE.Vector3(
      Math.cos(theta) * ring * radius,
      y * radius,
      Math.sin(theta) * ring * radius,
    );
    const roll = rand();
    const color =
      roll > 0.95 ? RED : roll > 0.82 ? ORANGE : roll > 0.55 ? WHITE : roll > 0.2 ? LIME : SOFT_LIME;
    const hero = rand() > 0.86 ? 1.65 : 1;
    points.push({ position, color, scale: (0.095 + rand() * 0.13) * hero });
  }
  return points;
}

const SHARED_SHELL = makeShell(340, 20261024);

/* ------------------------------------------------------ glowing particles */
const PARTICLE_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aScale;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float twinkle = 0.86 + 0.14 * sin(uTime * 1.5 + aPhase * 2.3);
    gl_PointSize = aScale * uPixelRatio * (310.0 / -mv.z) * twinkle;
    // Far side of the shell dims gently for 3D depth while staying clearly visible.
    vFade = smoothstep(-13.2, -5.8, mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.02, d);
    glow = pow(glow, 2.0);
    float core = smoothstep(0.18, 0.0, d);
    vec3 col = vColor + core * 0.85;
    gl_FragColor = vec4(col, (glow * 0.92 + core) * (0.28 + 0.72 * vFade));
  }
`;

function ParticleShell({ reduced }: { reduced: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const points = SHARED_SHELL;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    const scales = new Float32Array(points.length);
    const phases = new Float32Array(points.length);
    const rand = seededRandom(9911);
    points.forEach((point, index) => {
      positions[index * 3] = point.position.x;
      positions[index * 3 + 1] = point.position.y;
      positions[index * 3 + 2] = point.position.z;
      colors[index * 3] = point.color.r;
      colors[index * 3 + 1] = point.color.g;
      colors[index * 3 + 2] = point.color.b;
      scales[index] = point.scale;
      phases[index] = rand() * Math.PI * 2;
    });
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    return geo;
  }, [points]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: {
        value: typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio, 1.8),
      },
    }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = reduced ? 0 : clock.getElapsedTime();
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        args={[
          {
            uniforms,
            vertexShader: PARTICLE_VERT,
            fragmentShader: PARTICLE_FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          },
        ]}
      />
    </points>
  );
}

/* ---------------------------------------------------- constellation web */
function ConstellationWeb() {
  const geometry = useMemo(() => {
    const nodes = SHARED_SHELL;
    const pairs: { a: number; b: number; d: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = nodes[i].position.distanceTo(nodes[j].position);
        if (d < 0.68) pairs.push({ a: i, b: j, d });
      }
    }
    pairs.sort((x, y) => x.d - y.d);
    const chosen = pairs.slice(0, 620);

    const positions: number[] = [];
    const colors: number[] = [];
    for (const pair of chosen) {
      const a = nodes[pair.a];
      const b = nodes[pair.b];
      positions.push(
        a.position.x, a.position.y, a.position.z,
        b.position.x, b.position.y, b.position.z,
      );
      const hot =
        a.color.equals(ORANGE) || a.color.equals(RED) || b.color.equals(ORANGE) || b.color.equals(RED);
      const color = hot ? ORANGE : LIME;
      for (let k = 0; k < 2; k++) colors.push(color.r, color.g, color.b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      {/* Subtle inner atmosphere so the globe has volume */}
      <mesh>
        <sphereGeometry args={[2.34, 36, 36]} />
        <meshBasicMaterial
          color={LIME}
          transparent
          opacity={0.035}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------ orbit rings */
const RING_DEFS = [
  { radius: 2.88, tube: 0.014, color: LIME, speed: 0.32, opacity: 0.68, phase: 0.4 },
  { radius: 3.32, tube: 0.012, color: ORANGE, speed: -0.22, opacity: 0.54, phase: 2.3 },
  { radius: 3.76, tube: 0.01, color: WHITE, speed: 0.15, opacity: 0.36, phase: 4.2 },
];

function OrbitRings({ reduced }: { reduced: boolean }) {
  const satellites = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.getElapsedTime();
    RING_DEFS.forEach((ring, index) => {
      const sat = satellites.current[index];
      if (!sat) return;
      const angle = t * ring.speed + ring.phase;
      sat.position.set(Math.cos(angle) * ring.radius, Math.sin(angle) * ring.radius, 0);
    });
  });

  return (
    <group>
      {RING_DEFS.map((ring, index) => (
        <group key={index}>
          <mesh>
            <torusGeometry args={[ring.radius, ring.tube, 16, 256]} />
            <meshBasicMaterial
              color={ring.color}
              transparent
              opacity={ring.opacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <group ref={(node) => void (satellites.current[index] = node)}>
            <mesh>
              <sphereGeometry args={[0.065, 16, 16]} />
              <meshBasicMaterial color={ring.color} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshBasicMaterial
                color={ring.color}
                transparent
                opacity={0.32}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------- glow core */
function GlowCore({ reduced }: { reduced: boolean }) {
  const outerWire = useRef<THREE.Mesh>(null);
  const innerWire = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.getElapsedTime();
    if (outerWire.current) {
      outerWire.current.rotation.y = t * 0.22;
      outerWire.current.rotation.x = Math.sin(t * 0.28) * 0.3;
      outerWire.current.scale.setScalar(1 + Math.sin(t * 1.1) * 0.04);
    }
    if (innerWire.current) {
      innerWire.current.rotation.y = -t * 0.34;
      innerWire.current.rotation.z = t * 0.18;
    }
    if (halo.current) halo.current.scale.setScalar(1 + Math.sin(t * 1.1) * 0.08);
  });

  return (
    <group>
      <mesh ref={outerWire}>
        <icosahedronGeometry args={[0.88, 1]} />
        <meshBasicMaterial
          color={LIME}
          wireframe
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={innerWire}>
        <octahedronGeometry args={[0.48, 0]} />
        <meshBasicMaterial
          color={ORANGE}
          wireframe
          transparent
          opacity={0.38}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.15, 24, 24]} />
        <meshBasicMaterial color={WHITE} />
      </mesh>
      {/* Soft additive halo */}
      <mesh ref={halo}>
        <sphereGeometry args={[1.35, 32, 32]} />
        <meshBasicMaterial
          color={LIME}
          transparent
          opacity={0.09}
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
    const goalX = reduced ? 0 : pointer.x * 0.55;
    const goalY = reduced ? 0 : pointer.y * 0.35;
    camera.position.x += (goalX - camera.position.x) * 0.045;
    camera.position.y += (goalY - camera.position.y) * 0.045;
    camera.lookAt(target.current);
  });

  return null;
}

/* ------------------------------------------------------------------ demo */
export function HeroScene({ className = "" }: { className?: string }) {
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

  if (!mounted) {
    return <div className={className} aria-hidden />;
  }

  return (
    <div className={className} aria-hidden role="presentation">
      <Canvas
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 8.8], fov: 48 }}
      >
        <CameraRig reduced={reduced} />
        <SlowGroup reduced={reduced}>
          <ParticleShell reduced={reduced} />
          <ConstellationWeb />
          <GlowCore reduced={reduced} />
        </SlowGroup>
        <OrbitRings reduced={reduced} />
      </Canvas>
    </div>
  );
}

/** Shared slow rotation for the shell + core so they move as one body. */
function SlowGroup({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current || reduced) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = t * 0.14;
    group.current.rotation.x = Math.sin(t * 0.1) * 0.08;
  });
  return <group ref={group}>{children}</group>;
}
