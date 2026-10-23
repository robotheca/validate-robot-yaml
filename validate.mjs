// Checks a robot.yaml against Robotheca's schema (spec/robot.schema.json,
// copied next to this file), with the same checker as robotheca.org (Ajv,
// JSON Schema 2020-12). As a GitHub Action (action.yml) it writes each
// problem as an annotation on the file's line; as a module it exports
// checkRobotYaml for tests.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { isMap, LineCounter, parseDocument } from "yaml";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(
  readFileSync(path.join(here, "robot.schema.json"), "utf8"),
);

let compiled;
function validator() {
  if (!compiled) {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: true,
      allowUnionTypes: true,
    });
    addFormats(ajv, ["uri", "date"]);
    compiled = ajv.compile(schema);
  }
  return compiled;
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
  const validate = validator();
  if (validate(data)) return [];
  return (validate.errors ?? []).map((e) => {
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
  });
}

// As a GitHub Action: node validate.mjs <path to robot.yaml>
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const file = process.argv[2] || "robot.yaml";
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    console.log(`::error title=robot.yaml::${file} was not found`);
    process.exit(1);
  }
  const problems = checkRobotYaml(text);
  for (const p of problems) {
    console.log(
      `::error file=${file},line=${p.line},title=robot.yaml::${p.message}`,
    );
  }
  if (problems.length > 0) {
    console.log(
      `${file}: ${problems.length} problem(s) against robot.yaml v${schema.properties.format_version.const}.`,
    );
    process.exit(1);
  }
  console.log(
    `${file} follows robot.yaml v${schema.properties.format_version.const}.`,
  );
}
