import {
  AdditiveBlending,
  FrontSide,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';

const HEART_GLSL = /* glsl */ `
float heartHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float heartNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(heartHash(i), heartHash(i + vec3(1,0,0)), f.x),
        mix(heartHash(i + vec3(0,1,0)), heartHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(heartHash(i + vec3(0,0,1)), heartHash(i + vec3(1,0,1)), f.x),
        mix(heartHash(i + vec3(0,1,1)), heartHash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}
float heartFbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * heartNoise(p);
    p *= 2.07;
    a *= 0.5;
  }
  return s;
}
vec3 heartTriplanar(sampler2D tex, vec3 pos, vec3 nor, float scale) {
  vec3 blending = abs(normalize(nor));
  blending = pow(blending, vec3(4.0));
  blending /= max(blending.x + blending.y + blending.z, 0.0001);
  vec3 x = texture2D(tex, pos.yz * scale).rgb;
  vec3 y = texture2D(tex, pos.xz * scale).rgb;
  vec3 z = texture2D(tex, pos.xy * scale).rgb;
  return x * blending.x + y * blending.y + z * blending.z;
}
float heartGlowMask(vec3 tex) {
  float hot = tex.g * 0.78 + tex.r * 0.32;
  return pow(smoothstep(0.4, 0.84, hot), 1.55);
}
`;

function prepTissue(tissue: Texture) {
  tissue.colorSpace = SRGBColorSpace;
  tissue.wrapS = RepeatWrapping;
  tissue.wrapT = RepeatWrapping;
  tissue.anisotropy = 8;
  tissue.needsUpdate = true;
  return tissue;
}

export function createHeartMaterial(tissue: Texture) {
  prepTissue(tissue);

  const material = new MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.26,
    metalness: 0.02,
    clearcoat: 0.9,
    clearcoatRoughness: 0.14,
    sheen: 0.16,
    sheenColor: '#2a0508',
    emissive: '#000000',
    emissiveIntensity: 1,
    specularIntensity: 0.95,
    specularColor: '#ffc8a8',
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTissue = { value: tissue };
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uPulse = { value: 0 };
    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vHeartPos;
        varying vec3 vHeartNormal;
        varying vec3 vHeartWorldN;
        varying vec3 vHeartViewDir;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vHeartNormal = objectNormal;
        vHeartWorldN = normalize(mat3(modelMatrix) * objectNormal);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vHeartPos = position;
        vec3 heartWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vHeartViewDir = cameraPosition - heartWorld;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vHeartPos;
        varying vec3 vHeartNormal;
        varying vec3 vHeartWorldN;
        varying vec3 vHeartViewDir;
        uniform sampler2D uTissue;
        uniform float uTime;
        uniform float uPulse;
        float heartVein = 0.0;
        float heartGlow = 0.0;
        float heartN = 0.0;
        ${HEART_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        `
        vec3 nrm = normalize(vHeartNormal);
        vec3 worldN = normalize(vHeartWorldN);
        vec3 tex = heartTriplanar(uTissue, vHeartPos, nrm, 0.00122);
        heartN = heartFbm(vHeartPos * 0.007);

        float luma = dot(tex, vec3(0.16, 0.68, 0.06));
        vec3 muscleTex = pow(max(tex, vec3(0.0)), vec3(1.7, 2.15, 2.35)) * vec3(0.72, 0.18, 0.14);
        vec3 darkMuscle = vec3(0.05, 0.008, 0.012);
        vec3 albedo = mix(darkMuscle, muscleTex, smoothstep(0.03, 0.34, luma) * (0.72 + heartN * 0.28));

        vec3 q = vHeartPos * 0.011 + heartFbm(vHeartPos * 0.0048) * 4.2;
        float line = abs(heartNoise(q * vec3(1.0, 2.6, 1.0)) - 0.5);
        float branch = abs(heartNoise(q.zxy * 1.45) - 0.5);
        float vein = 1.0 - smoothstep(0.0, 0.038, min(line, branch));
        vein *= smoothstep(0.52, 0.78, heartFbm(vHeartPos * 0.0032));
        heartVein = vein;

        float texGlow = heartGlowMask(tex);
        heartGlow = max(texGlow, vein * 0.88);
        albedo = mix(albedo, vec3(0.42, 0.04, 0.015), smoothstep(0.08, 0.45, heartGlow) * 0.4);
        albedo = mix(albedo, vec3(0.95, 0.16, 0.03), heartGlow * 0.62);
        albedo = mix(albedo, vec3(1.0, 0.46, 0.08), pow(heartGlow, 2.8) * 0.85);

        float ndv = max(dot(worldN, normalize(vHeartViewDir)), 0.0);
        float fres = pow(1.0 - ndv, 3.6);
        albedo += vec3(0.58, 0.72, 0.92) * fres * 0.32;

        vec3 rimDir = normalize(vec3(-0.62, 0.42, -0.48));
        float rim = pow(1.0 - max(dot(worldN, rimDir), 0.0), 2.5);
        albedo += vec3(0.82, 0.9, 1.0) * rim * 0.58;

        float cavity = pow(1.0 - abs(dot(nrm, vec3(0.08, 1.0, 0.12))), 1.4);
        albedo *= mix(1.0, 0.55, cavity * 0.62);

        diffuseColor.rgb = albedo;
        `,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float beat = 0.7 + uPulse * 2.1;
        totalEmissiveRadiance += vec3(1.35, 0.14, 0.02) * heartGlow * beat;
        totalEmissiveRadiance += vec3(1.0, 0.42, 0.06) * pow(heartGlow, 3.0) * (1.2 + uPulse * 2.6);
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor *= mix(0.7, 1.15, heartN);
        roughnessFactor *= mix(1.0, 0.4, heartGlow);
        `,
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        normal = normalize(normal + vec3(
          heartFbm(vHeartPos * 0.02) - 0.5,
          heartFbm(vHeartPos * 0.02 + 11.0) - 0.5,
          0.0
        ) * 0.28);
        `,
      );
  };

  material.customProgramCacheKey = () => 'uit-heart-glow-v5';
  return material;
}

export function createHeartGlowMaterial(tissue: Texture, intensity = 0.16) {
  prepTissue(tissue);

  const material = new MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 1,
    blending: AdditiveBlending,
    depthWrite: false,
    side: FrontSide,
    toneMapped: false,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTissue = { value: tissue };
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uPulse = { value: 0 };
    shader.uniforms.uGlowGain = { value: intensity };
    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vHeartPos;
        varying vec3 vHeartNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vHeartPos = position;
        vHeartNormal = normal;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vHeartPos;
        varying vec3 vHeartNormal;
        uniform sampler2D uTissue;
        uniform float uTime;
        uniform float uPulse;
        uniform float uGlowGain;
        ${HEART_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        `
        vec3 nrm = normalize(vHeartNormal);
        vec3 tex = heartTriplanar(uTissue, vHeartPos, nrm, 0.00122);
        float glow = heartGlowMask(tex);
        vec3 q = vHeartPos * 0.011 + heartFbm(vHeartPos * 0.0048) * 4.2;
        float line = abs(heartNoise(q * vec3(1.0, 2.6, 1.0)) - 0.5);
        float branch = abs(heartNoise(q.zxy * 1.45) - 0.5);
        float vein = 1.0 - smoothstep(0.0, 0.038, min(line, branch));
        vein *= smoothstep(0.58, 0.82, heartFbm(vHeartPos * 0.0032));
        glow = max(glow, vein * 0.75);
        float gain = uGlowGain * (0.45 + uPulse * 0.9);
        diffuseColor.rgb = vec3(1.0, 0.16, 0.02) * glow * gain;
        diffuseColor.rgb += vec3(1.0, 0.5, 0.1) * pow(glow, 2.8) * gain;
        `,
      );
  };

  material.customProgramCacheKey = () => `uit-heart-corona-v3-${intensity}`;
  return material;
}

export function pulseHeartMaterial(material: { userData: { shader?: unknown } }, time: number) {
  const shader = material.userData.shader as
    | { uniforms: { uTime?: { value: number }; uPulse?: { value: number } } }
    | undefined;
  if (!shader?.uniforms.uTime || !shader.uniforms.uPulse) return;
  shader.uniforms.uTime.value = time;
  shader.uniforms.uPulse.value = Math.pow(0.5 + 0.5 * Math.sin(time * 3.15), 16);
}
