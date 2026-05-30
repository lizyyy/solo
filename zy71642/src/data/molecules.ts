export type BondingType = 'bonding' | 'antibonding' | 'nonbonding'

export interface NodePlane {
  normal: [number, number, number]
  distance: number
  label: string
}

export interface OrbitalShape {
  type: 'sigma' | 'pi' | 'delta'
  lobes: {
    center: [number, number, number]
    scale: [number, number, number]
    rotation: [number, number, number]
    phase: 1 | -1
  }[]
}

export interface MolecularOrbital {
  id: string
  label: string
  energy: number
  symmetry: string
  bondingType: BondingType
  nodeCount: number
  nodePlanes: NodePlane[]
  shape: OrbitalShape
  phaseColors: [string, string]
  electronCount: number
}

export interface MoleculeData {
  id: string
  name: string
  formula: string
  atomPositions: [number, number, number][]
  atomLabels: string[]
  atomColors: string[]
  bonds: [number, number][]
  orbitals: MolecularOrbital[]
  energyOrder: string[]
  description: string
}

const PHASE_POS = '#00ffd5'
const PHASE_NEG = '#ff9f1c'

function makeOrbital(
  id: string,
  label: string,
  energy: number,
  symmetry: string,
  bondingType: BondingType,
  nodeCount: number,
  nodePlanes: NodePlane[],
  shape: OrbitalShape,
  electronCount: number
): MolecularOrbital {
  return {
    id,
    label,
    energy,
    symmetry,
    bondingType,
    nodeCount,
    nodePlanes,
    shape,
    phaseColors: [PHASE_POS, PHASE_NEG],
    electronCount,
  }
}

export const MOLECULES: MoleculeData[] = [
  {
    id: 'O2',
    name: '氧气',
    formula: 'O₂',
    atomPositions: [[-0.6, 0, 0], [0.6, 0, 0]],
    atomLabels: ['O', 'O'],
    atomColors: ['#ef4444', '#ef4444'],
    bonds: [[0, 1]],
    description: '氧气分子，具有顺磁性，双键结构',
    orbitals: [
      makeOrbital(
        'O2_sigma2s',
        'σ(2s)',
        -32.4,
        'σg',
        'bonding',
        0,
        [],
        {
          type: 'sigma',
          lobes: [
            { center: [0, 0, 0], scale: [1.8, 1.0, 1.0], rotation: [0, 0, 0], phase: 1 },
          ],
        },
        2
      ),
      makeOrbital(
        'O2_sigma2s_star',
        'σ*(2s)',
        -28.1,
        'σu',
        'antibonding',
        1,
        [{ normal: [1, 0, 0], distance: 0, label: 'xz节点面' }],
        {
          type: 'sigma',
          lobes: [
            { center: [-0.7, 0, 0], scale: [0.8, 0.8, 0.8], rotation: [0, 0, 0], phase: 1 },
            { center: [0.7, 0, 0], scale: [0.8, 0.8, 0.8], rotation: [0, 0, 0], phase: -1 },
          ],
        },
        2
      ),
      makeOrbital(
        'O2_sigma2pz',
        'σ(2pz)',
        -17.2,
        'σg',
        'bonding',
        0,
        [],
        {
          type: 'sigma',
          lobes: [
            { center: [0, 0, 0], scale: [2.0, 1.2, 1.2], rotation: [0, 0, 0], phase: 1 },
          ],
        },
        2
      ),
      makeOrbital(
        'O2_pi2px',
        'π(2px)',
        -16.5,
        'πu',
        'bonding',
        0,
        [],
        {
          type: 'pi',
          lobes: [
            { center: [0, 0.7, 0], scale: [1.4, 0.6, 0.6], rotation: [0, 0, Math.PI / 2], phase: 1 },
            { center: [0, -0.7, 0], scale: [1.4, 0.6, 0.6], rotation: [0, 0, -Math.PI / 2], phase: -1 },
          ],
        },
        2
      ),
      makeOrbital(
        'O2_pi2py',
        'π(2py)',
        -16.5,
        'πu',
        'bonding',
        0,
        [],
        {
          type: 'pi',
          lobes: [
            { center: [0, 0, 0.7], scale: [1.4, 0.6, 0.6], rotation: [0, Math.PI / 2, 0], phase: 1 },
            { center: [0, 0, -0.7], scale: [1.4, 0.6, 0.6], rotation: [0, -Math.PI / 2, 0], phase: -1 },
          ],
        },
        2
      ),
      makeOrbital(
        'O2_pi2px_star',
        'π*(2px)',
        -12.8,
        'πg',
        'antibonding',
        1,
        [{ normal: [1, 0, 0], distance: 0, label: 'yz节点面' }],
        {
          type: 'pi',
          lobes: [
            { center: [-0.5, 0.6, 0], scale: [0.6, 0.5, 0.5], rotation: [0, 0, Math.PI / 2], phase: 1 },
            { center: [0.5, 0.6, 0], scale: [0.6, 0.5, 0.5], rotation: [0, 0, Math.PI / 2], phase: -1 },
            { center: [-0.5, -0.6, 0], scale: [0.6, 0.5, 0.5], rotation: [0, 0, -Math.PI / 2], phase: -1 },
            { center: [0.5, -0.6, 0], scale: [0.6, 0.5, 0.5], rotation: [0, 0, -Math.PI / 2], phase: 1 },
          ],
        },
        1
      ),
      makeOrbital(
        'O2_pi2py_star',
        'π*(2py)',
        -12.8,
        'πg',
        'antibonding',
        1,
        [{ normal: [1, 0, 0], distance: 0, label: 'xz节点面' }],
        {
          type: 'pi',
          lobes: [
            { center: [-0.5, 0, 0.6], scale: [0.6, 0.5, 0.5], rotation: [0, Math.PI / 2, 0], phase: 1 },
            { center: [0.5, 0, 0.6], scale: [0.6, 0.5, 0.5], rotation: [0, Math.PI / 2, 0], phase: -1 },
            { center: [-0.5, 0, -0.6], scale: [0.6, 0.5, 0.5], rotation: [0, -Math.PI / 2, 0], phase: -1 },
            { center: [0.5, 0, -0.6], scale: [0.6, 0.5, 0.5], rotation: [0, -Math.PI / 2, 0], phase: 1 },
          ],
        },
        1
      ),
      makeOrbital(
        'O2_sigma2pz_star',
        'σ*(2pz)',
        -8.5,
        'σu',
        'antibonding',
        1,
        [{ normal: [1, 0, 0], distance: 0, label: 'yz节点面' }],
        {
          type: 'sigma',
          lobes: [
            { center: [-0.9, 0, 0], scale: [0.9, 0.9, 0.9], rotation: [0, 0, 0], phase: 1 },
            { center: [0.9, 0, 0], scale: [0.9, 0.9, 0.9], rotation: [0, 0, 0], phase: -1 },
          ],
        },
        0
      ),
    ],
    energyOrder: [
      'O2_sigma2s',
      'O2_sigma2s_star',
      'O2_sigma2pz',
      'O2_pi2px',
      'O2_pi2py',
      'O2_pi2px_star',
      'O2_pi2py_star',
      'O2_sigma2pz_star',
    ],
  },
  {
    id: 'N2',
    name: '氮气',
    formula: 'N₂',
    atomPositions: [[-0.55, 0, 0], [0.55, 0, 0]],
    atomLabels: ['N', 'N'],
    atomColors: ['#3b82f6', '#3b82f6'],
    bonds: [[0, 1]],
    description: '氮气分子，三键结构，非常稳定',
    orbitals: [
      makeOrbital(
        'N2_sigma2s',
        'σ(2s)',
        -36.2,
        'σg',
        'bonding',
        0,
        [],
        {
          type: 'sigma',
          lobes: [
            { center: [0, 0, 0], scale: [1.7, 0.9, 0.9], rotation: [0, 0, 0], phase: 1 },
          ],
        },
        2
      ),
      makeOrbital(
        'N2_sigma2s_star',
        'σ*(2s)',
        -31.8,
        'σu',
        'antibonding',
        1,
        [{ normal: [1, 0, 0], distance: 0, label: 'yz节点面' }],
        {
          type: 'sigma',
          lobes: [
            { center: [-0.65, 0, 0], scale: [0.7, 0.7, 0.7], rotation: [0, 0, 0], phase: 1 },
            { center: [0.65, 0, 0], scale: [0.7, 0.7, 0.7], rotation: [0, 0, 0], phase: -1 },
          ],
        },
        2
      ),
      makeOrbital(
        'N2_pi2px',
        'π(2px)',
        -17.8,
        'πu',
        'bonding',
        0,
        [],
        {
          type: 'pi',
          lobes: [
            { center: [0, 0.65, 0], scale: [1.3, 0.55, 0.55], rotation: [0, 0, Math.PI / 2], phase: 1 },
            { center: [0, -0.65, 0], scale: [1.3, 0.55, 0.55], rotation: [0, 0, -Math.PI / 2], phase: -1 },
          ],
        },
        2
      ),
      makeOrbital(
        'N2_pi2py',
        'π(2py)',
        -17.8,
        'πu',
        'bonding',
        0,
        [],
        {
          type: 'pi',
          lobes: [
            { center: [0, 0, 0.65], scale: [1.3, 0.55, 0.55], rotation: [0, Math.PI / 2, 0], phase: 1 },
            { center: [0, 0, -0.65], scale: [1.3, 0.55, 0.55], rotation: [0, -Math.PI / 2, 0], phase: -1 },
          ],
        },
        2
      ),
      makeOrbital(
        'N2_sigma2pz',
        'σ(2pz)',
        -16.0,
        'σg',
        'bonding',
        0,
        [],
        {
          type: 'sigma',
          lobes: [
            { center: [0, 0, 0], scale: [1.9, 1.1, 1.1], rotation: [0, 0, 0], phase: 1 },
          ],
        },
        2
      ),
      makeOrbital(
        'N2_pi2px_star',
        'π*(2px)',
        -8.2,
        'πg',
        'antibonding',
        1,
        [{ normal: [1, 0, 0], distance: 0, label: 'yz节点面' }],
        {
          type: 'pi',
          lobes: [
            { center: [-0.5, 0.55, 0], scale: [0.55, 0.45, 0.45], rotation: [0, 0, Math.PI / 2], phase: 1 },
            { center: [0.5, 0.55, 0], scale: [0.55, 0.45, 0.45], rotation: [0, 0, Math.PI / 2], phase: -1 },
            { center: [-0.5, -0.55, 0], scale: [0.55, 0.45, 0.45], rotation: [0, 0, -Math.PI / 2], phase: -1 },
            { center: [0.5, -0.55, 0], scale: [0.55, 0.45, 0.45], rotation: [0, 0, -Math.PI / 2], phase: 1 },
          ],
        },
        0
      ),
      makeOrbital(
        'N2_pi2py_star',
        'π*(2py)',
        -8.2,
        'πg',
        'antibonding',
        1,
        [{ normal: [1, 0, 0], distance: 0, label: 'xz节点面' }],
        {
          type: 'pi',
          lobes: [
            { center: [-0.5, 0, 0.55], scale: [0.55, 0.45, 0.45], rotation: [0, Math.PI / 2, 0], phase: 1 },
            { center: [0.5, 0, 0.55], scale: [0.55, 0.45, 0.45], rotation: [0, Math.PI / 2, 0], phase: -1 },
            { center: [-0.5, 0, -0.55], scale: [0.55, 0.45, 0.45], rotation: [0, -Math.PI / 2, 0], phase: -1 },
            { center: [0.5, 0, -0.55], scale: [0.55, 0.45, 0.45], rotation: [0, -Math.PI / 2, 0], phase: 1 },
          ],
        },
        0
      ),
      makeOrbital(
        'N2_sigma2pz_star',
        'σ*(2pz)',
        -4.5,
        'σu',
        'antibonding',
        1,
        [{ normal: [1, 0, 0], distance: 0, label: 'yz节点面' }],
        {
          type: 'sigma',
          lobes: [
            { center: [-0.85, 0, 0], scale: [0.8, 0.8, 0.8], rotation: [0, 0, 0], phase: 1 },
            { center: [0.85, 0, 0], scale: [0.8, 0.8, 0.8], rotation: [0, 0, 0], phase: -1 },
          ],
        },
        0
      ),
    ],
    energyOrder: [
      'N2_sigma2s',
      'N2_sigma2s_star',
      'N2_pi2px',
      'N2_pi2py',
      'N2_sigma2pz',
      'N2_pi2px_star',
      'N2_pi2py_star',
      'N2_sigma2pz_star',
    ],
  },
  {
    id: 'CO',
    name: '一氧化碳',
    formula: 'CO',
    atomPositions: [[-0.55, 0, 0], [0.6, 0, 0]],
    atomLabels: ['C', 'O'],
    atomColors: ['#6b7280', '#ef4444'],
    bonds: [[0, 1]],
    description: '一氧化碳分子，异核双原子，三键结构',
    orbitals: [
      makeOrbital(
        'CO_3sigma',
        '3σ',
        -36.8,
        'σ',
        'bonding',
        0,
        [],
        {
          type: 'sigma',
          lobes: [
            { center: [-0.2, 0, 0], scale: [1.6, 0.9, 0.9], rotation: [0, 0, 0], phase: 1 },
          ],
        },
        2
      ),
      makeOrbital(
        'CO_4sigma',
        '4σ',
        -18.5,
        'σ',
        'bonding',
        0,
        [],
        {
          type: 'sigma',
          lobes: [
            { center: [0.1, 0, 0], scale: [1.8, 1.0, 1.0], rotation: [0, 0, 0], phase: 1 },
          ],
        },
        2
      ),
      makeOrbital(
        'CO_1pi_x',
        '1π(x)',
        -16.2,
        'π',
        'bonding',
        0,
        [],
        {
          type: 'pi',
          lobes: [
            { center: [0, 0.65, 0], scale: [1.3, 0.55, 0.55], rotation: [0, 0, Math.PI / 2], phase: 1 },
            { center: [0, -0.65, 0], scale: [1.3, 0.55, 0.55], rotation: [0, 0, -Math.PI / 2], phase: -1 },
          ],
        },
        2
      ),
      makeOrbital(
        'CO_1pi_y',
        '1π(y)',
        -16.2,
        'π',
        'bonding',
        0,
        [],
        {
          type: 'pi',
          lobes: [
            { center: [0, 0, 0.65], scale: [1.3, 0.55, 0.55], rotation: [0, Math.PI / 2, 0], phase: 1 },
            { center: [0, 0, -0.65], scale: [1.3, 0.55, 0.55], rotation: [0, -Math.PI / 2, 0], phase: -1 },
          ],
        },
        2
      ),
      makeOrbital(
        'CO_5sigma',
        '5σ',
        -14.0,
        'σ',
        'nonbonding',
        0,
        [],
        {
          type: 'sigma',
          lobes: [
            { center: [-0.9, 0, 0], scale: [0.8, 0.7, 0.7], rotation: [0, 0, 0], phase: 1 },
          ],
        },
        2
      ),
      makeOrbital(
        'CO_2pi_x',
        '2π*(x)',
        -6.5,
        'π',
        'antibonding',
        1,
        [{ normal: [1, 0, 0], distance: 0, label: 'yz节点面' }],
        {
          type: 'pi',
          lobes: [
            { center: [-0.4, 0.55, 0], scale: [0.55, 0.4, 0.4], rotation: [0, 0, Math.PI / 2], phase: 1 },
            { center: [0.4, 0.55, 0], scale: [0.55, 0.4, 0.4], rotation: [0, 0, Math.PI / 2], phase: -1 },
            { center: [-0.4, -0.55, 0], scale: [0.55, 0.4, 0.4], rotation: [0, 0, -Math.PI / 2], phase: -1 },
            { center: [0.4, -0.55, 0], scale: [0.55, 0.4, 0.4], rotation: [0, 0, -Math.PI / 2], phase: 1 },
          ],
        },
        0
      ),
      makeOrbital(
        'CO_2pi_y',
        '2π*(y)',
        -6.5,
        'π',
        'antibonding',
        1,
        [{ normal: [1, 0, 0], distance: 0, label: 'xz节点面' }],
        {
          type: 'pi',
          lobes: [
            { center: [-0.4, 0, 0.55], scale: [0.55, 0.4, 0.4], rotation: [0, Math.PI / 2, 0], phase: 1 },
            { center: [0.4, 0, 0.55], scale: [0.55, 0.4, 0.4], rotation: [0, Math.PI / 2, 0], phase: -1 },
            { center: [-0.4, 0, -0.55], scale: [0.55, 0.4, 0.4], rotation: [0, -Math.PI / 2, 0], phase: -1 },
            { center: [0.4, 0, -0.55], scale: [0.55, 0.4, 0.4], rotation: [0, -Math.PI / 2, 0], phase: 1 },
          ],
        },
        0
      ),
      makeOrbital(
        'CO_6sigma',
        '6σ*',
        -3.2,
        'σ',
        'antibonding',
        1,
        [{ normal: [1, 0, 0], distance: 0, label: 'yz节点面' }],
        {
          type: 'sigma',
          lobes: [
            { center: [-0.85, 0, 0], scale: [0.8, 0.75, 0.75], rotation: [0, 0, 0], phase: 1 },
            { center: [0.9, 0, 0], scale: [0.8, 0.75, 0.75], rotation: [0, 0, 0], phase: -1 },
          ],
        },
        0
      ),
    ],
    energyOrder: [
      'CO_3sigma',
      'CO_4sigma',
      'CO_1pi_x',
      'CO_1pi_y',
      'CO_5sigma',
      'CO_2pi_x',
      'CO_2pi_y',
      'CO_6sigma',
    ],
  },
]

export function getMolecule(id: string): MoleculeData | undefined {
  return MOLECULES.find((m) => m.id === id)
}

export function getOrbital(moleculeId: string, orbitalId: string): MolecularOrbital | undefined {
  return getMolecule(moleculeId)?.orbitals.find((o) => o.id === orbitalId)
}
