import { easyChatWords, fireRedData, leafGreenData } from './data';

const paramsForm = document.getElementById('params') as HTMLFormElement;

const COMPATIBLE_SUBSTRUCTURE_ORDERS = new Set([6, 7, 8, 12, 13, 18, 19, 22]);

interface Advance {
  advance: number;
  pid: number;
}

class PokeRNG {
  state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(advances: number = 1) {
    for (let i = 0; i < advances; i++) {
      this.state = ((Math.imul(0x41c64e6d, this.state) >>> 0) + 0x6073) >>> 0;
    }
    return this.state;
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

function hasSpeciesWords(
  pid: number,
  tid: number,
  glitchmonList: number[],
) {
  const encryptionKey = ((pid >>> 0) ^ (tid >>> 0)) & 0xffff;
  for (const glitchMonIndex of glitchmonList) {
    const encryptedValue = glitchMonIndex ^ encryptionKey;
    if (easyChatWords.has(encryptedValue)) {
      // No need to check all of them as the species words
      // are not visible in this tool.
      return true;
    }
  }
  return false;
}

function searchPIDRNG(
  tid: number,
  initialAdvances: number,
  rng: Generator<number, void, unknown>,
  glitchmonList: number[],
) {
  const usableAdvances: Advance[] = [];
  let advanceCount: number = initialAdvances - 1;
  for (const pid of rng) {
    advanceCount++;
    if (!COMPATIBLE_SUBSTRUCTURE_ORDERS.has((pid >>> 0) % 24)) {
      continue
    }
    if (hasSpeciesWords(pid, tid, glitchmonList)) {
      usableAdvances.push({
        advance: advanceCount,
        pid: pid,
      });
    }
  }
  return usableAdvances;
}

paramsForm.onsubmit = () => false;
paramsForm.addEventListener('submit', function (e) {
  e.preventDefault();
  const params = new FormData(this);
  let glitchmonList: number[];
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
