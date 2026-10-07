import seedrandom from "seedrandom";

const ne = ["port", "workers", "debug", "log_level", "api_key"];
const ce = ["debug", "info", "warning", "error"];
const ot = "abcdefghijklmnopqrstuvwxyz0123456789";

const P4 = (rng, len) =>
  Array.from({ length: len }, () => ot[Math.floor(rng() * ot.length)]).join("");

export function rt(key, val) {
  if (key === "port" || key === "workers") return parseInt(val, 10);
  if (key === "debug") return /^(1|true|yes|on)$/i.test(String(val));
  return String(val);
}

export function computeBaseEffective(email, version = "") {
  const normEmail = (email || "").trim().toLowerCase();
  const rng = seedrandom(`q-config-precedence-server#${normEmail}#${version}`);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));

  // Layer 1: Hardcoded Defaults
  const defaults = {
    port: 8000,
    workers: 1,
    debug: false,
    log_level: "info",
    api_key: "default-secret-000",
  };

  const genLayer = () => {
    const layer = {};
    for (const key of ne) {
      if (rng() < 0.5) {
        if (key === "port") layer[key] = randInt(8000, 9000);
        else if (key === "workers") layer[key] = randInt(1, 16);
        else if (key === "debug") layer[key] = rng() < 0.5;
        else if (key === "log_level") layer[key] = pick(ce);
        else layer[key] = `key-${P4(rng, 10)}`;
      }
    }
    return layer;
  };

  // Layer 2: YAML, Layer 3: .env, Layer 4: OS Environment
  const fileYaml = genLayer();
  const dotenv = genLayer();
  const osenv = genLayer();

  const normalizeAliases = (obj) =>
    Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k === "num_workers" ? "workers" : k, v])
    );

  const merged = {
    ...defaults,
    ...normalizeAliases(fileYaml),
    ...normalizeAliases(dotenv),
    ...normalizeAliases(osenv),
  };

  const baseEffective = {};
  for (const key of ne) {
    baseEffective[key] = rt(key, merged[key]);
  }

  return {
    baseEffective,
    fileYaml,
    dotenv,
    osenv,
  };
}

export function resolveEffectiveConfig(email, cliOverrides = {}, version = "") {
  const { baseEffective } = computeBaseEffective(email, version);
  const result = { ...baseEffective };

  const overridesObj = Array.isArray(cliOverrides)
    ? Object.fromEntries(
        cliOverrides.map((item) => {
          const eqIdx = String(item).indexOf("=");
          if (eqIdx !== -1) {
            return [decodeURIComponent(item.slice(0, eqIdx)), decodeURIComponent(item.slice(eqIdx + 1))];
          }
          return [String(item), ""];
        })
      )
    : cliOverrides || {};

  for (const [key, val] of Object.entries(overridesObj)) {
    if (ne.includes(key)) {
      result[key] = rt(key, val);
    }
  }

  // Mask api_key per specification
  result.api_key = "****";
  return result;
}
