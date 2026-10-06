// Blocky character and prop models. Every character shares the same look: box head, box torso,
// box limbs. Front is +z, up is +y, and models stand on y = 0.

import { box, type Model, type Part } from './voxel';

/* ---------- People ---------- */

export interface PersonLook {
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  shoes?: string;
  beard?: string;
  /** Darker band across the shirt, e.g. a sailor's stripes. */
  stripe?: string;
  hat?: 'captain' | 'cap' | 'bow';
  hatColor?: string;
  kid?: boolean;
}

/** Minecraft-proportioned person, about 2 units tall (kids ~1.55). Bones: body, head, armL/R, legL/R. */
export function person(l: PersonLook): Model {
  const k = l.kid;
  const leg = k ? 0.48 : 0.75;
  const torso = k ? 0.55 : 0.75;
  const hip = leg;
  const neck = hip + torso;
  const head = 0.5;
  const shoes = l.shoes ?? '#3b2f2a';
  const eyeY = head * 0.5;

  const headParts: Part[] = [
    box([head, head, head], [0, head / 2, 0], l.skin),
    // hair: top cap and back
    box([head + 0.04, 0.14, head + 0.04], [0, head - 0.05, 0], l.hair),
    box([head + 0.04, head * 0.55, 0.08], [0, head * 0.68, -head / 2 - 0.0], l.hair),
    box([0.06, head * 0.4, head * 0.8], [head / 2, head * 0.75, -0.05], l.hair),
    box([0.06, head * 0.4, head * 0.8], [-head / 2, head * 0.75, -0.05], l.hair),
    // eyes
    box([0.1, 0.08, 0.02], [-0.11, eyeY, head / 2 + 0.005], '#ffffff'),
    box([0.1, 0.08, 0.02], [0.11, eyeY, head / 2 + 0.005], '#ffffff'),
    box([0.05, 0.08, 0.025], [-0.09, eyeY, head / 2 + 0.01], '#2a3655'),
    box([0.05, 0.08, 0.025], [0.13, eyeY, head / 2 + 0.01], '#2a3655'),
    // mouth
    box([0.14, 0.035, 0.02], [0.01, eyeY - 0.13, head / 2 + 0.005], '#8a4b3a'),
  ];
  if (l.beard)
    headParts.push(
      box([head + 0.02, 0.16, 0.06], [0, 0.08, head / 2], l.beard),
      box([0.12, 0.08, 0.06], [-0.19, 0.2, head / 2], l.beard),
      box([0.12, 0.08, 0.06], [0.19, 0.2, head / 2], l.beard),
    );
  if (l.hat === 'captain')
    headParts.push(
      box([head + 0.08, 0.18, head + 0.08], [0, head + 0.06, 0], l.hatColor ?? '#f8fafc'),
      box([head + 0.1, 0.05, head + 0.1], [0, head - 0.02, 0], '#1e293b'),
      box([head * 0.6, 0.04, 0.16], [0, head - 0.02, head / 2 + 0.1], '#1e293b'),
      box([0.1, 0.08, 0.02], [0, head + 0.06, head / 2 + 0.045], '#eab308'),
    );
  if (l.hat === 'cap')
    headParts.push(
      box([head + 0.06, 0.14, head + 0.06], [0, head + 0.03, 0], l.hatColor ?? '#ef4444'),
      box([head * 0.8, 0.04, 0.2], [0, head - 0.01, head / 2 + 0.12], l.hatColor ?? '#ef4444'),
    );
  if (l.hat === 'bow')
    headParts.push(
      box([0.12, 0.1, 0.1], [0, head + 0.03, -0.1], l.hatColor ?? '#ec4899'),
      box([0.12, 0.14, 0.08], [-0.11, head + 0.03, -0.1], l.hatColor ?? '#ec4899'),
      box([0.12, 0.14, 0.08], [0.11, head + 0.03, -0.1], l.hatColor ?? '#ec4899'),
    );

  const bodyParts: Part[] = [box([0.5, torso, 0.27], [0, hip + torso / 2, 0], l.shirt)];
  if (l.stripe)
    for (let i = 0; i < 3; i++) bodyParts.push(box([0.52, 0.07, 0.29], [0, hip + torso * (0.25 + i * 0.25), 0], l.stripe));
  bodyParts.push(box([0.52, 0.08, 0.29], [0, hip + 0.04, 0], l.pants)); // belt line

  const armLen = torso;
  const arm = (): Part[] => [
    box([0.22, armLen * 0.72, 0.24], [0, -armLen * 0.36 + 0.06, 0], l.shirt),
    box([0.2, armLen * 0.28, 0.22], [0, -armLen * 0.86 + 0.06, 0], l.skin),
    ...(l.stripe ? [box([0.23, 0.06, 0.25], [0, -armLen * 0.3, 0], l.stripe)] : []),
  ];
  const legPart = (): Part[] => [
    box([0.24, leg * 0.82, 0.26], [0, -leg * 0.41, 0], l.pants),
    box([0.25, leg * 0.18, 0.3], [0, -leg * 0.91, 0.02], shoes),
  ];

  return {
    body: { pivot: [0, 0, 0], parts: bodyParts },
    head: { pivot: [0, neck, 0], parts: headParts },
    armL: { pivot: [-0.36, neck - 0.06, 0], parts: arm() },
    armR: { pivot: [0.36, neck - 0.06, 0], parts: arm() },
    legL: { pivot: [-0.125, hip, 0], parts: legPart() },
    legR: { pivot: [0.125, hip, 0], parts: legPart() },
  };
}

/* ---------- Animals ---------- */

/** Bones: body, head, tail, legFL/FR/BL/BR. About 1.1 long, 0.9 tall. */
export function fox(dark: boolean): Model {
  const fur = dark ? '#2b2d38' : '#e8772e';
  const furDark = dark ? '#16171f' : '#b4521a';
  const belly = dark ? '#5b5f70' : '#fff7ed';
  const eye = dark ? '#f43f5e' : '#1f2937';
  const leg = (): Part[] => [box([0.14, 0.32, 0.14], [0, -0.16, 0], furDark), box([0.15, 0.08, 0.17], [0, -0.3, 0.02], '#1f1f24')];
  return {
    body: {
      pivot: [0, 0, 0],
      parts: [box([0.42, 0.36, 0.8], [0, 0.5, 0], fur), box([0.36, 0.08, 0.6], [0, 0.32, 0.04], belly), box([0.3, 0.22, 0.12], [0, 0.48, 0.42], belly)],
    },
    head: {
      pivot: [0, 0.62, 0.38],
      parts: [
        box([0.42, 0.36, 0.36], [0, 0.12, 0.16], fur),
        box([0.22, 0.16, 0.2], [0, 0.04, 0.42], belly),
        box([0.08, 0.07, 0.04], [0, 0.1, 0.53], '#111'),
        box([0.12, 0.16, 0.06], [-0.14, 0.36, 0.08], fur),
        box([0.12, 0.16, 0.06], [0.14, 0.36, 0.08], fur),
        box([0.06, 0.08, 0.02], [-0.14, 0.34, 0.115], furDark),
        box([0.06, 0.08, 0.02], [0.14, 0.34, 0.115], furDark),
        box([0.07, 0.07, 0.02], [-0.11, 0.17, 0.345], eye),
        box([0.07, 0.07, 0.02], [0.11, 0.17, 0.345], eye),
        box([0.4, 0.08, 0.3], [0, -0.02, 0.17], belly),
      ],
    },
    tail: {
      pivot: [0, 0.6, -0.4],
      parts: [box([0.2, 0.2, 0.5], [0, 0.04, -0.25], fur), box([0.21, 0.21, 0.14], [0, 0.04, -0.52], dark ? '#9ca3af' : '#fff7ed')],
    },
    legFL: { pivot: [-0.13, 0.36, 0.28], parts: leg() },
    legFR: { pivot: [0.13, 0.36, 0.28], parts: leg() },
    legBL: { pivot: [-0.13, 0.36, -0.28], parts: leg() },
    legBR: { pivot: [0.13, 0.36, -0.28], parts: leg() },
  };
}

/** Bones: body, head, wingL/R, legL/R. */
export function chicken(): Model {
  const leg = (): Part[] => [box([0.05, 0.22, 0.05], [0, -0.11, 0], '#f59e0b'), box([0.12, 0.03, 0.14], [0, -0.21, 0.03], '#f59e0b')];
  return {
    body: { pivot: [0, 0, 0], parts: [box([0.4, 0.38, 0.5], [0, 0.42, 0], '#fafafa'), box([0.3, 0.2, 0.14], [0, 0.56, -0.3], '#e5e7eb')] },
    head: {
      pivot: [0, 0.58, 0.18],
      parts: [
        box([0.26, 0.32, 0.24], [0, 0.18, 0.04], '#fafafa'),
        box([0.08, 0.12, 0.2], [0, 0.4, 0.03], '#ef4444'),
        box([0.12, 0.07, 0.12], [0, 0.18, 0.21], '#f59e0b'),
        box([0.07, 0.1, 0.05], [0, 0.08, 0.17], '#dc2626'),
        box([0.05, 0.06, 0.02], [-0.09, 0.24, 0.165], '#111827'),
        box([0.05, 0.06, 0.02], [0.09, 0.24, 0.165], '#111827'),
      ],
    },
    wingL: { pivot: [-0.21, 0.52, 0], parts: [box([0.06, 0.26, 0.34], [-0.02, -0.08, -0.02], '#e5e7eb')] },
    wingR: { pivot: [0.21, 0.52, 0], parts: [box([0.06, 0.26, 0.34], [0.02, -0.08, -0.02], '#e5e7eb')] },
    legL: { pivot: [-0.09, 0.23, 0], parts: leg() },
    legR: { pivot: [0.09, 0.23, 0], parts: leg() },
  };
}

/** Bones: seg0 (head) … seg3. Each segment can bob for a wriggle. */
export function larva(): Model {
  const greens = ['#84cc16', '#65a30d', '#84cc16', '#65a30d'];
  const sizes = [0.24, 0.22, 0.2, 0.16];
  const m: Model = {};
  let z = 0.3;
  sizes.forEach((s, i) => {
    const parts: Part[] = [box([s, s, s], [0, s / 2, 0], greens[i]), box([s + 0.01, 0.04, s * 0.5], [0, s * 0.9, 0], '#d9f99d')];
    if (i === 0)
      parts.push(
        box([0.05, 0.06, 0.02], [-0.06, s * 0.62, s / 2 + 0.005], '#111827'),
        box([0.05, 0.06, 0.02], [0.06, s * 0.62, s / 2 + 0.005], '#111827'),
        box([0.03, 0.12, 0.03], [-0.07, s + 0.05, 0.02], '#3f6212'),
        box([0.03, 0.12, 0.03], [0.07, s + 0.05, 0.02], '#3f6212'),
      );
    m[`seg${i}`] = { pivot: [0, 0, z], parts };
    z -= s * 0.95;
  });
  return m;
}

/* ---------- Birds ---------- */

export interface BirdLook {
  main: string;
  dark: string;
  crest: boolean;
}

/** Bones: body, wingL, wingR. About 0.9 long. Facing +z. */
export function bird(l: BirdLook): Model {
  const body: Part[] = [
    box([0.36, 0.34, 0.5], [0, 0.34, 0], l.main),
    box([0.3, 0.14, 0.34], [0, 0.22, 0.04], '#f5f0e6'),
    box([0.3, 0.3, 0.3], [0, 0.58, 0.2], l.main),
    box([0.1, 0.08, 0.16], [0, 0.56, 0.42], '#f59e0b'),
    // eyes sit on the sides of the head
    box([0.02, 0.08, 0.08], [-0.155, 0.63, 0.26], '#ffffff'),
    box([0.02, 0.08, 0.08], [0.155, 0.63, 0.26], '#ffffff'),
    box([0.025, 0.05, 0.04], [-0.158, 0.63, 0.27], '#0f172a'),
    box([0.025, 0.05, 0.04], [0.158, 0.63, 0.27], '#0f172a'),
    box([0.24, 0.06, 0.34], [0, 0.4, -0.38], l.dark),
    box([0.04, 0.17, 0.04], [-0.08, 0.085, 0.02], '#78350f'),
    box([0.04, 0.17, 0.04], [0.08, 0.085, 0.02], '#78350f'),
    box([0.08, 0.03, 0.12], [-0.08, 0.015, 0.05], '#78350f'),
    box([0.08, 0.03, 0.12], [0.08, 0.015, 0.05], '#78350f'),
  ];
  // A tall, dark crest that stays readable from the overhead camera.
  if (l.crest)
    body.push(
      box([0.12, 0.3, 0.1], [0, 0.86, 0.24], l.dark),
      box([0.12, 0.24, 0.1], [0, 0.83, 0.13], l.dark),
      box([0.12, 0.16, 0.1], [0, 0.79, 0.03], l.dark),
      box([0.1, 0.1, 0.08], [0, 1.03, 0.27], l.dark),
    );
  return {
    body: { pivot: [0, 0, 0], parts: body },
    wingL: { pivot: [-0.19, 0.44, 0], parts: [box([0.05, 0.24, 0.4], [-0.01, -0.06, -0.04], l.dark)] },
    wingR: { pivot: [0.19, 0.44, 0], parts: [box([0.05, 0.24, 0.4], [0.01, -0.06, -0.04], l.dark)] },
  };
}

/* ---------- Fish ---------- */

export type FishPattern = 'stripes' | 'spots' | 'plain';

/** A voxel fish about 1 unit long, facing +x. Bones: body, tail. */
export function fish(main: string, dark: string, pattern: FishPattern): Model {
  const v = 0.12; // voxel size
  // Side profile, front on the right. '#' = body, '.' = empty. Rows top → bottom.
  const profile = ['...##...', '.######.', '########', '########', '.######.', '...##...'];
  const rows = profile.length;
  const spots = new Set(['2,1', '4,3', '5,1', '3,4', '6,2']);
  const parts: Part[] = [];
  profile.forEach((row, r) =>
    [...row].forEach((ch, col) => {
      if (ch !== '#') return;
      const y = (rows - r) * v;
      const x = (col - 3.5) * v;
      let c = main;
      if (pattern === 'stripes' && (col === 2 || col === 4)) c = dark;
      if (pattern === 'spots' && spots.has(`${col},${r}`)) c = dark;
      // belly shading
      if (r === rows - 2 && c === main) c = mix(main, '#ffffff', 0.3);
      const depth = r === 0 || r === rows - 1 || col === 0 || col === 7 ? v * 2 : v * 3;
      parts.push(box([v, v, depth], [x, y, 0], c));
    }),
  );
  // dorsal fin, eyes
  parts.push(box([v * 3, v, v], [-0.0, (rows + 1) * v, 0], dark));
  parts.push(box([v * 0.9, v * 0.9, 0.02], [0.32, 4 * v, v * 1.5 + 0.01], '#ffffff'));
  parts.push(box([v * 0.9, v * 0.9, 0.02], [0.32, 4 * v, -v * 1.5 - 0.01], '#ffffff'));
  parts.push(box([v * 0.5, v * 0.5, 0.03], [0.34, 4 * v, v * 1.5 + 0.02], '#0f172a'));
  parts.push(box([v * 0.5, v * 0.5, 0.03], [0.34, 4 * v, -v * 1.5 - 0.02], '#0f172a'));
  const tail: Part[] = [
    box([v, v * 2, v], [-v / 2, 0, 0], dark),
    box([v, v * 4, v], [-v * 1.5, 0, 0], dark),
    box([v, v * 2, v], [-v * 2.5, v * 1.5, 0], dark),
    box([v, v * 2, v], [-v * 2.5, -v * 1.5, 0], dark),
  ];
  return {
    body: { pivot: [0, 0, 0], parts },
    tail: { pivot: [-4 * v, 3.5 * v, 0], parts: tail },
  };
}

/** Linear blend of two hex colours. */
export function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}
