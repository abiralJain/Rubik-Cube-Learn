import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, NeutralToneMapping, type Mesh, type PerspectiveCamera } from 'three';
import { APPARENT_RADIUS, CAMERA_ELEVATION, CAMERA_FOV, CUBE_HALF, FILL } from '../constants';
import { bodyGeometry, bodyMaterial, environmentFor, makeStickerMaterial, shadowMaterial, stickerGeometry, COLORS_FROM } from '../geometry';
import { SLOTS, STICKERS } from '../placements';
import type { CubeController } from '../controller';

export function Lights() {
  return (
    <>
      <hemisphereLight args={['#FFF4E6', '#6A5A7A', 0.7]} />
      <directionalLight position={[4, 6, 5]} color="#FFF3E4" intensity={2.2} />
      <directionalLight position={[-5, 2, 3]} color="#FFE3C8" intensity={0.8} />
      <directionalLight position={[-3, 5, -6]} color="#DCE6FF" intensity={1.2} />
    </>
  );
}

export function SceneEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.toneMapping = NeutralToneMapping;
    gl.toneMappingExposure = 1.18;
    const t0 = performance.now();
    scene.environment = environmentFor(gl);
    if (import.meta.env.DEV) console.info(`[cube] environment ${(performance.now() - t0).toFixed(0)}ms`);
    scene.environmentIntensity = 0.9;
  }, [gl, scene]);
  return null;
}

export function CameraFit({ fill = FILL, targetY = 0 }: { fill?: number; targetY?: number }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    cam.fov = CAMERA_FOV;
    const vHalf = Math.tan(MathUtils.degToRad(cam.fov) / 2);
    const aspect = size.width / size.height;
    const halfShort = aspect >= 1 ? vHalf : vHalf * aspect;
    const d = APPARENT_RADIUS / (fill * halfShort);
    const phi = MathUtils.degToRad(CAMERA_ELEVATION);
    cam.position.set(0, d * Math.sin(phi) + targetY, d * Math.cos(phi));
    cam.lookAt(0, targetY, 0);
    cam.aspect = aspect;
    cam.near = 1; cam.far = 200;
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height, fill, targetY]);
  return null;
}

export function GroundShadow({ ctrl }: { ctrl: CubeController }) {
  const ref = useRef<Mesh>(null);
  const mat = useMemo(() => shadowMaterial(), []);
  useFrame(() => {
    const m = ref.current; if (!m) return;
    mat.opacity = 0.9 - ctrl.floatY * 3;
    const s = 1 + ctrl.floatY * 0.6;
    m.scale.set(s, s, 1);
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position={[0, -(CUBE_HALF + 1.35), 0.2]} material={mat}>
      <planeGeometry args={[6.4, 6.4]} />
    </mesh>
  );
}

/** 26 bodies + 54 stickers registered into the controller; the controller's update() drives every frame. */
export function CubeRig({ ctrl }: { ctrl: CubeController }) {
  const group = useRef<import('three').Group>(null);
  const { camera, invalidate, gl } = useThree();
  const materials = useMemo(() => STICKERS.map((p) => makeStickerMaterial(COLORS_FROM(ctrl.displayFacelets[p.index]))), [ctrl]);

  const { scene } = useThree();
  useEffect(() => {
    ctrl.camera = camera as PerspectiveCamera;
    ctrl.invalidate = invalidate;
    ctrl.adoptFacelets(ctrl.displayFacelets, true);
    // Compile the physical-material programs off the critical path, then reveal.
    const g = group.current;
    if (g) g.visible = false;
    let cancelled = false;
    const t0 = performance.now();
    const reveal = () => {
      if (cancelled) return;
      if (g) g.visible = true;
      ctrl.ready = true;
      ctrl.onReady?.();
      if (import.meta.env.DEV) console.info(`[cube] shaders ready ${(performance.now() - t0).toFixed(0)}ms`);
      invalidate();
    };
    const compile = (gl as unknown as { compileAsync?: (s: unknown, c: unknown) => Promise<unknown> }).compileAsync;
    if (compile) compile.call(gl, scene, camera).then(reveal, reveal);
    else reveal();
    return () => { cancelled = true; };
  }, [ctrl, camera, invalidate, gl, scene]);

  const firstFrame = useRef(true);
  useFrame((_, dt) => {
    if (firstFrame.current) { firstFrame.current = false; if (import.meta.env.DEV) { const t = performance.now(); requestAnimationFrame(() => console.info(`[cube] first frame ${(performance.now() - t).toFixed(0)}ms, calls ${gl.info.render.calls}`)); } }
    ctrl.update(dt);
    const g = group.current; if (!g) return;
    g.quaternion.copy(ctrl.qDrift).multiply(ctrl.qOrientation);
    g.position.y = ctrl.floatY;
    const sq = ctrl.squash.x * 0.015;
    const ax = ctrl.squashAxis;
    g.scale.set(ctrl.breath + sq * Math.abs(ax.x) - sq * 0.5 * (1 - Math.abs(ax.x)), ctrl.breath + sq * Math.abs(ax.y) - sq * 0.5 * (1 - Math.abs(ax.y)), ctrl.breath + sq * Math.abs(ax.z) - sq * 0.5 * (1 - Math.abs(ax.z)));
  });

  return (
    <group ref={group}>
      {SLOTS.map((s) => (
        <mesh key={s.id} geometry={bodyGeometry} material={bodyMaterial} position={s.rest} ref={(m) => { if (m) ctrl.bodies.set(s.id, m); }} />
      ))}
      {STICKERS.map((p) => (
        <mesh
          key={p.index}
          geometry={stickerGeometry}
          material={materials[p.index]}
          position={p.position}
          quaternion={p.quaternion}
          ref={(m) => { if (m) { m.userData.index = p.index; ctrl.stickers[p.index] = m; } }}
        />
      ))}
    </group>
  );
}
