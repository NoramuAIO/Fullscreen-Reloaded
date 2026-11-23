// tests/build.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");

function normalizeGeneratedHeader(bundleText) {
  return bundleText.replace(/^\/\/ Generated on: .*$/m, "// Generated on: <normalized>");
}

test("build.js produces ESM module exporting default start(context) and includes creator.css", async () => {
  const { build } = await import(pathToFileURL(path.join(ROOT, "build.js")).href);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fr-build-test-"));
  const outPath = path.join(tmpDir, "fullscreen-reloaded.js");
  try {
    build({ outFile: outPath });
    const code = fs.readFileSync(outPath, "utf8");
    assert.match(code, /function __createRuntime\(\)/);
    assert.match(code, /export default async function start\(context\)/);
    assert.doesNotMatch(code, /\(function FullscreenReloaded\(\)/);
    assert.match(code, /\/\* --- creator\.css --- \*\//);

    const indexCss = fs.readFileSync(path.join(ROOT, "src/styles/index.css"), "utf8");
    assert.match(indexCss, /@import\s+"\.\/creator\.css";/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("committed fullscreen-reloaded.js is up to date with src/ without mutating working tree", async () => {
  const { build } = await import(pathToFileURL(path.join(ROOT, "build.js")).href);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fr-freshness-test-"));
  const tmpOutPath = path.join(tmpDir, "fullscreen-reloaded.js");
  try {
    build({ outFile: tmpOutPath });
    const freshBundle = normalizeGeneratedHeader(fs.readFileSync(tmpOutPath, "utf8"));
    const committedBundle = normalizeGeneratedHeader(
      fs.readFileSync(path.join(ROOT, "fullscreen-reloaded.js"), "utf8")
    );
    assert.equal(committedBundle, freshBundle);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("installDomStub provides required DOM APIs and restores globals on reset()", async () => {
  const { installDomStub } = await import(pathToFileURL(path.join(ROOT, "tests/helpers/domStub.mjs")).href);
  const hadDocument = Object.prototype.hasOwnProperty.call(globalThis, "document");
  const stub = installDomStub();
  try {
    const root = document.createElement("div");
    root.id = "fr-root";
    root.classList.add("alpha", "beta");
    assert.equal(root.classList.contains("alpha"), true);
    root.classList.toggle("beta");
    assert.equal(root.classList.contains("beta"), false);

    root.style.setProperty("--fr-accent", "#fff");
    assert.equal(root.style.getPropertyValue("--fr-accent"), "#fff");
    root.style.removeProperty("--fr-accent");
    assert.equal(root.style.getPropertyValue("--fr-accent"), "");

    const child = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    child.setAttribute("data-testid", "ring");
    assert.equal(child.getAttribute("data-testid"), "ring");
    root.append(child);
    document.body.appendChild(root);

    assert.equal(document.getElementById("fr-root"), root);
    assert.equal(document.querySelector("#fr-root > svg[data-testid='ring']"), child);
    assert.equal(document.querySelectorAll("svg").length, 1);
    assert.equal(child.closest("#fr-root"), root);
    assert.equal(root.contains(child), true);

    const ac = new AbortController();
    const events = [];
    root.addEventListener("click", () => events.push("capture"), { capture: true, signal: ac.signal });
    child.addEventListener("click", () => events.push("bubble"));
    child.dispatchEvent(new CustomEvent("click", { bubbles: true }));
    assert.deepEqual(events, ["capture", "bubble"]);

    ac.abort();
    child.dispatchEvent(new CustomEvent("click", { bubbles: true }));
    assert.deepEqual(events, ["capture", "bubble", "bubble"]);

    localStorage.setItem("k", "v");
    assert.equal(localStorage.getItem("k"), "v");

    child.removeAttribute("data-testid");
    assert.equal(child.getAttribute("data-testid"), null);
    root.remove();
    assert.equal(document.getElementById("fr-root"), null);
  } finally {
    stub.reset();
  }
  assert.equal(Object.prototype.hasOwnProperty.call(globalThis, "document"), hadDocument);
});

test("createSpotiKitMock provides SpotiKit APIs, ctx lifecycle, and emitTrack", async () => {
  const { installDomStub, createSpotiKitMock } = await import(
    pathToFileURL(path.join(ROOT, "tests/helpers/domStub.mjs")).href
  );
  const dom = installDomStub();
  const mock = createSpotiKitMock();
  try {
    await mock.SpotiKit.ready;
    assert.equal(mock.ctx.id, "fullscreen-reloaded");
    assert.equal(mock.ctx.signal.aborted, false);

    let stopped = false;
    mock.ctx.onStop(() => {
      stopped = true;
    });
    mock.ctx.style("body { color: red; }");
    assert.equal(document.head.querySelectorAll("style").length, 1);

    const scope = mock.SpotiKit.Storage.scope("fullscreen-reloaded");
    scope.set("settings", { theme: "glass" });
    assert.deepEqual(scope.get("settings"), { theme: "glass" });

    let received = null;
    mock.SpotiKit.Player.on("track", (t) => {
      received = t;
    });
    mock.emitTrack({ uri: "spotify:track:1", name: "Test" });
    mock.SpotiKit.Player.play();
    mock.SpotiKit.Player.seek(42000);
    mock.SpotiKit.Player.setShuffle(true);
    mock.SpotiKit.Player.setRepeat("track");
    mock.SpotiKit.Player.setVolume(0.25);
    mock.SpotiKit.Player.setMuted(true);
    mock.SpotiKit.Player.duration = 180000;
    mock.SpotiKit.Queue.next.push({ uri: "spotify:track:2" });
    mock.SpotiKit.Queue.prev.push({ uri: "spotify:track:0" });

    assert.equal(received?.uri, "spotify:track:1");
    assert.equal(mock.SpotiKit.Player.track?.uri, "spotify:track:1");
    assert.equal(mock.SpotiKit.Player.isPlaying, true);

    mock.reset();
    assert.equal(stopped, true);
    assert.equal(document.head.querySelectorAll("style").length, 0);
    assert.equal(mock.ctx.signal.aborted, false);
    assert.equal(mock.SpotiKit.Player.track, null);
    assert.equal(mock.SpotiKit.Player.state.item, null);
    assert.equal(mock.SpotiKit.Player.duration, 0);
    assert.equal(mock.SpotiKit.Player.position, 0);
    assert.equal(mock.SpotiKit.Player.isPlaying, false);
    assert.equal(mock.SpotiKit.Player.shuffle, false);
    assert.equal(mock.SpotiKit.Player.repeat, "off");
    assert.equal(mock.SpotiKit.Player.volume, 0.8);
    assert.equal(mock.SpotiKit.Player.muted, false);
    assert.deepEqual(mock.SpotiKit.Queue.next, []);
    assert.deepEqual(mock.SpotiKit.Queue.prev, []);

    const customMock = createSpotiKitMock({
      Player: { volume: 0.5, repeat: "context" },
      Queue: { next: [{ uri: "spotify:track:seed" }] },
    });
    customMock.emitTrack({ uri: "spotify:track:override" });
    customMock.SpotiKit.Player.setVolume(0.1);
    customMock.SpotiKit.Player.setRepeat("track");
    customMock.SpotiKit.Queue.next.push({ uri: "spotify:track:extra" });
    customMock.reset();
    assert.equal(customMock.SpotiKit.Player.track, null);
    assert.equal(customMock.SpotiKit.Player.volume, 0.5);
    assert.equal(customMock.SpotiKit.Player.repeat, "context");
    assert.deepEqual(customMock.SpotiKit.Queue.next, [{ uri: "spotify:track:seed" }]);
  } finally {
    dom.reset();
  }
});
