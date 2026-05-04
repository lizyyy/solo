const ATOMIC_WEIGHTS = {
  'H': 1.00794,
  'Li': 6.941,
  'Be': 9.012182,
  'B': 10.811,
  'C': 12.011,
  'N': 14.0067,
  'O': 15.9994,
  'F': 18.9984032,
  'Na': 22.98976928,
  'Mg': 24.3050,
  'Al': 26.9815386,
  'Si': 28.0855,
  'P': 30.973762,
  'S': 32.065,
  'Cl': 35.453,
  'K': 39.0983,
  'Ca': 40.078,
  'Sc': 44.955912,
  'Ti': 47.867,
  'V': 50.9415,
  'Cr': 51.9961,
  'Mn': 54.938045,
  'Fe': 55.845,
  'Co': 58.933195,
  'Ni': 58.6934,
  'Cu': 63.546,
  'Zn': 65.38,
  'Ga': 69.723,
  'Ge': 72.64,
  'As': 74.92160,
  'Se': 78.96,
  'Br': 79.904,
  'Rb': 85.4678,
  'Sr': 87.62,
  'Y': 88.90585,
  'Zr': 91.224,
  'Nb': 92.90638,
  'Mo': 95.96,
  'Ru': 101.07,
  'Rh': 102.90550,
  'Pd': 106.42,
  'Ag': 107.8682,
  'Cd': 112.411,
  'In': 114.818,
  'Sn': 118.710,
  'Sb': 121.760,
  'Te': 127.60,
  'I': 126.90447,
  'Cs': 132.9054519,
  'Ba': 137.327,
  'La': 138.90547,
  'Ce': 140.116,
  'Pr': 140.90765,
  'Nd': 144.242,
  'Sm': 150.36,
  'Eu': 151.964,
  'Gd': 157.25,
  'Tb': 158.92535,
  'Dy': 162.500,
  'Ho': 164.93032,
  'Er': 167.259,
  'Tm': 168.93421,
  'Yb': 173.054,
  'Lu': 174.9668,
  'Hf': 178.49,
  'Ta': 180.94788,
  'W': 183.84,
  'Re': 186.207,
  'Os': 190.23,
  'Ir': 192.217,
  'Pt': 195.084,
  'Au': 196.966569,
  'Hg': 200.59,
  'Tl': 204.3833,
  'Pb': 207.2,
  'Bi': 208.98040,
  'Th': 232.03806,
  'Pa': 231.03588,
  'U': 238.02891
};

const OXIDE_FORMULAS = {
  'B2O3': { atoms: { B: 2, O: 3 } },
  'Na2O': { atoms: { Na: 2, O: 1 } },
  'K2O': { atoms: { K: 2, O: 1 } },
  'Li2O': { atoms: { Li: 2, O: 1 } },
  'CaO': { atoms: { Ca: 1, O: 1 } },
  'MgO': { atoms: { Mg: 1, O: 1 } },
  'SrO': { atoms: { Sr: 1, O: 1 } },
  'BaO': { atoms: { Ba: 1, O: 1 } },
  'ZnO': { atoms: { Zn: 1, O: 1 } },
  'PbO': { atoms: { Pb: 1, O: 1 } },
  'Al2O3': { atoms: { Al: 2, O: 3 } },
  'SiO2': { atoms: { Si: 1, O: 2 } },
  'TiO2': { atoms: { Ti: 1, O: 2 } },
  'ZrO2': { atoms: { Zr: 1, O: 2 } },
  'Fe2O3': { atoms: { Fe: 2, O: 3 } },
  'FeO': { atoms: { Fe: 1, O: 1 } },
  'MnO': { atoms: { Mn: 1, O: 1 } },
  'MnO2': { atoms: { Mn: 1, O: 2 } },
  'CuO': { atoms: { Cu: 1, O: 1 } },
  'CoO': { atoms: { Co: 1, O: 1 } },
  'NiO': { atoms: { Ni: 1, O: 1 } },
  'SnO': { atoms: { Sn: 1, O: 1 } },
  'SnO2': { atoms: { Sn: 1, O: 2 } },
  'P2O5': { atoms: { P: 2, O: 5 } },
  'SO3': { atoms: { S: 1, O: 3 } },
  'V2O5': { atoms: { V: 2, O: 5 } },
  'Cr2O3': { atoms: { Cr: 2, O: 3 } },
  'Sb2O3': { atoms: { Sb: 2, O: 3 } },
  'Bi2O3': { atoms: { Bi: 2, O: 3 } },
  'As2O3': { atoms: { As: 2, O: 3 } },
  'La2O3': { atoms: { La: 2, O: 3 } },
  'CeO2': { atoms: { Ce: 1, O: 2 } },
  'Nd2O3': { atoms: { Nd: 2, O: 3 } },
  'Pr6O11': { atoms: { Pr: 6, O: 11 } },
  'H2O': { atoms: { H: 2, O: 1 } },
  'CO2': { atoms: { C: 1, O: 2 } }
};

function calculateMolarMass(oxide) {
  const formula = OXIDE_FORMULAS[oxide];
  if (!formula) return null;
  
  let mass = 0;
  for (const [element, count] of Object.entries(formula.atoms)) {
    const atomicWeight = ATOMIC_WEIGHTS[element];
    if (!atomicWeight) return null;
    mass += atomicWeight * count;
  }
  return mass;
}

function calculateOxideMolars(recipe, materials) {
  const oxideMolars = {};
  const materialMap = {};
  
  for (const material of materials) {
    materialMap[material.name] = JSON.parse(material.oxides || '{}');
  }

  for (const item of recipe) {
    const materialName = item.material;
    const weight = item.weight;
    const oxides = materialMap[materialName] || {};

    for (const [oxide, percentage] of Object.entries(oxides)) {
      const oxideWeight = weight * (percentage / 100);
      const molarMass = calculateMolarMass(oxide);
      
      if (molarMass) {
        const moles = oxideWeight / molarMass;
        if (!oxideMolars[oxide]) {
          oxideMolars[oxide] = 0;
        }
        oxideMolars[oxide] += moles;
      }
    }
  }

  return oxideMolars;
}

function normalizeToUnity(oxideMolars) {
  const fluxOxides = ['Na2O', 'K2O', 'Li2O', 'CaO', 'MgO', 'SrO', 'BaO', 'ZnO', 'PbO', 'MnO', 'FeO', 'CuO', 'CoO', 'NiO', 'SnO'];
  const amphotericOxides = ['Al2O3', 'Fe2O3', 'B2O3', 'Cr2O3', 'Sb2O3', 'Bi2O3', 'As2O3', 'La2O3', 'Nd2O3'];
  const acidicOxides = ['SiO2', 'TiO2', 'ZrO2', 'SnO2', 'P2O5', 'SO3', 'V2O5', 'MnO2', 'CeO2', 'Pr6O11'];

  let totalFluxMoles = 0;
  for (const oxide of fluxOxides) {
    if (oxideMolars[oxide]) {
      totalFluxMoles += oxideMolars[oxide];
    }
  }

  if (totalFluxMoles === 0) {
    return oxideMolars;
  }

  const normalized = {};
  for (const [oxide, moles] of Object.entries(oxideMolars)) {
    normalized[oxide] = moles / totalFluxMoles;
  }

  return normalized;
}

function calculateRatios(oxideMolars) {
  const normalized = normalizeToUnity(oxideMolars);
  
  const B2O3 = normalized['B2O3'] || 0;
  const Na2O = normalized['Na2O'] || 0;
  const K2O = normalized['K2O'] || 0;
  const Al2O3 = normalized['Al2O3'] || 0;
  const SiO2 = normalized['SiO2'] || 0;
  
  const totalFlux = (normalized['Na2O'] || 0) + (normalized['K2O'] || 0) + 
                    (normalized['Li2O'] || 0) + (normalized['CaO'] || 0) + 
                    (normalized['MgO'] || 0) + (normalized['SrO'] || 0) + 
                    (normalized['BaO'] || 0) + (normalized['ZnO'] || 0);

  return {
    boronRatio: totalFlux > 0 ? B2O3 / totalFlux : 0,
    alkaliRatio: totalFlux > 0 ? (Na2O + K2O) / totalFlux : 0,
    aluminaSilicaRatio: Al2O3 > 0 ? SiO2 / Al2O3 : Infinity,
    silicaAluminaRatio: Al2O3 > 0 ? SiO2 / Al2O3 : Infinity
  };
}

module.exports = {
  calculateOxideMolars,
  normalizeToUnity,
  calculateRatios,
  calculateMolarMass
};
