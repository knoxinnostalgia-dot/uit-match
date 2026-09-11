import { Box3, Mesh, Object3D, SkinnedMesh, Vector3 } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createPhotoHandMaterial, createSkinMaterial } from './skinMaterial';
import type { Texture } from 'three';

const SIZE = new Vector3();
const CENTER = new Vector3();

export function prepareScene(source: Object3D, targetSize: number, skinned = false) {
  const scene = skinned ? cloneSkinned(source) : source.clone(true);
  scene.traverse((node) => {
    if (node.name.startsWith('xr_')) node.visible = false;
  });
  if (targetSize > 0) fitToSize(scene, targetSize);
  return scene;
}

export function fitToSize(object: Object3D, targetSize: number) {
  const box = new Box3().setFromObject(object);
  box.getSize(SIZE);
  const longest = Math.max(SIZE.x, SIZE.y, SIZE.z) || 1;
  object.scale.multiplyScalar(targetSize / longest);
  box.setFromObject(object);
  box.getCenter(CENTER);
  object.position.sub(CENTER);
}

export function fitMeshesToSize(object: Object3D, targetSize: number) {
  object.position.set(0, 0, 0);
  object.rotation.set(0, 0, 0);
  object.scale.set(1, 1, 1);
  object.updateMatrixWorld(true);
  const box = new Box3();
  object.traverse((node) => {
    if (!(node instanceof Mesh) || !node.geometry) return;
    const geometry = node.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    box.union(geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
  });
  if (box.isEmpty()) {
    fitToSize(object, targetSize);
    return;
  }
  box.getSize(SIZE);
  object.scale.setScalar(targetSize / Math.max(SIZE.x, SIZE.y, SIZE.z, 0.0001));
  object.updateMatrixWorld(true);
  box.makeEmpty();
  object.traverse((node) => {
    if (!(node instanceof Mesh) || !node.geometry) return;
    const geometry = node.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    box.union(geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
  });
  box.getCenter(CENTER);
  object.position.sub(CENTER);
}

/** This sculpt’s fingers sit on +Z. Pull them toward the origin so the forearm extends out. */
export function shiftPalmIn(object: Object3D, amount = 0.95) {
  object.position.z -= amount;
}

export function skinHands(
  object: Object3D,
  pore: Texture,
  knuckle: Texture,
  tone: 'adam' | 'god',
) {
  object.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.material = createSkinMaterial(pore, knuckle, tone);
    node.castShadow = true;
  });
}

function curlFinger(
  object: Object3D,
  finger: string,
  proximal: number,
  mid: number,
  distal: number,
) {
  object.traverse((node) => {
    const name = node.name;
    if (name === `${finger}-phalanx-proximal`) node.rotation.x += proximal;
    if (name === `${finger}-phalanx-intermediate`) node.rotation.x += mid;
    if (name === `${finger}-phalanx-distal`) node.rotation.x += distal;
  });
}

function curlThumb(object: Object3D, proximalX: number, proximalY: number, distalX: number) {
  object.traverse((node) => {
    if (node.name === 'thumb-phalanx-proximal') {
      node.rotation.x += proximalX;
      node.rotation.y += proximalY;
    }
    if (node.name === 'thumb-phalanx-distal') node.rotation.x += distalX;
  });
}

function findSkinned(object: Object3D) {
  let found: SkinnedMesh | undefined;
  object.traverse((node) => {
    if (found) return;
    if ((node as SkinnedMesh).isSkinnedMesh) found = node as SkinnedMesh;
  });
  return found;
}

function curlChain(bones: Object3D[], start: number, amounts: number[], axis: 'x' | 'z' = 'x') {
  amounts.forEach((amount, index) => {
    const bone = bones[start + index];
    if (!bone || !amount) return;
    bone.rotation[axis] += amount;
  });
}

/** Studio photo: left hand droops toward the gap, right hand points across. */
export function posePhotoReach(object: Object3D, side: 'left' | 'right') {
  const mesh = findSkinned(object);
  if (!mesh) return;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const bones = mesh.skeleton.bones;
  if (bones.length < 21) return;

  if (side === 'left') {
    curlChain(bones, 1, [0.18, 0.28, 0.16, 0.08]);
    curlChain(bones, 5, [0.12, 0.22, 0.18, 0.1]);
    curlChain(bones, 9, [0.16, 0.26, 0.2, 0.1]);
    curlChain(bones, 13, [0.2, 0.3, 0.22, 0.12]);
    curlChain(bones, 17, [0.22, 0.32, 0.24, 0.12]);
    return;
  }

  curlChain(bones, 1, [0.42, 0.22, 0.12, 0.04]);
  curlChain(bones, 5, [0.04, 0.02, 0, 0]);
  curlChain(bones, 9, [0.38, 0.48, 0.28, 0.1]);
  curlChain(bones, 13, [0.72, 0.88, 0.42, 0.16]);
  curlChain(bones, 17, [0.82, 0.96, 0.48, 0.18]);
}

export function dressPhotoHands(object: Object3D, albedo: Texture, normal: Texture, side: 'left' | 'right') {
  const material = createPhotoHandMaterial(albedo, normal, side);
  object.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.material = material;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;
  });
}

/** Michelangelo Creation of Adam: limp reaching hand vs pointing hand. */
export function poseCreationOfAdam(object: Object3D, role: 'adam' | 'god') {
  if (role === 'adam') {
    curlFinger(object, 'index-finger', 0.2, 0.3, 0.16);
    curlFinger(object, 'middle-finger', 0.72, 0.92, 0.5);
    curlFinger(object, 'ring-finger', 0.82, 1.02, 0.54);
    curlFinger(object, 'pinky-finger', 0.9, 1.08, 0.52);
    curlThumb(object, 0.32, 0.4, 0.22);
    return;
  }

  curlFinger(object, 'index-finger', -0.1, 0, 0);
  curlFinger(object, 'middle-finger', 0.7, 0.92, 0.52);
  curlFinger(object, 'ring-finger', 0.78, 0.98, 0.54);
  curlFinger(object, 'pinky-finger', 0.82, 1.0, 0.5);
  curlThumb(object, 0.12, -0.4, 0.12);
}
