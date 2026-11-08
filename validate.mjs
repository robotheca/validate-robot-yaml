// Checks a robotheca.yaml (or robot.yaml, its old name) against Robotheca's
// schemas, copied next to this file: robotheca.schema.json (version 1.0)
// and robot.schema.json (version 0.1), the one the file's format_version
// names. Same checker as robotheca.org (Ajv, JSON Schema 2020-12). As a
// GitHub Action (action.yml) it writes each problem as an annotation on
// the file's line; as a module it exports checkRobotYaml for tests.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { isMap, LineCounter, parseDocument } from "yaml";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => JSON.parse(readFileSync(path.join(here, file), "utf8"));
const schemas = {
  0.1: read("robot.schema.json"),
  "1.0": read("robotheca.schema.json"),
};

/** The file names looked for, the new one first. */
export const FILE_NAMES = ["robotheca.yaml", "robot.yaml"];

const compiled = {};
function validator(version) {
  if (!compiled[version]) {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: true,
      allowUnionTypes: true,
    });
    addFormats(ajv, ["uri", "date"]);
    compiled[version] = ajv.compile(schemas[version]);
  }
  return compiled[version];
}

/** The version a file is checked against: "0.1" when it says so, else 1.0. */
export function versionOf(data) {
  return data?.format_version === "0.1" ? "0.1" : "1.0";
}

/** "/license/hardware" -> ["license", "hardware"] (JSON Pointer). */
function segments(pointer) {
  return pointer
    .split("/")
    .slice(1)
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

/** The key node of the field at `at` ("license:"), if there is one. */
function keyNode(doc, at) {
  if (at.length === 0) return undefined;
  const parent =
    at.length > 1 ? doc.getIn(at.slice(0, -1), true) : doc.contents;
  if (!isMap(parent)) return undefined;
  return parent.items.find((pair) => pair.key?.value === at.at(-1))?.key;
}

/**
 * The problems of a robot.yaml's text, each with its line (1-based) when it
 * can be found: [] when it is valid.
 * @param {string} text
 * @returns {{ line: number; message: string }[]}
 */
export function checkRobotYaml(text) {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, prettyErrors: true });
  if (doc.errors.length > 0) {
    return doc.errors.map((e) => ({
      line: e.linePos?.[0]?.line ?? 1,
      message: `Not valid YAML: ${e.message.split("\n")[0]}`,
    }));
  }
  const data = doc.toJS();
  const version = versionOf(data);
  const validate = validator(version);
  const problems = validate(data) ? [] : (validate.errors ?? []);
  // A rule a schema cannot say (1.0): a range's high end is not below its
  // low end.
  const cost = data?.estimated_cost;
  const range =
    version === "1.0" &&
    typeof cost?.amount === "number" &&
    typeof cost?.amount_max === "number" &&
    cost.amount_max < cost.amount
      ? [
          {
            line: lineCounter.linePos(
              doc.getIn(["estimated_cost", "amount_max"], true)?.range?.[0] ??
                0,
            ).line,
            message:
              "/estimated_cost/amount_max: must be at least estimated_cost.amount",
          },
        ]
      : [];
  return [...problems.map((e) => problemOf(e, doc, lineCounter)), ...range];
}

/** One schema error as a problem on its line. */
function problemOf(e, doc, lineCounter) {
  {
    const at = segments(e.instancePath);
    // An unknown field points at its own line; a missing one at the line of
    // the field that should hold it (as robotheca.org does).
    if (e.keyword === "additionalProperties") {
      at.push(e.params.additionalProperty);
    }
    const holder = e.keyword === "required" ? keyNode(doc, at) : undefined;
    const node = holder ?? (at.length > 0 ? doc.getIn(at, true) : doc.contents);
    const offset = node?.range?.[0] ?? 0;
    const where = e.instancePath || "the top level";
    const detail =
      e.keyword === "additionalProperties"
        ? `unknown field "${e.params.additionalProperty}"`
        : e.keyword === "required"
          ? `missing field "${e.params.missingProperty}"`
          : e.message;
    return {
      line: lineCounter.linePos(offset).line,
      message: `${where}: ${detail}`,
    };
  }
}

// As a GitHub Action: node validate.mjs [path]. Without a path it looks
// for robotheca.yaml, then robot.yaml, at the repository's root.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const file =
    process.argv[2] || FILE_NAMES.find((name) => existsSync(name)) || "";
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    console.log(
      `::error title=robotheca.yaml::${file || "robotheca.yaml (or robot.yaml)"} was not found`,
    );
    process.exit(1);
  }
  const problems = checkRobotYaml(text);
  const version = (() => {
    try {
      return versionOf(parseDocument(text).toJS());
    } catch {
      return "1.0";
    }
  })();
  for (const p of problems) {
    console.log(
      `::error file=${file},line=${p.line},title=robotheca.yaml::${p.message}`,
    );
  }
  if (problems.length > 0) {
    console.log(
      `${file}: ${problems.length} problem(s) against robotheca.yaml ${version}.`,
    );
    process.exit(1);
  }
  console.log(`${file} follows robotheca.yaml ${version}.`);
}
