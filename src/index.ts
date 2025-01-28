import { easyChatData, fireRedData, leafGreenData } from './data';

const paramsForm = document.getElementById('params') as HTMLFormElement;

const EV_ADJUST_SSTRUCTS = new Set([8, 22]);
const EXP_ADJUST_SSTRUCTS = new Set([6, 7, 12, 13, 18, 19]);

interface Advance {
  advance: number;
  pid: number;
}

enum AdjustmentType {
  EV,
  EXP,
}

class PokeRNG {
  state: bigint;
  constructor(seed: number) {
    this.state = BigInt(seed);
  }

  next(advances: number = 1) {
    for (let i = 0; i < advances; i++) {
      this.state = (0x41c64e6dn * this.state + 0x00006073n) & 0xffffffffn;
    }
    return Number(this.state) >>> 0;
  }

  next16(advances: number = 1) {
    return (this.next(advances) >>> 16) & 0xffff;
  }
}

function* staticPIDRNG(
  seed: number,
  initialAdvances: number,
  advances: number,
  delay: number,
) {
  const mainRNG = new PokeRNG(seed);
  const advanceRNG = new PokeRNG(0);
  mainRNG.next(initialAdvances + delay);
  for (let i = 0; i < advances; i++) {
    advanceRNG.state = mainRNG.state;
    const pid = advanceRNG.next16() | ((advanceRNG.next16() << 16) >>> 0);
    yield pid >>> 0;
    mainRNG.next();
  }
}

function* wildPIDRNG(
  seed: number,
  initialAdvances: number,
  advances: number,
  delay: number,
) {
  const mainRNG = new PokeRNG(seed);
  const advanceRNG = new PokeRNG(0);
  mainRNG.next(initialAdvances + delay);
  for (let i = 0; i < advances; i++) {
    advanceRNG.state = mainRNG.state;
    advanceRNG.next(2);
    const pidNature = advanceRNG.next16() % 25;
    let pid: number;
    do {
      pid = advanceRNG.next16() | ((advanceRNG.next16() << 16) >>> 0);
    } while ((pid >>> 0) % 25 != pidNature);
    yield pid >>> 0;
    mainRNG.next();
  }
}

function getPIDSStruct(pid: number) {
  return (pid >>> 0) % 24;
}

function getAdjustmentType(pid: number) {
  const pidSStruct = getPIDSStruct(pid);
  if (EV_ADJUST_SSTRUCTS.has(pidSStruct)) {
    return AdjustmentType.EV;
  }
  if (EXP_ADJUST_SSTRUCTS.has(pidSStruct)) {
    return AdjustmentType.EXP;
  }
  return null;
}

function findSpeciesWords(
  pid: number,
  tid: number,
  glitchmonList: Map<number, number>,
) {
  const words: [number, number][] = [];
  const encryptionKey = ((pid >>> 0) ^ (tid >>> 0)) & 0xffff;
  for (const glitchMonIndex of glitchmonList.keys()) {
    const encryptedValue = glitchMonIndex ^ encryptionKey;
    if (easyChatData.has(encryptedValue)) {
      words.push([glitchMonIndex, encryptedValue]);
    }
  }
  return words;
}

function searchPIDRNG(
  tid: number,
  initialAdvances: number,
  rng: Generator<number, void, unknown>,
  glitchmonList: Map<number, number>,
) {
  const usableAdvances: Advance[] = [];
  let advanceCount: number = initialAdvances;
  for (const pid of rng) {
    if (
      getAdjustmentType(pid >>> 0) !== null &&
      findSpeciesWords(pid, tid, glitchmonList).length > 0
    ) {
      usableAdvances.push({
        advance: advanceCount,
        pid: pid,
      });
    }
    advanceCount++;
  }
  return usableAdvances;
}

paramsForm.onsubmit = () => false;
paramsForm.addEventListener('submit', function (e) {
  e.preventDefault();
  const params = new FormData(this);
  let glitchmonList: Map<number, number>;
  let rng: Generator<number, void, unknown>;
  switch (params.get('encounter-type') as string) {
    case 'static':
      rng = staticPIDRNG(
        parseInt(params.get('seed') as string, 16),
        Number(params.get('initial-advances')),
        Number(params.get('advances')),
        Number(params.get('delay')),
      );
      break;
    case 'wild':
      rng = wildPIDRNG(
        parseInt(params.get('seed') as string, 16),
        Number(params.get('initial-advances')),
        Number(params.get('advances')),
        Number(params.get('delay')),
      );
      break;
    default:
      throw new Error('Expected a value');
  }
  switch (params.get('game') as string) {
    case 'firered':
      glitchmonList = fireRedData;
      break;
    case 'leafgreen':
      glitchmonList = leafGreenData;
      break;
    default:
      throw new Error('Expected a value');
  }
  const results = searchPIDRNG(
    Number(params.get('tid')),
    Number(params.get('initial-advances')),
    rng,
    glitchmonList,
  );
  const resultsTable = document.getElementById(
    'results-body',
  ) as HTMLTableElement;
  while (resultsTable.firstElementChild) {
    resultsTable.removeChild(resultsTable.lastElementChild as Node);
  }
  for (const result of results) {
    const resultRow = document.createElement('tr');
    const advanceCell = document.createElement('td');
    const pidCell = document.createElement('td');
    advanceCell.innerText = String(result.advance);
    pidCell.innerText = result.pid.toString(16).padStart(8, '0').toUpperCase();
    resultRow.appendChild(advanceCell);
    resultRow.appendChild(pidCell);
    resultsTable.appendChild(resultRow);
  }
});

window.onload = () => {
  const currentYear = new Date().getFullYear();
  (document.getElementById('copyright-year') as HTMLSpanElement).innerText =
    String(currentYear);
};
