import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";

/**
 * A top-level export that survives to runtime, with its 1-based line. `name` is
 * the exported binding, or a description of the form for `export * from`, whose
 * names are not knowable from this file alone.
 */
type ValueExport = { name: string; line: number };

/**
 * A regex cannot do this: it misses the `export { X }` and `export * from`
 * forms, and it cannot tell an erased type export from a value one.
 */
function valueExports(source: string, fileName: string): ValueExport[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const lineOf = (node: ts.Node) =>
    file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
  const found: ValueExport[] = [];

  for (const statement of file.statements) {
    if (ts.isExportAssignment(statement)) {
      found.push({ name: "default", line: lineOf(statement) });
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      const clause = statement.exportClause;
      if (!clause) {
        const from = statement.moduleSpecifier?.getText(file) ?? "";
        found.push({ name: `* from ${from}`, line: lineOf(statement) });
      } else if (ts.isNamespaceExport(clause)) {
        found.push({ name: clause.name.text, line: lineOf(statement) });
      } else {
        for (const element of clause.elements) {
          if (element.isTypeOnly) continue;
          found.push({ name: element.name.text, line: lineOf(element) });
        }
      }
      continue;
    }

    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const has = (kind: ts.SyntaxKind) => modifiers?.some((m) => m.kind === kind) ?? false;
    // `declare` emits nothing, so an ambient export cannot pin code in a chunk.
    if (!has(ts.SyntaxKind.ExportKeyword) || has(ts.SyntaxKind.DeclareKeyword)) continue;
    const line = lineOf(statement);

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        for (const name of boundNames(declaration.name)) found.push({ name, line });
      }
    } else if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      const name = has(ts.SyntaxKind.DefaultKeyword) ? "default" : statement.name?.text;
      if (name) found.push({ name, line });
    } else if (ts.isEnumDeclaration(statement) || ts.isModuleDeclaration(statement)) {
      found.push({ name: statement.name.getText(file), line });
    }
  }

  return found;
}

function boundNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : boundNames(element.name),
  );
}

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

// The generator's own config, so the scan cannot drift from the route tree it
// builds. The `-` prefix exclusion is not in here — the generator hardcodes it.
const { routesDirectory, routeFileIgnorePattern } = JSON.parse(
  readFileSync(join(APP_DIR, "tsr.config.json"), "utf8"),
) as { routesDirectory: string; routeFileIgnorePattern: string };

const ROUTES_DIR = join(APP_DIR, routesDirectory);
const IGNORED = new RegExp(routeFileIgnorePattern);

/**
 * Route files per ADR 0005: everything under the routes directory except the
 * `-` prefixed private files and directories (ADR 0002) and the files the
 * generator itself ignores.
 */
function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.name.startsWith("-")) return [];
    if (entry.isDirectory()) return routeFiles(path);
    if (IGNORED.test(relative(ROUTES_DIR, path))) return [];
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const ADVICE = [
  "ADR 0005: `Route` is a route file's only value export.",
  "A second value export stops TanStack Start from code-splitting the route's",
  "render path, so the component stays in the eager bundle and nothing warns.",
  "Fix: move the component to a `-components/` directory beside the route file.",
  "A file under routes/ that is not a route takes a `-` prefix (ADR 0002),",
  "which keeps it out of the route tree and out of this check.",
  "See docs/adr/0005-route-component-colocation.md",
].join("\n");

describe("valueExports", () => {
  const names = (source: string) => valueExports(source, "sample.ts").map((e) => e.name);

  test("reports an exported const", () => {
    expect(names("export const Route = 1;")).toEqual(["Route"]);
  });

  test("reports every binding of a multi-declaration export", () => {
    expect(names("export const a = 1, b = 2;")).toEqual(["a", "b"]);
  });

  test("reports every binding of a destructured export", () => {
    expect(names("export const { a, b: [c] } = thing;")).toEqual(["a", "c"]);
  });

  test("reports an exported function and class", () => {
    expect(names("export function Home() {}\nexport class Thing {}")).toEqual(["Home", "Thing"]);
  });

  test("ignores declarations that are not exported", () => {
    expect(names("const Home = 1;\nfunction other() {}")).toEqual([]);
  });

  test("ignores interfaces and type aliases", () => {
    expect(names("export interface RouterAppContext {}\nexport type Id = string;")).toEqual([]);
  });

  test("ignores a type-only export clause", () => {
    expect(names('export type { Id } from "./ids";')).toEqual([]);
  });

  test("reports the value members of a mixed export clause", () => {
    expect(names("const A = 1;\ntype B = 1;\nexport { A, type B };")).toEqual(["A"]);
  });

  test("reports the alias of a renamed export", () => {
    expect(names("const A = 1;\nexport { A as Route };")).toEqual(["Route"]);
  });

  test("reports a wildcard re-export, whose names this file cannot know", () => {
    expect(names('export * from "./home";')).toEqual(['* from "./home"']);
  });

  test("reports a namespaced wildcard re-export under its alias", () => {
    expect(names('export * as home from "./home";')).toEqual(["home"]);
  });

  test("reports a default export", () => {
    expect(names("const Home = 1;\nexport default Home;")).toEqual(["default"]);
  });

  test("reports a default function declaration", () => {
    expect(names("export default function Home() {}")).toEqual(["default"]);
  });

  test("reports an exported enum", () => {
    expect(names("export enum Mode { On }")).toEqual(["Mode"]);
  });

  test("ignores an ambient declaration, which emits nothing", () => {
    expect(names("export declare const injected: string;")).toEqual([]);
  });

  test("reads .tsx, where a lone type argument is not a JSX element", () => {
    const source = "const cast = <T,>(v: T) => v;\nexport const Route = cast(1);";
    expect(valueExports(source, "sample.tsx").map((e) => e.name)).toEqual(["Route"]);
  });

  test("gives the 1-based line of each export", () => {
    expect(valueExports("\n\nexport const Route = 1;", "sample.ts")).toEqual([
      { name: "Route", line: 3 },
    ]);
  });
});

describe("the routes directory", () => {
  const files = routeFiles(ROUTES_DIR);

  test("finds route files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(
    files.map((f) => [relative(ROUTES_DIR, f), f] as const),
  )("routes/%s exports `Route` and nothing else", (rel, file) => {
    const exports = valueExports(readFileSync(file, "utf8"), file);
    const problems = exports
      .filter((e) => e.name !== "Route")
      .map((e) => `routes/${rel}:${e.line} exports \`${e.name}\``);
    if (!exports.some((e) => e.name === "Route")) {
      problems.push(`routes/${rel} exports no \`Route\``);
    }
    expect(problems.length === 0 ? "" : [...problems, "", ADVICE].join("\n")).toBe("");
  });
});
