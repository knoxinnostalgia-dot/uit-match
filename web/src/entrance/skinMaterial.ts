import {
  MeshPhysicalMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  type Texture,
} from 'three';

const SKIN_GLSL = /* glsl */ `
vec3 skinTriplanar(sampler2D tex, vec3 pos, vec3 nor, float scale) {
  vec3 blending = abs(normalize(nor));
  blending = pow(blending, vec3(4.0));
  blending /= max(blending.x + blending.y + blending.z, 0.0001);
  vec3 x = texture2D(tex, pos.yz * scale).rgb;
  vec3 y = texture2D(tex, pos.xz * scale).rgb;
  vec3 z = texture2D(tex, pos.xy * scale).rgb;
  return x * blending.x + y * blending.y + z * blending.z;
}
float skinLuma(vec3 c) {
  return dot(c, vec3(0.26, 0.52, 0.22));
}
`;

function prepSkin(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function createSkinMaterial(
  pore: Texture,
  knuckle: Texture,
  tone: 'adam' | 'god',
) {
  prepSkin(pore);
  prepSkin(knuckle);

  const material = new MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.54,
    metalness: 0,
    sheen: 0.32,
    sheenColor: tone === 'adam' ? '#c48a68' : '#e2b49a',
    sheenRoughness: 0.64,
    clearcoat: 0.07,
    clearcoatRoughness: 0.72,
    specularIntensity: 0.38,
    specularColor: '#ffd8c6',
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPore = { value: pore };
    shader.uniforms.uKnuckle = { value: knuckle };
    shader.uniforms.uAdam = { value: tone === 'adam' ? 1 : 0 };
    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSkinWorld;
        varying vec3 vSkinNormal;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vSkinWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vSkinNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSkinWorld;
        varying vec3 vSkinNormal;
        uniform sampler2D uPore;
        uniform sampler2D uKnuckle;
        uniform float uAdam;
        ${SKIN_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        `
        vec3 nrm = normalize(vSkinNormal);
        vec3 pore = skinTriplanar(uPore, vSkinWorld, nrm, 14.0);
        vec3 crease = skinTriplanar(uKnuckle, vSkinWorld, nrm, 11.0);
        float creaseMask = smoothstep(0.32, 0.78, skinLuma(crease));
        vec3 tex = mix(pore, crease, 0.38 + creaseMask * 0.22);

        vec3 warm = mix(vec3(1.06, 0.96, 0.9), vec3(0.96, 0.78, 0.62), uAdam);
        vec3 graded = pow(max(tex, vec3(0.0)), vec3(0.92, 1.02, 1.12)) * warm;

        float cavity = pow(1.0 - abs(dot(nrm, vec3(0.1, 1.0, 0.12))), 1.45);
        graded *= mix(vec3(1.08, 1.02, 0.98), vec3(0.62, 0.38, 0.3), cavity * 0.55);
        graded += vec3(0.28, 0.07, 0.04) * cavity * 0.18;

        float wrap = 0.55 + 0.45 * (nrm.y * 0.5 + 0.5);
        graded *= mix(vec3(0.72, 0.42, 0.36), vec3(1.1, 1.02, 0.96), wrap);

        diffuseColor.rgb = graded;
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float skinH = skinLuma(skinTriplanar(uPore, vSkinWorld, normalize(vSkinNormal), 14.0));
        roughnessFactor *= mix(0.82, 1.18, skinH);
        `,
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        vec3 skinN = normalize(vSkinNormal);
        vec3 sp = vSkinWorld * 14.0;
        float hL = skinLuma(texture2D(uPore, sp.yz + vec2(0.004, 0.0)).rgb);
        float hR = skinLuma(texture2D(uPore, sp.yz - vec2(0.004, 0.0)).rgb);
        float hU = skinLuma(texture2D(uPore, sp.yz + vec2(0.0, 0.004)).rgb);
        float hD = skinLuma(texture2D(uPore, sp.yz - vec2(0.0, 0.004)).rgb);
        normal = normalize(normal + vec3(hL - hR, hU - hD, 0.0) * 1.35);
        `,
      );
  };

  material.customProgramCacheKey = () => `uit-skin-v2-${tone}`;
  return material;
}

export function createPhotoHandMaterial(albedo: Texture, normal: Texture, side: 'left' | 'right') {
  albedo.colorSpace = SRGBColorSpace;
  albedo.anisotropy = 8;
  albedo.needsUpdate = true;
  normal.colorSpace = NoColorSpace;
  normal.anisotropy = 8;
  normal.needsUpdate = true;

  return new MeshPhysicalMaterial({
    map: albedo,
    normalMap: normal,
    normalScale: new Vector2(0.95, 0.95),
    color: side === 'left' ? '#ffe9dc' : '#f3d2bc',
    roughness: 0.42,
    metalness: 0,
    sheen: 0.38,
    sheenColor: side === 'left' ? '#ffd8c4' : '#e8b898',
    sheenRoughness: 0.68,
    clearcoat: 0.14,
    clearcoatRoughness: 0.5,
    specularIntensity: 0.42,
    specularColor: '#ffe4d2',
    ior: 1.38,
    iridescence: 0,
  });
}
