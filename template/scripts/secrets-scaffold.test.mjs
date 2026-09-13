import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// The tree the script reads: the project name and the two custom domains.
// Built rather than copied, so the tests do not depend on this project's own
// wrangler config.
const FIXTURE = {
  "package.json": '{\n  "name": "acme-com"\n}\n',
  "apps/web/wrangler.jsonc":
    '{\n  // comments are allowed here\n  "name": "acme-com",\n  "env": {\n    "dev": { "routes": [{ "pattern": "dev.acme.com", "custom_domain": true }] },\n    "prod": { "routes": [{ "pattern": "acme.com", "custom_domain": true }] }\n  }\n}\n',
};

// A stand-in `op` on PATH. It records every call (argv and stdin) and answers
// the read commands from environment variables, so a test declares which
// vaults and items already exist.
const OP_STUB = `#!/bin/sh
n=$(ls "$OP_CALLS" | wc -l | tr -d ' ')
n=$((n / 2 + 1))
printf '%s\\n' "$@" > "$OP_CALLS/$n.args"
cat > "$OP_CALLS/$n.stdin"
case "$1" in
  whoami)
    [ "$OP_SIGNED_IN" = 1 ] || { echo "[ERROR] account is not signed in" >&2; exit 1; }
    ;;
  vault)
    [ "$2" = list ] && printf '%s' "$OP_VAULTS"
    ;;
  item)
    [ "$2" = list ] && printf '%s' "$OP_ITEMS"
    ;;
esac
exit 0
`;

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "secrets-scaffold-test-"));
  for (const [path, text] of Object.entries(FIXTURE)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  mkdirSync(join(dir, "scripts"));
  for (const file of ["secrets-scaffold.mjs", "secrets.manifest.json"]) {
    copyFileSync(join(import.meta.dir, file), join(dir, "scripts", file));
  }
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin/op"), OP_STUB);
  chmodSync(join(dir, "bin/op"), 0o755);
  mkdirSync(join(dir, "op-calls"));
  return dir;
}

function scaffold(dir, args, store = {}) {
  const env = {
    ...process.env,
    PATH: `${join(dir, "bin")}:${process.env.PATH}`,
    OP_CALLS: join(dir, "op-calls"),
    OP_SIGNED_IN: store.signedIn === false ? "0" : "1",
    OP_VAULTS: JSON.stringify((store.vaults ?? []).map((name) => ({ name }))),
    OP_ITEMS: JSON.stringify((store.items ?? []).map((title) => ({ title }))),
  };
  const result = spawnSync(process.execPath, ["scripts/secrets-scaffold.mjs", ...args], {
    cwd: dir,
    env,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function opCalls(dir) {
  const callsDir = join(dir, "op-calls");
  const numbers = [...new Set(readdirSync(callsDir).map((f) => Number(f.split(".")[0])))].sort(
    (a, b) => a - b,
  );
  return numbers.map((n) => ({
    args: readFileSync(join(callsDir, `${n}.args`), "utf8")
      .trimEnd()
      .split("\n"),
    stdin: readFileSync(join(callsDir, `${n}.stdin`), "utf8"),
  }));
}

function createdItems(dir) {
  return opCalls(dir)
    .filter((c) => c.args[0] === "item" && c.args[1] === "create")
    .map((c) => ({ args: c.args, item: JSON.parse(c.stdin) }));
}

function withFixture(fn) {
  const dir = fixture();
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const field = (item, section, label) =>
  item.fields.find((f) => f.section?.id === section && f.label === label);

describe("secrets-scaffold.mjs --print", () => {
  test("prints the checklist without touching op", () => {
    withFixture((dir) => {
      const { status, stdout } = scaffold(dir, ["--print"]);

      expect(status).toBe(0);
      expect(opCalls(dir)).toEqual([]);
      expect(stdout).toContain('"acme-com dev"');
      expect(stdout).toContain('"acme-com prod"');
      expect(stdout).toContain("cloudflare");
      expect(stdout).toContain("api-token");
      expect(stdout).toContain("GitHub secret CLOUDFLARE_API_TOKEN");
      expect(stdout).toContain("https://dev.acme.com");
      expect(stdout).toContain("https://acme.com");
    });
  });
});

describe("secrets-scaffold.mjs creates the items", () => {
  test("creates the vault and one item per environment from the manifest", () => {
    withFixture((dir) => {
      const { status, stdout, stderr } = scaffold(dir, []);

      expect(stderr).toBe("");
      expect(status).toBe(0);

      const calls = opCalls(dir);
      expect(calls.map((c) => c.args.slice(0, 2))).toEqual([
        ["whoami"],
        ["vault", "list"],
        ["vault", "create"],
        ["item", "create"],
        ["item", "create"],
      ]);
      const vaultCreate = calls[2].args;
      expect(vaultCreate[2]).toBe("acme-com");
      expect(vaultCreate).toContain("--description");

      const items = createdItems(dir);
      expect(items.map((i) => i.item.title)).toEqual(["acme-com dev", "acme-com prod"]);
      for (const { args, item } of items) {
        expect(args).toContain("--vault");
        expect(args[args.indexOf("--vault") + 1]).toBe("acme-com");
        expect(item.sections.map((s) => s.label)).toEqual([
          "cloudflare",
          "convex",
          "google",
          "app",
        ]);
        expect(field(item, "cloudflare", "api-token")).toMatchObject({
          type: "CONCEALED",
          value: "",
        });
        expect(field(item, "cloudflare", "account-id")).toMatchObject({
          type: "STRING",
          value: "",
        });
        expect(field(item, "convex", "deploy-key")).toMatchObject({ type: "CONCEALED", value: "" });
        expect(field(item, "google", "client-secret")).toMatchObject({
          type: "CONCEALED",
          value: "",
        });
      }

      const [dev, prod] = items.map((i) => i.item);
      expect(field(dev, "app", "site-url").value).toBe("https://dev.acme.com");
      expect(field(prod, "app", "site-url").value).toBe("https://acme.com");

      const devSecret = field(dev, "convex", "auth-secret").value;
      const prodSecret = field(prod, "convex", "auth-secret").value;
      expect(devSecret).toMatch(/^[A-Za-z0-9+/]{43}=$/);
      expect(prodSecret).toMatch(/^[A-Za-z0-9+/]{43}=$/);
      expect(devSecret).not.toBe(prodSecret);
      expect(stdout).not.toContain(devSecret);
      expect(stdout).not.toContain(prodSecret);

      expect(stdout).toContain("op://acme-com/acme-com dev/convex/deploy-key");
    });
  });

  test("uses an existing vault and honours --vault and --name", () => {
    withFixture((dir) => {
      const { status } = scaffold(dir, ["--vault", "shared", "--name", "widget"], {
        vaults: ["shared"],
      });

      expect(status).toBe(0);
      const kinds = opCalls(dir).map((c) => c.args.slice(0, 2));
      expect(kinds).not.toContainEqual(["vault", "create"]);
      const items = createdItems(dir);
      expect(items.map((i) => i.item.title)).toEqual(["widget dev", "widget prod"]);
      expect(items[0].args[items[0].args.indexOf("--vault") + 1]).toBe("shared");
    });
  });

  test("--dry-run reads but writes nothing", () => {
    withFixture((dir) => {
      const { status, stdout } = scaffold(dir, ["--dry-run"], { vaults: ["acme-com"] });

      expect(status).toBe(0);
      const kinds = opCalls(dir).map((c) => c.args.slice(0, 2));
      expect(kinds).toEqual([["whoami"], ["vault", "list"], ["item", "list"]]);
      expect(stdout).toContain("acme-com dev");
      expect(stdout).toContain("dry run");
    });
  });

  test("an existing item stops the run before anything is written", () => {
    withFixture((dir) => {
      const { status, stderr } = scaffold(dir, [], {
        vaults: ["acme-com"],
        items: ["acme-com prod"],
      });

      expect(status).toBe(1);
      expect(stderr).toContain('"acme-com prod" already exists');
      expect(createdItems(dir)).toEqual([]);
    });
  });

  test("a signed-out op fails with a hint and writes nothing", () => {
    withFixture((dir) => {
      const { status, stderr } = scaffold(dir, [], { signedIn: false });

      expect(status).toBe(1);
      expect(stderr).toContain("op signin");
      expect(stderr).toContain("--print");
      expect(opCalls(dir).map((c) => c.args[0])).toEqual(["whoami"]);
    });
  });
});
