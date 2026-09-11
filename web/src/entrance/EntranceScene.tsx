import { Sparkles } from '@react-three/drei';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  SpotLight,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { fibonacciSphere } from './heartGeometry';
import { createHeartGlowMaterial, createHeartMaterial, pulseHeartMaterial } from './heartMaterial';
import { dressPhotoHands, fitMeshesToSize, fitToSize, shiftPalmIn } from './modelPrep';
import { clamp01, SLIDE_COUNT, smoothstep } from './slides';

const CRYSTAL_SEEDS = fibonacciSphere(16, 1.2);

function usePreparedHeart() {
  const geometry = useLoader(STLLoader, '/entrance/heart-sculpt.stl');
  const tissue = useLoader(TextureLoader, '/entrance/heart-lava-tissue.png');
  return useMemo(() => {
    const geom = geometry.clone();
    geom.computeVertexNormals();
    const mesh = new Mesh(geom, createHeartMaterial(tissue));
    mesh.castShadow = true;
    const group = new Group();
    group.add(mesh);
    fitToSize(group, 2.62);
    const corona = new Mesh(geom, createHeartGlowMaterial(tissue, 0.14));
    corona.scale.setScalar(1.018);
    corona.renderOrder = 2;
    corona.castShadow = false;
    corona.receiveShadow = false;
    group.add(corona);
    group.rotation.y = 0.32;
    return group;
  }, [geometry, tissue]);
}

function HeartModel({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const heart = usePreparedHeart();

  useFrame((state) => {
    heart.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) pulseHeartMaterial(material, state.clock.elapsedTime);
    });
  });

  return <SolidModel object={heart} progressRef={progressRef} slide={0} axis="y" beat />;
}

function usePreparedHandshake() {
  const leftSrc = useLoader(FBXLoader, '/entrance/hand3d/Final_Left_Hand.fbx');
  const albedo = useLoader(TextureLoader, '/entrance/hand3d/skin-albedo.png');
  const normal = useLoader(TextureLoader, '/entrance/hand3d/normal_map.png');

  return useMemo(() => {
    const left = cloneSkinned(leftSrc);
    const right = cloneSkinned(leftSrc);
    dressPhotoHands(left, albedo, normal, 'left');
    dressPhotoHands(right, albedo, normal, 'right');
    fitMeshesToSize(left, 3.78);
    fitMeshesToSize(right, 3.78);
    shiftPalmIn(left, 0.92);
    shiftPalmIn(right, 0.92);
    const half = Math.PI / 2;
    const poseX = -half;
    const poseY = half;
    const poseZ = half;
    const palmHand = new Group();
    palmHand.add(left);
    palmHand.position.set(-0.02, -0.02, -0.1);
    palmHand.rotation.set(poseX, poseY, poseZ);
    const backHand = new Group();
    backHand.add(right);
    backHand.position.set(0.04, 0.12, 0.12);
    backHand.rotation.set(poseX, poseY, poseZ);
    backHand.rotateY(Math.PI);
    const group = new Group();
    group.add(palmHand, backHand);
    group.rotation.x = -0.16;
    return group;
  }, [albedo, leftSrc, normal]);
}

function SolidModel({
  object,
  progressRef,
  slide,
  axis,
  shake = false,
  beat = false,
  scale = 1,
  idleTilt = 0.22,
  offsetY = 0,
  rigid = false,
}: {
  object: Object3D;
  progressRef: MutableRefObject<number>;
  slide: number;
  axis: 'y' | 'z';
  shake?: boolean;
  beat?: boolean;
  scale?: number;
  idleTilt?: number;
  offsetY?: number;
  rigid?: boolean;
}) {
  const group = useRef<Group>(null);
  const spin = useRef(0);

  useFrame((state, delta) => {
    if (!group.current) return;
    const p = progressRef.current;
    const local = clamp01(p - slide);
    const vis =
      smoothstep(slide - 0.2, slide, p) * (1 - smoothstep(slide + 0.72, slide + 0.98, p));
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    group.current.visible = vis > 0.04;
    const target = local * Math.PI * 2;
    spin.current += (target - spin.current) * (1 - Math.exp(-10 * dt));

    if (rigid) {
      group.current.rotation.x = 0;
      group.current.rotation.y = 0;
      group.current.rotation.z = -spin.current;
      group.current.position.x = 0;
    } else {
      group.current.rotation.x = beat ? Math.sin(t * 0.35) * 0.08 : idleTilt + Math.sin(t * 0.4) * 0.03;
      group.current.rotation.y = axis === 'y' ? -spin.current : Math.sin(spin.current) * 0.18;
      group.current.rotation.z = axis === 'z' ? -spin.current : Math.sin(t * 0.25) * 0.04;
      if (shake) {
        group.current.rotation.x += Math.sin(t * 16) * 0.03;
        group.current.position.x = Math.sin(t * 18) * 0.035;
      } else {
        group.current.position.x = 0;
      }
    }

    const pulse = beat ? Math.pow(0.5 + 0.5 * Math.sin(t * 3.15), 16) * 0.045 : 0;
    let y = rigid ? 0 : Math.sin(t * 0.6) * 0.04;
    if (p < slide + 0.12 && slide > 0) y -= (slide + 0.12 - p) * 7;
    if (p > slide + 0.88 && slide < SLIDE_COUNT - 1) y += (p - (slide + 0.88)) * 8;
    group.current.position.y = y + offsetY;
    group.current.scale.setScalar(scale * (0.94 + local * 0.08 + pulse) * Math.max(vis, 0.04));
  });

  return (
    <group ref={group}>
      <primitive object={object} />
    </group>
  );
}

function Studio({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const shards = useRef<Group>(null);
  const rings = useRef<Group>(null);
  const spin = useRef(0);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const p = progressRef.current;
    const dt = Math.min(delta, 0.05);
    const target = p * Math.PI;
    spin.current += (target - spin.current) * (1 - Math.exp(-8 * dt));

    if (rings.current) {
      rings.current.rotation.z = -spin.current;
      rings.current.rotation.y = t * 0.06;
    }

    if (shards.current) {
      shards.current.visible = p < 0.9;
      shards.current.rotation.y = -spin.current * 0.4;
      const burst = 1.2 + (p % 1) * 0.9;
      shards.current.children.forEach((child, index) => {
        const [x, y, z] = CRYSTAL_SEEDS[index];
        child.position.set(x * burst, y * burst, z * burst);
        child.rotation.x = t * 0.3 + index;
        child.scale.setScalar(0.028);
      });
    }

    const cam = state.camera as PerspectiveCamera;
    const hands = smoothstep(0.82, 1.12, p);
    const wantZ = 5.45 + hands * 1.15;
    const wantFov = 34 + hands * 8;
    cam.position.x = Math.sin(spin.current * 0.25) * 0.12 * (1 - hands);
    cam.position.y = 0.08 + hands * 0.02;
    cam.position.z += (wantZ - cam.position.z) * (1 - Math.exp(-6 * dt));
    cam.fov += (wantFov - cam.fov) * (1 - Math.exp(-6 * dt));
    cam.updateProjectionMatrix();
    cam.lookAt(0, 0, 0);
  });

  return (
    <>
      <group ref={rings}>
        <mesh rotation={[Math.PI / 2.5, 0, 0]}>
          <torusGeometry args={[2.35, 0.006, 6, 128]} />
          <meshBasicMaterial color="#7a3a44" transparent opacity={0.4} />
        </mesh>
        <mesh rotation={[1.15, 0.25, 0.35]}>
          <torusGeometry args={[2.9, 0.004, 6, 128]} />
          <meshBasicMaterial color="#c9b8b0" transparent opacity={0.16} />
        </mesh>
      </group>
      <group ref={shards}>
        {CRYSTAL_SEEDS.map((seed) => (
          <mesh key={seed.join(',')} position={seed}>
            <octahedronGeometry args={[1, 0]} />
            <meshPhysicalMaterial
              color="#1a080c"
              metalness={0.5}
              roughness={0.14}
              clearcoat={1}
              emissive="#140408"
              emissiveIntensity={0.08}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}

function HeartBloom({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const { gl, scene, camera, size, viewport } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);

  useLayoutEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.88, 0.52, 0.36);
    composer.addPass(bloom);
    composerRef.current = composer;
    bloomRef.current = bloom;
    composer.setPixelRatio(viewport.dpr);
    composer.setSize(size.width, size.height);
    return () => {
      composer.dispose();
      composerRef.current = null;
      bloomRef.current = null;
    };
  }, [camera, gl, scene, size.height, size.width, viewport.dpr]);

  useFrame(() => {
    const composer = composerRef.current;
    const bloom = bloomRef.current;
    if (!composer || !bloom) return;
    const heart = 1 - smoothstep(0.72, 1.12, progressRef.current);
    bloom.strength = 0.92 * heart;
    composer.render();
  }, 1);

  return null;
}

function Models({ progressRef }: { progressRef: MutableRefObject<number> }) {
  return (
    <>
      <Suspense fallback={null}>
        <HeartModel progressRef={progressRef} />
      </Suspense>
      <Suspense fallback={null}>
        <HandshakeModel progressRef={progressRef} />
      </Suspense>
    </>
  );
}

function HandshakeModel({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const handshake = usePreparedHandshake();
  const { size } = useThree();
  const compact = size.width < 720;

  return (
    <SolidModel
      object={handshake}
      progressRef={progressRef}
      slide={1}
      axis="z"
      scale={compact ? 0.86 : 1}
      offsetY={compact ? 0.04 : 0}
      rigid
    />
  );
}

function CinematicLights({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const heartAmb = useRef<AmbientLight>(null);
  const heartSpot = useRef<SpotLight>(null);
  const heartRim = useRef<DirectionalLight>(null);
  const heartCool = useRef<PointLight>(null);
  const heartFill = useRef<PointLight>(null);
  const heartUnder = useRef<PointLight>(null);
  const handAmb = useRef<AmbientLight>(null);
  const handKey = useRef<SpotLight>(null);
  const handKick = useRef<SpotLight>(null);
  const handFill = useRef<PointLight>(null);
  const handRim = useRef<DirectionalLight>(null);

  useFrame(({ gl }) => {
    const hands = smoothstep(0.72, 1.08, progressRef.current);
    const heart = 1 - hands;
    gl.toneMappingExposure = 0.84 * heart + 0.74 * hands;
    if (heartAmb.current) heartAmb.current.intensity = 0.018 * heart;
    if (heartSpot.current) heartSpot.current.intensity = 4.8 * heart;
    if (heartRim.current) heartRim.current.intensity = 5.2 * heart;
    if (heartCool.current) heartCool.current.intensity = 36 * heart;
    if (heartFill.current) heartFill.current.intensity = 3.6 * heart;
    if (heartUnder.current) heartUnder.current.intensity = 2.2 * heart;
    if (handAmb.current) handAmb.current.intensity = 0.1 * hands;
    if (handKey.current) handKey.current.intensity = 28 * hands;
    if (handKick.current) handKick.current.intensity = 6.5 * hands;
    if (handFill.current) handFill.current.intensity = 3.2 * hands;
    if (handRim.current) handRim.current.intensity = 2.8 * hands;
  });

  return (
    <>
      <ambientLight ref={heartAmb} intensity={0.018} color="#120408" />
      <spotLight
        ref={heartSpot}
        position={[2.8, 4.6, 5.4]}
        angle={0.36}
        penumbra={0.95}
        intensity={4.8}
        color="#ffe4d6"
      />
      <directionalLight ref={heartRim} position={[-5.2, 3.2, -3.6]} intensity={5.2} color="#e8f1ff" />
      <pointLight ref={heartCool} position={[-4.2, 1.8, -2.8]} intensity={36} color="#d7e6ff" />
      <pointLight ref={heartFill} position={[2.4, 0.6, 3.6]} intensity={3.6} color="#6a1420" />
      <pointLight ref={heartUnder} position={[0.2, -1.8, 2.2]} intensity={2.2} color="#3a060c" />

      <ambientLight ref={handAmb} intensity={0} color="#16110e" />
      <spotLight
        ref={handKey}
        position={[0, 1.85, 3.6]}
        angle={0.92}
        penumbra={1}
        intensity={0}
        color="#ffe8d6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
      />
      <spotLight
        ref={handKick}
        position={[-2.6, 1.35, 2.2]}
        angle={0.7}
        penumbra={1}
        intensity={0}
        color="#ffd3b4"
      />
      <pointLight ref={handFill} position={[2.6, -0.85, 1.6]} intensity={0} color="#2c1c16" />
      <directionalLight ref={handRim} position={[1.8, 0.4, -3.2]} intensity={0} color="#d8c4b4" />
    </>
  );
}

export default function EntranceScene({ progressRef }: { progressRef: MutableRefObject<number> }) {
  return (
    <Canvas
      className="entrance-canvas"
      dpr={[1, 1.6]}
      shadows
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.84;
        gl.outputColorSpace = SRGBColorSpace;
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = PCFSoftShadowMap;
        gl.setClearColor(new Color('#050204'), 1);
      }}
      camera={{ position: [0, 0.1, 5.15], fov: 32 }}
    >
      <fog attach="fog" args={['#050204', 7.2, 16]} />
      <CinematicLights progressRef={progressRef} />
      <Studio progressRef={progressRef} />
      <Suspense fallback={null}>
        <Models progressRef={progressRef} />
      </Suspense>
      <Sparkles count={28} scale={[8, 5.4, 8]} size={1.4} speed={0.16} color="#ff5a22" opacity={0.22} />
      <HeartBloom progressRef={progressRef} />
    </Canvas>
  );
}
