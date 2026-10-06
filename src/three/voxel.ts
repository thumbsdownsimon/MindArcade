// Shared "blocky" model format used by every 3D game.
// A model is a set of bones; each bone is a pivot point plus boxes positioned relative to it.
// Boxes are merged into one vertex-coloured geometry per bone, so a whole character costs a
// handful of draw calls and bones can still be rotated for animation.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type V3 = [number, number, number];

export interface Part {
  /** Box size (w, h, d). */
  s: V3;
  /** Box centre, relative to the bone pivot. */
  p: V3;
  /** CSS colour. */
  c: string;
}

export interface Bone {
  pivot: V3;
  parts: Part[];
}

export type Model = Record<string, Bone>;

export const box = (s: V3, p: V3, c: string): Part => ({ s, p, c });

const tmpColor = new THREE.Color();

/** Merges boxes into one geometry with per-vertex colours. Returns null for an empty list. */
export function mergeParts(parts: Part[], offset: V3 = [0, 0, 0]): THREE.BufferGeometry | null {
  if (!parts.length) return null;
  const geos = parts.map(({ s, p, c }) => {
    const g = new THREE.BoxGeometry(s[0], s[1], s[2]);
    g.translate(p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]);
    tmpColor.set(c);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = tmpColor.r;
      col[i * 3 + 1] = tmpColor.g;
      col[i * 3 + 2] = tmpColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    return g;
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return merged;
}

/** Geometry per bone, cached by model key so identical characters share GPU buffers. */
const boneCache = new Map<string, Record<string, THREE.BufferGeometry | null>>();

export function boneGeometries(key: string, model: Model) {
  let hit = boneCache.get(key);
  if (!hit) {
    hit = Object.fromEntries(Object.entries(model).map(([name, b]) => [name, mergeParts(b.parts)]));
    boneCache.set(key, hit);
  }
  return hit;
}

/** All bones flattened into one geometry, in model space (used for static props and snapshots). */
export function flatParts(model: Model): Part[] {
  return Object.values(model).flatMap((b) =>
    b.parts.map((pt) => ({ ...pt, p: [pt.p[0] + b.pivot[0], pt.p[1] + b.pivot[1], pt.p[2] + b.pivot[2]] as V3 })),
  );
}

export const voxelMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });

/* ---------- Snapshots: render a model to a PNG once, for HUD icons and answer buttons ---------- */

let snapRenderer: THREE.WebGLRenderer | null = null;
const snapCache = new Map<string, string>();

/**
 * Renders the given parts to a transparent PNG data URL. Uses one shared offscreen renderer,
 * so dozens of thumbnails cost a single WebGL context. Returns '' if WebGL is unavailable.
 */
export function snapshot(key: string, parts: Part[], opts: { yaw?: number; pitch?: number; w?: number; h?: number } = {}) {
  const cached = snapCache.get(key);
  if (cached !== undefined) return cached;
  const { yaw = -0.6, pitch = 0.35, w = 256, h = 192 } = opts;
  let url = '';
  try {
    if (!snapRenderer) {
      snapRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      snapRenderer.setPixelRatio(1);
    }
    snapRenderer.setSize(w, h, false);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#8a8f9c', 2.2));
    const sun = new THREE.DirectionalLight('#ffffff', 2.2);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    const geo = mergeParts(parts)!;
    const mesh = new THREE.Mesh(geo, voxelMaterial);
    mesh.rotation.y = yaw;
    scene.add(mesh);

    const bb = new THREE.Box3().setFromObject(mesh);
    const centre = bb.getCenter(new THREE.Vector3());
    const radius = bb.getBoundingSphere(new THREE.Sphere()).radius;
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.01, 100);
    const dist = radius / Math.sin(THREE.MathUtils.degToRad(15)) * 0.92;
    cam.position.set(centre.x, centre.y + Math.sin(pitch) * dist, centre.z + Math.cos(pitch) * dist);
    cam.lookAt(centre);
    snapRenderer.render(scene, cam);
    url = snapRenderer.domElement.toDataURL('image/png');
    geo.dispose();
  } catch {
    url = '';
  }
  snapCache.set(key, url);
  return url;
}
